# Kronos Engine — Formal Reopening Audit (2026-08-31)

**Status:** COMPLETE — publishability verdict delivered. Engineering remediation required.
**Method:** adversarial evidence audit. Every claim below was verified against source code,
executable runs, and data files on 2026-08-31. Prior conclusions were treated as evidence,
not authority.
**Evidence provenance:** `npx vitest run` (33 files / 256 tests passed), `npx tsc --noEmit`
(clean), `npx tsx scripts/verify-facts.ts` (7/11 passed, exit 1), transient determinism
probes (deleted after execution), direct parsing of all `experiment-results/**/*.json`,
full source read of engine/sectors/experiment/timeline modules.

---

## 0. Executive Verdict

**Kronos Engine is NOT ready to support a formal scientific paper in its current state.**

The system has three genuine strengths (deterministic execution, reproducible artifacts,
a clean architectural idea) and one disqualifying weakness: the flagship experiment and
manuscript make claims the data does not support, and the engineering layer designed to
prevent that (verify-facts gate, RewindPoint hash verification) is itself broken.

What has been *demonstrated* (defensible):
1. Deterministic execution: same seed + config + intervention => identical simulation.
2. Artifact reproducibility: P-003 regenerates byte-for-byte (835 metrics, 24 significant,
   zero mismatches, 0.4 s).
3. A sector/cadence/event architecture that runs and is tested.
4. A zero-modification adapter pattern with documented invariants.
5. The sentinel adapter pipeline produces hospital outputs from macro events.

What has *not* been demonstrated (blocking):
1. A valid counterfactual: the P-003 branch diff compares states at different simulation
   times (child year 1972 vs parent 1969) because the rewind point baseline is corrupted
   by in-place mutation + reference aliasing.
2. Statistical significance: P-003's "24 significant" is *below* the 41.8 false positives
   expected by chance at uncorrected alpha=0.05. No multiplicity correction exists anywhere.
3. The manuscript's reported numbers: "1,421 metrics, 36 significant, 9 GDP survive
   Bonferroni, USA +$31.3B d=1.13" appear in no data file. The committed data says
   835/24 with zero GDP metrics significant.
4. Hash-based integrity: `hashState` ignores all nested content — `RewindPoint.verify()`
   is vacuous and cannot detect state corruption.

---

## 1. Implementation vs Documentation Matrix (abridged — full matrix in session record)

Verified baselines: tests 33 files/256 passed · verify-facts 7/11 fail · RPs preseeded = 13
· P-003 committed = 835 metrics/24 sig/0 GDP sig · P-004 = 156/14 · heatmap occupancy
40.4%–49.1%.

| # | Claim | Implemented? | Tested? | Evidence | Problem |
|---|-------|--------------|---------|----------|---------|
| 1 | CI/CD via GitHub Actions + Railway | Partial | Yes (ci.yml runs tsc+vitest+verify-facts) | ci.yml | CI only, no CD job; verify-facts step fails -> CI would be red |
| 2 | Phase 0 & 1 "complete" | Partial | Partial | ROADMAP vs code | "Complete" contradicted by open calibration gap + failed gate |
| 3 | Test counts 175+/197+/228/263 | N/A | **Actual 256/33** | vitest | All recent counts stale; no doc matches reality |
| 4a | Paper: 1,421 metrics, 36 sig, 9 GDP Bonferroni, USA +$31.3B d=1.13 | **NO** | No | p003 JSON = 835/24, GDP d≈−0.1..0, USA d=−0.06 | **Fabricated/unreproducible — paper Table 1 values in no data file; no p_adj field exists** |
| 4b | Paper: climate d=2.78/2.35/2.20 | **NO** | No | p003: temp d=−0.12, CO2 d=−0.10, emissions d=−0.31 | Contradicted by data |
| 4c | Paper: P-004 156/14, d=0.70/−2.71/1.11/0.91/0.58 | **YES** | Yes | p004 JSON matches exactly | Accurate — reproduces |
| 4d | Paper: occupancy 40.4–49.1%, 30 hospitals | **YES** | Yes | heatmap.json matches | Accurate |
| 5 | "6 sectors exported from index" | **NO** | No | src/sectors/index.ts exports only events/types | verify-facts Fact 8 fails; sectors imported individually |
| 6 | "14 Rewind Points" | Partial | Partial | Era data = 13 preseeded (+1 future) | Over-count; only contemporary era load-tested |
| 8 | Sentinel depth ledger "2 deep, wired 1/1" | N/A | N/A | sentinel-integration-map.md | Self-contradictory (2 deep vs 1 deep rows) |
| 9 | Determinism "same seed => identical" | **YES** | Yes | determinism.test.ts + probes | Accurate — genuinely tested and passing |
| 10 | "No patient data leakage" | Partial | **No real test** | verify-facts grep needs `rg` (absent) and would false-positive on adapter's `bed.patientId` | Gate silently skipped; invariant is doc-only |
| 11 | P-005 cadence implemented | **YES** | Yes | cadence.test.ts, world-engine.ts:85-88 | Accurate |
| 12 | P-006 cockpit served by API | Partial | Yes | server.ts serves src/api/index.html | Root dashboard.html is an orphan (generated, not served) |
| 13 | P-007 AI kernel wired into sim | **NO** | Partial | brains.ts standalone; no sector imports it | "Built" as module, not integrated as proposal describes |
| 14 | P-008 TabFM end-to-end | **NO** | Partial | bridge mocked-run test only; no /health /classify call; CI runs no Python | Unintegrated, untested end-to-end |
| 15 | QMS "12 chains verified" | Partial | **No** | 12 chains all point to one blanket VER-2026-001 (263/35 = wrong); stale refs to deleted `tests/` dir | Unsubstantiated |
| 16 | 1 world day = 1440 DR ticks | **YES** | Yes | deers-rock-adapter.ts:7 | Accurate |
| 17 | Claims with NO artifact | — | — | paper §3.4 perf numbers; "4 gaps closed"; casualty ~2,500 | No benchmark artifact; calibration file still flags gap OPEN recommending 1e4–1e5 |
| 18 | Paper == v4-agent-reviewed | — | — | SHA-256 identical | No independent review changed numbers |

