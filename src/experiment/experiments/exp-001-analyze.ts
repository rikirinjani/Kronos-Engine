import { createReadStream, readdirSync, writeFileSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";
import { computeSummary, computeStabilityAnalysis } from "../stats.js";
import type { Intervention, MetricStats, StatisticalSummary, StabilityAnalysis } from "../types.js";
import type { Exp001Run } from "./exp-001-stability.js";

// ---------------------------------------------------------------------------
// EXP-001 analyzer.
//
// Reads every runs-H<horizon>.jsonl file in a directory, stream-parses each
// line into an Exp001Run, and per horizon computes:
//   - computeSummary / computeStabilityAnalysis (reused from stats.ts)
//   - the macro→adapter→hospital→sentinel→downstream funnel
//   - degeneracy (from summary.noiseFloor)
//   - pathway activation frequency (from observer.branchEventCounts)
//   - trajectory classification (from the stability analysis)
//
// Writes summary.json (StatisticalSummary + StabilityAnalysis per horizon, with
// raw per-seed `values` arrays stripped — they already live in the JSONL) and
// diagnostics.json (funnel, pathway activation, degeneracy, trajectories).
//
// Memory-safe for large ensembles: the JSONL is stream-parsed line by line;
// only the accumulated Exp001Run[] per horizon is retained (required by
// computeSummary/computeStabilityAnalysis).
// ---------------------------------------------------------------------------

const EXPERIMENT_ID = "EXP-001";

const MACRO_PREFIXES = ["geopolitics.", "climate.", "economy.", "technology."];
const HEALTH_PREFIX = "health.";
const DEERS_ROCK_PREFIX = "deers-rock";
const SENTINEL_OUTPUT_PREFIX = "sentinelOutput.";

interface FunnelStage {
  stage: string;
  count: number;
  rate: number;
}

interface FunnelTransition {
  from: string;
  to: string;
  count: number;
  rate: number;
}

interface RunFunnel {
  macroEventGenerated: boolean;
  adapterTranslated: boolean;
  hospitalStateChanged: boolean;
  sentinelEmitted: boolean;
  downstreamDelta: boolean;
}

function sumCounts(counts: Record<string, number>, prefixes: string[]): number {
  let sum = 0;
  for (const [type, count] of Object.entries(counts)) {
    if (prefixes.some((p) => type.startsWith(p))) sum += count;
  }
  return sum;
}

/**
 * Funnel stages are NESTED (each requires the previous):
 *   1. macroEventGenerated — any geopolitics/climate/economy/technology event on the branch
 *   2. adapterTranslated    — stage 1 AND any health.* event on the branch
 *   3. hospitalStateChanged — stage 2 AND any deers-rock diff metric with |delta| > 1e-12
 *   4. sentinelEmitted      — stage 3 AND a non-null sentinelOutput object (proxied by
 *                             diff metric paths starting with "sentinelOutput.")
 *   5. downstreamDelta      — stage 4 AND any primaryOutcomes entry with |delta| > 1e-12
 */
function computeRunFunnel(run: Exp001Run): RunFunnel {
  const branch = run.observer.branchEventCounts;
  const macroEventGenerated = sumCounts(branch, MACRO_PREFIXES) > 0;
  const adapterTranslated = macroEventGenerated && sumCounts(branch, [HEALTH_PREFIX]) > 0;

  let deersRockDelta = false;
  let sentinelOutputSeen = false;
  for (const [sectorId, sd] of Object.entries(run.diff.perSector)) {
    if (!sectorId.startsWith(DEERS_ROCK_PREFIX)) continue;
    for (const m of sd.metrics) {
      if (Math.abs(m.absoluteDelta) > 1e-12) deersRockDelta = true;
      if (m.path.startsWith(SENTINEL_OUTPUT_PREFIX)) sentinelOutputSeen = true;
    }
  }
  const hospitalStateChanged = adapterTranslated && deersRockDelta;
  const sentinelEmitted = hospitalStateChanged && sentinelOutputSeen;
  const downstreamDelta = sentinelEmitted && run.primaryOutcomes.some((e) => Math.abs(e.absoluteDelta) > 1e-12);

  return { macroEventGenerated, adapterTranslated, hospitalStateChanged, sentinelEmitted, downstreamDelta };
}

function computeFunnel(runs: Exp001Run[]): {
  totalRuns: number;
  stages: FunnelStage[];
  transitions: FunnelTransition[];
  note: string;
} {
  const counts = {
    macroEventGenerated: 0,
    adapterTranslated: 0,
    hospitalStateChanged: 0,
    sentinelEmitted: 0,
    downstreamDelta: 0,
  };
  for (const run of runs) {
    const f = computeRunFunnel(run);
    if (f.macroEventGenerated) counts.macroEventGenerated++;
    if (f.adapterTranslated) counts.adapterTranslated++;
    if (f.hospitalStateChanged) counts.hospitalStateChanged++;
    if (f.sentinelEmitted) counts.sentinelEmitted++;
    if (f.downstreamDelta) counts.downstreamDelta++;
  }

  const totalRuns = runs.length;
  const rate = (count: number): number => (totalRuns > 0 ? count / totalRuns : 0);
  const stages: FunnelStage[] = [
    { stage: "macroEventGenerated", count: counts.macroEventGenerated, rate: rate(counts.macroEventGenerated) },
    { stage: "adapterTranslated", count: counts.adapterTranslated, rate: rate(counts.adapterTranslated) },
    { stage: "hospitalStateChanged", count: counts.hospitalStateChanged, rate: rate(counts.hospitalStateChanged) },
    { stage: "sentinelEmitted", count: counts.sentinelEmitted, rate: rate(counts.sentinelEmitted) },
    { stage: "downstreamDelta", count: counts.downstreamDelta, rate: rate(counts.downstreamDelta) },
  ];

  const transitionRate = (from: number, to: number): number => (from > 0 ? to / from : 0);
  const transitions: FunnelTransition[] = [
    { from: "macroEventGenerated", to: "adapterTranslated", count: counts.adapterTranslated, rate: transitionRate(counts.macroEventGenerated, counts.adapterTranslated) },
    { from: "adapterTranslated", to: "hospitalStateChanged", count: counts.hospitalStateChanged, rate: transitionRate(counts.adapterTranslated, counts.hospitalStateChanged) },
    { from: "hospitalStateChanged", to: "sentinelEmitted", count: counts.sentinelEmitted, rate: transitionRate(counts.hospitalStateChanged, counts.sentinelEmitted) },
    { from: "sentinelEmitted", to: "downstreamDelta", count: counts.downstreamDelta, rate: transitionRate(counts.sentinelEmitted, counts.downstreamDelta) },
  ];

  const note =
    "hospital-received-packet is not separately observable without DR-side instrumentation; adapterTranslated is used as its proxy. " +
    "sentinelOutput presence is proxied by diff metric paths starting with 'sentinelOutput.' (the raw sector state is not serialized in the JSONL).";

  return { totalRuns, stages, transitions, note };
}

function computePathwayActivation(runs: Exp001Run[]): Record<string, number> {
  const totalRuns = runs.length;
  const freq = (count: number): number => (totalRuns > 0 ? count / totalRuns : 0);

  const typeRuns = new Map<string, number>();
  let macroAny = 0;
  let healthAny = 0;
  for (const run of runs) {
    const branch = run.observer.branchEventCounts;
    if (sumCounts(branch, MACRO_PREFIXES) > 0) macroAny++;
    if (sumCounts(branch, [HEALTH_PREFIX]) > 0) healthAny++;
    for (const [type, count] of Object.entries(branch)) {
      if (count > 0) typeRuns.set(type, (typeRuns.get(type) ?? 0) + 1);
    }
  }

  const result: Record<string, number> = { macroAny: freq(macroAny), healthAny: freq(healthAny) };
  for (const type of [...typeRuns.keys()].sort()) {
    result[type] = freq(typeRuns.get(type)!);
  }
  return result;
}

function computeDegeneracy(summary: StatisticalSummary): {
  totalMetrics: number;
  nonDegenerate: number;
  degenerate: number;
  degenerateRate: number;
} {
  const totalMetrics = summary.noiseFloor.totalMetrics;
  const degenerate = summary.noiseFloor.degenerateMetrics;
  const nonDegenerate = summary.noiseFloor.testedMetrics;
  return {
    totalMetrics,
    nonDegenerate,
    degenerate,
    degenerateRate: totalMetrics > 0 ? degenerate / totalMetrics : 0,
  };
}

function computeTrajectoryClassification(
  stability: StabilityAnalysis,
): Record<string, StabilityAnalysis["metrics"][number]["trajectoryClassification"]> {
  const result: Record<string, StabilityAnalysis["metrics"][number]["trajectoryClassification"]> = {};
  for (const m of stability.metrics) {
    result[m.path] = m.trajectoryClassification;
  }
  return result;
}

/** Drop the raw per-seed `values` array from every metric (it lives in the JSONL). */
function stripValues<T>(metrics: T[]): Array<Omit<T, "values">> {
  return metrics.map((m) => {
    const { values: _values, ...rest } = m as T & { values?: unknown };
    return rest as Omit<T, "values">;
  });
}

function horizonOf(filename: string): number {
  const m = /^runs-H(\d+)\.jsonl$/.exec(filename);
  return m ? Number(m[1]) : NaN;
}

async function parseRuns(filePath: string): Promise<Exp001Run[]> {
  const runs: Exp001Run[] = [];
  const rl = createInterface({ input: createReadStream(filePath), crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    runs.push(JSON.parse(trimmed) as Exp001Run);
  }
  return runs;
}

async function analyzeDir(dir: string, interventionOverride?: Intervention): Promise<void> {
  const files = readdirSync(dir)
    .filter((f) => /^runs-H\d+\.jsonl$/.test(f))
    .sort((a, b) => horizonOf(a) - horizonOf(b));
  if (files.length === 0) {
    throw new Error(`No runs-H*.jsonl files found in ${dir}`);
  }

  const summaryHorizons: Record<string, unknown> = {};
  const diagnosticsHorizons: Record<string, unknown> = {};
  const generatedAt = new Date().toISOString();

  for (const file of files) {
    const horizon = horizonOf(file);
    const runs = await parseRuns(join(dir, file));
    const intervention = interventionOverride ?? runs[0]?.intervention;
    if (!intervention) {
      throw new Error(`No intervention available for ${file}`);
    }

    const summary = computeSummary(runs, intervention);
    const stability = computeStabilityAnalysis(runs, intervention);

    summaryHorizons[String(horizon)] = {
      n: runs.length,
      seeds: runs.map((r) => r.seed),
      summary: { ...summary, metrics: stripValues(summary.metrics) },
      stability: { ...stability, metrics: stripValues(stability.metrics) },
    };

    diagnosticsHorizons[String(horizon)] = {
      funnel: computeFunnel(runs),
      pathwayActivationFrequency: computePathwayActivation(runs),
      degeneracy: computeDegeneracy(summary),
      trajectoryClassification: computeTrajectoryClassification(stability),
    };
  }

  const summaryPath = join(dir, "summary.json");
  const diagnosticsPath = join(dir, "diagnostics.json");
  writeFileSync(summaryPath, JSON.stringify({ experimentId: EXPERIMENT_ID, generatedAt, horizons: summaryHorizons }, null, 2));
  writeFileSync(diagnosticsPath, JSON.stringify({ experimentId: EXPERIMENT_ID, generatedAt, horizons: diagnosticsHorizons }, null, 2));

  console.log(`[EXP-001] analysis complete: ${files.length} horizon file(s) in ${dir}`);
  console.log(`[EXP-001] wrote ${summaryPath}`);
  console.log(`[EXP-001] wrote ${diagnosticsPath}`);
}

if (
  process.argv[1] &&
  /exp-001-analyze\.(ts|js)$/.test(fileURLToPath(import.meta.url).replace(/\\/g, "/")) &&
  process.argv[1].replace(/\\/g, "/").includes("exp-001-analyze")
) {
  const arg = (name: string, def: string): string => {
    const a = process.argv.find((x) => x.startsWith(`--${name}=`));
    return a ? a.split("=")[1]! : def;
  };

  const dirArg = arg("dir", "experiment-results/mc-lab");
  const interventionJson = arg("intervention-json", "");
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const dir = isAbsolute(dirArg) ? dirArg : join(repoRoot, dirArg);
  const interventionOverride = interventionJson ? (JSON.parse(interventionJson) as Intervention) : undefined;

  analyzeDir(dir, interventionOverride).catch((err: unknown) => {
    console.error(`[EXP-001] analysis FAILED: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}