import { describe, it, expect } from "vitest";
import {
  mean, median, stdDev, ci95, cohensD, cohensDz,
  extractMetricValues, computeSummary, twoSidedPValue, tCdf,
  bhAdjustedPValues, bonferroniAdjustedP, SIGNIFICANCE_LEVEL,
} from "./stats.js";
import type { ExperimentRun, CounterfactualDiff, Intervention, SectorDiff, MetricDelta } from "./types.js";

/** Build a run whose diff contributes one metric entry with the given delta. */
function makeRun(seed: number, path: string, delta: number, name = path.split(".").pop()!): ExperimentRun {
  const metric: MetricDelta = { name, path, parentValue: 100, branchValue: 100 + delta, absoluteDelta: delta, relativeDelta: delta };
  const sectorDiff: SectorDiff = { sectorId: "geopolitics", metrics: [metric], eventCounts: [], summary: "" };
  const diff: CounterfactualDiff = { branchId: "", parentUniverseId: "", rewindTick: 0, currentTick: 10, totalTicksElapsed: 10, capturedAt: "", perSector: { geopolitics: sectorDiff } };
  return { runId: `run-${seed}`, seed, rewindTick: 0, totalTicks: 10, intervention: { type: "test", label: "", description: "", params: {} }, diff, createdAt: "" };
}

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

describe("twoSidedPValue (t-distribution)", () => {
  it("matches known reference values (scipy.stats.t)", () => {
    // values [1,2,3,4,5]: mean=3, sd=sqrt(2.5), t=3/(sd/sqrt(5)) = 4.24264069, df=4
    expect(Math.abs(twoSidedPValue(4.24264069, 4) - 0.0132355995)).toBeLessThan(1e-6);
    // critical values that give exactly p = 0.05 (two-sided)
    expect(Math.abs(twoSidedPValue(12.7062, 1) - 0.05)).toBeLessThan(1e-3);
    expect(Math.abs(twoSidedPValue(2.7764, 4) - 0.05)).toBeLessThan(1e-3);
    expect(Math.abs(twoSidedPValue(2.2281, 10) - 0.05)).toBeLessThan(1e-3);
    expect(Math.abs(twoSidedPValue(2.0452, 29) - 0.05)).toBeLessThan(1e-3);
  });

  it("computes the correct p-value through computeSummary", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    // per-seed deltas [1,2,3,4,5] -> one-sample t = 4.2426, df = 4
    const runs = [1, 2, 3, 4, 5].map((delta, i) => makeRun(42 + i, "gdp", delta));
    const summary = computeSummary(runs, intervention);
    const stat = summary.metrics.find((m) => m.path === "gdp")!;
    expect(stat.df).toBe(4);
    expect(Math.abs(stat.pValue - 0.0132355995)).toBeLessThan(1e-6);
    // p < alpha -> significant, but d = mean/sd = 3/1.581 = 1.897 (not sqrt(2)-inflated)
    expect(stat.significant).toBe(true);
    expect(Math.abs(stat.cohensD - 1.9)).toBeLessThan(0.01);
  });

  it("handles edge cases (n<2 -> NaN, t=0 -> 1, symmetry)", () => {
    expect(twoSidedPValue(1, 0)).toBeNaN();
    expect(twoSidedPValue(NaN, 5)).toBeNaN();
    expect(twoSidedPValue(0, 5)).toBe(1);
    expect(tCdf(0, 5)).toBeCloseTo(0.5, 10);
    expect(Math.abs(tCdf(2.228, 10) + tCdf(-2.228, 10) - 1)).toBeLessThan(1e-9);
  });
});

describe("cohensDz (one-sample effect size)", () => {
  it("computes dz = mean / sd", () => {
    expect(Math.abs(cohensDz([1, 2, 3, 4, 5]) - 1.8974)).toBeLessThan(0.001);
  });

  it("returns 0 for zero-variance and undersized samples", () => {
    expect(cohensDz([5, 5, 5])).toBe(0);
    expect(cohensDz([7])).toBe(0);
  });
});

