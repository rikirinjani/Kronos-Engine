import { describe, it, expect } from "vitest";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment, PRIMARY_OUTCOMES, isBookkeepingPath } from "./wwii-no-war.js";

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

  it("every run passes the matched-horizon guard (parent tick == child tick)", () => {
    for (const run of experiment.runs) {
      expect(run.guards.matchedHorizon).toBe(true);
      expect(run.guards.childTick).toBe(run.guards.parentTick);
      expect(run.guards.parentTick).toBe(30);
    }
  });

  it("every run passes the identical-baseline guard", () => {
    for (const run of experiment.runs) {
      expect(run.guards.baselineIdentical).toBe(true);
      expect(run.guards.baselineStateHash).toMatch(/^[0-9a-f]{8}$/);
    }
  });

  it("bookkeeping clock fields match across branches for every run", () => {
    for (const run of experiment.runs) {
      expect(run.guards.bookkeeping.year.parent).toBe(1969);
      expect(run.guards.bookkeeping.year.child).toBe(1969);
      expect(run.guards.bookkeeping.tickCount.parent).toBe(30);
      expect(run.guards.bookkeeping.tickCount.child).toBe(30);
      expect(run.guards.bookkeeping.year.parent).toBe(run.guards.bookkeeping.year.child);
      expect(run.guards.bookkeeping.tickCount.parent).toBe(run.guards.bookkeeping.tickCount.child);
    }
  });

  it("pre-specified nation-GDP primary outcomes are declared and reported", () => {
    const gdp = PRIMARY_OUTCOMES.find((o) => o.id === "nation-gdp");
    expect(gdp).toBeDefined();
    expect(gdp!.paths.length).toBeGreaterThan(0);

    const report = experiment.primaryOutcomes.find((o) => o.id === "nation-gdp");
    expect(report).toBeDefined();
    expect(report!.perSeedMeanDelta).toHaveLength(seedCount);
    expect(report!.observedPathCount).toBeGreaterThan(0);

    for (const run of experiment.runs) {
      expect(run.primaryOutcomes.filter((e) => e.outcomeId === "nation-gdp").length).toBeGreaterThan(0);
    }
  });

  it("no bookkeeping path leaks into the causal metric sets", () => {
    for (const run of experiment.runs) {
      for (const sd of Object.values(run.diff.perSector)) {
        for (const m of sd.metrics) {
          expect(isBookkeepingPath(m.path)).toBe(false);
        }
      }
    }
  });
});
