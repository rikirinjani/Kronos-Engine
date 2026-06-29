# Kronos Engine — Roadmap

**Status:** Finalized 2026-06-30
**Owner:** Meta Platform
**Contributors:** World Archivist, Sector Engineer, Branch Analyst, Timeline Governor

---

## Phase 0 — Foundation ✅

| Area | What | By Whom |
|---|---|---|
| Engine | Seeded RNG, UniverseID, World Engine, Rewind Points, Branch Engine | Timeline Governor |
| Sectors | Geopolitics, Climate, Economy, Technology, Energy, Demographics | Sector Engineer |
| Sentinel | Deers Rock adapter (zero DR modifications), multi-instance, circuit-breaker | Sector Engineer |
| History | 6 eras, 14 Rewind Points, cross-reference validation | World Archivist |
| Era loader | `src/engine/era-loader.ts` — hydrates `createWorld()` from era JSON | Sector Engineer + Timeline Governor |
| Counterfactuals | Diff Engine, multi-seed stats, CI/SD, Cohen's d, P-003 proof of concept | Branch Analyst |
| Governance | Self-harness, HANDOFF.md, 5 OMO agents, Constitution, ROADMAP | Meta Platform |
| Tests | 158+ tests, 17+ files, all passing | All |

---

## Phase 1 — Calibration

### 1.1 Sensitivity Sweep Harness
**Owner:** Branch Analyst
Systematically vary intervention magnitude + RNG noise floor to characterize signal-to-noise ratio per sector. Prerequisite for knowing how many seeds are needed for statistical significance.

### 1.2 Model Calibration
**Owner:** Branch Analyst + World Archivist (historical baselines)
P-003 revealed three calibration gaps:
- War casualties: 0.1% pop/tick produces ~10% of real WWII deaths — needs magnitude multiplier
- War economy: net-positive GDP effect (Kaleckian demand) — handler should support configurable sign
- Climate CO₂: RNG drift (±2 Gt/yr) overwhelms intervention signal at 30 ticks

Archivist can produce reference data from Maddison/CLIO-INFRA for per-nation GDP growth rates per decade and war casualty scaling factors.

### 1.3 Statistical Power
**Owner:** Branch Analyst
Scale from 3 to 30+ seeds per experiment. No code change needed — `runExperiment()` already supports arbitrary seeds.

### 1.4 Contemporary Sentinel Counterfactual
**Owner:** Branch Analyst
Run a counterfactual with Deers Rock (e.g., COVID-19 at RP-CONTEMP-002). Prove the sentinel in a full cross-sector experiment before scaling to 30 hospitals. Phase 2.1 blocked on this.

---

## Phase 2 — Scale & Publication

### 2.1 Sentinel Network
**Owner:** Sector Engineer
Scale from 3 to 30+ Deers Rock sentinels across Indonesian cities. Blocked on Phase 1.4 (contemporary DR counterfactual must pass first).

### 2.2 Paper 1 (JAMIA)
**Owner:** Paper OC + Research OC
Draft: architecture + sentinel pattern + cross-sector feedback loop + calibrated counterfactual data. **Hard prerequisites:** Phase 1.2 (calibration) + Phase 1.3 (statistical power) must be complete before paper-quality data can be generated.

### 2.3 CI/CD & Deploy
**Owner:** Platform OC
GitHub Actions (lint, typecheck, test on push), Railway auto-deploy, Dockerfile.

---

## Phase 3 — Product

### 3.1 Dashboard
Real-time visualization of world state, sector cross-talk, sentinel health.

### 3.2 API Layer
REST endpoints: status, snapshots, branch management, experiment submission.

### 3.3 Public Deployment
Live instance with controlled experiment access.

---

## Additional Sectors
Deferred until a specific feedback loop demands them (unanimous agent consensus). Current 6 sectors cover the strategic surface.

---

## Proposals Index

| # | Title | Status |
|---|---|---|
| P-001 | World Simulator Meta Platform | Approved |
| P-001A | Seed, Universe, Rewind Point Spec | Approved |
| P-001B | Meta Platform Sub-Agent Design | Approved |
| P-002 | Deers Rock Sentinel Adapter | Approved |
| P-003 | Counterfactual Experiment "No WWII" | Completed (proof of concept) |
