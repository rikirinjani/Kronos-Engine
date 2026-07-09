# P-005: Sector Cadences and Contracts

**Proposed by:** Sector Engineer
**Status:** Implemented
**Date:** 2026-07-09

---

## Summary

Two changes to the sector system:

**A) Cadenced tick pipeline** — Sectors declare a `cadence` (tick frequency in world ticks). Economy ticks every 3rd tick, Technology every 5th, Demographics every 10th. Fast-changing sectors (Geopolitics, Climate, sentinels) stay at 1 (every tick).

**B) Sector contracts** — Per-sector CONTRACT.md documenting state keys, events, invariants, and RNG position. Contract-first development for any future sector additions.

---

## A) Cadenced Tick Pipeline

### Interface change

```typescript
interface Sector {
  id: SectorId;
  name: string;
  cadence: number;  // NEW — ticks per world tick (default 1)
  init(seed: number, config: Record<string, unknown>): SectorState;
  tick(state: SectorState, world: WorldContext): SectorState;
  handlers: TickHandler[];
  events: string[];
}
```

### Cadence assignments

| Sector | Cadence | Rationale |
|--------|---------|-----------|
| Geopolitics | 1 | Wars, diplomacy change daily |
| Climate | 1 | Weather, emissions are continuous |
| Economy | 3 | GDP doesn't change daily |
| Technology | 5 | R&D moves slowly |
| Energy | 3 | Markets move with economy |
| Demographics | 10 | Populations change over years |
| Deers Rock sentinel | 1 | Hospital ops are daily |

### Engine change

World Engine `tick()` checks `nextTick % sector.cadence === 0` before calling `sector.tick()`. Skipped sectors carry state forward unchanged. Cross-sector event handlers run every tick regardless of cadence.

### Determinism

Same seed + same cadence config = identical output. Cadence config should be included in universe ID hash for experiments that compare different cadence regimes (future work).

---

## B) Per-Sector Contracts

Each sector should document in a CONTRACT.md file at `src/sectors/{name}/CONTRACT.md`:

- State keys read/written per tick
- Events emitted and trigger conditions
- Events handled and from which origin sector
- Invariants (monotonicity, bounds, NaN safety)
- RNG sub-stream position in call order

### Contract format (one per sector)

```markdown
# Sector: {name}

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| sector.event_name | trigger description | payload fields |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|

## Invariants
1. ...

## RNG Position
- Tick calls: N calls per tick
- Order: 1st call → X, 2nd call → Y
```

**Effort:** ~15 min per existing sector (7 sectors ≈ 2h total).

---

## Verification

- [x] `cadence` added to Sector interface
- [x] All 7 sectors set appropriate cadence values
- [x] World Engine tick() respects cadence (mod check)
- [x] Cross-sector events still processed every tick
- [x] 5 cadence tests passing (single/multi sector, determinism)
- [x] Full suite: 190+ tests passing
- [ ] Per-sector CONTRACT.md files (P2 — deferred)

---

## Files Changed

- `src/sectors/types.ts` — +`cadence` field on Sector
- `src/engine/world-engine.ts` — cadence-aware tick loop
- `src/sectors/geopolitics.ts` — cadence: 1
- `src/sectors/climate.ts` — cadence: 1
- `src/sectors/economy.ts` — cadence: 3
- `src/sectors/technology.ts` — cadence: 5
- `src/sectors/energy.ts` — cadence: 3
- `src/sectors/demographics.ts` — cadence: 10
- `src/sectors/deers-rock-adapter.ts` — cadence: 1
- `src/engine/cadence.test.ts` — 5 new tests
