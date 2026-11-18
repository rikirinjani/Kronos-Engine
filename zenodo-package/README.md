# Kronos Engine v1.0.0 — Zenodo Research Artifact

**Repository**: `github.com/rikirinjani/Kronos-Engine` (not yet public; source available upon request)  
**Commit**: `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9`  
**Tag**: `baseline-pre-reopen`  
**Branch**: `master`  
**Software version**: 1.0.0  
**Manuscript**: "Kronos Engine: A Deterministic Counterfactual Experimentation Platform with Sentinel Adapter Pattern for Multi-Scale Health System Simulation" (JAMIA 2026 submission)  
**Author**: Riki Rinjani, Hisfarma IAI, ORCID 0009-0002-9364-2637

---

## 1. What Is Kronos Engine

Kronos Engine is a deterministic counterfactual experimentation platform for multi-scale health system simulation. It implements:

- A **deterministic tick-based world engine** with seeded PRNG (mulberry32)
- **Six coupled world sectors** (geopolitics, climate, economy, technology, energy, demographics) plus a health surveillance sector
- A **sentinel adapter pattern** (Deers Rock adapter) that bridges external hospital simulators to the Kronos event bus
- A **counterfactual diff engine** with statistical analysis (t-tests, BH-FDR, Bonferroni correction, Cohen's d/dz, noise-floor calculation)
- **Deterministic replay** under identical seeds for reproducible experiment execution

The system is written in pure TypeScript with zero runtime dependencies.

---

## 2. What This Release Represents

This release is the **frozen research artifact** accompanying the JAMIA 2026 manuscript. It preserves:

- The exact source code used to generate the reported experiments
- All frozen experiment result artifacts (P-003, P-004, Phase F, regional sentinel)
- The closed manuscript
- Documentation required for a reviewer to understand, inspect, and reproduce the reported work

The manuscript is **closed** — no further substantive changes are recommended. All claims are grounded in the frozen evidence included in this artifact.

---

## 3. Git Provenance

| Field | Value |
|-------|-------|
| Commit | `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` |
| Branch | `master` |
| Tag | `baseline-pre-reopen` |
| Freeze date | 2026-09-07 |

All experiment artifacts in `evidence/` correspond to this commit. The source snapshot in `source/` contains the same code at this commit.

---

## 4. Source Code and Experiment Artifacts

### Source Code (`source/`)

| Directory | Contents |
|-----------|----------|
| `source/src/` | 56 TypeScript files — engine, sectors, experiments, timeline, sim, bridge, API, data |
| `source/scripts/` | CLI scripts: `reproduce.ts`, `verify-facts.ts`, `generate-dashboard.ts` |
| `source/docs/` | Documentation, era configs, calibration reference, paper drafts |
| `source/package.json` | NPM manifest (version 1.0.0, zero runtime deps, Node ≥22) |
| `source/tsconfig.json` | TypeScript config (ES2022, NodeNext, strict) |
| `source/Dockerfile` | Multi-stage Node 24 Alpine build |

**Architecture**: 8 modules (engine, sectors, experiment, timeline, sim, bridge, api, data) + integration tests.  
**Test suite**: 37 test files, framework: Vitest 3.1+.  
**Build**: `tsc` → `dist/`. Zero runtime dependencies.

### Experiment Evidence (`evidence/`)

| Directory | Experiment | Contents |
|-----------|-----------|----------|
| `evidence/p003-wwii/` | P-003: WWII counterfactual | Calibrated summary (30 seeds), calibrated runs, sensitivity sweep |
| `evidence/p004-dr-sentinel/` | P-004: Deers Rock sentinel | 30-seed summary, 30-seed runs, heatmap |
| `evidence/phase-f-causal/` | Phase F: Causal-null replication | Manifest, statistical summary, per-seed results, report |

---

## 5. P-003 Evidence (WWII Counterfactual)

**Experiment**: "What if World War II had not occurred?" — deterministic no-war counterfactual with baseline (war) vs. intervention (no-war) comparison.

| Field | Value |
|-------|-------|
| Seeds | 30 (42–71) |
| Total metrics | 1,233 |
| Testable (non-degenerate) | 291 |
| Degenerate | 942 |
| Primary outcomes | 9 GDP metrics (one per nation) |
| Significant after BH-FDR | 0 of 9 primary outcomes |
| Significant after Bonferroni | 0 of 9 primary outcomes |
| Sole surviving metric | `wars.W-1939-01.casualties` (mechanical: ending a war stops its casualties) |

**Key files**:
- `p003-calibrated-summary.json` — Authoritative statistical summary
- `p003-calibrated-runs.json` — Per-run data
- `sensitivity-sweep.json` — Alpha-threshold sensitivity analysis

**Determinism**: P-003 is byte-reproducible under identical seeds.

**Limitation**: The WAR_START effect applies +3% GDP to attackers and −15% to defenders, but no compensating WAR_END effect is implemented. This structural asymmetry has not been quantitatively decomposed.

---

## 6. P-004 Evidence (Deers Rock Sentinel)

**Experiment**: Hospital sentinel counterfactual using the Deers Rock adapter.

| Field | Value |
|-------|-------|
| Seeds | 30 (42–71) |
| Total metrics | 199 |
| Testable (non-degenerate) | 106 |
| Degenerate | 93 |
| Significant after BH-FDR | 0 |
| Significant after Bonferroni | 0 |

**Key files**:
- `p004-30seeds-summary.json` — Authoritative statistical summary
- `p004-30seeds-runs.json` — Per-run data
- `heatmap.json` — Temporal-stability heatmap (5 Indonesian regions)

**Regional sentinel deployment**: 30 simulated sentinel instances across 5 Indonesian regions (Java, Sumatra, Kalimantan, Sulawesi, Eastern Indonesia). Occupancy range: 40.4% (Sulawesi) to 49.1% (Kalimantan). These are 30 instances of the Deers Rock simulator, not 30 heterogeneous hospitals.

**Determinism limitation**: The Deers Rock hospital simulator uses unseeded `Math.random()` and `Date.now()`. P-004 is **not byte-reproducible** run-to-run. The frozen committed summary (`p004-30seeds-summary.json`) is the reference artifact for all claims.

---

## 7. Phase F Evidence (Causal-Null Replication)

**Experiment**: Paired-execution causal-null test with outcome-shift architecture.

| Field | Value |
|-------|-------|
| Seeds | 5 (42–46) |
| Arms | Intervention (CO2=800) vs. Control (CO2=280) |
| Paired execution | Fresh-world, no forkBranch |
| Success criterion | Direction consistency ≥ 80% (4/5 seeds) |

**Primary outcomes**:

| Outcome | Mean Delta | Direction Consistency | Result |
|---------|-----------|----------------------|--------|
| occupancyRate | 0 | 0% | Structural null |
| icuOccupancyRate | 0 | 0% | Structural null |
| mortalityPressure | 0 | 0% | Structural null |
| supplyStress | 0.034 | 20% | Below threshold |

**Result**: Structural null — no consistent directional effects across seeds. The intervention/control configuration is verified operational, but the observable effect is structurally inert within the tested 20-tick horizon (integer quantization + discharge delay ≫ horizon).

**Key files**:
- `manifest.json` — Experiment configuration
- `statistical-summary.json` — Statistical results
- `results.json` — Per-seed results
- `report.md` — Narrative report

**Determinism**: Phase F is byte-reproducible under identical seeds.

---

## 8. Manuscript Package (`manuscript/`)

The final frozen manuscript is included as:

- `manuscript/jamia-2026-kronos-engine.md` — CLOSED version, no further changes recommended

The manuscript is exactly the version submitted for review. Do not rewrite it for Zenodo.

---

## 9. Documentation (`documentation/`)

| File | Contents |
|------|----------|
| `EXPERIMENT-FREEZE-2026-09-07.md` | Freeze protocol, artifact inventory, provenance |
| `CLAIM-AUDIT-2026-09-07.md` | 17-claim audit with evidence mapping |
| `SUBMISSION-READINESS-2026-09-07.md` | Pre-submission checklist |
| `REPRODUCIBILITY.md` | Reproduction instructions |

---

## 10. How to Inspect/Reproduce

```bash
# Clone (requires author approval — not yet public)
git clone https://github.com/rikirinjani/Kronos-Engine.git
git checkout 4d7e4128f6ad800fa762f443f36aa4f45d31e4d9

# Install
npm ci

# Run tests (37 test files)
npm test

# Re-run P-003 (deterministic)
npm run p003:calibrated

# Re-run Phase F (deterministic)
npm run phase-f

# P-004 cannot be byte-reproduced (unseeded PRNG)
# Refer to frozen artifacts in evidence/p004-dr-sentinel/
```

**Runtime requirements**: Node.js ≥22, npm  
**Build**: `tsc` (TypeScript 5.8+)  
**Zero runtime dependencies** — pure TypeScript

---

## 11. Determinism Scope

| Experiment | Byte-Reproducible | Notes |
|-----------|------------------|-------|
| Kronos Engine core | ✅ Yes | Deterministic mulberry32 PRNG, seeded execution |
| P-003 (WWII) | ✅ Yes | 30 seeds, deterministic under identical seeds |
| Phase F (causal-null) | ✅ Yes | 5 seeds, paired execution |
| P-004 (Deers Rock) | ❌ No | Unseeded `Math.random()`/`Date.now()` in hospital simulator |

Deterministic reproducibility applies to the Kronos Engine core under stated execution conditions, not automatically to the unseeded Deers Rock dependency.

---

## 12. Known Limitations

1. **P-004 non-byte-reproducibility**: The Deers Rock hospital simulator uses unseeded pseudo-random functions. P-004 results are based on frozen committed summaries, not re-execution.
2. **WAR_END asymmetry**: P-003 implements WAR_START effects but no compensating WAR_END effect. The common negative GDP sign has not been quantitatively decomposed.
3. **Phase F horizon**: 20-tick horizon may be insufficient for climate effects to propagate through integer-quantized hospital metrics.
4. **Regional sentinel homogeneity**: All 30 sentinel instances use the same Deers Rock simulator; they are not 30 heterogeneous hospitals.
5. **Repository not public**: The source code is available upon request, not yet published as open-source.

---

## 13. Manuscript Claim Classification

| Claim Type | Scope | Evidence |
|-----------|-------|----------|
| **Architectural** | Kronos Engine is a deterministic counterfactual platform | Source code, test suite, P-003 reproducibility |
| **Architectural** | Sentinel adapter pattern bridges external simulators | Deers Rock adapter implementation |
| **Exploratory** | P-003 produces no defensible GDP effect under multiplicity control | Frozen evidence, statistical analysis |
| **Exploratory** | P-004 demonstrates health-domain propagation | Frozen evidence (not byte-reproducible) |
| **Exploratory** | Phase F produces a structural null | Frozen evidence, 5 seeds |

**Not claimed**: Empirical clinical validity, validated health outcomes, cross-platform reproducibility, byte-identical reproducibility for P-004, regulatory-grade confidence.

---

## 14. Archive Contents

```
zenodo-package/
├── README.md                              ← This file
├── manuscript/
│   └── jamia-2026-kronos-engine.md        # Final frozen manuscript
├── source/                                # Source code snapshot
│   ├── src/                               # 56 TypeScript files
│   ├── scripts/                           # CLI scripts
│   ├── docs/                              # Documentation + era configs
│   ├── package.json                       # NPM manifest
│   ├── tsconfig.json                      # TypeScript config
│   ├── Dockerfile                         # Container build
│   ├── .zenodo.json                       # Zenodo metadata
│   ├── CITATION.cff                       # Citation metadata
│   └── LICENSE                            # MIT
├── evidence/                              # Frozen experiment artifacts
│   ├── p003-wwii/                         # P-003: WWII counterfactual
│   │   ├── p003-calibrated-summary.json   #   Authoritative summary
│   │   ├── p003-calibrated-runs.json      #   Per-run data
│   │   ├── sensitivity-sweep.json         #   Alpha-threshold sensitivity
│   │   ├── summary.json                   #   Original (superseded)
│   │   └── runs.json                      #   Original (superseded)
│   ├── p004-dr-sentinel/                  # P-004: Deers Rock sentinel
│   │   ├── p004-30seeds-summary.json      #   Authoritative summary
│   │   ├── p004-30seeds-runs.json         #   Per-run data (30 seeds)
│   │   ├── heatmap.json                   #   Temporal-stability heatmap
│   │   ├── p004-summary.json              #   Original (superseded)
│   │   ├── p004-runs.json                 #   Original (superseded)
│   │   ├── summary.json                   #   Composite summary
│   │   └── runs.json                      #   Composite runs
│   └── phase-f-causal/                    # Phase F: Causal-null replication
│       ├── manifest.json                  #   Experiment config
│       ├── statistical-summary.json       #   Statistical results
│       ├── results.json                   #   Per-seed results
│       └── report.md                      #   Narrative report
└── documentation/                         # Supplementary docs
    ├── EXPERIMENT-FREEZE-2026-09-07.md    #   Freeze protocol
    ├── CLAIM-AUDIT-2026-09-07.md          #   17-claim audit
    ├── SUBMISSION-READINESS-2026-09-07.md #   Pre-submission checklist
    └── REPRODUCIBILITY.md                 #   Reproduction guide
```

---

## 15. License

MIT License. See `source/LICENSE`.

---

## 16. Contact

Riki Rinjani — ORCID 0009-0002-9364-2637

Repository status: **not yet public**. Source available upon request.