**Additional drifts:** event-bus consumes events in the *same tick* (paper claims t+1);
iteration is Map-insertion order (paper claims "sorted"); restoreSnapshot injects
`new Date().toISOString()` into restored universe objects; diff/summary artifacts embed
wall-clock timestamps.

---

## 2. Determinism Audit (executable evidence, probes)

| Test | Result |
|------|--------|
| Same seed 42 x2, 30 ticks => identical economy state | PASS |
| Different seeds 42 vs 43 => states differ | PASS |
| Snapshot at tick 30 -> restore -> run 5 vs fresh run 5 (deep-cloned) | PASS |
| Restore same snapshot twice => universe id identical, created timestamp identical (same ms) | PASS (but timestamp is wall-clock; ms-boundary risk) |
| `run(world, 5)` mutates the input world in place | **FAIL (finding)** — sector `tick` mutates state in place (T3 optimization); contradicts "pure tick" paper claim; requires deepClone discipline everywhere |
| `computeSummary` embeds `generatedAt: new Date().toISOString()` | Finding — artifacts not byte-reproducible across runs |
| Malformed intervention (unknown nation) | **FAIL (finding)** — crashes `n.wars is not iterable`; no intervention schema validation |
| P-003 full 30-seed regeneration vs committed JSON | **PASS — byte-identical** (835 metrics, 24 sig, 0 mismatches, 0.4 s) |

Nondeterminism sources found:
1. `restoreSnapshot` (world-engine.ts:132) and `forkBranch` (branch.ts:205) and
   `buildFullDiff` (diff-engine.ts:143) and `computeSummary` (stats.ts:124) embed
   wall-clock `new Date()` in artifacts/universes. Simulation state stays deterministic;
   serialized artifacts do not.
2. In-place sector mutation (T3) means snapshot must deepClone before any later mutation;
   the code does this for snapshots, but the rewind-point aliasing bug (below) shows the
   discipline is not applied everywhere.
3. `RewindPoint.stateHash`/`verify()` are vacuous (see §6) — integrity checking cannot
   catch corruption.

---

## 3. World Model Audit (sector-by-sector)

