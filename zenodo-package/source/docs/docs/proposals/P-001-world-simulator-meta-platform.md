# P-001: World Simulator — Meta Platform

**Proposed by:** Meta Platform (spanning all OCs)
**Status:** Proposal — awaiting human review
**Date:** 2026-06-29
**Based on:** Deers Rock HOE (seeded RNG, handler pipeline, snapshot/branch engine)

---

## 1. Vision

Deers Rock proves the architecture works for a **single domain** (healthcare). This proposal generalizes that architecture into a **multi-domain world simulator** where any domain — healthcare, geopolitics, economics, climate, technology, demographics — is a pluggable module running on the same deterministic engine.

The Meta Platform is not "Deers Rock 2.0." It is the **engine that hosts Deers Rock** as one domain among many.

---

## 2. Architectural Inheritance from Deers Rock

| Deers Rock Concept | World Simulator Generalization |
|---|---|
| Hospital clock (1 tick = 1 min) | World clock (1 tick = configurable: 1 hour, 1 day, 1 month per tick) |
| Handler pipeline (`world.ts`) | Sector pipeline — each domain registers handlers |
| Seeded RNG (ADR-008) | Same seeded RNG — universal determinism |
| Snapshots every N ticks | Rewind Points — any tick, any domain |
| Branch from snapshot (ADR-009) | Counterfactual Branch — diverge at any Rewind Point |
| Event queue (`event-queue.ts`) | Global event bus — inter-domain events |
| Agent system (doctor/nurse/pharmacy) | Multi-agent system — domain-specific agents with shared world state |
| FHIR export | Universal export schema per domain |
| Journal (SQLite) | Append-only world journal |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────┐
│                   WORLD ENGINE                       │
│  (Clock, Seeded RNG, Event Bus, Snapshot Manager)   │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Healthcare│ │Geopolitics│ │Economy   │ │Climate   │ │
│  │(DeersRock)│ │          │ │          │ │          │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Technology│ │Demography│ │Energy    │ │...       │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ │
│                                                       │
├─────────────────────────────────────────────────────┤
│  REWIND POINTS │ BRANCHES │ COUNTERFACTUAL DIFFS    │
└─────────────────────────────────────────────────────┘
```

### Core Abstractions

#### `WorldState`
```typescript
interface WorldState {
  tick: number;
  clock: Clock;
  rng: SeededRNG;
  sectors: Map<SectorId, SectorState>; // Deers Rock is one sector
  eventBus: EventQueue;
  history: Journal;
}
```

#### `Sector`
```typescript
interface Sector {
  id: SectorId;
  name: string;
  init(seed: number, config: any): SectorState;
  tick(state: SectorState, world: WorldContext): SectorState;
  handlers: TickHandler[];
  events: string[]; // event types this sector emits/subscribes to
}
```

#### `RewindPoint`
```typescript
interface RewindPoint {
  tick: number;
  worldStateHash: string; // deterministic — verify integrity
  sectors: Map<SectorId, SectorSnapshot>;
  timestamp: number; // real wall clock
  label?: string; // human-readable: "Pre-WWII", "Fall of Berlin Wall", etc.
}
```

#### `Branch`
```typescript
interface Branch {
  id: string; // B-YYYY-NNNN
  parentUniverse: string; // U-YYYY-NNNN
  rewindTick: number;
  intervention: Intervention; // "what if X happened differently"
  childTimeline: WorldState[];
  outcomeDiff: CounterfactualDiff;
}
```

---

## 4. World History as Prepopulated Data

The simulator starts with real-world historical data encoded as initial state:

| Era | Seed | Example Rewind Points |
|---|---|---|
| Ancient (~3000 BCE – 500 CE) | S-ANCIENT | Fall of Rome (476 CE) |
| Medieval (500–1500) | S-MEDIEVAL | Black Death (1347), Fall of Constantinople (1453) |
| Early Modern (1500–1800) | S-EARLYMODERN | Discovery of Americas (1492), French Revolution (1789) |
| Industrial (1800–1914) | S-INDUSTRIAL | Steam engine, WWI trigger (1914) |
| Modern (1914–1991) | S-MODERN | WWII (1939), Moon landing (1969), Fall of USSR (1991) |
| Contemporary (1991–present) | S-CONTEMPORARY | 9/11 (2001), COVID-19 (2020) |
| Future (2026+) | S-BASELINE | Current state → simulation projects forward |

Each era has pre-seeded Rewind Points. You can jump to any Rewind Point and branch.

---

## 5. Counterfactual Simulation — Concrete Examples

### Healthcare
- **Rewind:** Deers Rock tick 240, pandemic scenario begins
- **Branch:** +500 ventilators, +200 ICU beds
- **Outcome diff:** mortality delta, LOS distribution change

### Geopolitics
- **Rewind:** 1914-06-28, Archduke Franz Ferdinand assassination
- **Branch:** assassination fails
- **Outcome diff:** no WWI → different 20th century

### Climate
- **Rewind:** 1997, Kyoto Protocol signing
- **Branch:** all signatories fully comply
- **Outcome diff:** 2026 avg temperature vs. real timeline

### Technology
- **Rewind:** 2007, iPhone launch
- **Branch:** Apple licenses iOS to competitors
- **Outcome diff:** mobile OS market share, app economy trajectory

Each counterfactual produces:
- A **machine-readable diff** (JSON) comparing outcomes against the original timeline
- A **branch genealogy** tracing parent → child
- A **statistical summary** (CI/SD across N runs with same intervention)

---

## 6. Implementation Phases

### Phase 1 — Core World Engine (4 weeks)
- Extract clock, RNG, event queue, snapshot from Deers Rock into shared lib
- Define `Sector` interface
- Port Deers Rock as first sector (healthcare)
- Verify: `WorldEngine.run(DeersRockSector, seed=42, ticks=100)` matches standalone Deers Rock output

### Phase 2 — Rewind Points & Branching (3 weeks)
- Implement `RewindPointManager` — save/load/verify
- Implement `BranchEngine` — fork from Rewind Point, run diverged timeline
- Implement `CounterfactualDiff` — compare two timelines
- CLI: `world branch <rewind-tick> --intervention <json>`

### Phase 3 — World History Data (4 weeks)
- Define historical era schemas (economy, population, technology level, geopolitical boundaries)
- Seed initial world state at each Rewind Point
- Calibrate simple progression models (demographic transition, technological progress)

### Phase 4 — Sector Expansion (ongoing)
- Geopolitics sector: borders, alliances, conflicts, diplomacy
- Economy sector: GDP, trade, inflation, markets
- Climate sector: temperature, emissions, weather events
- Technology sector: innovation diffusion, research output

### Phase 5 — Dashboard & Export (2 weeks)
- Multi-domain dashboard: switch between sectors, overlay timeline views
- Branch comparison view: side-by-side outcome distributions
- Export: branch genealogy (DOT/JSON), diffs (CSV), full state (FHIR-style per domain)

---

## 7. Key Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Deterministic by default | Seeded RNG + pure tick functions | Counterfactuals require identical pre-divergence state |
| Sectors are independent | No direct cross-sector calls; only event bus | Prevents cascading coupling |
| History is initial data, not simulation | Pre-seeded Rewind Points, not forward simulation of 5000 years | Pragmatic: simulating 5000 years from scratch is wasteful |
| Branch granularity | Per-tick, not per-event | Simpler implementation; Deers Rock already snapshots every 20 ticks |
| Storage | SQLite per universe + branch namespace | Proven in Deers Rock; cheap, simple, portable |

---

## 8. Relation to Deers Rock

**Deers Rock is NOT replaced.** It becomes the `healthcare` sector module. The Meta Platform:

1. Hosts Deers Rock as a sector
2. Adds cross-sector interactions (e.g., climate → disease patterns → hospital load)
3. Enables counterfactuals that span sectors (e.g., "what if COVID-19 hit a world with different geopolitical alliances")

Existing Deers Rock code changes: minimal. The `WorldEngine` wraps `createWorld`, `runWorld`, snapshots, and branching.

---

## 9. Open Questions

1. Should sectors be TypeScript modules (compile-time) or plugins (runtime-loaded)?
2. How detailed should historical eras be? Strategic-level (nations, GDP, wars) or tactical-level (individual people)?
3. What is the "unit of history" — a country? A region? A civilization?
4. Should the Meta Platform support real-time data feeds (e.g., live economic indicators) alongside simulation?

---

## 10. Success Criteria

- [ ] Deers Rock runs unmodified as a sector module
- [ ] `world run --sectors healthcare,geopolitics --seed 42` produces deterministic output
- [ ] A Rewind Point captures full world state (all sectors) at a given tick
- [ ] Branch from any Rewind Point produces a diverged timeline
- [ ] Counterfactual diff shows outcome deltas per sector
- [ ] World history seed (e.g., S-CONTEMPORARY) initializes a plausible 2026 world state
- [ ] Cross-sector interaction: climate sector affects healthcare sector admissions

---

*One engine. Many worlds. Every seed is a history — every snapshot is a choice.*
