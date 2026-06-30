import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { runSingleSeed } from "./wwii-no-war.js";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { createEnergySector } from "../../sectors/energy.js";
import { createDemographicsSector } from "../../sectors/demographics.js";
import { createWorld, run, snapshot, createUniverse, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint, forkBranch, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import type { Intervention } from "../../timeline/branch.js";
import { buildFullDiff } from "../diff-engine.js";
import { computeSummary, mean, stdDev } from "../stats.js";
import { loadEraConfig } from "../../engine/era-loader.js";
import type { ExperimentRun, ExperimentSet, CounterfactualDiff } from "../types.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ERA_PATH = join(__dirname, "../../../docs/history/era-modern.json");

export interface SweepSeedResult {
  n: number;
  totalMetrics: number;
  significantCount: number;
  significantRatio: number;
  avgCiWidth: number;
  avgCohensD: number;
  noiseFloorRatio: number;
}

export interface NoiseBaseline {
  n: number;
  totalMetrics: number;
  falsePositiveCount: number;
  falsePositiveRatio: number;
  avgCiWidth: number;
  avgCohensD: number;
}

export interface PerSectorSweep {
  sector: string;
  metricsByN: Record<number, { count: number; significant: number; avgCiWidth: number; avgCohensD: number }>;
  noiseFloor: { falsePositives: number; avgCiWidth: number };
}

export interface SweepReport {
  seeds: number[];
  signal: SweepSeedResult[];
  noise: NoiseBaseline;
  perSector: PerSectorSweep[];
  topMetrics: string[];
  generatedAt: string;
}

function buildAllSectors(): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
  ];
}

function runNoiseBaseline(seedCount: number): ExperimentSet {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const seeds = Array.from({ length: seedCount }, (_, i) => 100 + i);
  const runs: ExperimentRun[] = [];

  for (const seed of seeds) {
    resetUniverseCounter();
    resetBranchCounter();
    resetRewindCounter();

    const configs = loadEraConfig(ERA_PATH, "RP-MODERN-001");
    const sectors = buildAllSectors();
    const sectorMap = new Map(sectors.map((s) => [s.id, s]));
    const world = createWorld(sectors, configs, { seed });
    const rp = createRewindPoint(world, "preseeded", { label: "RP-MODERN-001" });
    const parentAfter30 = run(world, 30);
    const branch = forkBranch(world, rp, {}, sectorMap, 30, "Noise baseline (no intervention)");

    const sectorStates = new Map<string, { parent: SectorState; branch: SectorState; parentEvents: []; branchEvents: [] }>();
    const ps = snapshot(parentAfter30);
    for (const s of ps.sectors) {
      const cs = branch.childSnapshot.sectors.find((bs) => bs.id === s.id);
      if (cs) {
        sectorStates.set(s.id, { parent: s.state, branch: cs.state, parentEvents: [], branchEvents: [] });
      }
    }

    const diff = buildFullDiff(branch.id, branch.parentUniverse, branch.rewindTick, branch.childSnapshot.tick, sectorStates);

    runs.push({
      runId: `noise-${seed}`,
      seed,
      rewindTick: branch.rewindTick,
      totalTicks: branch.childSnapshot.tick - branch.rewindTick,
      intervention: { type: "custom", label: "Noise baseline", description: "No intervention — measures RNG-only divergence", params: {} },
      diff,
      createdAt: new Date().toISOString(),
    });
  }

  const summary = computeSummary(runs, { type: "custom", label: "Noise baseline", description: "", params: {} });

  return {
    setId: "NOISE-BASELINE",
    label: "Noise Baseline — RNG-only Divergence",
    description: "No intervention. Different seeds. Measures natural trajectory divergence.",
    intervention: { type: "custom", label: "Noise baseline", description: "", params: {} },
    rewindTick: 0,
    rewindLabel: "RP-MODERN-001",
    totalTicks: 30,
    numSeeds: seedCount,
    runs,
    summary,
    createdAt: new Date().toISOString(),
    tags: ["noise-baseline", "sensitivity"],
  };
}

function runSignalSweep(seedCount: number): ExperimentRun {
  return runSingleSeed(42 + seedCount * 100);
}

