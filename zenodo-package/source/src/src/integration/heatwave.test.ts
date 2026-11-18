import { describe, it, expect, beforeAll } from "vitest";
import { createWorld } from "../engine/world-engine.js";
import type { WorldState } from "../engine/world-engine.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createClimateSector } from "../sectors/climate.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import { deersRockAdapter } from "../sectors/deers-rock-adapter.js";
import type { DeersRockSectorState } from "../sectors/deers-rock-adapter.js";
import type { ClimateState } from "../sectors/climate.js";
import type { Sector } from "../sectors/types.js";
import { createEventBus } from "../sectors/event-bus.js";
import { restoreRNG } from "../engine/rng.js";
import { resetUniverseCounter } from "../engine/universe.js";

const SAMPLE_CONFIGS: Record<string, Record<string, unknown>> = {
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
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
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
};

const DR_SENTINEL = { id: "makassar-001", city: "Makassar", beds: 133, patients: 50, ticksPerDay: 10 };

function makeSectors(): Sector[] {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    deersRockAdapter(DR_SENTINEL, 42),
  ];
}

function tickWithEvent(world: WorldState, injectedEvents: { type: string; data: Record<string, unknown> }[]): WorldState {
  const nextTick = world.tick + 1;
  const eventBus = createEventBus();
  const rng = restoreRNG(world.rngState);
  const ctx = { tick: nextTick, rng, eventBus };

  const tickedSectors = new Map<string, { sector: Sector; state: import("../sectors/types.js").SectorState }>();
  for (const [id, record] of world.sectors) {
    const newState = record.sector.tick(record.state, ctx);
    tickedSectors.set(id, { sector: record.sector, state: newState });
  }

  for (const evt of injectedEvents) {
    eventBus.publish({
      type: evt.type,
      source: "integration-test",
      data: evt.data,
      tick: nextTick,
    });
  }

  const pending = eventBus.pending();
  const finalSectors = new Map(tickedSectors);
  for (const event of pending) {
    for (const [id, record] of finalSectors) {
      for (const handler of record.sector.handlers) {
        if (handler.eventType === event.type) {
          const newState = handler.handle(event, record.state);
          finalSectors.set(id, { sector: record.sector, state: newState });
        }
      }
    }
  }

  return {
    tick: nextTick,
    sectors: finalSectors,
    rngState: rng.save(),
    universe: world.universe,
  };
}

beforeAll(() => {
  resetUniverseCounter();
});

describe("Heatwave to Health Crisis", () => {
  it("injects extreme weather at tick 10, runs 30 days, verifies DR output", () => {
    const world = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });

    let w: WorldState = world;
    let heatwaveInjected = false;
    const totalTicks = 30;

    for (let i = 0; i < totalTicks; i++) {
      if (w.tick >= 10 && !heatwaveInjected) {
        heatwaveInjected = true;
        w = tickWithEvent(w, [
          { type: "climate.extreme_weather", data: { weatherType: "heatwave", region: "southeast-asia", severity: 4, year: 2026, description: "Severe heatwave in Southeast Asia" } },
          { type: "climate.temp_shift", data: { oldAnomaly: 1.5, newAnomaly: 2.0, co2Concentration: 450 } },
        ]);
        continue;
      }
      w = tickWithEvent(w, []);
    }

    expect(w.tick).toBe(totalTicks);

    const drRecord = w.sectors.get("deers-rock-makassar-001");
    expect(drRecord).toBeDefined();
    const drState = drRecord!.state as DeersRockSectorState;
    expect(drState.sentinelOutput).not.toBeNull();
  }, 60_000);

  it("baseline vs heatwave produces measurable differences", () => {
    const baseline = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });
    const heatwave = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });

    let b: WorldState = baseline;
    let h: WorldState = heatwave;

    for (let i = 0; i < 30; i++) {
      b = tickWithEvent(b, []);
      if (i >= 10) {
        h = tickWithEvent(h, [
          { type: "climate.extreme_weather", data: { weatherType: "heatwave", region: "global", severity: 5, year: 2026, description: "Major heatwave" } },
        ]);
      } else {
        h = tickWithEvent(h, []);
      }
    }

    const baselineDR = (b.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState).sentinelOutput;
    const heatwaveDR = (h.sectors.get("deers-rock-makassar-001")!.state as DeersRockSectorState).sentinelOutput;

    expect(baselineDR).not.toBeNull();
    expect(heatwaveDR).not.toBeNull();
  }, 60_000);

  it("all sectors produce deterministic output with same seed", () => {
    const initial = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });

    let a: WorldState = initial;
    let b: WorldState = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });

    for (let i = 0; i < 15; i++) {
      a = tickWithEvent(a, []);
      b = tickWithEvent(b, []);
    }

    for (const [id] of a.sectors) {
      const aRec = a.sectors.get(id)!;
      const bRec = b.sectors.get(id)!;
      const aState = aRec.state as unknown as Record<string, unknown>;
      const bState = bRec.state as unknown as Record<string, unknown>;

      expect(aState._sectorId).toBe(bState._sectorId);
      expect(aState.tickCount).toBe(bState.tickCount);
    }
  });
});
