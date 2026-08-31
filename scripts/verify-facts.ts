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
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { createWorld, tick, snapshot } from "../src/engine/world-engine.js";
import { createEconomySector } from "../src/sectors/economy.js";
import { createClimateSector } from "../src/sectors/climate.js";
import { createGeopoliticsSector } from "../src/sectors/geopolitics.js";
import { createTechnologySector } from "../src/sectors/technology.js";
import { createEnergySector } from "../src/sectors/energy.js";
import { createDemographicsSector } from "../src/sectors/demographics.js";
import type { Sector, WorldState } from "../src/engine/world-engine.js";
import { hashState } from "../src/timeline/hash.js";

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

/** Strip ANSI color codes so vitest summary parsing is insensitive to color rendering. */
function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Recursively collect every `*.ts` file under a directory (portable, no external deps). */
function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Serialized hash of a world's STATE (tick + per-sector state + RNG position).
 *
 * Universe IDs are deliberately excluded: `createUniverse` mints a globally-unique
 * id from a module-level counter (`U-2026-0001`, `U-2026-0002`, …), so two worlds
 * created with the same seed will never share an id. Determinism is a claim about
 * the state, not about the counter.
 */
function worldStateHash(world: WorldState, opts: { excludeRng?: boolean } = {}): string {
  const snap = snapshot(world);
  if (opts.excludeRng) {
    // Exclude rngState too when proving *different seeds diverge*: the seed itself
    // trivially differs, so we want to show the sector state diverges on its own.
    return hashState({ tick: snap.tick, sectors: snap.sectors });
  }
  return hashState({ tick: snap.tick, rngState: snap.rngState, sectors: snap.sectors });
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
  //
  // vitest prints summary lines like:
  //   Test Files  33 passed (33)
  //        Tests  256 passed (256)
  // The number precedes the word "passed", so the old `(\d+) tests passed` pattern
  // never matched. Parse the real summary lines (ANSI-stripped, anchored per-line).
  const testOut = run("npx vitest run 2>&1");
  const cleanTestOut = stripAnsi(testOut.stdout);
  const testMatch = cleanTestOut.match(/^\s*Tests\b[^\n]*?(\d+)\s+passed\b/im);
  const testFileMatch = cleanTestOut.match(/^\s*Test\s+Files\b[^\n]*?(\d+)\s+passed\b/im);
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
  //
  // Compared via hash of serialized world STATE (see worldStateHash). Same seed must
  // reproduce the same state at init AND after 10 ticks; different seeds must diverge.
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

  // Same seed → identical state at init.
  const wSame1 = createWorld(allSectors, configs, { seed: 42 });
  const wSame2 = createWorld(allSectors, configs, { seed: 42 });
  const initHash1 = worldStateHash(wSame1);
  const initHash2 = worldStateHash(wSame2);

  // Same seed → identical replay over 10 ticks.
  let wRun1 = createWorld(allSectors, configs, { seed: 42 });
  let wRun2 = createWorld(allSectors, configs, { seed: 42 });
  for (let i = 0; i < 10; i++) {
    wRun1 = tick(wRun1);
    wRun2 = tick(wRun2);
  }
  const runHash1 = worldStateHash(wRun1);
  const runHash2 = worldStateHash(wRun2);

  // Different seeds → state diverges (rngState excluded: the seed trivially differs).
  let wDiff1 = createWorld(allSectors, configs, { seed: 42 });
  let wDiff2 = createWorld(allSectors, configs, { seed: 99 });
  for (let i = 0; i < 10; i++) {
    wDiff1 = tick(wDiff1);
    wDiff2 = tick(wDiff2);
  }
  const diffHash1 = worldStateHash(wDiff1, { excludeRng: true });
  const diffHash2 = worldStateHash(wDiff2, { excludeRng: true });

  check(
    "Deterministic: same seed → identical state; different seed → divergent state",
    wSame1.rngState.seed === wSame2.rngState.seed &&
      wSame1.tick === wSame2.tick &&
      initHash1 === initHash2 &&
      runHash1 === runHash2 &&
      diffHash1 !== diffHash2,
    `init ${initHash1}==${initHash2} | after 10 ticks ${runHash1}==${runHash2} | seed 42 vs 99: ${diffHash1}!==${diffHash2}`,
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
  //
  // Portable scan (Node fs only — no `rg` dependency, so it actually RUNS on Windows).
  // NOTE: `patientId` is intentionally NOT on the banned list. The Deers Rock adapter
  // (src/sectors/deers-rock-adapter.ts) reads `bed.patientId` internally to count
  // occupied beds for occupancy rate. That handle never flows up into Kronos sector
  // state — sentinel output only carries aggregate pressure signals (see
  // ADAPTER_INVARIANTS.NO_PATIENT_DATA). Banning `patientId` would false-positive on
  // the adapter. The banned list therefore targets patient-RECORD data fields that
  // must never appear in sector state flowing up the stack.
  const sensitivePatterns = [
    "patient_name",
    "clinical_note",
    "lab_result",
    "medical_record",
    "ssn",
    "date_of_birth",
    "diagnosis_code",
  ];
  const sectorTsFiles = collectTsFiles("src/sectors");
  const leakHits: string[] = [];
  for (const file of sectorTsFiles) {
    const content = readFileSync(file, "utf-8");
    for (const pattern of sensitivePatterns) {
      if (content.includes(pattern)) {
        leakHits.push(`${pattern} (${file})`);
      }
    }
  }
  check(
    "No patient-level data leakage in sector code",
    leakHits.length === 0,
    leakHits.length === 0
      ? `Scanned ${sectorTsFiles.length} sector .ts files for ${sensitivePatterns.length} banned patterns — clean`
      : `Found: ${leakHits.join("; ")}`,
  );

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
