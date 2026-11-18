# EXPERIMENT EVIDENCE FREEZE — 2026-09-07

**Freeze Identifier:** EXP-FREEZE-2026-09-07  
**Date:** 2026-09-07  
**Repository Commit:** `4d7e412` (Phase E handoff: complete coupling status for KE agents)  
**Branch:** `master`  
**Canonical URL:** https://github.com/rikirinjani/Kronos-Engine

---

## Frozen Experiments

### P-003 — WWII Counterfactual

| Parameter | Value |
|---|---|
| Identifier | P-003 |
| Seeds | 30 (42–71) |
| Total metrics extracted | 1,233 |
| Non-degenerate (testable) | 291 |
| Degenerate | 942 |
| Degenerate explanation | 939 from seed-specific procedural wars (n=1); 3 from zero variance |
| Pre-specified primary outcomes | 9 GDP metrics |
| Significant at uncorrected α=0.05 | 19 (noise floor: 14.55) |
| Significant after BH-FDR | 1 (wars.W-1939-01.casualties — mechanical) |
| Significant after Bonferroni | 1 (same metric) |
| GDP primary outcomes significant | 0 of 9 |
| Effect sizes | One-sample d_z; |d| ≤ 0.09 for all GDP outcomes |
| Interpretation | Exploratory negative result; no defensible GDP effect |

### P-004 — Climate Configuration Intervention

| Parameter | Value |
|---|---|
| Identifier | P-004 |
| Seeds | 30 (42–71) |
| Total metrics extracted | 199 |
| Non-degenerate (testable) | 106 |
| Degenerate | 93 |
| Significant at uncorrected α=0.05 | 6 (noise floor: 5.3) |
| Significant after BH-FDR | 0 (minimum q = 0.198) |
| Significant after Bonferroni | 0 |
| Hospital sentinel metrics | All degenerate (stdDev = 0) |
| df=1 world-level artifacts | 6 (economy/technology, not hospital) |
| Interpretation | Adapter boundary characterization; climate config does not cross adapter boundary into hospital outcomes |

### Phase F — Mechanistic Pilot (CO2 Concentration)

| Parameter | Value |
|---|---|
| Identifier | PHASE-F-CAUSAL-2026-09-06 |
| Seeds | 5 (42–46) |
| Execution method | Fresh-world paired execution (no forkBranch) |
| Intervention | Elevated CO2 concentration (800 ppm vs control 280 ppm) |
| Horizon | 20 KE ticks |
| Sentinel | Deers Rock, 133-bed Makassar hospital |
| Primary outcomes | occupancyRate, icuOccupancyRate, mortalityPressure, supplyStress, admissionSurge |
| Exploratory diagnostic | Direction consistency ≥ 80% (4/5 seeds) |
| SupplyStress mean Δ | 0.034 |
| SupplyStress direction consistency | 20% (1/5 seeds) |
| Other primary outcomes | All Δ = 0 across all seeds |
| Exploratory diagnostic met | **No** |
| Replay identical | Yes |
| Interpretation | Structural null; CO2 elevation did not propagate to hospital metrics within 20-tick horizon |

### Regional Sentinel Network

| Parameter | Value |
|---|---|
| Sentinels | 30 (Deers Rock instances) |
| Regions | 5 Indonesian regions |
| Simulation duration | 10 ticks |
| Occupancy range | 40.4%–49.1% |
| Interpretation | Demonstrates distributed operational capability; not 30 heterogeneous hospitals |

---

## Evidence Artifact Locations

| Artifact | Path |
|---|---|
| P-003 results | `experiment-results/wwii-counterfactual/p003-calibrated-summary.json` |
| P-004 results | `experiment-results/dr-counterfactual/p004-30seeds-summary.json` |
| P-004 regression test | `src/experiment/experiments/dr-counterfactual.test.ts` |
| P-003 regression test | `src/experiment/experiments/p003-calibrated.test.ts` |
| Integration test | `src/integration/heatwave.test.ts` |
| DR adapter | `src/sectors/deers-rock-adapter.ts` |
| Evidence matrix | `docs/MANUSCRIPT-EVIDENCE-MATRIX-2026-09-07.md` |
| Pre-submission audit | `docs/PRE-SUBMISSION-AUDIT-2026-09-07.md` |
| Forensic audit | `docs/FINAL-FORENSIC-AUDIT-2026-09-07.md` |
| Gate report | `docs/FINAL-GATE-2026-09-07.md` |
| Phase F results | `experiment-results/phase-f/results.json` |
| Phase F stats | `experiment-results/phase-f/statistical-summary.json` |
| Phase F manifest | `experiment-results/phase-f/manifest.json` |
| Phase F report | `experiment-results/phase-f/report.md` |

---

## Manuscript Version

| Field | Value |
|---|---|
| Manuscript path | `docs/papers/jamia-2026-kronos-engine.md` |
| Title (under evaluation) | Kronos Engine: A Deterministic Counterfactual Experimentation Platform with Sentinel Adapter Pattern for Multi-Scale Health System Simulation |
| Target journal | JAMIA |
| Author | Riki Rinjani, Hisfarma IAI, ORCID 0009-0002-9364-2637 |

---

## Known Software Limitations

| Limitation | Status | Impact on P-003/P-004/Phase F |
|---|---|---|
| WAR_END handler missing | Documented, not repaired | No impact on P-003 (W-1939-01 pre-exists) |
| Calendar-year dependency | Documented | No impact (all experiments in 2026) |
| Clock-RNG snapshot/replay gap | Documented | No impact on cross-branch comparability |
| health-surveillance.test.ts isolation assertion | Unresolved | Does not affect experimental pathways |
| Circuit breaker stale-state | Documented | Does not affect P-003/P-004 |
| LOCAL_SIGNAL_ONLY invariant | Architectural | Blocks hospital→world feedback |
| P-004 climate config does not cross adapter boundary | Characterized | Confirms adapter boundary |
| Phase F CO2 elevation did not propagate to hospital metrics | Characterized | Structural null; consistent with P-004 short-horizon finding |

---

## Test Status

| Metric | Value |
|---|---|
| Total tests | 333 |
| Passing | 332 |
| Failing | 1 |
| Failing test | `health-surveillance.test.ts` — isolation assertion (patients: 48) |
| Nature of failure | Assertion failure (not timeout); stochastic DR occupancy drifts below 0.85 threshold |
| Relevance to manuscript | Exercises E3 health-surveillance isolation, which does not affect any paper claim |
| Test suite command | `npx vitest run` |

---

## Freeze Conditions

This evidence freeze is authoritative. Any future replication must:

1. Receive a new experiment identity (e.g., P-003-R, P-004-R)
2. Not overwrite these frozen artifacts
3. Be conducted on a larger machine if seed counts are increased
4. Report against the frozen evidence, not as a replacement

---

## Trace Record

| Field | Value |
|---|---|
| Trace time | 2026-09-07 |
| Duration | 60 seconds |
| Tools called | 3 (bash, bash, bash) |
| Tool calls used | bash:read_file (431 lines), bash:file_info (test file), bash:grep (patients count) |
| Evidence frozen | 4 experiments, 2 hypothesis, 3 conclusions |
| Confidence | high |
| Reason | Evidence freeze document created with all frozen experiment parameters, artifact locations, known limitations, and test status |
