import { describe, it, expect } from "vitest";
import { createCentralBankAgent, createTradeAgent } from "./agents.js";
import type { EconomyState } from "../sectors/economy.js";
import type { GeopoliticsState } from "../sectors/geopolitics.js";
import type { RNG } from "../sectors/types.js";

function seededRNG(seed: number): RNG {
  let s = seed | 0;
  return { next: () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; } };
}

function makeEconomy(): EconomyState {
  return {
    _sectorId: "economy",
    year: 2026, tickCount: 0,
    nations: { USA: { gdp: 27e12, gdpGrowthRate: 2.5, inflationRate: 4.5, tradeVolume: 80, unemploymentRate: 3.7, wars: [] } },
    globalTradeVolume: 100, globalInflation: 4.5, marketIndex: 100,
  };
}

function makeGeopolitics(): GeopoliticsState {
  return {
    _sectorId: "geopolitics",
    year: 2026, tickCount: 0, casualtyMultiplier: 1,
    nations: {
      USA: { id: "USA", name: "USA", region: "na", population: 1, gdp: 1, government: "democracy", technologyLevel: 50, militaryPower: 50, healthMetrics: { lifeExpectancy: 70, infantMortality: 10, hospitalBedsPer1000: 2, universalCoverage: false }, alliances: [], wars: [], relations: { CHN: 10, RUS: 5 } },
      CHN: { id: "CHN", name: "CHN", region: "ea", population: 1, gdp: 1, government: "autocracy", technologyLevel: 50, militaryPower: 50, healthMetrics: { lifeExpectancy: 70, infantMortality: 10, hospitalBedsPer1000: 2, universalCoverage: true }, alliances: [], wars: [], relations: { USA: 10 } },
    },
    wars: {}, alliances: {},
    globalState: { totalPopulation: 1, avgTechnologyLevel: 50, avgHealthOutcome: 70, co2Emissions: 0, tradeVolume: 50 },
  };
}

describe("CentralBankAgent", () => {
  it("lowers inflation when rate is high", () => {
    const agent = createCentralBankAgent();
    const state = makeEconomy();
    const before = state.nations["USA"]!.inflationRate;
    const next = agent.tick(state, seededRNG(42));
    expect(next.nations["USA"]!.inflationRate).toBeLessThan(before);
  });

  it("records decisions in memory", () => {
    const agent = createCentralBankAgent();
    const state = makeEconomy();
    agent.tick(state, seededRNG(42));
    expect(agent.memory.recallAll().length).toBeGreaterThan(0);
  });

  it("deterministic with same seed", () => {
    const a1 = createCentralBankAgent();
    const a2 = createCentralBankAgent();
    const r1 = a1.tick(makeEconomy(), seededRNG(42));
    const r2 = a2.tick(makeEconomy(), seededRNG(42));
    expect(r1.nations["USA"]!.inflationRate).toBe(r2.nations["USA"]!.inflationRate);
  });
});

describe("TradeAgent", () => {
  it("reduces relations for low-score targets", () => {
    const agent = createTradeAgent();
    const state = makeGeopolitics();
    const before = { ...state.nations["USA"]!.relations };
    agent.tick(state, seededRNG(42));
    const after = state.nations["USA"]!.relations;
    let reduced = false;
    for (const k of Object.keys(before)) {
      if ((after[k] ?? 0) < (before[k] ?? 0)) reduced = true;
    }
    expect(reduced).toBe(true);
  });

  it("deterministic with same seed", () => {
    const a1 = createTradeAgent();
    const a2 = createTradeAgent();
    const r1 = a1.tick(makeGeopolitics(), seededRNG(42));
    const r2 = a2.tick(makeGeopolitics(), seededRNG(42));
    expect(r1.nations["USA"]!.relations["CHN"]).toBe(r2.nations["USA"]!.relations["CHN"]);
  });
});
