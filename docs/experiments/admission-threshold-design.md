# Admission-Multiplier Threshold — Feasibility & Design

**Task:** Candidate #3 (Admission-Multiplier Threshold) — feasibility, experiment design, freeze decision
**Date:** 2026-09-10
**Status:** DESIGN / FEASIBILITY (no experiment run)
**Classification:** EXPLORATORY — NON-CANONICAL
**Boundary:** No model/code/manuscript/QMS/Phase-F modification. Design evidence only.

---

## 1. Scientific Question

> At what transmitted admission multiplier does the KE→adapter→DR pathway first produce a different integer admission count, and can that threshold be reached through the existing KE/adapter architecture without modifying the model?

The distinction under test is **semantic transmission capability** (can the adapter transmit a valid perturbation?) versus **receiver mathematical sensitivity** (does the DR integer-admission function actually change?). We are not attempting to manufacture a clinical effect.

---

## 2. Current Implementation Trace

Exact path (KE commit `4d7e412`, DR commit `5884ba3`):

```
KE event (geopolitics WAR_START | climate EXTREME_WEATHER)
  → event bus (same-tick: adapter ticks after geopolitics/climate)
  → adapter buildMacroPacket(pendingEvents)   [deers-rock-adapter.ts:152-193]
  → if admissionMultiplier !== 1.0, schedule "admission_surge" at i===0 of the world tick
                                              [deers-rock-adapter.ts:291-293]
  → DR admission_surge handler sets state._admissionMultiplier = multiplier
                                              [Deers-Rock world.ts:290-293]
  → DR admissionHandler reads state._admissionMultiplier
                                              [Deers-Rock markov.ts:72-74]
  → toAdmit
```

**All multiplier sources (exhaustive):**

| Event | Effect on `admissionMultiplier` | Evidence |
|---|---|---|
| `CLIMATE.EXTREME_WEATHER` | `+= 0.3` (each) | adapter:164-169 |
| `GEOPOLITICS.WAR_START` | `+= 0.2` (each) | adapter:170-175 |
| `GEOPOLITICS.WAR_CASUALTIES` | `supplyChainPressure += 0.1` — **not** multiplier | adapter:176-178 |
| `CLIMATE.TEMP_SHIFT` | diagnosis weight only — **not** multiplier | adapter:179-181 |
| (no event) | stays `1.0` | adapter:156 |

- **Only one writer** of `_admissionMultiplier` exists in DR: the `admission_surge` handler (world.ts:292). It is otherwise only initialised to `1.0` (state-store.ts:286) and journaled (journal.ts:373).
- **The adapter is the sole producer** of `admission_surge`.

**Per-tick event caps:**
- Climate draws **at most one** `EXTREME_WEATHER` per world tick (single `if (rng.next() < eventChance)`, climate.ts:150-169). ⇒ `w ∈ {0,1}`.
- Geopolitics **loops over all nations** and can emit **multiple `WAR_START`s in one tick** (geopolitics.ts:231-260), one per nation with `hasLowRelation && rng.next() < 0.02`.

**Sticky-multiplier finding (important):** the adapter schedules `admission_surge` **only when the packet multiplier ≠ 1.0** (adapter:291). DR never resets `_admissionMultiplier` on a no-event tick. Therefore the multiplier is **sticky**: once set to 1.3/1.5, it persists until another `admission_surge` overwrites it. (Confirmed empirically in the Vultr trace: multiplier `1.3` persisted from tick 8 to tick 20 after a single weather event.) This amplifies any supra-threshold value for the remainder of the horizon.

---

## 3. Reachable Multiplier Analysis

