# Sector: Demographics

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| nations | Record<string, DemoNationState> | tick | tick | Per-nation population, rates, age structure |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| demographics.population_shift | Population change > threshold | nationId, oldPop, newPop |
| demographics.aging_shift | Median age change > threshold | nationId, oldAge, newAge |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| economy.gdp_shift | economy | Affects migration, labor force |
| technology.innovation | technology | Affects life expectancy, birth rates |

## Invariants
1. Population >= 0
2. birthRate, deathRate in [0, 100]
3. medianAge in [0, 100]
4. dependencyRatio in [0, 100]
5. laborForceParticipation in [0, 100]

## RNG Position
- ~3 per nation per tick: birth drift, death drift, migration noise
