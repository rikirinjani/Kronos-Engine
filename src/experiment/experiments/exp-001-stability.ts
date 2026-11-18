import { createWriteStream, mkdirSync, readFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { deersRockAdapter } from "../../sectors/deers-rock-adapter.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import { createRewindPoint, forkBranch, hashState, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import { buildFullDiff } from "../diff-engine.js";
import type { CounterfactualDiff, Intervention } from "../types.js";
import { createExp001ObserverSector, type Exp001ObserverState } from "../exp-001-observer.js";
import {
  assertBaselineIntegrity,
  assertMatchedHorizon,
  PRIMARY_OUTCOMES,
  isBookkeepingPath,
  matchesSector,
  type PrimaryOutcome,
  type PrimaryOutcomeEffect,
  type RunGuards,
} from "./dr-counterfactual.js";

// ---------------------------------------------------------------------------
// EXP-001: Counterfactual Stability Study.
//
// Isolated experiment layer. Reuses the P-004 scientific-rigor scaffolding
// (identical-baseline guard, matched-horizon guard, pre-specified primary
// outcomes, bookkeeping-field stripping) from dr-counterfactual.ts and adds a
// passive event-count observer sector. Frozen artifacts (P-003, P-004, Phase F,
// engine semantics) are NOT modified.
//
// The observer is appended LAST in the sector list so the RNG draw sequence for
// the pre-existing sectors is unchanged.
// ---------------------------------------------------------------------------

const SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

export interface Exp001Run {
  runId: string; // `exp001-${seed}`
  seed: number;
  horizon: number;
  rewindTick: number;
  totalTicks: number;
  intervention: Intervention;
  diff: CounterfactualDiff;
  guards: RunGuards;
  primaryOutcomes: PrimaryOutcomeEffect[];
  observer: {
    parentEventCounts: Record<string, number>;
    branchEventCounts: Record<string, number>;
    parentTotalEvents: number;
    branchTotalEvents: number;
  };
  runtimeMs: number;
  createdAt: string;
}

function loadEraState(eraFile: string, rpId: string): EraState {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const path = join(__dirname, `../../../docs/history/${eraFile}`);
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states[rpId]!;
}

function createAllSectors(worldSeed: number): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter({ ...SENTINEL }, worldSeed),
    // Passive observer appended LAST: existing sectors keep their RNG draws.
    createExp001ObserverSector(),
  ];
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};

  for (const n of era.nations) {
    economyNations[n.id] = {
      gdp: n.gdp,
      gdpGrowthRate: 2.5,
      inflationRate: 3.0,
      tradeVolume: 50,
      unemploymentRate: 5.0,
    };
    techNations[n.id] = {
      technologyLevel: n.technologyLevel,
      rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025,
    };
  }

  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

function readBookkeeping(snap: WorldSnapshot, sectorId = "geopolitics"): { year: number; tickCount: number } {
  const state = snap.sectors.find((s) => s.id === sectorId)?.state as Record<string, unknown> | undefined;
  return { year: (state?.year as number) ?? NaN, tickCount: (state?.tickCount as number) ?? NaN };
}

function buildParentChildEventArrays(
  parentSnap: WorldSnapshot,
  childSnap: WorldSnapshot,
): Map<string, { parent: SectorState; branch: SectorState; parentEvents: []; branchEvents: [] }> {
  const map = new Map<string, { parent: SectorState; branch: SectorState; parentEvents: []; branchEvents: [] }>();
  for (const ps of parentSnap.sectors) {
    const cs = childSnap.sectors.find((s) => s.id === ps.id);
    if (cs) {
      map.set(ps.id, { parent: ps.state, branch: cs.state, parentEvents: [], branchEvents: [] });
    }
  }
  return map;
}

/** Strip bookkeeping/clock fields from the causal metric set. */
function stripBookkeepingFromDiff(diff: CounterfactualDiff): CounterfactualDiff {
  const perSector: Record<string, import("../types.js").SectorDiff> = {};
  for (const [id, sd] of Object.entries(diff.perSector)) {
    perSector[id] = { ...sd, metrics: sd.metrics.filter((m) => !isBookkeepingPath(m.path)) };
  }
  return { ...diff, perSector };
}

function collectPrimaryOutcomeEffects(diff: CounterfactualDiff, outcomes: PrimaryOutcome[]): PrimaryOutcomeEffect[] {
  const effects: PrimaryOutcomeEffect[] = [];
  for (const outcome of outcomes) {
    for (const [sectorId, sd] of Object.entries(diff.perSector)) {
      if (!matchesSector(sectorId, outcome.sectors)) continue;
      for (const path of outcome.paths) {
        const m = sd.metrics.find((metric) => metric.path === path);
        if (m) {
          effects.push({
            outcomeId: outcome.id,
            outcomeLabel: outcome.label,
            sector: sectorId,
            path,
            parentValue: m.parentValue,
            branchValue: m.branchValue,
            absoluteDelta: m.absoluteDelta,
            relativeDelta: m.relativeDelta,
          });
        }
      }
    }
  }
  return effects;
}

/** Pull the observer sector's accumulated counts out of both branch snapshots. */
function extractObserverCounts(
  parentSnap: WorldSnapshot,
  childSnap: WorldSnapshot,
): Exp001Run["observer"] {
  const parentState = parentSnap.sectors.find((s) => s.id === "exp-001-observer")?.state as Exp001ObserverState | undefined;
  const childState = childSnap.sectors.find((s) => s.id === "exp-001-observer")?.state as Exp001ObserverState | undefined;
  return {
    parentEventCounts: parentState?.eventCounts ?? {},
    branchEventCounts: childState?.eventCounts ?? {},
    parentTotalEvents: parentState?.totalEvents ?? 0,
    branchTotalEvents: childState?.totalEvents ?? 0,
  };
}

