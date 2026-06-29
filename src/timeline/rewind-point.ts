import { hashState } from "./hash.js";
import type { RNGState } from "../engine/rng.js";
import type { WorldState } from "../engine/world-engine.js";
import type { WorldSnapshot } from "../engine/world-engine.js";
import type { SectorState } from "../sectors/types.js";
import type { StrategicWorldState } from "./history-types.js";

export type RewindOrigin = "preseeded" | "runtime" | "branch";

export interface RewindPoint {
  id: string;
  universeId: string;
  tick: number;
  label: string;
  origin: RewindOrigin;
  sectorStates: Record<string, SectorState>;
  stateHash: string;
  rngState: RNGState;
  historicalContext?: {
    era: string;
    year: number;
    calendarDate: string;
    dataPackage: StrategicWorldState;
  };
  created: string;
  parentRewindPoint?: string;
  tags: string[];
}

export interface RewindPointStore {
  add(point: RewindPoint): void;
  get(id: string): RewindPoint | undefined;
  findByTick(tick: number, universeId: string): RewindPoint[];
  findByUniverse(universeId: string): RewindPoint[];
  list(): RewindPoint[];
  verify(id: string): boolean;
}

let _rwCounter = 0;
const YEAR = new Date().getFullYear();

export function resetRewindCounter(): void {
  _rwCounter = 0;
}

function nextRewindId(): string {
  _rwCounter++;
  return `RP-${YEAR}-${String(_rwCounter).padStart(4, "0")}`;
}

export function createRewindPoint(
  world: WorldState,
  origin: RewindOrigin,
  overrides?: {
    label?: string;
    tags?: string[];
    historicalContext?: RewindPoint["historicalContext"];
    parentRewindPoint?: string;
  },
): RewindPoint {
  const sectorStates: Record<string, SectorState> = {};
  for (const [id, record] of world.sectors) {
    sectorStates[id] = record.state;
  }

  const rp: RewindPoint = {
    id: nextRewindId(),
    universeId: world.universe.id,
    tick: world.tick,
    label: overrides?.label ?? `Snapshot at tick ${world.tick}`,
    origin,
    sectorStates,
    stateHash: "",
    rngState: world.rngState,
    created: new Date().toISOString(),
    tags: overrides?.tags ?? [],
  };

  if (overrides?.historicalContext) {
    rp.historicalContext = overrides.historicalContext;
  }
  if (overrides?.parentRewindPoint) {
    rp.parentRewindPoint = overrides.parentRewindPoint;
  }

  rp.stateHash = hashState({
    tick: rp.tick,
    sectorStates: rp.sectorStates,
    rngState: rp.rngState,
  });

  return rp;
}

export function createInMemoryStore(): RewindPointStore {
  const points = new Map<string, RewindPoint>();

  return {
    add(point: RewindPoint): void {
      points.set(point.id, point);
    },

    get(id: string): RewindPoint | undefined {
      return points.get(id);
    },

    findByTick(tick: number, universeId: string): RewindPoint[] {
      return [...points.values()].filter(
        (p) => p.tick === tick && p.universeId === universeId,
      );
    },

    findByUniverse(universeId: string): RewindPoint[] {
      return [...points.values()].filter(
        (p) => p.universeId === universeId,
      );
    },

    list(): RewindPoint[] {
      return [...points.values()];
    },

    verify(id: string): boolean {
      const point = points.get(id);
      if (!point) return false;

      const expectedHash = hashState({
        tick: point.tick,
        sectorStates: point.sectorStates,
        rngState: point.rngState,
      });

      return point.stateHash === expectedHash;
    },
  };
}

export function rewindToSnapshot(point: RewindPoint): WorldSnapshot {
  const sectors: WorldSnapshot["sectors"] = [];
  for (const [id, state] of Object.entries(point.sectorStates)) {
    sectors.push({ id, state });
  }
  return {
    tick: point.tick,
    rngState: point.rngState,
    sectors,
    universeId: point.universeId,
  };
}
