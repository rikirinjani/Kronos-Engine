import { describe, it, expect } from "vitest";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { createWorld, run, snapshot } from "../src/engine/index.js";
import { resetUniverseCounter } from "../src/engine/universe.js";
import type { Sector } from "../src/sectors/types.js";

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector()];
}

const SAMPLE_CONFIGS: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      { id: "USA", name: "United States", region: "north-america", population: 340_000_000, gdp: 27_000_000_000_000, government: "democracy" as const, technologyLevel: 85, militaryPower: 90, healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false }, alliances: ["NATO"], wars: [], relations: { CHN: 30 } },
    ],
    wars: [],
    alliances: [{ id: "NATO", name: "NATO", members: ["USA"], formed: 1949, type: "defense" as const, strength: 85 }],
  },
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
  economy: { year: 2026, nations: { USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 } } },
  technology: { year: 2026, nations: { USA: { technologyLevel: 85, rdSpending: 0.035 } } },
};

describe("Determinism", () => {
  it("same seed + same config = identical output", () => {
    resetUniverseCounter();

    const a = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });
    const b = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });

    const aSnap = snapshot(run(a, 20));
    const bSnap = snapshot(run(b, 20));

    expect(aSnap.tick).toBe(bSnap.tick);
    for (const sa of aSnap.sectors) {
      const sb = bSnap.sectors.find((s) => s.id === sa.id);
      expect(sb).toBeDefined();
      expect(JSON.stringify(sa.state)).toBe(JSON.stringify(sb!.state));
    }
  });

  it("different seed produces different output", () => {
    resetUniverseCounter();

    const a = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 42 });
    const b = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed: 99 });

    const aSnap = snapshot(run(a, 10));
    const bSnap = snapshot(run(b, 10));

    let anyDifferent = false;
    for (const sa of aSnap.sectors) {
      const sb = bSnap.sectors.find((s) => s.id === sa.id);
      if (sb && JSON.stringify(sa.state) !== JSON.stringify(sb.state)) {
        anyDifferent = true;
        break;
      }
    }
    expect(anyDifferent).toBe(true);
  });
});
