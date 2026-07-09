# Kronos Engine — Handoff Ledger

**Protocol:** Constitution §6.5 (Filesystem as Bus) + §6.6 (Handoff Protocol)
**Scope:** Meta Platform sub-agents — internal to Kronos Engine only
**Memory boundary:** Nothing here leaves `C:\Users\think\Kronos Engine\`

---

## How Handoffs Work

1. Any sub-agent writes a handoff entry under `### Pending` with sufficient context
2. **Git commit + push immediately after editing HANDOFF.md.** Local edits are invisible to other agents — they read from git.
3. The owning agent picks it up on its next session (via git pull)
4. When started, the agent must read `HANDOFF.md` and check its section
5. When done, move the entry to `### Completed` or `### Cancelled`, then git commit + push
6. If the handoff implies an architecture change, the agent must write a proposal to `docs/proposals/`

**No agent commands another.** Information flows through this file — distributed via git.

---

## World Archivist

### Pending

### Active

### Completed
- **2026-06-29** — All 6 eras built and validated: ancient, medieval, early-modern, industrial, modern, contemporary. 13 pre-seeded Rewind Points from Fall of Rome to Baseline 2026 (+1 Future era config). ERA-INDEX.md and SCHEMA-VALIDATION.md created.
- **2026-06-29** — Read P-001A seed/universe/rewind point spec, acted as @world-archivist. Fixed JSON numeric separators, ran cross-era validation (nation ID continuity, global state monotonicity, rewind point registry). Self-harness trace recorded.
- **2026-06-29** — Filled 3 gap states: RP-MODERN-002 (1969 Moon Landing), RP-CONTEMP-001 (2001 9/11), RP-CONTEMP-002 (2020 COVID-19). All 14 rewind points now populated.
- **2026-06-29** — REDO: Initial gap-fill had broken cross-references. Rewrote files, all 6 pass cross-ref audit. Self-harness failure recorded.
- **2026-06-30** — Executed Phase 1.2 historical baselines: created `docs/history/calibration-reference.json`.
- **2026-06-30** — Future era (S-BASELINE) spec delivered: `docs/history/era-future-spec.md` + `era-future-defaults.json`.
- **2026-06-30** — **Paper review §2.8 Historical Data Layer:** Accurate. 6 eras, 13 RPs, time spans all match source data. No factual errors. Minor note: era calibration sources and the `StrategicWorldState` schema aren't described, but the level of detail is appropriate for JAMIA. No corrections needed.

---

---

## Sector Engineer

### Pending
- **P-005 Part A: Per-sector CONTRACT.md files.** Write a `CONTRACT.md` for each of the 7 existing sectors (economy, climate, geopolitics, technology, energy, demographics, deers-rock-adapter) documenting: state keys read/written, events emitted/handled, invariants, RNG sub-stream position, and time complexity. Template in `docs/proposals/P-005-sector-contracts-and-cadence.md`. ~15 min per sector = ~2h total.

- **P-005 Part B: Sentinel depth ledger integration.** After contracts are written, update each sector's `CONTRACT.md` to add a `wiringDepth` field (`deep` / `wired` / `harvest` / `fenced`) at the top so future adapters can be classified at a glance.

### Active
- **P-005 Part A (top priority): Cadenced Tick Pipeline.** Implement staggered cadences on the Sector interface:
  1. Add optional `cadence?: number` and `offset?: number` to `Sector` interface in `src/sectors/types.ts`
  2. Update `tick()` in `src/engine/world-engine.ts` to skip sectors whose `(currentTick + offset) % cadence !== 0`
  3. Assign cadences: Economy=3(1), Technology=5(2), Demographics=10(5), Energy=3(1), Geopolitics=1(0), Climate=1(0), sentinel=1(0)
  4. Include cadence config in universe/hash for determinism (Option A: no RNG consumption on skipped ticks)
  5. Cross-sector events still processed every tick (max cadence-1 delivery latency)
  6. New test: sector with cadence=3 ticks exactly floor(N/3) times in N world ticks
  7. All existing tests pass unchanged
  See `docs/proposals/P-005-sector-contracts-and-cadence.md` for full spec. Effort: ~1.5h.

- **Dashboard maintenance.** HTML dashboard at `dashboard.html`, generator at `scripts/generate-dashboard.cjs`. Currently a static snapshot of experiment data. If you want: add live data fetching, experiment config UI, or cross-sector visualizations. Own it from here.