| Sector | State vars | Transition style | Empirical grounding | Category |
|--------|-----------|------------------|---------------------|----------|
| Geopolitics | nations, wars, alliances, relations | RNG drift on relations; war casualties = floor(rng*500+50) * multiplier; random war starts p=0.02 | Casualty magnitude off by 4-5 orders (calibration-reference.json: simulated ~1,000 vs 75M real; gap OPEN) | **Synthetic/heuristic** |
| Climate | CO2, emissions, temp anomaly, sea level | Emissions noise reduction calibrated (P-003/P-004 era); temp/CO2 not data-driven | CO2/emissions per-era constants hardcoded in experiment-runner | **Phenomenological/synthetic** |
| Economy | nation GDP/growth/inflation/trade | growth = gdp*growthRate/100 + noise; mean-reverting inflation | GDP growth rates from Maddison in calibration-reference.json but simulation uses fixed 2.5 + noise | **Synthetic** (calibration data exists but is not wired in) |
| Technology | tech level, R&D, diffusion | deterministic + RNG | No source data | **Heuristic** |
| Energy | mix, price, security | hardcoded initial mix; supply shock events | No source data | **Heuristic** |
| Demographics | population, birth/death, aging | population * rate + migration | No source data | **Heuristic** |

None of the six sectors is calibrated to a validated reference trajectory. The era JSON
data (StrategicWorldState) carries `"source": "estimate"` flags, but the *dynamics* —
growth rates, war frequency, casualty scaling — are not fitted to any dataset. The only
numerical anchors (Maddison GDP rates, CoW casualties) live in
`docs/history/calibration-reference.json` as *reference material for future calibration*
and are **not applied** in code.

---

## 4. Cross-Sector Causality Audit

Actual handler wiring (from source, not the decorative map):

| From | To | Events | Wired? |
|------|----|--------|--------|
| Geopolitics | Economy | war_start, war_casualties | YES |
| Geopolitics | Climate | war_start | YES |
| Geopolitics | Energy | war_start | YES |
| Geopolitics | Demographics | war_start | YES |
| Climate | Economy | extreme_weather | YES |
| Climate | Geopolitics | extreme_weather | YES |
| Climate | Energy | extreme_weather | YES |
| Economy | Geopolitics | gdp_shift | YES |
| Economy | Climate | gdp_shift | YES |
| Economy | Technology | gdp_shift | YES |
| Economy | Energy | gdp_shift | YES |
| Economy | Demographics | gdp_shift | YES |
| Technology | Economy | innovation | YES |
| Technology | Energy | innovation | YES |
| Energy | Economy | price_shift | **NO** (declared in EVENT_SUBSCRIPTIONS, no handler) |
| Demographics | Economy | labor_force_change | **NO** (declared, no handler) |
| **Health sentinel** | **World** | health.pressure/mortality/surge/down | **NO — nothing subscribes to health.*** |

Findings:
1. `EVENT_SUBSCRIPTIONS` (events.ts:209) is **never consulted by the engine** — it is
   documentation only; actual wiring is per-sector `handlers` arrays matched by event type
   in `applyCrossSectorEvents` (world-engine.ts:63-72). Two declared pathways are unwired.
2. **The sentinel feedback loop does not exist.** The adapter publishes health.* events
   (deers-rock-adapter.ts:228-262) but no sector registers a handler for them; the events
   are dropped. The paper's claim that the world "aggregates hospital pressure signals
   back" is not implemented. The heatwave integration test checks DR *output*, not feedback.
3. Sign/mechanics concerns: attacker GDP ×1.03 vs defender ×0.85 on war_start (economy.ts:45,57)
   is a fixed structural assumption with no empirical basis; war-casualty GDP drain uses
   `casualtiesDelta * 100_000_000` (economy.ts:72) — an arbitrary scaling constant.
4. Double counting / order artifacts: sector state is mutated in place and event handlers
   run sequentially in Map insertion order per event; same-tick consumption means a sector
   can both produce and consume in one tick. No feedback-loop guard exists.

---

## 5. Rewind Point Audit

Registry (`docs/history/ERA-INDEX.md`): 13 preseeded RPs across 6 eras (ancient 1, medieval
2, early-modern 2, industrial 2, modern 3, contemporary 3) + future defaults.

- Sources: hand-authored era JSON with `"source": "estimate"` flags; validated only at
  schema level (non-negative, relation ranges). No historical validation against
  timelines beyond the archivist's estimates.
- **Critical integrity bug:** `createRewindPoint` stores sector state **by reference**
  (rewind-point.ts:62-63). Because sector `tick` mutates state in place, running the
  parent world forward *mutates the captured rewind state*. Probe: RP captured at tick 0
  (tickCount 0); after parent ran 30 ticks, RP's geopolitics state shows tickCount=3 and
  `verify()` still returns TRUE (because the hash is vacuous — see §6). The P-003 branch
  therefore restores a **corrupted, partially-mutated baseline** and then runs 30 more
  ticks: child ends at year 1972 (tickCount 33) vs parent 1969 (tickCount 30).
