import { describe, it, expect, beforeEach } from "vitest";
import { createWorld, tick, run, snapshot, restoreSnapshot } from "./world-engine.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import { resetUniverseCounter } from "./universe.js";
import type { GeopoliticsState } from "../sectors/geopolitics.js";
import type { EconomyState } from "../sectors/economy.js";
import type { Sector } from "../sectors/types.js";

const sampleConfigs: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      {
        id: "USA", name: "United States", region: "north-america",
        population: 340_000_000, gdp: 27_000_000_000_000,
        government: "democracy" as const, technologyLevel: 85, militaryPower: 90,
        healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
        alliances: ["NATO"], wars: [],
        relations: { CHN: 30, RUS: 10, GBR: 85 },
      },
      {
        id: "CHN", name: "China", region: "east-asia",
        population: 1_410_000_000, gdp: 18_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 72, militaryPower: 85,
        healthMetrics: { lifeExpectancy: 77, infantMortality: 6.8, hospitalBedsPer1000: 4.3, universalCoverage: true },
        alliances: ["SCO"], wars: [],
        relations: { USA: 30, RUS: 70, GBR: 40 },
      },
      {
        id: "RUS", name: "Russia", region: "eastern-europe",
        population: 144_000_000, gdp: 2_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 55, militaryPower: 75,
        healthMetrics: { lifeExpectancy: 70, infantMortality: 7.2, hospitalBedsPer1000: 8.0, universalCoverage: true },
        alliances: ["SCO", "CSTO"], wars: [],
        relations: { USA: 10, CHN: 70, GBR: 15 },
      },
    ],
    wars: [
      { id: "W-2022-01", name: "Russia-Ukraine War",
        parties: { attackers: ["RUS"], defenders: ["UKR"] },
        startYear: 2022, status: "active" as const, casualties: 150_000 },
    ],
    alliances: [
      { id: "NATO", name: "NATO", members: ["USA"], formed: 1949, type: "defense" as const, strength: 85 },
      { id: "SCO", name: "SCO", members: ["CHN", "RUS"], formed: 2001, type: "political" as const, strength: 60 },
    ],
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

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createEconomySector(), createTechnologySector()];
}

beforeEach(() => {
  resetUniverseCounter();
});

describe("createWorld", () => {
  it("initializes all sectors", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    expect(world.tick).toBe(0);
    expect(world.sectors.size).toBe(3);
    expect(world.sectors.has("geopolitics")).toBe(true);
    expect(world.sectors.has("economy")).toBe(true);
    expect(world.sectors.has("technology")).toBe(true);
  });

  it("creates a universe with the given seed", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 99 });
    expect(world.universe.rngSeed).toBe(99);
  });

  it("deterministic: same seed = identical world", () => {
    const a = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const b = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    expect(a.sectors.get("geopolitics")!.state).toEqual(b.sectors.get("geopolitics")!.state);
    expect(a.sectors.get("economy")!.state).toEqual(b.sectors.get("economy")!.state);
  });
});

describe("tick", () => {
  it("advances tick counter", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const next = tick(world);
    expect(next.tick).toBe(1);
  });

  it("updates sector states", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const next = tick(world);
    const geo = next.sectors.get("geopolitics")!.state as GeopoliticsState;
    expect(geo.year).toBe(2027);
    expect(geo.tickCount).toBe(1);
  });

  it("deterministic: same seed, same config, same result", () => {
    const a = run(createWorld(makeSectors(), sampleConfigs, { seed: 42 }), 10);
    const b = run(createWorld(makeSectors(), sampleConfigs, { seed: 42 }), 10);

    expect(a.tick).toBe(b.tick);
    expect(a.rngState).toEqual(b.rngState);

    const aStates = Object.fromEntries(
      [...a.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    const bStates = Object.fromEntries(
      [...b.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    expect(aStates).toEqual(bStates);
  });

  it("cross-sector: economy gdp_shift reaches geopolitics handler", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const initialGdp = (world.sectors.get("geopolitics")!.state as GeopoliticsState).nations["USA"]!.gdp;
    const next = run(world, 5);
    const finalGdp = (next.sectors.get("geopolitics")!.state as GeopoliticsState).nations["USA"]!.gdp;
    expect(finalGdp).not.toBe(initialGdp);
  });

  it("cross-sector: war_start affects economy GDP", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const initialGdp = (world.sectors.get("economy")!.state as EconomyState).nations["RUS"]!.gdp;
    const next = run(world, 20);
    const finalGdp = (next.sectors.get("economy")!.state as EconomyState).nations["RUS"]!.gdp;
    expect(finalGdp).not.toBe(initialGdp);
  });
});

describe("run", () => {
  it("advances the specified number of ticks", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const result = run(world, 50);
    expect(result.tick).toBe(50);
  });

  it("keeps sectors consistent across many ticks", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const result = run(world, 100);
    expect(result.sectors.size).toBe(3);
  });
});

describe("snapshot / restoreSnapshot", () => {
  it("snapshot captures full world state", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const snap = snapshot(world);
    expect(snap.tick).toBe(0);
    expect(snap.sectors).toHaveLength(3);
    expect(snap.universeId).toBe(world.universe.id);
  });

  it("restoreSnapshot recreates world at same tick", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const advanced = run(world, 25);
    const snap = snapshot(advanced);

    const sectorMap = new Map<string, Sector>();
    sectorMap.set("geopolitics", createGeopoliticsSector());
    sectorMap.set("economy", createEconomySector());
    sectorMap.set("technology", createTechnologySector());

    const restored = restoreSnapshot(snap, sectorMap);
    expect(restored.tick).toBe(25);
    expect(restored.sectors.get("geopolitics")!.state).toEqual(
      advanced.sectors.get("geopolitics")!.state,
    );
  });

  it("restored world produces deterministic continuation", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const advanced = run(world, 10);
    const snap = snapshot(advanced);

    const sectorMap = new Map<string, Sector>();
    sectorMap.set("geopolitics", createGeopoliticsSector());
    sectorMap.set("economy", createEconomySector());
    sectorMap.set("technology", createTechnologySector());

    const a = run(restoreSnapshot(snap, sectorMap), 10);
    const b = run(restoreSnapshot(snap, sectorMap), 10);

    expect(a.tick).toBe(b.tick);
    expect(a.rngState).toEqual(b.rngState);

    const aStates = Object.fromEntries(
      [...a.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    const bStates = Object.fromEntries(
      [...b.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    expect(aStates).toEqual(bStates);
  });

  it("deterministic: snapshot/restore preserves full trajectory", () => {
    const sectorMap = new Map<string, Sector>();
    sectorMap.set("geopolitics", createGeopoliticsSector());
    sectorMap.set("economy", createEconomySector());
    sectorMap.set("technology", createTechnologySector());

    const snap = snapshot(run(createWorld(makeSectors(), sampleConfigs, { seed: 42 }), 5));
    const r1 = run(restoreSnapshot(snap, sectorMap), 20);
    const r2 = run(restoreSnapshot(snap, sectorMap), 20);

    expect(r1.tick).toBe(r2.tick);

    const aStates = Object.fromEntries(
      [...r1.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    const bStates = Object.fromEntries(
      [...r2.sectors.entries()].map(([id, r]) => [id, r.state]),
    );
    expect(aStates).toEqual(bStates);
  });
});
