import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import type { Nation as GeoNation, War, Alliance, GlobalState } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";
import { createEconomySector } from "../../sectors/economy.js";
import { createTechnologySector } from "../../sectors/technology.js";
import { createSentinels } from "../../sectors/deers-rock-adapter.js";
import type { DeersRockSectorState, HospitalSentinelOutput } from "../../sectors/deers-rock-adapter.js";
import type { Sector, SectorState } from "../../sectors/types.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import type { WorldSnapshot } from "../../engine/world-engine.js";
import { createRewindPoint, forkBranch, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import { HOSPITAL_REGIONS } from "../../data/indonesian-hospitals.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface EraState {
  year: number;
  label: string;
  nations: GeoNation[];
  wars: War[];
  alliances: Alliance[];
  globalState: GlobalState;
}

function loadEraState(): EraState {
  const path = join(__dirname, "../../../docs/history/era-contemporary.json");
  const raw = JSON.parse(readFileSync(path, "utf-8")) as { states: Record<string, EraState> };
  return raw.states["RP-CONTEMP-002"]!;
}

function buildSectorConfigs(era: EraState): Record<string, Record<string, unknown>> {
  const economyNations: Record<string, Record<string, unknown>> = {};
  const techNations: Record<string, Record<string, unknown>> = {};
  for (const n of era.nations) {
    economyNations[n.id] = { gdp: n.gdp, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 50, unemploymentRate: 5.0 };
    techNations[n.id] = { technologyLevel: n.technologyLevel, rdSpending: 0.01 + (n.technologyLevel / 100) * 0.025 };
  }
  return {
    geopolitics: { nations: era.nations, wars: era.wars, alliances: era.alliances, globalState: era.globalState, year: era.year, casualtyMultiplier: 1 },
    climate: { co2Concentration: 420, annualEmissions: 37, year: era.year, annualEmissionsNoise: 0.2 },
    economy: { nations: economyNations, year: era.year },
    technology: { nations: techNations, year: era.year },
  };
}

export interface HospitalResult {
  id: string;
  city: string;
  region: string;
  parentOutput: HospitalSentinelOutput | null;
  branchOutput: HospitalSentinelOutput | null;
}

export interface RegionStats {
  region: string;
  label: string;
  hospitalCount: number;
  avgOccupancyParent: number;
  avgOccupancyBranch: number;
  avgIcuParent: number;
  avgIcuBranch: number;
  avgMortalityParent: number;
  avgMortalityBranch: number;
  surgeCountParent: number;
  surgeCountBranch: number;
  circuitBreakersTripped: number;
}

function getRegionForHospital(id: string): { region: string; label: string } {
  for (const r of HOSPITAL_REGIONS) {
    for (const h of r.hospitals) {
      if (h.id === id) return { region: r.region, label: r.label };
    }
  }
  return { region: "unknown", label: "Unknown" };
}

function extractHospitalResults(parentSnap: WorldSnapshot, childSnap: WorldSnapshot): HospitalResult[] {
  const results: HospitalResult[] = [];
  const parentSectors = new Map(parentSnap.sectors.map((s) => [s.id, s.state]));
  const childSectors = new Map(childSnap.sectors.map((s) => [s.id, s.state]));

  for (const [id, parentState] of parentSectors) {
    const pdr = parentState as unknown as DeersRockSectorState;
    if (pdr._sectorId !== "deers-rock") continue;
    const childState = childSectors.get(id) as unknown as DeersRockSectorState | undefined;
    const regionInfo = getRegionForHospital(pdr.config.id);
    results.push({
      id: pdr.config.id,
      city: pdr.config.city,
      region: regionInfo.region,
      parentOutput: pdr.sentinelOutput,
      branchOutput: childState?.sentinelOutput ?? null,
    });
  }

  return results;
}

