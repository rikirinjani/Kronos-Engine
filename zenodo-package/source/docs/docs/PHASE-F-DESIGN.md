# Phase F Design Report: Causal Intervention Transmission Experiment

## 1. Overview

Phase F tests whether the implemented macro↔micro architecture can transmit a controlled causal intervention from the Kronos Engine (KE) macro world into an independent Deers-Rock (DR) healthcare sentinel. This is the definitive test of the causal pathway: KE sector event → adapter translation → DR event consumption → sentinel output change.

The experiment uses a counterfactual design: fork a KE world at a rewind point, apply an intervention to the child branch, run both branches forward, and compare DR sentinel outputs. The intervention must be strong enough to produce observable effects while maintaining scientific rigor.

## 2. Research Question

**Can a controlled macro-level intervention in the Kronos Engine produce a statistically detectable change in an independent DR sentinel's healthcare metrics through the implemented adapter pathway?**

Subsidiary questions:
- Does the intervention propagate through the correct causal chain (climate → extreme weather → adapter → DR events → sentinel output)?
- Are the effects isolated to the targeted sentinel (no contamination of other sentinels or non-DR sectors)?
- Is the effect reproducible across multiple random seeds?

## 3. Hypothesis

**Primary Hypothesis**: Increasing CO₂ concentration in the KE climate sector will increase the frequency and severity of extreme weather events, which will be translated by the adapter into DR events (admission_surge, supply_chain_pressure, active_disaster), resulting in higher occupancy rates, ICU occupancy, and mortality pressure in the DR sentinel.

**Null Hypothesis**: The intervention will produce no detectable change in DR sentinel outputs compared to the control branch.

**Causal Pathway**:
```
CO₂ increase → temperature anomaly increase → extreme weather event probability increase
→ EXTREME_WEATHER event published → adapter translates to:
  - admission_surge (multiplier +0.3)
  - supply_chain_pressure (≥0.4)
  - active_disaster (natural-disaster)
  - diagnosis_weight_overrides (J00-J99 ×1.3)
→ DR hospital receives events → increased occupancy, mortality, supply stress
→ sentinel output reflects changes
```

## 4. Experimental Design

**Design Type**: Randomized controlled counterfactual experiment with matched-horizon guard.

**Components**:
- **Parent branch**: Control condition (baseline CO₂)
- **Child branch**: Intervention condition (elevated CO₂)
- **Rewind point**: Pre-seeded at COVID-19 baseline (RP-CONTEMP-002)
- **Horizon**: 20 KE ticks (materially sufficient for causal propagation)
- **Seeds**: 5 independent random seeds (42, 43, 44, 45, 46) for variance estimation

**Controls**:
- Identical initial conditions for parent and child branches
- Matched horizon (both run exactly 20 ticks from same rewind point)
- Baseline integrity assertion (restored pre-intervention state equals parent baseline)
- RNG isolation (KE world RNG state identical across branches)

## 5. Intervention Specification

**Intervention Type**: Climate parameter patch via `forkBranch`

**Target Sector**: `climate`

**Parameters**:
- **Parent (control)**: `co2Concentration: 280` (pre-industrial baseline)
- **Child (intervention)**: `co2Concentration: 800` (high-emission scenario)

**Rationale**:
- CO₂=280 gives temperature anomaly = 0, event chance = 5% per tick (minimum)
- CO₂=800 gives temperature anomaly ≈ 4.55, event chance ≈ 26.7% per tick
- This creates a clear difference in extreme weather event frequency
- The adapter will translate EXTREME_WEATHER events into DR events

**Implementation**:
```typescript
const intervention: Intervention = {
  climate: {
    co2Concentration: 800,  // Child branch
  },
};
```

**Expected Effect Sizes**:
- Parent branch: ~5% chance of extreme weather per tick → ~64% chance of ≥1 event in 20 ticks
- Child branch: ~26.7% chance per tick → ~99.6% chance of ≥1 event in 20 ticks
- The child branch will have more frequent and severe events

## 6. Seeds and Horizon

**Seeds**: [42, 43, 44, 45, 46]
- 5 seeds for variance estimation and reproducibility
- Deterministic seeds allow exact replication
- Enough seeds to detect consistent effects while keeping computation bounded

**Horizon**: 20 KE ticks
- Matches existing P-004 baseline
- Sufficient for causal propagation (adapter responds within 1 tick)
- Within temporal contract semantics (20 KE ticks = 20 DR sampling ticks)

**Compute Budget**:
- 5 seeds × 2 branches × 20 ticks = 200 KE tick operations
- Each KE tick includes DR adapter processing (10 DR ticks per KE tick)
- Total: 200 × 10 = 2,000 DR simulation ticks

## 7. Observables and Primary Outcomes

