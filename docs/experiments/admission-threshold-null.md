# Admission-Multiplier Threshold — Negative Result Record

**Task:** Candidate #3 (Admission-Multiplier Threshold)
**Date:** 2026-09-10
**Status:** NEGATIVE RESULT (documented, not forced)
**Classification:** EXPLORATORY — NON-CANONICAL
**Companion:** `admission-threshold-design.md`

---

## 1. Reachable Multiplier Set

Through the existing KE→adapter pathway, the transmitted multiplier is:

```
m = 1.0 + 0.3·w + 0.2·k      (w ∈ {0,1} weather events; k ≥ 0 coincident WAR_START events)
```

Reachable set (with per-tick probability, era RP-CONTEMP-002, 5 low-relation nations, p=0.02):

| m | (w,k) | P per tick | Practical |
|---|---|---|---|
| 1.0 | (0,0) | 0.904 | common |
| 1.2 | (0,1) | 0.092 | common |
| 1.3 | (1,0) | ~0.5 | common |
| 1.4 | (0,2) | 0.0038 | rare |
| **1.5** | **(1,1)** | **~0.046** | **common (first active)** |
| 1.6 | (0,3) | 8.0×10⁻⁵ | very rare |
| 1.7 | (1,2) | ~0.0019 | rare |
| 1.8 | (0,4) | 8.0×10⁻⁷ | negligible |
| 1.9 | (1,3) | ~4.0×10⁻⁵ | very rare |
| 2.0 | (0,5) | 3.2×10⁻⁹ | negligible |
| 2.1 | (1,4) | ~4.0×10⁻⁷ | negligible |

Empirically observed in the Vultr exploratory study: **{1.0, 1.2, 1.3, 1.5}**.

---

## 2. Effective Receiver Threshold

DR integer admission: `toAdmit = min(beds, max(1, floor(baseAdmit × m)))`, `baseAdmit = floor(rng()×3) ∈ {0,1,2}`.

| baseAdmit | first m that changes the count |
|---|---|
| 0 | never (max(1,·) dominates) |
| 1 | 2.0 |
| 2 | 1.5 |

- **First change of any admission count:** `m = 1.5` (baseAdmit=2 only; ≈1/3 of ticks).
- **Reliable change (both nonzero base-admit states):** `m ≥ 2.0`.

---

## 3. Why the Reliable Threshold Is Unreachable

Reaching `m ≥ 2.0` requires either:
- `k ≥ 5` simultaneous `WAR_START`s with no weather (m = 2.0), or
- `k ≥ 4` with a weather event (m = 2.1).

With only 5 low-relation nations and per-nation start probability 0.02, `P(k≥5) = 3.2×10⁻⁹` per tick; `P(k≥4) ≈ 8.0×10⁻⁷` per tick. Combined with the weather draw (~0.5), the probability of any `m ≥ 2.0` is ≈10⁻⁷–10⁻⁵ per 20-tick run — **effectively unreachable**.

Geopolitics *can* in principle emit multiple `WAR_START`s per tick (it loops over all nations, geopolitics.ts:231-260), so `m ≥ 2.0` is not mathematically impossible — it is astronomically improbable.

---

## 4. Why a Clean Paired Experiment Is Not Definable

The task's ideal design requires holding constant seed, initial world, patient population, event timing, event type, horizon, and DR config, while varying only the multiplier.

This is **not achievable through the existing KE pathway**, because:
1. The multiplier is an **emergent sum** of stochastic endogenous events (`w` from climate, `k` from geopolitics).
2. Any KE-level change that alters `w` or `k` also alters the event stream — and therefore the geopolitics/economy state, the DR event queue, and the DR RNG trajectory.
3. `baseAdmit` is a DR RNG draw coupled to the shared world RNG, so it cannot be held constant across arms either.

There is no existing configuration knob that sets the admission multiplier directly.

---

## 5. Architectural vs Model-Specific

| Aspect | Nature |
|---|---|
| Multiplier reachable range (≤1.5 practical) | **Architectural** — fixed by the adapter's +0.3/+0.2 semantic contract and the ≤1 weather draw/tick |
| Integer-admission sensitivity (1.5 / 2.0 thresholds) | **Model-specific** — DR `markov.ts` quantization |
| Sticky multiplier (no reset) | **Model-specific** — DR `world.ts` admission_surge handler |
| Multi-warp-per-tick possibility | **Architectural** — geopolitics loops over nations |

The interface mismatch is therefore **both**: the adapter's semantic range is narrow (architectural), and the receiver's quantization is coarse (model-specific). Their combination leaves only a partial overlap at `m = 1.5`.

---

## 6. Would a Future Experiment Require a Deliberate Adapter/Model Change?

To make a *clean* threshold experiment possible, one of the following would be required:

1. **Receiver-level entry** (enter at the adapter boundary): feed controlled pending-event sets through the unmodified `buildMacroPacket` and unmodified adapter→DR path. No model change, but bypasses KE event *generation*.
2. **An adapter/model change** (e.g. a larger or directly-settable multiplier): this would **constitute a new scientific intervention**, not a validation of the current architecture. It is explicitly out of scope.

Option 1 does not modify the model but changes the experimental entry point; option 2 does modify the model. Neither is a validation of the *current* full pathway under isolation.

---

## 7. Statement

> The current KE→DR interface can transmit a semantically valid admission perturbation (reachable range ≈ {1.0, 1.2, 1.3, 1.5}), but the reachable multiplier range does not reliably cross the receiving model's effective integer-admission sensitivity threshold (m ≥ 2.0) under the tested base-admission conditions. The first partial crossing (m = 1.5, baseAdmit=2) is reachable but cannot be isolated in a clean paired experiment through the existing pathway.

This is a clean negative result: it characterizes the semantic-transmission-vs-receiver-sensitivity mismatch without forcing the model to produce an effect.

---

## 8. No-Go Compliance

- No model/code change.
- No new multiplier, no adapter remapping, no DR admission/flooring change, no capacity/discharge/patient changes, no artificial admissions, no outcome injection.
- No manuscript/QMS/Phase-F modification.
- No experiment run (design-only task).
