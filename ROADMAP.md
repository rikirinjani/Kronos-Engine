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

## Phase 1 — Calibration 🟡

### 1.1 Sensitivity Sweep Harness ✅
**Owner:** Branch Analyst
Completed: 3/5/10/20 seeds tested. Economy most reliable (5 sig). Climate weakest (0 sig — CO₂ drift). Key finding: calibration needed before more seeds.

### 1.2 Model Calibration 🟡 Active
**Owner:** Branch Analyst + World Archivist (historical baselines)
Three gaps:
- War casualties: 0.1% pop/tick produces ~10% of real WWII deaths — needs magnitude multiplier
- War economy: net-positive GDP effect (Kaleckian demand) — handler should support configurable sign
- Climate CO₂: RNG drift (±2 Gt/yr) overwhelms intervention signal at 30 ticks

Archivist available to produce reference data from Maddison/CLIO-INFRA.

### 1.3 Statistical Power ⏳
**Owner:** Branch Analyst
Scale from 3 to 30+ seeds. No code change needed. Blocked on 1.2 (calibrate first, then measure with power).

### 1.4 Contemporary Sentinel Counterfactual ⏳
**Owner:** Branch Analyst
Run counterfactual with Deers Rock (e.g., COVID-19 at RP-CONTEMP-002). Prove sentinel in full cross-sector experiment. Gates Phase 2.1.

---

## Phase 2 — Scale & Publication 🔵

### 2.1 Sentinel Network
**Owner:** Sector Engineer
Scale 3→30+ sentinels. ⛔ Blocked on Phase 1.4.

### 2.2 Paper 1 (JAMIA)
**Owner:** Paper OC + Research OC
⛔ Blocked on Phase 1.2 + 1.3.

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
