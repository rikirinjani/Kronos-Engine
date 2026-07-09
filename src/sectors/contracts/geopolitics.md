# Sector: Geopolitics

## State
| Key | Type | Read | Written | Notes |
|-----|------|------|---------|-------|
| year | number | tick | tick | Monotonic |
| tickCount | number | tick | tick | |
| casualtyMultiplier | number | tick | init | Configurable per era |
| nations | Record<string, Nation> | tick | tick | Nation.relations values drift |
| wars | Record<string, War> | tick | tick | casualties increments, status may change |
| alliances | Record<string, Alliance> | tick | — | Read-only |
| globalState | GlobalState | — | — | Informational |

## Events Emitted
| Event | Condition | Data |
|-------|-----------|------|
| geopolitics.relation_shift | \|newVal - oldVal\| >= 1 | nationId, otherId, oldVal, newVal |
| geopolitics.war_casualties | Per active war per tick | warId, casualtiesDelta, total |
| geopolitics.war_end | 5% chance per active war per tick | warId, name, totalCasualties |
| geopolitics.war_start | Relations < -60 + 2% chance | warId, name, attackers, defenders, year |

## Events Handled
| Event | Origin | Effect |
|-------|--------|--------|
| economy.gdp_shift | economy | Updates nation.gdp |

## Invariants
1. Nation.relations stay within [-100, 100]
2. War.casualties never decreases
3. tickCount increments by 1 per tick
4. year increments by 1 per tick
5. war.status goes active → ended (never reversed)

## RNG Position
- 8 calls per tick (avg): relation drift loop (1 per relation per nation), war casualties (1 per active war), war end check (1 per active war), new war check (per low-relation nation)
- **Order:** 1st call → drift, ... → casualty roll, → end check, → war start
