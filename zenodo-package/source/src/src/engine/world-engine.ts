import { createEventBus } from "../sectors/event-bus.js";
import type { Sector, SectorState, WorldEvent } from "../sectors/types.js";
import { createRNG, restoreRNG } from "./rng.js";
import type { RNGState } from "./rng.js";
import { createUniverse } from "./universe.js";
import type { UniverseID } from "./universe.js";
import { deepClone, reconstructFromSnapshot } from "./clone.js";

export interface SectorRecord {
  sector: Sector;
  state: SectorState;
}

export interface WorldState {
  tick: number;
  sectors: Map<string, SectorRecord>;
  rngState: RNGState;
  universe: UniverseID;
}

export interface WorldSnapshot {
  tick: number;
  rngState: RNGState;
  sectors: Array<{ id: string; state: SectorState }>;
  universeId: string;
  /**
   * Optional reconstruct functions for Snapshotable sector states.
   * When present, restoreSnapshot uses these instead of deepClone.
   */
  sectorReconstructors?: Record<string, (canonicalState: unknown) => SectorState>;
}

export interface WorldConfig {
  seed?: number;
  universe?: UniverseID;
}

export function createWorld(
  sectorDefs: Sector[],
  configs: Record<string, Record<string, unknown>>,
  config?: WorldConfig,
): WorldState {
  const seed = config?.seed ?? 42;
  const universe = config?.universe ?? createUniverse(seed);
  const rng = createRNG(seed);

  const sectors = new Map<string, SectorRecord>();
  for (const sector of sectorDefs) {
    const sectorConfig = configs[sector.id] ?? {};
    const state = sector.init(rng.next() * 0x7fffffff, sectorConfig);
    sectors.set(sector.id, { sector, state });
  }

  return {
    tick: 0,
    sectors,
    rngState: rng.save(),
    universe,
  };
}

function applyCrossSectorEvents(
  sectors: Map<string, SectorRecord>,
  events: WorldEvent[],
): Map<string, SectorRecord> {
  const updated = new Map(sectors);

  for (const event of events) {
    for (const [id, record] of updated) {
      for (const handler of record.sector.handlers) {
        if (handler.eventType === event.type) {
          const newState = handler.handle(event, record.state);
          updated.set(id, { sector: record.sector, state: newState });
        }
      }
    }
  }

  return updated;
}

export function tick(world: WorldState): WorldState {
  const nextTick = world.tick + 1;
  const eventBus = createEventBus();
  const rng = restoreRNG(world.rngState);
  const ctx = { tick: nextTick, rng, eventBus };

  const tickedSectors = new Map<string, SectorRecord>();
  for (const [id, record] of world.sectors) {
    const cadence = record.sector.cadence ?? 1;
    const isDue = nextTick % cadence === 0;
    const newState = isDue ? record.sector.tick(record.state, ctx) : record.state;
    tickedSectors.set(id, { sector: record.sector, state: newState });
  }

  const pending = eventBus.pending();
  const finalSectors = applyCrossSectorEvents(tickedSectors, pending);

  return {
    tick: nextTick,
    sectors: finalSectors,
    rngState: rng.save(),
    universe: world.universe,
  };
}

export function run(world: WorldState, steps: number): WorldState {
  let current = world;
  for (let i = 0; i < steps; i++) {
    current = tick(current);
  }
  return current;
}

export function snapshot(world: WorldState): WorldSnapshot {
  const sectors: Array<{ id: string; state: SectorState }> = [];
  for (const [id, record] of world.sectors) {
    sectors.push({ id, state: deepClone(record.state) });
  }
  return {
    tick: world.tick,
    rngState: { ...world.rngState },
    sectors,
    universeId: world.universe.id,
  };
}

export function restoreSnapshot(snap: WorldSnapshot, sectorMap: Map<string, Sector>): WorldState {
  const rng = restoreRNG(snap.rngState);

  const universe: UniverseID = {
    id: snap.universeId,
    rngSeed: snap.rngState.seed,
    parent: null,
    rewindTick: null,
    intervention: null,
    created: new Date().toISOString(),
    label: `Restored from snapshot at tick ${snap.tick}`,
  };

  const sectors = new Map<string, SectorRecord>();
  for (const s of snap.sectors) {
    const sector = sectorMap.get(s.id);
    if (!sector) {
      throw new Error(`Unknown sector: ${s.id}`);
    }
    // Use sectorReconstructors if available — this rebuilds fresh runtime instances
    // from canonical state, avoiding class-instance and closure aliasing.
    const reconstruct = snap.sectorReconstructors?.[s.id];
    const state = reconstruct
      ? reconstruct(s.state)
      : deepClone(s.state);
    sectors.set(s.id, { sector, state });
  }

  return {
    tick: snap.tick,
    sectors,
    rngState: snap.rngState,
    universe,
  };
}