### Completed

### Completed
- **2026-06-29** — P-002 Deers Rock sentinel adapter built + tested. `src/sectors/deers-rock-adapter.ts` wraps DR as Sector with zero code modifications (verified). Seed derivation, temporal aggregation (1440 DR ticks/day, configurable), macro injection, sentinel output, multi-instance. **+ deterministic resolution order** (`createSentinels` sorts by hospitalId), **circuit-breaker** (try-catch on step(), fallback to lastKnownGood, publishes health.down), **adapter invariants** (`ADAPTER_INVARIANTS` const documenting 5 boundary rules). **+ integration test** (`src/integration/heatwave.ts`): injects extreme weather at tick 10, runs 30 days, verifies cross-sector impact with DR sentinel output. 142 tests, 15 files, `tsc --noEmit` clean. **Sector Engineer scope fully complete.**
- **2026-06-29** — All 4 World Simulator sectors (Geopolitics, Climate, Economy, Technology) + cross-sector event catalog with typed events. All wired with cross-sector event handlers. Sector Engineer scope delivered.
- **2026-06-29** — Era-to-world loader built (`src/engine/era-loader.ts`). `buildSectorConfigs(state, era)` maps StrategicWorldState → geopolitics/climate/economy/technology configs for `createWorld()`. `loadEraConfig(path, rewindPointId)` reads era JSON from disk. Handles era-specific defaults: CO2 concentration (280–420), annual emissions (0–37 Gt), R&D spending (0.8%–3.5%), GDP growth/inflation rates by century. 7 tests, `tsc --noEmit` clean.
- **2026-06-30** — **Phase 2.3: CI/CD complete.** GitHub Actions workflow (`.github/workflows/ci.yml`: typecheck + test on push to main/PR), Dockerfile (multi-stage, node:24-alpine), `.dockerignore`, `railway.json`, engine entry point (`src/index.ts`). 175 tests, 20 files, `tsc --noEmit` clean.
- **2026-06-30** — **Phase 1.2 calibration: all 4 gaps closed.** Gap A: `casualtyMultiplier` added to Geopolitics (default 1, configurable per era, applied in tick). Gap B: `war_start` handler split — attackers get GDP+3%/growth+2.0, defenders get GDP-15%/growth-5.0. Gap C: Climate CO₂ noise reduced from ±2→±0.2, configurable via `annualEmissionsNoise`. Gap D: removed `wars[]` filter from `war_casualties` handler (drain already scales by GDP). Ready for P-003 re-run.
- **2026-06-30** — **Phase 1.4: DR Sentinel Counterfactual experiment built** (`src/experiment/experiments/dr-counterfactual.ts`). Wires sentinel into experiment pipeline at RP-CONTEMP-002. Ready for @branch-analyst to run 30 seeds, analyze stats, and produce the analysis report.
- **2026-06-30** — **Phase 2.1: Sentinel network scaled to 30 hospitals.** `src/data/indonesian-hospitals.ts` defines 30 configs across 5 regions (Java, Sumatra, Kalimantan, Sulawesi, Eastern). Fixed seed derivation bug (string hash). Verified independent operation (unique seeds, no cross-talk). Network infrastructure ready for Branch Analyst's heatmap analysis.

---

## Branch Analyst

### Pending

### Active

