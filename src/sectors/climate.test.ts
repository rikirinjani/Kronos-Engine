import { describe, it, expect } from "vitest";
import { createClimateSector } from "./climate.js";
import type { ClimateState } from "./climate.js";
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
  co2Concentration: 420,
  annualEmissions: 37,
};

describe("ClimateSector", () => {
  it("init creates state from config", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;

    expect(state._sectorId).toBe("climate");
    expect(state.year).toBe(2026);
    expect(state.tickCount).toBe(0);
    expect(state.co2Concentration).toBe(420);
    expect(state.annualEmissions).toBe(37);
    expect(state.temperatureAnomaly).toBeCloseTo(1.75, 1);
    expect(state.extremeEvents).toHaveLength(0);
  });

  it("tick advances year and tickCount", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as ClimateState;

    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick increases CO2 concentration and temperature", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as ClimateState;

    expect(next.co2Concentration).toBeGreaterThan(420);
    expect(next.temperatureAnomaly).toBeGreaterThan(state.temperatureAnomaly);
  });

  it("tick increases sea level", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as ClimateState;

    expect(next.seaLevelRise).toBeGreaterThan(0);
  });

  it("tick publishes temp_shift event", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const events = ctx.eventBus.pending().filter((e) => e.type === "climate.temp_shift");
    expect(events.length).toBeGreaterThan(0);
    const evt = events[0]!;
    expect(evt.data.oldAnomaly).toBeGreaterThan(0);
    expect(evt.data.newAnomaly).toBeGreaterThan(evt.data.oldAnomaly as number);
  });

  it("may publish extreme_weather events", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const events = ctx.eventBus.pending().filter((e) => e.type === "climate.extreme_weather");
    if (events.length > 0) {
      expect(events[0]!.data.weatherType).toBeDefined();
      expect(events[0]!.data.severity).toBeGreaterThan(0);
    }
  });

  it("deterministic: same seed + same state = same result", () => {
    const sector = createClimateSector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;

    const ctxA = makeWorldContext(1, 42);
    const ctxB = makeWorldContext(1, 42);

    const nextA = sector.tick(stateA, ctxA) as ClimateState;
    const nextB = sector.tick(stateB, ctxB) as ClimateState;

    expect(nextA).toEqual(nextB);
  });

  it("handles economy.gdp_shift event to adjust emissions", () => {
    const sector = createClimateSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as ClimateState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "economy.gdp_shift")!;
    const updated = handler.handle(
      { type: "economy.gdp_shift", source: "economy", data: { nationId: "USA", gdpDelta: 1_000_000_000_000 }, tick: 1 },
      state
    ) as ClimateState;

    expect(updated.annualEmissions).toBeGreaterThan(37);
  });

  it("defaults to 2026 baseline values when config is empty", () => {
    const sector = createClimateSector();
    const state = sector.init(42, {}) as ClimateState;

    expect(state.year).toBe(2026);
    expect(state.co2Concentration).toBe(420);
    expect(state.annualEmissions).toBe(37);
  });
});
