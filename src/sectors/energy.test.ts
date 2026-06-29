import { describe, it, expect } from "vitest";
import { createEnergySector } from "./energy.js";
import type { EnergyState } from "./energy.js";
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
    USA: { energyMix: { oil: 35, gas: 30, coal: 10, nuclear: 10, renewable: 15 }, totalConsumption: 100, energyPrice: 100, energySecurity: 80, co2Intensity: 0.4 },
    CHN: { energyMix: { oil: 20, gas: 10, coal: 50, nuclear: 5, renewable: 15 }, totalConsumption: 150, energyPrice: 90, energySecurity: 60, co2Intensity: 0.7 },
    RUS: { energyMix: { oil: 40, gas: 35, coal: 15, nuclear: 5, renewable: 5 }, totalConsumption: 60, energyPrice: 70, energySecurity: 90, co2Intensity: 0.5 },
  },
};

describe("EnergySector", () => {
  it("init creates state from config", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    expect(state._sectorId).toBe("energy");
    expect(state.year).toBe(2026);
    expect(Object.keys(state.nations)).toHaveLength(3);
    expect(state.globalEnergyPrice).toBe(100);
    expect(state.globalRenewableShare).toBe(15);
  });

  it("tick advances year and tickCount", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const next = sector.tick(state, makeWorldContext(1, 42)) as EnergyState;
    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick drifts prices and consumption", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const next = sector.tick(state, makeWorldContext(1, 42)) as EnergyState;
    expect(next.nations["USA"]!.energyPrice).not.toBe(100);
    expect(next.nations["USA"]!.totalConsumption).not.toBe(100);
  });

  it("publishes energy events during tick", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const ctx = makeWorldContext(1, 42);
    sector.tick(state, ctx);
    const priceEvents = ctx.eventBus.pending().filter((e) => e.type === "energy.price_shift");
    expect(priceEvents.length).toBeGreaterThan(0);
  });

  it("handles geopolitics.war_start by reducing energy security", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const handler = sector.handlers.find((h) => h.eventType === "geopolitics.war_start")!;
    const updated = handler.handle(
      { type: "geopolitics.war_start", source: "geopolitics", data: { warId: "W-1", name: "Test War", attackers: ["RUS"], defenders: ["USA"], year: 2026 }, tick: 1 },
      state,
    ) as EnergyState;
    expect(updated.nations["RUS"]!.energySecurity).toBeLessThan(90);
    expect(updated.nations["USA"]!.energyPrice).toBeGreaterThan(100);
    expect(updated.globalEnergyPrice).toBeGreaterThan(100);
  });

  it("handles climate.extreme_weather by spiking prices", () => {
    const sector = createEnergySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const handler = sector.handlers.find((h) => h.eventType === "climate.extreme_weather")!;
    const updated = handler.handle(
      { type: "climate.extreme_weather", source: "climate", data: { weatherType: "hurricane", region: "north-america", severity: 4, year: 2026 }, tick: 1 },
      state,
    ) as EnergyState;
    expect(updated.nations["USA"]!.energyPrice).toBeGreaterThan(100);
  });

  it("deterministic with same seed", () => {
    const sector = createEnergySector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as EnergyState;
    const nextA = sector.tick(stateA, makeWorldContext(1, 42)) as EnergyState;
    const nextB = sector.tick(stateB, makeWorldContext(1, 42)) as EnergyState;
    expect(nextA).toEqual(nextB);
  });

  it("defaults to sensible values", () => {
    const sector = createEnergySector();
    const state = sector.init(42, { nations: { USA: {} } }) as EnergyState;
    expect(state.nations["USA"]!.energyMix.renewable).toBe(15);
    expect(state.nations["USA"]!.energyPrice).toBe(100);
    expect(state.nations["USA"]!.energySecurity).toBe(70);
  });
});
