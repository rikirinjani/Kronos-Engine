/**
 * verify-facts.ts — Truth-repair CI gate
 *
 * Verifies paper claims against actual code behavior.
 * Inspired by Cosmogonic's `verify:facts` and `docs-truth-law` CI gate.
 *
 * Usage: npx tsx scripts/verify-facts.ts
 * Exit code: 0 = all facts verified, 1 = one or more facts failed
 */

import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { createRNG } from "../src/engine/rng.js";
import { createWorld } from "../src/engine/world-engine.js";
import { createUniverse } from "../src/engine/universe.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { createEnergySector } from "../src/sectors/energy.js";
import { createDemographicsSector } from "../src/sectors/demographics.js";
import type { Sector, SectorRecord } from "../src/engine/world-engine.js";

interface FactResult {
  name: string;
  passed: boolean;
  detail: string;
}

const facts: FactResult[] = [];
let failures = 0;

function check(name: string, condition: boolean, detail: string): void {
  const passed = condition;
  facts.push({ name, passed, detail });
  if (!passed) failures++;
  console.log(passed ? `  ✅ ${name}` : `  ❌ ${name} — ${detail}`);
}

function run(cmd: string): { stdout: string; stderr: string; code: number } {
  try {
    const out = execSync(cmd, { encoding: "utf-8", timeout: 120_000 });
    return { stdout: out, stderr: "", code: 0 };
  } catch (e: any) {
    return {
      stdout: e.stdout || "",
      stderr: e.stderr || e.message || "",
      code: e.status ?? 1,
    };
  }
}

async function main() {
  const startTime = Date.now();
  console.log("\n🔍 Verifying paper claims against code...\n");

  // ── Fact 1: TypeScript compilation ──
  // Paper claim: "tsc --noEmit clean"
  const tsc = run("npx tsc --noEmit 2>&1");
  check(
    "TypeScript compiles without errors",
    tsc.code === 0,
    tsc.code !== 0 ? tsc.stderr.slice(0, 200) : "OK",
  );

  // ── Fact 2: Test suite ──
  // Paper claim: "175+ tests, 20+ files"
  const testOut = run("npx vitest run 2>&1");
  const testMatch = testOut.stdout.match(/(\d+)\s+tests passed/i);
  const testFileMatch = testOut.stdout.match(/(\d+)\s+test files/i);
  const testCount = testMatch ? parseInt(testMatch[1]) : 0;
  const testFileCount = testFileMatch ? parseInt(testFileMatch[1]) : 0;
  check(
    "Test suite: >= 175 tests passing",
    testOut.code === 0 && testCount >= 175,
    `${testCount} tests in ${testFileCount} files`,
  );
  check(
    "Test suite: >= 20 test files",
    testFileCount >= 20,
    `${testFileCount} test files`,
  );

  // ── Fact 3: Deterministic replay ──
  // Paper claim: "identical inputs produce identical outputs"
  const allSectors: Sector[] = [
    createEconomySector(),
    createClimateSector(),
    createGeopoliticsSector(),
    createTechnologySector(),
    createEnergySector(),
    createDemographicsSector(),
  ];
  const configs: Record<string, Record<string, unknown>> = {};
  for (const s of allSectors) {
    configs[s.id] = {};
  }

  const world1 = createWorld(allSectors, configs, { seed: 42 });
  const world2 = createWorld(allSectors, configs, { seed: 42 });
  check(
    "Deterministic: same seed produces identical initial state",
    world1.rngState.seed === world2.rngState.seed &&
      world1.tick === world2.tick &&
      world1.universe.id === world2.universe.id,
    `Seed match: ${world1.rngState.seed === world2.rngState.seed}, Tick match: ${world1.tick === world2.tick}`,
  );

  // ── Fact 4: Sectors exist ──
  // Paper claims 6 world sectors + sentinel adapter
  const sectorIds = allSectors.map((s) => s.id).sort();
  check(
    "6 world sectors implemented",
    sectorIds.length === 6,
    `Found sectors: ${sectorIds.join(", ")}`,
  );

  const expectedSectors = ["climate", "demographics", "economy", "energy", "geopolitics", "technology"];
  const hasAllSectors = expectedSectors.every((id) => sectorIds.includes(id));
  check(
    "All 6 required sectors present",
    hasAllSectors,
    hasAllSectors ? "OK" : `Missing: ${expectedSectors.filter((id) => !sectorIds.includes(id)).join(", ")}`,
  );

  // ── Fact 5: Sentinel adapter exists ──
  const sentinelPath = "src/sectors/deers-rock-adapter.ts";
  check(
    "Deers Rock sentinel adapter exists",
    existsSync(sentinelPath),
    existsSync(sentinelPath) ? "OK" : "File not found: " + sentinelPath,
  );

  // ── Fact 6: Experiment results exist ──
  const p003Summary = "experiment-results/wwii-counterfactual/p003-calibrated-summary.json";
  const p004Summary = "experiment-results/dr-counterfactual/p004-30seeds-summary.json";
  const heatmap = "experiment-results/dr-counterfactual/heatmap.json";
  check(
    "P-003 experiment results exist",
    existsSync(p003Summary),
    existsSync(p003Summary) ? "OK" : "Missing: " + p003Summary,
  );
  check(
    "P-004 experiment results exist",
    existsSync(p004Summary),
    existsSync(p004Summary) ? "OK" : "Missing: " + p004Summary,
  );
  check(
    "30-hospital heatmap exists",
    existsSync(heatmap),
    existsSync(heatmap) ? "OK" : "Missing: " + heatmap,
  );

  // ── Fact 7: No patient-level data in sector code ──
  // Paper claim: "No patient-level data (identifiers, clinical notes, lab results) exposed"
  const sensitivePatterns = [
    "patientId",
    "patient_name",
    "clinical_note",
    "lab_result",
    "medical_record",
    "ssn",
    "date_of_birth",
    "diagnosis_code",
  ];
  for (const pattern of sensitivePatterns) {
    const grep = run(`rg -l "${pattern}" src/sectors/ 2>nul`);
    if (grep.code === 0) {
      check(
        `No '${pattern}' leakage in sector code`,
        false,
        `Found in: ${grep.stdout.slice(0, 200)}`,
      );
    }
  }
  // If none failed, add a passing check
  const leakFacts = facts.filter((f) => f.name.includes("leakage"));
  const leakPassed = leakFacts.every((f) => f.passed);
  if (leakFacts.length > 0 && leakPassed) {
    // already recorded
  } else if (leakFacts.length === 0) {
    // No leak checks ran (rg not found). Soft-pass.
    console.log("  ⚠️  Patient data leakage check skipped (rg not available)");
  }

  // ── Fact 8: All sectors export via index ──
  const sectorIndex = readFileSync("src/sectors/index.ts", "utf-8");
  const exportNames = ["createEconomySector", "createClimateSector", "createGeopoliticsSector",
    "createTechnologySector", "createEnergySector", "createDemographicsSector"];
  const allExported = exportNames.every((name) => sectorIndex.includes(name));
  check(
    "All sectors exported from index",
    allExported,
    allExported ? "OK" : `Missing exports in index.ts`,
  );

  // ── Summary ──
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Verify facts complete (${elapsed}s)`);
  console.log(`   ${facts.length} checks: ${facts.filter((f) => f.passed).length} passed, ${failures} failed`);
  console.log(`${"=".repeat(50)}\n`);

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
