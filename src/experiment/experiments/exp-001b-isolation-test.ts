/**
 * EXP-001B Part B — Parent/Branch Isolation Validation
 *
 * Four-case experiment to determine whether DR module-level counters are
 * the causal mechanism for parent→branch contamination.
 *
 * Case 1: Fresh world, branch only (independent baseline)
 * Case 2: Parent then branch (no counter reset)
 * Case 3: Parent then explicit counter reset then branch
 * Case 4: Parent then createWorld-equivalent re-initialization
 *
 * Uses seed 1003, H=50 (matching contaminated EXP-001 conditions).
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
// Local copy of extractNumericPaths (not exported from diff-engine.ts)
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

// DR module-level counter resets
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

function resetAllDrCounters() {
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

interface CaseResult {
  finalOcc: number | null;
  finalIcu: number | null;
  finalMort: number | null;
  finalSupply: number | null;
  finalStaff: number | null;
  healthEvents: number;
  healthDetails: Record<string, number>;
  encounters: number | null;
  patients: number | null;
  sentinelOutputNull: boolean;
  drCounterSnapshot: Record<string, number>;
}

function extractDrCounters(): Record<string, number> {
  // Read module-global counters by importing the modules
  // Since they're module-level, we can't directly read them.
  // Instead, we observe their effect: the IDs generated.
  // For diagnostic purposes, we'll capture observable state.
  return {}; // Will be populated by observing ID patterns in the output
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

// ─── Case 1: Independent baseline (fresh world, branch only) ─────
function case1IndependentBaseline(seed: number, horizon: number): CaseResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, true);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  // Branch directly (no parent run)
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
  const inner: any = lastDr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    finalOcc: lastDr?.sentinelOutput?.occupancyRate ?? null,
    finalIcu: lastDr?.sentinelOutput?.icuOccupancyRate ?? null,
    finalMort: lastDr?.sentinelOutput?.mortalityPressure ?? null,
    finalSupply: lastDr?.sentinelOutput?.supplyStress ?? null,
    finalStaff: lastDr?.sentinelOutput?.staffStress ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    healthDetails: getHealthCounts(lastObs),
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    sentinelOutputNull: lastDr?.sentinelOutput === null,
    drCounterSnapshot: extractDrCounters(),
  };
}

// ─── Case 2: Parent then branch (no counter reset) ───────────────
function case2ParentThenBranch(seed: number, horizon: number): CaseResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, true);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  // Run parent
  run(world, horizon);

  // Branch (no counter reset)
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
  const inner: any = lastDr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    finalOcc: lastDr?.sentinelOutput?.occupancyRate ?? null,
    finalIcu: lastDr?.sentinelOutput?.icuOccupancyRate ?? null,
    finalMort: lastDr?.sentinelOutput?.mortalityPressure ?? null,
    finalSupply: lastDr?.sentinelOutput?.supplyStress ?? null,
    finalStaff: lastDr?.sentinelOutput?.staffStress ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    healthDetails: getHealthCounts(lastObs),
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    sentinelOutputNull: lastDr?.sentinelOutput === null,
    drCounterSnapshot: extractDrCounters(),
  };
}

// ─── Case 3: Parent then explicit counter reset then branch ──────
function case3ParentCounterReset(seed: number, horizon: number): CaseResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, true);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  // Run parent
  run(world, horizon);

  // Reset DR counters
  resetAllDrCounters();

  // Branch
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
  const inner: any = lastDr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    finalOcc: lastDr?.sentinelOutput?.occupancyRate ?? null,
    finalIcu: lastDr?.sentinelOutput?.icuOccupancyRate ?? null,
    finalMort: lastDr?.sentinelOutput?.mortalityPressure ?? null,
    finalSupply: lastDr?.sentinelOutput?.supplyStress ?? null,
    finalStaff: lastDr?.sentinelOutput?.staffStress ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    healthDetails: getHealthCounts(lastObs),
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    sentinelOutputNull: lastDr?.sentinelOutput === null,
    drCounterSnapshot: extractDrCounters(),
  };
}

// ─── Case 4: Parent then full createWorld-equivalent re-init ─────
function case4ParentFullReinit(seed: number, horizon: number): CaseResult {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed, true);
  const sectorMap = new Map(sectors.map(s => [s.id, s]));
  const world = createWorld(sectors, buildSectorConfigs(era), { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "t0", tags: [] });

  // Run parent
  run(world, horizon);

  // Full re-init: reset all counters AND recreate the world from scratch
  resetAllDrCounters();
  resetUniverseCounter();

  // Create a completely fresh world (equivalent to what createWorld does)
  const freshSectors = createAllSectors(seed, true);
  const freshSectorMap = new Map(freshSectors.map(s => [s.id, s]));
  const freshWorld = createWorld(freshSectors, buildSectorConfigs(era), { seed });
  const freshRp = createRewindPoint(freshWorld, "preseeded", { label: "t0", tags: [] });

  // Branch from the fresh rewind point
  const rewindSnap: any = {
    tick: freshRp.tick, rngState: freshRp.rngState,
    sectors: Object.entries(freshRp.sectorStates).map(([id, st]) => ({ id, state: st })),
    universeId: freshRp.universeId, sectorReconstructors: freshRp.sectorReconstructors,
  };
  let branch = restoreSnapshot(rewindSnap, freshSectorMap);
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
  const inner: any = lastDr?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    finalOcc: lastDr?.sentinelOutput?.occupancyRate ?? null,
    finalIcu: lastDr?.sentinelOutput?.icuOccupancyRate ?? null,
    finalMort: lastDr?.sentinelOutput?.mortalityPressure ?? null,
    finalSupply: lastDr?.sentinelOutput?.supplyStress ?? null,
    finalStaff: lastDr?.sentinelOutput?.staffStress ?? null,
    healthEvents: Object.values(getHealthCounts(lastObs)).reduce((a, b) => a + b, 0),
    healthDetails: getHealthCounts(lastObs),
    encounters: inner.encounters?.size ?? null,
    patients: beds.filter((b: any) => b.patientId).length,
    sentinelOutputNull: lastDr?.sentinelOutput === null,
    drCounterSnapshot: extractDrCounters(),
  };
}

// ─── MAIN ────────────────────────────────────────────────────────
const seed = 1003;
const horizon = 50;

console.log(`\n=== EXP-001B Part B: Parent/Branch Isolation (seed=${seed}, H=${horizon}) ===\n`);

const c1 = case1IndependentBaseline(seed, horizon);
console.log("[Case 1] Independent baseline (no parent):");
console.log(`  occ=${c1.finalOcc?.toFixed(3)} icu=${c1.finalIcu?.toFixed(3)} mort=${c1.finalMort} supply=${c1.finalSupply?.toFixed(3)} staff=${c1.finalStaff?.toFixed(3)}`);
console.log(`  healthEvents=${c1.healthEvents} encounters=${c1.encounters} patients=${c1.patients}`);
console.log(`  healthDetails=${JSON.stringify(c1.healthDetails)}`);

const c2 = case2ParentThenBranch(seed, horizon);
console.log("[Case 2] Parent then branch (no reset):");
console.log(`  occ=${c2.finalOcc?.toFixed(3)} icu=${c2.finalIcu?.toFixed(3)} mort=${c2.finalMort} supply=${c2.finalSupply?.toFixed(3)} staff=${c2.finalStaff?.toFixed(3)}`);
console.log(`  healthEvents=${c2.healthEvents} encounters=${c2.encounters} patients=${c2.patients}`);
console.log(`  healthDetails=${JSON.stringify(c2.healthDetails)}`);

const c3 = case3ParentCounterReset(seed, horizon);
console.log("[Case 3] Parent then counter-reset then branch:");
console.log(`  occ=${c3.finalOcc?.toFixed(3)} icu=${c3.finalIcu?.toFixed(3)} mort=${c3.finalMort} supply=${c3.finalSupply?.toFixed(3)} staff=${c3.finalStaff?.toFixed(3)}`);
console.log(`  healthEvents=${c3.healthEvents} encounters=${c3.encounters} patients=${c3.patients}`);
console.log(`  healthDetails=${JSON.stringify(c3.healthDetails)}`);

const c4 = case4ParentFullReinit(seed, horizon);
console.log("[Case 4] Parent then full createWorld-equivalent re-init:");
console.log(`  occ=${c4.finalOcc?.toFixed(3)} icu=${c4.finalIcu?.toFixed(3)} mort=${c4.finalMort} supply=${c4.finalSupply?.toFixed(3)} staff=${c4.finalStaff?.toFixed(3)}`);
console.log(`  healthEvents=${c4.healthEvents} encounters=${c4.encounters} patients=${c4.patients}`);
console.log(`  healthDetails=${JSON.stringify(c4.healthDetails)}`);

// ─── COMPARISON ──────────────────────────────────────────────────
console.log("\n=== COMPARISON TABLE ===");
console.log("Metric              | Case1 (baseline) | Case2 (no reset) | Case3 (reset)    | Case4 (full-reinit)");
console.log("--------------------|------------------|------------------|------------------|-------------------");
console.log(`occupancyRate       | ${(c1.finalOcc ?? "null").toString().padEnd(17)}| ${(c2.finalOcc ?? "null").toString().padEnd(17)}| ${(c3.finalOcc ?? "null").toString().padEnd(17)}| ${(c4.finalOcc ?? "null").toString().padEnd(17)}`);
console.log(`icuOccupancyRate    | ${(c1.finalIcu ?? "null").toString().padEnd(17)}| ${(c2.finalIcu ?? "null").toString().padEnd(17)}| ${(c3.finalIcu ?? "null").toString().padEnd(17)}| ${(c4.finalIcu ?? "null").toString().padEnd(17)}`);
console.log(`mortalityPressure   | ${(c1.finalMort ?? "null").toString().padEnd(17)}| ${(c2.finalMort ?? "null").toString().padEnd(17)}| ${(c3.finalMort ?? "null").toString().padEnd(17)}| ${(c4.finalMort ?? "null").toString().padEnd(17)}`);
console.log(`supplyStress        | ${(c1.finalSupply ?? "null").toString().padEnd(17)}| ${(c2.finalSupply ?? "null").toString().padEnd(17)}| ${(c3.finalSupply ?? "null").toString().padEnd(17)}| ${(c4.finalSupply ?? "null").toString().padEnd(17)}`);
console.log(`staffStress         | ${(c1.finalStaff ?? "null").toString().padEnd(17)}| ${(c2.finalStaff ?? "null").toString().padEnd(17)}| ${(c3.finalStaff ?? "null").toString().padEnd(17)}| ${(c4.finalStaff ?? "null").toString().padEnd(17)}`);
console.log(`healthEvents        | ${String(c1.healthEvents).padEnd(17)}| ${String(c2.healthEvents).padEnd(17)}| ${String(c3.healthEvents).padEnd(17)}| ${String(c4.healthEvents).padEnd(17)}`);
console.log(`encounters          | ${(c1.encounters ?? "null").toString().padEnd(17)}| ${(c2.encounters ?? "null").toString().padEnd(17)}| ${(c3.encounters ?? "null").toString().padEnd(17)}| ${(c4.encounters ?? "null").toString().padEnd(17)}`);
console.log(`patients            | ${(c1.patients ?? "null").toString().padEnd(17)}| ${(c2.patients ?? "null").toString().padEnd(17)}| ${(c3.patients ?? "null").toString().padEnd(17)}| ${(c4.patients ?? "null").toString().padEnd(17)}`);

// ─── INTERPRETATION ──────────────────────────────────────────────
console.log("\n=== INTERPRETATION ===");

function approxEqual(a: number | null, b: number | null, tol: number): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < tol;
}

const c2DiffersFromC1 = !approxEqual(c1.finalOcc, c2.finalOcc, 0.01) || c1.healthEvents !== c2.healthEvents;
const c3MatchesC1 = approxEqual(c1.finalOcc, c3.finalOcc, 0.01) && c1.healthEvents === c3.healthEvents;
const c4MatchesC1 = approxEqual(c1.finalOcc, c4.finalOcc, 0.01) && c1.healthEvents === c4.healthEvents;

console.log(`Case 2 differs from Case 1 (contamination): ${c2DiffersFromC1}`);
console.log(`Case 3 matches Case 1 (counter reset fixes): ${c3MatchesC1}`);
console.log(`Case 4 matches Case 1 (full reinit fixes): ${c4MatchesC1}`);

if (c2DiffersFromC1 && c3MatchesC1) {
  console.log("\nVERDICT: DR module-level counters ARE the causal mechanism.");
  console.log("Counter reset eliminates parent→branch divergence.");
} else if (c2DiffersFromC1 && !c3MatchesC1 && c4MatchesC1) {
  console.log("\nVERDICT: Counters contribute but are NOT the complete explanation.");
  console.log("Full createWorld-equivalent re-init is required to eliminate divergence.");
} else if (!c2DiffersFromC1) {
  console.log("\nVERDICT: No parent→branch contamination detected at this seed/horizon.");
  console.log("The EXP-001A observation may be seed-specific or horizon-specific.");
} else {
  console.log("\nVERDICT: Counter resets do NOT eliminate divergence.");
  console.log("Parent→branch contamination mechanism remains unresolved.");
}

// ─── SAVE RESULTS ────────────────────────────────────────────────
const results = {
  seed, horizon,
  cases: { case1: c1, case2: c2, case3: c3, case4: c4 },
  interpretation: { c2DiffersFromC1, c3MatchesC1, c4MatchesC1 },
};

mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001b", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001b/isolation-test.json",
  JSON.stringify(results, null, 2));
console.log("\nResults written to experiment-results/exp-001b/isolation-test.json");
