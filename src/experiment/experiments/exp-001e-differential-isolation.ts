/**
 * EXP-001E — Differential Isolation Test & Minimal Causal State Identification
 *
 * Tests specific candidates for contamination after counters were ruled out by EXP-001B:
 * 1. Clock RNG state (reconstruction doesn't advance RNG)
 * 2. Agent state re-initialization
 * 3. Referral state re-initialization
 * 4. Journal singleton state
 *
 * Uses seed=1003, H=50.
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
import { createWorld, tick, run, snapshot, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";
import { createExp001ObserverSector } from "../exp-001-observer.js";
import { createClock, createRng } from "../../../../Deers-Rock/dist/engine/clock.js";

function extractNumericPaths(obj: Record<string, unknown>, prefix = ""): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") {
      result[path] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, extractNumericPaths(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      result[`${path}.length`] = value.length;
    }
  }
  return result;
}

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

function so(state: any): Record<string, number> {
  const s = state?.sentinelOutput;
  if (!s) return {};
  return { occupancyRate: s.occupancyRate, icuOccupancyRate: s.icuOccupancyRate, mortalityPressure: s.mortalityPressure, supplyStress: s.supplyStress, staffStress: s.staffStress };
}

function soNull(state: any): boolean {
  return state?.sentinelOutput === null || state?.sentinelOutput === undefined;
}

function getObsState(w: any): any {
  return w.sectors.get(OBS_SECTOR_ID)?.state ?? {};
}

function getHealthCounts(obs: any): Record<string, number> {
  const hc: Record<string, number> = {};
  for (const [k, v] of Object.entries(obs.eventCounts ?? {})) {
    if (k.startsWith("health.")) hc[k] = v as number;
  }
  return hc;
}

interface CaseResult {
  occ: number | null;
  icu: number | null;
  mort: number | null;
  supply: number | null;
  staff: number | null;
  healthEvents: number;
  healthDetails: Record<string, number>;
  encounters: number | null;
  patients: number | null;
  sentinelNull: boolean;
}

function extractResult(lastDr: any, lastObs: any): CaseResult {
  const inner: any = lastDr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    occ: lastDr?.sentinelOutput?.occupancyRate ?? null,
    icu: lastDr?.sentinelOutput?.icuOccupancyRate ?? null,
    mort: lastDr?.sentinelOutput?.mortalityPressure ?? null,
    supply: lastDr?.sentinelOutput?.supplyStress ?? null,
    staff: lastDr?.sentinelOutput?.staffStress ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    healthDetails: getHealthCounts(lastObs),
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    sentinelNull: soNull(lastDr),
  };
}

function runBranch(seed: number, horizon: number, rp: any, sectorMap: Map<string, Sector>): CaseResult {
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
  let lastObs: any = null;
  for (let t = 1; t <= horizon; t++) {
    branch = tick(branch);
    lastDr = branch.sectors.get(DR_SECTOR_ID)?.state as any;
    lastObs = branch.sectors.get(OBS_SECTOR_ID)?.state as any;
  }
  return extractResult(lastDr, lastObs);
}

function approxEqual(a: number | null, b: number | null, tol: number): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < tol;
}

function resultsMatch(a: CaseResult, b: CaseResult): boolean {
  return approxEqual(a.occ, b.occ, 0.01)
    && a.healthEvents === b.healthEvents
    && approxEqual(a.encounters, b.encounters, 1);
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
const seed = 1003;
const horizon = 50;

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E: Differential Isolation Test`);
console.log(`seed=${seed}  horizon=${horizon}`);
console.log(`${"=".repeat(70)}\n`);

// ── Case A: Fresh independent branch ──────────────────────────────
resetUniverseCounter();
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const sectorsA = createAllSectors(seed, true);
const sectorMapA = new Map(sectorsA.map(s => [s.id, s]));
const worldA = createWorld(sectorsA, buildSectorConfigs(era), { seed });
const rpA = createRewindPoint(worldA, "preseeded", { label: "t0", tags: [] });
const caseA = runBranch(seed, horizon, rpA, sectorMapA);

console.log("─── Case A: Fresh independent branch ───");
console.log(`  occ=${caseA.occ?.toFixed(3)}  health=${caseA.healthEvents}  enc=${caseA.encounters}  patients=${caseA.patients}`);

// ── Case B: Parent then reconstructed branch ──────────────────────
resetUniverseCounter();
const sectorsB = createAllSectors(seed, true);
const sectorMapB = new Map(sectorsB.map(s => [s.id, s]));
const worldB = createWorld(sectorsB, buildSectorConfigs(era), { seed });
const rpB = createRewindPoint(worldB, "preseeded", { label: "t0", tags: [] });
run(worldB, horizon);
const caseB = runBranch(seed, horizon, rpB, sectorMapB);

console.log("─── Case B: Parent then reconstructed branch ───");
console.log(`  occ=${caseB.occ?.toFixed(3)}  health=${caseB.healthEvents}  enc=${caseB.encounters}  patients=${caseB.patients}`);

// ── Case C: Parent + counter reset + reconstruct ──────────────────
resetUniverseCounter();
const sectorsC = createAllSectors(seed, true);
const sectorMapC = new Map(sectorsC.map(s => [s.id, s]));
const worldC = createWorld(sectorsC, buildSectorConfigs(era), { seed });
const rpC = createRewindPoint(worldC, "preseeded", { label: "t0", tags: [] });
run(worldC, horizon);
resetAllDrCounters();
const caseC = runBranch(seed, horizon, rpC, sectorMapC);

console.log("─── Case C: Parent + counter reset + reconstruct ───");
console.log(`  occ=${caseC.occ?.toFixed(3)}  health=${caseC.healthEvents}  enc=${caseC.encounters}  patients=${caseC.patients}`);

// ── Case D: Full createWorld re-init (positive control) ───────────
resetUniverseCounter();
const sectorsD = createAllSectors(seed, true);
const sectorMapD = new Map(sectorsD.map(s => [s.id, s]));
const worldD = createWorld(sectorsD, buildSectorConfigs(era), { seed });
const rpD = createRewindPoint(worldD, "preseeded", { label: "t0", tags: [] });
run(worldD, horizon);
resetAllDrCounters();
resetUniverseCounter();
const freshSectors = createAllSectors(seed, true);
const freshSectorMap = new Map(freshSectors.map(s => [s.id, s]));
const freshWorld = createWorld(freshSectors, buildSectorConfigs(era), { seed });
const freshRp = createRewindPoint(freshWorld, "preseeded", { label: "t0", tags: [] });
const caseD = runBranch(seed, horizon, freshRp, freshSectorMap);

console.log("─── Case D: Full createWorld re-init ───");
console.log(`  occ=${caseD.occ?.toFixed(3)}  health=${caseD.healthEvents}  enc=${caseD.encounters}  patients=${caseD.patients}`);

// ═══════════════════════════════════════════════════════════════════
// CANDIDATE TESTING
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(70)}`);
console.log("CANDIDATE TESTING");
console.log(`${"─".repeat(70)}\n`);

// ── Candidate 1: Clock RNG advancement ────────────────────────────
// Hypothesis: doReconstruct creates clock at RNG position 0 but
// sets tick=clockTick. The RNG should be advanced to clockTick.
console.log("--- Candidate 1: Clock RNG advancement ---");

// We can't directly modify doReconstruct in this diagnostic script.
// But we can observe the effect: after doReconstruct, the DR sector's
// world.clock.rng should be at position 0, not position clockTick.
// Let's verify this by checking the clock state after reconstruction.

resetUniverseCounter();
const sectorsC1 = createAllSectors(seed, true);
const sectorMapC1 = new Map(sectorsC1.map(s => [s.id, s]));
const worldC1 = createWorld(sectorsC1, buildSectorConfigs(era), { seed });
const rpC1 = createRewindPoint(worldC1, "preseeded", { label: "t0", tags: [] });
run(worldC1, horizon);

// Reconstruct and check clock state
const rewindSnapC1: any = {
  tick: rpC1.tick, rngState: rpC1.rngState,
  sectors: Object.entries(rpC1.sectorStates).map(([id, st]) => ({ id, state: st })),
  universeId: rpC1.universeId, sectorReconstructors: rpC1.sectorReconstructors,
};
const branchC1 = restoreSnapshot(rewindSnapC1, sectorMapC1);
const drC1: any = branchC1.sectors.get(DR_SECTOR_ID)?.state;
const clockC1 = drC1?.world?.clock;

console.log(`  Reconstructed clock.tick: ${clockC1?.tick}`);
console.log(`  Reconstructed clock.rngSeed: ${clockC1?.rngSeed}`);
console.log(`  Note: RNG position is opaque (closure), but tick=${clockC1?.tick} while RNG was never advanced.`);

// ── Candidate 2: Agent state ──────────────────────────────────────
// Hypothesis: doReconstruct restores hospitalState._agentState from
// snapshot, but the agent learning state may differ from fresh init.
console.log("\n--- Candidate 2: Agent state ---");

resetUniverseCounter();
const sectorsC2 = createAllSectors(seed, true);
const sectorMapC2 = new Map(sectorsC2.map(s => [s.id, s]));
const worldC2 = createWorld(sectorsC2, buildSectorConfigs(era), { seed });
const rpC2 = createRewindPoint(worldC2, "preseeded", { label: "t0", tags: [] });

// Check initial agent state
const initDrC2: any = worldC2.sectors.get(DR_SECTOR_ID)?.state;
const initAgentState = initDrC2?.world?.state?._agentState;
console.log(`  Initial agent pool size: ${initAgentState?.pool?.agents?.size ?? "N/A"}`);

run(worldC2, horizon);

// Check agent state after parent
const postDrC2: any = worldC2.sectors.get(DR_SECTOR_ID)?.state;
const postAgentState = postDrC2?.world?.state?._agentState;
console.log(`  Post-parent agent pool size: ${postAgentState?.pool?.agents?.size ?? "N/A"}`);

// Reconstruct and check
const rewindSnapC2: any = {
  tick: rpC2.tick, rngState: rpC2.rngState,
  sectors: Object.entries(rpC2.sectorStates).map(([id, st]) => ({ id, state: st })),
  universeId: rpC2.universeId, sectorReconstructors: rpC2.sectorReconstructors,
};
const branchC2 = restoreSnapshot(rewindSnapC2, sectorMapC2);
const drC2: any = branchC2.sectors.get(DR_SECTOR_ID)?.state;
const reconAgentState = drC2?.world?.state?._agentState;
console.log(`  Reconstructed agent pool size: ${reconAgentState?.pool?.agents?.size ?? "N/A"}`);
console.log(`  Agent state preserved from snapshot: ${JSON.stringify(initAgentState?.pool?.agents?.size) === JSON.stringify(reconAgentState?.pool?.agents?.size)}`);

// ── Candidate 3: Full doReconstruct gap analysis ──────────────────
// Compare what createWorld does vs what doReconstruct does
console.log("\n--- Candidate 3: createWorld vs doReconstruct gap analysis ---");

console.log("  createWorld (world.ts:67-112) does:");
console.log("    1. Reset 17 counter functions (22 counters)");
console.log("    2. Create RNG from seed");
console.log("    3. Generate patient pool");
console.log("    4. Create HospitalState");
console.log("    5. Init agent state + generate agent pool");
console.log("    6. Init referral state");
console.log("    7. Create clock from seed");
console.log("    8. Init journal (if path provided)");
console.log("    9. Build handlers");
console.log("");
console.log("  doReconstruct (adapter.ts:233-265) does:");
console.log("    1. Create clock from rngSeed (NO RNG advancement)");
console.log("    2. Create EventQueue from snapshot");
console.log("    3. Wrap snapshot.hospitalState with old handlers");
console.log("    4. Return reconstructed state");
console.log("");
console.log("  doReconstruct SKIPS:");
console.log("    - Counter resets (22 counters)");
console.log("    - Patient pool generation (restores from snapshot)");
console.log("    - Agent state init (restores from snapshot)");
console.log("    - Referral state init (restores from snapshot)");
console.log("    - Journal init");
console.log("    - Clock RNG advancement");

// ═══════════════════════════════════════════════════════════════════
// SUMMARY TABLE
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(70)}`);
console.log("RESULTS TABLE");
console.log(`${"═".repeat(70)}\n`);

const pad = (s: string, n: number) => s.padEnd(n);
const f = (n: number | null) => n?.toFixed(3) ?? "null";

console.log(`Configuration                          | Occ     | ICU     | Supply  | Staff   | Health | Enc  | Patients`);
console.log(`---------------------------------------|---------|---------|---------|---------|--------|------|---------`);
console.log(`${pad("A: Fresh branch", 40)}| ${pad(f(caseA.occ), 8)}| ${pad(f(caseA.icu), 8)}| ${pad(f(caseA.supply), 8)}| ${pad(f(caseA.staff), 8)}| ${pad(String(caseA.healthEvents), 7)}| ${pad(String(caseA.encounters), 5)}| ${pad(String(caseA.patients), 8)}`);
console.log(`${pad("B: Parent → reconstruct", 40)}| ${pad(f(caseB.occ), 8)}| ${pad(f(caseB.icu), 8)}| ${pad(f(caseB.supply), 8)}| ${pad(f(caseB.staff), 8)}| ${pad(String(caseB.healthEvents), 7)}| ${pad(String(caseB.encounters), 5)}| ${pad(String(caseB.patients), 8)}`);
console.log(`${pad("C: Parent → counter-reset → reconstruct", 40)}| ${pad(f(caseC.occ), 8)}| ${pad(f(caseC.icu), 8)}| ${pad(f(caseC.supply), 8)}| ${pad(f(caseC.staff), 8)}| ${pad(String(caseC.healthEvents), 7)}| ${pad(String(caseC.encounters), 5)}| ${pad(String(caseC.patients), 8)}`);
console.log(`${pad("D: Parent → full reinit", 40)}| ${pad(f(caseD.occ), 8)}| ${pad(f(caseD.icu), 8)}| ${pad(f(caseD.supply), 8)}| ${pad(f(caseD.staff), 8)}| ${pad(String(caseD.healthEvents), 7)}| ${pad(String(caseD.encounters), 5)}| ${pad(String(caseD.patients), 8)}`);

console.log(`\n  A == D (reinit fixes): ${resultsMatch(caseA, caseD)}`);
console.log(`  A == B (contamination): ${!resultsMatch(caseA, caseB)}`);
console.log(`  A == C (counter-reset fixes): ${resultsMatch(caseA, caseC)}`);

// ═══════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(70)}`);
console.log("VERDICT");
console.log(`${"═".repeat(70)}\n`);

if (resultsMatch(caseA, caseD) && !resultsMatch(caseA, caseB) && resultsMatch(caseB, caseC)) {
  console.log("CONFIRMED: Counter reset has ZERO effect on trajectory.");
  console.log("The contamination mechanism is NOT module-global counters.");
  console.log("");
  console.log("The minimal causal state boundary must include at least one of:");
  console.log("  - Clock RNG advancement (reconstruction doesn't advance RNG)");
  console.log("  - Agent/referral state re-initialization");
  console.log("  - Some other non-counter mutable state");
  console.log("");
  console.log("RECOMMENDATION: The production repair should make doReconstruct()");
  console.log("call createWorld-equivalent initialization for all non-snapshot state,");
  console.log("rather than maintaining two separate initialization lists.");
} else if (resultsMatch(caseA, caseD) && !resultsMatch(caseA, caseB) && !resultsMatch(caseA, caseC)) {
  console.log("Counter reset PARTIALLY reduces contamination.");
  console.log("Additional state beyond counters is needed for full isolation.");
} else if (!resultsMatch(caseA, caseD)) {
  console.log("UNEXPECTED: Full reinit does not match fresh branch.");
  console.log("Investigation required.");
} else {
  console.log("No contamination detected at this seed/horizon.");
}

// ── SAVE ──────────────────────────────────────────────────────────
mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e/differential-test.json",
  JSON.stringify({
    seed, horizon, timestamp: new Date().toISOString(),
    caseA, caseB, caseC, caseD,
    counterResetEffect: resultsMatch(caseB, caseC),
    reinitFixes: resultsMatch(caseA, caseD),
    contaminationDetected: !resultsMatch(caseA, caseB),
  }, null, 2));
console.log("\nResults written to experiment-results/exp-001e/differential-test.json");
