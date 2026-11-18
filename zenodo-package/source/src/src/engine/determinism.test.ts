import { describe, it, expect, beforeEach } from "vitest";
import { tick, createWorld, snapshot } from "./world-engine.js";
import { resetUniverseCounter } from "./universe.js";
import { createEconomySector } from "../sectors/economy.js";
import { createClimateSector } from "../sectors/climate.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createTechnologySector } from "../sectors/technology.js";
import { createEnergySector } from "../sectors/energy.js";
import { createDemographicsSector } from "../sectors/demographics.js";
import type { Sector } from "../sectors/types.js";

const allSectors: Sector[] = [
  createEconomySector(),
  createClimateSector(),
  createGeopoliticsSector(),
  createTechnologySector(),
  createEnergySector(),
  createDemographicsSector(),
];

function emptyConfigs(): Record<string, Record<string, unknown>> {
  const c: Record<string, Record<string, unknown>> = {};
  for (const s of allSectors) c[s.id] = {};
  return c;
}

beforeEach(() => { resetUniverseCounter(); });

describe("Determinism", () => {
  it("same seed produces identical world after N ticks", () => {
    let w1 = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    let w2 = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    for (let i = 0; i < 20; i++) { w1 = tick(w1); w2 = tick(w2); }
    const s1 = snapshot(w1);
    const s2 = snapshot(w2);
    expect(s1.tick).toBe(s2.tick);
    expect(s1.rngState).toEqual(s2.rngState);
    expect(JSON.stringify(s1.sectors)).toBe(JSON.stringify(s2.sectors));
  });

  it("different seed produces different world", () => {
    let w1 = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    let w2 = createWorld(allSectors, emptyConfigs(), { seed: 99 });
    for (let i = 0; i < 10; i++) { w1 = tick(w1); w2 = tick(w2); }
    const s1 = snapshot(w1);
    const s2 = snapshot(w2);
    expect(JSON.stringify(s1.sectors)).not.toBe(JSON.stringify(s2.sectors));
  });

  it("RNG state is deterministic after tick", () => {
    let w = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    const states: number[] = [];
    for (let i = 0; i < 10; i++) {
      w = tick(w);
      states.push(w.rngState.callCount);
    }
    let w2 = createWorld(allSectors, emptyConfigs(), { seed: 42 });
    for (let i = 0; i < 10; i++) {
      w2 = tick(w2);
      expect(w2.rngState.callCount).toBe(states[i]);
    }
  });
});
