# CLAIM AUDIT — 2026-09-07

**Manuscript:** Kronos Engine: A Deterministic Counterfactual Experimentation Platform with Sentinel Adapter Pattern for Multi-Scale Health System Simulation  
**Frozen Evidence:** EXP-FREEZE-2026-09-07  
**Repository Commit:** `4d7e412`

---

## Claim-Evidence Traceability Table

| # | Claim | Evidence | Supported? | Final Wording |
|---|-------|----------|------------|---------------|
| C1 | Kronos Engine implements a deterministic multi-scale counterfactual platform | Architecture review; seeded RNG; sorted iteration; snapshot/restore | ✅ Yes | "Kronos Engine implements a deterministic architecture for composing macro-scale counterfactual world simulation with micro-scale sentinel simulators through an explicit adapter boundary." |
| C2 | Sentinel adapter pattern enables zero-modification integration | Deers Rock adapter wraps hospital simulator without source modification | ✅ Yes | "The sentinel adapter pattern enables existing hospital simulators to participate in world-scale counterfactuals without modification, preserving simulator autonomy while enabling multi-scale intervention experiments." |
| C3 | Deterministic reproducibility is achieved | Mulberry32 PRNG; seed derivation; sorted iteration; branch isolation verified | ✅ Yes | "Deterministic execution ensures any counterfactual experiment can be precisely re-executed, supporting auditability and third-party verification." |
| C4 | WWII counterfactual produced no defensible GDP effect | P-003: 0 of 9 primary outcomes significant under BH-FDR/Bonferroni | ✅ Yes | "The WWII counterfactual produced no defensible GDP effect under multiplicity-controlled statistics: 0 of 9 pre-specified GDP primary outcomes were significant." |
| C5 | Climate configuration intervention verified adapter event pathway | Integration test confirmed adapter produces sentinel output when events are injected | ✅ Yes | "An integration test confirmed the adapter produces sentinel output when macro events are injected, verifying the event-driven pathway is operational." |
| C6 | P-004 climate configuration did not propagate to hospital outcomes | All hospital sentinel metrics degenerate (stdDev = 0); adapter consumes discrete events, not config parameters | ✅ Yes | "The specific climate configuration intervention did not produce measurable hospital-level changes — all hospital sentinel metrics were degenerate." |
| C7 | 30-sentinel deployment demonstrated distributed operational capability | 30 Deers Rock instances across 5 Indonesian regions; independent seeds; independent operation | ✅ Yes | "A 30-sentinel deployment across five Indonesian regions demonstrated the adapter's distributed operational capability." |
| C8 | Coupling is asymmetric: world→hospital implemented, hospital→world unimplemented | LOCAL_SIGNAL_ONLY invariant; no world sector subscribes to health.* events | ✅ Yes | "The coupling is asymmetric by design: world sectors can influence hospital state through the adapter (implemented and integration-tested), but hospital state does not currently feed back into world-sector evolution (unimplemented)." |
| C9 | Deterministic execution establishes reproducibility, not empirical validity | Methodological distinction applied throughout manuscript | ✅ Yes | "Deterministic execution establishes reproducibility of model trajectories under the stated execution conditions; it does not establish empirical validity." |
| C10 | Adapter pattern is designed to generalize beyond healthcare | Architectural design; adapter contract allows other simulator types | ✅ Yes (qualified) | "The adapter pattern is designed to accommodate micro-level simulators exposing equivalent state-update and state-query interfaces — provided they implement the adapter's contract." |
| C11 | Platform source code is available upon request | GitHub repository exists but is not yet public | ✅ Yes (qualified) | "The platform's source code is available upon request. The repository is not yet public." |
| C12 | No empirical calibration against real hospital data | Acknowledged limitation throughout manuscript | ✅ Yes (limitation) | "The platform has not been calibrated against real-world hospital admission data. This is the paper's single largest exposure." |
| C13 | P-003 degenerate metrics arise from procedural wars (n=1) | 939/942 degenerate metrics from seed-specific war identifiers | ✅ Yes | "939 of 942 degenerate metrics arise from procedurally generated war structures that appear in the state tree of individual simulation seeds but not across the full ensemble." |
| C14 | P-004 df=1 artifacts are world-level, not hospital effects | 6 uncorrected significant metrics are economy/technology with df=1 | ✅ Yes | "The 6 uncorrected significant metrics were world-level economy/technology artifacts with df = 1 — not hospital effects." |
| C15 | 30-sentinel deployment is simulated instances, not 30 heterogeneous hospitals | Same Deers Rock simulator cloned 30 times with different seeds | ✅ Yes | "The 30-instance sentinel deployment demonstrates that one simulator can be cloned 30 times with different configurations — this confirms the adapter's operational scalability, not its ability to integrate heterogeneous simulator types." |
| C16 | Phase F mechanistic pilot produced a structural null | 5 seeds, direction consistency = 20% for supplyStress; all other primary outcomes Δ = 0; exploratory diagnostic (≥80%) not met | ✅ Yes | "Phase F produced a structural null: no consistent directional effects across seeds (direction consistency = 20% for supplyStress; all other primary outcomes Δ = 0), consistent with the hypothesis that macro-to-micro propagation requires longer simulation horizons beyond the tested 20-tick horizon." |
| C17 | Platform can produce and audit honest negative results | P-003 (no GDP effect), Phase F (structural null) — both demonstrate pipeline capacity for honest negatives | ✅ Yes | "The experiments demonstrate the platform's capacity to produce and audit honest negative results — including a null GDP effect under multiplicity-controlled statistics and a structural null where intervention effects failed to propagate." |

---

## Flagged Claims

| # | Claim | Concern | Action Taken |
|---|-------|---------|--------------|
| C10 | "Designed to generalize" | Could imply broader validation than demonstrated | Qualified with "provided they implement the adapter's contract"; added "not yet validated with additional simulators" in limitations |
| C15 | 30-sentinel network | Could imply 30 heterogeneous hospitals | Explicitly stated as 30 instances of same simulator |

---

## Unsupported Claims NOT Present in Manuscript

The following claims were explicitly excluded and do NOT appear in the manuscript:

| Claim | Status |
|-------|--------|
| Empirical predictive validity | ❌ Not claimed |
| Validated clinical outcomes | ❌ Not claimed |
| Demonstrated climate→hospital causal effects | ❌ Not claimed |
| Implemented hospital→world causal coupling | ❌ Not claimed |
| Byte-reproducible or cross-platform reproducible | ❌ Not claimed |
| Generalizes to any simulator | ❌ Not claimed |
| Clinically validated | ❌ Not claimed |
| Predicts | ❌ Not claimed |
| Proves | ❌ Not claimed |

---

## Audit Conclusion

**All 17 claims are supported by the frozen evidence or explicitly qualified as limitations.** No claims exceed the evidence. No unsupported claims are present in the manuscript. The manuscript accurately represents the frozen experimental findings and their architectural significance.