- **Consequence:** every P-003 metric diff includes a +3 tick (3-year) offset. The top
  "significant" metrics are `year` (d=4.82) and `tickCount` (d=4.82) — pure artifacts of
  the baseline bug, not the intervention.
- The paper's determinism/integrity story ("stateHash verified by rehash") does not hold:
  the hash cannot see the state (below), and verify() passes on corrupted state.

---

## 6. Hash Integrity Audit (probe evidence)

`hashState` (timeline/hash.ts) = FNV-1a over `JSON.stringify(obj, Object.keys(obj).sort())`.
The **replacer array** restricts serialization to top-level keys of the *root object*
applied at every level. Probe results:

| Case | Hash equal? |
|------|-------------|
| Nested GDP changed 1e12 -> 999999 | **TRUE** (identical hash) |
| Top-level scalar `tick` changed | FALSE (differs) |
| `rngState` seed changed | **TRUE** (identical) |
| `sectorStates` emptied | **TRUE** (identical) |

`RewindPoint.verify()` is therefore **vacuous**: it re-hashes the same content-free
projection and always passes. State corruption, RNG contamination, and empty sector states
all verify clean. The entire hash-based integrity layer — a headline architectural claim —
does not function.

---

## 7. Counterfactual Methodology Audit

P-003 "No WWII" design as actually executed (`wwii-no-war.ts`):
- Baseline: parent branch = run 30 ticks from RP-MODERN-001 (1939) with war ongoing.
- Treatment: restore RP, patch `geopolitics.wars["W-1939-01"].status = "ended"`, run 30.
- **Design flaw:** the branch baseline is corrupted (RP aliasing, §5), so treatment and
  control do not share the same initial state; the diff is contaminated by a 3-tick
  horizon mismatch. A valid counterfactual requires an identical restored baseline.
- Seeds: 42..71 (30 consecutive). Variance estimated is only RNG-draw variance within one
  fixed initial condition — it does **not** represent historical or parameter uncertainty.
- Measured outcomes: all 835 numeric paths including `year`/`tickCount` (mechanical), war
  counts, relations — no pre-specified primary outcomes in the code; the paper's
  "pre-specified GDP outcomes" exist only in prose.

P-004 climate->DR: parent vs emissions_control branch over 20 ticks, 30 seeds. Here the
DR sentinel is present and the pipeline demonstrably runs; 156 metrics / 14 significant
reproduces. But the same statistical weaknesses apply (§8), and 3 of 14 "significant"
entries are duplicated `world.state.*` vs `lastTickState.*` mirrors of the same quantities.

---

## 8. Statistical Audit

`stats.ts` implementation facts:
- `computeSummary` computes per-path mean/std/CI95/median/min/max of `absoluteDelta`
  across seeds, and **`cohensD(values.map(() => 0), values)`** (stats.ts:99) — Cohen's d
  against an **all-zero control vector**. This is a one-sample standardized mean, not a
  two-group effect size; pooling against a zero vector inflates the denominator
  relationship (the two-sample formula with a degenerate zero group). Effect sizes are
  therefore not comparable to literature Cohen's d values.
- `significant = ci.lower > 0 || ci.upper < 0` — significance is "95% CI of the mean
  delta excludes zero". **No p-value, no t-statistic, no multiplicity correction
  anywhere.** The paper's Bonferroni machinery (adjusted alpha = 3.5e-5 from 1,421)
  exists only in prose; `p_adj` is not computed or stored.
- Rounding to 2 decimals on mean/d/CI but significance computed on unrounded values —
  `nations.USA.wars.length d=0 significant=true` (d rounded to 0.00 while CI excludes 0).

Power (computed from observed d-values, two-sided alpha 0.05, beta 0.2):
- n per group needed for 80% power: d=0.2 -> 392, d=0.3 -> 175, d=0.4 -> 98, d=0.5 -> 63,
  d=0.58 -> 47, d=0.7 -> 33, d=1.0 -> 16, d=2.71 -> 3.
- P-003 significant set at n=30 has power 78-100% for the *mechanical* effects
  (wars.length d=0.5-1.13, seaLevelRise d=1.38) but those are structural artifacts
  (war presence changes by construction). The economy effects the paper highlights
  (GDP) are not significant at all.
- P-004 significant set at n=30: CSSD d=-2.71 (100%), dialysis d=1.11 (100%),
  UNKNOWN d=0.91 (100%), occupancy d=0.70 (97%), outcomes d=0.58 (89%) — these are
  powered, but see multiplicity below.

