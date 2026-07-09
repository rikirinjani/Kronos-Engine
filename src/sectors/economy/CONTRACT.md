# Sector Contract: economy

## Interface
- id: `"economy"`
- state type: `EconomyState`
- file: `src/sectors/economy.ts`
- cadence: 1 (every tick)

## State keys READ
- `nations.{id}.gdp` — current GDP
- `nations.{id}.wars` — active war IDs (from Geopolitics events)

## State keys WRITTEN
- `nations.{id}.gdp` — updated via growth formula
- `nations.{id}.gdpGrowthRate` — updated by war_start/war_end events
- `nations.{id}.inflationRate` — updated every tick
- `nations.{id}.tradeVolume` — updated every tick
- `nations.{id}.unemploymentRate` — updated every tick
- `globalTradeVolume` — aggregated every tick
- `globalInflation` — aggregated every tick
- `marketIndex` — global market index, updated every tick

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `ECONOMY_EVENTS.GDP_SHIFT` | every tick | `{ nationId, delta, cause }` |
| `ECONOMY_EVENTS.INFLATION_CHANGE` | every tick | `{ rate, nationId? }` |
| `ECONOMY_EVENTS.TRADE_SHIFT` | every tick | `{ volume, nationId? }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| `GEOPOLITICS_EVENTS.WAR_START` | geopolitics | attacker GDP +3%, growth +2.0; defender GDP -15%, growth -5.0 |
| `GEOPOLITICS_EVENTS.WAR_END` | geopolitics | growth rate restored, war removed from nation's war list |
| `CLIMATE_EVENTS.DISASTER` | climate | affected nations: GDP -5%, growth -1.0 for 5 ticks |
| `CLIMATE_EVENTS.TEMPERATURE_SHIFT` | climate | growth rate adjusted by -0.1 × anomaly |

## Invariants
- GDP never negative
- `gdpGrowthRate` clamped to [-10, 15]
- `inflationRate` clamped to [-5, 100]
- All nations present at init remain present (monotonic set)
- `marketIndex` never negative

## RNG sub-stream
- 1 call per tick (growth stochastic perturbation)
- Position in call order: 3rd (after Geopolitics, Climate)

## Time complexity
- init: O(n) where n = number of nations
- tick: O(n) — one pass over all nations
- handler: O(1) per event