function computeRegionStats(results: HospitalResult[]): RegionStats[] {
  const byRegion = new Map<string, HospitalResult[]>();
  for (const r of results) {
    if (!byRegion.has(r.region)) byRegion.set(r.region, []);
    byRegion.get(r.region)!.push(r);
  }

  const stats: RegionStats[] = [];
  for (const region of HOSPITAL_REGIONS) {
    const regionResults = byRegion.get(region.region) ?? [];
    const withOutput = regionResults.filter((r) => r.parentOutput && r.branchOutput);
    if (withOutput.length === 0) {
      stats.push({
        region: region.region, label: region.label, hospitalCount: region.hospitals.length,
        avgOccupancyParent: 0, avgOccupancyBranch: 0, avgIcuParent: 0, avgIcuBranch: 0,
        avgMortalityParent: 0, avgMortalityBranch: 0, surgeCountParent: 0, surgeCountBranch: 0,
        circuitBreakersTripped: 0,
      });
      continue;
    }
    const occP = withOutput.reduce((s, r) => s + (r.parentOutput?.occupancyRate ?? 0), 0) / withOutput.length;
    const occB = withOutput.reduce((s, r) => s + (r.branchOutput?.occupancyRate ?? 0), 0) / withOutput.length;
    const icuP = withOutput.reduce((s, r) => s + (r.parentOutput?.icuOccupancyRate ?? 0), 0) / withOutput.length;
    const icuB = withOutput.reduce((s, r) => s + (r.branchOutput?.icuOccupancyRate ?? 0), 0) / withOutput.length;
    const mortP = withOutput.reduce((s, r) => s + (r.parentOutput?.mortalityPressure ?? 0), 0) / withOutput.length;
    const mortB = withOutput.reduce((s, r) => s + (r.branchOutput?.mortalityPressure ?? 0), 0) / withOutput.length;
    const surgeP = withOutput.filter((r) => r.parentOutput?.admissionSurge).length;
    const surgeB = withOutput.filter((r) => r.branchOutput?.admissionSurge).length;
    stats.push({
      region: region.region, label: region.label, hospitalCount: region.hospitals.length,
      avgOccupancyParent: Math.round(occP * 1000) / 1000,
      avgOccupancyBranch: Math.round(occB * 1000) / 1000,
      avgIcuParent: Math.round(icuP * 1000) / 1000,
      avgIcuBranch: Math.round(icuB * 1000) / 1000,
      avgMortalityParent: Math.round(mortP * 100) / 100,
      avgMortalityBranch: Math.round(mortB * 100) / 100,
      surgeCountParent: surgeP,
      surgeCountBranch: surgeB,
      circuitBreakersTripped: regionResults.filter((r) => !r.parentOutput).length,
    });
  }

  return stats;
}

export function runSingleSeed(seed: number): { results: HospitalResult[]; regionStats: RegionStats[] } {
  resetUniverseCounter();
  resetBranchCounter();
  resetRewindCounter();

  const era = loadEraState();
  const configs = buildSectorConfigs(era);
  const allSentinels = HOSPITAL_REGIONS.flatMap((r) => r.hospitals);
  const sectors: Sector[] = [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    ...createSentinels(allSentinels, seed),
  ];

  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const world = createWorld(sectors, configs, { seed });
  const rp = createRewindPoint(world, "preseeded", { label: "COVID-19 Baseline (2020)", tags: ["covid19", "heatmap"] });

  const parentAfter20 = run(world, 20);

  const intervention: Record<string, Record<string, unknown>> = {
    climate: { annualEmissionsNoise: 0.02, co2Concentration: 400 },
  };

  const branch = forkBranch(world, rp, intervention, sectorMap, 20, "Reduced emissions — fewer extreme weather events");

  const parentSnap = snapshot(parentAfter20);
  const results = extractHospitalResults(parentSnap, branch.childSnapshot);
  const regionStats = computeRegionStats(results);

  return { results, regionStats };
}

