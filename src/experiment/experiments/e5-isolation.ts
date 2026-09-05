/**
 * E5 — Sentinel Isolation Under Coupling
 *
 * Purpose: prove that a macro→micro intervention applied to sentinel A
 * changes A WITHOUT contaminating sentinels B and C.
 *
 * Design:
 *   - Three DR sentinels (A, B, C) in one KE world, each with an
 *     independent derived seed (getHospitalSeed).
 *   - Baseline run: all three receive identical world conditions.
 *   - Intervention run: only sentinel A receives the causal macro
 *     intervention (supply_chain_pressure + active_disaster events).
 *   - Compare B and C across runs via full state hash — they must be
 *     byte-identical to their untouched baselines.
 *   - A must differ from its baseline (intervention consumed).
 *   - RNG isolation: KE world RNG state must be identical across runs
 *     at every tick (the intervention is sector-local, not world-level).
 *
 * Implementation note: the intervention is injected by scheduling DR
 * events directly into sentinel A's DR event queue at tick 0 — the same
 * mechanism the adapter uses for admission_surge/staff_shortage. This
 * tests the coupling pathway without touching KE sector code.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter, getHospitalSeed } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import { hashState } from "../../timeline/hash.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import type { DeersRockSectorState } from "../../sectors/deers-rock-adapter.js";

const SENTINELS = [
  { id: "sentinel-A", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 },
  { id: "sentinel-B", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 },
  { id: "sentinel-C", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 },
];

const SEED = 42;
const HORIZON = 20;

interface EraState {
  year: number;
  label: string;
  nations: unknown[];
  wars: unknown[];
  alliances: unknown[];
  globalState: unknown;
}

function loadEraState(): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, "../../../docs/history/era-contemporary.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-CONTEMP-002"]!;
}

function createAllSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    ...SENTINELS.map((config) => deersRockAdapter({ ...config }, worldSeed)),
  ];
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  const nations = era.nations as Array<Record<string, unknown>>;
  for (const n of nations) {
    economyNations[n.id as string] = {
      gdp: n.gdp,
      gdpGrowthRate: 2.5,
      inflationRate: 3.0,
      tradeVolume: 50,
      unemploymentRate: 5.0,
    };
    techNations[n.id as string] = {
      technologyLevel: n.technologyLevel,
      rdSpending: 0.01 + ((n.technologyLevel as number) / 100) * 0.025,
    };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

function drSectorIds(snap: WorldSnapshot): string[] {
  return snap.sectors.filter((s) => s.id.startsWith("deers-rock-")).map((s) => s.id).sort();
}

function sectorHash(snap: WorldSnapshot, sectorId: string): string {
  const rec = snap.sectors.find((s) => s.id === sectorId);
  return rec ? hashState(rec.state) : "MISSING";
}

/** Extract the DR world from a sentinel sector state (for direct event injection). */
function getDrWorld(snap: WorldSnapshot, sectorId: string) {
  const rec = snap.sectors.find((s) => s.id === sectorId);
  return (rec?.state as DeersRockSectorState).world;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../experiment-results/e5-isolation");
mkdirSync(outDir, { recursive: true });

const era = loadEraState();

// --- Baseline run: A, B, C all receive the same world conditions ---
resetUniverseCounter();
const baseSectors = createAllSectors(SEED);
const baseConfigs = buildSectorConfigs(era);
const baseWorld = createWorld(baseSectors, baseConfigs, { seed: SEED });
const baseAfter = run(baseWorld, HORIZON);
const baseSnap = snapshot(baseAfter);

// --- Intervention run: only sentinel A receives the macro intervention ---
resetUniverseCounter();
const intvSectors = createAllSectors(SEED);
const intvConfigs = buildSectorConfigs(era);
const intvWorld = createWorld(intvSectors, intvConfigs, { seed: SEED });

// Inject the intervention into sentinel A's DR event queue BEFORE stepping.
// This is the same pathway the adapter uses (world.queue.schedule).
const aState = intvWorld.sectors.get("deers-rock-sentinel-A")!.state as DeersRockSectorState;
aState.world.queue.schedule("supply_chain_pressure", 0, { pressure: 0.8 });
aState.world.queue.schedule("active_disaster", 0, { disasterType: "natural-disaster" });

const intvAfter = run(intvWorld, HORIZON);
const intvSnap = snapshot(intvAfter);

// --- Compare ---
const ids = drSectorIds(baseSnap);
console.log(`E5: sentinels = ${ids.join(", ")}`);

const results: Record<string, unknown> = {};
for (const id of ids) {
  const baseHash = sectorHash(baseSnap, id);
  const intvHash = sectorHash(intvSnap, id);
  const changed = baseHash !== intvHash;
  results[id] = { baselineHash: baseHash, interventionHash: intvHash, changed };
  console.log(`  ${id}: baseline=${baseHash} intervention=${intvHash} changed=${changed}`);
}

// RNG isolation: KE world RNG state must be identical across runs
// (intervention is sector-local; it must not perturb the world RNG stream)
const rngIsolated = hashState(baseAfter.rngState) === hashState(intvAfter.rngState);
console.log(`  KE world RNG state: baseline=${hashState(baseAfter.rngState)} intervention=${hashState(intvAfter.rngState)} identical=${rngIsolated}`);

// Non-DR sectors must also be identical (intervention must not leak)
const nonDrIds = baseSnap.sectors.filter((s) => !s.id.startsWith("deers-rock-")).map((s) => s.id);
const nonDrClean = nonDrIds.every((id) => sectorHash(baseSnap, id) === sectorHash(intvSnap, id));
console.log(`  Non-DR sectors identical: ${nonDrClean}`);

const aChanged = (results["deers-rock-sentinel-A"] as any).changed;
const bUnchanged = !(results["deers-rock-sentinel-B"] as any).changed;
const cUnchanged = !(results["deers-rock-sentinel-C"] as any).changed;

const verdict = {
  aChanged,
  bUnchanged,
  cUnchanged,
  rngIsolated,
  nonDrClean,
  pass: aChanged && bUnchanged && cUnchanged && rngIsolated && nonDrClean,
};

console.log(`\nE5 VERDICT: A-changed=${aChanged} B-clean=${bUnchanged} C-clean=${cUnchanged} RNG-isolated=${rngIsolated} nonDR-clean=${nonDrClean} => ${verdict.pass ? "PASS" : "FAIL"}`);

const report = {
  experiment: "E5-sentinel-isolation-under-coupling",
  seed: SEED,
  horizon: HORIZON,
  sentinels: SENTINELS,
  intervention: {
    target: "deers-rock-sentinel-A",
    events: [
      { type: "supply_chain_pressure", data: { pressure: 0.8 } },
      { type: "active_disaster", data: { disasterType: "natural-disaster" } },
    ],
  },
  perSentinel: results,
  rngIsolation: { baselineHash: hashState(baseAfter.rngState), interventionHash: hashState(intvAfter.rngState), identical: rngIsolated },
  nonDrSectorsIdentical: nonDrClean,
  verdict,
  createdAt: new Date().toISOString(),
};

writeFileSync(join(outDir, "e5-isolation-results.json"), JSON.stringify(report, null, 2));
console.log(`E5 complete. Results: ${join(outDir, "e5-isolation-results.json")}`);
