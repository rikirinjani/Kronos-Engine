# Sector: Deers Rock Sentinel

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| config | HospitalSentinelConfig | tick | init | Immutable after init |
| world | World | tick | tick | Internal DR simulator state |
| lastTickState | HospitalState | tick | tick | Used by circuit-breaker |
| sentinelOutput | HospitalSentinelOutput \| null | tick | tick | Aggregated daily stats |
| circuitBreakerTripped | boolean | tick | tick | Reset on successful step() |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| health.pressure | occupancyRate > 0.85 | hospitalId, city, occupancyRate |
| health.mortality | mortalityPressure > 0 | hospitalId, city, deaths |
| health.supply-crisis | supplyStress > 0.7 | hospitalId, city, supplyStress |
| health.surge | admissionSurge === true | hospitalId, city, occupancyRate |
| health.down | step() throws | hospitalId, city, error |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| (none) | — | Deers Rock receives macro injection via schedule(), not handlers |

## Invariants
1. Zero Deers Rock source code modifications
2. No patient-level data published to event bus
3. Sentinel output is local observation only — never extrapolated
4. Circuit-breaker: step() failure → lastKnownGood state + health.down event
5. Each sentinel has unique seed (djb2 hash of string ID)
6. Sentinel output tagged with hospitalId for origin tracking

## RNG Position
- N/A — sentinel uses Deers Rock's internal RNG, derived from `getHospitalSeed(worldSeed, hash(id))`
- Deers Rock RNG is independent of World Engine RNG