Transmitted multiplier: **`m = 1.0 + 0.3·w + 0.2·k`**, where `w ∈ {0,1}` (weather events this tick) and `k ≥ 0` (# `WAR_START` this tick).

Reachable set: `{1.0, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 2.0, 2.1, …}` — **but only if multiple wars start in the same tick.**

**Era RP-CONTEMP-002 facts:** 11 nations; 0 wars at start; **5 nations** have ≥1 relation `< RELATION_THRESHOLD = -60` (USA→PRK −85, USA→IRN −65, RUS→UKR −70, IND→PAK −80, JPN→PRK −80, KOR→PRK −85). Each such nation rolls `rng.next() < 0.02` per tick.

Per-tick probabilities (Binomial(5, 0.02)):

| k (wars/tick) | P(k) | resulting m (w=0) | resulting m (w=1) |
|---|---|---|---|
| 0 | 0.904 | 1.0 | 1.3 |
| 1 | 0.092 | 1.2 | 1.5 |
| 2 | 0.0038 | 1.4 | 1.7 |
| 3 | 8.0×10⁻⁵ | 1.6 | 1.9 |
| 4 | 8.0×10⁻⁷ | 1.8 | 2.1 |
| 5 | 3.2×10⁻⁹ | 2.0 | 2.3 |

- **m = 1.5** (w=1, k=1): P ≈ 0.5 × 0.092 ≈ **0.046/tick** ⇒ ≈0.9 occurrences per 20-tick run. **Reachable** (and observed in the Vultr study).
- **m = 1.7** (w=1, k=2): ≈0.0019/tick.
- **m ≥ 2.0** (k≥5 with w=0, or k≥4 with w=1): P ≈ 4×10⁻⁹ … 4×10⁻⁷ per tick ⇒ **≈10⁻⁷–10⁻⁵ per 20-tick run. Effectively unreachable.**

**Answer to "is 1.5 genuinely the maximum reachable?":** No — 1.6/1.7 are reachable in principle, and 2.0+ is mathematically reachable but astronomically improbable. 1.5 is the maximum *practically* reachable value.

---

## 4. Mathematical Quantization Analysis

DR admission (markov.ts:72-74):
```
baseAdmit   = floor(rng() × 3) ∈ {0,1,2}, uniform
scaledAdmit = floor(baseAdmit × m)
toAdmit     = min(availableBeds, max(1, scaledAdmit))
```

`floor(baseAdmit × m)` changes at the smallest `m` for which `baseAdmit × m` crosses the next integer:

| baseAdmit | condition for change | first m |
|---|---|---|
| 0 | never (`max(1,0)=1` for all m) | — |
| 1 | `m ≥ 2` | **2.0** |
| 2 | `m ≥ 1.5` | **1.5** |

Full table (actual implementation values):

| baseAdmit | m | floor(baseAdmit×m) | toAdmit=max(1,·) | Change vs m=1.0? |
|---:|---:|---:|---:|:--|
| 0 | any | 0 | 1 | no |
| 1 | 1.0 | 1 | 1 | — |
| 1 | 1.2 | 1 | 1 | no |
| 1 | 1.3 | 1 | 1 | no |
| 1 | 1.5 | 1 | 1 | **no** |
| 1 | 1.9 | 1 | 1 | no |
| 1 | 2.0 | 2 | 2 | **YES** |
| 2 | 1.0 | 2 | 2 | — |
| 2 | 1.2 | 2 | 2 | no |
| 2 | 1.3 | 2 | 2 | no |
| 2 | 1.4 | 2 | 2 | no |
| 2 | 1.5 | 3 | 3 | **YES** |
| 2 | 1.9 | 3 | 3 | yes |
| 2 | 2.0 | 4 | 4 | yes |

Expected admissions/tick (baseAdmit uniform, beds/patients available):
- `m ∈ [1.0, 1.5)`: E = (1+1+2)/3 = **1.333** (inert)
- `m ∈ [1.5, 2.0)`: E = (1+1+3)/3 = **1.667** (+25%)
- `m ∈ [2.0, 2.5)`: E = (1+2+4)/3 = **2.333** (+75%)

**Why 1.2 and 1.3 are inert:** for all `baseAdmit ∈ {0,1,2}`, `floor(baseAdmit × 1.3) = baseAdmit` (and `max(1,·)` masks the baseAdmit=0 case). 1.2 and 1.3 lie below the first integer-crossing at `baseAdmit=2` (1.5).

**Is 1.5 always inert?** No. 1.5 is inert for `baseAdmit ∈ {0,1}` but **active for `baseAdmit=2`** (2→3), i.e. on ≈1/3 of ticks.

**First multiplier that reliably changes admission count:** `m = 2.0` (changes both nonzero base-admit states; 2/3 of ticks).

**Threshold is base-admit dependent.** There is no single universal threshold below 2.0.

---

## 5. Base-Admission Dependence

The threshold is explicitly dependent on `baseAdmit`:
- `baseAdmit = 0` → never sensitive to any multiplier (the `max(1, ·)` floor dominates).
- `baseAdmit = 1` → sensitive only at `m ≥ 2.0`.
- `baseAdmit = 2` → sensitive from `m ≥ 1.5`.

Because `baseAdmit` is an independent uniform draw, any realized per-tick admission difference at `m=1.5` occurs on ≈1/3 of ticks, and cannot be isolated from the `baseAdmit` draw within a single run.

---

## 6. Architectural Reachability Result

- The threshold that produces the **first** integer-admission change (`m = 1.5`, baseAdmit=2) **is reachable** through the existing pathway (weather + one coincident `WAR_START`), and was observed in the Vultr exploratory study.
- The **reliable** threshold (`m ≥ 2.0`) is **effectively unreachable** through the existing pathway: it requires ≥5 simultaneous `WAR_START`s (or ≥4 with weather), P ≈ 10⁻⁷–10⁻⁵ per run.

**However**, a *clean paired controlled experiment* isolating the multiplier through the full KE pathway is **not achievable**: the multiplier is an emergent sum of stochastic endogenous events. Any KE-level intervention that changes the multiplier also changes the event stream (and hence geopolitics/economy state and the DR RNG trajectory). It is therefore impossible to hold "seed, initial world, patient population, all unrelated KE state, event timing, event type, horizon, DR config" constant while varying only the multiplier via the KE pathway.

This is the crux: **the threshold is reachable, but it cannot be reached *in isolation* without either (a) entering the pathway at the adapter boundary (packet-level), or (b) changing the model.**

---

## 7. Proposed Control/Intervention (if feasible)

Two candidate designs, neither cleanly freezable as-is:

**Design R (receiver-level, isolates quantization).**
- Control: pending-event set `{EXTREME_WEATHER}` → `buildMacroPacket` → m = 1.3.
- Intervention: pending-event set `{EXTREME_WEATHER, WAR_START}` → `buildMacroPacket` → m = 1.5.
- Both fed through the **unmodified** adapter→DR path into identical DR worlds (same seed, patients, horizon).
- Uses the real semantic adapter function and real DR handler; **no model modification**.
- **Design decision required:** this bypasses KE *event generation* (it enters at the adapter boundary). Acceptable only if the scientific question is explicitly framed as *receiver sensitivity*, not full-pathway propagation.

**Design F (full-pathway, observational).**
- Run many seeds; record every tick's `(m, baseAdmit, toAdmit)` and compare realized admissions on `m=1.3` vs `m=1.5` ticks.
- **Not a paired counterfactual**; confounded by `baseAdmit` and by the event stream. Weak causal identification.

**Design M (model change).** Prohibited by the task; would destroy the intended test.

---

## 8. Primary / Secondary Outcomes

Primary (locate the first surviving point):
1. `toAdmit` (per tick)
2. admission count (per tick / cumulative)
3. occupancy

Secondary:
4. ICU occupancy (only if causally downstream)
5. mortality (only if horizon makes it meaningful — see §9)

---

## 9. Horizon Rationale

- At `ticksPerDay = 10`, occupancy accumulates because discharge (4320–10080 DR ticks) never fires within a 20-tick horizon (200 DR ticks).
- An admission-count difference at `m=1.5` (baseAdmit=2, +1 admission on ≈1/3 of ticks) accumulates into occupancy without needing discharge; ~6–7 extra admissions over 20 ticks at ~1.3 baseline.
- Mortality is **not** meaningful at this horizon: it requires discharge (markov.ts:111-150), which is structurally closed.
- **Do not extend the horizon**: the Vultr study showed DR cost is superlinear in horizon because scheduled discharges accumulate in the queue. The admission difference is observable at the Phase F horizon; extending it is analytically unnecessary.

---

## 10. Compute Estimate

| Design | Configs × seeds | Est. wall | Est. cost |
|---|---|---|---|
| R (receiver-level pilot) | 2 × 8 | <1 min | <$0.001 |
| F (observational) | 1 × 32 | ~2 min | <$0.001 |

Trivial. Compute is not the constraint; **design cleanliness is.**

---

## 11. Reproducibility Requirements

KE SHA `4d7e412…`; DR SHA `5884ba3…`; experiment ID; seed; multiplier value + event source; horizon; platform/OS/Node/arch; execution duration; result hash. All runs labelled **EXPLORATORY — NON-CANONICAL**.

---

## 12. Decision

### REDESIGN

- The threshold is **real and analytically determined**: first integer-admission change at `m = 1.5` (baseAdmit=2); reliable change at `m ≥ 2.0`.
- `m = 1.5` **is reachable** through the existing KE/adapter architecture (weather + coincident `WAR_START`).
- The **reliable** threshold `m ≥ 2.0` is **effectively unreachable** (needs ≥5 simultaneous `WAR_START`s).
- **No clean paired experiment isolating the multiplier through the full KE pathway is definable**, because the multiplier is emergent from stochastic endogenous events; changing it changes the whole event stream. A freezable experiment requires a nontrivial design decision: either (a) a **receiver-level** design entering at the adapter boundary (isolates quantization but bypasses KE event generation), or (b) an observational design with weak identification.

Because the meaningful experiment exists but cannot be frozen without that design decision, the verdict is **REDESIGN**, not FREEZE (no clean existing-pathway experiment) and not ABANDON (the threshold is reachable and the model need not change).

A companion negative-result record is provided in `admission-threshold-null.md`.
