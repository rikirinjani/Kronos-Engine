import { describe, it, expect } from "vitest";
import { createGeopoliticsSector } from "./geopolitics.js";
import type { GeopoliticsState } from "./geopolitics.js";
import { createEventBus } from "./event-bus.js";
import type { RNG } from "./types.js";

function mulberry32(seed: number): RNG {
  let s = seed | 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

function makeWorldContext(tick: number, seed: number) {
  return { tick, rng: mulberry32(seed), eventBus: createEventBus() };
}

const sampleConfig = {
  year: 2026,
  nations: [
    {
      id: "USA",
      name: "United States",
      region: "north-america",
      population: 340_000_000,
      gdp: 27_000_000_000_000,
      government: "democracy" as const,
      technologyLevel: 85,
      militaryPower: 90,
      healthMetrics: {
        lifeExpectancy: 79,
        infantMortality: 5.4,
        hospitalBedsPer1000: 2.8,
        universalCoverage: false,
      },
      alliances: ["NATO"],
      wars: [],
      relations: { CHN: 30, RUS: 10, GBR: 85 },
    },
    {
      id: "CHN",
      name: "China",
      region: "east-asia",
      population: 1_410_000_000,
      gdp: 18_000_000_000_000,
      government: "autocracy" as const,
      technologyLevel: 72,
      militaryPower: 85,
      healthMetrics: {
        lifeExpectancy: 77,
        infantMortality: 6.8,
        hospitalBedsPer1000: 4.3,
        universalCoverage: true,
      },
      alliances: ["SCO"],
      wars: [],
      relations: { USA: 30, RUS: 70, GBR: 40 },
    },
    {
      id: "RUS",
      name: "Russia",
      region: "eastern-europe",
      population: 144_000_000,
      gdp: 2_000_000_000_000,
      government: "autocracy" as const,
      technologyLevel: 55,
      militaryPower: 75,
      healthMetrics: {
        lifeExpectancy: 70,
        infantMortality: 7.2,
        hospitalBedsPer1000: 8.0,
        universalCoverage: true,
      },
      alliances: ["SCO", "CSTO"],
      wars: [],
      relations: { USA: 10, CHN: 70, GBR: 15 },
    },
    {
      id: "GBR",
      name: "United Kingdom",
      region: "western-europe",
      population: 68_000_000,
      gdp: 3_300_000_000_000,
      government: "democracy" as const,
      technologyLevel: 80,
      militaryPower: 50,
      healthMetrics: {
        lifeExpectancy: 81,
        infantMortality: 3.7,
        hospitalBedsPer1000: 2.5,
        universalCoverage: true,
      },
      alliances: ["NATO", "G7"],
      wars: [],
      relations: { USA: 85, CHN: 40, RUS: 15 },
    },
  ],
  wars: [
    {
      id: "W-2022-01",
      name: "Russia-Ukraine War",
      parties: { attackers: ["RUS"], defenders: ["UKR"] },
      startYear: 2022,
      status: "active" as const,
      casualties: 150_000,
    },
  ],
  alliances: [
    {
      id: "NATO",
      name: "North Atlantic Treaty Organization",
      members: ["USA", "GBR"],
      formed: 1949,
      type: "defense" as const,
      strength: 85,
    },
    {
      id: "SCO",
      name: "Shanghai Cooperation Organisation",
      members: ["CHN", "RUS"],
      formed: 2001,
      type: "political" as const,
      strength: 60,
    },
  ],
  globalState: {
    totalPopulation: 8_200_000_000,
    avgTechnologyLevel: 50,
    avgHealthOutcome: 73,
    co2Emissions: 37_000_000_000,
    tradeVolume: 100,
  },
};

describe("GeopoliticsSector", () => {
  it("init creates state from config", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;

    expect(state._sectorId).toBe("geopolitics");
    expect(state.year).toBe(2026);
    expect(state.tickCount).toBe(0);
    expect(Object.keys(state.nations)).toHaveLength(4);
    expect(Object.keys(state.wars)).toHaveLength(1);
    expect(Object.keys(state.alliances)).toHaveLength(2);
  });

  it("tick advances year and tickCount", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as GeopoliticsState;

    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick drifts diplomatic relations", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as GeopoliticsState;
    const usaChn = next.nations["USA"]!.relations["CHN"]!;

    expect(usaChn).not.toBe(30);
  });

  it("tick publishes relation_shift events when drift >= 5", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const shifts = ctx.eventBus.pending().filter((e) => e.type === "geopolitics.relation_shift");
    expect(shifts.length).toBeGreaterThan(0);
  });

  it("tick may start new wars when relations are low", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as GeopoliticsState;

    const warStarts = ctx.eventBus.pending().filter((e) => e.type === "geopolitics.war_start");
    if (warStarts.length > 0) {
      const newWarId = warStarts[0]!.data.warId as string;
      expect(next.wars[newWarId]).toBeDefined();
      expect(next.wars[newWarId]!.status).toBe("active");
    }
  });

  it("tick increments casualties for active wars", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as GeopoliticsState;

    expect(next.wars["W-2022-01"]!.casualties).toBeGreaterThan(150_000);
  });

  it("deterministic: same seed + same state = same result", () => {
    const sector = createGeopoliticsSector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;

    const ctxA = makeWorldContext(1, 42);
    const ctxB = makeWorldContext(1, 42);

    const nextA = sector.tick(stateA, ctxA) as GeopoliticsState;
    const nextB = sector.tick(stateB, ctxB) as GeopoliticsState;

    expect(nextA).toEqual(nextB);
  });

  it("publishes war_casualties events for active wars", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const casEvents = ctx.eventBus.pending().filter((e) => e.type === "geopolitics.war_casualties");
    expect(casEvents.length).toBeGreaterThan(0);
    for (const evt of casEvents) {
      expect(evt.data.casualtiesDelta).toBeGreaterThan(0);
    }
  });

  it("handles economy.gdp_shift event", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "economy.gdp_shift")!;
    const updated = handler.handle(
      { type: "economy.gdp_shift", source: "economy", data: { nationId: "USA", gdpDelta: 500_000_000_000 }, tick: 1 },
      state
    ) as GeopoliticsState;

    expect(updated.nations["USA"]!.gdp).toBe(27_500_000_000_000);
  });

  it("defaults casualtyMultiplier to 1", () => {
    const sector = createGeopoliticsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as GeopoliticsState;
    expect(state.casualtyMultiplier).toBe(1);
  });

  it("casualtyMultiplier from config is stored in state", () => {
    const sector = createGeopoliticsSector();
    const config = { ...sampleConfig, casualtyMultiplier: 2500 };
    const state = sector.init(42, config as unknown as Record<string, unknown>) as GeopoliticsState;
    expect(state.casualtyMultiplier).toBe(2500);
  });
});
