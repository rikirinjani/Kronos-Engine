# Reproducibility Guide — Kronos Engine

This document is the reproducibility deliverable for the Kronos Engine. An
external researcher with a POSIX or Windows shell should be able to reproduce
the primary results of the JAMIA manuscript from a clean checkout, using one
command for the deterministic gates and the manual steps below for each
experiment.

The experiment pipeline is **deterministic for P-003** (regenerates
byte-identical metric content from the same seeds) and the sensitivity sweep.
**P-004 is NOT fully deterministic**: it depends on the sibling
[Deers-Rock](https://github.com/Deers-Rock/Deers-Rock) repository, whose model
uses unseeded `Math.random` / `Date.now`. P-004 therefore carries a documented
nondeterminism caveat (see [P-004](#p-004-dr-sentinel-counterfactual)).

---

## 1. Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | **>= 22** (validated on v22.23.2) | Uses `node:`-prefixed built-ins and modern JS. |
| npm | >= 10 (ships with Node 22) | `npm ci` is the recommended install. |

- The dependency set is pinned by the committed **`package-lock.json`
  (lockfileVersion 3)**. Always use `npm ci`, never `npm install`, to guarantee
  the exact devDependency versions (TypeScript 5.8.x, Vitest 3.1.x,
  `@types/node` 26.x).
- Node engine pinning is provided via the lockfile and (once the parallel
  release lane lands) the `engines` field in `package.json` (`node >= 22`);
  treat Node >= 22 as the effective floor today.
- `tsx` is not a direct devDependency — `npx tsx …` fetches the runner on first
  use (one-time network access), then uses the npx cache.
- P-004 additionally requires the sibling Deers-Rock repository checked out at
  `../Deers-Rock` relative to this repo (i.e. `C:\Users\think\Project_v2\Deers-Rock`
  or `<parent>/Deers-Rock`), built to `dist/index.js`. The adapter imports it
  via a relative path (`src/sectors/deers-rock-adapter.ts`).

## 2. Install

```bash
npm ci
```

If you have network-restricted CI, a lockfile-synced `npm install` is an
acceptable fallback, but `npm ci` is authoritative for reproducibility.

## 3. One-command reproduction (recommended)

```bash
npx tsx scripts/reproduce.ts
```

This runs, in order, the five **deterministic gates** and exits `0` only if all
pass:

1. **Type-check** — `npx tsc --noEmit`
2. **Full test suite** — `npx vitest run` (307 tests in 34 files)
3. **Paper-claim gate** — `npx tsx scripts/verify-facts.ts` (12/12 checks)
4. **P-003 calibrated experiment** — regenerated **in memory** with seeds
   42..71 and compared against the committed artifact
   `experiment-results/wwii-counterfactual/p003-calibrated-summary.json` on a
   *normalized* basis (metric count, per-path `mean` / `cohensD` / `significant`
   within tolerance `1e-6`, significant counts). Raw bytes are not compared
   because summaries embed a `generatedAt` timestamp.
5. **Sensitivity sweep** — regenerated **in memory**; the noise-baseline fields
   must exist and `falsePositiveRatio` must be a finite number `>= 0`.

Nothing in the script writes to `experiment-results/` or any committed file —
all regenerated outputs are computed in memory. If the Deers-Rock dist bundle
is present, a P-004 rerun is attempted and reported **informationally** (it is
never a gate, because of Deers-Rock nondeterminism).

> **Why the worktree stays clean:** the experiment tests
> (`p003-calibrated.test.ts`, `dr-counterfactual.test.ts`,
> `sensitivity-sweep.test.ts`) double as artifact regenerators and rewrite
> several committed JSON files under `experiment-results/` whenever `vitest`
> executes. `scripts/reproduce.ts` snapshots those files up front and restores
> them (index + worktree) right after the vitest-running gates, so `git status`
> shows no `experiment-results/` changes after a run.

**Expected output (deterministic gates):**

```
[PASS] Type-check (npx tsc --noEmit) — tsc --noEmit clean
[PASS] Test suite (npx vitest run) — 307 tests in 34 files passed
[PASS] Verify facts (npx tsx scripts/verify-facts.ts) — 12/12 checks passed (exit 0)
[PASS] P-003 calibrated regeneration matches committed artifact — 1233 metrics, 19 significant / 1 FDR / 1 Bonferroni (0 GDP)
[PASS] Sensitivity sweep noise-baseline fields + finite falsePositiveRatio
Deterministic gates: 5/5 passed
RESULT: REPRODUCIBLE — all deterministic gates passed.
```

## 4. Manual step-by-step reproduction

> **Note on artifact hygiene:** the `run-*.ts` scripts below write into
> `experiment-results/` (the committed artifacts). If you want to inspect
> regenerated outputs without dirtying the checkout, copy the directory first
> or rely on the in-memory gates in `scripts/reproduce.ts`. The committed
> artifact you should be reproducing is the one named `*-calibrated-*` /
> `*-30seeds-*` (the "runs" files and bare `summary.json` are legacy outputs).

### 4.1 P-003 — No-WWII counterfactual (deterministic)

Regenerate the calibrated experiment (seeds 42..71, 30 seeds):

```bash
npx tsx src/experiment/experiments/run-calibrated.ts
```

**Expected output:**

```
Done. 30 seeds, 1233 metrics.
Significant: 19
Significant GDP metrics: 0
Pre-specified primary outcomes: 3
  [nation-gdp] Nation GDP (pre-specified primary): meanΔ=… observed=9/9 paths, consistent=…
  [war-casualties] WWII cumulative casualties: …
  [nation-population] Nation population (secondary): …
```

**Corrected numbers (pinned):**

| Metric | Value |
|--------|-------|
| Total metrics | **1233** |
| Significant (uncorrected, p < 0.05) | **19** |
| Significant (BH-FDR) | **1** |
| Significant (Bonferroni) | **1** |
| Significant nation-GDP (pre-specified primary) | **0** |

The regeneration is deterministic: same seeds → byte-identical metric content
(only the summary-level `generatedAt` timestamp differs). The committed
artifact `experiment-results/wwii-counterfactual/p003-calibrated-summary.json`
was produced by this exact command.

### 4.2 P-004 — Deers-Rock sentinel counterfactual (non-deterministic)

Regenerate the DR counterfactual (seeds 42..71):

```bash
npx tsx src/experiment/experiments/run-dr-counterfactual.ts
```

**Expected output (approximately — see caveat):**

```
Done. 30 seeds, 212 metrics.
Significant: 14
```

**Nondeterminism caveat:** P-004 couples Kronos to the sibling Deers-Rock
model, which uses **unseeded `Math.random` / `Date.now`**. Re-running P-004 on
the same machine can therefore produce different metric counts and
significance decisions run to run (observed during validation: reruns produced
223–224 metrics and 10–19 significant vs. the committed 212 metrics / 14
significant). Exact reproduction of P-004 is **not guaranteed** and is not
required for the manuscript's primary (P-003) claims. Treat the committed
`p004-30seeds-summary.json` as a representative run, not a bit-exact target.

### 4.3 Sensitivity sweep (deterministic)

Regenerate the sweep:

```bash
npx tsx src/experiment/experiments/sensitivity-sweep.ts
```

**Expected output** (the committed `sensitivity-sweep.json`):

| Signal n (seeds) | Total metrics | Significant | Ratio % |
|------------------|---------------|-------------|---------|
| 3 | 367 | 10 | 2.72 |
| 5 | 437 | 8 | 1.83 |
| 10 | 576 | 13 | 2.26 |
| 20 | 870 | 10 | 1.15 |

Noise baseline (no-intervention replay across 20 seeds, seeds 100..119): the
corrected immutable-baseline semantics produce **0 metric deltas**, hence
`noise.totalMetrics = 0`, `falsePositiveCount = 0`, `falsePositiveRatio = 0`
(a genuine 0-FP noise floor — perfect determinism, not a NaN).

## 5. Determinism statement

The deterministic results rest on four mechanisms, all covered by tests:

1. **Seeded mulberry32 RNG** (`src/engine/rng.ts`). `createRNG(seed)` derives a
   deterministic generator; `restoreRNG(state)` replays the exact `callCount`
   of draws, so rewind points restore the precise RNG position. Same seed →
   identical event stream.
2. **Sorted-key canonical hashing** (`src/timeline/hash.ts`).
   `canonicalStringify` sorts object keys at every nesting level (arrays keep
   order, Map/Set are sorted), type-tags primitives, then `hashState` applies
   FNV-1a. Structural equality ⇒ identical hash; nothing is dropped silently.
3. **Deep-cloned rewind baselines.** `createRewindPoint` deep-clones sector
   state *before* the parent branch advances, so the child restores a pristine
   baseline. `assertBaselineIntegrity` (hash-compare) and `assertMatchedHorizon`
   guards in both P-003 and P-004 fail loudly rather than diff
   incommensurate/mismatched horizons.
4. **In-place mutation caveat.** Sector `tick` handlers advance state in place.
   Determinism therefore depends on (1)–(3): the deep-cloned baseline, the
   RNG replay, and canonical hashing. Any violation trips the guards instead of
   silently fabricating causal deltas. Statistical summaries round displayed
   stats to 2 decimals but decide significance on unrounded p-values.

## 6. Environment pinning

- **Lockfile:** `package-lock.json` (lockfileVersion 3) is committed — use
  `npm ci` for exact devDependency versions.
- **Node engines:** Node >= 22 required. `package.json` does not yet declare
  an `engines` field (file owned by a parallel lane); validated on Node
  v22.23.2.
- **Runner:** `tsx` is fetched via `npx` (not pinned in the lockfile). Pin it
  as a devDependency if you need fully offline reproducibility.
- **Vitest:** no `vitest.config` — framework defaults apply.

## 7. License and citation

- **License:** MIT — see `LICENSE`.
- **Machine-readable metadata:** `CITATION.cff` and `.zenodo.json` (author
  fields pending human approval).
- **Manuscript:** JAMIA submission — latest agent-reviewed draft at
  `docs/papers/jamia-2026-kronos-engine-v4-agent-reviewed.md`.
- **Zenodo DOI:** `10.xxxx/zenodo.xxxxxxx` — placeholder until the archive is
  published.

If you use this software or its results in research, cite the JAMIA manuscript
and the Zenodo archive (DOI above) in addition to the software (`CITATION.cff`).
