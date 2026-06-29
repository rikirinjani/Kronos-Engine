import { describe, it, expect } from "vitest";
import { createTechnologySector } from "./technology.js";
import type { TechnologyState } from "./technology.js";
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
    USA: { technologyLevel: 85, rdSpending: 0.035 },
    CHN: { technologyLevel: 72, rdSpending: 0.024 },
    GBR: { technologyLevel: 80, rdSpending: 0.028 },
    RUS: { technologyLevel: 55, rdSpending: 0.015 },
    IDN: { technologyLevel: 45, rdSpending: 0.008 },
  },
};

describe("TechnologySector", () => {
  it("init creates state from config", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;

    expect(state._sectorId).toBe("technology");
    expect(state.year).toBe(2026);
    expect(state.tickCount).toBe(0);
    expect(Object.keys(state.nations)).toHaveLength(5);
    expect(state.nations["USA"]!.technologyLevel).toBe(85);
    expect(state.globalTechLevel).toBeCloseTo(67.4, 0);
  });

  it("tick advances year and tickCount", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as TechnologyState;

    expect(next.tickCount).toBe(1);
    expect(next.year).toBe(2027);
  });

  it("tick increases technology levels", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as TechnologyState;

    const expected: Record<string, number> = { USA: 85, CHN: 72, GBR: 80, RUS: 55, IDN: 45 };
    for (const [id, level] of Object.entries(expected)) {
      expect(next.nations[id]!.technologyLevel).toBeGreaterThanOrEqual(level);
    }
  });

  it("tick accumulates patents", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as TechnologyState;

    expect(next.nations["USA"]!.patents).toBeGreaterThan(0);
    expect(next.nations["IDN"]!.patents).toBeGreaterThan(0);
  });

  it("may publish innovation events", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const ctx = makeWorldContext(1, 42);

    const next = sector.tick(state, ctx) as TechnologyState;

    const innovations = ctx.eventBus.pending().filter((e) => e.type === "technology.innovation");
    if (innovations.length > 0) {
      expect(innovations[0]!.data.innovation).toBeDefined();
      expect(innovations[0]!.data.nationId).toBeDefined();
    }
    if (next.recentInnovations.length > 0) {
      expect(next.recentInnovations[0]).toContain(":");
    }
  });

  it("publishes diffusion events when tech gap exists", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const ctx = makeWorldContext(1, 42);

    sector.tick(state, ctx);

    const diffusions = ctx.eventBus.pending().filter((e) => e.type === "technology.diffusion");
    expect(diffusions.length).toBeGreaterThan(0);
    for (const evt of diffusions) {
      expect(evt.data.amount).toBeGreaterThan(0);
    }
  });

  it("handles economy.gdp_shift event", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const bus = createEventBus();
    const ctx = { tick: 1, rng: mulberry32(42), eventBus: bus };

    const handler = sector.handlers.find((h) => h.eventType === "economy.gdp_shift")!;
    const initialOutput = state.nations["USA"]!.researchOutput;
    const updated = handler.handle(
      { type: "economy.gdp_shift", source: "economy", data: { nationId: "USA", gdpDelta: 1_000_000_000_000 }, tick: 1 },
      state
    ) as TechnologyState;

    expect(updated.nations["USA"]!.researchOutput).toBeGreaterThan(initialOutput);
  });

  it("deterministic: same seed + same state = same result", () => {
    const sector = createTechnologySector();
    const stateA = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;
    const stateB = sector.init(42, sampleConfig as unknown as Record<string, unknown>) as TechnologyState;

    const ctxA = makeWorldContext(1, 42);
    const ctxB = makeWorldContext(1, 42);

    const nextA = sector.tick(stateA, ctxA) as TechnologyState;
    const nextB = sector.tick(stateB, ctxB) as TechnologyState;

    expect(nextA).toEqual(nextB);
  });

  it("defaults to sensible values when config is minimal", () => {
    const sector = createTechnologySector();
    const state = sector.init(42, { nations: { USA: {} } }) as TechnologyState;

    expect(state.nations["USA"]!.technologyLevel).toBe(50);
    expect(state.nations["USA"]!.rdSpending).toBe(0.02);
    expect(state.globalTechLevel).toBe(50);
  });
});
