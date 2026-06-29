# Kronos Engine — Roadmap (Draft)

**Status:** Draft — open for comment from all agents until finalized
**Owner:** Meta Platform
**How to comment:** Write your feedback under your agent's section in HANDOFF.md

---

## Phase 0 — Foundation ✅

| Area | What | By Whom |
|---|---|---|
| Engine | Seeded RNG, UniverseID, World Engine, Rewind Points, Branch Engine | Timeline Governor |
| Sectors | Geopolitics, Climate, Economy, Technology, Energy, Demographics | Sector Engineer |
| Sentinel | Deers Rock adapter (zero DR modifications), multi-instance, circuit-breaker | Sector Engineer |
| History | 6 eras, 14 Rewind Points, cross-reference validation | World Archivist |
| Counterfactuals | Diff Engine, multi-seed stats, CI/SD, Cohen's d, P-003 executed | Branch Analyst |
| Governance | Self-harness, HANDOFF.md, 5 OMO agents, Constitution | Meta Platform |
| Tests | 158 tests, 17 files, all passing | All |

---

## Phase 1 — Calibration & Infrastructure

### 1.1 Era-to-World JSON Loader
**Owner:** Timeline Governor → Sector Engineer
Build a loader that hydrates `createWorld()` directly from era JSON files in `docs/history/`. Future experiments skip manual config wiring — just point at an era file.

### 1.2 Model Calibration
**Owner:** Branch Analyst + Research OC
P-003 showed directional effects but weak magnitude (e.g., WWII GDP hit at 5% is too small). Calibrate war/destruction parameters against historical data. Re-run P-003 with calibrated params.

### 1.3 Statistical Power
**Owner:** Branch Analyst
Scale from 3 seeds to 30+ seeds per experiment for statistically significant results.

### 1.4 CI/CD & Deploy
**Owner:** Platform OC
- GitHub Actions: lint, typecheck, test on push
- Railway auto-deploy from main
- Dockerfile for local dev

---

## Phase 2 — Scale & Publication

### 2.1 Sentinel Network
**Owner:** Sector Engineer
Scale from 3 to 30+ Deers Rock sentinels across Indonesian cities. Each gets derived seed, local config, independent operation.

### 2.2 Paper 1 (JAMIA)
**Owner:** Paper OC + Research OC
Draft: architecture + sentinel pattern + cross-sector feedback loop + P-003 proof of concept data. Target: JAMIA.

### 2.3 Additional Sectors (if needed)
**Owner:** Sector Engineer
Agriculture, Trade, Infrastructure, Education — only if new feedback loops are needed.

---

## Phase 3 — Product

### 3.1 Dashboard
Real-time visualization of world state, sector cross-talk, sentinel health.

### 3.2 API Layer
REST endpoints mirroring Deers Rock pattern — status, snapshots, branch management.

### 3.3 Public Deployment
Live instance with controlled experiment access.

---

## Proposals Index

| # | Title | Status |
|---|---|---|
| P-001 | World Simulator Meta Platform | Approved |
| P-001A | Seed, Universe, Rewind Point Spec | Approved |
| P-001B | Meta Platform Sub-Agent Design | Approved |
| P-002 | Deers Rock Sentinel Adapter | Approved |
| P-003 | Counterfactual Experiment "No WWII" | Completed (proof of concept) |

---

*Draft — open for comment. Agents: submit feedback via HANDOFF.md.*
