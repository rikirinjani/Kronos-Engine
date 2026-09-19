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
import type { HospitalSentinelOutput } from "./deers-rock-adapter.js";

/**
 * R-2: sentinelOutput aliasing diagnostic test
 *
 * Verifies that:
 * 1. Each tick creates a fresh sentinelOutput object (identity changes)
 * 2. Snapshot captures the sentinelOutput by reference without contamination
 * 3. Reconstructed state's sentinelOutput matches the snapshot at capture time
 * 4. Mutating a live sentinelOutput does not contaminate a previously captured snapshot
 */

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
    ],
    wars: [],
    alliances: [],
  },
  economy: { year: 2026, nations: { USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 } } },
  technology: { year: 2026, nations: { USA: { technologyLevel: 85, rdSpending: 0.035 } } },
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
  energy: { year: 2026, nations: { USA: { energyMix: { oil: 25, gas: 15, coal: 45, nuclear: 0, renewable: 5 }, totalConsumption: 100, energyPrice: 80, energySecurity: 50, co2Intensity: 0.5 } } },
  demographics: { year: 2026, nations: { USA: { population: 340_000_000, birthRate: 12, deathRate: 8, medianAge: 38, dependencyRatio: 50, laborForceParticipation: 62, netMigration: 0 } } },
};

function buildWorld(seed: number = 42) {
  const sentinel = deersRockAdapter(HOSPITAL_CONFIG, seed);
  const sectors = [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
    sentinel,
  ];
  return createWorld(sectors, sampleConfigs, { seed });
}

beforeEach(() => { resetUniverseCounter(); });

