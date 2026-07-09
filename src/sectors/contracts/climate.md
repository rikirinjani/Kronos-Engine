# Sector: Climate

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| co2Concentration | number | tick | tick | ppm, monotonic |
| annualEmissions | number | tick | tick | Gt, drifts |
| temperatureAnomaly | number | tick | tick | °C from pre-industrial |
| extremeEvents | ExtremeWeatherEvent[] | tick | tick | Append-only |
| seaLevelRise | number | tick | tick | mm, monotonic |
| annualEmissionsNoise | number | tick | init | Configurable (default 0.2) |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| climate.temp_shift | \|newAnomaly - oldAnomaly\| >= 0.01 | oldAnomaly, newAnomaly, co2Concentration |
| climate.emissions_change | \|newEmissions - oldEmissions\| >= 1 | oldEmissions, newEmissions |
| climate.extreme_weather | Probabilistic (eventChance per tick) | weatherType, region, severity, year, description |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| economy.gdp_shift | economy | Adjusts annualEmissions |

## Invariants
1. co2Concentration never decreases
2. temperatureAnomaly is monotonic (positive emissions always increase CO2)
3. annualEmissions >= 0
4. seaLevelRise monotonic
5. Formula: ΔT = 3 × log2(C / 280)

## RNG Position
- ~5 calls per tick: emissions noise, sea level, event chance check, weather type, severity
- **Order:** noise → sea level → event chance → type → severity
