export interface Intervention {
  type: string;
  label: string;
  description: string;
  params: Record<string, unknown>;
}

export const INTERVENTION_TYPES = {
  RELATION_OVERRIDE: "relation_override",
  GDP_SHIFT: "gdp_shift",
  CLIMATE_POLICY: "climate_policy",
  TECH_BOOST: "tech_boost",
  WAR_START: "war_start",
  WAR_END: "war_end",
  ALLIANCE_CHANGE: "alliance_change",
  POPULATION_SHIFT: "population_shift",
  CUSTOM: "custom",
} as const;

export interface MetricDelta {
  name: string;
  path: string;
  parentValue: number;
  branchValue: number;
  absoluteDelta: number;
  relativeDelta: number;
}

export interface EventCountDiff {
  eventType: string;
  parentCount: number;
  branchCount: number;
  delta: number;
}

export interface SectorDiff {
  sectorId: string;
  metrics: MetricDelta[];
  eventCounts: EventCountDiff[];
  summary: string;
}

export interface CounterfactualDiff {
  branchId: string;
  parentUniverseId: string;
  rewindTick: number;
  currentTick: number;
  totalTicksElapsed: number;
  capturedAt: string;
  perSector: Record<string, SectorDiff>;
}

export interface ExperimentRun {
  runId: string;
  seed: number;
  rewindTick: number;
  totalTicks: number;
  intervention: Intervention;
  diff: CounterfactualDiff;
  createdAt: string;
}

export interface MetricStats {
  name: string;
  path: string;
  values: number[];
  mean: number;
  median: number;
  stdDev: number;
  ci95Lower: number;
  ci95Upper: number;
  min: number;
  max: number;
  /** One-sample effect size dz = mean/sd over per-seed deltas (see cohensDz); 0 when degenerate. */
  cohensD: number;
  /**
   * Unadjusted two-sided p-value of the one-sample t-test (H0: mean delta = 0).
   * NaN when no test was performed (n < 2, or the metric is degenerate).
   */
  pValue: number;
  /** Benjamini–Hochberg FDR-adjusted p-value; NaN for degenerate metrics (excluded from the FDR family). */
  pAdjusted: number;
  /** Bonferroni-adjusted p-value (min(1, p * testedCount)); NaN for degenerate metrics. */
  pBonferroni: number;
  /** Degrees of freedom of the one-sample t-test (n - 1). */
  df: number;
  /** Unadjusted decision: pValue < significanceLevel (0.05). Back-compatible name. */
  significant: boolean;
  /** FDR decision: pAdjusted < significanceLevel. Always false for degenerate metrics. */
  significantFDR: boolean;
  /** Bonferroni decision: pBonferroni < significanceLevel. Always false for degenerate metrics. */
  significantBonferroni: boolean;
  /**
   * True when the per-seed delta series is un-testable: n < 2, sd == 0
   * (constant delta across seeds), or a numerically meaningless effect size
   * (|dz| > 1000). Degenerate metrics are excluded from the FDR/Bonferroni
   * family and never report a p-value or significance.
   */
  degenerate?: boolean;
}

/** Noise-floor comparison: what pure noise would produce vs what was observed. */
export interface NoiseFloor {
  significanceLevel: number;
  /** All metrics in the summary, including degenerate ones. */
  totalMetrics: number;
  /** Non-degenerate metrics actually tested for significance (the FDR/Bonferroni family size). */
  testedMetrics: number;
  /** Metrics downgraded as un-testable (sd == 0, n < 2, |dz| > 1000). */
  degenerateMetrics: number;
  /** Expected false positives at alpha 0.05 if ALL metrics were pure noise: totalMetrics * 0.05. */
  expectedFalsePositivesAtAlpha05: number;
  /** Expected false positives among the tested (non-degenerate) metrics only: testedMetrics * 0.05. */
  expectedFalsePositivesAtAlpha05Tested: number;
  /** Count of metrics with significant === true (unadjusted p < alpha). */
  observedSignificant: number;
  /** Count of metrics with significantFDR === true. */
  observedSignificantFDR: number;
  /** Count of metrics with significantBonferroni === true. */
  observedSignificantBonferroni: number;
}

export interface StatisticalSummary {
  n: number;
  seeds: number[];
  rewindTick: number;
  totalTicks: number;
  intervention: Intervention;
  metrics: MetricStats[];
  /** Alpha used for all significance decisions (0.05). */
  significanceLevel: number;
  /** Convenience: count of metrics with significant === true. */
  observedSignificant: number;
  /** Convenience: count of metrics with significantFDR === true. */
  observedSignificantFDR: number;
  /** Convenience: count of metrics with significantBonferroni === true. */
  observedSignificantBonferroni: number;
  /** Noise-floor comparison (expected false positives at alpha vs observed). */
  noiseFloor: NoiseFloor;
  generatedAt: string;
}

export interface ExperimentSet {
  setId: string;
  label: string;
  description: string;
  intervention: Intervention;
  rewindTick: number;
  rewindLabel: string;
  totalTicks: number;
  numSeeds: number;
  runs: ExperimentRun[];
  summary: StatisticalSummary;
  createdAt: string;
  tags: string[];
}
