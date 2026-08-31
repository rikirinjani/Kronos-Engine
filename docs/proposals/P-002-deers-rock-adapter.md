# P-002: Deers Rock as Sentinel Adapter (Zero Modifications)

> **STATUS NOTE (2026-08-31):** Inbound sentinel→world feedback (consumption of the adapter's `health.*` events — `health.pressure`, `health.mortality`, `health.surge`, `health.down`, `health.supply-crisis`) is **not implemented**: no sector registers a handler for any `health.*` event, so published sentinel signals are dropped. The world→hospital direction is verified (macro events → `MacroConditionPacket` → 1,440 DR ticks/day → aggregated `HospitalSentinelOutput`). The proposal's bidirectional claims (e.g., "Full Round Trip", "The Feedback Loop That Makes This Novel") should be read as **design intent**, not current behavior. See `docs/sentinel-integration-map.md` → "Bidirectional Claims vs Current State".

**Goal:** Integrate Deers Rock into Kronos Engine as a `Sector` without changing a single file in `C:\Users\think\Deers-Rock\`.

**No single line in Deers Rock's source knows the world exists.**

---

## The Constraint

Deers Rock must not know it is a module. No code changes. No special exports. No awareness of `Sector`, `WorldEngine`, or `EventBus`. The adapter is a pure wrapper in Kronos Engine.

Deers Rock should never answer questions like:
- What's Indonesia's GDP?
- Is there a war?
- What's the global temperature?

It should only understand inputs that make sense to a hospital:
- `admissionRateMultiplier: 1.8`
- `traumaProbability: +25%`
- `respiratoryCaseWeight: +40%`
- `bloodSupplyDelay: 2 days`
- `staffAbsenteeism: 15%`

To Deers Rock, those are simply parameters affecting today's operations. Where they came from is none of its business.

---

## Architecture: Sentinel, Not Sensor

Public health uses the concept of **sentinel surveillance** — selected hospitals that monitor disease trends without claiming to represent the entire population. This is the correct framing.

```
CHRONOS ENGINE (macro, 1 tick = 1 day)
    │  macro conditions
    ▼
ADAPTER LAYER (translation, scale bridge)
    │  admission modifiers, diagnosis weights
    ▼
DEERS ROCK (micro, 1 tick = 1 minute)
    │  health pressure signal
    ▼
ADAPTER LAYER (aggregation, signal extraction)
    │  occupancy, mortality, prevalence
    ▼
CHRONOS ENGINE (reads as regional sentinel output)
```

The adapter appears twice — once translating down, once translating up. Bidirectional. Asymmetric. Honest about what each layer knows.

---

## Scale Bridging

```
                World Engine              │  Deers Rock
──────────────────────────────────────────┼────────────────────
Tick unit       1 day                    │  1 minute
Scope           Nations, GDP, wars       │  One hospital, Makassar
Population      Millions                 │  50–133 patients
Resolution      Strategic (macro)        │  Tactical (micro)
```

The adapter does **not** pretend they share the same scale. Deers Rock is a **sentinel** — one data point, not the whole system.

### Macro → Micro (World events affect the hospital)

| World Event | Adapter translates to Deers Rock |
|---|---|
| `economy.recession` | Increase uninsured patient ratio, reduce discharge rate |
| `climate.heatwave` | Surge in heat-related admissions, shift diagnosis weights |
| `geopolitics.pandemic` | Multiply admission rate, activate pandemic scenario |
| `geopolitics.war` | Add trauma diagnosis pool, reduce staff availability |

### Scale Translation Table

| World Event | World Tick | Hospital Effect | Hospital Ticks Affected |
|---|---|---|---|
| Pandemic declared | T+1 | `admissionMultiplier` × 2.5 | Next 1440 (1 world day) |
| Economic recession | T+30 | Uninsured patient rate +15% | Ongoing |
| Climate disaster (local) | T+1 | Trauma surge, supply stress | Next 720 |
| War (regional) | T+7 | Supply chain disruption | Ongoing until resolved |
| Technology breakthrough | T+180 | New treatment protocol available | Permanent |

---

## Seed Derivation — Determinism Across Scales

Each hospital sentinel **must** derive its RNG seed from the World seed + hospital ID. This ensures the same Kronos universe always produces the exact same hospital micro-state, preserving counterfactual reproducibility across the entire stack.

```typescript
function getHospitalSeed(worldSeed: number, hospitalId: number): number {
  return (worldSeed ^ (hospitalId * 2654435761)) >>> 0; // Knuth multiplicative hash
}

// Hospital 1 gets seed = worldSeed ^ 2654435761
// Hospital 2 gets seed = worldSeed ^ 5308871522
// Same world seed → same hospital outputs every time
```

Without this, Deers Rock becomes a non-deterministic black box inside a deterministic world. That breaks everything.

---

## Temporal Aggregation — Performance

1 World tick = 1 day = 1440 Deers Rock ticks (at 1 tick = 1 minute).

The adapter runs a `fastForward(days)` loop, stepping Deers Rock N times per World tick, then publishes **aggregated daily stats** (total admissions, mortality, avg occupancy) back to the World Engine.

```typescript
const TICKS_PER_WORLD_TICK = 1440; // 1 day of DR time

tick(state: DeersRockSectorState, ctx: WorldContext): DeersRockSectorState {
  const macroPacket = buildMacroPacket(ctx.eventBus.pending());

  let world = state._world;
  for (let i = 0; i < TICKS_PER_WORLD_TICK; i++) {
    // Inject macro conditions once per world tick (first iteration)
    const drEvents = (i === 0) ? [mapMacroToDeersRockEvent(macroPacket)] : [];
    world = step(world, drEvents);
  }

  // Publish aggregated daily stats
  const sentinelOutput = extractSentinelOutput(world, state._world);
  publishSentinelReport(ctx.eventBus, sentinelOutput);

  return { ...state, _world: world, _lastTickState: state._world };
}
```

This keeps the macro simulation performant while preserving micro-level fidelity.

---

## The Sentinel Contract — What Deers Rock Reports

The adapter reads aggregated state from Deers Rock. The World Engine never sees bed assignments or individual patient vitals. It sees pressure signals.

```typescript
interface HospitalSentinelOutput {
  tick: number;                    // world tick
  hospitalId: string;              // "makassar-001"
  city: string;                    // "Makassar"
  occupancyRate: number;           // 0-1
  icuOccupancyRate: number;        // 0-1
  mortalityPressure: number;       // deaths this period
  diseasePrevalence: Record<string, number>; // top ICD codes
  supplyStress: number;            // 0-1
  staffStress: number;             // 0-1, fatigue + absenteeism
  admissionSurge: boolean;         // above baseline threshold
}
```

| Signal | World Engine Event | Meaning |
|---|---|---|
| 95% occupancy | `health.pressure` | Local capacity strain |
| Mortality spike | `health.mortality` | Possible outbreak or service gap |
| Disease prevalence shift | `health.disease-burden` | Population health signal |
| Supply stress > 0.7 | `health.supply-crisis` | Regional supply chain risk |
| Admission surge | `health.surge` | Hospital under acute stress |

Every event carries `{ hospitalId, city, tick }` — the World Engine identifies **which** sentinel reported it, never treating one hospital's data as the whole country.

---

## The Macro Injection Contract — What Kronos Sends Down

Deers Rock's admission handler reads this packet once per world tick (once every 1440 hospital ticks). Everything downstream flows from these numbers.

```typescript
interface MacroConditionPacket {
  tick: number;                                // world tick
  admissionMultiplier: number;                 // 1.0 = baseline
  diagnosisWeightOverrides: Record<string, number>; // ICD code → weight
  supplyChainPressure: number;                 // 0-1
  staffAvailabilityModifier: number;           // 0-1
  activeDisasterType?: string;                 // pandemic, earthquake, etc.
}
```

Deers Rock never sees the macro model. It receives parameters that look like "today's operations" — `admissionMultiplier`, `staffAvailabilityModifier` — and processes them normally. Where they came from is none of its business.

---

## Multiple Sentinel Instances

```typescript
sentinels: [
  deersRockAdapter({ id: "makassar-001", city: "Makassar", beds: 133, patients: 50 }),
  deersRockAdapter({ id: "surabaya-001", city: "Surabaya", beds: 300, patients: 100 }),
  deersRockAdapter({ id: "jayapura-001", city: "Jayapura", beds: 80, patients: 30 }),
]
```

Each sentinel:
- Runs independently from the same Deers Rock code
- Derives its seed from world seed + hospital ID (see seed derivation)
- Receives the same macro packet — each may interpret it differently based on local config
- Reports its own `HospitalSentinelOutput` to the World Engine

Together they provide a **distributed observation network**, not a single national model. Makassar sentinel, Surabaya sentinel, Jayapura sentinel — no one hospital is "Indonesia."

Three hospitals is a proof of concept. Thirty hospitals is a research instrument. Three hundred hospitals is a national health digital twin — built from the same Deers Rock codebase, different configs, no single line knowing the others exist.

---

## Integration Flow (Full Round Trip)

```
1. World Engine tick starts (day N)
2. Economy sector ticks → publishes "recession" event
3. Adapter builds MacroConditionPacket: admissionMultiplier=1.0, staffModifier=0.85
4. Adapter runs fastForward(1 day) → 1440 Deers Rock ticks
5. Deers Rock processes the macro packet as "today's parameters"
6. Patients arrive with higher uninsured rate, staff availability reduced
7. Adapter reads final state → builds HospitalSentinelOutput
8. Adapter publishes sentinel report to World Engine event bus
9. Geopolitics sector receives health pressure signal
10. World Engine tick ends
```

### The Feedback Loop That Makes This Novel

A climate-driven heatwave in the Climate sector → reduces agricultural output → triggers economic recession in Economy sector → increases uninsured hospital patients in Deers Rock → occupancy spikes → hospital reports regional health crisis back to World Engine.

That feedback loop is what makes Kronos Engine genuinely novel.

---

## What Deers Rock Will Never Know

| Kronos concept | Known to Deers Rock? |
|---|---|
| GDP | ❌ |
| Geopolitical alliances | ❌ |
| Nation-level population | ❌ |
| Global temperature | ❌ |
| Other hospitals exist | ❌ |
| It is a "sentinel" | ❌ |
| Admission rate today | ✅ — looks like a normal parameter |
| Staff sick today | ✅ — looks like normal shift data |
| Supply delay today | ✅ — looks like normal inventory |

**The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal.**

---

## Adapter Invariants

The adapter may transform information, but it may never invent domain behavior.

| Violates | Why |
|---|---|
| Pandemic → `admissionMultiplier = 2.5` | ✅ Valid — translates macro to hospital parameter |
| Pandemic → hospital creates ICU beds | ❌ Invalid — that's hospital logic, belongs inside DR |
| Occupancy = 98% → Regional Pressure = 0.82 | ✅ Valid — aggregates micro to macro signal |
| Occupancy = 98% → GDP drops 3% | ❌ Invalid — that's macro logic, belongs to Kronos |

The adapter translates. It does not decide.

### Deterministic Resolution Order

The adapter must resolve all hospitals in the same order every tick (sorted by `hospitalId`). If the order changes, the RNG sequences diverge across instances, breaking counterfactual reproducibility.

```typescript
// ✅ Correct: stable sort
const sortedIds = Object.keys(hospitals).sort();
for (const id of sortedIds) {
  hospitals[id] = tickHospital(hospitals[id], macroPacket);
}

// ❌ Wrong: object key order is not guaranteed
for (const [id, h] of Object.entries(hospitals)) {
  hospitals[id] = tickHospital(h, macroPacket);
}
```

### Circuit-Breaker — Sentinel Failure Mode

If Deers Rock fails to respond within N ticks, the sentinel publishes a `HOSPITAL_DOWN` signal and continues with the last known good state until it recovers. The World Engine degrades gracefully (assumes occupancy holds steady).

```typescript
interface SentinelFailure {
  hospitalId: string;
  tick: number;
  lastGoodTick: number;
  status: "recovering" | "down";
}
```

---

## First Integration Test — "Heatwave to Health Crisis"

Validates the entire cross-sector round trip:

1. Start Kronos universe, seed = 42
2. Run 10 days (baseline)
3. At Day 10, inject heatwave into Climate sector
4. Run 30 more days

**Expected chain:**
```
Climate → Heatwave event
Heatwave → Economy recession
Recession → uninsured +15% (MacroConditionPacket to DR)
Deers Rock → admission surge (sentinel output)
Deers Rock → mortality pressure increases
```

**Verify with Diff Engine:** Compare Timeline A (no heatwave) vs Timeline B (heatwave). Health outcomes must be measurably worse in Timeline B.

If this test passes, the entire system works end-to-end.

---

## Boundary Violations — Never Do These

- ❌ Import anything from Deers Rock internals into World Engine
- ❌ Let World Engine read individual patient records
- ❌ Let Deers Rock read GDP, war status, or climate variables directly
- ❌ Share the same RNG instance between world and hospital ticks
- ❌ Let one sentinel hospital know another sentinel hospital's output
- ❌ Use real-time wall clock instead of seeded tick for any decision
- ❌ Let adapter invent domain behavior (translate, don't decide)

Violations destroy reproducibility. Violations break the sentinel model. Violations make Paper 1's core claim false.

---

## What Stays Unchanged in Deers Rock

| File | Status | Reason |
|---|---|---|
| All `src/` files | ✅ Untouched | Adapter uses only public exports |
| `src/index.ts` | ✅ Untouched | Already exports everything needed |
| `package.json` | ✅ Untouched | Dependency via npm workspace |
| Tests | ✅ Untouched | No behavior change |
| Constitution | ✅ Untouched | Deers Rock governance is independent |

If someone clones Deers Rock and runs it on a laptop, they still have a complete hospital simulator. Nothing breaks because Kronos isn't there. Deers Rock is both a standalone application and a sentinel that can participate in a larger world.

---

## Dependency Setup

### npm workspace (recommended)
```json
// Kronos Engine/package.json
{
  "workspaces": ["../Deers-Rock"]
}
```
Then: `import { createWorld, step, World } from "deers-rock";`

Zero changes to Deers Rock itself.

---

## Verification

- [ ] `getHospitalSeed(42, 1)` returns same value every time — deterministic
- [ ] Run 1 World tick (1 day) → adapter steps DR 1440 times → aggregated stats match expected range
- [ ] Same seed + same config → identical sentinel output
- [ ] Macro→Micro mapping: recession event correctly increases uninsured ratio
- [ ] Micro→Macro mapping: hospital pressure is regional signal, never extrapolated
- [ ] Multi-instance: 3 sentinels run independently, events tagged with correct `hospitalId`
- [ ] Cross-sector round trip: Climate → Economy → Deers Rock → Geopolitics
- [ ] Zero Deers Rock files modified (verify with `git diff` in Deers-Rock/)

---

*The world does not reach into the hospital. It knocks on the adapter's door and waits for the signal.*
