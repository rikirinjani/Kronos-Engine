import { describe, it, expect, beforeEach } from "vitest";
import { run, createWorld } from "./world-engine.js";
import { resetUniverseCounter } from "./universe.js";
import { createEconomySector } from "../sectors/economy.js";
import type { EconomyState } from "../sectors/economy.js";
import { createClimateSector } from "../sectors/climate.js";
import type { ClimateState } from "../sectors/climate.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createTechnologySector } from "../sectors/technology.js";
import type { TechnologyState } from "../sectors/technology.js";
import { createEnergySector } from "../sectors/energy.js";
import type { EnergyState } from "../sectors/energy.js";
import { createDemographicsSector } from "../sectors/demographics.js";
import type { DemographicsState } from "../sectors/demographics.js";
import type { Sector } from "../sectors/types.js";

beforeEach(() => { resetUniverseCounter(); });

function build(...sectors: Sector[]) {
  const c: Record<string, Record<string, unknown>> = {};
  for (const s of sectors) c[s.id] = {};
  return createWorld(sectors, c, { seed: 42 });
}

describe("Economy invariants", () => {
  it("GDP never negative", () => {
    let w = build(createEconomySector());
    w = run(w, 30);
    const s = w.sectors.get("economy")!.state as EconomyState;
    for (const [id, n] of Object.entries(s.nations)) {
      expect(n.gdp, `${id} GDP`).toBeGreaterThanOrEqual(0);
    }
  });
  it("inflation clamped [-5, 100]", () => {
    let w = build(createEconomySector());
    w = run(w, 30);
    const s = w.sectors.get("economy")!.state as EconomyState;
    for (const [id, n] of Object.entries(s.nations)) {
      expect(n.inflationRate, `${id} inflation`).toBeGreaterThanOrEqual(-5);
      expect(n.inflationRate, `${id} inflation`).toBeLessThanOrEqual(100);
    }
  });
});

describe("Climate invariants", () => {
  it("CO2 never below pre-industrial baseline (280)", () => {
    let w = build(createClimateSector());
    w = run(w, 30);
    const s = w.sectors.get("climate")!.state as ClimateState;
    expect(s.co2Concentration).toBeGreaterThanOrEqual(280);
  });
  it("temperature anomaly never negative", () => {
    let w = build(createClimateSector());
    w = run(w, 30);
    const s = w.sectors.get("climate")!.state as ClimateState;
    expect(s.temperatureAnomaly).toBeGreaterThanOrEqual(0);
    expect(s.seaLevelRise).toBeGreaterThanOrEqual(0);
  });
});

describe("Technology invariants", () => {
  it("tech level clamped [0, 100]", () => {
    let w = build(createTechnologySector());
    w = run(w, 30);
    const s = w.sectors.get("technology")!.state as TechnologyState;
    for (const [id, n] of Object.entries(s.nations)) {
      expect(n.technologyLevel, `${id} tech`).toBeGreaterThanOrEqual(0);
      expect(n.technologyLevel, `${id} tech`).toBeLessThanOrEqual(100);
    }
  });
  it("innovation count monotonic", () => {
    let w = build(createTechnologySector());
    const counts: number[] = [];
    for (let i = 0; i < 30; i++) {
      w = run(w, 5);
      const s = w.sectors.get("technology")!.state as TechnologyState;
      let total = 0;
      for (const n of Object.values(s.nations)) total += n.innovationCount;
      counts.push(total);
    }
    for (let i = 1; i < counts.length; i++) {
      expect(counts[i]!).toBeGreaterThanOrEqual(counts[i - 1]!);
    }
  });
});

describe("Energy invariants", () => {
  it("mix sums to ~1.0", () => {
    let w = build(createEnergySector());
    w = run(w, 30);
    const s = w.sectors.get("energy")!.state as EnergyState;
    for (const [id, n] of Object.entries(s.nations)) {
      const sum = n.energyMix.oil + n.energyMix.gas + n.energyMix.coal + n.energyMix.nuclear + n.energyMix.renewable;
      expect(sum, `${id} mix sum`).toBeGreaterThanOrEqual(0.99);
      expect(sum, `${id} mix sum`).toBeLessThanOrEqual(1.01);
    }
  });
  it("energy price non-negative", () => {
    let w = build(createEnergySector());
    w = run(w, 30);
    const s = w.sectors.get("energy")!.state as EnergyState;
    expect(s.globalEnergyPrice).toBeGreaterThanOrEqual(0);
  });
});

describe("Demographics invariants", () => {
  it("population never negative", () => {
    let w = build(createDemographicsSector());
    w = run(w, 30);
    const s = w.sectors.get("demographics")!.state as DemographicsState;
    expect(s.globalPopulation).toBeGreaterThanOrEqual(0);
    for (const [id, n] of Object.entries(s.nations)) {
      expect(n.population, `${id} pop`).toBeGreaterThanOrEqual(0);
    }
  });
  it("birth/death rates in plausible range", () => {
    let w = build(createDemographicsSector());
    w = run(w, 30);
    const s = w.sectors.get("demographics")!.state as DemographicsState;
    for (const [id, n] of Object.entries(s.nations)) {
      expect(n.birthRate, `${id} birth`).toBeGreaterThanOrEqual(0);
      expect(n.birthRate, `${id} birth`).toBeLessThanOrEqual(60);
      expect(n.deathRate, `${id} death`).toBeGreaterThanOrEqual(0);
      expect(n.deathRate, `${id} death`).toBeLessThanOrEqual(50);
    }
  });
});