export function runSweep(): SweepReport {
  const seedCounts = [3, 5, 10, 20];
  const noiseN = 20;

  const noiseExp = runNoiseBaseline(noiseN);
  const noiseSig = noiseExp.summary.metrics.filter((m) => m.significant);

  const signal: SweepSeedResult[] = [];
  const perSectorData = new Map<string, PerSectorSweep>();

  for (const n of seedCounts) {
    resetUniverseCounter();
    resetBranchCounter();
    resetRewindCounter();

    const seeds = Array.from({ length: n }, (_, i) => 42 + i);
    const runs: ExperimentRun[] = [];
    for (const seed of seeds) {
      const run = runSingleSeed(seed);
      runs.push(run);
    }

    const intervention = runs[0]!.intervention;
    const summary = computeSummary(runs, intervention);

    const sigCount = summary.metrics.filter((m) => m.significant).length;
    const avgWidth = mean(summary.metrics.filter((m) => m.stdDev > 0).map((m) => m.ci95Upper - m.ci95Lower));
    const avgD = mean(summary.metrics.map((m) => Math.abs(m.cohensD)));

    signal.push({
      n,
      totalMetrics: summary.metrics.length,
      significantCount: sigCount,
      significantRatio: Math.round((sigCount / summary.metrics.length) * 10000) / 100,
      avgCiWidth: Math.round(avgWidth * 100) / 100,
      avgCohensD: Math.round(avgD * 100) / 100,
      noiseFloorRatio: noiseSig.length > 0 ? Math.round((sigCount / noiseSig.length) * 100) / 100 : Infinity,
    });

    for (const m of summary.metrics) {
      const sector = m.path.startsWith("nations.") ? m.path.split(".")[0]! : m.path;
      const mappedSector = (() => {
        if (m.path.startsWith("nations.")) {
          const nationKey = m.path.split(".").slice(2).join(".");
          if (["gdp", "gdpGrowthRate", "inflationRate", "tradeVolume", "unemploymentRate", "marketIndex", "globalTradeVolume", "globalInflation"].some((k) => m.path.includes(k))) return "economy";
          if (["rdSpending", "researchOutput", "innovationCount", "patents"].some((k) => m.path.includes(k))) return "technology";
          if (["energyMix", "totalConsumption", "energyPrice", "energySecurity", "co2Intensity"].some((k) => m.path.includes(k))) return "energy";
          if (["population", "birthRate", "deathRate", "medianAge", "dependencyRatio", "laborForce", "netMigration"].some((k) => m.path.includes(k))) return "demographics";
          return "geopolitics";
        }
        if (["co2Concentration", "annualEmissions", "temperatureAnomaly", "extremeEvents", "seaLevelRise"].some((k) => m.path.startsWith(k))) return "climate";
        if (["globalTradeVolume", "globalInflation", "marketIndex"].some((k) => m.path.startsWith(k))) return "economy";
        if (["globalEnergyPrice", "globalRenewableShare"].some((k) => m.path.startsWith(k))) return "energy";
        if (["globalPopulation", "globalMedianAge"].some((k) => m.path.startsWith(k))) return "demographics";
        return "geopolitics";
      })();

      if (!perSectorData.has(mappedSector)) {
        perSectorData.set(mappedSector, {
          sector: mappedSector,
          metricsByN: {},
          noiseFloor: { falsePositives: 0, avgCiWidth: 0 },
        });
      }
      if (!perSectorData.get(mappedSector)!.metricsByN[n]) {
        perSectorData.get(mappedSector)!.metricsByN[n] = { count: 0, significant: 0, avgCiWidth: 0, avgCohensD: 0 };
      }
      const entry = perSectorData.get(mappedSector)!.metricsByN[n]!;
      entry.count++;
      if (m.significant) entry.significant++;
      entry.avgCiWidth += (m.ci95Upper - m.ci95Lower);
      entry.avgCohensD += Math.abs(m.cohensD);
    }
  }

  for (const ps of perSectorData.values()) {
    for (const nStr of Object.keys(ps.metricsByN)) {
      const e = ps.metricsByN[Number(nStr)]!;
      if (e.count > 0) {
        e.avgCiWidth = Math.round((e.avgCiWidth / e.count) * 100) / 100;
        e.avgCohensD = Math.round((e.avgCohensD / e.count) * 100) / 100;
      }
    }
    const noiseMetrics = noiseExp.summary.metrics;
    ps.noiseFloor = {
      falsePositives: noiseMetrics.filter((m) => {
        const ms = (() => {
          if (m.path.startsWith("nations.")) {
            if (["gdp", "gdpGrowthRate", "inflationRate", "tradeVolume", "unemploymentRate", "marketIndex", "globalTradeVolume", "globalInflation"].some((k) => m.path.includes(k))) return "economy";
            if (["rdSpending", "researchOutput", "innovationCount", "patents"].some((k) => m.path.includes(k))) return "technology";
            if (["energyMix", "totalConsumption", "energyPrice", "energySecurity", "co2Intensity"].some((k) => m.path.includes(k))) return "energy";
            if (["population", "birthRate", "deathRate", "medianAge", "dependencyRatio", "laborForce", "netMigration"].some((k) => m.path.includes(k))) return "demographics";
            return "geopolitics";
          }
          if (["co2Concentration", "annualEmissions", "temperatureAnomaly", "extremeEvents", "seaLevelRise"].some((k) => m.path.startsWith(k))) return "climate";
          if (["globalTradeVolume", "globalInflation", "marketIndex"].some((k) => m.path.startsWith(k))) return "economy";
          if (["globalEnergyPrice", "globalRenewableShare"].some((k) => m.path.startsWith(k))) return "energy";
          if (["globalPopulation", "globalMedianAge"].some((k) => m.path.startsWith(k))) return "demographics";
          return "geopolitics";
        })();
        return ms === ps.sector && m.significant;
      }).length,
      avgCiWidth: Math.round(mean(noiseMetrics.filter((m) => m.stdDev > 0).map((m) => m.ci95Upper - m.ci95Lower)) * 100) / 100,
    };
  }

  const topMetrics = noiseExp.summary.metrics
    .filter((m) => m.significant)
    .slice(0, 10)
    .map((m) => m.path);

  return {
    seeds: seedCounts,
    signal,
    noise: {
      n: noiseN,
      totalMetrics: noiseExp.summary.metrics.length,
      falsePositiveCount: noiseSig.length,
      falsePositiveRatio: Math.round((noiseSig.length / noiseExp.summary.metrics.length) * 10000) / 100,
      avgCiWidth: Math.round(mean(noiseExp.summary.metrics.filter((m) => m.stdDev > 0).map((m) => m.ci95Upper - m.ci95Lower)) * 100) / 100,
      avgCohensD: Math.round(mean(noiseExp.summary.metrics.map((m) => Math.abs(m.cohensD))) * 100) / 100,
    },
    perSector: [...perSectorData.values()],
    topMetrics,
    generatedAt: new Date().toISOString(),
  };
}

if (process.argv[1]?.replace(/\\/g, "/").includes("sensitivity-sweep")) {
  const report = runSweep();
  const outDir = join(__dirname, "../../../experiment-results/wwii-counterfactual");
  writeFileSync(join(outDir, "sensitivity-sweep.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