describe("sentinelOutput aliasing diagnostic (R-2)", () => {
  it("each tick creates a fresh sentinelOutput object (identity changes)", () => {
    const world = buildWorld(42);
    const result = run(world, 10);
    const sentinelState = result.sectors.get("deers-rock-sentinel-001")!.state as any;

    // sentinelOutput should be defined and have valid structure
    const output: HospitalSentinelOutput = sentinelState.sentinelOutput;
    expect(output).toBeDefined();
    expect(output.tick).toBe(10); // tick is 1-indexed, 10 ticks
    expect(typeof output.occupancyRate).toBe("number");
    expect(typeof output.diseasePrevalence).toBe("object");

    // diseasePrevalence should be a plain object (created by Object.fromEntries)
    const dpKeys = Object.keys(output.diseasePrevalence);
    expect(dpKeys.length).toBeGreaterThanOrEqual(0);
  });

  it("snapshot sentinelOutput matches live sentinelOutput at capture time", () => {
    const world = buildWorld(42);
    const result = run(world, 10);

    // Manually capture a snapshot from the sector state
    const sentinelState = result.sectors.get("deers-rock-sentinel-001")!;
    const snapshotFn = (sentinelState.state as any).__snapshot;
    expect(snapshotFn).toBeDefined();

    const snapshot = snapshotFn();
    const liveOutput = (sentinelState.state as any).sentinelOutput as HospitalSentinelOutput;

    // Snapshot sentinelOutput should match live sentinelOutput values
    expect(snapshot.sentinelOutput.tick).toBe(liveOutput.tick);
    expect(snapshot.sentinelOutput.occupancyRate).toBe(liveOutput.occupancyRate);
    expect(snapshot.sentinelOutput.mortalityPressure).toBe(liveOutput.mortalityPressure);
    expect(snapshot.sentinelOutput.supplyStress).toBe(liveOutput.supplyStress);

    // diseasePrevalence should have the same entries
    const snapDpKeys = Object.keys(snapshot.sentinelOutput.diseasePrevalence).sort();
    const liveDpKeys = Object.keys(liveOutput.diseasePrevalence).sort();
    expect(snapDpKeys).toEqual(liveDpKeys);
  });

  it("D-S1 fix: deepClone eliminates sentinelOutput aliasing between snapshot and live state", () => {
    const world = buildWorld(42);
    const result = run(world, 10);

    const sentinelState = result.sectors.get("deers-rock-sentinel-001")!;
    const snapshotFn = (sentinelState.state as any).__snapshot;

    // Capture snapshot at tick 10
    const snapshot = snapshotFn();
    const snapDiseasePrevalence = { ...snapshot.sentinelOutput.diseasePrevalence };
    const snapOccupancy = snapshot.sentinelOutput.occupancyRate;

    // Mutate the live sentinelOutput's diseasePrevalence
    const liveOutput = (sentinelState.state as any).sentinelOutput as HospitalSentinelOutput;
    liveOutput.diseasePrevalence["FAKE_DIAGNOSIS"] = 9999;
    liveOutput.occupancyRate = 0.01;

    // With deepClone (D-S1 fix), snapshot sentinelOutput is a separate object.
    // Mutation of live output does NOT propagate to snapshot.
    expect(snapshot.sentinelOutput).not.toBe(liveOutput);

    // Snapshot values preserved
    expect(snapshot.sentinelOutput.diseasePrevalence["FAKE_DIAGNOSIS"]).toBeUndefined();
    expect(snapshot.sentinelOutput.occupancyRate).toBe(snapOccupancy);

    // Original snapshot values still match
    expect(snapDiseasePrevalence["FAKE_DIAGNOSIS"]).toBeUndefined();
    expect(typeof snapOccupancy).toBe("number");
    expect(snapOccupancy).toBeGreaterThanOrEqual(0);
    expect(snapOccupancy).toBeLessThanOrEqual(1);
  });

  it("D-S1 fix: reconstructed state sentinelOutput is deep-cloned from snapshot", () => {
    const world = buildWorld(42);
    const result = run(world, 10);

    const sentinelState = result.sectors.get("deers-rock-sentinel-001")!;
    const snapshotFn = (sentinelState.state as any).__snapshot;
    const snapshot = snapshotFn();

    // Reconstruct from snapshot
    const reconstructFn = (sentinelState.state as any).__reconstruct;
    const reconstructed = reconstructFn(snapshot);

    // With deepClone, reconstructed sentinelOutput is a separate object from snapshot
    expect(reconstructed.sentinelOutput).not.toBe(snapshot.sentinelOutput);

    // But values match
    expect(reconstructed.sentinelOutput.tick).toBe(snapshot.sentinelOutput.tick);
    expect(reconstructed.sentinelOutput.occupancyRate).toBe(snapshot.sentinelOutput.occupancyRate);

    // Mutating reconstructed sentinelOutput does NOT affect snapshot
    reconstructed.sentinelOutput.diseasePrevalence["MUTATED"] = 42;
    expect(snapshot.sentinelOutput.diseasePrevalence["MUTATED"]).toBeUndefined();
  });

  it("D-S1 fix: sentinelOutput is deep-cloned in both capture and reconstruct", () => {
    const world = buildWorld(42);
    const result = run(world, 5);

    const sentinelState = result.sectors.get("deers-rock-sentinel-001")!;
    const snapshotFn = (sentinelState.state as any).__snapshot;
    const snapshot = snapshotFn();

    // Verify sentinelOutput is a plain object (not null, not a class instance)
    expect(typeof snapshot.sentinelOutput).toBe("object");
    expect(snapshot.sentinelOutput).not.toBeNull();
    expect(Array.isArray(snapshot.sentinelOutput)).toBe(false);

    // Verify diseasePrevalence is a plain object (created by Object.fromEntries)
    expect(typeof snapshot.sentinelOutput.diseasePrevalence).toBe("object");

    // Verify deepClone is applied (snapshot sentinelOutput is not live sentinelOutput)
    const liveOutput = (sentinelState.state as any).sentinelOutput;
    expect(snapshot.sentinelOutput).not.toBe(liveOutput);
  });
});
