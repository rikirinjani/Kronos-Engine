# Sector Contract: technology

## Interface
- id: `"technology"`
- state type: `TechnologyState`
- file: `src/sectors/technology.ts`
- cadence: 5 (every 5th tick)

## State keys READ
- `nations.{id}.gdp` — from Economy state (via ECONOMY_EVENTS)

## State keys WRITTEN
- `nations.{id}.technologyLevel` — updated via R&D spend model
- `nations.{id}.rdSpending` — % of GDP allocated to R&D
- `nations.{id}.researchOutput` — computed from spend × existing level
- `nations.{id}.innovationCount` — incremented on breakthroughs
- `nations.{id}.patents` — incremented on breakthroughs
- `globalTechLevel` — global average
- `recentInnovations` — ring buffer of last 10 breakthroughs

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `TECHNOLOGY_EVENTS.BREAKTHROUGH` | stochastic per nation | `{ nationId, innovation, impact }` |
| `TECHNOLOGY_EVENTS.LEVEL_SHIFT` | every tick | `{ globalLevel, maxLevel }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| `ECONOMY_EVENTS.GDP_SHIFT` | economy | R&D budget recalculated as % of new GDP |
| `ECONOMY_EVENTS.INFLATION_CHANGE` | economy | R&D spending adjusted for inflation |

## Invariants
- `technologyLevel` clamped to [0, 100]
- `rdSpending` clamped to [0, 15] (% of GDP)
- `innovationCount` monotonically non-decreasing
- `recentInnovations` never holds more than 10 entries

## RNG sub-stream
- 1–3 calls per tick (breakthrough roll, impact roll)
- Position in call order: 4th (after Economy)

## Time complexity
- init: O(n) where n = number of nations
- tick: O(n)
