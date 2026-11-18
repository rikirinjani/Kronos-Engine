import { describe, it, expect } from "vitest";
import { getAllSentinels, TOTAL_SENTINELS, HOSPITAL_REGIONS } from "./indonesian-hospitals.js";
import { createSentinels, getHospitalSeed } from "../sectors/deers-rock-adapter.js";
import type { DeersRockSectorState } from "../sectors/deers-rock-adapter.js";
import { createWorld, run } from "../engine/index.js";
import { createGeopoliticsSector } from "../sectors/geopolitics.js";
import { createClimateSector } from "../sectors/climate.js";
import { createEconomySector } from "../sectors/economy.js";
import { createTechnologySector } from "../sectors/technology.js";
import type { Sector } from "../sectors/types.js";
import { resetUniverseCounter } from "../engine/universe.js";

describe("Sentinel Network", () => {
  it(`defines ${TOTAL_SENTINELS} hospitals across 5 regions`, () => {
    expect(TOTAL_SENTINELS).toBeGreaterThanOrEqual(30);
    expect(HOSPITAL_REGIONS).toHaveLength(5);

    const allIds = getAllSentinels().map((h) => h.id);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it("createSentinels returns sectors sorted by id", () => {
    const configs = getAllSentinels().slice(0, 5);
    const sectors = createSentinels(configs, 42);

    expect(sectors).toHaveLength(5);
    for (let i = 1; i < sectors.length; i++) {
      expect(sectors[i]!.id.localeCompare(sectors[i - 1]!.id)).toBeGreaterThanOrEqual(0);
    }
  });

  it("each sentinel has unique derived seed from its numeric id suffix", () => {
    const seeds = new Set<number>();
    for (let i = 0; i < getAllSentinels().length; i++) {
      const seed = getHospitalSeed(42, i + 1);
      seeds.add(seed);
    }
    expect(seeds.size).toBe(getAllSentinels().length);
  });

  it("different worldSeed produces different sentinel seeds", () => {
    const seedA = getHospitalSeed(42, 1);
    const seedB = getHospitalSeed(99, 1);
    expect(seedA).not.toBe(seedB);
  });

  it("all 30 sentinels initialize independently", () => {
    const configs = getAllSentinels();
    const sectors = createSentinels(configs, 42);

    for (const sector of sectors) {
      const state = sector.init(42, {}) as DeersRockSectorState;
      expect(state._sectorId).toBe("deers-rock");
      expect(state.world).toBeDefined();
      expect(state.config.id).toMatch(/^[a-z]{3}-\d{3}$/);
    }
  });

  it("multiple sentinels in a world tick without error", () => {
    resetUniverseCounter();

    const configs = getAllSentinels().slice(0, 5);
    const sectorDefs: Sector[] = [
      createGeopoliticsSector(),
      createClimateSector(),
      createEconomySector(),
      createTechnologySector(),
      ...createSentinels(configs, 42),
    ];

    const configsMap: Record<string, Record<string, unknown>> = {
      geopolitics: { year: 2026, nations: [], wars: [], alliances: [] },
      climate: { year: 2026, co2Concentration: 420, annualEmissions: 37 },
      economy: { year: 2026, nations: {} },
      technology: { year: 2026, nations: {} },
    };

    const world = createWorld(sectorDefs, configsMap, { seed: 42 });
    expect(world.sectors.size).toBe(4 + 5);

    const next = run(world, 3);
    expect(next.tick).toBe(3);
  });
});