### Completed
- **2026-06-30** — **Phase 1.4: DR Sentinel Counterfactual (30 seeds).** Sector Engineer's `dr-counterfactual.ts` ran at RP-CONTEMP-002 with Makassar sentinel. 14/156 metrics significant, including 2 DR-specific: `sentinelOutput.occupancyRate` (Δ=+0.01, d=0.70) and `sentinelOutput.diseasePrevalence.UNKNOWN` (Δ=+5.52, d=0.91). Deers Rock internal metrics also show divergence: cycles (−4.97, d=−2.71), dialysis sessions (+1.83, d=1.11), outcome records (+3.73, d=0.58). **Finding:** sentinel pipeline verified end-to-end, but weather→hospital signal is weak at 20 ticks — longer runs or stronger intervention needed for clinical-scale effects. Results in `experiment-results/dr-counterfactual/p004-30seeds-summary.json`.
- **2026-06-30** — **Phase 2.1: Sentinel network regional heatmap (10 seeds, 30 hospitals, 5 regions).** Sector Engineer's 30-hospital network deployed across Java (9), Sumatra (7), Kalimantan (3), Sulawesi (5), Eastern Indonesia (6). Regional variance confirmed: Java 48.3% occupancy, Kalimantan 49.1% (highest), Sulawesi 40.4% (lowest). Intervention effect (reduced emissions) shifts occupancy by −0.2 to +0.3pp per region. ICU and mortality at 0 at 10-tick scale — longer runs needed for acute event capture. Heatmap in `experiment-results/dr-counterfactual/heatmap.json`.
- **2026-06-29** — Designed and implemented CounterfactualDiff schema + experiment pipeline (3 items from Meta Platform guidance). Delivered: `src/experiment/types.ts` (Intervention, MetricDelta, SectorDiff, CounterfactualDiff, ExperimentRun, ExperimentSet, StatisticalSummary), `src/experiment/diff-engine.ts` (numeric path extraction, metric deltas, event counting, multi-sector diff builder), `src/experiment/stats.ts` (mean/median/SD/CI95/Cohen's d, multi-seed summary). 30 tests passing, `tsc --noEmit` clean.
- **2026-06-29** — **P-003 executed (proof of concept).** 3 seeds, 322 metrics.
- **2026-06-30** — **Phase 1.1: Sensitivity sweep complete.** Results in `experiment-results/wwii-counterfactual/sensitivity-sweep.json`.
- **2026-06-30** — **P-003 calibrated re-run (30 seeds).** All 4 calibration gaps closed by Sector Engineer. 36/1421 metrics significant. **All 9 nation GDP metrics significant with Cohen's d > 1.0** — war destroys GDP, no-war branch higher. USA +$31.3B, DEU +$10.4B, RUS +$11.5B, CHN +$2.8B. Phase 1.2 calibration complete. Results in `experiment-results/wwii-counterfactual/p003-calibrated-summary.json`.

---

## Timeline Governor

### Pending

### Active

### Roadmap Feedback
- **Phase 1.1 (Era-to-World Loader):** Already delivered. `src/engine/era-loader.ts` exists, built by Sector Engineer using my `StrategicWorldState` types from `src/timeline/history-types.ts`. 7 tests. My `createWorld()` accepts the config output — no engine changes needed. Move to Phase 0 ✅ or mark done.
- **My scope:** Engine foundation complete (RNG, Universe, WorldEngine, RewindPoints, BranchEngine). No remaining Phase 1-3 items assigned to me. If calibration (1.2) or sentinel scale-up (2.1) needs engine changes, I'm available. Otherwise I'm idled until Phase 3 dashboard or API needs timeline/branch endpoints.

### Completed
- **2026-06-30** — Future era (S-BASELINE) wired: `src/timeline/future-types.ts` created with full schema types. `era-loader.ts` updated to detect `era === "future"`, load RP-CONTEMP-003 as base state, apply FutureEraConfig parameters (economy growth, climate, technology R&D). Exported from `src/timeline/index.ts`.
- **2026-06-30** — JAMIA paper §2.2 reviewed: 4 accurate claims, 2 minor issues flagged (branch ID format doesn't match code, "sorted before processing" is aspirational — sectors aren't explicitly sorted).
- **2026-06-30** — Seamless experiment runner built (`src/engine/experiment-runner.ts`). `loadEraAndRun(eraPath, rewindPointId, options)` chains era JSON load → all-6-sector config builder → `createWorld()` → `run()` → `snapshot()` in one call. Supports sector subset, config overrides. 6 tests, `tsc --noEmit` clean. Branch Analyst can now run `loadEraAndRun("docs/history/era-contemporary.json", "RP-CONTEMP-003", { ticks: 30, sectors })` instead of 15+ lines of manual wiring.
- **2026-06-30** — Integrated `era-loader.ts` into `src/engine/index.ts` exports (`loadEraConfig`, `buildSectorConfigs`). Full suite: 171 tests across 19 files, `tsc --noEmit` clean. Phase 1.1 era-to-world data pipeline fully wired from engine exports.
- **2026-06-29** — Built deterministic RNG (`createRNG`, `restoreRNG`) with state capture. UniverseID with genealogy (`createUniverse`, `branchUniverse`). World Engine (`createWorld`, `tick`, `run`, `snapshot`, `restoreSnapshot`) with cross-sector event processing. 27 engine tests, all passing.
- **2026-06-29** — Rewind Points (`createRewindPoint`, `createInMemoryStore`, `rewindToSnapshot`) with FNV-1a integrity hashing. Branch Engine (`forkBranch`) with intervention patching and CounterfactualDiff. 20 timeline tests, all passing.
- **2026-06-29** — Full suite: 88 tests across 10 files. `tsc --noEmit` clean for engine/timeline code. Handoff completed — Branch Analyst's prerequisite is ready.

---

## Paper OC

### Pending

### Active

### Completed
- **2026-06-30** — **Paper v4: All agent review feedback applied.** 8 fixes:
  - Sector Engineer: circuit breaker 1-tick, string hash seed derivation, honest adapter state reading, `tick` field in MacroConditionPacket, `tick()` method name
  - Timeline Governor: Universe ID format `U-2026-NNNN`, softened iteration order claim
  - Branch Analyst: added clarifying sentence that all 9 pre-specified GDP outcomes survived Bonferroni
  v4 snapshot at `jamia-2026-kronos-engine-v4-agent-reviewed.md`.
- **Paper OC assessment:** Scope complete. v4 incorporates all agent corrections and all three rounds of external reviewer feedback. 4 versions produced (draft → redraft → v3 → v4). Papers section ("All Agents — Paper Review") is now stale — all agents have submitted, v4 fixes are applied, review can be archived. No further Paper OC action items remain until human review of v4 manuscript.

---

## Open Question — 30-Sentinel Heterogeneity

External reviewer flagged: 30 sentinels are identical (same 133-bed config, different seeds). Should the paper acknowledge this as a limitation, or should we vary configs before submission?

Variation dimensions: bed count (50-500), ICU (yes/no), dialysis (yes/no), specialist density (low/med/high), disease mix (tropical/NCDs/trauma), referral role (receive/send). All adapter config — no DR code changes.

Every agent weigh in:

- **World Archivist:** Era data has city populations — can we derive hospital size from population? Currently era data has nation-level populations only. I can add regional population estimates to `era-contemporary.json` for the 5 Indonesian regions (Java ~155M, Sumatra ~60M, Kalimantan ~17M, Sulawesi ~20M, Eastern ~28M). Once regional populations are in the data, hospital size can be derived as: `beds = regionalPopulation / totalRegionHospitals * nationalBedsPer1000 / 1000`. Indonesia's `hospitalBedsPer1000` is 1.2 in the 2026 baseline. So a hospital serving 1/10 of Java's population would be ~18,600 beds — but actual Indonesian hospitals are 50-500 beds. The issue is that our regions have few hospitals (3-9) for millions of people. A better approach: seed hospital configs from actual hospital size data rather than deriving from population. **Recommendation:** Don't derive beds from population — the ratio is misleading at small-N. If we vary configs, use realistic size brackets (50/133/200/350/500 beds) by region tier, not population math. Or acknowledge as limitation and move on.
- **Sector Engineer:** Effort estimate for config-only heterogeneity

**Sector Engineer estimate: ~5 hours total, zero DR code changes.**
- `HospitalSentinelConfig` already has `beds`, `patients` — add fields: `hasIcu`, `hasDialysis`, `specialistLevel`, `diseaseMix`, `referralRole`
- Wire new fields through adapter `init()` → `createWorld(patients, undefined, seed)` accepts optional ward capacity override
- Deers Rock already supports ward capacity config + scenario config — no DR changes needed
- 1h config types, 2h adapter wiring, 2h tests
- **Recommendation:** Vary configs before submission. 30 identical sentinels undermines the "distributed observation network" claim in §2.5. Even simple variation (5 tiers × 6 regions) strengthens the paper.
- **Branch Analyst:** Does not affect experiment interpretation at the current validation level. The P-004 experiment validates the sentinel pipeline end-to-end — it proves macro events propagate through the adapter to the hospital simulator and back. That claim holds regardless of whether the simulator is cloned or heterogeneous. The regional heatmap finding (occupancy 40–49% across regions) is a demonstration of the adapter's distributed capability, not a findings claim about Indonesian healthcare. **Recommendation:** Acknowledge as a limitation ("all sentinels run the same simulator — heterogeneous integration is future work") rather than delaying submission to vary configs. If there's time, the adapter supports heterogeneity via config — would take ~2 hours to define 30 distinct HospitalSentinelConfigs from the population data.
- **Timeline Governor:** Is the engine architecture ready for heterogeneous configs? ✅ Yes. The sentinel adapter (`createSentinels`) accepts an array of `{ id, config }` pairs where each config independently sets bed count, departments, staffing, etc. The adapter derives seeds from string IDs via djb2 hash — no seed collision risk regardless of numeric overlap. The world engine processes sectors in deterministic order regardless of config variation. No architectural changes needed — just add varied configs to `src/data/indonesian-hospitals.ts`. However, note that heterogeneous simulators (different hospital models, not just different params) would need adapter changes since the adapter currently wraps one simulator type. For config-only variation: ready now.
- **Paper OC:** Acknowledge as limitation. Do not vary configs before submission. Reasoning: (1) The contribution is the adapter pattern, not the specific configs — varying bed counts proves the adapter handles different config files, which is trivially true by design. (2) The real gap flagged by both external reviewers is that all 30 run *Deers Rock*, not different *simulator types* — config variation doesn't close that gap, only wrapping a second simulator would. (3) Config changes require re-running heatmap seeds for verification, with potential edge cases (ICU=false sentinel receiving ICU macro packet?). Risk/reward is poor this close to paper completion. (4) Section 4.4 already singles this out as limitation #2 with concrete next steps. A reviewer who reads that and still rejects is not someone config variation would persuade.

**Resolution:** Acknowledge as limitation (Human — confirmed). No config changes before submission. The adapter supports heterogeneity by design; demonstrating this is future work. Limitation #4 already documents this in §4.4. v4 stands.

---

## All Agents — Paper Review

**Paper open for comment.** Manuscript at `docs/papers/jamia-2026-kronos-engine.md` (v4). All agent feedback received and applied. Review section preserved for audit trail. Latest: v4 at `jamia-2026-kronos-engine-v4-agent-reviewed.md`.

- **World Archivist:** §3.3 (Historical Data) — era accuracy, rewind point fidelity
- **Sector Engineer:** §2.3 (Sector Architecture), §2.5 (Sentinel Adapter) — architecture claims
- **Branch Analyst:** §3.1 (P-003), §3.2 (P-004), §4.1 (Statistical Approach) — experiment accuracy
- **Timeline Governor:** §2.2 (Counterfactual Engine) — engine design claims ✅

### Timeline Governor — Paper Review (§2.2) ✅

Factual accuracy check against my code:

1. **Seeded RNG mulberry32 with call-count tracking** — ✅ Accurate. `src/engine/rng.ts` implements `createRNG()` with `save()`/`restore()` exporting `RNGState { seed, callCount }`.

2. **Universe ID example `U-2026-0001-B-2026-0001`** — ⚠️ Minor. My Branch IDs are `B-YYYY-NNNN` (separate from UniverseID). The paper's combined format doesn't match the actual `UniverseID.id` / `Branch.id` types. Suggest changing to: `U-2026-0001` with child `U-2026-0002` (linked via `parent` field), or note the `B-YYYY-NNNN` branch format.

3. **"All iterable collections sorted before processing"** — ⚠️ This claim is aspirational. Sectors are processed in insertion order (caller-dependent), not explicitly sorted. Draft PRNG iteration and event bus handler order also lack explicit sorting. The paper overstates determinism guarantees. Suggest: "Sectors, hospitals, and nations are processed in a deterministic order guaranteed by sorted iteration or stable insertion" and I can add the sort in code to match.

4. **Snapshot/restore at any tick** — ✅ Accurate. `snapshot()`/`restoreSnapshot()` in `world-engine.ts`. `rewindToSnapshot()` bridges RewindPoints.

5. **Full world state capture** — ✅ Accurate. `createRewindPoint()` captures all sector states + RNG state + state hash for integrity verification.

6. **Reproducibility** — ✅ Accurate. Same seed + same intervention = identical output proven across all 197 tests.

**Fix requested for item 2-3 before publication.** I can implement the sort guarantees if needed.

Focus on factual accuracy. Close by human.

**Branch Analyst review of §3.1 (P-003), §3.2 (P-004), §4.1 (Statistical Approach):**

**§3.1 (P-003) — Factual accuracy: ✅ All verified against experiment data.**
- 30 seeds (42–71): ✅ confirmed from run
- 1,421 metrics: ✅ confirmed from summary
- 36 significant, 71 expected FPs at α=0.05: ✅ confirmed
- GDP table (9 nations, Δ values, d > 1.0): ✅ all match
- Climate metrics d=2.78 (temp), 2.35 (CO₂), 2.20 (emissions): ✅ confirmed from 30-seed calibrated run
- Caveat about compounding growth (line 268): ✅ Important and correctly stated
- One minor suggestion: line 250 says "The 36 observed significant metrics is fewer than the ∼71 expected by chance under an uncorrected α = 0.05, confirming the correction's conservatism" — this is correct but could mislead a casual reader into thinking 36 < 71 means results are non-significant. Suggest adding: "However, all nine pre-specified primary outcomes (nation-level GDP) survived Bonferroni correction, confirming the intervention effect is not attributable to chance."

**§3.2 (P-004) — Factual accuracy: ✅ All verified.**
- 30 seeds, 20 ticks, 156 metrics, 14 significant: ✅ confirmed
- Metric table (CSSD d=-2.71, Dialysis d=1.11, Prevalence d=0.91, Occupancy d=0.70, Outcomes d=0.58): ✅ all match
- Negative result (mortality, ICU flat): ✅ correctly stated

**§4.1 (Statistical Approach) — ✅ Accurate and well-framed.**
- Bonferroni for primary outcomes vs Cohen's d for exploratory sweep: matches our methodology
- FDR mention in limitations (line 348): appropriate addition

**Overall:** No factual errors found in my sections. The caveats (compounding GDP, short simulation duration, correction conservatism) are honestly stated. Ready for submission from a Branch Analyst perspective.

---

**Sector Engineer review of §2.3 (World Sectors) and §2.5 (Sentinel Adapter):**

**§2.3 (World Sectors):**
- Sector table is accurate for all 6 sectors. Events listed match the typed event catalog.
- GDP formula `GDP[t+1] = GDP[t] × (1 + growthRate[t] / 100)` is correct.
- War GDP modifier description (−15% defender) matches implementation.

**§2.5 (Sentinel Adapter) — factual corrections needed:**
1. **Line 173: "fails to respond for three consecutive ticks"** — Incorrect. The circuit breaker fires on a single failed step() call per tick, not after three consecutive failures. Publishing `health.down` immediately and using lastKnownGood. Fix to: "If the hospital simulator fails to respond, the adapter publishes a `health.down` signal and continues with the last known good state."
2. **Line 163-168: Seed derivation** — Code shows `getHospitalSeed(worldSeed, hospitalId: number)` with a numeric hospitalId. But the implementation now hashes the string ID (e.g., "jkt-001") using a djb2 variant, because all sentinel IDs use the same numeric suffix (`-001`). The integer `hospitalId` in the paper's code is correct in theory, but the actual call site computes it as `hashString(config.id)` rather than `parseInt(numericSuffix)`. Update to reflect string-based ID hashing, or keep the Knuth formula but note the id is derived from the sentinel's string identifier.
3. **Line 175: "consumes only the simulator's public API (e.g., tick(), getState())"** — This is misleading. The adapter uses `step(world)` (public) to advance the simulator, but reads internal state (`world.state.beds`, `world.state.morgue`, `world.state.encounters`) directly for sentinel output extraction. `getState()` is not a public export. Either: (a) add a `getSentinelMetrics(world): SentinelMetrics` function to Deers Rock's public API and use that instead, or (b) update the paper to honestly state that the adapter reads hospital state directly — citing that this is a known limitation the adapter invariants accept because no patient-level data leaks upward.
4. **MacroConditionPacket (line 136-142):** Missing the `tick` field that the actual struct carries. Add `tick: number` to the interface.
5. **Line 161: "fastForward(days)"** — The actual method is `tick(state, ctx)` which loops internally for `ticksPerDay` iterations. Consider using the actual method name or a more generic description.

---

## Somnium Engine — Fictional World Counterfactuals

**Codename adopted.** Kronos Engine is now internally Somnium Engine. The wall says: *"One engine, infinite timelines."*

### Use cases to weigh in on

**1. Shared universe continuity (Agatha Christie)**
What if Poirot and Miss Marple met? Poirot exists because WWI made him a refugee. Branch at 1914, remove the war → Poirot stays a Belgian police officer, never reaches England, never meets Miss Marple. The entire Christie canon collapses or transforms. Engine already handles this — same Rewind Point system, same Branch Engine.

**2. Character origin counterfactuals (Thanos / Marvel)**
What if Titan never collapsed? Same pattern as Poirot — a character's origin is a branch point. Change the seed event, and the entire fictional universe forks.

**3. Canon vs fanon validation**
Given 14 million timelines, Doctor Strange brute-forced it. Somnium would give CI/SD, effect sizes, and a ranked list of interventions sorted by probability of success.

**4. The product pitch**
A platform where writers, game masters, and "what if?" content creators can:
- Pick a fictional universe seed library
- Choose a Rewind Point
- Define an intervention
- Get a statistically grounded counterfactual diff
- Export as a narrative outline or timeline diagram

### The question
Everything built (RNG, UniverseID, Rewind Points, Branch Engine, Diff Engine, Stats) already supports this. No engine changes needed. The effort is in:
- **World Archivist:** Authoring fictional era data packages (character bios as demographic state, plot points as events, settings as geopolitical configs)
- **Sector Engineer:** Fictional-world sector implementations (magic systems, fictional economies, non-human demographics)

**Sector Engineer verdict: Post-paper.** The existing 6 sectors are calibrated to Earth-specific parameters (GDP growth, CO2 sensitivity, demographic transition models, energy economics). A Middle-earth sector set isn't just new data — it needs new handler logic (Elven immortality breaks birth/death rate models, magic as an energy source doesn't map to oil/gas/renewable mix, Sauron's influence isn't a diplomatic relation score). That's not a config change — it's a new sector implementation. Estimate: ~4-6 hours per fictional sector (design + code + tests), ~24-36 hours for a full 6-sector fictional set. Doing this alongside JAMIA submission would delay the paper. Ship JAMIA first, then Somnium as a separate product track with its own sector library. The engine core is agnostic — zero technical debt in waiting.
- **Branch Analyst:** Running counterfactuals on fictional timelines
- **Timeline Governor:** No changes — engine is already domain-agnostic. My vote: **build alongside, zero risk.** The engine core is done — no engineering time needed from me. The bottleneck is entirely content (Archivist's era data, Sector Engineer's fictional sector logic) and Branch Analyst's experiment runs. There's no code conflict with JAMIA since the engine doesn't change. If Archivist or Sector Engineer want to start on a LotR data package as a side lane, they can — my layer won't block them. Post-paper is safer from a focus standpoint, but there's no technical reason to wait.
- **Paper OC:** This is a different publication track — not JAMIA, but digital humanities / fan studies / game dev

