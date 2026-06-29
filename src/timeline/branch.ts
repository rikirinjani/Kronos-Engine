import { tick, snapshot, restoreSnapshot } from "../engine/world-engine.js";
import { branchUniverse } from "../engine/universe.js";
import type { WorldState, WorldSnapshot } from "../engine/world-engine.js";
import type { UniverseID } from "../engine/universe.js";
import type { SectorState } from "../sectors/types.js";
import type { Sector } from "../sectors/types.js";
import type { RewindPoint } from "./rewind-point.js";

export type Intervention = Record<string, Record<string, unknown>>;

export interface CounterfactualDiff {
  sectorDiffs: Record<string, SectorDiff>;
  summary: string[];
}

export interface SectorDiff {
  sectorId: string;
  numericDeltas: Record<string, number>;
  structuralChanges: string[];
}

export interface Branch {
  id: string;
  parentUniverse: string;
  parentRewindPoint: string;
  rewindTick: number;
  intervention: Intervention;
  interventionLabel: string;
  childUniverse: UniverseID;
  childSnapshot: WorldSnapshot;
  parentSnapshot: WorldSnapshot;
  outcomeDiff: CounterfactualDiff;
  created: string;
}

let _bCounter = 0;
const YEAR = new Date().getFullYear();

function nextBranchId(): string {
  _bCounter++;
  return `B-${YEAR}-${String(_bCounter).padStart(4, "0")}`;
}

export function resetBranchCounter(): void {
  _bCounter = 0;
}

function extractNumericValues(obj: Record<string, unknown>, prefix: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") {
      result[k] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, extractNumericValues(value as Record<string, unknown>, k));
    }
  }
  return result;
}

function computeDiff(
  parentSnap: WorldSnapshot,
  childSnap: WorldSnapshot,
): CounterfactualDiff {
  const sectorDiffs: Record<string, SectorDiff> = {};
  const summary: string[] = [];

  const parentSectors = new Map(parentSnap.sectors.map((s) => [s.id, s.state]));
  const childSectors = new Map(childSnap.sectors.map((s) => [s.id, s.state]));

  const allIds = new Set([...parentSectors.keys(), ...childSectors.keys()]);

  for (const id of allIds) {
    const parentState = parentSectors.get(id);
    const childState = childSectors.get(id);
    if (!parentState || !childState) {
      summary.push(`${id}: sector appeared or disappeared`);
      continue;
    }

    const parentNumerics = extractNumericValues(parentState as unknown as Record<string, unknown>, "");
    const childNumerics = extractNumericValues(childState as unknown as Record<string, unknown>, "");

    const numericDeltas: Record<string, number> = {};
    const allKeys = new Set([...Object.keys(parentNumerics), ...Object.keys(childNumerics)]);
    for (const k of allKeys) {
      const pv = parentNumerics[k];
      const cv = childNumerics[k];
      if (pv !== undefined && cv !== undefined && pv !== cv) {
        numericDeltas[k] = cv - pv;
      }
    }

    const structuralChanges: string[] = [];
    const pKeys = new Set(Object.keys(parentState as object));
    const cKeys = new Set(Object.keys(childState as object));
    for (const k of pKeys) {
      if (!cKeys.has(k)) structuralChanges.push(`removed: ${k}`);
    }
    for (const k of cKeys) {
      if (!pKeys.has(k)) structuralChanges.push(`added: ${k}`);
    }

    sectorDiffs[id] = { sectorId: id, numericDeltas, structuralChanges };

    if (Object.keys(numericDeltas).length > 0) {
      summary.push(`${id}: ${Object.keys(numericDeltas).length} numeric deltas`);
    }
    if (structuralChanges.length > 0) {
      summary.push(`${id}: ${structuralChanges.length} structural changes`);
    }
  }

  return { sectorDiffs, summary };
}

function patchState(
  state: SectorState,
  intervention: Record<string, unknown>,
  path: string[],
): SectorState {
  const result: Record<string, unknown> = { ...(state as unknown as Record<string, unknown>) };
  for (const [key, value] of Object.entries(intervention)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value) && typeof result[key] === "object" && result[key] !== null) {
      result[key] = patchState(result[key] as SectorState, value as Record<string, unknown>, [...path, key]);
    } else {
      result[key] = value;
    }
  }
  return result as unknown as SectorState;
}

function applyIntervention(
  world: WorldState,
  intervention: Intervention,
): WorldState {
  const newSectors = new Map(world.sectors);
  for (const [sectorId, overrides] of Object.entries(intervention)) {
    const record = newSectors.get(sectorId);
    if (!record) continue;
    newSectors.set(sectorId, {
      sector: record.sector,
      state: patchState(record.state, overrides, []),
    });
  }
  return {
    ...world,
    sectors: newSectors,
  };
}

export function forkBranch(
  parentWorld: WorldState,
  rewindPoint: RewindPoint,
  intervention: Intervention,
  sectorMap: Map<string, Sector>,
  runTicks: number,
  label?: string,
): Branch {
  const parentSnap = snapshot(parentWorld);

  const childUniverse = branchUniverse(
    parentWorld.universe,
    rewindPoint.tick,
    JSON.stringify(intervention),
    label,
  );

  const rewindSnap: WorldSnapshot = {
    tick: rewindPoint.tick,
    rngState: rewindPoint.rngState,
    sectors: Object.entries(rewindPoint.sectorStates).map(([id, state]) => ({
      id,
      state,
    })),
    universeId: rewindPoint.universeId,
  };

  const restored = restoreSnapshot(rewindSnap, sectorMap);
  const patchedWorld: WorldState = {
    ...restored,
    universe: childUniverse,
  };
  const intervened = applyIntervention(patchedWorld, intervention);

  let current = intervened;
  for (let i = 0; i < runTicks; i++) {
    current = tick(current);
  }

  const childSnap = snapshot(current);
  const outcomeDiff = computeDiff(parentSnap, childSnap);

  return {
    id: nextBranchId(),
    parentUniverse: parentWorld.universe.id,
    parentRewindPoint: rewindPoint.id,
    rewindTick: rewindPoint.tick,
    intervention,
    interventionLabel: label ?? `Intervention at tick ${rewindPoint.tick}`,
    childUniverse,
    childSnapshot: childSnap,
    parentSnapshot: parentSnap,
    outcomeDiff,
    created: new Date().toISOString(),
  };
}
