# EXP-002 Audit Report — Phase A

**Date:** 2026-09-21
**Auditor:** Orchestrator
**Status:** BLOCKED — Critical defect found

---

## Summary

EXP-002 Phase 1 (threshold scan) has a **critical paired-design defect**: control and intervention arms share a single RNG instance, causing the CO₂ intervention to cascade through all sectors via RNG consumption divergence. The measured "activation" is not attributable to the intended causal pathway.

**Phase B (N=50 confirmation) cannot proceed with the current design.**

---

## A1. Design Reconciliation — PASS

All arms, seeds, endpoints, and configurations reconcile exactly with the executed code.

| Property | Value |
|----------|-------|
| CO₂ arms | 280, 400, 800, 1200 |
| Seeds | 42, 137, 256, 1001, 1984, + 5 generated |
| N per arm | 10 |
| Total runs | 40 |
| Horizon | 50 KE ticks |
| Pairing | Same seed across all arms |

---

## A2. Paired Design — CRITICAL DEFECT

### The Problem

The KE engine uses a single shared RNG per tick:
```typescript
const rng = restoreRNG(world.rngState);
const ctx = { tick: nextTick, rng, eventBus };
```

All sectors share this RNG. The climate sector consumes 3-5 RNG values per tick. At higher CO₂:
- Temperature anomaly is larger
- Event probability is higher
- More events are generated
- **More RNG values are consumed**

After the first divergent tick, all subsequent ticks use different RNG sequences. Every downstream sector receives different random values.

### Evidence

- 4/10 seeds: CO₂=280, 400, 800 produce **identical** outputs
- 6/10 seeds: outputs differ, but divergence includes RNG contamination
- adapterEventCount = 0 for all arms (wrapper removed)

### Impact

Activation rate measures **RNG sensitivity**, not pathway activation.

---

## A3. Pathway Causality — CONFOUNDED

The pathway is mechanically functional (confirmed by EXP-001), but the activation signal is confounded by RNG contamination. Causality cannot be attributed from EXP-002 data.

---

## A4. Non-Monotonicity — SAMPLING VARIATION

The 400→800 decrease (50% → 40%) is ordinary sampling variation at N=10, not a structural effect.

---

## A5. Runtime — EXPECTED

H=50 runs take ~7.5s/run due to DR simulation overhead (10 internal ticks per KE tick).

---

## Phase B Requirements

1. Use **fresh-world paired execution** (each arm creates its own world)
2. Re-instate adapter event wrapper if adapterEventCount is a required endpoint
3. Pre-specify exact activation criterion
4. Use N=50 per arm

---

*Audit complete. BLOCKED until RNG contamination is resolved.*