**Resolution (Human):** Post-submission. Close discussion. Somnium Engine is a separate product track — ship JAMIA first.

---

## Meta Platform (cross-domain)

### Pending

### Active

### Completed
- **2026-06-29** — World Archivist status: All 6 historical eras seeded and validated (ancient through contemporary). 14 pre-seeded Rewind Points fully populated with StrategicWorldState (nations, GDP, wars, alliances, global state). Cross-reference audit passes with zero errors. Branch Analyst consumed RP-MODERN-001 (1939) successfully in P-003 "No WWII" counterfactual — data pipeline confirmed end-to-end. Archivist prerequisites for Branch Analyst and Timeline Governor are ready.
- **2026-06-29** — Timeline Governor confirmed: Archivist era data schema (`StrategicWorldState`) matches engine types (`WorldState`, `RewindPoint`, `SectorState` in `src/timeline/history-types.ts`). No schema mismatch. Archivist → Governor data pipeline validated.
  **Meta Platform:** ✅ Noted.
- **2026-06-30** — Timeline Governor built the era-to-world JSON loader (`src/engine/era-loader.ts` + tests). Phase 1.1 complete before roadmap was even finalized.
- **2026-06-29** — **Sector Engineer:** Era-to-world loader built (`src/engine/era-loader.ts`). `buildSectorConfigs(state, era)` maps StrategicWorldState → sector configs. `loadEraConfig(path, rewindPointId)` reads era JSON from disk. Handles era-specific defaults for CO2, emissions, R&D, GDP growth, inflation, trade volume. 7 tests. **Handoff complete — usable by Branch Analyst for future counterfactuals.**

---
