import { describe, it, expect } from "vitest";
import { createDemographicsSector } from "./demographics.js";
import type { DemographicsState } from "./demographics.js";
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
    USA: { population: 335_000_000, birthRate: 11, deathRate: 9, medianAge: 38, dependencyRatio: 55, laborForceParticipation: 62, netMigration: 50000 },
    CHN: { population: 1_410_000_000, birthRate: 8, deathRate: 10, medianAge: 40, dependencyRatio: 45, laborForceParticipation: 68, netMigration: -20000 },
    IDN: { population: 280_000_000, birthRate: 16, deathRate: 7, medianAge: 31, dependencyRatio: 48, laborForceParticipation: 67, netMigration: -10000 },
  },
};

describe("DemographicsSector", () => {
  it("init creates state from config", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    expect(state._sectorId).toBe("demographics");
    expect(state.year).toBe(2026);
    expect(Object.keys(state.nations)).toHaveLength(3);
    expect(state.globalPopulation).toBeGreaterThan(0);
    expect(state.globalMedianAge).toBeGreaterThan(0);
  });

  it("tick advances year and tickCount", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const next = sector.tick(state, makeWorldContext(1, 42)) as DemographicsState;
    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick changes population", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const next = sector.tick(state, makeWorldContext(1, 42)) as DemographicsState;
    expect(next.nations["USA"]!.population).not.toBe(335_000_000);
    expect(next.nations["IDN"]!.medianAge).toBeGreaterThanOrEqual(30);
  });

  it("publishes demographics events during tick", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const ctx = makeWorldContext(1, 42);
    sector.tick(state, ctx);
    const popEvents = ctx.eventBus.pending().filter((e) => e.type.startsWith("demographics."));
    expect(popEvents.length).toBeGreaterThan(0);
  });

  it("handles geopolitics.war_start by reducing population", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const handler = sector.handlers.find((h) => h.eventType === "geopolitics.war_start")!;
    const updated = handler.handle(
      { type: "geopolitics.war_start", source: "geopolitics", data: { warId: "W-1", name: "Test War", attackers: ["CHN"], defenders: ["IDN"], year: 2026 }, tick: 1 },
      state,
    ) as DemographicsState;
    expect(updated.nations["CHN"]!.population).toBeLessThan(1_410_000_000);
    expect(updated.nations["USA"]!.population).toBe(335_000_000);
  });

  it("handles economy.gdp_shift by adjusting migration", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const handler = sector.handlers.find((h) => h.eventType === "economy.gdp_shift")!;
    const updated = handler.handle(
      { type: "economy.gdp_shift", source: "economy", data: { nationId: "USA", gdpDelta: 500_000_000_000, oldGdp: 27_000_000_000_000, newGdp: 27_500_000_000_000 }, tick: 1 },
      state,
    ) as DemographicsState;
    expect(updated.nations["USA"]!.netMigration).toBeGreaterThan(50000);
  });

  it("deterministic with same seed", () => {
    const sector = createDemographicsSector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as DemographicsState;
    const nextA = sector.tick(stateA, makeWorldContext(1, 42)) as DemographicsState;
    const nextB = sector.tick(stateB, makeWorldContext(1, 42)) as DemographicsState;
    expect(nextA).toEqual(nextB);
  });

  it("defaults to sensible values", () => {
    const sector = createDemographicsSector();
    const state = sector.init(42, { nations: { USA: {} } }) as DemographicsState;
    expect(state.nations["USA"]!.population).toBe(10_000_000);
    expect(state.nations["USA"]!.medianAge).toBe(35);
    expect(state.nations["USA"]!.laborForceParticipation).toBe(65);
  });
});
