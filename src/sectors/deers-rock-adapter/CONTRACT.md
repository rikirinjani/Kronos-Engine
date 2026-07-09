# Sector Contract: deers-rock-adapter

## Interface
- id: `"deers-rock-adapter"`
- state type: `DeersRockAdapterState`
- file: `src/sectors/deers-rock-adapter.ts`
- cadence: 1 (every tick)

## State keys READ
- `macroConditions` — from `MacroConditionPacket` (emitted by Economy sector based on GDP/disaster events)
- Hospital simulator internal state: `world.state.beds`, `world.state.morgue`, `world.state.encounters` (direct access — accepted limitation per adapter invariants)

## State keys WRITTEN
- `lastKnownGood` — cached hospital state for circuit-breaker fallback
- `health.pressure` — aggregated from hospital occupancy
- `health.occupancyRate` — computed from beds / patients
- `health.diseasePrevalence` — aggregated encounter diagnoses
- `health.down` — circuit-breaker flag

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| (internal only — feeds sentinel output back as aggregated pressure) | — | — |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| `MacroConditionPacket` | world engine | admissionMultiplier, diseaseProfile applied to hospital config |
| `CLIMATE_EVENTS.DISASTER` | climate | heatwave → admissionMultiplier increased, disease mix shifted |

## Invariants
1. Zero modification of hospital simulator source code (verified by git diff)
2. Simulator advanced only via `step(world)` — never directly written
3. Patient-level data never exposed to world engine
4. No sentinel observes another sentinel's output
5. World engine never reads or writes hospital state directly

## Adapter invariants (from paper §2.5)
The adapter SHALL:
- Translate macro conditions into domain-relevant parameters, never inventing hospital behavior
- Preserve simulator autonomy (independent execution, testing, and versioning)
- Maintain deterministic execution through seeded RNG and stable iteration order
- Expose only aggregated pressure signals to the world engine, never individual patient data

The adapter SHALL NOT:
- Bypass the simulator's public `step()` interface to advance the simulation
- Leak patient-level details to the world engine
- Introduce non-deterministic behavior
- Allow one sentinel to observe another sentinel's output
- Let the world engine read or influence hospital state directly

## RNG sub-stream
- 0 calls per tick (hospital simulator manages its own RNG from derived seed)
- Seed derivation: `hashString(hospitalId) ^ worldSeed`

## Time complexity
- init: O(1) per sentinel instance
- tick: O(1) per sentinel instance (calls simulator step, extracts metrics)

## Wiring depth
- **deep** — full bidirectional feedback
