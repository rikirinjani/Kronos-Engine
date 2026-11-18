import { describe, it, expect, beforeEach } from "vitest";
import { hashState, canonicalStringify } from "./hash.js";
import { createWorld } from "../engine/world-engine.js";
import type { WorldState } from "../engine/world-engine.js";
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
        population: 340_000_000, gdp: 1e12,
        government: "democracy" as const, technologyLevel: 85, militaryPower: 90,
        healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
        alliances: ["NATO"], wars: [],
        relations: { CHN: 30, RUS: 10, GBR: 85 } },
    ],
    wars: [],
    alliances: [],
  },
  economy: {
    year: 2026,
    nations: {
      USA: { gdp: 1e12, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 },
    },
  },
  technology: {
    year: 2026,
    nations: {
      USA: { technologyLevel: 85, rdSpending: 0.035 },
    },
  },
};

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createEconomySector(), createTechnologySector()];
}

interface HashableWorld {
  tick: number;
  sectorStates: Record<string, unknown>;
  rngState: { seed: number; callCount: number };
}

function makeHashable(world: WorldState): HashableWorld {
  return {
    tick: world.tick,
    sectorStates: Object.fromEntries(
      [...world.sectors.entries()].map(([id, record]) => [id, record.state]),
    ),
    rngState: world.rngState,
  };
}

function cloneHashable(base: HashableWorld): HashableWorld {
  return JSON.parse(JSON.stringify(base)) as HashableWorld;
}

beforeEach(() => {
  resetUniverseCounter();
});

describe("hashState — nested-content sensitivity (Bug 1 regression)", () => {
  it("is identical for identical world content built independently", () => {
    const a = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    const b = createWorld(makeSectors(), sampleConfigs, { seed: 42 });
    expect(hashState(makeHashable(a))).toBe(hashState(makeHashable(b)));
  });

  it("changes when a deeply-nested sector value changes (gdp 1e12 -> 999999)", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const base = makeHashable(world);
    const before = hashState(base);

    const modified = cloneHashable(base);
    const nations = modified.sectorStates.geopolitics as {
      nations: Record<string, { gdp: number }>;
    };
    nations.nations["USA"]!.gdp = 999_999;

    expect(hashState(modified)).not.toBe(before);
  });

  it("changes when rngState changes (seed 42 -> 43)", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const base = makeHashable(world);
    const before = hashState(base);

    const modified = cloneHashable(base);
    modified.rngState.seed = 43;

    expect(hashState(modified)).not.toBe(before);
  });

  it("changes when a nested sector state is emptied (economy.nations = {})", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const base = makeHashable(world);
    const before = hashState(base);

    const modified = cloneHashable(base);
    (modified.sectorStates.economy as { nations: unknown }).nations = {};

    expect(hashState(modified)).not.toBe(before);
  });

  it("changes when sectorStates is emptied entirely", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const base = makeHashable(world);
    const before = hashState(base);

    const modified = cloneHashable(base);
    modified.sectorStates = {};

    expect(hashState(modified)).not.toBe(before);
  });

  it("changes when a nested array element changes (nation alliances)", () => {
    const world = createWorld(makeSectors(), sampleConfigs);
    const base = makeHashable(world);
    const before = hashState(base);

    const modified = cloneHashable(base);
    const nations = modified.sectorStates.geopolitics as {
      nations: Record<string, { alliances: string[] }>;
    };
    nations.nations["USA"]!.alliances.push("PACT");

    expect(hashState(modified)).not.toBe(before);
  });
});

describe("hashState — determinism", () => {
  it("is independent of object key insertion order (nested too)", () => {
    const a = { b: 2, a: { d: 4, c: 3 }, arr: [1, 2], n: null, flag: true };
    const b = { flag: true, n: null, arr: [1, 2], a: { c: 3, d: 4 }, b: 2 };
    expect(hashState(a)).toBe(hashState(b));
  });

  it("preserves array order (arrays are never sorted)", () => {
    expect(hashState({ a: [1, 2, 3] })).not.toBe(hashState({ a: [3, 2, 1] }));
    expect(hashState({ a: [1, 2, 3] })).toBe(hashState({ a: [1, 2, 3] }));
  });

  it("serializes Map deterministically regardless of insertion order", () => {
    const m1 = new Map<string, number>([["a", 1], ["b", 2]]);
    const m2 = new Map<string, number>([["b", 2], ["a", 1]]);
    expect(hashState(m1)).toBe(hashState(m2));
    expect(hashState(m1)).not.toBe(hashState(new Map<string, number>([["a", 2], ["b", 2]])));
  });

  it("serializes Set deterministically regardless of insertion order", () => {
    const s1 = new Set([1, 2, 3]);
    const s2 = new Set([3, 1, 2]);
    expect(hashState(s1)).toBe(hashState(s2));
    expect(hashState(s1)).not.toBe(hashState(new Set([1, 2, 4])));
  });

  it("distinguishes Map from Set and from plain objects", () => {
    const map = new Map<string, number>([["a", 1]]);
    const set = new Set([1]);
    expect(hashState(map)).not.toBe(hashState(set));
    expect(hashState(map)).not.toBe(hashState({ a: 1 }));
    expect(hashState(set)).not.toBe(hashState({ a: 1 }));
  });

  it("handles primitives without collisions", () => {
    expect(hashState(null)).not.toBe(hashState("null"));
    expect(hashState(true)).not.toBe(hashState("true"));
    expect(hashState(1)).not.toBe(hashState("1"));
    expect(hashState(NaN)).not.toBe(hashState(null));
    expect(hashState(undefined)).not.toBe(hashState("undefined"));
  });
});

describe("canonicalStringify", () => {
  it("produces sorted, full-content output", () => {
    expect(canonicalStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(
      `object:{"a":object:{"c":number:3,"d":number:2},"b":number:1}`,
    );
  });
});
