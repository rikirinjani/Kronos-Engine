import { describe, it, expect } from "vitest";
import { computeMetricDeltas, compareSectorStates, buildFullDiff } from "./diff-engine.js";
import type { SectorState, WorldEvent } from "../sectors/types.js";

describe("computeMetricDeltas", () => {
  it("returns empty array for identical states", () => {
    const deltas = computeMetricDeltas({ a: 10, b: 20 }, { a: 10, b: 20 });
    expect(deltas).toHaveLength(0);
  });

  it("detects simple numeric deltas", () => {
    const deltas = computeMetricDeltas({ gdp: 1000 }, { gdp: 1100 });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.path).toBe("gdp");
    expect(deltas[0]!.absoluteDelta).toBe(100);
    expect(deltas[0]!.relativeDelta).toBe(10);
  });

  it("detects negative deltas", () => {
    const deltas = computeMetricDeltas({ population: 100 }, { population: 90 });
    expect(deltas[0]!.absoluteDelta).toBe(-10);
    expect(deltas[0]!.relativeDelta).toBe(-10);
  });

  it("handles new keys in branch", () => {
    const deltas = computeMetricDeltas({ a: 10 }, { a: 10, b: 5 });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.path).toBe("b");
    expect(deltas[0]!.parentValue).toBe(0);
    expect(deltas[0]!.branchValue).toBe(5);
  });

  it("handles removed keys in branch", () => {
    const deltas = computeMetricDeltas({ a: 10, b: 5 }, { a: 10 });
    expect(deltas).toHaveLength(1);
    expect(deltas[0]!.path).toBe("b");
    expect(deltas[0]!.branchValue).toBe(0);
  });

  it("ignores sub-epsilon differences", () => {
    const deltas = computeMetricDeltas({ a: 1e-13 }, { a: 2e-13 });
    expect(deltas).toHaveLength(0);
  });

  it("computes percentage correctly when parent is zero and branch is non-zero", () => {
    const deltas = computeMetricDeltas({ a: 0 }, { a: 50 });
    expect(deltas[0]!.relativeDelta).toBe(Infinity);
  });
});

describe("compareSectorStates", () => {
  function makeState(overrides: Record<string, unknown>): SectorState {
    return { _sectorId: "test", ...overrides } as SectorState;
  }

  it("compares two states and returns metrics", () => {
    const parent = makeState({ _sectorId: "test", value: 100, nested: { x: 10 } });
    const branch = makeState({ _sectorId: "test", value: 120, nested: { x: 15 } });

    const result = compareSectorStates(parent, branch, [], []);

    expect(result.sectorId).toBe("test");
    expect(result.metrics.length).toBeGreaterThanOrEqual(2);
    const valueMetric = result.metrics.find((m) => m.path === "value");
    expect(valueMetric).toBeDefined();
    expect(valueMetric!.absoluteDelta).toBe(20);
  });

  it("counts event diffs", () => {
    const parent = makeState({ _sectorId: "test" });
    const branch = makeState({ _sectorId: "test" });
    const parentEvents: WorldEvent[] = [
      { type: "war_start", source: "geopolitics", data: {}, tick: 1 },
    ];
    const branchEvents: WorldEvent[] = [
      { type: "war_start", source: "geopolitics", data: {}, tick: 1 },
      { type: "war_start", source: "geopolitics", data: {}, tick: 2 },
      { type: "relation_shift", source: "geopolitics", data: {}, tick: 3 },
    ];

    const result = compareSectorStates(parent, branch, parentEvents, branchEvents);

    const warEvent = result.eventCounts.find((e) => e.eventType === "war_start");
    expect(warEvent).toBeDefined();
    expect(warEvent!.parentCount).toBe(1);
    expect(warEvent!.branchCount).toBe(2);
    expect(warEvent!.delta).toBe(1);
  });

  it("produces a non-empty summary when diffs exist", () => {
    const parent = makeState({ _sectorId: "test", gdp: 1000 });
    const branch = makeState({ _sectorId: "test", gdp: 1500 });

    const result = compareSectorStates(parent, branch, [], []);
    expect(result.summary).toContain("gdp");
  });

  it("handles array length tracking", () => {
    const parent = makeState({ _sectorId: "test", items: [1, 2, 3] });
    const branch = makeState({ _sectorId: "test", items: [1, 2, 3, 4, 5] });

    const result = compareSectorStates(parent, branch, [], []);
    const lenMetric = result.metrics.find((m) => m.path === "items.length");
    expect(lenMetric).toBeDefined();
    expect(lenMetric!.absoluteDelta).toBe(2);
  });
});

describe("buildFullDiff", () => {
  it("builds a CounterfactualDiff from multiple sector comparisons", () => {
    const parentGeo = { _sectorId: "geopolitics", wars: { w1: { casualties: 100 } } } as unknown as SectorState;
    const branchGeo = { _sectorId: "geopolitics", wars: { w1: { casualties: 350 } } } as unknown as SectorState;
    const parentClim = { _sectorId: "climate", temperatureAnomaly: 1.2 } as unknown as SectorState;
    const branchClim = { _sectorId: "climate", temperatureAnomaly: 1.5 } as unknown as SectorState;

    const sectors = new Map([
      ["geopolitics", { parent: parentGeo, branch: branchGeo, parentEvents: [], branchEvents: [] }],
      ["climate", { parent: parentClim, branch: branchClim, parentEvents: [], branchEvents: [] }],
    ]);

    const diff = buildFullDiff("B-2026-0001", "U-2026-0000", 10, 50, sectors);

    expect(diff.branchId).toBe("B-2026-0001");
    expect(diff.parentUniverseId).toBe("U-2026-0000");
    expect(diff.rewindTick).toBe(10);
    expect(diff.currentTick).toBe(50);
    expect(diff.totalTicksElapsed).toBe(40);
    expect(Object.keys(diff.perSector)).toEqual(["geopolitics", "climate"]);
  });
});
