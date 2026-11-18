/**
 * E4/P-004 — Bounded horizon comparison for causal propagation.
 *
 * Question: is the 20-tick horizon sufficient for the emissions-control
 * intervention to propagate into the DR sentinel, now that the
 * macro→micro coupling (E1/E2) is functional and the checkpoint aliasing
 * defect (E6 fix) is closed?
 *
 * Design:
 *   - Same deterministic seeds (42..71, the established P-004 set) and the
 *     same intervention (climate emissions control) at BOTH horizons.
 *   - Horizons: 20 KE ticks (current P-004 baseline) vs 60 KE ticks
 *     (materially longer, 3x, still bounded: 600 DR sampling ticks per
 *     branch — within the temporal contract's sampling-window semantics).
 *   - Same metrics (buildFullDiff numeric paths, bookkeeping stripped) and
 *     the same statistical corrections (computeSummary: uncorrected p,
 *     BH-FDR, Bonferroni).
 *   - NO intervention strengthening. NO horizon selection after results.
 *
 * Classification rubric (reported, not decided by significance alone):
 *   A. no effect            — zero DR deltas at both horizons
 *   B. delayed effect       — zero/weak at 20, nonzero DR deltas at 60
 *   C. stronger under justified magnitude — n/a here (no strengthening)
 *   D. variance/masking     — nonzero deltas on a seed subset, diluted mean
 *   E. coupling still blocked — DR sector absent from diffs entirely
 *
 * Engineering success criterion: correct causal propagation + reproducibility
 * (guards pass, per-branch reruns deterministic), not p-value thresholds.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment } from "./dr-counterfactual.js";

const SEED_COUNT = 30;
const seeds = Array.from({ length: SEED_COUNT }, (_, i) => 42 + i);
const HORIZONS = [20, 60] as const;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../experiment-results/p004-horizon");
mkdirSync(outDir, { recursive: true });

const results: Record<string, unknown> = {};

for (const horizon of HORIZONS) {
  console.log(`\n=== P-004 horizon=${horizon} (${SEED_COUNT} seeds) ===`);
  const t0 = Date.now();
  const experiment = runExperiment(seeds, horizon);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);

  const metrics = experiment.summary.metrics;
  const drMetrics = metrics.filter((m) => m.path.includes("deers-rock"));
  const significant = metrics.filter((m) => m.significant);
  const fdr = metrics.filter((m) => m.significantFDR);
  const bonferroni = metrics.filter((m) => m.significantBonferroni);
  const drSignificant = significant.filter((m) => m.path.includes("deers-rock"));

  // Divergence spread: how many seeds have ANY nonzero DR numeric delta
  const seedsWithDrDelta = experiment.runs.filter((r) => {
    const dr = Object.entries(r.diff.perSector).filter(([id]) => id.startsWith("deers-rock"));
    return dr.some(([, sd]) => sd.metrics.some((m) => Math.abs(m.absoluteDelta) > 0));
  }).length;

  console.log(`  metrics=${metrics.length} (DR=${drMetrics.length})`);
  console.log(`  uncorrected significant=${significant.length} (DR=${drSignificant.length})`);
  console.log(`  FDR significant=${fdr.length}, Bonferroni significant=${bonferroni.length}`);
  console.log(`  seeds with >=1 nonzero DR delta: ${seedsWithDrDelta}/${SEED_COUNT}`);
  console.log(`  primary outcomes:`);
  for (const o of experiment.primaryOutcomes) {
    console.log(`    [${o.id}] meanDelta=${o.overallMeanDelta} directionConsistent=${o.directionConsistent} paths=${o.observedPathCount}/${o.expectedPathCount}`);
  }
  console.log(`  runtime: ${dt}s`);

  writeFileSync(join(outDir, `h${horizon}-summary.json`), JSON.stringify(experiment.summary, null, 2));
  writeFileSync(join(outDir, `h${horizon}-runs.json`), JSON.stringify(experiment.runs, null, 2));

  results[`h${horizon}`] = {
    horizon,
    metricCount: metrics.length,
    drMetricCount: drMetrics.length,
    uncorrectedSignificant: significant.length,
    drUncorrectedSignificant: drSignificant.length,
    fdrSignificant: fdr.length,
    bonferroniSignificant: bonferroni.length,
    seedsWithDrDelta,
    numSeeds: SEED_COUNT,
    primaryOutcomes: experiment.primaryOutcomes,
    guardsAllPassed: experiment.runs.every((r) => r.guards.matchedHorizon && r.guards.baselineIdentical),
  };
}

writeFileSync(join(outDir, "horizon-comparison.json"), JSON.stringify(results, null, 2));
console.log(`\nHorizon comparison written: ${join(outDir, "horizon-comparison.json")}`);
