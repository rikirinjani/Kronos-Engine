# Sector Contract: demographics

## Interface
- id: `"demographics"`
- state type: `DemographicsState`
- file: `src/sectors/demographics.ts`
- cadence: 10 (every 10th tick)

## State keys READ
- (reads own state only, receives events from others)

## State keys WRITTEN
- `nations.{id}.population` — birth − death + migration
- `nations.{id}.birthRate` — updated per demographic transition model
- `nations.{id}.deathRate` — updated per demographic transition model
- `nations.{id}.medianAge` — aging pipeline
- `nations.{id}.dependencyRatio` — computed from age structure
- `nations.{id}.laborForceParticipation` — computed from dependency ratio
- `nations.{id}.netMigration` — stochastic regional migration
- `globalPopulation` — sum of all nations
- `globalMedianAge` — population-weighted average

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `DEMOGRAPHICS_EVENTS.POPULATION_SHIFT` | every tick | `{ nationId, delta, cause }` |
| `DEMOGRAPHICS_EVENTS.MIGRATION` | stochastic | `{ from, to, count }` |
| `DEMOGRAPHICS_EVENTS.LABOR_FORCE_CHANGE` | every tick | `{ nationId, rate, total }` |
| `DEMOGRAPHICS_EVENTS.AGING_SHIFT` | every tick | `{ nationId, medianAge }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| `GEOPOLITICS_EVENTS.WAR_START` | geopolitics | affected nations: death rate +50%, birth rate −20%, net migration negative |
| `GEOPOLITICS_EVENTS.WAR_END` | geopolitics | death rate recovers by −10% per tick toward baseline |
| `ECONOMY_EVENTS.GDP_SHIFT` | economy | GDP/capita growth reduces birth rate (demographic transition) |

## Invariants
- `population` never negative
- `birthRate` clamped to [0, 60] (per 1000)
- `deathRate` clamped to [0, 50] (per 1000)
- `medianAge` clamped to [10, 90]
- `dependencyRatio` clamped to [0, 1.5]
- `laborForceParticipation` clamped to [0, 1]
- `globalPopulation` is the exact sum of all nation populations

## RNG sub-stream
- 1–2 calls per tick (migration direction, birth/death noise)
- Position in call order: 6th (last sector)

## Time complexity
- init: O(n) where n = number of nations
- tick: O(n)