Multiplicity:
- P-003: 835 metrics, uncorrected alpha=0.05 => **41.8 expected false positives**;
  observed significant = **24 — below the noise floor**. The experiment's significant
  count is consistent with pure noise. (Paper's "36" is below even its own claimed
  expectation of ~71, which itself signals noise.)
- P-004: 156 metrics => 7.8 expected; observed 14 — marginally above noise, and the list
  includes degenerate artifacts (`annualEmissionsNoise d = -9.02e15`, sd=0; `wars.length
  d=0` flagged significant).

What the statistics actually estimate: seed-to-seed variation of a deterministic model
given fixed initial conditions — Monte Carlo variance of the simulator, **not** real-world
uncertainty, not parameter uncertainty, not historical uncertainty. p-values/CI on a
deterministic model quantify model sensitivity to PRNG draws only. The manuscript
presents these as evidence about historical counterfactual outcomes; that inference is
unsupported.

---

## 9. Calibration Reassessment

`docs/history/calibration-reference.json` (2026-06-30) documents:
- WWII casualties: reference 75M, simulated ~1,000 at tick 30, **implied multiplier 75,000,
  recommendation 1e4-1e5, gap OPEN**.
- GDP growth: Maddison rates per decade provided as reference; simulation uses fixed 2.5%
  + noise (not the reference rates).
- Notes state simulation uses total GDP, not per-capita, and calibration was not applied.

Findings:
1. **Calibration was never completed for the headline experiment.** The paper/ROADMAP
   claim "4 gaps closed" and casualty multiplier ~2,500; the calibration file itself
   flags the casualty scaling gap OPEN. The war's casualty magnitude in the simulation is
   off by 4-5 orders of magnitude — the very quantity the "No WWII" GDP story depends on.
2. No separate validation dataset exists; era states are archivist estimates with no
   validation split.
3. The `casualtyMultiplier: 2500` in `wwii-no-war.ts:86` is a manually chosen constant,
   not fitted to the reference; and the reference recommends 1e4-1e5, so even the manual
   value is inconsistent with the calibration file.
4. Overfit risk is currently moot (no fitting was done), but the flip side is worse:
   nothing is calibrated, so the model cannot claim quantitative fidelity of any kind.

---

## 10. Sentinel Architecture Audit

Boundary conditions (paper P-002 + ADAPTER_INVARIANTS):

| Rule | Status |
|------|--------|
| No DR internals imported into KE | Partial — adapter imports DR `createWorld`/`step`/types from `../../../Deers-Rock/dist/index.js` (external sibling). Adapter calls step() only. |
| KE never reads individual patient records | **VIOLATION (soft)** — `extractOccupancy` reads `bed.patientId` (deers-rock-adapter.ts:75-76) to count occupancy; patient identity is read (though only used as occupancy boolean and never flows up). Also reads `encounters` primaryDiagnosis per encounter for prevalence. |
| DR never reads GDP/war status directly | PASS — macro packet is the only input; DR sees admissionMultiplier/diagnosis weights/supply/staff params |
| No shared RNG | PASS — `getHospitalSeed(worldSeed ^ hospitalId*2654435761)` per sentinel |
| No inter-sentinel knowledge | PASS — sentinels are independent instances |
| No wall-clock | PASS in sim loop (DR step is deterministic); `restoreSnapshot` timestamps affect only universe metadata |
| "World does not reach into hospital; waits for signal" | **Hypothesis NOT met as described** — macro events *are* translated down into a MacroConditionPacket (the adapter actively pulls `pending()` and schedules admission surges). The outbound world->hospital channel exists; the inbound hospital->world channel (health.*) is dead. The metaphor holds only one direction. |

The adapter pipeline (macro events -> packet -> 1440 DR ticks -> aggregated output) works
and is tested. What is absent: (a) any consumer of sentinel output, (b) a real
patient-data-leak test (the verify-facts grep is skipped without `rg` and would
false-positive on `patientId`), (c) calibration of the packet parameters
(admissionMultiplier +0.3 per extreme weather, +0.2 per war, diagnosis weights 1.15-1.5,
supplyStress hardcoded 0.3 — all arbitrary).

---

## 11. Claim Audit Table

