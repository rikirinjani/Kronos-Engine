import { describe, it, expect } from "vitest";
import {
  runSingleSeed,
  runExperiment,
  PRIMARY_OUTCOMES,
  isBookkeepingPath,
  assertMatchedHorizon,
  assertBaselineIntegrity,
} from "./wwii-no-war.js";
import { createWorld, run, snapshot, resetUniverseCounter } from "../../engine/index.js";
import { createRewindPoint, resetBranchCounter, resetRewindCounter } from "../../timeline/index.js";
import { createGeopoliticsSector } from "../../sectors/geopolitics.js";
import { createClimateSector } from "../../sectors/climate.js";

function minimalWorldWithRewindPoint() {
  resetUniverseCounter();
  resetRewindCounter();
  resetBranchCounter();
  const sectors = [createGeopoliticsSector(), createClimateSector()];
  const sectorMap = new Map(sectors.map((s) => [s.id, s]));
  const world = createWorld(
    sectors,
    {
      geopolitics: {
        nations: [],
        wars: [],
        alliances: [],
        globalState: { totalPopulation: 1, avgTechnologyLevel: 1, avgHealthOutcome: 1, co2Emissions: 1, tradeVolume: 1 },
        year: 1939,
        casualtyMultiplier: 1,
      },
      climate: { co2Concentration: 310, annualEmissions: 3, year: 1939, annualEmissionsNoise: 0.2 },
    },
    { seed: 42 },
  );
  const rp = createRewindPoint(world, "preseeded", { label: "t0" });
  return { world, rp, sectorMap };
}

