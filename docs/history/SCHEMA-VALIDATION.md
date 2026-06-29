# StrategicWorldState — Schema & Validation

**Reference:** P-001A §3
**Maintained by:** World Archivist

## Package Structure

```
era-{name}.json
├── meta          — provenance and identification
├── rewindPoints  — array of RewindPoint definitions
└── states        — map of RP-ID → StrategicWorldState
```

## Validation Rules

### Meta

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `era` | string | yes | Must match `[a-z][a-z-]+` |
| `label` | string | yes | Human-readable display name |
| `span` | string | yes | Date range, e.g., "1991–present" |
| `seedPrefix` | string | yes | Must match `S-[A-Z]+` |
| `generated` | string | yes | ISO 8601 date |
| `archivist` | string | yes | Agent or person name |
| `description` | string | yes | ≤500 chars |

### Rewind Point

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | Must match `RP-[A-Z]+-NNN` |
| `year` | int | yes | CE year (negative for BCE) |
| `label` | string | yes | Concise, ≤60 chars |
| `calendarDate` | string | yes | ISO 8601 date or approximate |
| `description` | string | yes | ≤500 chars |

### Nation

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | 3-6 uppercase chars, unique across all eras |
| `name` | string | yes | Full name |
| `region` | string | yes | Must be in defined region taxonomy |
| `population` | int | yes | ≥ 0 |
| `gdp` | number | yes | ≥ 0 (nominal USD) |
| `territory.regionIds` | string[] | yes | ≥ 1 entry |
| `territory.capital` | string | yes | City name |
| `government` | enum | yes | One of: democracy, autocracy, monarchy, theocracy, transitional |
| `technologyLevel` | number | yes | 0.0 – 100.0 |
| `militaryPower` | number | yes | 0.0 – 100.0 (relative index) |
| `healthMetrics.lifeExpectancy` | number | yes | 0 – 120 years |
| `healthMetrics.infantMortality` | number | yes | per 1000 live births, ≥ 0 |
| `healthMetrics.hospitalBedsPer1000` | number | yes | ≥ 0 |
| `healthMetrics.universalCoverage` | bool | yes | — |
| `alliances` | string[] | yes | References existing Alliance.id |
| `wars` | string[] | yes | References existing War.id |
| `relations.*` | number | yes | -100 to +100 |

### War

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | Must match `W-YYYY-NN` |
| `name` | string | yes | ≤200 chars |
| `parties.attackers` | string[] | yes | References existing Nation.id |
| `parties.defenders` | string[] | yes | References existing Nation.id |
| `startYear` | int | yes | ≤ current era year |
| `status` | enum | yes | active, frozen, ended |
| `casualties` | int | yes | ≥ 0 |

### Alliance

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `id` | string | yes | Must match `[A-Z]{2,10}` |
| `name` | string | yes | ≤200 chars |
| `members` | string[] | yes | References existing Nation.id, ≥ 2 members |
| `formed` | int | yes | Year formed |
| `type` | enum | yes | defense, economic, political |
| `strength` | number | yes | 0.0 – 100.0 |

### Global State

| Field | Type | Required | Rule |
|-------|------|----------|------|
| `totalPopulation` | int | yes | ≈ sum of all nation populations |
| `avgTechnologyLevel` | number | yes | 0.0 – 100.0 |
| `avgHealthOutcome` | number | yes | Life expectancy proxy, 0 – 120 |
| `co2Emissions` | number | yes | Annual metric tons, ≥ 0 |
| `tradeVolume` | number | yes | Relative index, ≥ 0 |

## Region Taxonomy

```
north-america, central-america, south-america, caribbean
europe, mediterranean, eurasia
middle-east, north-africa, africa, east-africa, west-africa, central-africa, southern-africa
east-asia, southeast-asia, south-asia, central-asia, oceania
```

## Cross-Era Constraints

| Constraint | Rule |
|-----------|------|
| Nation ID stability | Same ID across eras = same nation (continuity assumed). Changing borders reflected in territory.regionIds. |
| Population continuity | A nation's population should not jump > 10× between adjacent eras without explanation. |
| Technology monotonicity | avgTechnologyLevel should not decrease globally across eras (local decline possible). |
| Relations symmetry | `relations.A.B` and (where B also has data) `relations.B.A` should be roughly symmetric (±10). |

## Calibration Metadata

Each era file must include a `calibration` block:

```json
{
  "sources": [
    { "attribute": "...", "source": "Citation", "note": "..." }
  ],
  "estimates": [
    { "attribute": "...", "note": "Why this is estimated" }
  ]
}
```

## Checklist for New Era Packages

- [ ] All Nation.ids reference valid, unique IDs
- [ ] All War references in Nation.wars exist in wars[]
- [ ] All Alliance references in Nation.alliances exist in alliances[]
- [ ] War parties reference valid Nation.ids
- [ ] Alliance members reference valid Nation.ids
- [ ] Relations values in [-100, 100]
- [ ] population ≥ 0, gdp ≥ 0
- [ ] technologyLevel in [0, 100], militaryPower in [0, 100]
- [ ] Alliance.strength in [0, 100]
- [ ] globalState.totalPopulation ≈ sum of nation populations
- [ ] calibration block present with sources and estimates
