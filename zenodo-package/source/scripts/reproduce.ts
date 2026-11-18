#!/usr/bin/env node
/**
 * reproduce.ts — one-command reproducibility gate for the Kronos Engine.
 *
 * Runs the full deterministic verification pipeline IN ORDER and exits 0 only
 * if every deterministic gate passes:
 *
 *   (a) npx tsc --noEmit                          type-check clean
 *   (b) npx vitest run                            full test suite
 *   (c) npx tsx scripts/verify-facts.ts           paper-claim gate (12 checks)
 *   (d) P-003 calibrated experiment regenerated IN MEMORY (seeds 42..71) and
 *       compared against
 *       experiment-results/wwii-counterfactual/p003-calibrated-summary.json
 *       on a NORMALIZED basis — metric count, per-path mean / cohensD /
 *       significant (within tolerance 1e-6), and significant counts.
 *       Raw bytes are intentionally NOT compared: summaries embed a
 *       `generatedAt` timestamp.
 *   (e) Sensitivity sweep regenerated IN MEMORY — noise-baseline fields exist
 *       and falsePositiveRatio is a finite number >= 0.
 *
 * P-004 (Deers-Rock sentinel counterfactual) is NOT a deterministic gate: the
 * sibling repo uses unseeded Math.random / Date.now. If the Deers-Rock dist
 * bundle is present (default sibling checkout, e.g. ../Deers-Rock/dist/index.js
 * or C:\Users\think\Project_v2\Deers-Rock\dist\index.js), a P-004 rerun is
 * attempted and reported INFORMATIONALLY. Its outcome never affects the exit
 * code.
 *
 * This script NEVER writes to experiment-results/ or any committed file. All
 * regenerated experiment outputs are computed in memory.
 *
 * KNOWN REPO SIDE EFFECT (neutralized here): the experiment tests
 * (p003-calibrated.test.ts, dr-counterfactual.test.ts, sensitivity-sweep.test.ts)
 * double as artifact regenerators and rewrite several committed JSON files
 * under experiment-results/ whenever `npx vitest run` executes (gates b and c).
 * reproduce.ts snapshots the COMMITTED bytes of those files before running any
 * gate and restores them immediately after gate (c), so the worktree is left
 * exactly as it was found (no experiment-results/ changes in `git status`).
 *
 * Cross-platform (Windows PowerShell + POSIX): uses node:child_process with
 * `shell: true` and node: APIs only. Run from the repository root:
 *
 *   npx tsx scripts/reproduce.ts
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");

const P003_ARTIFACT = join(REPO_ROOT, "experiment-results", "wwii-counterfactual", "p003-calibrated-summary.json");
const SWEEP_ARTIFACT = join(REPO_ROOT, "experiment-results", "wwii-counterfactual", "sensitivity-sweep.json");

/**
 * Documented corrected numbers — the pinned reproduction contract (see
 * docs/REPRODUCIBILITY.md). The committed artifact AND the in-memory
 * regeneration must both match these, so a drifted artifact fails loudly.
 */
const EXPECTED = {
  metrics: 1233,
  significant: 19, // uncorrected (p < 0.05)
  significantFDR: 1,
  significantBonferroni: 1,
  gdpSignificant: 0, // pre-specified nation-GDP primary outcome
} as const;

/** Comparison tolerance for normalized per-path stats (mean / cohensD). */
const TOLERANCE = 1e-6;

/** P-003 calibrated run: seeds 42..71 (30 seeds) — matches run-calibrated.ts. */
const SEEDS = Array.from({ length: 30 }, (_, i) => 42 + i);

/** Where the Deers-Rock dist bundle may live (sibling default + literal checkout path). */
const DR_BUNDLES = [
  resolve(REPO_ROOT, "..", "Deers-Rock", "dist", "index.js"),
  "C:/Users/think/Project_v2/Deers-Rock/dist/index.js",
];

/**
 * Committed artifacts that the experiment tests rewrite as a side effect of
 * `npx vitest run` (the calibrated/sweep tests double as regenerators).
 * reproduce.ts snapshots the committed bytes and restores them after the
 * vitest-running gates so the worktree stays clean.
 */
