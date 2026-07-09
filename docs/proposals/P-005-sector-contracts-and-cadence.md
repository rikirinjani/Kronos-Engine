# P-005: Sector Contracts & Cadenced Tick Pipeline

**Proposed by:** Meta Platform (inspired by Cosmogonic Quantum Mechalogodrom module-contract system)
**Status:** Proposal
**Date:** 2026-07-09
**Rationale:** Two structural gaps surfaced during Phase 0–2 handoffs:

1. Sector writers inferred contracts from integration code, causing repeated misalignment (event schemas, seed derivation, adapter internals). An explicit per-sector contract spec prevents this.
2. All 6 sectors + sentinel tick every world tick regardless of update need. A staggered cadence system reduces CPU load without affecting correctness.

---

## Part A: Sector Contracts

### Current problem

The `Sector` interface (`src/sectors/types.ts`) specifies init/tick/handlers/events at the type level only. There is no per-sector document specifying:
- What state keys each sector reads and writes
- Which cross-sector events it emits under what conditions
- What its tick function's time complexity is
- What invariants hold across ticks (monotonicity, range bounds)
- What seed sub-stream it consumes (position in the RNG call order)

This caused the Phase 1.2 calibration gaps and the handoff failures recorded in self-harness.

### Proposed contract format

Each sector gets a `CONTRACT.md` alongside its implementation:

```
src/sectors/
  economy/
    economy.ts
    economy.test.ts
    CONTRACT.md       ← new
  climate/
    climate.ts
    climate.test.ts
    CONTRACT.md       ← new
  ...
```

**Template:**

```markdown
# Sector: economy

## Interface
- id: "economy"
- state type: EconomyState (see types below)
- cadence: 1 (every tick)

## State keys READ
- `nations.{id}.gdp` — current GDP
- `nations.{id}.wars` — active war IDs (from Geopolitics events)

## State keys WRITTEN
- `nations.{id}.gdp` — updated via growth formula
- `nations.{id}.gdpGrowthRate` — updated by war_start/war_end events
- `marketIndex` — global market index, updated every tick

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| ECONOMY_EVENTS.GDP_SHIFT | tick | { nationId, delta, cause } |
| ECONOMY_EVENTS.INFLATION_CHANGE | tick | { rate } |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| GEOPOLITICS_EVENTS.WAR_START | geopolitics | attacker GDP +3%, defender -15% |
| CLIMATE_EVENTS.DISASTER | climate | national GDP -5% on affected nations |

## Invariants
- GDP never negative
- `gdpGrowthRate` clamped to [-10, 15]
- All nations present at init remain present (monotonic set)

## RNG sub-stream
- 1 call per tick (growth stochastic perturbation)
- Position in call order: 3rd (after Geopolitics, Climate)
```

### What this prevents

- Writer A changes a state key shape → Writer B's sector breaks silently at runtime
- Writer A emits a new event type → Writer B doesn't handle it
- Writer A's sector moves in the init order → all RNG sub-streams shift

### Implementation

1. Create `CONTRACT.md` for each existing sector (economy, climate, geopolitics, technology, energy, demographics, deers-rock-adapter)
2. Update `src/sectors/types.ts` to add contract-reference field, or keep contracts as standalone docs
3. Add a `scripts/verify-contracts.ts` CI step that loads each sector, runs its contract's example state through init + N ticks, and asserts the invariants hold

**Effort:** ~15 min per sector (writer who built it writes the contract) = ~2 hours total. One-time.

---

## Part B: Cadenced Tick Pipeline

### Current problem

`tick()` in `world-engine.ts` iterates all sectors every tick. A tick costs `O(S * N)` where S = sectors and N = per-sector complexity. At 30 ticks, this is negligible. At 10,000 ticks for a full experiment, it adds up — especially for the Climate sector (atmospheric chemistry model) and the Deers Rock sentinel (1440 internal sub-ticks per world tick).

The Cosmogonic engine uses staggered cadences: economy every 30th frame, reaction-diffusion every 2nd frame, analytics every 60th frame, etc. Same pattern applies here.

