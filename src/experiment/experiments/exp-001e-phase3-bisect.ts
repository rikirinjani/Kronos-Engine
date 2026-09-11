/**
 * EXP-001E Phase 3 — BISECTION
 *
 * Find the minimal parent-run length that causes branch divergence, and test
 * whether contamination is cumulative (branch run contaminates next fresh run).
 *
 * HARD BOUNDARIES: Diagnostic only. No production changes.
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

function extractResult(drState: any): any {
  const inner: any = drState?.world?.state ?? {};
  const beds = inner.beds instanceof Map ? [...inner.beds.values()] : [];
  return {
    occ: drState?.sentinelOutput?.occupancyRate ?? null,
    enc: inner.encounters?.size ?? null,
    pts: beds.filter((b: any) => b.patientId).length,
  };
}

function resultsMatch(a: any, b: any): boolean {
  return a.occ !== null && b.occ !== null && Math.abs(a.occ - b.occ) < 1e-9
    && a.enc === b.enc && a.pts === b.pts;
}

function fmt(r: any): string {
  return `occ=${r.occ?.toFixed(6)} enc=${r.enc} pts=${r.pts}`;
}

const seed = 1003;
const horizon = 50;
const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
const cfg = buildSectorConfigs(era);

/** Run a case with a given parent-run length. Returns branch result. */
function runCase(parentTicks: number): any {
  resetUniverseCounter();
  const sectors = createAllSectors(seed);
  const sm = new Map(sectors.map(s => [s.id, s]));
  const w = createWorld(sectors, cfg, { seed });
  const rp = createRewindPoint(w, "preseeded", { label: "t0", tags: [] });
  const rngBefore = JSON.stringify(rp.rngState);
  if (parentTicks > 0) run(w, parentTicks);
  const rngAfter = JSON.stringify(rp.rngState);
  const rngContaminated = rngBefore !== rngAfter;
  const dr = runBranch(rp, sm, horizon);
  return { result: extractResult(dr), rngContaminated, rngBefore, rngAfter };
}

console.log(`\n${"=".repeat(70)}`);
console.log(`EXP-001E Phase 3 BISECTION`);
console.log(`seed=${seed}  horizon=${horizon}`);
console.log(`${"=".repeat(70)}\n`);

// ── Bisection: minimal parent ticks ──────────────────────────────
const parentTicksList = [0, 1, 2, 3, 5, 10, 50];
const results: Record<string, any> = {};

for (const pt of parentTicksList) {
  const r = runCase(pt);
  results[`pt${pt}`] = r;
  console.log(`parentTicks=${String(pt).padStart(2)}  ${fmt(r.result)}  rngContaminated=${r.rngContaminated}`);
}

console.log(`\n${"─".repeat(70)}`);
console.log("Comparison vs parentTicks=0 (fresh):");
console.log(`${"─".repeat(70)}`);
const base = results["pt0"].result;
for (const pt of parentTicksList) {
  const r = results[`pt${pt}`].result;
  const match = resultsMatch(base, r);
  console.log(`  parentTicks=${String(pt).padStart(2)}  ${match ? "MATCH   " : "DIVERGES"}  ${fmt(r)}`);
}

// ── Cumulative contamination test ────────────────────────────────
console.log(`\n${"─".repeat(70)}`);
console.log("Cumulative test: fresh → fresh → fresh (no parent at all)");
console.log(`${"─".repeat(70)}`);
const f1 = runCase(0).result;
const f2 = runCase(0).result;
const f3 = runCase(0).result;
console.log(`  fresh #1: ${fmt(f1)}`);
console.log(`  fresh #2: ${fmt(f2)}`);
console.log(`  fresh #3: ${fmt(f3)}`);
console.log(`  #1==#2: ${resultsMatch(f1, f2)}   #2==#3: ${resultsMatch(f2, f3)}`);

// ── Determinism within one parent ────────────────────────────────
console.log(`\n${"─".repeat(70)}`);
console.log("Determinism: parent=50, branch run twice");
console.log(`${"─".repeat(70)}`);
resetUniverseCounter();
const sectorsD = createAllSectors(seed);
const smD = new Map(sectorsD.map(s => [s.id, s]));
const wD = createWorld(sectorsD, cfg, { seed });
const rpD = createRewindPoint(wD, "preseeded", { label: "t0", tags: [] });
run(wD, 50);
const d1 = extractResult(runBranch(rpD, smD, horizon));
const d2 = extractResult(runBranch(rpD, smD, horizon));
console.log(`  run #1: ${fmt(d1)}`);
console.log(`  run #2: ${fmt(d2)}`);
console.log(`  deterministic: ${resultsMatch(d1, d2)}`);

// ═══════════════════════════════════════════════════════════════════
// VERDICT
// ═══════════════════════════════════════════════════════════════════
console.log(`\n${"=".repeat(70)}`);
console.log("VERDICT");
console.log(`${"=".repeat(70)}\n`);

let minDiverging = -1;
for (const pt of parentTicksList) {
  if (pt === 0) continue;
  if (!resultsMatch(base, results[`pt${pt}`].result)) { minDiverging = pt; break; }
}
console.log(`Minimal diverging parent length: ${minDiverging === -1 ? "none (all match)" : minDiverging}`);
const anyRngContam = parentTicksList.some(pt => results[`pt${pt}`].rngContaminated);
console.log(`Rewind rngState contaminated by parent run: ${anyRngContam}`);
console.log(`Cumulative contamination (fresh runs differ): ${!resultsMatch(f1, f3)}`);

mkdirSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e", { recursive: true });
writeFileSync("C:/Users/think/Project_v2/Kronos Engine/experiment-results/exp-001e/phase3-bisect.json",
  JSON.stringify({
    seed, horizon, timestamp: new Date().toISOString(),
    results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, { result: v.result, rngContaminated: v.rngContaminated }])),
    freshRuns: [f1, f2, f3],
    deterministicWithinParent: resultsMatch(d1, d2),
    minimalDivergingParentTicks: minDiverging,
    rngContaminated: anyRngContam,
    cumulativeContamination: !resultsMatch(f1, f3),
  }, null, 2));
console.log("\nResults written to experiment-results/exp-001e/phase3-bisect.json");
