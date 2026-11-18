# P-007: Pre-2016 AI Kernel — Deterministic Agent Cognition

**Proposed by:** Meta Platform
**Status:** Proposal — ready for Sector Engineer
**Date:** 2026-07-10
**Inspired by:** Cosmogonic's `src/sim/ai/brains.ts` — 6 deterministic primitives, 70-param MLP, no LLM.

---

## Why

Kronos Engine's "populations" are currently just macros — GDP goes up, population ticks, but no one makes a decision. Policy counterfactuals (Phase 3) need agents that respond to changes: a central bank adjusting rates, a trade negotiator retaliating against tariffs, a hospital administrator reallocating beds during a heatwave.

A lightweight deterministic AI kernel enables this. Pre-2016 techniques only — no LLMs, no GPUs, no neural network accelerators. Every agent decision is seeded and reproducible.

---

## What

A single module `src/sim/ai/brains.ts` exporting 6 deterministic primitives:

### 1. `utilityPick` / `softmaxPick`
Weighted random selection from options. Input: array of `{ label, score }`. Output: chosen label. Seeded.
- `utilityPick` — highest score wins (deterministic given scores)
- `softmaxPick` — temperature-weighted probabilistic pick (uses seeded RNG)

### 2. `TinyMLP`
Single-hidden-layer perceptron. Generic and small.
```typescript
class TinyMLP {
  constructor(inputs: number, hidden: number, outputs: number, rng: RNG);
  forward(input: Float64Array): Float64Array; // no allocation
  weights: Float64Array; // readable for inheritance/mutation
}
```

### 3. `MarkovChain`
First-order Markov model for sequences.
```typescript
class MarkovChain {
  constructor(order: number, rng: RNG);
  train(sequence: string[]): void;
  generate(length: number): string[]; // seeded
}
```

### 4. `fsmStep`
Generic finite-state machine tick.
```typescript
type FSMState = string;
type FSMEvent = string;
interface FSMRule { from: FSMState; on: FSMEvent; to: FSMState; action?: () => void }
function fsmStep(current: FSMState, event: FSMEvent, rules: FSMRule[]): FSMState;
```

### 5. `goapPlan`
Goal-oriented action planning (F.E.A.R.-style).
```typescript
interface GOAPAction { name: string; cost: number; preconditions: Record<string, boolean>; effects: Record<string, boolean>; }
function goapPlan(start: Record<string, boolean>, goal: Record<string, boolean>, actions: GOAPAction[]): GOAPAction[] | null;
```

### 6. `MemoryRing`
Bounded episodic memory ring buffer.
```typescript
class MemoryRing<T> {
  constructor(capacity: number);
  remember(item: T): void;
  recall(count: number): T[]; // last N items
  recallAll(): T[];
}
```

---

## How it connects to the world

The AI kernel itself is stateless math — it has no concept of "sector" or "nation." Integration happens in a new `src/sim/agents.ts` that wires AI primitives to sector state:

```typescript
interface Agent {
  id: string;
  brain: { utility: UtilityProfile; memory: MemoryRing<string>; markov?: MarkovChain };
  tick(state: SectorState, ctx: WorldContext): SectorState;
}
```

Example agents for v1:
- **CentralBankAgent** — reads inflation + GDP from Economy state, uses `utilityPick` to set interest rate
- **TradeAgent** — reads relation scores from Geopolitics, uses `softmaxPick` to set tariffs
- **HospitalAdminAgent** — reads occupancy + disaster alerts, uses `goapPlan` to reallocate beds

These agents run inside their sector's `tick()`, consuming and producing sector state. No new sector needed — just a utility module sectors can import.

---

## Files

| File | What |
|------|------|
| `src/sim/ai/brains.ts` | 6 primitives: utilityPick, TinyMLP, MarkovChain, fsmStep, goapPlan, MemoryRing |
| `src/sim/ai/brains.test.ts` | Tests for each primitive + determinism check |
| `src/sim/agents.ts` | Agent interface + 2-3 example agent implementations |
| `src/sim/agents.test.ts` | Integration tests: agent wired into sector tick |

---

## Constraints

- **Zero external dependencies.** All math is hand-written.
- **Seeded RNG only.** Every stochastic decision flows through the engine's `Rng`.
- **Allocation-free hot paths.** `forward()`, `fsmStep()`, `utilityPick()` must not allocate.
- **Small.** Target: ~150 lines per primitive, ~150 lines for agents, ~100 lines test = ~1,150 lines total.
- **Phase 3 compatible.** Agents consume sector state and return sector state — no engine changes needed.

---

## Effort

~4h design + implementation + tests.

---

## Not in scope

- LLM integration (explicitly against the design philosophy)
- Complex agent communication protocols
- Learning across experiment runs (agents reset per seed)
- Real-time agent visualization in the cockpit
