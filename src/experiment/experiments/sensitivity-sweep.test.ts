import { describe, it, expect, beforeAll } from "vitest";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runSweep } from "./sensitivity-sweep.js";
import type { SweepReport } from "./sensitivity-sweep.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let report: SweepReport;

beforeAll(() => {
  report = runSweep();
});

describe("Sensitivity Sweep Harness", () => {
  it("produces signal results for all seed counts", () => {
    expect(report.signal.length).toBeGreaterThanOrEqual(3);
    for (const s of report.signal) {
      expect(s.totalMetrics).toBeGreaterThan(0);
      expect(s.avgCohensD).toBeGreaterThan(0);
    }
  });

  it("noise baseline has few false positives", () => {
    expect(report.noise.falsePositiveRatio).toBeLessThan(10);
  });

  it("per-sector data covers all 6 sectors", () => {
    const sectors = report.perSector.map((p) => p.sector).sort();
    expect(sectors).toContain("geopolitics");
    expect(sectors).toContain("climate");
    expect(sectors).toContain("economy");
    expect(sectors).toContain("technology");
    expect(sectors).toContain("energy");
    expect(sectors).toContain("demographics");
  });

  it("prints full report for analysis", () => {
    const outPath = join(__dirname, "../../../experiment-results/wwii-counterfactual/sensitivity-sweep.json");
    writeFileSync(outPath, JSON.stringify(report, null, 2));

    console.log("\n=== SIGNAL SWEEP ===");
    for (const s of report.signal) {
      console.log(`N=${s.n}: ${s.significantCount}/${s.totalMetrics} sig (${s.significantRatio}%) | avg|d|=${s.avgCohensD} | CI width=${s.avgCiWidth} | S/N=${s.noiseFloorRatio}`);
    }

    console.log("\n=== NOISE BASELINE (N=" + report.noise.n + ") ===");
    console.log(`False positives: ${report.noise.falsePositiveCount}/${report.noise.totalMetrics} (${report.noise.falsePositiveRatio}%) | avg|d|=${report.noise.avgCohensD} | CI width=${report.noise.avgCiWidth}`);

    console.log("\n=== PER-SECTOR ===");
    for (const ps of report.perSector) {
      console.log(`\n${ps.sector}:`);
      for (const [n, m] of Object.entries(ps.metricsByN)) {
        console.log(`  N=${n}: ${m.significant}/${m.count} sig | avg|d|=${m.avgCohensD} | CI width=${m.avgCiWidth}`);
      }
      console.log(`  noise: ${ps.noiseFloor.falsePositives} FP | CI width=${ps.noiseFloor.avgCiWidth}`);
    }

    expect(report.signal.length).toBeGreaterThan(0);
  });
});
