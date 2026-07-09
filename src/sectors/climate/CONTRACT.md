# Sector Contract: climate

## Interface
- id: `"climate"`
- state type: `ClimateState`
- file: `src/sectors/climate.ts`
- cadence: 1 (every tick)

## State keys READ
- (none from other sectors — reads own state only)

## State keys WRITTEN
- `co2Concentration` — updated via emissions accumulation
- `annualEmissions` — updated every tick
- `temperatureAnomaly` — computed from CO₂ via log₂ relationship
- `extremeEvents` — generated stochastically based on anomaly
- `seaLevelRise` — accumulated from temperature

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `CLIMATE_EVENTS.TEMPERATURE_SHIFT` | every tick | `{ anomaly, co2 }` |
| `CLIMATE_EVENTS.DISASTER` | stochastic, based on anomaly | `{ type, region, severity }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| (none) | — | — |

## Invariants
- `co2Concentration` never below 280 (pre-industrial baseline)
- `temperatureAnomaly` never negative (baseline = 0 at 280ppm)
- `annualEmissions` never negative
- `seaLevelRise` monotonically non-decreasing
- Extreme event severity clamped to [0.1, 1.0]

## RNG sub-stream
- 1–2 calls per tick (disaster roll, severity roll)
- Position in call order: 2nd (after Geopolitics)

## Time complexity
- init: O(1)
- tick: O(1)
