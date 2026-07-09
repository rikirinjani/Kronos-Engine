import { describe, it, expect, beforeEach } from "vitest";
import { run, createWorld } from "./world-engine.js";
import { resetUniverseCounter } from "./universe.js";
import { createEconomySector } from "../sectors/economy.js";
import { createClimateSector } from "../sectors/climate.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createTechnologySector } from "../sectors/technology.js";
import { createEnergySector } from "../sectors/energy.js";
import { createDemographicsSector } from "../sectors/demographics.js";
import type { Sector, SectorState } from "../sectors/types.js";

const allSectors: Sector[] = [
  createEconomySector(),
  createClimateSector(),
  createGeopoliticsSector(),
  createTechnologySector(),
  createEnergySector(),
  createDemographicsSector(),
];

function emptyConfigs() {
  const c: Record<string, Record<string, unknown>> = {};
  for (const s of allSectors) c[s.id] = {};
  return c;
}

beforeEach(() => { resetUniverseCounter(); });

function hasNaNOrInf(value: unknown): string | null {
  if (typeof value === "number") {
    if (isNaN(value)) return "NaN";
    if (!isFinite(value)) return "Infinity";
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [k, v] of Object.entries(value)) {
      const result = hasNaNOrInf(v);
      if (result) return `${k}.${result}`;
    }
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const result = hasNaNOrInf(value[i]);
      if (result) return `[${i}].${result}`;
    }
  }
  return null;
}

describe("NaN/Infinity stability", () => {
  it("no NaN or Infinity after 10 ticks", () => {
    let world = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    world = run(world, 10);
    for (const [id, record] of world.sectors) {
      const bad = hasNaNOrInf(record.state);
      expect(bad, `${id} has ${bad}`).toBeNull();
    }
  });

  it("no NaN or Infinity after 50 ticks", () => {
    let world = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    world = run(world, 50);
    for (const [id, record] of world.sectors) {
      const bad = hasNaNOrInf(record.state);
      expect(bad, `${id} has ${bad}`).toBeNull();
    }
  });

  it("no NaN or Infinity with extreme seed", () => {
    let world = createWorld(allSectors, emptyConfigs(), { seed: 0 });
    world = run(world, 30);
    for (const [id, record] of world.sectors) {
      const bad = hasNaNOrInf(record.state);
      expect(bad, `${id} has ${bad}`).toBeNull();
    }
  });

  it("no NaN or Infinity with max seed", () => {
    let world = createWorld(allSectors, emptyConfigs(), { seed: 0x7fffffff });
    world = run(world, 30);
    for (const [id, record] of world.sectors) {
      const bad = hasNaNOrInf(record.state);
      expect(bad, `${id} has ${bad}`).toBeNull();
    }
  });
});
