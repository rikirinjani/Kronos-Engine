# P-008: TabFM Integration for Branch Analyst

**Proposed by:** Meta Platform
**Status:** Proposal — ready for Sector Engineer
**Date:** 2026-07-13
**Source:** TabFM knowledge graph entry + memory search

---

## What is TabFM

Google's tabular foundation model. Zero-shot classification of tabular data. Apache-2.0, 1.7k stars. Scikit-learn compatible. No paper — code-first release.

**Repo:** `https://github.com/google-research/tabfm`
**Backend:** JAX or PyTorch
**Interface:** FastAPI sidecar with `/classify` endpoint

---

## Why Branch Analyst needs it

Currently BA reports raw statistics: "GDP Delta +$31.3B, Cohen's d = 1.13, significant."

With TabFM, BA can CLASSIFY counterfactual outcomes into interpretable patterns:

| Before | After |
|--------|-------|
| "USA GDP +$31.3B, d=1.13" | "❌ War cancellation → Class 3 economic recovery pattern (USA, confidence 0.78)" |
| "Occupancy rate +0.01, d=0.70" | "⚠️ Climate intervention → weak hospital pressure signal (Makassar, confidence 0.62)" |

TabFM doesn't replace stats — it adds a semantic layer on top.

---

## Architecture

```
Branch Analyst (TS)
    │
    ├── CounterfactualDiff → metric values (existing)
    │
    └── TabFM Bridge ──HTTP──→ TabFM Sidecar (Python/FastAPI)
                                    │
                                    └── /classify
                                        Input: tabular row (metrics per sector)
                                        Output: { label, confidence }
```

5 examples per intent class. Zero-shot — no training data, no retraining.

---

## Scope

### Phase 3 deliverable
1. Clone and install TabFM repo (pip install with JAX or PyTorch)
2. Wrap TabFM in FastAPI sidecar: `POST /classify` endpoint
3. Create `src/bridge/tabfm-bridge.ts` — TypeScript HTTP client
4. Wire into Branch Analyst's `diff-engine.ts` or `stats.ts`: classify each experiment run's outcome vector
5. Add classification output to `StatisticalSummary` and `ExperimentRun` types
6. Expose via API: `GET /api/experiments/:id/classification`

---

## Intent classes (starter set)

| Class | Description | Example trigger |
|-------|-------------|-----------------|
| `economic_recovery` | GDP growth across all nations | No-WWII counterfactual |
| `economic_collapse` | GDP decline across all nations | Trade embargo |
| `supply_chain_disruption` | Energy + trade volume shifts | Oil shock |
| `population_shock` | Birth/death rate anomaly | Pandemic |
| `climate_drift` | CO₂ + temperature trajectory change | Emissions policy |
| `no_effect` | Below significance threshold | Shallow intervention |
| `hospital_pressure` | Sentinel occupancy + CSSD spike | Heatwave → health |

---

## Effort

| Step | Time |
|------|------|
| Clone + install TabFM | 30 min |
| FastAPI sidecar | 1h |
| TS bridge (`tabfm-bridge.ts`) | 1h |
| Wire into diff-engine + types | 1h |
| API endpoint + tests | 1h |
| **Total** | **~5h** |

---

## Not in scope

- Training or fine-tuning TabFM
- Real-time classification during experiment runs (batch only)
- LLM integration (TabFM is a tabular model, not a language model)
