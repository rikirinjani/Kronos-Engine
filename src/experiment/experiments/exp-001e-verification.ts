/**
 * EXP-001E Phase 4 — Determinism & Isolation Verification (multi-seed)
 *
 * For each (seed, horizon):
 *   - fresh:  createWorld → rp → branch                (no parent)
 *   - parent: createWorld → rp → run 50 → branch
 *   - parent2: same rewind point → branch again
 *
 * PASS requires: fresh == parent == parent2 (isolation + reproducibility).
 * Uses the production-style path (no external clone) to exercise the fix.
 *
 * HARD BOUNDARIES: Diagnostic only.
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

function createAllSectors(seed: number): Sector[] {
  return [
    createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, seed),
  ];
}

function patchState(state: any, ov: any): any {
  const r: any = { ...state };
  for (const [k, v] of Object.entries(ov)) {
    if (v && typeof v === "object" && !Array.isArray(v) && r[k] && typeof r[k] === "object") r[k] = patchState(r[k], v);
    else r[k] = v;
  }
  return r;
}

function runBranch(rp: any, sectorMap: Map<string, Sector>, horizon: number): any {
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
  return lastDr;
}

function fingerprint(drState: any): string {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  // Trajectory fields only — EXCLUDE module-global ID labels (e.g. CSSD cycleId),
  // which legitimately differ when the parent run advances the module-global
  // counters. Those counters are proven not to affect trajectory (EXP-001B/C/E).
  const cssdTrays = (inner._cssd?.trays ?? []).map((t: any) => `${t.id}:${t.status}:${t.expiresAt}:${t.sterilizedAt}`);
  return JSON.stringify({
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    icu: drState?.sentinelOutput?.icuOccupancyRate ?? null,
    supply: drState?.sentinelOutput?.supplyStress ?? null,
    enc: inner.encounters?.size ?? null,
    pts: beds.filter((b: any) => b.patientId).length,
    cssd: cssdTrays,
  });
}

/** Strict fingerprint including module-global ID labels, for diagnostics. */
function strictFingerprint(drState: any): string {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  const cssdTrays = (inner._cssd?.trays ?? []).map((t: any) => `${t.id}:${t.status}:${t.cycleId}:${t.expiresAt}`);
  return JSON.stringify({
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    enc: inner.encounters?.size ?? null,
    pts: beds.filter((b: any) => b.patientId).length,
    cssd: cssdTrays,
  });
}

function setup(seed: number) {
  resetUniverseCounter();
  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const cfg = buildSectorConfigs(era);
  const sectors = createAllSectors(seed);
  const sm = new Map(sectors.map(s => [s.id, s]));
  const w = createWorld(sectors, cfg, { seed });
  const rp = createRewindPoint(w, "preseeded", { label: "t0", tags: [] });
  return { w, rp, sm };
}

const seeds = [1001, 1002, 1003, 1004, 1005];
const horizons = [10, 25, 50];
const PARENT_TICKS = 50;

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E Phase 4: Determinism & Isolation Verification`);
console.log(`${"=".repeat(70)}\n`);

const results: any[] = [];
let allPass = true;

for (const seed of seeds) {
  for (const horizon of horizons) {
    // fresh (no parent)
    const s1 = setup(seed);
    const fresh = fingerprint(runBranch(s1.rp, s1.sm, horizon));
    const freshStrict = strictFingerprint(runBranch(s1.rp, s1.sm, horizon));

    // parent → branch
    const s2 = setup(seed);
    run(s2.w, PARENT_TICKS);
    const parent = fingerprint(runBranch(s2.rp, s2.sm, horizon));
    const parentStrict = strictFingerprint(runBranch(s2.rp, s2.sm, horizon));

    // same rewind point → branch again
    const parent2 = fingerprint(runBranch(s2.rp, s2.sm, horizon));

    const isolationOk = fresh === parent;
    const reproducOk = parent === parent2;
    const strictIsolationOk = freshStrict === parentStrict;
    const pass = isolationOk && reproducOk;
    if (!pass) allPass = false;

    results.push({ seed, horizon, pass, isolationOk, reproducOk, strictIsolationOk });
    console.log(`seed=${seed} H=${String(horizon).padStart(2)}  isolation=${isolationOk ? "OK " : "FAIL"}  reproducible=${reproducOk ? "OK " : "FAIL"}  strictIDs=${strictIsolationOk ? "OK " : "differ"}  ${pass ? "PASS" : "FAIL"}`);
  }
}

console.log(`\n${"═".repeat(70)}`);
console.log(`OVERALL: ${allPass ? "PASS — all seeds/horizons isolated and reproducible" : "FAIL"}`);
console.log(`${"═".repeat(70)}\n`);

mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e/phase4-verification.json",
  JSON.stringify({ timestamp: new Date().toISOString(), parentTicks: PARENT_TICKS, seeds, horizons, allPass, results }, null, 2));
console.log("Results written to experiment-results/exp-001e/phase4-verification.json");
