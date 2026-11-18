# Sector: Energy

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| nations | Record<string, EnergyNationState> | tick | tick | Per-nation energy mix, price, consumption |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| energy.price_shift | Price change > threshold | nationId, oldPrice, newPrice |
| energy.mix_shift | Mix ratio change > threshold | nationId, fuel, oldPct, newPct |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| economy.gdp_shift | economy | Adjusts consumption |
| technology.innovation | technology | Efficiency improvements, mix shifts |

## Invariants
1. Energy mix percentages sum to 100
2. energyPrice > 0
3. co2Intensity in [0, 1]
4. energySecurity in [0, 100]

## RNG Position
- ~3 per nation per tick: price noise, consumption drift, security drift