| Proposed paper claim | Evidence | Strength | Keep? |
|----------------------|----------|----------|-------|
| Deterministic: same seed => identical sim | determinism.test.ts + probes | **Proven** | YES (exact wording) |
| Rewind points + branch engine restore and fork | code + tests | Strongly supported (mechanism works) | YES — but reword: baseline restore is currently corrupted by aliasing bug; claim must await fix |
| State-hash integrity verification | probe: hash ignores nested state; verify vacuous | **Unsupported** | NO — remove until fixed |
| Multi-sector world with 6 sectors + events | code + tests | Strongly supported | YES |
| Cross-sector causal pathways | handlers wired for 13/16; 2 declared unwired | Demonstrated (partial) | YES with honesty about wiring |
| Sentinel adapter zero-modification integration | code + adapter tests | Strongly supported | YES |
| Sentinel feedback into world | no handler subscribes health.* | **Unsupported** | NO — remove or implement |
| P-003: 1,421 metrics, 36 sig, 9 GDP Bonferroni, USA +$31.3B | data says 835/24, 0 GDP sig | **Fabricated** | NO — replace with true numbers or drop |
| P-003: meaningful counterfactual effect | branch baseline corrupted; sig count below noise floor | **Unsupported** | NO — redesign experiment |
| P-004: climate -> hospital pipeline runs; 156/14 reproducible | reproduces | Demonstrated | YES with corrected stats |
| 30-hospital network occupancy 40.4-49.1% | heatmap.json | Demonstrated | YES |
| Calibration "4 gaps closed" | calibration file flags gap OPEN | **Unsupported** | NO |
| Statistical significance of results | no multiplicity correction; sig counts near/below noise | **Unsupported** | NO |
| "Sorted iteration order" | Map insertion order | **Unsupported** | NO — reword |
| Events consumed at t+1 | same-tick consumption | **Unsupported** | NO — reword |
| ~30 seeds sufficient | power table: ok only for d>=0.7 | Plausible for strong effects | REWORD per-metric |

---

## 12. Publishability Verdict and Required Fixes

**Verdict: NOT publishable as-is. Do not draft the paper from current artifacts.**

The proposed framing — "a deterministic multi-scale simulation architecture for
reproducible counterfactual experimentation across interacting world sectors, demonstrated
through integration with an independent healthcare sentinel" — **survives as an
architectural claim** once the following are fixed, but the experimental evidence does
not currently support it.

Required before publication (blocking):
1. **Fix RewindPoint aliasing** — deep-clone sector states in `createRewindPoint`
   (or snapshot), so the baseline is immutable. Add a regression test that runs the
   parent past the RP and asserts RP state + verify() unchanged.
2. **Fix `hashState`** — the sorted-key JSON replacer array drops all nested content.
   Use a proper canonical serializer (sort keys recursively) or serialize the full state.
   Then `verify()` becomes meaningful; test it can detect mutation.
3. **Fix `verify-facts.ts`** — vitest output parsing (count regex), determinism check
   (universe-id vs state), index-export check (export the 6 factories from
   `src/sectors/index.ts`), leakage grep (portable fallback, and exclude the adapter's
   intentional `patientId` occupancy read or stop reading patient identity).
4. **Redesign the counterfactual** — restore a *deep-cloned identical baseline* for both
   branches; compare at identical tick counts; pre-specify primary outcomes in code.
5. **Rebuild the statistics layer** — proper two-sample or paired effect sizes (not a
   zero control), p-values with explicit multiplicity control (FDR at minimum, Bonferroni
   optional), drop rounding-induced d=0-significant artifacts, and report the noise-floor
   comparison (significant count vs expected false positives).
6. **Resolve or remove the calibration claims** — either complete casualty/GDP
   calibration against the reference file (1e4-1e5 multiplier direction) with a held-out
   validation split, or explicitly relabel sectors as synthetic/heuristic with no
   quantitative fidelity claim.
7. **Wire or remove the sentinel feedback claim** — either implement health.* handlers
   that feed aggregate signals back into world sectors, or state plainly that the
   current system is world->hospital only.

Recommended before publication (non-blocking): FDR-corrected analysis; 100-300 seeds for
effects below d=0.7; power analysis per claimed metric; artifact timestamps removed or
declared; era data validation; P-007/P-008 either integrated or descoped; root
`dashboard.html` orphan resolved; QMS trace-matrix repaired against real files/counts.

---

## 13. What HAS been demonstrated (for the eventual paper)

1. A deterministic, seed-reproducible multi-sector simulation engine (proven).
2. Rewind/branch mechanics that are deterministic when the baseline is correctly
   restored (demonstrated, pending aliasing fix).
