# Sector Contract: energy

## Interface
- id: `"energy"`
- state type: `EnergyState`
- file: `src/sectors/energy.ts`
- cadence: 3 (every 3rd tick)

## State keys READ
- `nations.{id}.gdp` — from Economy (via GDP_SHIFT event)
- `nations.{id}.wars` — from Geopolitics (via WAR_START event)
- Climate CO₂ and temperature (via CLIMATE_EVENTS)

## State keys WRITTEN
- `nations.{id}.energyMix` — share of oil/gas/coal/nuclear/renewable
- `nations.{id}.totalConsumption` — total energy demand
- `nations.{id}.energyPrice` — domestic price index
- `nations.{id}.energySecurity` — 0–1 score
- `nations.{id}.co2Intensity` — CO₂ per unit energy
- `globalEnergyPrice` — global average
- `globalRenewableShare` — fraction of global mix from renewables

## Events EMITTED
| Event | Condition | Payload |
|-------|-----------|---------|
| `ENERGY_EVENTS.PRICE_SHIFT` | every tick | `{ price, nationId? }` |
| `ENERGY_EVENTS.MIX_SHIFT` | every tick | `{ renewableShare, nationId? }` |
| `ENERGY_EVENTS.SUPPLY_SHOCK` | stochastic | `{ region, severity, cause }` |

## Events HANDLED
| Event | Origin | Effect |
|-------|--------|--------|
| `GEOPOLITICS_EVENTS.WAR_START` | geopolitics | affected nations: energy price +20%, supply shock risk increases |
| `GEOPOLITICS_EVENTS.WAR_END` | geopolitics | energy price normalized, security restored |
| `CLIMATE_EVENTS.DISASTER` | climate | affected regions: renewable output drops, price spikes |
| `CLIMATE_EVENTS.TEMPERATURE_SHIFT` | climate | cooling/heating demand shifts energy mix |
| `ECONOMY_EVENTS.GDP_SHIFT` | economy | energy demand scales with GDP |
| `TECHNOLOGY_EVENTS.BREAKTHROUGH` | technology | renewable share may jump on relevant breakthroughs |

## Invariants
- `energyMix` components sum to 1.0 (±0.01)
- Each `energyMix` component clamped to [0, 1]
- `energyPrice` never negative
- `energySecurity` clamped to [0, 1]
- `co2Intensity` never negative

## RNG sub-stream
- 1 call per tick (supply shock roll)
- Position in call order: 5th (after Technology)

## Time complexity
- init: O(n) where n = number of nations
- tick: O(n)
