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
  cohensD: number;
  significant: boolean;
}

export interface StatisticalSummary {
  n: number;
  seeds: number[];
  rewindTick: number;
  totalTicks: number;
  intervention: Intervention;
  metrics: MetricStats[];
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
