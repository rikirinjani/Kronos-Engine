# Sector Contract: geopolitics

## Interface
- id: `"geopolitics"`
- state type: `GeopoliticsState`
- file: `src/sectors/geopolitics.ts`
- cadence: 1 (every tick)

## State keys READ
- `nations` — from own state (init from era config)
- (reads technology level indirectly via nation config)

## State keys WRITTEN
- `nations.{id}.relations` — bilateral relations, updated via drift + events
- `nations.{id}.militaryPower` — updated from GDP + technology
- `wars` — active war registry, appended on WAR_START, updated on WAR_END
- `alliances` — alliance registry
- `globalState` — aggregated metrics

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `GEOPOLITICS_EVENTS.WAR_START` | stochastic (relation threshold + roll) | `{ warId, attackers, defenders, cause }` |
| `GEOPOLITICS_EVENTS.WAR_END` | war duration exceeded or diplomatic resolution | `{ warId, winner, loser }` |
| `GEOPOLITICS_EVENTS.ALLIANCE_FORMED` | relation threshold crossed | `{ allianceId, members, type }` |
| `GEOPOLITICS_EVENTS.RELATION_SHIFT` | every tick | `{ nationA, nationB, delta }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| (none) | — | — |

## Invariants
- Nation set is monotonic (no nations removed after init)
- War IDs are unique
- `militaryPower` never negative
- Relations symmetric: `relations[a][b] === relations[b][a]`

## RNG sub-stream
- 2–4 calls per tick (relation drift, war roll, war end check, alliance roll)
- Position in call order: 1st (first sector)

## Time complexity
- init: O(n²) where n = number of nations (relation matrix init)
- tick: O(n²) — pairwise relation updates
