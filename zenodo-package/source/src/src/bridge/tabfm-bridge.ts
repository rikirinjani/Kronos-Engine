import type { ExperimentRun, ExperimentSet } from "../experiment/types.js";

export interface TabFMConfig {
  baseUrl: string;
  nShots: number;
}

export interface ClassifyResponse {
  predictions: string[];
  probabilities: Array<Record<string, number>>;
  classes: string[];
}

export interface HealthResponse {
  status: string;
  tabfm_loaded: boolean;
  classes: string[];
}

export class TabFMBridge {
  private config: TabFMConfig;

  constructor(config?: Partial<TabFMConfig>) {
    this.config = {
      baseUrl: config?.baseUrl ?? "http://127.0.0.1:8001",
      nShots: config?.nShots ?? 5,
    };
  }

  async health(): Promise<HealthResponse> {
    const res = await fetch(`${this.config.baseUrl}/health`);
    if (!res.ok) throw new Error(`TabFM health check failed: ${res.status}`);
    return res.json() as Promise<HealthResponse>;
  }

  async classify(runs: ExperimentRun[]): Promise<ClassifyResponse> {
    const rows = runs.map((r) => this.runToFeatures(r));
    const res = await fetch(`${this.config.baseUrl}/classify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, n_shots: this.config.nShots }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`TabFM classify failed (${res.status}): ${text}`);
    }
    return res.json() as Promise<ClassifyResponse>;
  }

  async classifyExperiment(experiment: ExperimentSet): Promise<{
    perRun: ClassifyResponse;
    summary: ClassifyResponse;
  }> {
    const [perRun, summary] = await Promise.all([
      this.classify(experiment.runs),
      this.classify([
        {
          runId: "summary",
          seed: 0,
          rewindTick: experiment.rewindTick,
          totalTicks: experiment.totalTicks,
          intervention: experiment.intervention,
          diff: {
            branchId: "",
            parentUniverseId: "",
            rewindTick: experiment.rewindTick,
            currentTick: experiment.rewindTick + experiment.totalTicks,
            totalTicksElapsed: experiment.totalTicks,
            capturedAt: "",
            perSector: {},
          },
          createdAt: "",
        },
      ]),
    ]);
    return { perRun, summary };
  }

  private runToFeatures(run: ExperimentRun): Record<string, number> {
    const allDeltas: Record<string, number[]> = {};
    for (const sectorDiff of Object.values(run.diff.perSector)) {
      for (const m of sectorDiff.metrics) {
        if (!allDeltas[m.path]) allDeltas[m.path] = [];
        allDeltas[m.path]!.push(m.absoluteDelta);
      }
    }

    const compute = (path: string, fn: (vals: number[]) => number): number => {
      const vals = allDeltas[path];
      if (!vals || vals.length === 0) return 0;
      return fn(vals);
    };
    const mean = (vals: number[]) => vals.reduce((a, b) => a + b, 0) / vals.length;

    const gdpDeltas = Object.entries(allDeltas)
      .filter(([k]) => k.includes("gdp") && !k.includes("GrowthRate"))
      .flatMap(([, v]) => v);
    const gdpMean = gdpDeltas.length > 0
      ? gdpDeltas.reduce((a, b) => a + b, 0) / gdpDeltas.length / 1e9
      : 0;

    const gdpGrowthDeltas = Object.entries(allDeltas)
      .filter(([k]) => k.includes("gdpGrowthRate"))
      .flatMap(([, v]) => v);
    const gdpGrowthMean = gdpGrowthDeltas.length > 0
      ? gdpGrowthDeltas.reduce((a, b) => a + b, 0) / gdpGrowthDeltas.length
      : 0;

    const inflationDeltas = Object.entries(allDeltas)
      .filter(([k]) => k.includes("inflationRate"))
      .flatMap(([, v]) => v);

    return {
      gdp_mean_delta: gdpMean,
      gdp_growth_delta: gdpGrowthMean,
      inflation_delta: inflationDeltas.length > 0 ? inflationDeltas.reduce((a, b) => a + b, 0) / inflationDeltas.length : 0,
      unemployment_delta: compute("unemploymentRate", mean),
      trade_volume_delta: compute("tradeVolume", mean),
      temperature_anomaly: compute("temperatureAnomaly", mean),
      emissions_delta: compute("annualEmissions", mean),
      population_delta: compute("population", mean) / 1e6,
      birth_rate_delta: compute("birthRate", mean),
      occupancy_rate: compute("occupancyRate", mean),
      innovation_count: compute("innovationCount", mean),
      war_count_delta: compute("warCount", mean),
    };
  }
}
