/**
 * EXP-001E Phase 3 — DECISIVE: Reference-sharing in rewind point hospitalState
 *
 * Hypothesis: makeSnapshot() returns `hospitalState: w.state` BY REFERENCE
 * (deers-rock-adapter.ts:212). createRewindPoint stores the __snapshot() result
 * directly (rewind-point.ts:78). So the "t0" rewind point shares the live DR
 * state object. The parent run (after the rewind point is captured) mutates it,
 * contaminating the "t0" snapshot → branch diverges from a fresh branch.
 *
 * Tests:
 *   1. Fingerprint rp.sectorStates[DR].hospitalState before/after parent run.
 *   2. Case B with deep-cloned rewind snapshot vs Case B uncloned vs Case A fresh.
 *   3. Determinism: run cloned Case B twice, must be identical.
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
import { createWorld, tick as kronosTick, run, restoreSnapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint } from "../../timeline/index.js";
import { deepClone } from "../../engine/clone.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };
const DR_SECTOR_ID = "deers-rock-makassar-001";
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

/**
 * Run a branch. If cloneStates=true, deep-clone each rewind sector state before
 * reconstruction (isolating the rewind point from parent-run mutation).
 */
function runBranch(rp: any, sectorMap: Map<string, Sector>, horizon: number, cloneStates: boolean): any {
  const rewindSnap: any = {
    tick: rp.tick, rngState: rp.rngState,
    sectors: Object.entries(rp.sectorStates).map(([id, st]) => ({
      id, state: cloneStates ? deepClone(st) : st,
    })),
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
  return lastDr;
}

function extractResult(drState: any): any {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    icu: drState?.sentinelOutput?.icuOccupancyRate ?? null,
    supply: drState?.sentinelOutput?.supplyStress ?? null,
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
  };
}

/** Deep fingerprint of a HospitalState object (detects in-place mutation). */
function hospitalFingerprint(hs: any): Record<string, number> {
  if (!hs) return {};
  const beds = hs.beds instanceof Map ? [...hs.beds.values()] : [];
  return {
    bedsSize: hs.beds?.size ?? -1,
    bedsOccupied: beds.filter((b: any) => b.patientId).length,
    encounters: hs.encounters?.size ?? -1,
    labOrders: hs.labOrders?.size ?? -1,
    medOrders: hs.medicationOrders?.size ?? -1,
    radOrders: hs.radiologyOrders?.size ?? -1,
    surgOrders: hs.surgeryOrders?.size ?? -1,
    charges: hs.charges?.size ?? -1,
    edTriages: hs.edTriages?.size ?? -1,
    charts: hs.medicalCharts?.size ?? -1,
    agentPool: hs._agentState?.pool?.agents?.size ?? -1,
    referralLetters: hs._referralState?.letters?.size ?? -1,
    morgue: Array.isArray(hs.morgue) ? hs.morgue.length : -1,
  };
}

function fpEqual(a: Record<string, number>, b: Record<string, number>): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function resultsMatch(a: any, b: any): boolean {
  return a.occ !== null && b.occ !== null && Math.abs(a.occ - b.occ) < 0.0001
    && a.encounters === b.encounters && a.patients === b.patients;
}

