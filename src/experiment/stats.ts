import type { MetricDelta, MetricStats, StatisticalSummary, ExperimentRun, Intervention } from "./types.js";

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function stdDev(values: number[], avg?: number): number {
  if (values.length < 2) return 0;
  const m = avg ?? mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function ci95(values: number[], avg?: number, sd?: number): { lower: number; upper: number } {
  const n = values.length;
  if (n < 2) return { lower: 0, upper: 0 };
  const m = avg ?? mean(values);
  const s = sd ?? stdDev(values, m);
  const se = s / Math.sqrt(n);
  const t = n >= 30 ? 1.96 : t95Critical(n - 1);
  return { lower: m - t * se, upper: m + t * se };
}

function t95Critical(df: number): number {
  if (df <= 0) return 1.96;
  if (df >= 30) return 1.96;
  const tTable: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
    16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
    21: 2.080, 22: 2.074, 23: 2.069, 24: 2.064, 25: 2.060,
    26: 2.056, 27: 2.052, 28: 2.048, 29: 2.045,
  };
  return tTable[df] ?? 1.96;
}

export function cohensD(control: number[], treatment: number[]): number {
  const n1 = control.length;
  const n2 = treatment.length;
  if (n1 < 2 || n2 < 2) return 0;
  const m1 = mean(control);
  const m2 = mean(treatment);
  const s1 = stdDev(control, m1);
  const s2 = stdDev(treatment, m2);
  const pooled = Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2) / (n1 + n2 - 2));
  if (pooled === 0) return 0;
  return (m2 - m1) / pooled;
}

export function extractMetricValues(runs: ExperimentRun[], path: string): number[] {
  const values: number[] = [];
  for (const run of runs) {
    for (const sectorDiff of Object.values(run.diff.perSector)) {
      for (const metric of sectorDiff.metrics) {
        if (metric.path === path) {
          values.push(metric.absoluteDelta);
        }
      }
    }
  }
  return values;
}

export function computeSummary(runs: ExperimentRun[], intervention: Intervention): StatisticalSummary {
  const allPaths = new Set<string>();
  const pathValues = new Map<string, number[]>();

  for (const run of runs) {
    for (const sectorDiff of Object.values(run.diff.perSector)) {
      for (const metric of sectorDiff.metrics) {
        if (!pathValues.has(metric.path)) {
          pathValues.set(metric.path, []);
        }
        pathValues.get(metric.path)!.push(metric.absoluteDelta);
        allPaths.add(metric.path);
      }
    }
  }

  const metrics: MetricStats[] = [];
  for (const path of allPaths) {
    const values = pathValues.get(path)!;
    if (values.length < 1) continue;
    const avg = mean(values);
    const sd = stdDev(values, avg);
    const med = median(values);
    const ci = ci95(values, avg, sd);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const d = cohensD(values.map(() => 0), values);

    metrics.push({
      name: path.includes(".") ? path.split(".").pop()! : path,
      path,
      values,
      mean: Math.round(avg * 100) / 100,
      median: Math.round(med * 100) / 100,
      stdDev: Math.round(sd * 100) / 100,
      ci95Lower: Math.round(ci.lower * 100) / 100,
      ci95Upper: Math.round(ci.upper * 100) / 100,
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      cohensD: Math.round(d * 100) / 100,
      significant: ci.lower > 0 || ci.upper < 0,
    });
  }

  return {
    n: runs.length,
    seeds: runs.map((r) => r.seed),
    rewindTick: runs[0]?.rewindTick ?? 0,
    totalTicks: runs[0]?.totalTicks ?? 0,
    intervention,
    metrics,
    generatedAt: new Date().toISOString(),
  };
}