3. A cadenced tick system with typed cross-sector events, mostly wired (demonstrated).
4. A zero-modification sentinel adapter producing aggregated hospital signals from macro
   events, world->hospital direction (demonstrated, 1440-tick/day, reproducible).
5. A reproducible experiment pipeline: P-003 and P-004 artifacts regenerate identically
   (proven).
6. An honest failure mode: the P-004 climate->hospital pipeline produces powered,
   reproducible effects (CSSD d=-2.71, dialysis d=1.11) that survive scrutiny of
   mechanism (the noise artifacts must be excluded).

These six are the honest core the reopened paper can build on. The rest must be fixed or
dropped.

---

*Prepared by the OG Kronos Engine agent during the formal reopening. Evidence files:
`experiment-results/**/*.json`, `src/**/*.ts`, `docs/history/*.json`, `scripts/verify-facts.ts`.
Session trace: `C:\Users\think\self-harness\traces\kronos-reopen-audit.pm1`.*

---

## 14. ADDENDUM — Remediation Applied & Corrected Numbers (2026-08-31, same session)

After the verdict, remediation was green-lit and executed in git worktree
`C:\Users\think\Project_v2\Kronos-Engine-remediation` (branch `reopen-remediation`).
Six fixer lanes landed; all are verified. Full suite: **34 files / 307 tests pass
(was 33/256), tsc clean, `verify-facts.ts` 12/12 exit 0 (was 7/11 exit 1).**

### Fixes applied
1. **fix-1 (timeline integrity, NCR-2026-005):** `hashState` now uses a canonical recursive
   serializer (sorted keys at every level, Map/Set as sorted entries, primitives type-tagged) —
   nested content is captured; `createRewindPoint` and `rewindToSnapshot` deep-clone sector
   state, so in-place sector mutation can no longer corrupt baselines. Regression tests prove
   RP immutability and hash sensitivity.
2. **fix-2 (CI gate, NCR-2026-004):** `verify-facts.ts` parses real vitest output, checks
   determinism by state hash (not universe IDs), the 6 sector factories are now exported from
   `src/sectors/index.ts`, and the patient-data scan runs portably on Windows (no `rg`).
3. **fix-3 (stats, NCR-2026-003):** one-sample t-statistics + two-sided p-values (Numerical
   Recipes t-CDF, verified to ~1e-7), BH-FDR and Bonferroni per metric, degenerate-metric
   guards (no more d≈-9e15), `noiseFloor` in summary. Cohen's d re-labeled as one-sample dz.
4. **fix-4 (sweep):** noise baseline now guards the 0-metrics case (no-intervention replay is
   genuinely identical → 0 false positives, ratio 0, not NaN).
5. **fix-5 (counterfactuals):** pre-specified `PRIMARY_OUTCOMES` in code; matched-horizon and
   identical-baseline guards (throw on mismatch); bookkeeping paths (`year`, `tickCount`)
   stripped from causal metrics; per-run guard evidence recorded.
6. **fix-6 (sentinel docs):** paper/map/proposal/HANDOFF corrected — sentinel→world (`health.*`)
   consumption explicitly documented as NOT implemented; paper's 8 bidirectional sentences
   surgically corrected to world→hospital-only reality.

### Corrected P-003 ("No WWII", 30 seeds) — regenerated twice, reproducible
| Metric | OLD (committed/fabricated) | NEW (corrected) |
|---|---|---|
| metrics analyzed | 835 | 1,233 (bookkeeping stripped, more paths captured) |
| significant (uncorrected p<0.05) | 24 | 19 |
| significant after FDR | not computed (nonexistent) | **1** |
| significant after Bonferroni | claimed "9 GDP" | **1** |
| GDP metrics significant | paper: all 9; data: 0 | **0** (nation-gdp primary: `consistent=false`, meanΔ −36M) |
| top effects | year/tickCount d=4.82; seaLevelRise d=1.38; wars.W-1937 casualties d=1.5 | all collapsed to non-significant; only `wars.W-1939-01.casualties` survives FDR (d=−1.46, q=2.4e-6) — trivially mechanical (ending a war stops its casualties) |
| degenerate metrics | — | 942 (constant/tiny-variance, excluded from FDR family) |
| noise floor | — | 61.65 expected false positives @α=.05 (291 tested → 14.55); observed 19 | 

