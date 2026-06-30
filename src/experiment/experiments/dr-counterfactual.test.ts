import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment } from "./dr-counterfactual.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("P-004: DR Sentinel Counterfactual", () => {
  const seedCount = 3;
  const seeds = Array.from({ length: seedCount }, (_, i) => 42 + i);
  const experiment = runExperiment(seeds);

  it(`runs ${seedCount} seeds and produces metrics`, () => {
    expect(experiment.numSeeds).toBe(seedCount);
    expect(experiment.runs).toHaveLength(seedCount);
    expect(experiment.summary.metrics.length).toBeGreaterThan(0);
  });

  it("includes sentinel sector in diff", () => {
    for (const run of experiment.runs) {
      const sectorKeys = Object.keys(run.diff.perSector);
      const hasSentinel = sectorKeys.some((k) => k.startsWith("deers-rock-"));
      expect(hasSentinel).toBe(true);
    }
  });

  it("produces numeric deltas across sectors", () => {
    let totalDeltas = 0;
    for (const run of experiment.runs) {
      for (const sd of Object.values(run.diff.perSector)) {
        totalDeltas += sd.metrics.length;
      }
    }
    expect(totalDeltas).toBeGreaterThan(0);
  });

  it("saves output files", () => {
    const outDir = join(__dirname, "../../../experiment-results/dr-counterfactual");
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, "p004-summary.json"), JSON.stringify(experiment.summary, null, 2));
    writeFileSync(join(outDir, "p004-runs.json"), JSON.stringify(experiment.runs, null, 2));

    expect(experiment.summary).toBeDefined();
    expect(experiment.runs).toBeDefined();
  });
});
