/**
 * E4 — Horizon Sensitivity Experiment
 *
 * Purpose: determine whether the intervention response is:
 *   1. observable,
 *   2. directionally consistent,
 *   3. stable enough to interpret,
 *   4. sensitive to observation window.
 *
 * Design: same seeds, same intervention, three pre-specified horizons
 * (20 / 40 / 60 KE world ticks). Horizons were fixed BEFORE running.
 * No post-hoc horizon selection.
 *
 * MECHANISM NOTE (why fresh worlds, not forkBranch):
 *   KE's deepClone returns class instances and functions BY REFERENCE
 *   (clone.ts). The DR sector state contains world.queue (EventQueue
 *   class instance) and world.clock.rng (closure with mutable internal
 *   state). Restoring a checkpoint therefore SHARES these objects between
 *   branches: the first branch to run advances the shared RNG closure and
 *   leaves events in the shared queue, so the second branch does not start
 *   from the checkpoint state. Using forkBranch here would confound the
 *   horizon comparison with that aliasing defect.
 *
 *   Instead: two FRESH worlds per cell, created from the same seed. The
 *   intervention world is created with the climate config already patched
 *   (init-time), which is state-identical to forkBranch's patchState of
 *   the same fields at a tick-0 checkpoint. Both worlds start from the
 *   same world-RNG stream position; divergence after that is the causal
 *   effect of the intervention.
 *
 * Intervention (identical to P-004): climate.emissions_control —
 * reduced CO2 concentration (420→400) and emissions noise (0.2→0.02)
 * → fewer extreme weather events → less hospital surge.
 *
 * Temporal contract (Phase C, unchanged): 1 KE world tick = 1 simulated
 * year; the DR sentinel runs a bounded sampling window (ticksPerDay=10
 * DR ticks per KE tick) — NOT full 525,600-tick fidelity.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import { hashState } from "../../timeline/hash.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

// Pre-specified horizons — fixed before any run. Do not add horizons after
// seeing results.
const HORIZONS = [20, 40, 60] as const;

// Pre-specified seeds — same three seeds across all horizons.
const SEEDS = [42, 43, 44] as const;

// Pre-specified DR sentinel metrics (causal metrics, not bookkeeping).
const METRICS = [
  "sentinelOutput.occupancyRate",
  "sentinelOutput.icuOccupancyRate",
  "sentinelOutput.mortalityPressure",
  "sentinelOutput.supplyStress",
  "sentinelOutput.staffStress",
] as const;

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
    deersRockAdapter({ ...SENTINEL }, worldSeed),
  ];
}

function buildSectorConfigs(era: EraState, climateOverrides?: Record<string, unknown>): Record<string, Record<string, unknown>> {
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
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2, ...climateOverrides },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

function readMetric(snap: WorldSnapshot, sectorId: string, path: string): number {
  const rec = snap.sectors.find((s) => s.id === sectorId);
  if (!rec) return NaN;
  const parts = path.split(".");
  let cur: unknown = rec.state;
  for (const p of parts) {
    if (cur === null || cur === undefined) return NaN;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "number" ? cur : NaN;
}

function drSectorId(snap: WorldSnapshot): string {
  return snap.sectors.find((s) => s.id.startsWith("deers-rock-"))!.id;
}

/** Run one (seed, horizon) cell: fresh baseline world + fresh intervention world. */
function runCell(seed: number, horizon: number) {
  const era = loadEraState();

  // Baseline world: original climate config
  resetUniverseCounter();
  const baseWorld = createWorld(createAllSectors(seed), buildSectorConfigs(era), { seed });
  const baselineAfter = run(baseWorld, horizon);
  const baselineSnap = snapshot(baselineAfter);

  // Intervention world: same seed, climate config patched at init
  // (state-identical to forkBranch patchState of the same fields at tick 0)
  resetUniverseCounter();
  const intvWorld = createWorld(
    createAllSectors(seed),
    buildSectorConfigs(era, { annualEmissionsNoise: 0.02, co2Concentration: 400 }),
    { seed },
  );
  const intvAfter = run(intvWorld, horizon);
  const intvSnap = snapshot(intvAfter);

  const drId = drSectorId(baselineSnap);

  const metrics: Record<string, { baseline: number; intervention: number; absDiff: number; direction: string }> = {};
  for (const m of METRICS) {
    const b = readMetric(baselineSnap, drId, m);
    const i = readMetric(intvSnap, drId, m);
    const absDiff = i - b;
    metrics[m] = {
      baseline: b,
      intervention: i,
      absDiff,
      direction: absDiff === 0 ? "none" : absDiff > 0 ? "+" : "-",
    };
  }

  return {
    seed,
    horizon,
    baselineHash: hashState(baselineSnap.sectors),
    interventionHash: hashState(intvSnap.sectors),
    metrics,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../experiment-results/e4-horizon");
mkdirSync(outDir, { recursive: true });

const results: ReturnType<typeof runCell>[] = [];
for (const horizon of HORIZONS) {
  for (const seed of SEEDS) {
    console.log(`E4: horizon=${horizon} seed=${seed} ...`);
    const cell = runCell(seed, horizon);
    results.push(cell);
    for (const [m, v] of Object.entries(cell.metrics)) {
      console.log(`    ${m}: base=${v.baseline.toFixed(4)} intv=${v.intervention.toFixed(4)} Δ=${v.absDiff.toFixed(4)} dir=${v.direction}`);
    }
  }
}

// Direction-consistency analysis across horizons (per seed, per metric)
const consistency: { seed: number; metric: string; directions: string[]; directionConsistent: boolean }[] = [];
for (const seed of SEEDS) {
  for (const m of METRICS) {
    const dirs = HORIZONS.map((h) => {
      const cell = results.find((r) => r.seed === seed && r.horizon === h)!;
      return cell.metrics[m]!.direction;
    });
    const nonZero = dirs.filter((d) => d !== "none");
    const consistent = nonZero.length === 0 || nonZero.every((d) => d === nonZero[0]);
    consistency.push({ seed, metric: m, directions: dirs, directionConsistent: consistent });
  }
}

const report = {
  experiment: "E4-horizon-sensitivity",
  mechanism: "fresh-worlds (two worlds from same seed; intervention via init-time climate config; no restore/forkBranch — avoids deepClone class-instance/closure aliasing in the DR sector state)",
  horizons: HORIZONS,
  seeds: SEEDS,
  intervention: { type: "emissions_control", params: { annualEmissionsNoise: 0.02, co2Concentration: 400 } },
  metrics: METRICS,
  cells: results,
  directionConsistency: consistency,
  createdAt: new Date().toISOString(),
};

writeFileSync(join(outDir, "e4-horizon-results.json"), JSON.stringify(report, null, 2));
console.log(`\nE4 complete. Results: ${join(outDir, "e4-horizon-results.json")}`);
