import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment } from "./wwii-no-war.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("P-003 Calibrated Re-run (30 seeds)", () => {
  const seedCount = 30;
  const seeds = Array.from({ length: seedCount }, (_, i) => 42 + i);
  const experiment = runExperiment(seeds);

  it(`runs ${seedCount} seeds and saves output`, () => {
    expect(experiment.numSeeds).toBe(seedCount);
    expect(experiment.summary.n).toBe(seedCount);

    const outDir = join(__dirname, "../../../experiment-results/wwii-counterfactual");
    writeFileSync(join(outDir, "p003-calibrated-summary.json"), JSON.stringify(experiment.summary, null, 2));
    writeFileSync(join(outDir, "p003-calibrated-runs.json"), JSON.stringify(experiment.runs, null, 2));
  });
});