export function runExperiment(seeds: number[] = [42, 43, 44]): {
  seeds: number[];
  runs: Array<{ seed: number; results: HospitalResult[]; regionStats: RegionStats[] }>;
  aggregateRegionStats: RegionStats[];
} {
  const runs = seeds.map((seed) => ({ seed, ...runSingleSeed(seed) }));

  const aggregateRegionStats: RegionStats[] = HOSPITAL_REGIONS.map((region) => {
    const regionRuns = runs.flatMap((r) => r.regionStats.filter((rs) => rs.region === region.region));
    if (regionRuns.length === 0) {
      return { region: region.region, label: region.label, hospitalCount: region.hospitals.length, avgOccupancyParent: 0, avgOccupancyBranch: 0, avgIcuParent: 0, avgIcuBranch: 0, avgMortalityParent: 0, avgMortalityBranch: 0, surgeCountParent: 0, surgeCountBranch: 0, circuitBreakersTripped: 0 };
    }
    return {
      region: region.region, label: region.label, hospitalCount: region.hospitals.length,
      avgOccupancyParent: Math.round(regionRuns.reduce((s, r) => s + r.avgOccupancyParent, 0) / regionRuns.length * 1000) / 1000,
      avgOccupancyBranch: Math.round(regionRuns.reduce((s, r) => s + r.avgOccupancyBranch, 0) / regionRuns.length * 1000) / 1000,
      avgIcuParent: Math.round(regionRuns.reduce((s, r) => s + r.avgIcuParent, 0) / regionRuns.length * 1000) / 1000,
      avgIcuBranch: Math.round(regionRuns.reduce((s, r) => s + r.avgIcuBranch, 0) / regionRuns.length * 1000) / 1000,
      avgMortalityParent: Math.round(regionRuns.reduce((s, r) => s + r.avgMortalityParent, 0) / regionRuns.length * 100) / 100,
      avgMortalityBranch: Math.round(regionRuns.reduce((s, r) => s + r.avgMortalityBranch, 0) / regionRuns.length * 100) / 100,
      surgeCountParent: Math.round(regionRuns.reduce((s, r) => s + r.surgeCountParent, 0) / regionRuns.length),
      surgeCountBranch: Math.round(regionRuns.reduce((s, r) => s + r.surgeCountBranch, 0) / regionRuns.length),
      circuitBreakersTripped: regionRuns.reduce((s, r) => s + r.circuitBreakersTripped, 0),
    };
  });

  return { seeds, runs, aggregateRegionStats };
}

if (import.meta.url.replace(/\\/g, "/").includes("sentinel-heatmap")) {
  const result = runExperiment([42, 43, 44]);
  const outDir = join(__dirname, "../../../experiment-results/dr-counterfactual");
  writeFileSync(join(outDir, "heatmap.json"), JSON.stringify(result.aggregateRegionStats, null, 2));

  console.log("=== Regional Health Pressure Heatmap ===\n");
  for (const r of result.aggregateRegionStats) {
    const occDelta = ((r.avgOccupancyBranch - r.avgOccupancyParent) * 100).toFixed(1);
    const mortDelta = (r.avgMortalityBranch - r.avgMortalityParent).toFixed(1);
    console.log(`${r.label} (${r.hospitalCount} hospitals):`);
    console.log(`  Occupancy: ${(r.avgOccupancyParent * 100).toFixed(1)}% → ${(r.avgOccupancyBranch * 100).toFixed(1)}% (${occDelta}pp)`);
    console.log(`  ICU: ${(r.avgIcuParent * 100).toFixed(1)}% → ${(r.avgIcuBranch * 100).toFixed(1)}%`);
    console.log(`  Mortality: ${r.avgMortalityParent} → ${r.avgMortalityBranch} (Δ=${mortDelta})`);
    console.log(`  Surge: ${r.surgeCountParent} → ${r.surgeCountBranch}`);
    console.log(`  Circuits: ${r.circuitBreakersTripped}`);
    console.log();
  }
}
