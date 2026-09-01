# Phase 2 Blocker — Deers Rock Adapter Consumption Path Not Implemented

**Date:** 2026-09-01
**Task:** Kronos Engine Final Reopening Execution Task, Phase 2 (Deers Rock RNG + full P-004 reproducibility)
**Status:** BLOCKED — documented per governance rule 11 and Phase 2 §6 ("stop and document the blocker rather than weakening the reproducibility claim")

---

## 1. Summary

Phase 2's reproducibility gate **cannot pass as specified** because the macro→micro
adapter consumption path is **not implemented** in the Deers Rock (DR) repository.
The DR RNG itself is **already deterministic** (verified cross-process, byte-identical).
The blocker is that the Kronos Engine intervention (emissions_control → climate events →
macro packet) **never changes DR behavior**, because DR's `step()` silently drops the
macro packet's actionable fields.

This is a genuine blocker, not a Kronos-side reproducibility failure. Per governance
rule 11, it is documented rather than routed around. Per rule 12, Phase 2 does not
proceed past this point without an explicitly recorded reason and authorization.

---

## 2. Evidence

### 2.1 DR RNG determinism — PROVEN (cross-process)

Independent probe (`dr-determinism-probe.mjs`, run as two separate processes):

| Seed | Run 1 hash | Run 2 hash | Match |
|------|-----------|-----------|-------|
| 42   | `b3e6acef...` | `b3e6acef...` | ✅ identical |
| 7    | `06bae018...` | (different from seed 42) | ✅ different trajectory |

- DR `createRng` (`src/engine/clock.ts`) is a genuine mulberry32 PRNG, seeded.
- DR `createClock` falls back to `Date.now()` only when seed is undefined; the KE
  adapter always supplies a seed, so wall-clock randomness does not enter simulation state.
- Same-process repeated runs differ due to documented module-global ID counters (F3);
  cross-process runs with the same seed are byte-identical, which is the correct test.
- DR `dist` was rebuilt 2026-08-31 19:53 (fresh deterministic build).

### 2.2 Adapter inertness — VERIFIED in source

DR `src/engine/world.ts` `step()` switch handles only:
`discharge`, `lab_result`, `rad_result`, `ed_discharge`, `surgery_done`.

The macro packet's actionable fields are **silently dropped**:
- `admission_surge` — no handler
- `staff_shortage` — no handler
- 3 of 5 `MacroConditionPacket` fields are never read anywhere in DR

Consequence: the KE intervention (emissions_control → climate events → macro packet)
does **not** change DR behavior. The macro→micro channel is inert.

### 2.3 P-004 rerun against the fresh deterministic dist (committed `9ca3ea0`)

- 30 seeds (42..71), 20 ticks, matched-horizon + baseline-integrity guards
- **199 metrics, 6 significant uncorrected, 0 BH-FDR, 0 Bonferroni, 0 DR-specific significant**
- All 6 uncorrected survivors are macro-sector tiny-variance artifacts:
  - `nations.GBR.inflationRate` d=−47.12
  - `nations.IND.rdSpending` d=43.53
  - `nations.IDN.rdSpending` d=33.10
  - `nations.IND.patents` d=−21.07
  - `marketIndex` d=−11.72
  - `nations.JPN.gdpGrowthRate` d=−9.92
- **None are hospital (DR) effects.**
- DR pre-specified primary outcomes:
  - `cssd-cycles`: meanΔ=0.0000, observed 0/2 paths (degenerate)
  - `dialysis-sessions`: meanΔ=4.0000, observed 2/2 paths
  - `occupancy`: meanΔ=0.0300, observed 2/2 paths
- The nonzero DR deltas (dialysis +4.0, occupancy +0.03) are **rewind-restore
  artifacts**, not intervention effects: the adapter is inert, so the intervention
  cannot reach DR; the residual deltas come from imperfect rewind/restore of the
  DR world object (module-global counters, closure state), not from the intervention.
- Repository tree clean after reproduction.

### 2.4 KE-side P-004 experiment hardcodes worldSeed=42

`src/experiment/experiments/dr-counterfactual.ts:113`:
`deersRockAdapter({ ...SENTINEL }, 42)`.

With the deterministic DR build, all 30 seeds produce identical DR state
(worldSeed fixed at 42), so every DR metric has d=0 (degenerate) — the experiment
cannot demonstrate macro→micro coupling even in principle.

---

## 3. Why this is a blocker (not a Kronos-side failure)

The task's Phase 2 §6 gate requires:

| Gate item | Status |
|-----------|--------|
| P-004 executes successfully | ✅ |
| Repeated execution reproduces same results | ✅ (deterministic) |
| DR RNG demonstrably deterministic | ✅ (proven cross-process) |
| Adapter boundary remains intact | ✅ (DR never reads macro state directly) |
| No hidden stochastic source unidentified | ✅ |
| Statistical outputs reproducible | ✅ |
| Repository tree clean after reproduction | ✅ |

However, the **scientific meaning** of P-004 is null: the intervention has no effect
on DR because the adapter is inert. Reproducing a null result is not the same as
demonstrating the claimed macro→micro coupling. The task explicitly forbids
weakening the reproducibility claim to make the phase pass.

---

## 4. Options (require authorization per rule 12)

### Option A — Implement the DR adapter consumption path (real fix)
- Add DR handlers for `admission_surge` / `staff_shortage` in
  `Deers-Rock/src/engine/world.ts` `step()` switch.
- Wire the 3 dead `MacroConditionPacket` fields (e.g., real `diseasePrevalence` source).
- Rebuild DR `dist`.
- Fix KE `dr-counterfactual.ts:113` to derive per-seed worldSeed
  (`worldSeed ^ (hospitalId * 2654435761) >>> 0` or documented equivalent).
- Re-run P-004 with the corrected stats pipeline.
- **Scope:** real code change in the external Deers-Rock repo. Requires authorization.

### Option B — Narrow the claim (DR audit recommendation (a))
- Report P-004 as a **negative/exploratory result**: the pipeline is deterministic
  and reproducible, but the macro→micro channel is inert, so no coupling effect can
  be attributed.
- Proceed to Phase 3 with the architectural claim + P-004 as negative result.
- **Scope:** no external-repo changes; paper framing changes only.

---

## 5. Recorded decision

**Pending human authorization.** Per governance rule 12, Phase 2 is not passed and
Phase 3 must not begin until the reason (this document) and authorization are recorded.

---

## 6. Related evidence

- DR-side reopening audit: `C:\Users\think\Project_v2\Deers-Rock\reopen-audit\`
  (01 executive summary, 03 boundary compliance matrix, 05 statistical reassessment,
  README-REPRODUCIBILITY) — independently reached the same conclusion.
- QMS: NCR-2026-006 / VER-2026-004 (parallel DR-side audit).
- KE audit: `docs/audits/REOPEN-AUDIT-2026-08-31.md`.
- P-004 artifacts: `experiment-results/dr-counterfactual/p004-30seeds-summary.json`
  (199 metrics, 6 sig uncorrected, 0 FDR, 0 Bonferroni).