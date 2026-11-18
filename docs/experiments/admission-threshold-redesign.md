# Admission Threshold — Redesign Decision

**Task:** Admission-Threshold Redesign Decision (Candidate #3, round 2)
**Date:** 2026-09-10
**Status:** DESIGN DECISION (no experiment run)
**Classification:** EXPLORATORY — NON-CANONICAL
**Boundary:** No model/code/manuscript/QMS/Phase-F modification. Design decision only.

---

## 1. Problem Statement

The feasibility pass established:
- `m = 1.0 + 0.3·w + 0.2·k` (w∈{0,1} weather; k = coincident `WAR_START`s).
- `toAdmit = min(beds, max(1, floor(baseAdmit × m)))`, `baseAdmit = floor(rng()×3) ∈ {0,1,2}`.
- First integer-admission change at `m=1.5` (baseAdmit=2 only); reliable change at `m≥2.0`.
- `m=1.5` is naturally reachable; `m≥2.0` is effectively unreachable endogenously.
- No clean paired experiment through the **full** KE pathway, because the multiplier is an emergent sum of stochastic endogenous events.

The central question now: **Can we experimentally isolate the receiver's admission-quantization sensitivity while preserving a scientifically meaningful relationship to the existing KE→adapter→DR architecture?**

We must keep three questions separate:
- **A (endogenous):** does the KE event system naturally produce a perturbation large enough to cross DR quantization?
- **B (interface/receiver):** given a transmitted multiplier at the adapter boundary, how does DR respond?
- **C (end-to-end causal):** does an upstream macro intervention produce sustained downstream response? (Phase F addressed C; found weak/stochastic propagation.)

---

## 2. Existing Architecture (facts)

- `_admissionMultiplier` has **one writer** (DR `world.ts:290-293`, `admission_surge`), fed solely by the adapter (`deers-rock-adapter.ts:291-293`).
- The multiplier is **sticky** (never reset by a no-event tick).
- Climate emits ≤1 `EXTREME_WEATHER`/tick; geopolitics can emit multiple `WAR_START`s/tick.
- Reachable multiplier set in practice: **{1.0, 1.2, 1.3, 1.5}** (1.4/1.6/1.7 rare; ≥2.0 negligible).
- Era RP-CONTEMP-002: 11 nations, 5 with a relation `< -60`; P(`WAR_START`)/tick = 0.10.

---

## 3. Threshold Mathematics

| baseAdmit | first m that changes count | note |
|---|---|---|
| 0 | never | `max(1,0)=1` for all m |
| 1 | **2.0** | 1→2 |
| 2 | **1.5** | 2→3 |

Expected admissions/tick (baseAdmit uniform, beds/patients available):
- `m∈[1.0,1.5)`: 1.333 (inert)
- `m∈[1.5,2.0)`: 1.667 (**+25%**)
- `m∈[2.0,2.5)`: 2.333 (+75%)

The threshold is **base-admit dependent**; there is no universal sub-2.0 threshold.

---

## 4. Boundary Intervention Analysis

**Proposed design (B):** hold the entire KE world identical (same seed); at the adapter boundary, deliver a **deliberately specified multiplier** to DR. The receiver is unchanged.

Two variants:

**Variant 1 — imposed scalar.** The KE world runs normally (events generate); the target sentinel's transmitted `admissionMultiplier` is set to a controlled constant (control 1.3; intervention 1.5) before the `admission_surge` event is scheduled. DR receives the imposed value.

**Variant 2 — constructed packet.** The real `buildMacroPacket` is called with controlled event sets (weather-only → 1.3; weather+`WAR_START` → 1.5), and the resulting packet is fed through the real adapter→DR scheduling path. KE sector execution is bypassed.

Both use **naturally reachable** multiplier values (1.3 and 1.5 are both emitted by the current adapter). Neither modifies DR.

**What is preserved:** DR admission logic, integer quantization, downstream hospital dynamics, receiver independence, the `admission_surge` interface event shape, and (Variant 1) KE event generation.

**What is bypassed:** the *endogenous determination* of the multiplier — i.e., the weather/war stochastic coincidence that would naturally set it (Variant 1); and KE sector execution entirely (Variant 2). Neither variant establishes macro intervention causality.

**Rejected:** any design using `m=2.0`. Because `m≥2.0` is effectively unreachable endogenously, imposing it would test a **hypothetical input the current architecture cannot naturally produce** — artificial input injection. The legitimate boundary experiment is restricted to **{1.3, 1.5}**.

---

## 5. Observational Design Analysis

**Design (O):** run the system unchanged; record per tick `(w, k, m, baseAdmit, toAdmit, admissions, occupancy)`; estimate the threshold from natural variation around m ∈ {1.0, 1.2, 1.3, 1.5}.

Findings:
- **The multiplier is sticky**, so `m=1.0` occurs only before the first event; the sequence is a monotone step function. Natural variation is limited to a few transitions per run.
- **Confounding is severe:** `m=1.5` requires a coincident war+weather, which *independently* changes geopolitics/economy/DR state (staff shortage, supply pressure, active disaster). Ticks with m=1.5 are not otherwise comparable to m=1.3 ticks.
- **`baseAdmit` is not independent of events:** it is drawn from the DR RNG, which is coupled to the shared world RNG that events consume. So the "independent variable" (m) is correlated with the residual.
- **Sample size:** m=1.5 occurs ≈0.9 times per 20-tick run ⇒ ~35 seeds for ~30 m=1.5 ticks; but the confounds remain.
- **Cost:** long-horizon runs are superlinear (discharge queue growth), so more seeds × longer horizons is expensive.

**Verdict:** the observational design cannot identify the threshold with acceptable confounding. It confuses A/B/C.

---

## 6. Preservation / Bypass Analysis

| Component | Boundary (V1) | Boundary (V2) | Observational |
|---|---|---|---|
| DR admission logic / quantization | preserved | preserved | preserved |
| Downstream hospital dynamics | preserved | preserved | preserved |
| Adapter semantic mapping (events→m) | bypassed (scalar imposed) | preserved | preserved |
| KE event generation | preserved | bypassed | preserved |
| Macro causal pathway | not tested | not tested | preserved but confounded |
| Endogenous event coincidence | bypassed | bypassed | preserved |

---

## 7. m = 1.5 Analysis

- `baseAdmit` is Uniform{0,1,2}; **P(baseAdmit=2) = 1/3**.
- At `m=1.5`, `toAdmit = 3` on those ticks (vs 2 at m=1.3): **+1 admission on ≈1/3 of ticks**.
- Expected extra admissions ≈ **0.333/tick** ⇒ **≈+6.7 over a 20-tick horizon**.
- With 133 beds this is ≈+5% occupancy — observable, and not requiring artificial manipulation beyond the boundary multiplier itself.
- Because the multiplier is sticky, a naturally-occurring 1.5 persists for the remainder of the horizon, so the natural effect can be larger than a single-tick estimate — but it remains confounded by the war/weather that caused it.
- **m=1.5 is therefore not "inert":** it is the unique naturally-reachable value that crosses DR's first sensitivity boundary, on 1/3 of ticks.

---

## 8. Horizon Analysis

- **Primary endpoint should be admission count / `toAdmit`, not occupancy or mortality.**
  - `toAdmit` is the clean receiver-sensitivity endpoint; it is affected the moment the multiplier changes.
  - Occupancy accumulates mechanically (≈+6.7 admissions over 20 ticks) but adds no new information about the *threshold*.
  - **Mortality is not meaningful**: it requires discharge (markov.ts:111-150), which is structurally closed at a 20-tick horizon (discharge delay 4320–10080 DR ticks).
- **Minimum horizon:** 20 KE ticks (Phase F horizon) is sufficient to accumulate and observe the admission-count difference.
- **Do not extend the horizon:** DR cost is superlinear because scheduled discharges accumulate in the queue (Vultr finding). Extending the horizon is analytically unnecessary.

---

## 9. Design Comparison Table

| Property | Boundary experiment | Endogenous observational |
|---|---|---|
| Receiver sensitivity isolated | **Yes (clean)** | No (confounded) |
| KE event generation preserved | V1 yes / V2 no | Yes |
| Macro intervention preserved | No | Partially (confounded) |
| Controlled comparison | **Yes** (same DR seed → identical `baseAdmit`) | No |
| Confounding | **Low** | High (war/weather co-move with m) |
| Computational cost | **Very low** (<1 min) | Higher (many seeds × horizon) |
| Scientific interpretation | Interface/receiver characterization (B) | Ambiguous (A/B/C conflated) |
| Relation to Phase F | Orthogonal / complementary | Redundant-ish (re-runs C) |
| Risk of artificial positive result | Moderate (mitigated by using only reachable values) | Low but result uninterpretable |
| Suitable for canonical follow-up | **Yes** (clean, reproducible) | No |

**Decision:** the boundary experiment (Variant 1) is the only design with acceptable identifiability.

---

## 10. Relationship to Phase F

- Phase F answered **C**: an upstream macro intervention (CO₂) produces only weak/stochastic downstream hospital response.
- This experiment answers **B**: given a multiplier at the adapter boundary, how does the receiver respond?
- It is therefore primarily **orthogonal** (a distinct interface-level question) and secondarily **complementary** (it diagnoses the receiver-side quantization that Phase F's null result could not isolate).
- It is **not redundant**: it does not re-run Phase F with different inputs; it removes the endogenous gate entirely to characterize the receiver.
- It must **never** be presented as an end-to-end macro→micro causal experiment.

---

## 11. Scientific Risks

1. **Artificial-positive framing.** Imposing a higher multiplier to obtain more admissions can be misread as manufacturing an effect. Mitigation: frame strictly as *interface sensitivity characterization*; report the deterministic `toAdmit` arithmetic as the primary result; treat occupancy as a downstream consequence, not an "effect."
2. **Hypothetical-input risk.** Only {1.3, 1.5} are admissible (both naturally emitted). Any use of 2.0 is rejected.
3. **Confirmatory risk.** The threshold arithmetic is analytically known; the experiment confirms it and measures downstream survival. This is characterization, not discovery — the report must say so.
4. **Overclaiming causality.** Bypassing the endogenous gate means no macro-causal claim is permitted.

---

## 12. Compute Implications

| Design | Configs × seeds | Est. wall | Est. cost |
|---|---|---|---|
| Boundary (V1), 1.3 vs 1.5 | 2 × 8 | <1 min | <$0.001 |

Trivial. Compute is not a constraint. All results would remain **EXPLORATORY — NON-CANONICAL**; a canonical Mac run would be separately frozen.

---

## 13. Final Decision

### FREEZE BOUNDARY PROTOCOL

A boundary-level receiver experiment is scientifically legitimate and provides a clearly defined question not answered by Phase F:

- It uses only **naturally reachable** multiplier values (1.3 and 1.5), so it is not testing a hypothetical input.
- It holds the entire KE world constant and varies **only** the transmitted multiplier, giving a clean, deterministic comparison of the receiver's response.
- It leaves DR entirely unchanged.
- It answers an **interface-level question (B)** distinct from Phase F's macro-causal question (C).

**Scope conditions (binding on any execution):**
1. The experiment is an **interface/receiver-sensitivity characterization** — never an end-to-end causal experiment.
2. Only multipliers **1.3 (control)** and **1.5 (intervention)** are admissible. `m=2.0` is explicitly excluded as a hypothetical input.
3. Primary outcome is **`toAdmit` / admission count**; occupancy is secondary; mortality is excluded (discharge closed).
4. Horizon is 20 KE ticks.
5. The result is expected to be largely confirmatory of the analytic threshold; the report must state this.

A frozen execution protocol is provided in `admission-threshold-protocol.md`.

The **observational design is rejected** (confounded, uninterpretable).

**Scientific question that remains unanswered** (out of scope for this experiment): whether the *endogenous* KE system can ever transmit a perturbation large enough to overcome DR quantization — the feasibility analysis shows this is effectively impossible (`m≥2.0` unreachable), which is itself the answer to question A.
