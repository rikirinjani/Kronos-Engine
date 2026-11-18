# Admission-Threshold Boundary — Results

**Experiment ID:** ADMISSION-THRESHOLD-BOUNDARY-2026-09-10
**Protocol:** `docs/experiments/admission-threshold-protocol.md`
**Date:** 2026-09-10
**Classification:** EXPLORATORY — NON-CANONICAL

> This is a **receiver/interface-sensitivity characterization**. It is **not** a macro→micro causal experiment and must never be described as one.

---

## 1. Scientific Question

Given two naturally reachable admission multipliers, does the unchanged DR admission model respond differently when the transmitted multiplier crosses its first effective quantization boundary? Frozen comparison: **control m=1.3** vs **intervention m=1.5**. Primary endpoint: **admission count**.

---

## 2. Frozen Protocol Reference

Executed exactly per `docs/experiments/admission-threshold-protocol.md`:
- Fresh DR world per arm, identical seed per pair.
- Enter through the existing `admission_surge` → `_admissionMultiplier` → `admissionHandler` → `toAdmit` path.
- 20 KE ticks × `ticksPerDay=10` = 200 DR ticks.
- Only the transmitted multiplier differs.

---

## 3. Commits

| Repo | SHA |
|---|---|
| Kronos Engine | `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` |
| Deers-Rock | `5884ba39729768693bb91dfd796d8fe2e246ea68` |

Runner: `src/experiment/experiments/admission-threshold-runner.ts` (new file; no model modification). A read-only RNG wrapper recorded draw counts and the first draw per DR tick without altering the draw sequence.

---

## 4. Compute Environment

| Property | Value |
|---|---|
| VPS | Vultr `45.32.122.6` (Somnium) |
| OS / arch | Ubuntu 26.04, x64 |
| Node | v22.23.2 |
| Runtime | **8.17 s** |
| Est. cost | ≈ **$0.00003** |

---

## 5. Seeds

`[42, 43, 44, 45, 46, 47, 48, 49]` (8 seeds, as frozen).

## 6. Control / Intervention Configuration

| Parameter | Value |
|---|---|
| control multiplier | 1.3 |
| intervention multiplier | 1.5 |
| beds | 133 |
| patients (initial) | 50 |
| KE ticks | 20 |
| ticksPerDay | 10 |
| DR seed | identical per pair |

## 7. Pairing Method

Fresh-world paired execution: for each seed, a fresh DR world is created for each arm with the same seed; the arms are stepped in lockstep for 200 DR ticks with the same `admission_surge` schedule, differing only in the multiplier value.

---

## 8. Invariant Checks

| Check | Result |
|---|---|
| Same seed per pair | ✅ |
| Same initial state | ✅ (identical rows until first divergence) |
| Same code / parameters | ✅ (only multiplier differs) |
| Identical admissions before first divergence | ✅ all 8 seeds |
| Identical RNG draw counts before first divergence | ✅ (e.g. seed 42: 0 diff through tick 3) |
| Same `baseAdmit` sequence **across the full horizon** | ❌ **fails after the first divergence** |

**The multiplier is the only changed input.** The arms are identical until the first quantization tick; all subsequent divergence is a *downstream consequence* of that one-input change, not an independent confound. The "same `baseAdmit` sequence" sub-check cannot hold beyond the first divergence — see §10 for the traced reason.

---

## 9. Per-Seed Results

| Seed | First divergence (DR tick) | Control admissions | Intervention admissions | Δ | N(baseAdmit=2, control) | Δ vs N |
|---|---|---|---|---|---|---|
| 42 | 4 | 74 | 68 | −6 | 59 | ✗ |
| 43 | 1 | 65 | 77 | +12 | 72 | ✗ |
| 44 | 1 | 65 | 73 | +8 | 73 | ✗ |
| 45 | 8 | 71 | 77 | +6 | 66 | ✗ |
| 46 | 2 | 65 | 69 | +4 | 67 | ✗ |
| 47 | 4 | 79 | 68 | −11 | 67 | ✗ |
| 48 | 1 | 64 | 75 | +11 | 67 | ✗ |
| 49 | 3 | 69 | 76 | +7 | 67 | ✗ |

**Threshold confirmation (clean, robust):** at every seed's first divergence tick, the arms are still RNG-synced and share the same `baseAdmit = 2`; the control admits **2** and the intervention admits **3**. This is exactly `floor(2×1.3)=2` vs `floor(2×1.5)=3`. The quantization boundary is observed precisely as predicted.

**Cumulative Δ:** mean ≈ +3.9, range −11…+12 — small and sign-unstable.

---

## 10. Admission-Count Reconciliation

**Result: the simple reconciliation `Δadmissions = N(baseAdmit=2)` does NOT hold.** This was diagnosed in the implementation, not guessed.

### Traced reason 1 — RNG-stream desynchronization (primary)

