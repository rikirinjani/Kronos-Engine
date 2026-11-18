import { describe, it, expect } from "vitest";
import { createEconomySector } from "./economy.js";
import type { EconomyState } from "./economy.js";
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
  nations: {
    USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 },
    CHN: { gdp: 18_000_000_000_000, gdpGrowthRate: 5.0, inflationRate: 1.5, tradeVolume: 75, unemploymentRate: 5.0 },
    RUS: { gdp: 2_000_000_000_000, gdpGrowthRate: 1.5, inflationRate: 6.0, tradeVolume: 40, unemploymentRate: 4.5 },
    GBR: { gdp: 3_300_000_000_000, gdpGrowthRate: 1.8, inflationRate: 2.5, tradeVolume: 70, unemploymentRate: 4.0 },
  },
};

describe("EconomySector", () => {
  it("init creates state from config", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;

    expect(state._sectorId).toBe("economy");
    expect(state.year).toBe(2026);
    expect(state.tickCount).toBe(0);
    expect(Object.keys(state.nations)).toHaveLength(4);
    expect(state.nations["USA"]!.gdp).toBe(27_000_000_000_000);
    expect(state.marketIndex).toBe(100);
  });

  it("tick advances year and tickCount", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as EconomyState;

    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick grows GDP", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as EconomyState;

    expect(next.nations["USA"]!.gdp).toBeGreaterThan(27_000_000_000_000);
    expect(next.nations["CHN"]!.gdp).toBeGreaterThan(18_000_000_000_000);
  });

  it("tick drifts inflation rates", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as EconomyState;

    expect(next.nations["USA"]!.inflationRate).not.toBe(3.0);
    expect(next.nations["USA"]!.inflationRate).toBeGreaterThan(-2);
    expect(next.nations["USA"]!.inflationRate).toBeLessThanOrEqual(20);
  });

  it("publishes economy events during tick", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const gdpEvents = ctx.eventBus.pending().filter((e) => e.type === "economy.gdp_shift");
    expect(gdpEvents.length).toBeGreaterThan(0);
  });

  it("handles geopolitics.war_start: attacker GDP increases, defender GDP drops", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "geopolitics.war_start")!;
    const updated = handler.handle(
      {
        type: "geopolitics.war_start",
        source: "geopolitics",
        data: { warId: "W-1", name: "Test War", attackers: ["RUS"], defenders: ["GBR"], year: 2026 },
        tick: 1,
      },
      state
    ) as EconomyState;

    expect(updated.nations["RUS"]!.gdp).toBeGreaterThan(2_000_000_000_000);
    expect(updated.nations["RUS"]!.gdpGrowthRate).toBeGreaterThan(1.5);
    expect(updated.nations["GBR"]!.gdp).toBeLessThan(3_300_000_000_000);
    expect(updated.nations["GBR"]!.gdp).toBeCloseTo(2_805_000_000_000, -9);
    expect(updated.nations["USA"]!.gdp).toBe(27_000_000_000_000);
  });

  it("handles climate.extreme_weather by reducing GDP", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "climate.extreme_weather")!;
    const updated = handler.handle(
      {
        type: "climate.extreme_weather",
        source: "climate",
        data: { weatherType: "hurricane", region: "north-america", severity: 3, year: 2026 },
        tick: 1,
      },
      state
    ) as EconomyState;

    expect(updated.nations["USA"]!.gdp).toBeLessThan(27_000_000_000_000);
  });

  it("deterministic: same seed + same state = same result", () => {
    const sector = createEconomySector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;

    const ctxA = makeWorldContext(1, 42);
    const ctxB = makeWorldContext(1, 42);

    const nextA = sector.tick(stateA, ctxA) as EconomyState;
    const nextB = sector.tick(stateB, ctxB) as EconomyState;

    expect(nextA).toEqual(nextB);
  });

  it("defaults to sensible values when config is minimal", () => {
    const sector = createEconomySector();
    const state = sector.init(42, { nations: { USA: {} } }) as EconomyState;

    expect(state.nations["USA"]!.gdp).toBe(1_000_000_000_000);
    expect(state.nations["USA"]!.gdpGrowthRate).toBe(2.5);
    expect(state.globalTradeVolume).toBe(100);
    expect(state.marketIndex).toBe(100);
  });

  it("handles geopolitics.war_casualties without wars[] filter", () => {
    const sector = createEconomySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EconomyState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "geopolitics.war_casualties")!;
    const updated = handler.handle(
      {
        type: "geopolitics.war_casualties",
        source: "geopolitics",
        data: { warId: "W-2022-01", casualtiesDelta: 1000, total: 151_000 },
        tick: 1,
      },
      state
    ) as EconomyState;

    expect(updated.nations["USA"]!.gdp).toBeLessThan(27_000_000_000_000);
    expect(updated.nations["USA"]!.gdp).toBeGreaterThan(26_000_000_000_000);
    expect(updated.nations["CHN"]!.gdp).toBeLessThan(18_000_000_000_000);
  });
});
