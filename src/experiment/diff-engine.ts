import type { SectorState, WorldEvent } from "../sectors/types.js";
import type { MetricDelta, EventCountDiff, SectorDiff, CounterfactualDiff } from "./types.js";

function extractNumericPaths(obj: Record<string, unknown>, prefix = ""): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "number") {
      result[path] = value;
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(result, extractNumericPaths(value as Record<string, unknown>, path));
    } else if (Array.isArray(value)) {
      result[`${path}.length`] = value.length;
    }
  }
  return result;
}

export function computeMetricDeltas(
  parent: Record<string, number>,
  branch: Record<string, number>,
): MetricDelta[] {
  const allKeys = new Set([...Object.keys(parent), ...Object.keys(branch)]);
  const deltas: MetricDelta[] = [];

  for (const key of allKeys) {
    const parentValue = parent[key] ?? 0;
    const branchValue = branch[key] ?? 0;
    const absoluteDelta = branchValue - parentValue;
    const relativeDelta = parentValue !== 0 ? (absoluteDelta / parentValue) * 100 : absoluteDelta !== 0 ? Infinity : 0;

    if (Math.abs(absoluteDelta) < 1e-12) continue;

    deltas.push({
      name: key.includes(".") ? key.split(".").pop()! : key,
      path: key,
      parentValue,
      branchValue,
      absoluteDelta,
      relativeDelta: Math.round(relativeDelta * 100) / 100,
    });
  }

  return deltas;
}

function computeEventCountDiffs(
  parentEvents: WorldEvent[],
  branchEvents: WorldEvent[],
): EventCountDiff[] {
  const parentByType = new Map<string, number>();
  const branchByType = new Map<string, number>();

  for (const e of parentEvents) {
    parentByType.set(e.type, (parentByType.get(e.type) ?? 0) + 1);
  }
  for (const e of branchEvents) {
    branchByType.set(e.type, (branchByType.get(e.type) ?? 0) + 1);
  }

  const allTypes = new Set([...parentByType.keys(), ...branchByType.keys()]);
  const diffs: EventCountDiff[] = [];

  for (const eventType of allTypes) {
    const parentCount = parentByType.get(eventType) ?? 0;
    const branchCount = branchByType.get(eventType) ?? 0;
    const delta = branchCount - parentCount;
    if (delta !== 0) {
      diffs.push({ eventType, parentCount, branchCount, delta });
    }
  }

  return diffs.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function generateSummary(metrics: MetricDelta[], eventDiffs: EventCountDiff[]): string {
  const parts: string[] = [];

  const sorted = [...metrics].sort((a, b) => Math.abs(b.absoluteDelta) - Math.abs(a.absoluteDelta));
  const top = sorted.slice(0, 5);

  if (top.length > 0) {
    const lines = top.map(
      (m) => `${m.path}: ${m.parentValue.toFixed(2)} → ${m.branchValue.toFixed(2)} (${m.relativeDelta > 0 ? "+" : ""}${m.relativeDelta.toFixed(1)}%)`,
    );
    parts.push(`Top metric changes: ${lines.join("; ")}`);
  }

  const eventChanges = eventDiffs.filter((e) => e.delta !== 0);
  if (eventChanges.length > 0) {
    const lines = eventChanges.map(
      (e) => `${e.eventType}: ${e.parentCount} → ${e.branchCount} (${e.delta > 0 ? "+" : ""}${e.delta})`,
    );
    parts.push(`Event count changes: ${lines.join("; ")}`);
  }

  return parts.join(" | ");
}

export function compareSectorStates(
  parentState: SectorState,
  branchState: SectorState,
  parentEvents: WorldEvent[],
  branchEvents: WorldEvent[],
): SectorDiff {
  const parentNumeric = extractNumericPaths(parentState as unknown as Record<string, unknown>);
  const branchNumeric = extractNumericPaths(branchState as unknown as Record<string, unknown>);
  const metrics = computeMetricDeltas(parentNumeric, branchNumeric);
  const eventCounts = computeEventCountDiffs(parentEvents, branchEvents);

  return {
    sectorId: parentState._sectorId,
    metrics,
    eventCounts,
    summary: generateSummary(metrics, eventCounts),
  };
}

export function buildFullDiff(
  branchId: string,
  parentUniverseId: string,
  rewindTick: number,
  currentTick: number,
  sectorStates: Map<string, { parent: SectorState; branch: SectorState; parentEvents: WorldEvent[]; branchEvents: WorldEvent[] }>,
): CounterfactualDiff {
  const perSector: Record<string, SectorDiff> = {};

  for (const [sectorId, data] of sectorStates) {
    perSector[sectorId] = compareSectorStates(
      data.parent,
      data.branch,
      data.parentEvents,
      data.branchEvents,
    );
  }

  return {
    branchId,
    parentUniverseId,
    rewindTick,
    currentTick,
    totalTicksElapsed: currentTick - rewindTick,
    capturedAt: new Date().toISOString(),
    perSector,
  };
}
