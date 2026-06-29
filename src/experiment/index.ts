export type { Intervention, MetricDelta, EventCountDiff, SectorDiff, CounterfactualDiff, ExperimentRun, MetricStats, StatisticalSummary, ExperimentSet } from "./types.js";
export { INTERVENTION_TYPES } from "./types.js";
export { computeMetricDeltas, compareSectorStates, buildFullDiff } from "./diff-engine.js";
export { mean, median, stdDev, ci95, cohensD, extractMetricValues, computeSummary } from "./stats.js";
