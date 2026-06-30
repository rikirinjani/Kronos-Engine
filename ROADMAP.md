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
| CI/CD | GitHub Actions, Dockerfile, Railway config | Sector Engineer |
| Tests | 175 tests, 20 files, all passing | All |

---

## Phase 1 — Calibration ✅

### 1.1 Sensitivity Sweep Harness ✅
Completed: 3/5/10/20 seeds tested across 6 sectors. Economy most reliable.

### 1.2 Model Calibration ✅
Completed: 4 gaps closed (casualty multiplier, war→GDP attacker/defender split, climate CO₂ noise reduction, economy wars[] init bug). P-003 re-run at 30 seeds: 36/1421 significant, all 9 nation GDP metrics significant with d > 1.0.

### 1.3 Statistical Power ✅
30-seed proven in P-003 re-run. `runExperiment()` supports arbitrary seeds.

### 1.4 Contemporary Sentinel Counterfactual ✅
**Owner:** Branch Analyst
Completed: DR sentinel ran at RP-CONTEMP-002 (COVID-19), 30 seeds. 14/156 metrics significant. Sentinel pipeline verified end-to-end. Key signals: occupancyRate (d=0.70), diseasePrevalence (d=0.91), CSSD cycles (d=-2.71), dialysis sessions (d=1.11).

---

## Phase 2 — Scale & Publication 🔵 Next

### 2.1 Sentinel Network
**Owner:** Sector Engineer
Scale 3→30+ sentinels. ✅ Unblocked — DR proven in cross-sector experiment.

### 2.2 Paper 1 (JAMIA)
**Owner:** Paper OC + Research OC
Calibrated data (P-003, 30 seeds) + DR sentinel proof (P-004, 30 seeds) available. ✅ Unblocked.

### 2.3 CI/CD & Deploy ✅
**Owner:** Platform OC
GitHub Actions, Dockerfile, Railway config — delivered.

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