The DR clock RNG is a single stateful Mulberry32 stream (`clock.ts:6-18`), persisted across ticks via `tick(world.clock)` (a spread that preserves the `rng` closure). Inside the admission loop, each admitted patient consumes a `clock.rng()` draw for `dischargeDelay` (`markov.ts:104`). Therefore:

- On a `baseAdmit=2` tick, control performs **2** admission-loop iterations, intervention **3** → one extra `clock.rng()` draw.
- That single extra draw shifts the entire subsequent RNG stream. Every downstream handler that draws RNG now produces different values, so the arms diverge permanently.
- The divergence compounds: seed 42's per-tick draw count is identical through tick 3, then +4 (tick 4), +8, +16, +18, +27, +37, +49 by tick 10; over the full run the arms differ by **thousands** of draws (e.g. seed 43: 146,515 vs 160,177).

Consequently, after the first divergence the two arms no longer share a `baseAdmit` sequence, so the cumulative admission difference is a random walk rather than a count of `baseAdmit=2` ticks.

### Traced reason 2 — patient-pool saturation

Total admissions are **64–79**, far below the naive per-tick expectation (~267 control / ~333 intervention). The initial patient pool (50) plus `newPatientHandler` arrivals (~20–30 over the run) is admitted almost entirely by both arms. Both arms therefore approach the same total (pool size), compressing the cumulative Δ and making it sign-unstable. This saturation independently prevents `Δ = N(baseAdmit=2)` from holding even if the RNG had stayed synced.

### Reconciliation verdict

The exact reconciliation holds **only up to the first divergence** (where it is trivially exact: Δ=0 before, Δ=+1 at the first `baseAdmit=2` tick). Beyond it, the receiver's own RNG coupling makes the cumulative form invalid.

---

## 11. Secondary Outcomes

Occupancy rose monotonically in both arms (e.g. seed 42: 0.0075 → 0.53), reflecting admission accumulation with discharge structurally closed. Occupancy differences track the admission differences (§9) and are not independent evidence. Mortality was **not** a meaningful outcome (discharge delay 4320–10080 DR ticks ≫ 200-tick horizon). No secondary outcome was promoted to primary.

---

## 12. Compute Cost

8.17 s wall; ≈ $0.00003. Compute was not a constraint.

---

## 13. Interpretation

1. **The receiver quantization boundary is real and observed exactly as predicted.** The first divergence occurs on the first `baseAdmit=2` tick, with `toAdmit` 2→3.
2. **The simple cumulative reconciliation is invalid** because the receiver's stateful RNG desyncs after the first quantization difference (the extra admission consumes an extra draw), and because the patient pool saturates.
3. **This is a receiver/interface characterization.** It says nothing about whether an upstream macro intervention produces a clinical effect. It does not establish macro→micro causality.
4. The result is **largely confirmatory** of the analytic threshold; the novel content is the implementation-level desync/saturation finding.

---

## 14. Canonical-Evidence Status

**EXPLORATORY — NON-CANONICAL.** Not manuscript evidence. The canonical Phase F result (Mac, VER-2026-019) is unaffected. The integer quantization and the RNG-desync mechanism are deterministic and platform-independent; the exploratory result is not expected to differ on Mac.

---

## 15. Limitations

- Receiver-boundary design: KE event generation was bypassed by construction (only the adapter→DR leg is exercised).
- Patient-pool saturation compresses the cumulative signal.
- RNG desync prevents a clean cumulative reconciliation; only the first-divergence event is exactly reconcilable.
- 8 seeds; descriptive only; no statistical inference.
- Not a causal experiment; no clinical or policy inference.

---

## 16. Final Verdict

### CONFIRMED WITH DISCREPANCY

The threshold response **is** observed: in all 8 seeds the arms are identical until the first `baseAdmit=2` tick, at which point the intervention admits exactly one more patient (2→3) — precisely the predicted quantization crossing. The **cumulative** reconciliation `Δadmissions = N(baseAdmit=2)` does **not** hold, and the implementation-level reasons are traced: (i) the receiver's stateful RNG desynchronizes after the first extra admission (compounding to thousands of draws), and (ii) the patient pool saturates so both arms admit nearly all available patients.

This is not a FAILED INVARIANT: the multiplier is the only changed input; all divergence is downstream of it.

---

## Canonical Follow-Up Gate

> Does this exploratory boundary experiment produce evidence worth freezing as a canonical Mac experiment?

### NO — SCIENTIFIC VALUE TOO LIMITED

The receiver's admission sensitivity is analytically determined (`floor(baseAdmit × m)`) and was confirmed by a deterministic, platform-independent mechanism. The experiment's only novel output is an implementation-level artifact (RNG desync + pool saturation), which a Mac run would reproduce identically without adding scientific value. This experiment also cannot establish a macro→clinical causal effect by construction. A canonical Mac experiment is therefore not justified.

---

## Scope Compliance

No Phase F, manuscript, QMS, protocol, admission logic, adapter, DR, or KE source modification. Only a runner and results artifacts were added.
