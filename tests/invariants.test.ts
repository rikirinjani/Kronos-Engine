import { describe, it, expect } from "vitest";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import type { GeopoliticsState } from "../src/sectors/geopolitics.js";
import { createClimateSector } from "../src/sectors/climate.js";
import type { ClimateState } from "../src/sectors/climate.js";
import { createEconomySector } from "../src/sectors/economy.js";
import type { EconomyState } from "../src/sectors/economy.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import type { TechnologyState } from "../src/sectors/technology.js";
import { createWorld, run } from "../src/engine/index.js";
import { createEventBus } from "../src/sectors/event-bus.js";
import { resetUniverseCounter } from "../src/engine/universe.js";
import type { RNG } from "../src/sectors/types.js";

function mulberry32(seed: number): RNG {
  let s = seed | 0;
  return { next: () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}

function makeWorldContext(tick: number, seed: number) {
  return { tick, rng: mulberry32(seed), eventBus: createEventBus() };
}

describe("Geopolitics Invariants", () => {
  it("relations stay within [-100, 100]", () => {
    const sector = createGeopoliticsSector();
    let state = sector.init(42, {
      year: 2026,
      nations: [
        { id: "USA", name: "USA", region: "na", population: 1, gdp: 1, government: "democracy", technologyLevel: 50, militaryPower: 50, healthMetrics: { lifeExpectancy: 70, infantMortality: 10, hospitalBedsPer1000: 2, universalCoverage: false }, alliances: [], wars: [], relations: { CHN: 0 } },
        { id: "CHN", name: "CHN", region: "ea", population: 1, gdp: 1, government: "autocracy", technologyLevel: 50, militaryPower: 50, healthMetrics: { lifeExpectancy: 70, infantMortality: 10, hospitalBedsPer1000: 2, universalCoverage: true }, alliances: [], wars: [], relations: { USA: 0 } },
      ],
      wars: [],
      alliances: [],
    }) as GeopoliticsState;

    for (let i = 0; i < 30; i++) {
      state = sector.tick(state, makeWorldContext(i + 1, 42)) as GeopoliticsState;
    }

    for (const n of Object.values(state.nations)) {
      for (const v of Object.values(n.relations)) {
        expect(v).toBeGreaterThanOrEqual(-100);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("war casualties never decrease", () => {
    const sector = createGeopoliticsSector();
    let state = sector.init(42, {
      year: 2026,
      nations: [],
      wars: [{ id: "W-1", name: "War", parties: { attackers: ["A"], defenders: ["B"] }, startYear: 2026, status: "active", casualties: 0 }],
      alliances: [],
    }) as GeopoliticsState;

    for (let i = 0; i < 20; i++) {
      const next = sector.tick(state, makeWorldContext(i + 1, 42)) as GeopoliticsState;
      for (const [id, war] of Object.entries(next.wars)) {
        const prev = state.wars[id];
        if (prev && war.status === "active") {
          expect(war.casualties).toBeGreaterThanOrEqual(prev.casualties);
        }
      }
      state = next;
    }
  });
});

describe("Climate Invariants", () => {
  it("CO2 concentration never decreases", () => {
    const sector = createClimateSector();
    let state = sector.init(42, { year: 2026, co2Concentration: 420, annualEmissions: 37 }) as ClimateState;

    for (let i = 0; i < 30; i++) {
      const next = sector.tick(state, makeWorldContext(i + 1, 42)) as ClimateState;
      expect(next.co2Concentration).toBeGreaterThanOrEqual(state.co2Concentration);
      state = next;
    }
  });

  it("annual emissions never go negative", () => {
    const sector = createClimateSector();
    let state = sector.init(42, { year: 2026, co2Concentration: 420, annualEmissions: 37 }) as ClimateState;

    for (let i = 0; i < 30; i++) {
      state = sector.tick(state, makeWorldContext(i + 1, 42)) as ClimateState;
      expect(state.annualEmissions).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("Economy Invariants", () => {
  it("GDP never drops below 1e9", () => {
    const sector = createEconomySector();
    let state = sector.init(42, { year: 2026, nations: { USA: { gdp: 1e9, gdpGrowthRate: -10, inflationRate: 3, tradeVolume: 50, unemploymentRate: 5 } } }) as EconomyState;

    for (let i = 0; i < 20; i++) {
      state = sector.tick(state, makeWorldContext(i + 1, 42)) as EconomyState;
      expect(state.nations["USA"]!.gdp).toBeGreaterThanOrEqual(1e9);
    }
  });
});

describe("Technology Invariants", () => {
  it("tech level stays within [0, 100]", () => {
    const sector = createTechnologySector();
    let state = sector.init(42, { year: 2026, nations: { USA: { technologyLevel: 50, rdSpending: 0.02 } } }) as TechnologyState;

    for (let i = 0; i < 30; i++) {
      state = sector.tick(state, makeWorldContext(i + 1, 42)) as TechnologyState;
      expect(state.nations["USA"]!.technologyLevel).toBeGreaterThanOrEqual(0);
      expect(state.nations["USA"]!.technologyLevel).toBeLessThanOrEqual(100);
    }
  });
});