describe("WWII No-War Counterfactual", () => {
  it("runs a single seed and produces a diff with all 6 sectors", () => {
    const run = runSingleSeed(42);
    expect(run.seed).toBe(42);
    expect(run.rewindTick).toBe(0);
    expect(run.totalTicks).toBe(30);
    expect(run.diff.perSector).toBeDefined();
    expect(Object.keys(run.diff.perSector).length).toBe(6);
    expect(run.diff.perSector).toHaveProperty("geopolitics");
    expect(run.diff.perSector).toHaveProperty("climate");
    expect(run.diff.perSector).toHaveProperty("economy");
    expect(run.diff.perSector).toHaveProperty("technology");
    expect(run.diff.perSector).toHaveProperty("energy");
    expect(run.diff.perSector).toHaveProperty("demographics");
  });

  it("shows meaningful divergence across sectors", () => {
    const run = runSingleSeed(42);
    const geopolitics = run.diff.perSector["geopolitics"]!;
    const demographics = run.diff.perSector["demographics"]!;
    const economy = run.diff.perSector["economy"]!;

    expect(geopolitics.metrics.length).toBeGreaterThan(0);
    expect(demographics.metrics.length).toBeGreaterThan(0);
    expect(economy.metrics.length).toBeGreaterThan(0);
  });

  it("demographics shows population divergence (no war deaths)", () => {
    const run = runSingleSeed(42);
    const demo = run.diff.perSector["demographics"]!;
    const popMetrics = demo.metrics.filter(
      (m) => m.path.includes("population") && !m.path.includes("laborForce") && !m.path.includes("global"),
    );
    expect(popMetrics.length).toBeGreaterThan(0);
  });

  it("economy shows GDP divergence (no war destruction)", () => {
    const run = runSingleSeed(42);
    const econ = run.diff.perSector["economy"]!;
    const gdpMetrics = econ.metrics.filter((m) => m.path.includes("gdp"));
    expect(gdpMetrics.length).toBeGreaterThan(0);
  });

  it("different seeds produce divergent metric patterns", () => {
    const run42 = runSingleSeed(42);
    const run43 = runSingleSeed(43);

    const allPaths = new Set<string>();
    for (const s of Object.values(run42.diff.perSector)) {
      for (const m of s.metrics) allPaths.add(m.path);
    }
    for (const s of Object.values(run43.diff.perSector)) {
      for (const m of s.metrics) allPaths.add(m.path);
    }
    expect(allPaths.size).toBeGreaterThan(0);

    const sharedPaths = [...allPaths].filter((p) => {
      const v42 = run42.diff.perSector["geopolitics"]?.metrics.find((m) => m.path === p);
      const v43 = run43.diff.perSector["geopolitics"]?.metrics.find((m) => m.path === p);
      return v42 && v43;
    });
    expect(sharedPaths.length).toBeGreaterThanOrEqual(5);
  });

  it("full experiment with 3 seeds produces statistical summary", () => {
    const experiment = runExperiment([42, 43, 44]);
    expect(experiment.numSeeds).toBe(3);
    expect(experiment.runs).toHaveLength(3);
    expect(experiment.summary.n).toBe(3);
    expect(experiment.summary.metrics.length).toBeGreaterThan(0);

    const significantMetrics = experiment.summary.metrics.filter((m) => m.significant);
    expect(significantMetrics.length).toBeGreaterThan(0);
  });

  describe("scientific rigor: pre-specified outcomes", () => {
    it("declares PRIMARY_OUTCOMES in code with nation-GDP paths", () => {
      const gdp = PRIMARY_OUTCOMES.find((o) => o.id === "nation-gdp");
      expect(gdp).toBeDefined();
      expect(gdp!.paths.length).toBeGreaterThan(0);
      expect(gdp!.paths.every((p) => p.endsWith(".gdp"))).toBe(true);
      expect(gdp!.label.toLowerCase()).toContain("pre-specified");
    });

    it("reports primary outcome effects per run", () => {
      const run = runSingleSeed(42);
      const gdpEffects = run.primaryOutcomes.filter((e) => e.outcomeId === "nation-gdp");
      expect(gdpEffects.length).toBeGreaterThan(0);
      for (const e of gdpEffects) {
        expect(e.path.endsWith(".gdp")).toBe(true);
        expect(typeof e.absoluteDelta).toBe("number");
      }
    });

    it("reports primary outcomes at the experiment level", () => {
      const experiment = runExperiment([42, 43, 44]);
      const report = experiment.primaryOutcomes.find((o) => o.id === "nation-gdp");
      expect(report).toBeDefined();
      expect(report!.perSeedMeanDelta).toHaveLength(3);
      expect(report!.expectedPathCount).toBeGreaterThan(0);
      expect(report!.observedPathCount).toBeGreaterThan(0);
    });
  });

  describe("scientific rigor: matched horizon", () => {
    it("runs parent and child to the SAME tick from the SAME baseline", () => {
      const run = runSingleSeed(42);
      expect(run.guards.matchedHorizon).toBe(true);
      expect(run.guards.parentTick).toBe(30);
      expect(run.guards.childTick).toBe(30);
      expect(run.guards.childTick).toBe(run.guards.parentTick);
    });

    it("assertMatchedHorizon throws when tick counts differ", () => {
      expect(() => assertMatchedHorizon(30, 33, "test")).toThrow(/Matched-horizon/);
      expect(() => assertMatchedHorizon(30, 30, "test")).not.toThrow();
    });
  });

  describe("scientific rigor: identical baseline", () => {
    it("verifies the rewind baseline deep-equals the pristine parent baseline", () => {
      const run = runSingleSeed(42);
      expect(run.guards.baselineIdentical).toBe(true);
      expect(run.guards.baselineStateHash).toMatch(/^[0-9a-f]{8}$/);
    });

    it("regression: guard throws when the rewind baseline is corrupted (by-reference bug)", () => {
      const { world, rp, sectorMap } = minimalWorldWithRewindPoint();
      const baseline = snapshot(world);
      run(world, 3);
      // Simulate the historical bug: rewind point held state by reference and the
      // parent's in-place advance mutated it (year drifts forward).
      const geo = rp.sectorStates["geopolitics"] as unknown as { year: number };
      geo.year = 1942;
      expect(() => assertBaselineIntegrity(baseline, rp, sectorMap)).toThrow(/Identical-baseline/);
    });
  });

  describe("scientific rigor: bookkeeping metrics", () => {
    it("excludes year/tickCount from causal metric sets", () => {
      const run = runSingleSeed(42);
      for (const sd of Object.values(run.diff.perSector)) {
        for (const m of sd.metrics) {
          expect(isBookkeepingPath(m.path)).toBe(false);
          expect(m.path).not.toBe("year");
          expect(m.path).not.toBe("tickCount");
        }
      }
    });

    it("reports bookkeeping clock fields explicitly (and equal across branches)", () => {
      const run = runSingleSeed(42);
      expect(run.guards.bookkeeping.year.parent).toBe(1969);
      expect(run.guards.bookkeeping.year.child).toBe(1969);
      expect(run.guards.bookkeeping.tickCount.parent).toBe(30);
      expect(run.guards.bookkeeping.tickCount.child).toBe(30);
      expect(run.guards.bookkeeping.year.parent).toBe(run.guards.bookkeeping.year.child);
      expect(run.guards.bookkeeping.tickCount.parent).toBe(run.guards.bookkeeping.tickCount.child);
    });
  });
});