describe("multiplicity correction (BH-FDR + Bonferroni)", () => {
  it("computes BH step-up adjusted p-values and ordering", () => {
    const p = [0.001, 0.01, 0.03, 0.05, 0.2, 0.3];
    const q = bhAdjustedPValues(p);
    // hand-computed q-values (m=6): q_i = min_{k>=i} min(1, (6/k) p_k)
    expect(Math.abs(q[0]! - 0.006)).toBeLessThan(1e-9);
    expect(Math.abs(q[1]! - 0.03)).toBeLessThan(1e-9);
    expect(Math.abs(q[2]! - 0.06)).toBeLessThan(1e-9);
    expect(Math.abs(q[3]! - 0.075)).toBeLessThan(1e-9);
    expect(Math.abs(q[4]! - 0.24)).toBeLessThan(1e-9);
    expect(Math.abs(q[5]! - 0.3)).toBeLessThan(1e-9);
    // monotone non-decreasing in p (valid q-value property)
    for (let i = 1; i < q.length; i++) expect(q[i]!).toBeGreaterThanOrEqual(q[i - 1]!);
    // step-up: largest k with p_(k) <= (k/m)*alpha is k=2 -> exactly 2 significant
    expect(q.filter((qi) => qi! < SIGNIFICANCE_LEVEL).length).toBe(2);
  });

  it("passes NaN through untouched", () => {
    const q = bhAdjustedPValues([0.001, NaN, 0.01]);
    expect(q[0]).toBeCloseTo(0.002, 10);
    expect(q[1]).toBeNaN();
    expect(q[2]).toBeCloseTo(0.01, 10);
  });

  it("applies Bonferroni adjustment", () => {
    expect(bonferroniAdjustedP(0.001, 20)).toBeCloseTo(0.02, 10);
    expect(bonferroniAdjustedP(0.9, 20)).toBe(1);
    expect(bonferroniAdjustedP(NaN, 20)).toBeNaN();
  });

  it("flags exactly the true signals under FDR across 20 metrics", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    const signalPaths = ["signal.a", "signal.b"];
    const noisePaths = Array.from({ length: 18 }, (_, i) => `noise.m${i}`);
    // degenerate metric: constant delta across seeds -> sd == 0
    const degeneratePath = "noise.constant";

    const runs = [42, 43, 44, 45, 46, 47].map((seed, si) => {
      const metrics: MetricDelta[] = [];
      const push = (path: string, delta: number, name = path.split(".").pop()!) =>
        metrics.push({ name, path, parentValue: 100, branchValue: 100 + delta, absoluteDelta: delta, relativeDelta: delta });
      for (const p of signalPaths) {
        const base = [10, 11, 9, 10, 12, 11][si]!;
        push(p, p === "signal.a" ? base : -base);
      }
      for (const p of noisePaths) push(p, [1, -1, 1, -1, 1, -1][si]!);
      push(degeneratePath, 5); // constant across all seeds
      const sectorDiff: SectorDiff = { sectorId: "geopolitics", metrics, eventCounts: [], summary: "" };
      const diff: CounterfactualDiff = { branchId: "", parentUniverseId: "", rewindTick: 0, currentTick: 10, totalTicksElapsed: 10, capturedAt: "", perSector: { geopolitics: sectorDiff } };
      return { runId: `run-${seed}`, seed, rewindTick: 0, totalTicks: 10, intervention, diff, createdAt: "" };
    });

    const summary = computeSummary(runs, intervention);
    expect(summary.metrics).toHaveLength(21);

    const sigA = summary.metrics.find((m) => m.path === "signal.a")!;
    const sigB = summary.metrics.find((m) => m.path === "signal.b")!;
    const noise = summary.metrics.find((m) => m.path === "noise.m0")!;
    const degenerate = summary.metrics.find((m) => m.path === degeneratePath)!;

    // the two true signals survive FDR and Bonferroni; noise does not
    expect(sigA.significantFDR).toBe(true);
    expect(sigB.significantFDR).toBe(true);
    expect(noise.significantFDR).toBe(false);
    expect(sigA.significantBonferroni).toBe(true);
    expect(sigB.significantBonferroni).toBe(true);
    expect(noise.significantBonferroni).toBe(false);
    // BH count == exactly the two signals (step-up over 20 tested metrics)
    expect(summary.metrics.filter((m) => m.significantFDR)).toHaveLength(2);
    // adjusted p-values are ordered and less than raw Bonferroni for signals
    expect(sigA.pAdjusted).toBeLessThan(0.05);
    expect(sigB.pAdjusted).toBeLessThan(0.05);
    expect(noise.pAdjusted).toBeGreaterThanOrEqual(0.05);

    // degenerate metric excluded from the FDR family entirely
    expect(degenerate.degenerate).toBe(true);
    expect(degenerate.pValue).toBeNaN();
    expect(degenerate.pAdjusted).toBeNaN();
    expect(degenerate.significantFDR).toBe(false);

    // noise-floor accounting in the summary
    expect(summary.noiseFloor.testedMetrics).toBe(20);
    expect(summary.noiseFloor.degenerateMetrics).toBe(1);
    expect(summary.noiseFloor.totalMetrics).toBe(21);
    expect(summary.noiseFloor.expectedFalsePositivesAtAlpha05).toBeCloseTo(21 * 0.05, 10);
    expect(summary.noiseFloor.expectedFalsePositivesAtAlpha05Tested).toBeCloseTo(20 * 0.05, 10);
    expect(summary.observedSignificantFDR).toBe(2);
    expect(summary.significanceLevel).toBe(0.05);
  });
});