**Primary Outcomes** (pre-specified):
1. **Occupancy Rate**: `sentinelOutput.occupancyRate` (0-1 scale)
2. **ICU Occupancy Rate**: `sentinelOutput.icuOccupancyRate` (0-1 scale)
3. **Mortality Pressure**: `sentinelOutput.mortalityPressure` (count)
4. **Supply Stress**: `sentinelOutput.supplyStress` (0-1 scale)
5. **Admission Surge Flag**: `sentinelOutput.admissionSurge` (boolean)

**Secondary Observables**:
- Number of EXTREME_WEATHER events published
- Number of DR events scheduled (admission_surge, supply_chain_pressure, active_disaster)
- Climate state: temperatureAnomaly, event chance
- Health-surveillance event counts (if health-surveillance sector is included)

**Measurement Points**:
- Final state at tick 20 (primary comparison)
- Time-series of sentinel outputs at each tick (for trajectory analysis)

## 8. Isolation Invariants

**Invariant 1: Sentinel Isolation**
- DR sentinels must not contaminate each other
- Test: Hash comparison of non-targeted sentinels across branches
- Expected: Identical hashes (no contamination)

**Invariant 2: RNG Isolation**
- KE world RNG state must be identical across branches at every tick
- Test: Hash comparison of RNG state at horizon end
- Expected: Identical hashes (intervention is sector-local)

**Invariant 3: Non-DR Sector Isolation**
- Non-DR sectors (geopolitics, economy, technology) must be identical across branches
- Test: Hash comparison of non-DR sector states
- Expected: Identical hashes (intervention only affects climate sector)

**Invariant 4: Adapter Fidelity**
- Adapter must translate events correctly without inventing domain behavior
- Test: Event types match adapter's switch cases exactly
- Expected: EXTREME_WEATHER → correct DR events

## 9. Statistical Plan

**Analysis Approach**: Descriptive statistics with effect size estimation.

**Metrics**:
1. **Mean Delta**: Average difference across seeds (child - parent) for each outcome
2. **Direction Consistency**: Proportion of seeds with delta in same direction
3. **Effect Size**: Cohen's d or similar (if variance permits)

**Inference** (exploratory, not confirmatory):
- Paired t-test across seeds (5 pairs)
- Wilcoxon signed-rank test (non-parametric alternative)
- Significance threshold: p < 0.05 (uncorrected, for exploration)

**Power Analysis**:
- With 5 seeds, minimum detectable effect size ≈ 1.0 SD (low power)
- This experiment is primarily for proof-of-concept, not hypothesis testing
- Zero effect is a valid result (null hypothesis not rejected)

**Multiple Comparisons**:
- Primary outcomes are pre-specified (5 outcomes)
- Bonferroni correction: α = 0.05/5 = 0.01
- False Discovery Rate (BH-FDR) as alternative

## 10. Failure Matrix

| Failure Mode | Detection | Response |
|--------------|-----------|----------|
| **No EXTREME_WEATHER events in child branch** | Event count = 0 | Intervention too weak; increase CO₂ or extend horizon |
| **Events in parent branch** | Event count > 0 | Stochastic variation; increase seeds or accept noise |
| **Adapter doesn't translate events** | DR events = 0 despite EXTREME_WEATHER | Adapter bug; inspect buildMacroPacket |
| **Sentinel output unchanged** | Delta = 0 despite DR events | DR internal dynamics; check event consumption |
| **Contamination across sentinels** | Non-targeted sentinel hash differs | Isolation violation; investigate event routing |
| **RNG state differs across branches** | Hash mismatch | Intervention leaked to world RNG; check patch scope |
| **Baseline integrity fails** | Pre-intervention state mismatch | Rewind point corruption; regenerate rewind point |

## 11. Success Criteria

**Primary Success**: Child branch shows higher occupancy rate than parent branch across majority of seeds.

**Secondary Success**:
- Direction consistency ≥ 80% (4/5 seeds)
- Mean delta > 0.05 (5 percentage point increase in occupancy)
- No isolation invariant violations

**Engineering Success**:
- All guards pass (matched horizon, baseline integrity)
- Experiment reproducible (identical results on rerun)
- Adapter correctly translates EXTREME_WEATHER → DR events

**Scientific Success**:
- Causal pathway functional (macro → micro transmission)
- Effect attributable to intervention (not random variation)
- Results interpretable regardless of significance

## 12. Execution Plan

**Phase F-1: Design Approval** (current)
- Present design to user for review
- No implementation until approved

**Phase F-2: Implementation** (if approved)
1. Create experiment script `phase-f-intervention.ts`
2. Implement intervention specification
3. Add health-surveillance sector to world (optional)
4. Run experiment with 5 seeds
5. Collect results and generate report

**Phase F-3: Analysis**
1. Compute primary outcome effects
2. Check isolation invariants
3. Assess direction consistency
4. Generate statistical summary

**Phase F-4: Report**
1. Write results to `experiment-results/phase-f/`
2. Update HANDOFF with Phase F findings
3. Commit results and report

**Stop Gate**: After design report only. No implementation until user approval.

---

**Document Status**: Design Complete
**Created**: 2026-09-05
**Author**: Orchestrator
**Next Step**: Await user approval before implementation
