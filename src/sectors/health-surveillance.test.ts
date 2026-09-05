import { describe, it, expect, beforeEach } from "vitest";
import { createWorld, run } from "../engine/world-engine.js";
import { resetUniverseCounter } from "../engine/universe.js";
import { createGeopoliticsSector } from "./geopolitics.js";
import { createEconomySector } from "./economy.js";
import { createTechnologySector } from "./technology.js";
import { createClimateSector } from "./climate.js";
import { createEnergySector } from "./energy.js";
import { createDemographicsSector } from "./demographics.js";
import { deersRockAdapter } from "./deers-rock-adapter.js";
import { createHealthSurveillanceSector } from "./health-surveillance.js";
import type { HealthSurveillanceState } from "./health-surveillance.js";

/** 45 patients in 50 beds = 90% initial occupancy → crosses 0.85 threshold quickly */
const HOSPITAL_CONFIG = { id: "sentinel-001", city: "TestCity", beds: 50, patients: 45, ticksPerDay: 10 };

const sampleConfigs: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      {
        id: "USA", name: "United States", region: "north-america",
        population: 340_000_000, gdp: 27_000_000_000_000,
        government: "democracy" as const, technologyLevel: 85, militaryPower: 90,
        healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false },
        alliances: ["NATO"], wars: [],
        relations: { CHN: 30, RUS: 10, GBR: 85 },
      },
      {
        id: "CHN", name: "China", region: "east-asia",
        population: 1_410_000_000, gdp: 18_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 72, militaryPower: 85,
        healthMetrics: { lifeExpectancy: 77, infantMortality: 6.8, hospitalBedsPer1000: 4.3, universalCoverage: true },
        alliances: ["SCO"], wars: [],
        relations: { USA: 30, RUS: 70, GBR: 40 },
      },
      {
        id: "RUS", name: "Russia", region: "eastern-europe",
        population: 144_000_000, gdp: 2_000_000_000_000,
        government: "autocracy" as const, technologyLevel: 55, militaryPower: 75,
        healthMetrics: { lifeExpectancy: 70, infantMortality: 7.2, hospitalBedsPer1000: 8.0, universalCoverage: true },
        alliances: ["SCO", "CSTO"], wars: [],
        relations: { USA: 10, CHN: 70, GBR: 15 },
      },
    ],
    wars: [
      { id: "W-2022-01", name: "Russia-Ukraine War",
        parties: { attackers: ["RUS"], defenders: ["UKR"] },
        startYear: 2022, status: "active" as const, casualties: 150_000 },
    ],
    alliances: [
      { id: "NATO", name: "NATO", members: ["USA"], formed: 1949, type: "defense" as const, strength: 85 },
      { id: "SCO", name: "SCO", members: ["CHN", "RUS"], formed: 2001, type: "political" as const, strength: 60 },
    ],
  },
  economy: {
    year: 2026,
    nations: {
      USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 },
      CHN: { gdp: 18_000_000_000_000, gdpGrowthRate: 5.0, inflationRate: 1.5, tradeVolume: 75, unemploymentRate: 5.0 },
      RUS: { gdp: 2_000_000_000_000, gdpGrowthRate: 1.5, inflationRate: 6.0, tradeVolume: 40, unemploymentRate: 4.5 },
    },
  },
  technology: {
    year: 2026,
    nations: {
      USA: { technologyLevel: 85, rdSpending: 0.035 },
      CHN: { technologyLevel: 72, rdSpending: 0.024 },
      RUS: { technologyLevel: 55, rdSpending: 0.015 },
    },
  },
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
  energy: {
    year: 2026,
    nations: {
      USA: { energyMix: { oil: 25, gas: 15, coal: 45, nuclear: 0, renewable: 5 }, totalConsumption: 100, energyPrice: 80, energySecurity: 50, co2Intensity: 0.5 },
      CHN: { energyMix: { oil: 20, gas: 10, coal: 60, nuclear: 0, renewable: 5 }, totalConsumption: 120, energyPrice: 70, energySecurity: 45, co2Intensity: 0.6 },
      RUS: { energyMix: { oil: 30, gas: 20, coal: 35, nuclear: 5, renewable: 5 }, totalConsumption: 60, energyPrice: 60, energySecurity: 60, co2Intensity: 0.55 },
    },
  },
  demographics: {
    year: 2026,
    nations: {
      USA: { population: 340_000_000, birthRate: 12, deathRate: 8, medianAge: 38, dependencyRatio: 50, laborForceParticipation: 62, netMigration: 0 },
      CHN: { population: 1_410_000_000, birthRate: 8, deathRate: 7, medianAge: 39, dependencyRatio: 45, laborForceParticipation: 65, netMigration: 0 },
      RUS: { population: 144_000_000, birthRate: 9, deathRate: 12, medianAge: 40, dependencyRatio: 48, laborForceParticipation: 58, netMigration: 0 },
    },
  },
};

