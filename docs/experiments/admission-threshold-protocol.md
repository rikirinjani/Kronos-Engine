# Admission-Threshold Boundary — Frozen Execution Protocol

**Protocol ID:** ADMISSION-THRESHOLD-BOUNDARY-2026-09-10
**Status:** FROZEN (execution pending a separate go/no-go decision)
**Classification:** EXPLORATORY — NON-CANONICAL
**Companion:** `admission-threshold-redesign.md`

> This protocol is an **interface/receiver-sensitivity characterization**. It is **NOT** an end-to-end macro→micro causal experiment. It must never be reported as one.

---

## 1. Question

Given a transmitted admission multiplier at the semantic adapter boundary, how does the unmodified DR admission pathway respond to `m=1.3` versus `m=1.5` (both naturally emitted by the current adapter)?

## 2. Design (fixed)

- **Arms:** control `m=1.3`; intervention `m=1.5`.
- **Packet construction (preserves the real adapter mapping):**
  - control: `buildMacroPacket([{ type: "climate.extreme_weather", data: {} }], t)` → `admissionMultiplier = 1.3`
  - intervention: `buildMacroPacket([{ type: "climate.extreme_weather", data: {} }, { type: "geopolitics.war_start", data: {} }], t)` → `admissionMultiplier = 1.5`
  - (Use the real exported `buildMacroPacket`; do not reimplement.)
- **Receiver:** create a DR world via the same constructor the adapter uses (`createWorld(config.patients, undefined, hospitalSeed)`), with `beds=133, patients=50`. **Identical seed per arm pair.**
- **Loop:** for `t = 1..20` KE ticks:
  1. schedule the real `admission_surge` event with the arm's multiplier: `world.queue.schedule("admission_surge", 0, { multiplier: m })`;
  2. step DR `ticksPerDay = 10` times.
- **Only the multiplier differs between arms.** Same seed ⇒ identical `baseAdmit` draw sequence.

## 3. Excluded (binding)

- `m = 2.0` (or any value not naturally reachable) — excluded as a hypothetical input.
- KE sector execution — bypassed by design (this is a receiver-boundary test).
- Any modification to DR, KE, adapter, flooring, capacity, discharge, patient generation.
- Mortality as an outcome (discharge is structurally closed at this horizon).
- Horizon extension beyond 20 KE ticks.

## 4. Outcomes (fixed)

- **Primary:** cumulative inpatient admission count; per-tick admission count.
- **Secondary:** occupancy rate; ICU occupancy rate.
- **Recorded for verification:** delivered `_admissionMultiplier`, `baseAdmit` if instrumentable, computed `toAdmit`.

## 5. Seeds

- `SEEDS = [42,43,44,45,46,47,48,49]` (8 seeds). Same DR seed used for both arms of each pair.
- No seed may be added or removed after execution begins.

## 6. Analysis (fixed)

- Deterministic prediction: `toAdmit = min(beds, max(1, floor(baseAdmit × m)))`. Because `baseAdmit` is identical across arms, arms differ **exactly** on ticks where `baseAdmit = 2` (m 1.3→2, 1.5→3).
- Report per seed: number of differing ticks, total admission difference, occupancy difference.
- Report aggregate: mean admission difference, range.
- **Descriptive only. No p-values, no significance tests.**

## 7. Reproducibility metadata (required)

experiment ID; KE SHA; DR SHA; seed; multiplier; event source; horizon; ticksPerDay; platform; OS; Node; arch; execution duration; result hash; `exploratory: true`.

## 8. Expected result (stated in advance)

The experiment is expected to **confirm the analytic threshold**: an admission-count difference appears only on `baseAdmit=2` ticks, yielding ≈+0.333 admissions/tick (≈+6.7 over 20 ticks) for `m=1.5` vs `m=1.3`, and a small occupancy difference. Any deviation from this prediction is the scientifically interesting outcome (e.g., an unforeseen coupling).

## 9. Stop conditions

Stop and report if: the receiver produces an admission difference on ticks where `baseAdmit ≠ 2`; the two arms' `baseAdmit` sequences are not identical; or any DR/KE behaviour appears to have changed.

## 10. Reporting

- All outputs labelled **EXPLORATORY — NON-CANONICAL**.
- The report must state: (a) this is a receiver-sensitivity characterization, not causal; (b) the result is largely confirmatory of the analytic threshold; (c) KE event generation was bypassed.
- A canonical Mac experiment, if ever warranted, must be separately designed and frozen.
