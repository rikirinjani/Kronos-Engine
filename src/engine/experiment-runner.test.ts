import { describe, it, expect, beforeEach } from "vitest";
import { loadEraAndRun } from "./experiment-runner.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createClimateSector } from "../sectors/climate.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import { createEnergySector } from "../sectors/energy.js";
import { createDemographicsSector } from "../sectors/demographics.js";
import { resetUniverseCounter } from "./universe.js";

function allSectors() {
  return [
    createGeopoliticsSector(),
    createClimateSector(),
    createEconomySector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
  ];
}

beforeEach(() => {
  resetUniverseCounter();
});

describe("loadEraAndRun", () => {
  it("loads contemporary baseline and runs 10 ticks", () => {
    const result = loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", {
      ticks: 10,
      sectors: allSectors(),
      seed: 42,
    });
    expect(result.tick).toBe(10);
    expect(result.rewindPointId).toBe("RP-CONTEMP-003");
    expect(result.snapshot.sectors.length).toBe(6);
  });

  it("loads modern era WWII and runs 30 ticks", () => {
    const result = loadEraAndRun("docs/history/era-modern.json", "RP-MODERN-001", {
      ticks: 30,
      sectors: allSectors(),
      seed: 42,
    });
    expect(result.tick).toBe(30);
    expect(result.state.year).toBe(1939);
  });

  it("deterministic: same inputs = same output", () => {
    const a = loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", {
      ticks: 5, sectors: allSectors(), seed: 99,
    });
    const b = loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", {
      ticks: 5, sectors: allSectors(), seed: 99,
    });
    expect(a.snapshot.sectors).toEqual(b.snapshot.sectors);
  });

  it("accepts configOverrides to modify sector params", () => {
    const result = loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", {
      ticks: 10,
      sectors: allSectors(),
      seed: 42,
      configOverrides: {
        economy: { nations: { USA: { gdp: 99_000_000_000_000 } } },
      },
    });
    const eco = result.snapshot.sectors.find((s) => s.id === "economy")!;
    expect((eco.state as unknown as Record<string, unknown>).nations).toBeDefined();
  });

  it("throws for unknown rewind point", () => {
    expect(() => loadEraAndRun("docs/history/era-contemporary.json", "RP-NONEXISTENT", {
      ticks: 5, sectors: allSectors(),
    })).toThrow();
  });

  it("runs with subset of sectors", () => {
    const result = loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", {
      ticks: 5,
      sectors: [createGeopoliticsSector(), createEconomySector()],
      seed: 42,
    });
    expect(result.snapshot.sectors.length).toBe(2);
  });
});
