import { describe, it, expect } from "vitest";
import { mean, median, stdDev, ci95, cohensD, extractMetricValues, computeSummary } from "./stats.js";
import type { ExperimentRun, CounterfactualDiff, Intervention, SectorDiff, MetricDelta } from "./types.js";

describe("mean", () => {
  it("computes arithmetic mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(mean([])).toBe(0);
  });

  it("handles negative values", () => {
    expect(mean([-10, 0, 10])).toBe(0);
  });
});

describe("median", () => {
  it("returns middle value for odd-length array", () => {
    expect(median([1, 3, 5])).toBe(3);
  });

  it("returns average of two middle values for even-length array", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });

  it("sorts before computing", () => {
    expect(median([5, 1, 3])).toBe(3);
  });

  it("returns 0 for empty array", () => {
    expect(median([])).toBe(0);
  });
});

describe("stdDev", () => {
  it("computes sample standard deviation", () => {
    const result = stdDev([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result).toBeCloseTo(2.138, 2);
  });

  it("returns 0 for single element", () => {
    expect(stdDev([5])).toBe(0);
  });

  it("returns 0 for identical values", () => {
    expect(stdDev([3, 3, 3])).toBe(0);
  });
});

describe("ci95", () => {
  it("computes 95% confidence interval", () => {
    const values = [4.5, 5.0, 5.5, 4.8, 5.2];
    const ci = ci95(values);
    expect(ci.lower).toBeLessThan(ci.upper);
    expect(ci.lower).toBeGreaterThan(0);
  });

  it("returns 0/0 for fewer than 2 values", () => {
    const ci = ci95([5]);
    expect(ci.lower).toBe(0);
    expect(ci.upper).toBe(0);
  });
});

describe("cohensD", () => {
  it("returns 0 when groups are identical", () => {
    expect(cohensD([10, 10, 10], [10, 10, 10])).toBe(0);
  });

  it("returns positive when treatment > control", () => {
    const d = cohensD([1, 2, 3], [10, 11, 12]);
    expect(d).toBeGreaterThan(0);
  });

  it("returns negative when treatment < control", () => {
    const d = cohensD([10, 11, 12], [1, 2, 3]);
    expect(d).toBeLessThan(0);
  });
});

describe("extractMetricValues", () => {
  function makeRun(seed: number, path: string, delta: number): ExperimentRun {
    const metric: MetricDelta = { name: path.split(".").pop()!, path, parentValue: 100, branchValue: 100 + delta, absoluteDelta: delta, relativeDelta: delta };
    const sectorDiff: SectorDiff = { sectorId: "geopolitics", metrics: [metric], eventCounts: [], summary: "" };
    const diff: CounterfactualDiff = { branchId: "", parentUniverseId: "", rewindTick: 0, currentTick: 10, totalTicksElapsed: 10, capturedAt: "", perSector: { geopolitics: sectorDiff } };
    return { runId: `run-${seed}`, seed, rewindTick: 0, totalTicks: 10, intervention: { type: "test", label: "", description: "", params: {} }, diff, createdAt: "" };
  }

  it("extracts metric values across runs", () => {
    const runs = [makeRun(1, "gdp", 100), makeRun(2, "gdp", 200)];
    const values = extractMetricValues(runs, "gdp");
    expect(values).toEqual([100, 200]);
  });

  it("returns empty array when path not found", () => {
    const runs = [makeRun(1, "gdp", 100)];
    expect(extractMetricValues(runs, "nonexistent")).toEqual([]);
  });
});

describe("computeSummary", () => {
  function makeRun(seed: number, gdpDelta: number, tempDelta: number): ExperimentRun {
    const gdpMetric: MetricDelta = { name: "gdp", path: "nations.USA.gdp", parentValue: 1000, branchValue: 1000 + gdpDelta, absoluteDelta: gdpDelta, relativeDelta: (gdpDelta / 1000) * 100 };
    const tempMetric: MetricDelta = { name: "temperatureAnomaly", path: "temperatureAnomaly", parentValue: 1.2, branchValue: 1.2 + tempDelta, absoluteDelta: tempDelta, relativeDelta: (tempDelta / 1.2) * 100 };
    const geoDiff: SectorDiff = { sectorId: "geopolitics", metrics: [gdpMetric], eventCounts: [], summary: "" };
    const climateDiff: SectorDiff = { sectorId: "climate", metrics: [tempMetric], eventCounts: [], summary: "" };
    const diff: CounterfactualDiff = { branchId: "", parentUniverseId: "", rewindTick: 0, currentTick: 10, totalTicksElapsed: 10, capturedAt: "", perSector: { geopolitics: geoDiff, climate: climateDiff } };
    return { runId: `run-${seed}`, seed, rewindTick: 0, totalTicks: 10, intervention: { type: "relation_override", label: "Test", description: "", params: {} }, diff, createdAt: "" };
  }

  it("computes summary across multiple runs", () => {
    const intervention: Intervention = { type: "relation_override", label: "Friendly USA-CHN", description: "Override relations", params: {} };
    const runs = [makeRun(1, 100, 0.3), makeRun(2, 150, 0.5), makeRun(3, 200, 0.1)];

    const summary = computeSummary(runs, intervention);

    expect(summary.n).toBe(3);
    expect(summary.seeds).toEqual([1, 2, 3]);
    expect(summary.intervention.type).toBe("relation_override");

    const gdpStat = summary.metrics.find((m) => m.path === "nations.USA.gdp");
    expect(gdpStat).toBeDefined();
    expect(gdpStat!.mean).toBe(150);

    const tempStat = summary.metrics.find((m) => m.path === "temperatureAnomaly");
    expect(tempStat).toBeDefined();
    expect(tempStat!.mean).toBe(0.3);
  });
});
