import type {
  MetricDelta,
  MetricStats,
  StatisticalSummary,
  ExperimentRun,
  Intervention,
  NoiseFloor,
  MetricStability,
  StabilityAnalysis,
  TrajectoryClass,
} from "./types.js";

/**
 * Significance level used for all hypothesis-testing decisions in the summary.
 * p-values are compared against this threshold; BH-FDR and Bonferroni
 * multiplicity corrections are applied at this same level.
 */
export const SIGNIFICANCE_LEVEL = 0.05;

/**
 * Effect sizes with |d| above this magnitude are treated as numerically
 * degenerate: the per-seed variance is vanishingly small relative to the mean
 * (e.g. `annualEmissionsNoise` producing d ≈ -9.0e15 from float jitter around
 * an otherwise-constant delta). Such metrics are flagged `degenerate` rather
 * than emitting a meaningless effect size.
 */
const DEGENERATE_D_MAGNITUDE = 1000;

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

/**
 * Two-group Cohen's d (pooled SD). Retained for API compatibility and as the
 * canonical two-sample effect size where control/treatment arrays are actually
 * available. NOTE: `computeSummary` does NOT use this for per-metric effect
 * sizes — the data model stores only per-seed deltas, so it uses the one-sample
 * `cohensDz` instead. Historically the summary fed an all-zero control vector
 * into this function, which inflated every effect size by sqrt(2) and disguised
 * a one-sample statistic as a two-group one.
 */
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

/**
 * One-sample effect size dz = mean / sd over per-seed deltas.
 *
 * This is the honest effect size for the experiment's data model, which stores
 * only branch-vs-parent deltas per seed — there is no independent control group
 * distribution to contrast against. dz measures the standardized mean shift
 * AWAY FROM ZERO (i.e. away from "no intervention effect"). It is NOT
 * comparable to a two-group Cohen's d against a control population; literature
 * values must be interpreted with that caveat. Returns 0 when the variance is
 * zero or the sample is too small (the caller flags such metrics degenerate).
 */
export function cohensDz(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const m = mean(values);
  const s = stdDev(values, m);
  if (s === 0) return 0;
  return m / s;
}

// ---------------------------------------------------------------------------
// Student's t cumulative distribution function.
//
// Implementation: regularized incomplete beta function per Numerical Recipes
// in C (2nd ed.), §6.2 "Incomplete Gamma Function" (gammln, Lanczos) and §6.4
// "Incomplete Beta Function" (betacf via Lentz's continued fraction, betai).
// The two-sided p-value for a t statistic with df degrees of freedom is
//   p = I_{df / (df + t^2)}(df / 2, 1 / 2)
// (standard identity — see e.g. Wikipedia "Student's t-distribution",
// "Cumulative distribution function"; Abramowitz & Stegun 26.7.1).
// Accuracy of the continued-fraction expansion is ~1e-6 relative, far tighter
// than needed for alpha = 0.05 thresholds.
// ---------------------------------------------------------------------------