describe("degenerate guard", () => {
  it("marks constant-delta metrics degenerate instead of emitting nonsense d", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    // identical delta across all seeds -> sd == 0 (old code emitted d = -9e15
    // class values for near-constant series like annualEmissionsNoise)
    const runs = [42, 43, 44, 45].map((seed, i) => makeRun(seed, "annualEmissionsNoise", i === 0 ? 0.18 : 0.18));
    const summary = computeSummary(runs, intervention);
    const stat = summary.metrics.find((m) => m.path === "annualEmissionsNoise")!;
    expect(stat.degenerate).toBe(true);
    expect(stat.cohensD).toBe(0); // not -9.0e15
    expect(stat.pValue).toBeNaN();
    expect(stat.significant).toBe(false);
    expect(stat.pAdjusted).toBeNaN();
  });

  it("marks single-run (n<2) metrics degenerate", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    const summary = computeSummary([makeRun(42, "wars.W-1.casualties", -4792500)], intervention);
    const stat = summary.metrics.find((m) => m.path === "wars.W-1.casualties")!;
    expect(stat.degenerate).toBe(true);
    expect(stat.pValue).toBeNaN();
    expect(stat.significant).toBe(false);
    expect(stat.cohensD).toBe(0);
  });

  it("downgrades numerically degenerate |d| > 1000 effect sizes", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    // mean ~1e7 with sd ~0.007 -> one-sample d ~1.4e9: meaningless effect size
    const runs = [42, 43].map((seed, i) => makeRun(seed, "weird.scale", i === 0 ? 1e7 : 1e7 + 0.01));
    const summary = computeSummary(runs, intervention);
    const stat = summary.metrics.find((m) => m.path === "weird.scale")!;
    expect(stat.degenerate).toBe(true);
    expect(stat.cohensD).toBe(0);
    expect(stat.significant).toBe(false);
  });
});

describe("rounding-artifact guard", () => {
  it("does not flag a metric significant when d rounds to 0.00 but p >= alpha", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    // near-zero deltas: d rounds to 0.00, p ~ 1 -> must NOT be significant
    const deltas = [0.001, -0.001, 0.002, -0.002, 0.001, -0.001];
    const runs = deltas.map((delta, i) => makeRun(42 + i, "nations.USA.gdpGrowthRate", delta));
    const summary = computeSummary(runs, intervention);
    const stat = summary.metrics.find((m) => m.path === "nations.USA.gdpGrowthRate")!;
    expect(stat.cohensD).toBe(0); // rounds to 0.00
    expect(stat.degenerate).toBe(false);
    expect(stat.pValue).toBeGreaterThan(0.5);
    expect(stat.significant).toBe(false);
  });

  it("constant-delta metric no longer shows d=0 significant=true", () => {
    const intervention: Intervention = { type: "test", label: "", description: "", params: {} };
    // constant delta: CI = [2,2] excludes zero (old CI-based `significant` was
    // true while d displayed 0.00). Now: degenerate -> p = NaN -> not significant.
    const runs = [42, 43, 44].map((seed) => makeRun(seed, "nations.USA.wars.length", 2));
    const summary = computeSummary(runs, intervention);
    const stat = summary.metrics.find((m) => m.path === "nations.USA.wars.length")!;
    expect(stat.cohensD).toBe(0); // rounds to 0.00
    expect(stat.ci95Lower).toBe(2); // CI excludes zero (the old trap)
    expect(stat.degenerate).toBe(true);
    expect(stat.significant).toBe(false);
    expect(stat.pValue).toBeNaN();
  });
});
