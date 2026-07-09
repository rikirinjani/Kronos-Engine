# Sector: Technology

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| nations | Record<string, TechNationState> | tick | tick | Per-nation tech level, patents |
| globalTechLevel | number | tick | tick | Average across nations |
| recentInnovations | string[] | tick | tick | Reset each tick |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| technology.innovation | Probabilistic (techLevel × 0.003 per tick) | nationId, innovation, techLevel, year |
| technology.diffusion | Tech gap > 0 + diffusion rate | fromNation, toNation, amount, year |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| economy.gdp_shift | economy | Adjusts researchOutput |

## Invariants
1. technologyLevel in [0, 100]
2. rdSpending in [0.001, 0.1]
3. patent count monotonic
4. innovationCount monotonic

## RNG Position
- ~2 per nation per tick: R&D efficiency, growth rate drift
- Plus diffusion rate per follower nation, innovation check per nation
- **Order:** per-nation loop → efficiency → drift → innovation check → diffusion loop
