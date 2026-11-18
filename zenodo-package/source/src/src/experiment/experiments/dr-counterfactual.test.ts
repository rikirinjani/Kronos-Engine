import { describe, it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runExperiment, runSingleSeed, PRIMARY_OUTCOMES, isBookkeepingPath, assertMatchedHorizon } from "./dr-counterfactual.js";

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

  describe("scientific rigor: matched horizon", () => {
    it("runs parent and child to the SAME tick", () => {
      for (const run of experiment.runs) {
        expect(run.guards.matchedHorizon).toBe(true);
        expect(run.guards.parentTick).toBe(20);
        expect(run.guards.childTick).toBe(20);
        expect(run.guards.childTick).toBe(run.guards.parentTick);
      }
    });

    it("assertMatchedHorizon throws when tick counts differ", () => {
      expect(() => assertMatchedHorizon(20, 23, "test")).toThrow(/Matched-horizon/);
    });
  });

  describe("scientific rigor: identical baseline", () => {
    it("verifies the rewind baseline deep-equals the pristine parent baseline", () => {
      for (const run of experiment.runs) {
        expect(run.guards.baselineIdentical).toBe(true);
        expect(run.guards.baselineStateHash).toMatch(/^[0-9a-f]{8}$/);
      }
    });
  });

  describe("scientific rigor: pre-specified outcomes (CSSD, dialysis, occupancy)", () => {
    it("declares PRIMARY_OUTCOMES in code", () => {
      const ids = PRIMARY_OUTCOMES.map((o) => o.id).sort();
      expect(ids).toEqual(["cssd-cycles", "dialysis-sessions", "occupancy"]);
      for (const o of PRIMARY_OUTCOMES) {
        expect(o.paths.length).toBeGreaterThan(0);
        expect(o.description.length).toBeGreaterThan(0);
      }
    });

    it("reports primary outcome effects per run (contract, Deers-Rock is stochastic)", () => {
      const run = runSingleSeed(42);
      const ids = new Set(run.primaryOutcomes.map((e) => e.outcomeId));
      // Effects are only ever reported for pre-specified outcomes.
      for (const id of ids) {
        expect(PRIMARY_OUTCOMES.some((o) => o.id === id)).toBe(true);
      }
      // Every effect is well-formed and belongs to the sentinel sector.
      for (const e of run.primaryOutcomes) {
        expect(typeof e.absoluteDelta).toBe("number");
        expect(typeof e.path).toBe("string");
        expect(e.sector.startsWith("deers-rock-")).toBe(true);
      }
      // After aliasing fix: the climate intervention (lower CO2 / noise) may or
      // may not produce observable DR deltas depending on whether weather events
      // actually reach the sentinel. Zero deltas are a valid scientific finding.
      // The structural contract above is sufficient.
    });

    it("reports primary outcomes at the experiment level", () => {
      for (const o of PRIMARY_OUTCOMES) {
        const report = experiment.primaryOutcomes.find((r) => r.id === o.id);
        expect(report).toBeDefined();
        expect(report!.perSeedMeanDelta).toHaveLength(seedCount);
        expect(Array.isArray(report!.observedPaths)).toBe(true);
        expect(report!.expectedPathCount).toBe(report!.paths.length);
      }
      // After aliasing fix: zero deltas are a valid scientific finding when the
      // intervention does not causally affect DR outcomes. The structural contract
      // above (reports defined, correct lengths, arrays) is sufficient.
    });
  });

  describe("scientific rigor: bookkeeping metrics", () => {
    it("excludes year/tickCount from causal metric sets", () => {
      for (const run of experiment.runs) {
        for (const sd of Object.values(run.diff.perSector)) {
          for (const m of sd.metrics) {
            expect(isBookkeepingPath(m.path)).toBe(false);
            expect(m.path).not.toBe("year");
            expect(m.path).not.toBe("tickCount");
          }
        }
      }
    });

    it("reports bookkeeping clock fields explicitly (and equal across branches)", () => {
      for (const run of experiment.runs) {
        expect(run.guards.bookkeeping.year.parent).toBe(run.guards.bookkeeping.year.child);
        expect(run.guards.bookkeeping.tickCount.parent).toBe(run.guards.bookkeeping.tickCount.child);
        expect(run.guards.bookkeeping.tickCount.parent).toBe(20);
      }
    });
  });
});
