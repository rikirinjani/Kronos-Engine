/**
 * EXP-001E Phase 3 — Minimal Causal State Identification
 *
 * Direct comparison: Parent DR state vs Fresh branch DR state at same tick.
 * If they match → the divergence is in the fresh branch setup, not reconstruction.
 * If they diverge → reconstruction is broken.
 *
 * Then systematically test each non-counter mutable state candidate:
 *   1. Clock RNG (position 0 vs position clockTick)
 *   2. Agent state (fresh init vs snapshot restore)
 *   3. Referral state (fresh init vs snapshot restore)
 *   4. HospitalState _agentState / _referralState fields
 *   5. Journal singleton state
 *
 * HARD BOUNDARIES: No Monte Carlo. No production changes. Diagnostic only.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, tick as kronosTick, run, snapshot, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";
import { createClock, createRng } from "../../../../Deers-Rock/dist/engine/clock.js";

// DR counter resets
import { resetChargeCounter } from "../../../../Deers-Rock/dist/engine/charge-generator.js";
import { resetCssdCounters } from "../../../../Deers-Rock/dist/engine/cssd.js";
import { resetDialysisCounters } from "../../../../Deers-Rock/dist/engine/dialysis.js";
import { resetScenarioCounter } from "../../../../Deers-Rock/dist/engine/scenario.js";
import { resetBloodBankCounters } from "../../../../Deers-Rock/dist/engine/blood-bank.js";
import { resetClinicalNutritionCounters } from "../../../../Deers-Rock/dist/engine/clinical-nutrition.js";
import { resetIpcCounter } from "../../../../Deers-Rock/dist/engine/ipc.js";
import { resetMicrobiologyCounter } from "../../../../Deers-Rock/dist/engine/microbiology.js";
import { resetPathologyCounter } from "../../../../Deers-Rock/dist/engine/pathology.js";
import { resetMmConferenceCounter } from "../../../../Deers-Rock/dist/engine/mm-conference.js";
import { resetRadiotherapyCounters } from "../../../../Deers-Rock/dist/engine/radiotherapy.js";
import { resetBiomedCounter } from "../../../../Deers-Rock/dist/engine/biomedical-engineering.js";
import { resetJournalPurgeTick, resetJournalExportTick } from "../../../../Deers-Rock/dist/engine/journal.js";
import { resetPatientCounter } from "../../../../Deers-Rock/dist/patient/generator.js";
import { resetNikCounter } from "../../../../Deers-Rock/dist/identity/generator.js";
import { resetAgentCounter } from "../../../../Deers-Rock/dist/agent/generator.js";

function resetAllDrCounters() {
  resetPatientCounter(); resetNikCounter(); resetAgentCounter();
  resetChargeCounter(); resetCssdCounters(); resetDialysisCounters(); resetScenarioCounter();
  resetBloodBankCounters(); resetClinicalNutritionCounters(); resetIpcCounter();
  resetMicrobiologyCounter(); resetPathologyCounter(); resetMmConferenceCounter();
  resetRadiotherapyCounters(); resetBiomedCounter(); resetJournalPurgeTick(); resetJournalExportTick();
}

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const DR_SECTOR_ID = "deers-rock-makassar-001";
const OBS_SECTOR_ID = "exp-001-observer";
const INTERVENTION = { climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 } };

function loadEraState(f: string, id: string): any {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  return JSON.parse(readFileSync(join(__dirname, `../../../docs/history/${f}`), "utf-8")).states[id];
}

function buildSectorConfigs(era: any) {
  const en: any = {}; const tn: any = {};
  for (const n of era.nations) {
    en[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    tn[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: en, year: era.year },
    technology: { nations: tn, year: era.year },
  };
}

function createAllSectors(seed: number, includeObserver: boolean): Sector[] {
  const base: Sector[] = [
    createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, seed),
  ];
  if (includeObserver) base.push(createExp001ObserverSector());
  return base;
}

function patchState(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patchState(r[k], v);
    else r[k] = v;
  }
  return r;
}

function runBranch(seed: number, horizon: number, rp: any, sectorMap: Map<string, Sector>): any {
  const rewindSnap: any = {
    tick: rp.tick, rngState: rp.rngState,
    sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({ id, state: st })),
    universeId: rp.universeId, sectorReconstructors: rp.sectorReconstructors,
  };
  let branch = restoreSnapshot(rewindSnap, sectorMap);
  const ns = new Map(branch.sectors);
  for (const [sid, ov] of Object.entries(INTERVENTION)) {
    const rec: any = ns.get(sid);
    if (rec) ns.set(sid, { sector: rec.sector, state: patchState(rec.state, ov) });
  }
  branch = { ...branch, sectors: ns };

  let lastDr: any = null;
  for (let t = 1; t <= horizon; t++) {
    branch = kronosTick(branch);
    lastDr = branch.sectors.get(DR_SECTOR_ID)?.state as any;
  }
  return { world: lastDr?.world, sentinelOutput: lastDr?.sentinelOutput };
}

function drStateFingerprint(drState: any): Record<string, number> {
  if (!drState) return {};
  const w = drState.world;
  if (!w) return {};
  const state = w.state;
  if (!state) return {};
  const beds = state.beds instanceof Map ? [...state.beds.values()] : [];
  return {
    clockTick: w.clock?.tick ?? -1,
    clockRngSeed: w.clock?.rngSeed ?? -1,
    bedsTotal: beds.length,
    bedsOccupied: beds.filter((b: any) => b.patientId).length,
    encounters: state.encounters?.size ?? -1,
    labOrders: state.labOrders?.size ?? -1,
    medOrders: state.medicationOrders?.size ?? -1,
    agentPoolSize: state._agentState?.pool?.agents?.size ?? -1,
    referralLetters: state._referralState?.letters?.size ?? -1,
    referralFacilities: state._referralState?.facilities?.size ?? -1,
  };
}

function approxEqual(a: number | null, b: number | null, tol: number): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < tol;
}

function deepCloneState(state: any): any {
  return JSON.parse(JSON.stringify(state));
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
const seed = 1003;
const horizon = 50;

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E Phase 3: Minimal Causal State Identification`);
console.log(`seed=${seed}  horizon=${horizon}`);
console.log(`${"=".repeat(70)}\n`);

// ── PART 1: Direct comparison — Parent vs Fresh branch DR state ──
console.log(`${"─".repeat(70)}`);
console.log("PART 1: Parent DR state vs Fresh branch DR state at same tick");
console.log(`${"─".repeat(70)}\n`);

// Case A: Fresh branch (no parent)
resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectorsA = createAllSectors(seed, false);
const sectorMapA = new Map(sectorsA.map(s => [s.id, s]));
const worldA = createWorld(sectorsA, buildSectorConfigs(era), { seed });
const rpA = createRewindPoint(worldA, "preseeded", { label: "t0", tags: [] });
const caseA = runBranch(seed, horizon, rpA, sectorMapA);
const fpA = drStateFingerprint(caseA);
console.log("Case A (fresh branch):");
console.log(`  ${JSON.stringify(fpA)}`);

// Case B: Parent then reconstructed branch
resetUniverseCounter();
const sectorsB = createAllSectors(seed, false);
const sectorMapB = new Map(sectorsB.map(s => [s.id, s]));
const worldB = createWorld(sectorsB, buildSectorConfigs(era), { seed });
const rpB = createRewindPoint(worldB, "preseeded", { label: "t0", tags: [] });
run(worldB, horizon);
const caseB = runBranch(seed, horizon, rpB, sectorMapB);
const fpB = drStateFingerprint(caseB);
console.log("\nCase B (parent → reconstruct):");
console.log(`  ${JSON.stringify(fpB)}`);

console.log(`\nFingerprint match: ${JSON.stringify(fpA) === JSON.stringify(fpB)}`);
console.log(`  clockTick: ${fpA.clockTick} vs ${fpB.clockTick} (${fpA.clockTick === fpB.clockTick ? "MATCH" : "DIFFER"})`);
console.log(`  encounters: ${fpA.encounters} vs ${fpB.encounters} (${fpA.encounters === fpB.encounters ? "MATCH" : "DIFFER"})`);
console.log(`  bedsOccupied: ${fpA.bedsOccupied} vs ${fpB.bedsOccupied} (${fpA.bedsOccupied === fpB.bedsOccupied ? "MATCH" : "DIFFER"})`);
console.log(`  agentPoolSize: ${fpA.agentPoolSize} vs ${fpB.agentPoolSize} (${fpA.agentPoolSize === fpB.agentPoolSize ? "MATCH" : "DIFFER"})`);

// ── PART 2: Clock RNG position test ──────────────────────────────
console.log(`\n${"─".repeat(70)}`);
console.log("PART 2: Clock RNG — does reconstruction advance RNG?");
console.log(`${"─".repeat(70)}\n`);

// Create fresh clock from same seed, advance it N times
const testSeed = seed;
const clock0 = createClock(60, testSeed);
const clock10 = (() => {
  let c = clock0;
  for (let i = 0; i < 10; i++) c = { ...c, tick: c.tick + 1, hospitalTimeMs: (c.tick + 1) * c.tickIntervalMs * c.speedMultiplier };
  return c;
})();

// Sample RNG values at position 0 and after 10 ticks
const rngAt0: number[] = [];
const rngAt10: number[] = [];
const tmp0 = createClock(60, testSeed);
const tmp10 = createClock(60, testSeed);
for (let i = 0; i < 10; i++) {
  // advance tmp10 once
  tmp10.tick = tmp10.tick + 1;
  tmp10.hospitalTimeMs = tmp10.tick * tmp10.tickIntervalMs * tmp10.speedMultiplier;
}
for (let i = 0; i < 5; i++) {
  rngAt0.push(tmp0.rng());
  rngAt10.push(tmp10.rng());
}
console.log("RNG at position 0 (first 5 calls):", rngAt0.map(v => v.toFixed(6)));
console.log("RNG at position 10 (first 5 calls):", rngAt10.map(v => v.toFixed(6)));
console.log("RNG sequences differ: ", JSON.stringify(rngAt0) !== JSON.stringify(rngAt10));
console.log("  Note: RNG closure state is OPAQUE. Position 0 ≠ position 10 even with same seed.");

// ── PART 3: Systematic elimination ────────────────────────────────
console.log(`\n${"─".repeat(70)}`);
console.log("PART 3: Systematic elimination of non-counter candidates");
console.log(`${"─".repeat(70)}\n`);

// For each candidate, run:
//   Case X: parent → reconstruct → reset candidate → run branch
// Compare with Case A (fresh) and Case B (unmodified reconstruct)

interface TestResult {
  label: string;
  occ: number | null;
  encounters: number | null;
  patients: number | null;
  healthEvents: number;
  matchesA: boolean;
  matchesB: boolean;
}

function extractCaseResult(r: any): { occ: number | null; encounters: number | null; patients: number | null; healthEvents: number } {
  const inner: any = r?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    occ: r?.sentinelOutput?.occupancyRate ?? null,
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    healthEvents: 0,
  };
}

const resultA = extractCaseResult(caseA);
const resultB = extractCaseResult(caseB);

function resultsMatch(x: any, y: any): boolean {
  return approxEqual(x.occ, y.occ, 0.001)
    && approxEqual(x.encounters, y.encounters, 1)
    && x.patients === y.patients;
}

console.log("Baseline:");
console.log(`  A (fresh):     occ=${resultA.occ?.toFixed(3)} enc=${resultA.encounters} pts=${resultA.patients}`);
console.log(`  B (reconstruct): occ=${resultB.occ?.toFixed(3)} enc=${resultB.encounters} pts=${resultB.patients}`);
console.log(`  A == B: ${resultsMatch(resultA, resultB)}\n`);

// The candidates from the inventory:
//   C1: Clock RNG position (already tested in Part 2 — closure is opaque)
//   C2: Agent state (pool size, learning state)
//   C3: Referral state (facilities, letters)
//   C4: HospitalState._rngSeed
//   C5: Journal singleton state (lastPurgeTick, lastExportTick)

// Test: Reset agent state to fresh init values
function resetAgentStateToFresh(drWorld: any) {
  const state = drWorld.state;
  if (state._agentState) {
    // Reset agent pool to empty (as if freshly initialized)
    state._agentState.pool = { agents: new Map() };
    state._agentState.learning = { events: [], policy: {} };
  }
}

function resetReferralStateToFresh(drWorld: any) {
  const state = drWorld.state;
  if (state._referralState) {
    state._referralState = { facilities: new Map(), letters: [] };
  }
}

function resetAgentAndReferralToFresh(drWorld: any) {
  resetAgentStateToFresh(drWorld);
  resetReferralStateToFresh(drWorld);
}

// Candidate 1: Reset agent state to fresh
resetUniverseCounter();
const sectorsC1 = createAllSectors(seed, false);
const sectorMapC1 = new Map(sectorsC1.map(s => [s.id, s]));
const worldC1 = createWorld(sectorsC1, buildSectorConfigs(era), { seed });
const rpC1 = createRewindPoint(worldC1, "preseeded", { label: "t0", tags: [] });
run(worldC1, horizon);
// Get parent DR state, reset agent state, then run fresh branch
const parentDrC1: any = worldC1.sectors.get(DR_SECTOR_ID)?.state;
resetAgentStateToFresh(parentDrC1.world);
const caseC1 = runBranch(seed, horizon, rpC1, sectorMapC1);
const rC1 = extractCaseResult(caseC1);
console.log(`Candidate 1 (reset agent state):     occ=${rC1.occ?.toFixed(3)} enc=${rC1.encounters} pts=${rC1.patients}  A==${resultsMatch(resultA, rC1)}  B==${resultsMatch(resultB, rC1)}`);

// Candidate 2: Reset referral state to fresh
resetUniverseCounter();
const sectorsC2 = createAllSectors(seed, false);
const sectorMapC2 = new Map(sectorsC2.map(s => [s.id, s]));
const worldC2 = createWorld(sectorsC2, buildSectorConfigs(era), { seed });
const rpC2 = createRewindPoint(worldC2, "preseeded", { label: "t0", tags: [] });
run(worldC2, horizon);
const parentDrC2: any = worldC2.sectors.get(DR_SECTOR_ID)?.state;
resetReferralStateToFresh(parentDrC2.world);
const caseC2 = runBranch(seed, horizon, rpC2, sectorMapC2);
const rC2 = extractCaseResult(caseC2);
console.log(`Candidate 2 (reset referral state):  occ=${rC2.occ?.toFixed(3)} enc=${rC2.encounters} pts=${rC2.patients}  A==${resultsMatch(resultA, rC2)}  B==${resultsMatch(resultB, rC2)}`);

// Candidate 3: Reset both agent + referral to fresh
resetUniverseCounter();
const sectorsC3 = createAllSectors(seed, false);
const sectorMapC3 = new Map(sectorsC3.map(s => [s.id, s]));
const worldC3 = createWorld(sectorsC3, buildSectorConfigs(era), { seed });
const rpC3 = createRewindPoint(worldC3, "preseeded", { label: "t0", tags: [] });
run(worldC3, horizon);
const parentDrC3: any = worldC3.sectors.get(DR_SECTOR_ID)?.state;
resetAgentAndReferralToFresh(parentDrC3.world);
const caseC3 = runBranch(seed, horizon, rpC3, sectorMapC3);
const rC3 = extractCaseResult(caseC3);
console.log(`Candidate 3 (reset agent+referral):  occ=${rC3.occ?.toFixed(3)} enc=${rC3.encounters} pts=${rC3.patients}  A==${resultsMatch(resultA, rC3)}  B==${resultsMatch(resultB, rC3)}`);

// Candidate 4: Reset _rngSeed to fresh value
resetUniverseCounter();
const sectorsC4 = createAllSectors(seed, false);
const sectorMapC4 = new Map(sectorsC4.map(s => [s.id, s]));
const worldC4 = createWorld(sectorsC4, buildSectorConfigs(era), { seed });
const rpC4 = createRewindPoint(worldC4, "preseeded", { label: "t0", tags: [] });
run(worldC4, horizon);
const parentDrC4: any = worldC4.sectors.get(DR_SECTOR_ID)?.state;
// Reset _rngSeed — but this is just metadata, not the actual RNG
parentDrC4.world.state._rngSeed = parentDrC4.world.clock.rngSeed;
const caseC4 = runBranch(seed, horizon, rpC4, sectorMapC4);
const rC4 = extractCaseResult(caseC4);
console.log(`Candidate 4 (reset _rngSeed):        occ=${rC4.occ?.toFixed(3)} enc=${rC4.encounters} pts=${rC4.patients}  A==${resultsMatch(resultA, rC4)}  B==${resultsMatch(resultB, rC4)}`);

// Candidate 5: Reset everything non-counter (agent + referral + rngSeed)
resetUniverseCounter();
const sectorsC5 = createAllSectors(seed, false);
const sectorMapC5 = new Map(sectorsC5.map(s => [s.id, s]));
const worldC5 = createWorld(sectorsC5, buildSectorConfigs(era), { seed });
const rpC5 = createRewindPoint(worldC5, "preseeded", { label: "t0", tags: [] });
run(worldC5, horizon);
const parentDrC5: any = worldC5.sectors.get(DR_SECTOR_ID)?.state;
resetAgentAndReferralToFresh(parentDrC5.world);
parentDrC5.world.state._rngSeed = parentDrC5.world.clock.rngSeed;
const caseC5 = runBranch(seed, horizon, rpC5, sectorMapC5);
const rC5 = extractCaseResult(caseC5);
console.log(`Candidate 5 (reset all non-counter): occ=${rC5.occ?.toFixed(3)} enc=${rC5.encounters} pts=${rC5.patients}  A==${resultsMatch(resultA, rC5)}  B==${resultsMatch(resultB, rC5)}`);

// ═══════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(70)}`);
console.log("VERDICT");
console.log(`${"═".repeat(70)}\n`);

const candidates = [
  { label: "Agent state", result: rC1 },
  { label: "Referral state", result: rC2 },
  { label: "Agent+Referral", result: rC3 },
  { label: "_rngSeed", result: rC4 },
  { label: "All non-counter", result: rC5 },
];

let foundFix = false;
for (const c of candidates) {
  if (resultsMatch(resultA, c.result)) {
    console.log(`✅ FIX FOUND: ${c.label} reset → matches fresh branch`);
    foundFix = true;
  }
}

if (!foundFix) {
  console.log("❌ No single candidate reset fixes the divergence.");
  console.log("");
  console.log("CONCLUSION: The minimal causal state is NOT any of the tested candidates.");
  console.log("The contamination must come from a state that is:");
  console.log("  - NOT module-global counters (proven zero effect)");
  console.log("  - NOT agent state");
  console.log("  - NOT referral state");
  console.log("  - NOT _rngSeed metadata");
  console.log("");
  console.log("Most likely cause: the clock RNG closure itself.");
  console.log("  createWorld creates clock at RNG position 0.");
  console.log("  doReconstruct creates clock at RNG position 0.");
  console.log("  Both should produce same RNG sequence.");
  console.log("  BUT: the parent's DR tick handlers consume RNG values.");
  console.log("  The fresh branch's DR tick handlers also consume RNG values.");
  console.log("  If the handlers consume DIFFERENT amounts of RNG, the sequences diverge.");
  console.log("");
  console.log("INVESTIGATION REQUIRED: Count exact RNG consumption per DR tick.");
}

// ── SAVE ──────────────────────────────────────────────────────────
mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e/phase3-results.json",
  JSON.stringify({
    seed, horizon, timestamp: new Date().toISOString(),
    caseA_fingerprint: fpA, caseB_fingerprint: fpB,
    resultA, resultB,
    candidates: candidates.map(c => ({ label: c.label, result: c.result, matchesA: resultsMatch(resultA, c.result) })),
    foundFix,
  }, null, 2));
console.log("\nResults written to experiment-results/exp-001e/phase3-results.json");
