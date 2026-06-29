import { describe, it, expect } from "vitest";
import { buildSectorConfigs, loadEraConfig } from "./era-loader.js";
import type { StrategicWorldState } from "../timeline/history-types.js";

const sampleState: StrategicWorldState = {
  year: 2026,
  label: "Baseline Present",
  nations: [
    {
      id: "USA", name: "United States", region: "north-america",
      population: 340_000_000, gdp: 27_000_000_000_000,
      territory: { regionIds: ["continental-us"], capital: "Washington, D.C." },
      government: "democracy", technologyLevel: 85, militaryPower: 90,
      healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
      alliances: ["NATO"], wars: [],
      relations: { GBR: 85, CHN: 30 },
    },
    {
      id: "CHN", name: "China", region: "east-asia",
      population: 1_410_000_000, gdp: 18_000_000_000_000,
      territory: { regionIds: ["mainland-china"], capital: "Beijing" },
      government: "autocracy", technologyLevel: 72, militaryPower: 85,
      healthMetrics: { lifeExpectancy: 77, infantMortality: 6.8, hospitalBedsPer1000: 4.3, universalCoverage: true },
      alliances: ["SCO"], wars: [],
      relations: { USA: 30, RUS: 70 },
    },
  ],
  wars: [
    { id: "W-2022-01", name: "Russia-Ukraine War",
      parties: { attackers: ["RUS"], defenders: ["UKR"] },
      startYear: 2022, status: "active", casualties: 150_000 },
  ],
  alliances: [
    { id: "NATO", name: "NATO", members: ["USA"], formed: 1949, type: "defense", strength: 85 },
  ],
  globalState: {
    totalPopulation: 8_200_000_000,
    avgTechnologyLevel: 50,
    avgHealthOutcome: 73,
    co2Emissions: 37_000_000_000,
    tradeVolume: 100,
  },
};

describe("buildSectorConfigs", () => {
  it("builds geopolitics config with nations, wars, alliances", () => {
    const configs = buildSectorConfigs(sampleState, "contemporary");
    const geo = configs.geopolitics as unknown as Record<string, unknown>;

    expect(geo.year).toBe(2026);
    expect((geo.nations as unknown[])).toHaveLength(2);
    expect((geo.wars as unknown[])).toHaveLength(1);
    expect((geo.alliances as unknown[])).toHaveLength(1);
  });

  it("builds climate config with derived CO2 and emissions", () => {
    const configs = buildSectorConfigs(sampleState, "contemporary");
    const cli = configs.climate as unknown as Record<string, unknown>;

    expect(cli.year).toBe(2026);
    expect(cli.co2Concentration).toBe(420);
    expect(cli.annualEmissions).toBe(37);
  });

  it("builds economy config with per-nation data", () => {
    const configs = buildSectorConfigs(sampleState, "contemporary");
    const eco = configs.economy as unknown as Record<string, unknown>;
    const nations = eco.nations as Record<string, Record<string, unknown>>;

    expect(nations["USA"]!.gdp).toBe(27_000_000_000_000);
    expect(nations["CHN"]!.gdp).toBe(18_000_000_000_000);
    expect(nations["USA"]!.gdpGrowthRate).toBe(2.5);
    expect(nations["USA"]!.tradeVolume).toBe(60);
    expect(nations["CHN"]!.tradeVolume).toBe(40);
  });

  it("builds technology config with per-nation R&D", () => {
    const configs = buildSectorConfigs(sampleState, "contemporary");
    const tech = configs.technology as unknown as Record<string, unknown>;
    const nations = tech.nations as Record<string, Record<string, unknown>>;

    expect(nations["USA"]!.technologyLevel).toBe(85);
    expect(nations["USA"]!.rdSpending).toBe(0.035);
    expect(nations["CHN"]!.rdSpending).toBe(0.025);
  });

  it("adjusts defaults by era", () => {
    const ancient: StrategicWorldState = {
      ...sampleState, year: -3000,
      nations: [{ ...sampleState.nations[0]!, technologyLevel: 10, gdp: 100_000_000, government: "monarchy" }],
      globalState: { totalPopulation: 50_000_000, avgTechnologyLevel: 5, avgHealthOutcome: 30, co2Emissions: 0, tradeVolume: 5 },
    };

    const configs = buildSectorConfigs(ancient, "ancient");
    const eco = configs.economy as unknown as Record<string, unknown>;
    const nations = eco.nations as Record<string, Record<string, unknown>>;

    expect(configs.climate!.co2Concentration).toBe(280);
    expect(configs.climate!.annualEmissions).toBe(0);
    expect(nations["USA"]!.gdpGrowthRate).toBe(0.5);
    expect(nations["USA"]!.inflationRate).toBe(0.5);
    expect(nations["USA"]!.tradeVolume).toBe(30);
  });

  it("loads from actual era JSON file", () => {
    const configs = loadEraConfig("docs/history/era-contemporary.json", "RP-CONTEMP-003");
    const geo = configs.geopolitics as unknown as Record<string, unknown>;

    expect(geo.year).toBe(2026);
    expect((geo.nations as unknown[]).length).toBeGreaterThan(5);
  });

  it("throws for unknown rewind point", () => {
    expect(() => loadEraConfig("docs/history/era-contemporary.json", "RP-NONEXISTENT")).toThrow();
  });
});
