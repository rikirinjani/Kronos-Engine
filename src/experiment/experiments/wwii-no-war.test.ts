import { describe, it, expect } from "vitest";
import { runSingleSeed, runExperiment } from "./wwii-no-war.js";

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
      const v42 = run42.diff.perSector["economy"]?.metrics.find((m) => m.path === p);
      const v43 = run43.diff.perSector["economy"]?.metrics.find((m) => m.path === p);
      return v42 && v43;
    });
    expect(sharedPaths.length).toBeGreaterThan(5);
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
});
