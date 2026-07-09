import { describe, it, expect } from "vitest";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { createWorld, run } from "../src/engine/index.js";
import { resetUniverseCounter } from "../src/engine/universe.js";
import type { Sector } from "../src/sectors/types.js";

function makeSectors(): Sector[] {
  return [createGeopoliticsSector(), createClimateSector(), createEconomySector(), createTechnologySector()];
}

const SAMPLE_CONFIGS: Record<string, Record<string, unknown>> = {
  geopolitics: {
    year: 2026,
    nations: [
      { id: "USA", name: "United States", region: "north-america", population: 340_000_000, gdp: 27_000_000_000_000, government: "democracy" as const, technologyLevel: 85, militaryPower: 90, healthMetrics: { lifeExpectancy: 79, infantMortality: 5.4, hospitalBedsPer1000: 2.8, universalCoverage: false }, alliances: ["NATO"], wars: [], relations: { CHN: 30, RUS: 10 } },
      { id: "CHN", name: "China", region: "east-asia", population: 1_410_000_000, gdp: 18_000_000_000_000, government: "autocracy" as const, technologyLevel: 72, militaryPower: 85, healthMetrics: { lifeExpectancy: 77, infantMortality: 6.8, hospitalBedsPer1000: 4.3, universalCoverage: true }, alliances: ["SCO"], wars: [], relations: { USA: 30, RUS: 70 } },
    ],
    wars: [{ id: "W-1", name: "Test War", parties: { attackers: ["USA"], defenders: ["CHN"] }, startYear: 2026, status: "active" as const, casualties: 1000 }],
    alliances: [],
  },
  climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
  economy: { year: 2026, nations: { USA: { gdp: 27_000_000_000_000, gdpGrowthRate: 2.5, inflationRate: 3.0, tradeVolume: 80, unemploymentRate: 3.7 }, CHN: { gdp: 18_000_000_000_000, gdpGrowthRate: 5.0, inflationRate: 1.5, tradeVolume: 75, unemploymentRate: 5.0 } } },
  technology: { year: 2026, nations: { USA: { technologyLevel: 85, rdSpending: 0.035 }, CHN: { technologyLevel: 72, rdSpending: 0.024 } } },
};

function hasNaN(obj: unknown): boolean {
  if (typeof obj === "number" && (isNaN(obj) || !isFinite(obj))) return true;
  if (obj && typeof obj === "object") {
    for (const v of Object.values(obj as Record<string, unknown>)) {
      if (hasNaN(v)) return true;
    }
  }
  return false;
}

describe("NaN/Infinity Stability", () => {
  it("no NaN or Infinity after 50 ticks across all sectors", () => {
    resetUniverseCounter();
    const seeds = [42, 43, 44, 100, 999];

    for (const seed of seeds) {
      const world = createWorld(makeSectors(), SAMPLE_CONFIGS, { seed });
      const final = run(world, 50);
      expect(final.tick).toBe(50);

      for (const [id, record] of final.sectors) {
        const errs: string[] = [];
        for (const [key, val] of Object.entries(record.state as unknown as Record<string, unknown>)) {
          if (hasNaN(val)) errs.push(key);
        }
        expect(errs, `${id} (seed ${seed}): NaN/Infinity in [${errs.join(", ")}]`).toHaveLength(0);
      }
    }
  });
});
