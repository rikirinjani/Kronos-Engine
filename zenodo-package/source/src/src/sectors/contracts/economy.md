# Sector: Economy

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| nations | Record<string, EconomyNationState> | tick | tick | Per-nation GDP, rates, volume |
| globalTradeVolume | number | tick | tick | |
| globalInflation | number | tick | tick | |
| marketIndex | number | tick | tick | |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| economy.gdp_shift | GDP change > 0.5% | nationId, gdpDelta, oldGdp, newGdp |
| economy.inflation_change | \|newRate - oldRate\| >= 0.3 | nationId, oldRate, newRate |
| economy.trade_shift | \|newVolume - oldVolume\| >= 3 | nationId, oldVolume, newVolume |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| geopolitics.war_start | geopolitics | Attacker: gdp+3%, defender: gdp-15%, growth/trade effects |
| geopolitics.war_casualties | geopolitics | GDP drain proportional to casualties × GDP |
| climate.extreme_weather | climate | All nations GDP × (1 - severity × 0.02) |

## Invariants
1. GDP >= 1e9 (floor)
2. inflationRate in [-2, 20]
3. tradeVolume in [0, 100]
4. unemploymentRate in [2, 15]
5. marketIndex >= 30
6. globalTradeVolume >= 50

## RNG Position
- ~5 per nation per tick (varies): growth noise, inflation drift, mean reversion, trade noise, growth rate drift
- Plus 3 global: trade noise, inflation drift, market noise
- **Order:** per-nation loop → global aggregates