/** Lanczos gamma approximation (Numerical Recipes `gammln`). */
function gammaLn(x: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ];
  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < cof.length; j++) {
    y += 1;
    ser += cof[j]! / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/** Continued-fraction expansion of the incomplete beta (Numerical Recipes `betacf`). */
function betaContinuedFraction(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-7;
  const FPMIN = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularized incomplete beta I_x(a, b) (Numerical Recipes `betai`). */
export function regularizedBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (!Number.isFinite(x) || !(a > 0) || !(b > 0)) return NaN;
  const bt = Math.exp(
    gammaLn(a + b) - gammaLn(a) - gammaLn(b) + a * Math.log(x) + b * Math.log(1 - x),
  );
  if (x < (a + 1) / (a + b + 2)) {
    return (bt * betaContinuedFraction(a, b, x)) / a;
  }
  return 1 - (bt * betaContinuedFraction(b, a, 1 - x)) / b;
}

/** CDF of Student's t distribution at t with df degrees of freedom. */
export function tCdf(t: number, df: number): number {
  if (!Number.isFinite(t) || !(df > 0)) return NaN;
  if (t === 0) return 0.5;
  const x = df / (df + t * t);
  const tail = 0.5 * regularizedBeta(x, df / 2, 0.5); // P(T > |t|) for either sign
  return t > 0 ? 1 - tail : tail;
}

/**
 * Two-sided p-value for a t statistic: p = P(|T| > |t|) = I_{df/(df+t^2)}(df/2, 1/2).
 * Returns NaN for non-finite input or df <= 0 (the caller treats NaN as
 * "no test performed", e.g. n < 2).
 */
export function twoSidedPValue(t: number, df: number): number {
  if (!Number.isFinite(t) || !(df > 0)) return NaN;
  if (t === 0) return 1;
  const t2 = t * t;
  if (!Number.isFinite(t2)) return 0; // |t| astronomically large -> p ~ 0
  return regularizedBeta(df / (df + t2), df / 2, 0.5);
}

/**
 * Benjamini–Hochberg false-discovery-rate adjusted p-values (step-up).
 * Given raw p-values (any order), returns q-values in the same order.
 *   q_(i) = min_{k >= i} min(1, (m / k) * p_(k))   where p_(1) <= ... <= p_(m)
 * A test is FDR-significant at level alpha iff its q-value < alpha.
 * NaN entries are passed through untouched (they are excluded before calling).
 */
export function bhAdjustedPValues(pValues: number[]): number[] {
  const n = pValues.length;
  const q = new Array<number>(n).fill(NaN);
  const order = pValues
    .map((p, i) => ({ i, p }))
    .filter((e) => Number.isFinite(e.p))
    .sort((a, b) => a.p - b.p);
  const m = order.length;
  let runningMin = 1;
  for (let k = m; k >= 1; k--) {
    const entry = order[k - 1]!;
    const adjusted = Math.min(1, (m / k) * entry.p);
    if (adjusted < runningMin) runningMin = adjusted;
    q[entry.i] = runningMin;
  }
  return q;
}

/** Bonferroni-adjusted p-value (min(1, p * m)); NaN passes through. */
export function bonferroniAdjustedP(p: number, count: number): number {
  if (!Number.isFinite(p) || !(count > 0)) return NaN;
  return Math.min(1, p * count);
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * A per-seed delta series is degenerate (un-testable) when:
 *  - fewer than 2 values exist (n < 2 -> t-test undefined, p = NaN), or
 *  - the sample SD is exactly zero (constant delta across seeds; e.g.
 *    `annualEmissionsNoise`, config-driven shifts, n=1 war-specific metrics), or
 *  - the resulting effect size is numerically meaningless (|d| beyond
 *    DEGENERATE_D_MAGNITUDE, e.g. float jitter around a constant producing
 *    d ~ -9e15).
 */
function isDegenerate(values: number[], sd: number, d: number): boolean {
  if (values.length < 2) return true;
  if (sd === 0) return true;
  if (!Number.isFinite(d) || Math.abs(d) > DEGENERATE_D_MAGNITUDE) return true;
  return false;
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
    const n = values.length;
    const df = n - 1;
    const avg = mean(values);
    const sd = stdDev(values, avg);
    const med = median(values);
    const ci = ci95(values, avg, sd);
    const min = Math.min(...values);
    const max = Math.max(...values);

    let d = cohensDz(values);
    let pValue = NaN;
    let degenerate = isDegenerate(values, sd, d);

    if (!degenerate) {
      // One-sample t-test of the per-seed deltas against H0: mean delta = 0.
      const se = sd / Math.sqrt(n);
      const t = avg / se;
      pValue = twoSidedPValue(t, df);
      if (!Number.isFinite(pValue)) {
        // Numerically broke down (e.g. non-finite input values): downgrade.
        degenerate = true;
        pValue = NaN;
      }
    }

    if (degenerate) d = 0; // never emit a nonsense effect size

    metrics.push({
      name: path.includes(".") ? path.split(".").pop()! : path,
      path,
      values,
      mean: round2(avg),
      median: round2(med),
      stdDev: round2(sd),
      ci95Lower: round2(ci.lower),
      ci95Upper: round2(ci.upper),
      min: round2(min),
      max: round2(max),
      // One-sample dz against a zero delta (NOT a two-group Cohen's d — see
      // cohensDz). 0 for degenerate metrics.
      cohensD: round2(d),
      df,
      // p-value is stored unrounded so significance decisions are consistent
      // with what consumers read (this fixes the old "d rounds to 0.00 but CI
      // excludes zero" mismatch, where `significant` was computed on unrounded
      // CI values while d/mean were rounded for display).
      pValue,
      pAdjusted: NaN, // filled by the BH pass below for non-degenerate metrics
      pBonferroni: NaN,
      significant: pValue < SIGNIFICANCE_LEVEL, // unadjusted two-sided p < alpha; NaN -> false
      significantFDR: false,
      significantBonferroni: false,
      degenerate,
    });
  }

  // -------------------------------------------------------------------------
  // Multiplicity correction across all non-degenerate metrics.
  // Degenerate metrics (sd == 0, n < 2, |d| nonsense) are EXCLUDED from the
  // family of tests: they have no valid p-value, so including them would make
  // BH/Bonferroni needlessly conservative and would count untestable rows
  // against the noise floor.
  // -------------------------------------------------------------------------
  const tested = metrics.filter((m) => !m.degenerate);
  const mCount = tested.length;
  if (mCount > 0) {
    const order = tested
      .map((m, i) => ({ i, p: m.pValue }))
      .sort((a, b) => a.p - b.p);
    // Step-up scan: largest k with p_(k) <= (k/m) * alpha determines the
    // significance cutoff; q-values assigned from the tail downward.
    let runningMin = 1;
    for (let k = mCount; k >= 1; k--) {
      const entry = order[k - 1]!;
      const metric = tested[entry.i]!;
      const q = Math.min(1, (mCount / k) * entry.p);
      if (q < runningMin) runningMin = q;
      metric.pAdjusted = runningMin;
      metric.pBonferroni = bonferroniAdjustedP(entry.p, mCount);
      metric.significantFDR = metric.pAdjusted < SIGNIFICANCE_LEVEL;
      metric.significantBonferroni = metric.pBonferroni < SIGNIFICANCE_LEVEL;
    }
  }

  const observedSignificant = metrics.filter((m) => m.significant).length;
  const observedSignificantFDR = metrics.filter((m) => m.significantFDR).length;
  const observedSignificantBonferroni = metrics.filter((m) => m.significantBonferroni).length;
  const totalMetrics = metrics.length;
  const testedMetrics = mCount;
  const degenerateMetrics = metrics.filter((m) => m.degenerate).length;

  const noiseFloor: NoiseFloor = {
    significanceLevel: SIGNIFICANCE_LEVEL,
    totalMetrics,
    testedMetrics,
    degenerateMetrics,
    // Literal noise-floor formula: if every metric were pure noise, alpha of
    // them would be flagged significant by chance.
    expectedFalsePositivesAtAlpha05: totalMetrics * SIGNIFICANCE_LEVEL,
    // More honest comparison: FDR/Bonferroni only test the non-degenerate
    // metrics, so a fair noise floor for observedSignificant* is tested-only.
    expectedFalsePositivesAtAlpha05Tested: testedMetrics * SIGNIFICANCE_LEVEL,
    observedSignificant,
    observedSignificantFDR,
    observedSignificantBonferroni,
  };

  return {
    n: runs.length,
    seeds: runs.map((r) => r.seed),
    rewindTick: runs[0]?.rewindTick ?? 0,
    totalTicks: runs[0]?.totalTicks ?? 0,
    intervention,
    metrics,
    significanceLevel: SIGNIFICANCE_LEVEL,
    observedSignificant,
    observedSignificantFDR,
    observedSignificantBonferroni,
    noiseFloor,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// EXP-001: Counterfactual Stability Study.
//
// Additive analysis helpers layered on top of the existing summary statistics.
// These do NOT alter mean/median/stdDev/ci95/cohensDz/p-value behaviour or the
// StatisticalSummary contract; they are new functions appended after the
// existing ones. Pure math helpers return raw values (matching mean/median/
// stdDev); the aggregate `computeStabilityAnalysis` applies round2 for display,
// matching how `computeSummary` rounds its MetricStats output.
// ---------------------------------------------------------------------------

/**
 * p-th percentile (0-100) via linear interpolation between the two closest
 * order statistics (the "linear" / type-7 method used by NumPy and R's default
 * `quantile`): rank = (p / 100) * (n - 1), then interpolate between the
 * surrounding sorted values. `p` is clamped to [0, 100]; empty input returns 0.
 */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const clamped = Math.min(100, Math.max(0, p));
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (clamped / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower]!;
  const frac = rank - lower;
  return sorted[lower]! + frac * (sorted[upper]! - sorted[lower]!);
}

/**
 * 5/25/50/75/95 percentiles of a delta series (linear interpolation, see
 * `percentile`). Returns raw values; `computeStabilityAnalysis` rounds for
 * output.
 */
export function quantiles(values: number[]): {
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
} {
  return {
    p5: percentile(values, 5),
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p95: percentile(values, 95),
  };
}

/**
 * P(Δ > 0): share of strictly positive deltas among the non-zero deltas.
 * Exact zeros carry no directional information and are excluded from the
 * denominator. Returns 0 when every delta is zero.
 */
export function positiveProportion(deltas: number[]): number {
  let positive = 0;
  let nonZero = 0;
  for (const d of deltas) {
    if (d === 0) continue;
    nonZero++;
    if (d > 0) positive++;
  }
  return nonZero === 0 ? 0 : positive / nonZero;
}

/**
 * P(Δ < 0): share of strictly negative deltas among the non-zero deltas.
 * Mirror of `positiveProportion`; exact zeros are excluded from the
 * denominator. Returns 0 when every delta is zero.
 */
export function negativeProportion(deltas: number[]): number {
  let negative = 0;
  let nonZero = 0;
  for (const d of deltas) {
    if (d === 0) continue;
    nonZero++;
    if (d < 0) negative++;
  }
  return nonZero === 0 ? 0 : negative / nonZero;
}

/**
 * Stability Index SI = |median Δ| / SD(Δ): how far the central tendency sits
 * from zero, expressed in units of dispersion. Higher = a more stable,
 * reproducible shift. Returns 0 when SD is zero (a constant series has no
 * dispersion to normalize by; such metrics are already flagged degenerate by
 * `computeSummary`).
 */
export function stabilityIndex(medianDelta: number, stdDevDelta: number): number {
  if (stdDevDelta === 0) return 0;
  return Math.abs(medianDelta) / stdDevDelta;
}

/**
 * Classify a single delta against a metric's central 50% and 5/95 tails:
 *   delta <  p5          -> "Extreme Negative"
 *   p5  <= delta <  p25  -> "Negative"
 *   p25 <= delta <= p75  -> "Null"        (central 50%, approximately zero)
 *   p75 <  delta <= p95  -> "Positive"
 *   delta >  p95         -> "Extreme Positive"
 *
 * NOTE: the task header listed the signature as (delta, p5, p95), but the
 * agreed 5-class scheme also needs the interquartile bounds, so the signature
 * is (delta, p5, p25, p75, p95).
 */
export function classifyTrajectory(
  delta: number,
  p5: number,
  p25: number,
  p75: number,
  p95: number,
): TrajectoryClass["classification"] {
  if (delta < p5) return "Extreme Negative";
  if (delta < p25) return "Negative";
  if (delta <= p75) return "Null";
  if (delta <= p95) return "Positive";
  return "Extreme Positive";
}

/**
 * Full EXP-001 stability analysis.
 *
 * Reuses `computeSummary` for the shared per-metric statistics (mean/median/
 * SD, degeneracy, multiplicity corrections) and layers the quantile, sign and
 * trajectory views on top. It does NOT re-extract or recompute the summary from
 * scratch — `MetricStats.values` carries the raw per-seed deltas forward.
 *
 * `horizon` mirrors the summary's `totalTicks` (the simulated horizon).
 * `overallStabilityIndex` is the mean of the per-metric stability indices
 * (0 when there are no metrics).
 */
export function computeStabilityAnalysis(
  runs: ExperimentRun[],
  intervention: Intervention,
): StabilityAnalysis {
  const summary = computeSummary(runs, intervention);
  const metrics: MetricStability[] = [];
  let siSum = 0;

  for (const m of summary.metrics) {
    const values = m.values;
    const avg = mean(values);
    const sd = stdDev(values, avg);
    const med = median(values);
    const q = quantiles(values);
    const si = stabilityIndex(med, sd);

    const trajectoryClassification = {
      extremeNegative: 0,
      negative: 0,
      null: 0,
      positive: 0,
      extremePositive: 0,
    };
    for (const delta of values) {
      switch (classifyTrajectory(delta, q.p5, q.p25, q.p75, q.p95)) {
        case "Extreme Negative":
          trajectoryClassification.extremeNegative++;
          break;
        case "Negative":
          trajectoryClassification.negative++;
          break;
        case "Null":
          trajectoryClassification.null++;
          break;
        case "Positive":
          trajectoryClassification.positive++;
          break;
        case "Extreme Positive":
          trajectoryClassification.extremePositive++;
          break;
      }
    }

    siSum += si;

    metrics.push({
      name: m.name,
      path: m.path,
      meanDelta: round2(avg),
      medianDelta: round2(med),
      stdDevDelta: round2(sd),
      stabilityIndex: round2(si),
      quantiles: {
        p5: round2(q.p5),
        p25: round2(q.p25),
        p50: round2(q.p50),
        p75: round2(q.p75),
        p95: round2(q.p95),
      },
      positiveProportion: round2(positiveProportion(values)),
      negativeProportion: round2(negativeProportion(values)),
      trajectoryClassification,
      degenerate: m.degenerate ?? false,
    });
  }

  const overallStabilityIndex = metrics.length === 0 ? 0 : round2(siSum / metrics.length);

  return {
    n: summary.n,
    seeds: summary.seeds,
    horizon: summary.totalTicks,
    metrics,
    overallStabilityIndex,
    generatedAt: new Date().toISOString(),
  };
}