### Proposed change

Add an optional `cadence` property to the `Sector` interface:

```typescript
export interface Sector {
  id: SectorId;
  name: string;
  cadence?: number; // default 1 (every tick). 2 = every 2nd tick, 30 = every 30th tick
  offset?: number;  // phase offset within cadence, 0 by default
  init(seed: number, config: Record<string, unknown>): SectorState;
  tick(state: SectorState, world: WorldContext): SectorState;
  handlers: TickHandler[];
  events: string[];
}
```

Update `world-engine.ts` to skip sectors whose cadence doesn't align:

```typescript
function tick(world: WorldState): WorldState {
  const { tick: currentTick, sectors } = world;
  const events: WorldEvent[] = [];

  for (const [id, record] of sectors) {
    const cadence = record.sector.cadence ?? 1;
    const offset = record.sector.offset ?? 0;
    if ((currentTick + offset) % cadence !== 0) continue;

    const newState = record.sector.tick(record.state, {
      tick: currentTick,
      rng: restoreRNG(world.rngState), // or pass a sub-RNG
      eventBus: createEventBus(),
    });
    // collect events, update state
  }

  // process cross-sector events (always every tick)
  // ...
}
```

### Suggested cadences

| Sector | Cadence | Offset | Rationale |
|--------|---------|--------|-----------|
| Geopolitics | 1 | 0 | Nation states change slowly; war tick every turn |
| Climate | 1 | 0 | Atmospheric model accumulates drift each tick |
| Economy | 3 | 1 | GDP growth is a daily/monthly process, not per-hour |
| Technology | 5 | 2 | R&D doesn't produce breakthroughs every tick |
| Energy | 3 | 1 | Energy markets respond to GDP on similar timescales |
| Demographics | 10 | 5 | Birth/death rates change at decadal scale |
| Deers Rock sentinel | 1 | 0 | Hospital operations are fast (minute-level) |

### Cross-sector event impact

Cross-sector events are still processed every tick regardless of sector cadence. If a Climate disaster event fires on tick 5 but the Economy sector only ticks on tick 6, the Economy handler runs on tick 6 and picks up the queued event. Event delivery is delayed by at most (cadence - 1) ticks, which is within acceptable bounds for macro-scale simulation.

### Determinism preservation

The skip condition `(tick + offset) % cadence` is a pure function of tick number — deterministic across runs. The RNG stream is unchanged because the sector receives the same RNG state it would have received at the skipped ticks (or we skip RNG consumption entirely for skipped ticks).

Option A (simpler): sectors don't consume RNG on skipped ticks. The RNG state advances only when the sector actually ticks. This preserves determinism per-sector but shifts the interleaving of RNG streams between sectors depending on cadence offsets. This means experiments with different cadence configs produce different results — which is fine as long as the cadence config is part of the experiment's configuration hash.

Option B (pure): sectors consume RNG on every tick regardless of cadence, but skip the computation. This preserves the RNG stream position exactly. Slightly more CPU but maintains RNG backward compatibility.

**Recommendation:** Option A for new experiments, with cadence config included in the universe ID hash.

### Effort

- Interface change: 15 min
- World engine update: 30 min
- Per-sector cadence config: 15 min
- Tests: 30 min
- **Total: ~1.5 hours**

---

## Acceptance criteria

1. All existing tests pass unchanged (cadence defaults to 1 = same behavior as today)
2. A new test verifies that a sector with cadence=3 ticks exactly floor(N/3) times in N world ticks
3. Cross-sector events still deliver within cadence-bound latency
4. Deterministic replay: same cadence config + same seed = identical output
5. Each existing sector has a CONTRACT.md

---

## Not in scope

- Dynamic cadence adjustment (changing cadence at runtime based on state)
- Priority-based sector ordering (sectors remain in insertion order, cadence is the only control)
- The pre-2016 AI kernel (deferred to Phase 3 — separate proposal)
- Truth-repair CI gate (separate proposal — Platform/CI scope)
