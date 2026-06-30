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

## Phase 3 — Product (Counterfactual Query Engine)

**Framing:** *"Retrospective validation. Prospective application."*

Kronos is not a simulation viewer. It's a counterfactual query engine — you ask "what if?" and it answers with sector-level diffs and statistical confidence.

### Niche 1 — Policy Stress-Testing
*"Indonesia adds 50 beds per province in 2027. What happens under +2°C warming + recession + pandemic?"*
→ 1000 branches from today, cross-sector ensemble output.

### Niche 2 — Hospital Investment / Insurance
*"Should I build a 300-bed hospital in Jayapura?"*
→ Branch today with/without beds. Measure mortality, referrals, supply stress over 5 years. ROI curve output.

### Niche 3 — Early Warning / Pre-mortem
*"Which hospital failure would cause the most damage?"*
→ Disable each sentinel one at a time. Ranked vulnerability map.

### Product architecture (Phase 3)
```
Browser ←WebSocket→ Kronos Server → runExperiment()
                         ↑
                  REST API (query, branch, diff, export)
                         ↓
                  SQLite journal (cached runs)
```

### 3.1 Dashboard
Experiment composer: pick Rewind Point → set intervention → run → see diff. Side-by-side timeline comparison. Publication-ready export.

### 3.2 API Layer
REST endpoints for: status, snapshot, branch, experiment submission, diff query, figure export.

### 3.3 Public Deployment
Live instance with controlled experiment access. Laboratory for asking "what if?"

---

---

## Phase 4 — Game Engine Integration (Speculative)

**Vision:** Kronos Engine as the narrative/economic backend for a real-time rendered world (Unreal Engine). Same adapter pattern as Deers Rock — the game engine doesn't know Kronos exists.

```
Kronos Engine (1 tick = 1 day)
  ↓ World state (GDP, wars, climate, resources)
Adapter (real-time polling)
  ↓ In-game events, NPC behavior, quest triggers
Unreal Engine (60 FPS rendering)
  ↑ Player actions, timeline branches
Adapter (intervention packaging)
  ↑ "What if" queries
Kronos Engine (branch engine diverges)
```

### What KE brings to a game
- **Geopolitics** → faction diplomacy, war, territory
- **Economy** → player-driven market prices, inflation, trade routes
- **Climate** → dynamic weather, disasters affecting regions
- **Demographics** → NPC population centers, migration, aging
- **Energy** → resource scarcity, tech tiers
- **Branch Engine** → world remembers player choices as diverged timelines. Server resets = restoring a Rewind Point.

### Status
Concept only. Post-paper, post-Somnium, post-product. Not on any active timeline.

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