const TEST_REWRITTEN_ARTIFACTS = [
  "experiment-results/wwii-counterfactual/p003-calibrated-summary.json",
  "experiment-results/wwii-counterfactual/p003-calibrated-runs.json",
  "experiment-results/wwii-counterfactual/sensitivity-sweep.json",
  "experiment-results/dr-counterfactual/p004-summary.json",
  "experiment-results/dr-counterfactual/p004-runs.json",
] as const;

interface GateResult {
  name: string;
  passed: boolean;
  detail: string;
}

interface MetricFingerprint {
  mean: number;
  cohensD: number;
  significant: boolean;
}

const gates: GateResult[] = [];
const notes: string[] = [];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripAnsi(s: string): string {
  return s.replace(/\u001b\[[0-9;]*m/g, "");
}

/** Run a shell command with `shell: true` (works on Windows PowerShell + POSIX). */
function run(cmd: string, timeoutMs: number): { stdout: string; stderr: string; code: number } {
  try {
    const stdout = execSync(cmd, {
      encoding: "utf-8",
      shell: true,
      cwd: REPO_ROOT,
      timeout: timeoutMs,
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    return { stdout, stderr: "", code: 0 };
  } catch (err: unknown) {
    const e = err as { stdout?: unknown; stderr?: unknown; status?: unknown; message?: string };
    return {
      stdout: typeof e.stdout === "string" ? e.stdout : "",
      stderr: typeof e.stderr === "string" ? e.stderr : e.message ?? String(err),
      code: typeof e.status === "number" ? e.status : 1,
    };
  }
}

/** Normalized fingerprint of a metric list keyed by path (order-independent). */
function fingerprint(metrics: any[]): Map<string, MetricFingerprint> {
  const map = new Map<string, MetricFingerprint>();
  for (const m of metrics) {
    map.set(String(m.path), { mean: Number(m.mean), cohensD: Number(m.cohensD), significant: Boolean(m.significant) });
  }
  return map;
}

/**
 * Snapshot which of the test-rewritten artifacts are tracked in HEAD. The
 * restore uses `git restore --staged --worktree --source=HEAD`, which resets
 * both the index entry and the working-tree file to the committed state
 * (reapplying the repo's line-ending/autocrlf conversion and refreshing the
 * index stat cache) so `git status` reports the file clean.
 */
function snapshotCommittedArtifacts(): Map<string, boolean> {
  const snapshot = new Map<string, boolean>();
  for (const rel of TEST_REWRITTEN_ARTIFACTS) {
    try {
      execSync(`git cat-file -e HEAD:${rel}`, {
        cwd: REPO_ROOT,
        shell: true,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      snapshot.set(rel, true);
    } catch {
      snapshot.set(rel, false); // not tracked in HEAD — the tests may still create it
    }
  }
  return snapshot;
}

/** Restore the committed bytes so `git status` shows no experiment-results/ changes. */
function restoreCommittedArtifacts(snapshot: Map<string, boolean>): void {
  for (const [rel, tracked] of snapshot) {
    const abs = join(REPO_ROOT, rel);
    if (!tracked) {
      if (existsSync(abs)) rmSync(abs, { force: true });
      continue;
    }
    try {
      execSync(`git restore --staged --worktree --source=HEAD -- "${rel}"`, {
        cwd: REPO_ROOT,
        shell: true,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err: unknown) {
      notes.push(`could not restore committed artifact ${rel}: ${(err as Error).message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Gate (a): TypeScript type-check
// ---------------------------------------------------------------------------

function gateTypeCheck(): GateResult {
  const res = run("npx tsc --noEmit", 180_000);
  const detail = res.code === 0
    ? "tsc --noEmit clean"
    : `tsc exited ${res.code}: ${(res.stderr || res.stdout).split("\n").filter(Boolean).slice(-6).join(" | ")}`;
  return { name: "Type-check (npx tsc --noEmit)", passed: res.code === 0, detail };
}

// ---------------------------------------------------------------------------
// Gate (b): full test suite
// ---------------------------------------------------------------------------

function gateTestSuite(): GateResult {
  const res = run("npx vitest run", 600_000);
  const clean = stripAnsi(res.stdout);
  const testMatch = clean.match(/Tests\s+(\d+)\s+passed/i);
  const fileMatch = clean.match(/Test\s+Files\s+(\d+)\s+passed/i);
  const tests = testMatch ? parseInt(testMatch[1]!, 10) : 0;
  const files = fileMatch ? parseInt(fileMatch[1]!, 10) : 0;
  const passed = res.code === 0 && tests > 0;
  const detail = passed
    ? `${tests} tests in ${files} files passed`
    : `vitest exited ${res.code} (${tests} tests / ${files} files parsed): ${(res.stderr || clean).split("\n").filter(Boolean).slice(-6).join(" | ")}`;
  return { name: "Test suite (npx vitest run)", passed, detail };
}

// ---------------------------------------------------------------------------
// Gate (c): verify-facts paper-claim gate
// ---------------------------------------------------------------------------

function gateVerifyFacts(): GateResult {
  const res = run("npx tsx scripts/verify-facts.ts", 600_000);
  const clean = stripAnsi(res.stdout);
  const summaryMatch = clean.match(/(\d+)\s+checks:\s+(\d+)\s+passed,\s+(\d+)\s+failed/i);
  const total = summaryMatch ? parseInt(summaryMatch[1]!, 10) : 0;
  const failed = summaryMatch ? parseInt(summaryMatch[3]!, 10) : -1;
  const passed = res.code === 0 && failed === 0;
  const detail = passed
    ? `${total}/${total} checks passed (exit 0)`
    : `verify-facts exited ${res.code}: ${clean.split("\n").filter(Boolean).slice(-6).join(" | ")}`;
  return { name: "Verify facts (npx tsx scripts/verify-facts.ts)", passed, detail };
}

// ---------------------------------------------------------------------------
// Gate (d): P-003 calibrated experiment — in-memory regeneration vs artifact
// ---------------------------------------------------------------------------

async function gateP003(): Promise<GateResult> {
  if (!existsSync(P003_ARTIFACT)) {
    return { name: "P-003 calibrated regeneration matches committed artifact", passed: false, detail: `missing committed artifact: ${P003_ARTIFACT}` };
  }

  let committed: any;
  try {
    committed = JSON.parse(readFileSync(P003_ARTIFACT, "utf-8"));
  } catch (err: unknown) {
    return { name: "P-003 calibrated regeneration matches committed artifact", passed: false, detail: `unreadable committed artifact: ${(err as Error).message}` };
  }

  // Regenerate IN MEMORY (never written to experiment-results/).
  const mod = await import(pathToFileURL(join(REPO_ROOT, "src", "experiment", "experiments", "wwii-no-war.js")).href);
  const experiment = mod.runExperiment(SEEDS);
  const regen = experiment.summary;

  const problems: string[] = [];
  const cCount = committed.metrics?.length;
  const rCount = regen.metrics.length;

  // 1) Metric count must match the artifact AND the documented corrected number.
  if (cCount !== rCount) problems.push(`metric count: committed=${cCount} regenerated=${rCount}`);
  if (rCount !== EXPECTED.metrics) problems.push(`metric count ${rCount} != documented ${EXPECTED.metrics}`);

  // 2) Significant counts (uncorrected / FDR / Bonferroni).
  const cSig = committed.observedSignificant;
  const rSig = regen.observedSignificant;
  if (cSig !== rSig) problems.push(`significant count: committed=${cSig} regenerated=${rSig}`);
  if (rSig !== EXPECTED.significant) problems.push(`significant count ${rSig} != documented ${EXPECTED.significant}`);

  const cFdr = committed.observedSignificantFDR;
  const rFdr = regen.observedSignificantFDR;
  if (cFdr !== rFdr) problems.push(`FDR count: committed=${cFdr} regenerated=${rFdr}`);
  if (rFdr !== EXPECTED.significantFDR) problems.push(`FDR count ${rFdr} != documented ${EXPECTED.significantFDR}`);

  const cBonf = committed.observedSignificantBonferroni;
  const rBonf = regen.observedSignificantBonferroni;
  if (cBonf !== rBonf) problems.push(`Bonferroni count: committed=${cBonf} regenerated=${rBonf}`);
  if (rBonf !== EXPECTED.significantBonferroni) problems.push(`Bonferroni count ${rBonf} != documented ${EXPECTED.significantBonferroni}`);

  // 3) Pre-specified nation-GDP primary outcome: 0 significant (documented).
  const rGdpSig = regen.metrics.filter((m: any) => m.path.includes("gdp") && !m.path.includes("GrowthRate") && m.significant).length;
  if (rGdpSig !== EXPECTED.gdpSignificant) problems.push(`significant GDP metrics ${rGdpSig} != documented ${EXPECTED.gdpSignificant}`);

  // 4) Normalized per-path comparison (mean / cohensD within 1e-6, significant).
  const committedFp = fingerprint(committed.metrics ?? []);
  const regenFp = fingerprint(regen.metrics);
  if (committedFp.size === 0) problems.push("committed artifact has no metrics");
  let compared = 0;
  for (const [path, cf] of committedFp) {
    const rf = regenFp.get(path);
    if (!rf) {
      problems.push(`path missing from regeneration: ${path}`);
      continue;
    }
    compared++;
    for (const field of ["mean", "cohensD"] as const) {
      if (Math.abs(rf[field] - cf[field]) > TOLERANCE) {
        problems.push(`${path} ${field}: ${rf[field]} vs committed ${cf[field]} (Δ > ${TOLERANCE})`);
      }
    }
    if (rf.significant !== cf.significant) {
      problems.push(`${path} significant: ${rf.significant} vs committed ${cf.significant}`);
    }
  }
  if (compared !== cCount) problems.push(`compared ${compared} paths but artifact has ${cCount}`);

  const passed = problems.length === 0;
  const detail = passed
    ? `${rCount} metrics, ${rSig} significant / ${rFdr} FDR / ${rBonf} Bonferroni (${rGdpSig} GDP), ${compared} paths match committed within ${TOLERANCE}`
    : problems.slice(0, 8).join("; ") + (problems.length > 8 ? `; … (${problems.length} issues)` : "");
  return { name: "P-003 calibrated regeneration matches committed artifact (seeds 42..71, in memory)", passed, detail };
}

// ---------------------------------------------------------------------------
// Gate (e): sensitivity sweep — noise-baseline fields
// ---------------------------------------------------------------------------

async function gateSweep(): Promise<GateResult> {
  const mod = await import(pathToFileURL(join(REPO_ROOT, "src", "experiment", "experiments", "sensitivity-sweep.js")).href);
  const report = mod.runSweep();

  const noise = report?.noise;
  const problems: string[] = [];

  if (!noise || typeof noise !== "object") {
    return { name: "Sensitivity sweep noise-baseline checks", passed: false, detail: "report.noise missing or not an object" };
  }

  const requiredFields = ["n", "totalMetrics", "falsePositiveCount", "falsePositiveRatio", "avgCiWidth", "avgCohensD", "noiseFloor"];
  const missing = requiredFields.filter((k) => !(k in noise));
  if (missing.length > 0) problems.push(`missing noise-baseline fields: ${missing.join(", ")}`);

  const fpr = noise.falsePositiveRatio;
  if (typeof fpr !== "number" || !Number.isFinite(fpr)) {
    problems.push(`falsePositiveRatio is not a finite number: ${String(fpr)}`);
  } else if (fpr < 0) {
    problems.push(`falsePositiveRatio < 0: ${fpr}`);
  }

  const noiseFloorOk = !!noise.noiseFloor && typeof noise.noiseFloor === "object";
  if (!noiseFloorOk) problems.push("noise.noiseFloor missing");

  // Informational: sweep signal vs committed artifact (non-blocking).
  let info = "";
  if (existsSync(SWEEP_ARTIFACT)) {
    try {
      const committed = JSON.parse(readFileSync(SWEEP_ARTIFACT, "utf-8"));
      const committedSignal = new Map((committed.signal ?? []).map((s: any) => [s.n, { metrics: s.totalMetrics, sig: s.significantCount }]));
      const drift: string[] = [];
      for (const s of report.signal ?? []) {
        const cs = committedSignal.get(s.n);
        if (!cs || cs.metrics !== s.totalMetrics || cs.sig !== s.significantCount) {
          drift.push(`n=${s.n} regenerated ${s.totalMetrics}/${s.significantCount} vs committed ${cs?.metrics ?? "?"}/${cs?.sig ?? "?"}`);
        }
      }
      info = drift.length === 0
        ? "signal sweep matches committed artifact"
        : `signal sweep differs from committed artifact: ${drift.join("; ")}`;
    } catch {
      info = "could not read committed sensitivity-sweep.json for comparison";
    }
  }

  const passed = problems.length === 0;
  const detail = passed
    ? `noise baseline fields present; falsePositiveRatio=${fpr} (finite, >= 0); totalMetrics=${noise.totalMetrics}; ${info}`
    : problems.join("; ");
  return { name: "Sensitivity sweep noise-baseline fields + finite falsePositiveRatio", passed, detail };
}

// ---------------------------------------------------------------------------
// P-004 (optional, informational only — never a gate)
// ---------------------------------------------------------------------------

async function attemptP004(): Promise<void> {
  const drFound = DR_BUNDLES.some((p) => existsSync(p));
  if (!drFound) {
    notes.push("P-004 (informational): skipped — Deers-Rock dist bundle not found (looked for ../Deers-Rock/dist/index.js and the literal checkout path). P-004 is optional and non-deterministic.");
    return;
  }
  try {
    const drMod = await import(pathToFileURL(join(REPO_ROOT, "src", "experiment", "experiments", "dr-counterfactual.js")).href);
    const drExp = drMod.runExperiment(SEEDS);
    const s = drExp.summary;
    notes.push(
      `P-004 (informational): reran with seeds 42..71 → ${s.metrics.length} metrics, ${s.observedSignificant} significant (${s.observedSignificantFDR} FDR, ${s.observedSignificantBonferroni} Bonferroni). ` +
        "NOTE: Deers-Rock uses unseeded Math.random/Date.now, so this run is NOT byte-comparable to the committed artifact (212 metrics / 14 significant) and exact reproduction is NOT guaranteed.",
    );
  } catch (err: unknown) {
    notes.push(`P-004 (informational): attempted but failed to run — ${(err as Error).message ?? String(err)}. This does NOT fail reproduction (P-004 is non-deterministic).`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const started = Date.now();
  console.log("=".repeat(72));
  console.log("  Kronos Engine — one-command reproduction");
  console.log(`  repo: ${REPO_ROOT}`);
  console.log("=".repeat(72));
  console.log("Running deterministic gates in order…\n");

  // Snapshot committed artifact bytes BEFORE running any gate: gates (b) and
  // (c) execute `npx vitest run`, whose experiment tests rewrite these files.
  const artifactSnapshot = snapshotCommittedArtifacts();

  const gA = gateTypeCheck();
  gates.push(gA);
  console.log(`  [${gA.passed ? "PASS" : "FAIL"}] ${gA.name} — ${gA.detail}`);

  const gB = gateTestSuite();
  gates.push(gB);
  console.log(`  [${gB.passed ? "PASS" : "FAIL"}] ${gB.name} — ${gB.detail}`);

  const gC = gateVerifyFacts();
  gates.push(gC);
  console.log(`  [${gC.passed ? "PASS" : "FAIL"}] ${gC.name} — ${gC.detail}`);

  // Restore committed artifact bytes that the test suite rewrote as a side
  // effect of gates (b)/(c). The worktree is left exactly as it was found.
  restoreCommittedArtifacts(artifactSnapshot);

  const gD = await gateP003();
  gates.push(gD);
  console.log(`  [${gD.passed ? "PASS" : "FAIL"}] ${gD.name} — ${gD.detail}`);

  const gE = await gateSweep();
  gates.push(gE);
  console.log(`  [${gE.passed ? "PASS" : "FAIL"}] ${gE.name} — ${gE.detail}`);

  // P-004 informational attempt (never a gate).
  await attemptP004();

  // Final summary table.
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const passedCount = gates.filter((g) => g.passed).length;
  console.log("\n" + "-".repeat(72));
  console.log("  SUMMARY");
  console.log("-".repeat(72));
  for (const g of gates) {
    console.log(`  [${g.passed ? "PASS" : "FAIL"}] ${g.name}`);
  }
  for (const n of notes) {
    console.log(`  [INFO] ${n}`);
  }
  console.log("-".repeat(72));
  console.log(`  Deterministic gates: ${passedCount}/${gates.length} passed (${elapsed}s)`);
  const ok = passedCount === gates.length;
  console.log(ok ? "  RESULT: REPRODUCIBLE — all deterministic gates passed." : "  RESULT: NOT REPRODUCIBLE — one or more deterministic gates failed.");
  console.log("-".repeat(72));

  process.exitCode = ok ? 0 : 1;
}

main().catch((err: unknown) => {
  console.error(`FATAL: ${(err as Error).message ?? String(err)}`);
  process.exitCode = 1;
});