**Interpretation:** with the baseline fixed and real statistics, the "No WWII" intervention has
essentially NO defensible effect beyond the trivially mechanical casualty reduction. The paper's
central GDP claim does not survive — even after fixing the engineering. P-003 is an honest
negative/exploratory result for the architecture, not a validated counterfactual finding.

### Corrected P-004 (climate→hospital, 30 seeds)
212 metrics (was 156); 14 significant at p<0.05 — but dominated by tiny-variance economy
artifacts (d ±10 to ±47 on near-constant deltas; e.g. `GBR.inflationRate d=-47.12`,
`IND.rdSpending d=43.53`). Real hospital effects are small (d 0.48–0.65: tubeFeedings,
diseasePrevalence.UNKNOWN, outcomeRecords, morgue, mortalityPressure). Pre-specified primary
outcomes (cssd-cycles, dialysis, occupancy) all `consistent=false`. **Pre-existing external
nondeterminism:** the sibling `Deers-Rock/dist` uses unseeded `Math.random` and `Date.now()`
clocks, so P-004 is not run-to-run byte-reproducible — a remaining reproducibility gap owned
by the Deers-Rock repo, not this worktree.

### What the corrected numbers mean for the paper
The honest paper must be rebuilt around: (1) the deterministic architecture + reproducible
artifact pipeline (proven), (2) the sentinel world→hospital adapter (demonstrated),
(3) P-004's small but reproducible hospital effects with multiplicity-corrected reporting and
the DR nondeterminism caveat, and (4) P-003 as a documented negative/exploratory result —
NOT as evidence of GDP effects. The framing "deterministic multi-scale simulation architecture
for reproducible counterfactual experimentation, demonstrated through integration with an
independent healthcare sentinel" survives as an architectural claim with honest results;
the counterfactual *finding* claims do not.

### Open items after remediation (tracked)
- Deers-Rock RNG seeding (external repo; needed for full P-004 reproducibility).
- P-004 `falsePositiveRatio`/description cleanup; PROJECT-OVERVIEW.md still asserts
  bidirectional integration (fix-6 scope-limited to 4 files; overview needs the same edit).
- Historical paper drafts v1–v4 retain old claims (superseded snapshots; archival decision).
- Experiment artifacts in the worktree are regenerated with corrected numbers; main repo's
  committed artifacts still carry the OLD (pre-fix) values — commit/merge of the worktree is
  pending human approval per governance.
- QMS: NCR-2026-003/004/005 remain open pending worktree commit and final verification
  (VER-2026-003 filed with remediation evidence).

### Addendum 2 — Verifier-approved state (same session, final)
The worktree was committed on branch `reopen-remediation` (8 commits from base `907c859`):
`6b397fc` (integrity/CI/stats/counterfactual guards), `1e36cbd` (regenerated artifacts),
`f9bb0b7` (sentinel docs descope), `cfdeebf` (one-command reproduction path),
`d436fd0` (v1.0.0 release metadata), `5b59c73` (paper numbers reconciled with artifacts),
`698146f` (heatwave integration test timeout fix — 5s default was flaky under parallel
load; the Deers-Rock-driven integration tests need 9–16s).

Independent verifier review: **APPROVE** (ver-2). REJECT (ver-1) was issued and fully
resolved by `5b59c73` — the paper's fabricated numbers (1,421 metrics / 36 significant /
9 GDP Bonferroni / US +$31.3B / climate d 2.2–2.8 / P-004 "156 metrics Bonferroni") were
replaced with the corrected, reproducible values (P-003: 1,233 metrics / 19 uncorrected /
1 FDR / 1 Bonferroni / 0 GDP; P-004: 212 metrics / 14 uncorrected / 0 Bonferroni, DR
nondeterminism caveat). `verify-facts.ts` gained a 13th check (paper-vs-artifact
consistency) and exits 0.

Final verified state (orchestrator + verifier, multiple runs): `npx vitest run` =
34 files / 307 tests exit 0; `npx tsc --noEmit` clean; `npx tsx scripts/verify-facts.ts`
= 13/13 exit 0; `npx tsx scripts/reproduce.ts` = 5/5 deterministic gates exit 0 with the
worktree left clean (restores the artifact-rewrite side effect of the test suite).

Remaining before paper submission/release (human-gated, per RELEASE-CHECKLIST.md):
authors/ORCID/affiliations in CITATION.cff/.zenodo.json/LICENSE; JAMIA DOI;
Deers-Rock RNG seeding for full P-004 reproducibility; merge worktree to main; tag v1.0.0;
Zenodo GitHub integration; manuscript submission.
