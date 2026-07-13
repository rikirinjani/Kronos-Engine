import { describe, it, expect } from "vitest";
import { TabFMBridge } from "./tabfm-bridge.js";
import type { ExperimentRun, CounterfactualDiff, SectorDiff, MetricDelta } from "../experiment/types.js";

function makeMockRun(gdpDelta: number, tempDelta: number, occDelta: number): ExperimentRun {
  const gdpMetric: MetricDelta = { name: "gdp", path: "nations.USA.gdp", parentValue: 1000, branchValue: 1000 + gdpDelta, absoluteDelta: gdpDelta, relativeDelta: gdpDelta / 10 };
  const tempMetric: MetricDelta = { name: "temperatureAnomaly", path: "temperatureAnomaly", parentValue: 1.0, branchValue: 1.0 + tempDelta, absoluteDelta: tempDelta, relativeDelta: tempDelta };
  const occMetric: MetricDelta = { name: "occupancyRate", path: "occupancyRate", parentValue: 0.5, branchValue: 0.5 + occDelta, absoluteDelta: occDelta, relativeDelta: occDelta };
  const sectorDiff: SectorDiff = { sectorId: "geopolitics", metrics: [gdpMetric], eventCounts: [], summary: "" };
  const climateDiff: SectorDiff = { sectorId: "climate", metrics: [tempMetric], eventCounts: [], summary: "" };
  const healthDiff: SectorDiff = { sectorId: "deers-rock-mks-001", metrics: [occMetric], eventCounts: [], summary: "" };
  const diff: CounterfactualDiff = { branchId: "", parentUniverseId: "", rewindTick: 0, currentTick: 20, totalTicksElapsed: 20, capturedAt: "", perSector: { geopolitics: sectorDiff, climate: climateDiff, health: healthDiff } };
  return { runId: "", seed: 42, rewindTick: 0, totalTicks: 20, intervention: { type: "test", label: "", description: "", params: {} }, diff, createdAt: "" };
}

describe("TabFMBridge", () => {
  const bridge = new TabFMBridge({ baseUrl: "http://127.0.0.1:8001" });

  it("constructs feature vectors from experiment runs", () => {
    const run = makeMockRun(31.3e9, 3.6, 0.15);
    const features = (bridge as unknown as { runToFeatures(r: ExperimentRun): Record<string, number> }).runToFeatures(run);
    expect(features.gdp_mean_delta).toBeCloseTo(31.3, 1);
    expect(features.temperature_anomaly).toBeCloseTo(3.6, 1);
    expect(features.occupancy_rate).toBeCloseTo(0.15, 2);
    expect(features.war_count_delta).toBe(0);
  });

  it("handles empty runs gracefully", () => {
    const emptyRun = makeMockRun(0, 0, 0);
    const features = (bridge as unknown as { runToFeatures(r: ExperimentRun): Record<string, number> }).runToFeatures(emptyRun);
    expect(features.gdp_mean_delta).toBe(0);
    expect(features.temperature_anomaly).toBe(0);
  });
});