function buildWorld(seed: number = 42, patients = 45) {
  const sentinel = deersRockAdapter({ ...HOSPITAL_CONFIG, patients }, seed);
  const surveillance = createHealthSurveillanceSector();
  const sectors = [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
    sentinel,
    surveillance,
  ];
  return createWorld(sectors, sampleConfigs, { seed });
}

function hashState(state: HealthSurveillanceState): string {
  return JSON.stringify({ latest: state.latest, eventCounts: state.eventCounts });
}

beforeEach(() => {
  resetUniverseCounter();
});

describe("health-surveillance", () => {
  it("receives health.pressure events from real adapter path (60 ticks)", () => {
    const world = buildWorld(42);
    const result = run(world, 60);
    const record = result.sectors.get("health-surveillance");
    expect(record).toBeDefined();
    const state = record!.state as HealthSurveillanceState;
    // At 60 ticks with 45/50 patients, occupancy crosses 0.85 → health.pressure fires
    expect(state.eventCounts["health.pressure"] ?? 0).toBeGreaterThan(0);
    const entry = state.latest["sentinel-001"];
    expect(entry).toBeDefined();
    expect(entry!.occupancyRate).toBeGreaterThan(0.85);
  }, 30_000);

  it("surveillance state hash at tick 60 differs from init", () => {
    const world = buildWorld(42);
    const initRecord = world.sectors.get("health-surveillance")!;
    const initHash = hashState(initRecord.state as HealthSurveillanceState);

    const result = run(world, 60);
    const finalRecord = result.sectors.get("health-surveillance")!;
    const finalHash = hashState(finalRecord.state as HealthSurveillanceState);

    expect(finalHash).not.toBe(initHash);
  }, 30_000);

  it("determinism: same seed produces identical surveillance state", () => {
    const world1 = buildWorld(42);
    const result1 = run(world1, 60);
    const state1 = result1.sectors.get("health-surveillance")!.state as HealthSurveillanceState;

    resetUniverseCounter();
    const world2 = buildWorld(42);
    const result2 = run(world2, 60);
    const state2 = result2.sectors.get("health-surveillance")!.state as HealthSurveillanceState;

    expect(hashState(state1)).toBe(hashState(state2));
  }, 60_000);

  it("isolation: two sentinels get separate latest entries", () => {
    const configA = { id: "hospital-A", city: "CityA", beds: 50, patients: 45, ticksPerDay: 10 };
    const configB = { id: "hospital-B", city: "CityB", beds: 50, patients: 45, ticksPerDay: 10 };
    const seed = 42;

    const sentinelA = deersRockAdapter(configA, seed);
    const sentinelB = deersRockAdapter(configB, seed);
    const surveillance = createHealthSurveillanceSector();
    const sectors = [
      createGeopoliticsSector(),
      createClimateSector(),
      createEconomySector(),
      createTechnologySector(),
      createEnergySector(),
      createDemographicsSector(),
      sentinelA,
      sentinelB,
      surveillance,
    ];
    const world = createWorld(sectors, sampleConfigs, { seed });
    const result = run(world, 60);
    const state = result.sectors.get("health-surveillance")!.state as HealthSurveillanceState;

    const entryA = state.latest["hospital-A"];
    const entryB = state.latest["hospital-B"];
    expect(entryA).toBeDefined();
    expect(entryB).toBeDefined();
    expect(entryA!.city).toBe("CityA");
    expect(entryB!.city).toBe("CityB");
    // Each hospital has independent records
    expect(entryA!.hospitalId).toBe("hospital-A");
    expect(entryB!.hospitalId).toBe("hospital-B");
  }, 60_000);
});
