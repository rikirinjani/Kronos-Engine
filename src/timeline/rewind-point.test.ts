import { describe, it, expect, beforeEach } from "vitest";
import { createRewindPoint, createInMemoryStore, resetRewindCounter, rewindToSnapshot } from "./rewind-point.js";
import { createWorld, run, restoreSnapshot } from "../engine/world-engine.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import { resetUniverseCounter } from "../engine/universe.js";
import type { Sector } from "../sectors/types.js";

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

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createEconomySector(), createTechnologySector()];
}

beforeEach(() => {
  resetUniverseCounter();
  resetRewindCounter();
});

describe("createRewindPoint", () => {
  it("captures full world state at current tick", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");

    expect(rp.tick).toBe(0);
    expect(rp.universeId).toBe(world.universe.id);
    expect(Object.keys(rp.sectorStates)).toHaveLength(3);
    expect(rp.origin).toBe("runtime");
  });

  it("generates a deterministic state hash", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");

    expect(rp.stateHash).toMatch(/^[0-9a-f]{8}$/);
    expect(rp.stateHash.length).toBe(8);
  });

  it("same world state produces same hash", () => {
    const a = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const b = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const rpA = createRewindPoint(a, "runtime");
    const rpB = createRewindPoint(b, "runtime");
    expect(rpA.stateHash).toBe(rpB.stateHash);
  });

  it("stores RNG state for deterministic replay", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const advanced = run(world, 10);
    const rp = createRewindPoint(advanced, "runtime");

    expect(rp.rngState.seed).toBe(42);
    expect(rp.rngState.callCount).toBeGreaterThan(0);
  });

  it("different tick produces different hash", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp0 = createRewindPoint(world, "runtime");
    const advanced = run(world, 5);
    const rp5 = createRewindPoint(advanced, "runtime");
    expect(rp0.stateHash).not.toBe(rp5.stateHash);
  });

  it("accepts optional label and tags", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime", {
      label: "Pre-crisis baseline",
      tags: ["baseline", "experiment-control"],
    });
    expect(rp.label).toBe("Pre-crisis baseline");
    expect(rp.tags).toEqual(["baseline", "experiment-control"]);
  });
});

describe("createInMemoryStore", () => {
  it("stores and retrieves rewind points", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");
    store.add(rp);

    const retrieved = store.get(rp.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(rp.id);
  });

  it("finds rewind points by tick", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");
    store.add(rp);

    const found = store.findByTick(0, world.universe.id);
    expect(found).toHaveLength(1);
    expect(found[0]!.id).toBe(rp.id);
  });

  it("finds rewind points by universe", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    store.add(createRewindPoint(world, "runtime", { label: "t0" }));
    const adv = run(world, 10);
    store.add(createRewindPoint(adv, "runtime", { label: "t10" }));

    const found = store.findByUniverse(world.universe.id);
    expect(found).toHaveLength(2);
  });

  it("verify returns true for unmodified rewind points", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");
    store.add(rp);

    expect(store.verify(rp.id)).toBe(true);
  });

  it("verify returns false for tampered rewind points", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(world, "runtime");
    store.add(rp);

    rp.tick = 999;
    expect(store.verify(rp.id)).toBe(false);
  });

  it("lists all stored rewind points", () => {
    const store = createInMemoryStore();
    const world = createWorld(makeSectors(), sampleConfigs);
    store.add(createRewindPoint(world, "runtime"));
    store.add(createRewindPoint(run(world, 5), "runtime"));
    store.add(createRewindPoint(run(world, 10), "runtime"));

    expect(store.list()).toHaveLength(3);
  });
});

describe("rewindToSnapshot", () => {
  it("converts a rewind point into a usable snapshot", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const rp = createRewindPoint(run(world, 15), "runtime");
    const snap = rewindToSnapshot(rp);

    expect(snap.tick).toBe(15);
    expect(snap.rngState).toEqual(rp.rngState);
    expect(snap.sectors).toHaveLength(3);
    expect(snap.universeId).toBe(rp.universeId);
  });

  it("snapshot can be restored and continued", () => {
    const world = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const rp = createRewindPoint(run(world, 10), "runtime");
    const snap = rewindToSnapshot(rp);

    const sectorMap = new Map<string, Sector>();
    sectorMap.set("geopolitics", createGeopoliticsSector());
    sectorMap.set("economy", createEconomySector());
    sectorMap.set("technology", createTechnologySector());

    const restored = restoreSnapshot(snap, sectorMap);
    expect(restored.tick).toBe(10);
  });
});
