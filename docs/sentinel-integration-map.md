# Sentinel Integration Map

> Depth ledger tracking all external systems wired into Kronos Engine.
> Inspired by Cosmogonic's Tsotchke depth ledger (22 registry entries, 9 deep / 7 wired / 2 harvest / 3 fenced / 1 meta).

**Last updated:** 2026-07-09

---

## Depth Classification

| Class | Meaning | Sim Impact |
|-------|---------|------------|
| `deep` | Full bidirectional wiring: macro → micro → macro feedback loop. System receives `MacroConditionPacket`, simulator advances, sentinel output feeds back to world engine. | Full |
| `wired` | Macro-in only: system receives macro conditions but does not feed back to world. | Unidirectional |
| `harvest` | Data consumed for analysis but no sim impact. World engine observes but does not control. | None |
| `fenced` | Referenced or studied but not wired into the deterministic sim. No runtime integration. | None |

---

## Registry

| # | System | Type | Class | Wiring Since | Files | Notes |
|---|--------|------|-------|-------------|-------|-------|
| 1 | Deers Rock HOE | Hospital simulator | `deep` | P-002 (2026-06-29) | `src/sectors/deers-rock-adapter.ts`, `deers-rock-adapter.test.ts`, `src/sectors/types.ts` | Full sentinel adapter. Zero DR code modifications. Multi-instance, circuit breaker, 1440:1 temporal aggregation, string-ID seed derivation. 30-hospital network configured in `src/data/indonesian-hospitals.ts`. |
| 2 | Deers Rock HOE (Makassar) | Hospital simulator | `deep` | P-004 (2026-06-30) | Same adapter as #1 | Counterfactual experiment confirmed pipeline: climate intervention → occupancy shift (d=0.70) → CSSD cycles (d=-2.71). |

---

## Planned / In Progress

| # | System | Type | Target Class | Priority | Notes |
|---|--------|------|-------------|----------|-------|
| — | Second hospital simulator | Hospital simulator | `deep` | Future | Wrapping a different simulator type would close the "all sentinels run Deers Rock" limitation from §4.4. Requires adapter variant or second adapter module. |
| — | NHI coverage database | Healthcare policy | `harvest` | Future | Import real NHI coverage rules as validation targets for counterfactual policy experiments. |
| — | WHO/CDC climate-health data | Epidemiology | `harvest` | Future | Calibration targets for Climate → Health coupling. |

---

## Scientific Wired Fraction

| Metric | Value |
|--------|-------|
| Total adapters | 1 |
| `deep` | 1 |
| `wired` | 0 |
| `harvest` | 0 |
| `fenced` | 0 |
| **Wired fraction** | **1/1 = 1.000** |

---

## Wiring Integrity Rules

1. **Deep adapters must never bypass the simulator's public `step()` interface** (verified by test)
2. **Deep adapters must never leak patient-level data** (verified by code review)
3. **Fenced systems must never appear in the deterministic sim's import graph** (enforced by TypeScript module resolution)
4. **When adding a new adapter, update this map before merging**