export function runSingleSeedExp001(seed: number, horizon = 20): Exp001Run {
  const t0 = performance.now();
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const era = loadEraState("era-contemporary.json", "RP-CONTEMP-002");
  const sectors = createAllSectors(seed);
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const configs = buildSectorConfigs(era);
  const world = createWorld(sectors, configs, { seed });

  const rp = createRewindPoint(world, "preseeded", {
    label: "COVID-19 Baseline (2020)",
    tags: ["covid19", "contemporary", "exp-001"],
  });

  // Independent deep-clone of the parent baseline at tick 0, taken BEFORE the
  // parent advances.
  const baselineSnap = snapshot(world);

  const parentAfterHorizon = run(world, horizon);

  // Guard: the rewind point's stored baseline must deep-equal the pristine
  // parent baseline even after the parent branch advanced to the horizon.
  assertBaselineIntegrity(baselineSnap, rp, sectorMap);

  const intervention: Record<string, Record<string, unknown>> = {
    climate: {
      annualEmissionsNoise: 0.02,
      co2Concentration: 400,
    },
  };

  const branch = forkBranch(world, rp, intervention, sectorMap, horizon, "Lower CO2 reduces extreme weather");

  const parentSnap = snapshot(parentAfterHorizon);

  // Guard: both branches ran the SAME number of ticks from the SAME baseline.
  assertMatchedHorizon(parentSnap.tick, branch.childSnapshot.tick, "EXP-001");

  const sectorStates = buildParentChildEventArrays(parentSnap, branch.childSnapshot);
  const diff = stripBookkeepingFromDiff(
    buildFullDiff(branch.id, branch.parentUniverse, branch.rewindTick, branch.childSnapshot.tick, sectorStates),
  );

  const parentBookkeeping = readBookkeeping(parentSnap);
  const childBookkeeping = readBookkeeping(branch.childSnapshot);
  const guards: RunGuards = {
    matchedHorizon: parentSnap.tick === branch.childSnapshot.tick,
    parentTick: parentSnap.tick,
    childTick: branch.childSnapshot.tick,
    baselineIdentical: true, // assertBaselineIntegrity threw earlier if this was false
    baselineStateHash: hashState(baselineSnap.sectors),
    bookkeeping: {
      year: { parent: parentBookkeeping.year, child: childBookkeeping.year },
      tickCount: { parent: parentBookkeeping.tickCount, child: childBookkeeping.tickCount },
    },
  };

  const observer = extractObserverCounts(parentSnap, branch.childSnapshot);
  const runtimeMs = performance.now() - t0;

  return {
    runId: `exp001-${seed}`,
    seed,
    horizon,
    rewindTick: rp.tick,
    totalTicks: horizon,
    intervention: {
      type: "emissions_control",
      label: "Lower emissions reduce heatwave impact on hospitals",
      description: "Reduced CO2 concentration and emissions noise → fewer extreme weather events → less hospital surge",
      params: intervention,
    },
    diff,
    guards,
    primaryOutcomes: collectPrimaryOutcomeEffects(diff, PRIMARY_OUTCOMES),
    observer,
    runtimeMs,
    createdAt: new Date().toISOString(),
  };
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, "/").includes("exp-001-stability") &&
  process.argv[1].replace(/\\/g, "/").includes("exp-001-stability")
) {
  const arg = (name: string, def: string): string => {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=")[1]! : def;
  };

  const seedStart = Number(arg("seed-start", "1000"));
  const seedCount = Number(arg("seed-count", "10"));
  const horizon = Number(arg("horizon", "20"));
  const append = process.argv.includes("--append");
  const outArg = arg("out", `experiment-results/mc-lab/runs-H${horizon}.jsonl`);
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const outPath = isAbsolute(outArg) ? outArg : join(repoRoot, outArg);

  mkdirSync(dirname(outPath), { recursive: true });
  const stream = createWriteStream(outPath, { flags: append ? "a" : "w" });

  const t0 = performance.now();
  let runtimeMsSum = 0;
  let done = 0;
  let interrupted = false;

  const onSigint = (): void => {
    interrupted = true;
    console.log("\n[EXP-001] SIGINT received — flushing and closing output stream...");
  };
  process.on("SIGINT", onSigint);

  (async () => {
    for (let i = 0; i < seedCount && !interrupted; i++) {
      const seed = seedStart + i;
      const run = runSingleSeedExp001(seed, horizon);
      runtimeMsSum += run.runtimeMs;
      // Write each line immediately; never hold the full ensemble in memory.
      if (!stream.write(JSON.stringify(run) + "\n")) {
        await new Promise<void>((resolve) => stream.once("drain", resolve));
      }
      done++;
      if (done % 100 === 0 || done === seedCount) {
        const elapsed = (performance.now() - t0) / 1000;
        const pct = ((done / seedCount) * 100).toFixed(1);
        const rate = elapsed / done;
        console.log(`[EXP-001] seed ${done}/${seedCount} (${pct}%) elapsed=${elapsed.toFixed(1)}s rate=${rate.toFixed(3)}s/sim`);
      }
    }

    stream.end();
    await new Promise<void>((resolve) => stream.once("finish", resolve));
    const wall = (performance.now() - t0) / 1000;
    const meanMs = done > 0 ? runtimeMsSum / done : 0;
    console.log(`[EXP-001] complete: ${done} seeds, wall=${wall.toFixed(1)}s, meanRuntimeMs=${meanMs.toFixed(1)}ms, out=${outPath}`);
    process.exit(0);
  })();
}