const seed = 1003;
const horizon = 50;

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E Phase 3 DECISIVE: rewind-point hospitalState reference-sharing`);
console.log(`seed=${seed}  horizon=${horizon}`);
console.log(`${"=".repeat(70)}\n`);

const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");

// ═══════════════════════════════════════════════════════════════════
// TEST 1: Does the parent run mutate rp.sectorStates[DR].hospitalState?
// ═══════════════════════════════════════════════════════════════════
console.log(`${"─".repeat(70)}`);
console.log("TEST 1: Parent-run mutation of the t0 rewind state");
console.log(`${"─".repeat(70)}\n`);

resetUniverseCounter();
const sectors1 = createAllSectors(seed, false);
const sectorMap1 = new Map(sectors1.map(s => [s.id, s]));
const world1 = createWorld(sectors1, buildSectorConfigs(era), { seed });
const rp1 = createRewindPoint(world1, "preseeded", { label: "t0", tags: [] });

const hsRef = (rp1.sectorStates[DR_SECTOR_ID] as any).hospitalState;
const fpBefore = hospitalFingerprint(hsRef);
console.log("Fingerprint BEFORE parent run:");
console.log(`  ${JSON.stringify(fpBefore)}`);

run(world1, horizon);

const fpAfter = hospitalFingerprint(hsRef);
console.log("\nFingerprint AFTER parent run (same object reference):");
console.log(`  ${JSON.stringify(fpAfter)}`);

const mutated = !fpEqual(fpBefore, fpAfter);
console.log(`\n>>> Rewind-point hospitalState MUTATED by parent run: ${mutated}`);
if (mutated) {
  const diffs: string[] = [];
  for (const k of Object.keys(fpBefore)) {
    if (fpBefore[k] !== fpAfter[k]) diffs.push(`${k}: ${fpBefore[k]} → ${fpAfter[k]}`);
  }
  console.log(`    Diffs: ${diffs.join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════════
// TEST 2: Does deep-cloning the rewind snapshot fix the divergence?
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(70)}`);
console.log("TEST 2: Deep-clone rewind snapshot → does Case B match Case A?");
console.log(`${"─".repeat(70)}\n`);

// Case A: fresh (no parent)
resetUniverseCounter();
const sectorsA = createAllSectors(seed, false);
const sectorMapA = new Map(sectorsA.map(s => [s.id, s]));
const worldA = createWorld(sectorsA, buildSectorConfigs(era), { seed });
const rpA = createRewindPoint(worldA, "preseeded", { label: "t0", tags: [] });
const caseA = extractResult(runBranch(rpA, sectorMapA, horizon, false));
console.log(`Case A (fresh, no parent):       occ=${caseA.occ?.toFixed(4)} enc=${caseA.encounters} pts=${caseA.patients}`);

// Case B: parent → reconstruct, NO clone (current production behavior)
resetUniverseCounter();
const sectorsB = createAllSectors(seed, false);
const sectorMapB = new Map(sectorsB.map(s => [s.id, s]));
const worldB = createWorld(sectorsB, buildSectorConfigs(era), { seed });
const rpB = createRewindPoint(worldB, "preseeded", { label: "t0", tags: [] });
run(worldB, horizon);
const caseB = extractResult(runBranch(rpB, sectorMapB, horizon, false));
console.log(`Case B (parent→reconstruct):     occ=${caseB.occ?.toFixed(4)} enc=${caseB.encounters} pts=${caseB.patients}`);

// Case B2: parent → reconstruct WITH deep clone
resetUniverseCounter();
const sectorsB2 = createAllSectors(seed, false);
const sectorMapB2 = new Map(sectorsB2.map(s => [s.id, s]));
const worldB2 = createWorld(sectorsB2, buildSectorConfigs(era), { seed });
const rpB2 = createRewindPoint(worldB2, "preseeded", { label: "t0", tags: [] });
run(worldB2, horizon);
const caseB2 = extractResult(runBranch(rpB2, sectorMapB2, horizon, true));
console.log(`Case B2 (parent→clone→reconstruct): occ=${caseB2.occ?.toFixed(4)} enc=${caseB2.encounters} pts=${caseB2.patients}`);

console.log(`\n  A == B  (uncloned): ${resultsMatch(caseA, caseB)}`);
console.log(`  A == B2 (cloned):   ${resultsMatch(caseA, caseB2)}`);

// ═══════════════════════════════════════════════════════════════════
// TEST 3: Determinism — cloned Case B run twice
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"─".repeat(70)}`);
console.log("TEST 3: Determinism of cloned reconstruction");
console.log(`${"─".repeat(70)}\n`);

resetUniverseCounter();
const sectorsB3 = createAllSectors(seed, false);
const sectorMapB3 = new Map(sectorsB3.map(s => [s.id, s]));
const worldB3 = createWorld(sectorsB3, buildSectorConfigs(era), { seed });
const rpB3 = createRewindPoint(worldB3, "preseeded", { label: "t0", tags: [] });
run(worldB3, horizon);
const caseB3a = extractResult(runBranch(rpB3, sectorMapB3, horizon, true));
const caseB3b = extractResult(runBranch(rpB3, sectorMapB3, horizon, true));
console.log(`  Run 1: occ=${caseB3a.occ?.toFixed(6)} enc=${caseB3a.encounters} pts=${caseB3a.patients}`);
console.log(`  Run 2: occ=${caseB3b.occ?.toFixed(6)} enc=${caseB3b.encounters} pts=${caseB3b.patients}`);
console.log(`  Deterministic: ${resultsMatch(caseB3a, caseB3b)}`);

// ═══════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"═".repeat(70)}`);
console.log("VERDICT");
console.log(`${"═".repeat(70)}\n`);

const aEqB = resultsMatch(caseA, caseB);
const aEqB2 = resultsMatch(caseA, caseB2);
const deterministic = resultsMatch(caseB3a, caseB3b);

let mechanism = "UNKNOWN";
if (mutated && !aEqB && aEqB2 && deterministic) {
  mechanism = "CONFIRMED: rewind-point hospitalState reference-sharing. Parent run mutates the shared t0 state; deep-cloning the rewind snapshot restores isolation and is deterministic.";
} else if (mutated && aEqB2) {
  mechanism = "PARTIAL: reference-sharing confirmed as a factor, but verify determinism.";
} else if (!mutated) {
  mechanism = "REJECTED: parent run does NOT mutate the rewind-point hospitalState. Reference-sharing is NOT the mechanism.";
}

console.log(`Mechanism: ${mechanism}\n`);
console.log(`  t0 state mutated by parent: ${mutated}`);
console.log(`  A == B  (uncloned): ${aEqB}`);
console.log(`  A == B2 (cloned):   ${aEqB2}`);
console.log(`  deterministic:      ${deterministic}`);

// ── SAVE ──────────────────────────────────────────────────────────
mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e/phase3-decisive.json",
  JSON.stringify({
    seed, horizon, timestamp: new Date().toISOString(),
    test1_parentMutatesRewindState: mutated,
    fingerprintBefore: fpBefore, fingerprintAfter: fpAfter,
    caseA, caseB, caseB2, caseB3a, caseB3b,
    aEqualsB_uncloned: aEqB,
    aEqualsB_cloned: aEqB2,
    deterministic,
    mechanism,
  }, null, 2));
console.log("\nResults written to experiment-results/exp-001e/phase3-decisive.json");
