import { describe, it, expect, beforeEach } from "vitest";
import { forkBranch, resetBranchCounter } from "./branch.js";
import { createRewindPoint, resetRewindCounter } from "./rewind-point.js";
import { createWorld, run } from "../engine/world-engine.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import { resetUniverseCounter } from "../engine/universe.js";
import type { Sector } from "../sectors/types.js";
import type { GeopoliticsState } from "../sectors/geopolitics.js";
import type { EconomyState } from "../sectors/economy.js";

const sampleConfigs: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      { id: "USA", name: "United States", region: "north-america",
        population: 340_000_000, gdp: 27_000_000_000_000,
        government: "democracy" as const, technologyLevel: 85, militaryPower: 90,
        healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
        alliances: ["NATO"], wars: [],
        relations: { CHN: 30, RUS: 10, GBR: 85 } },
      { id: "CHN", name: "China", region: "east-asia",
        population: 1_410_000_000, gdp: 18_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 72, militaryPower: 85,
        healthMetrics: { lifeExpectancy: 77, infantMortality: 6.8, hospitalBedsPer1000: 4.3, universalCoverage: true },
        alliances: ["SCO"], wars: [],
        relations: { USA: 30, RUS: 70, GBR: 40 } },
      { id: "RUS", name: "Russia", region: "eastern-europe",
        population: 144_000_000, gdp: 2_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 55, militaryPower: 75,
        healthMetrics: { lifeExpectancy: 70, infantMortality: 7.2, hospitalBedsPer1000: 8.0, universalCoverage: true },
        alliances: ["SCO", "CSTO"], wars: [],
        relations: { USA: 10, CHN: 70, GBR: 15 } },
    ],
    wars: [{ id: "W-2022-01", name: "Russia-Ukraine War",
      parties: { attackers: ["RUS"], defenders: ["UKR"] },
      startYear: 2022, status: "active" as const, casualties: 150_000 }],
    alliances: [{ id: "NATO", name: "NATO", members: ["USA"], formed: 1949, type: "defense" as const, strength: 85 }],
  },
  economy: {
    year: 2026,
    nations: {
      USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 },
      CHN: { gdp: 18_000_000_000_000, gdpGrowthRate: 5.0, inflationRate: 1.5, tradeVolume: 75, unemploymentRate: 5.0 },
      RUS: { gdp: 2_000_000_000_000, gdpGrowthRate: 1.5, inflationRate: 6.0, tradeVolume: 40, unemploymentRate: 4.5 },
    },
  },
  technology: {
    year: 2026,
    nations: {
      USA: { technologyLevel: 85, rdSpending: 0.035 },
      CHN: { technologyLevel: 72, rdSpending: 0.024 },
      RUS: { technologyLevel: 55, rdSpending: 0.015 },
    },
  },
};

function makeSectorMap(): Map<string, Sector> {
  const map = new Map<string, Sector>();
  map.set("geopolitics", createGeopoliticsSector());
  map.set("economy", createEconomySector());
  map.set("technology", createTechnologySector());
  return map;
}

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createEconomySector(), createTechnologySector()];
}

beforeEach(() => {
  resetUniverseCounter();
  resetRewindCounter();
  resetBranchCounter();
});

describe("forkBranch", () => {
  it("creates a branch with proper genealogy", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 10);
    const rp = createRewindPoint(advanced, "runtime");
    const sectorMap = makeSectorMap();

    const branch = forkBranch(advanced, rp, {}, sectorMap, 5, "test branch");

    expect(branch.id).toMatch(/^B-\d{4}-\d{4}$/);
    expect(branch.parentUniverse).toBe(advanced.universe.id);
    expect(branch.rewindTick).toBe(10);
    expect(branch.intervention).toEqual({});
  });

  it("branch diverges with different tick count", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 10);
    const rp = createRewindPoint(advanced, "runtime");
    const sectorMap = makeSectorMap();

    const branch = forkBranch(advanced, rp, {}, sectorMap, 20);
    expect(branch.childSnapshot.tick).toBe(30);
  });

  it("intervention modifies sector numeric values", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 5);
    const rp = createRewindPoint(advanced, "runtime");
    const sectorMap = makeSectorMap();

    const usGdpBefore = (advanced.sectors.get("economy")!.state as EconomyState).nations["USA"]!.gdp;

    const branch = forkBranch(
      advanced, rp,
      { economy: { nations: { USA: { gdp: usGdpBefore * 2 } } } },
      sectorMap, 10,
    );

    const childGdp = branch.childSnapshot.sectors.find((s) => s.id === "economy")!.state as EconomyState;
    expect(childGdp.nations["USA"]!.gdp).toBeGreaterThan(usGdpBefore);
  });

  it("produces outcome diff with numeric deltas", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 5);
    const rp = createRewindPoint(advanced, "runtime");
    const sectorMap = makeSectorMap();

    const branch = forkBranch(advanced, rp, {}, sectorMap, 10);

    expect(branch.outcomeDiff.summary.length).toBeGreaterThan(0);
    expect(Object.keys(branch.outcomeDiff.sectorDiffs).length).toBeGreaterThan(0);
  });

  it("different interventions produce different outcomes", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 5);
    const rp = createRewindPoint(advanced, "runtime");
    const sectorMap = makeSectorMap();

    const control = forkBranch(advanced, rp, {}, sectorMap, 20);
    const treated = forkBranch(advanced, rp, { economy: { globalTradeVolume: 50 } }, sectorMap, 20);

    expect(control.childSnapshot.sectors).not.toEqual(treated.childSnapshot.sectors);
  });

  it("child universe inherits parent seed and tracks parent", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const rp = createRewindPoint(world, "runtime");
    const sectorMap = makeSectorMap();

    const branch = forkBranch(world, rp, {}, sectorMap, 5);

    expect(branch.childUniverse.rngSeed).toBe(42);
    expect(branch.childUniverse.parent).toBe(world.universe.id);
    expect(branch.childUniverse.intervention).toBe("{}");
  });
});
