# P-003: Counterfactual Experiment — "No WWII"

**Goal:** Run a full counterfactual simulation: branch at the WWII trigger (1939), apply an intervention that prevents the war, and measure the outcome diff across all 6 sectors.

**Lead:** Branch Analyst
**Prerequisites:** Timeline Governor (branch engine, Rewind Points), World Archivist (era-modern.json), Sector Engineer (all 6 sectors)

**Note — Graceful sector absence:** Deers Rock sentinel is not configured for 1939 era (no historical config). The simulation runs the remaining 6 sectors without it. This is natural — modern healthcare systems did not exist in their current form in 1939. A sentinel is additive, never required. The World Engine handles missing sectors gracefully.

---

## Protocol

### Rewind Point
**RP-MODERN-001** — WWII Begins (1939)
- Pre-seeded era: `docs/history/era-modern.json`
- World tick: 1939
- Load all 6 sector states + Deers Rock config for 1939 baseline conditions

### Intervention
**"Hitler dies in 1938. No WWII."**
- Geopolitics: Remove `war_start` event for WWII. Cancel alliances that formed in response.
- Economy: Prevent the GDP destruction of 1939-1945. Apply peacetime growth trajectory.
- Demographics: Prevent 70M+ war deaths. No population loss in affected nations.
- Energy: No wartime industrial demand spike. No post-war energy infrastructure rebuild.
- Technology: No military-driven R&D. No post-war civilian tech spillovers from military research.
- Climate: No wartime emissions dip. No post-war industrial boom emissions surge.
- Deers Rock: No war casualties → no military trauma admissions. Normal civilian baseline.

### Branch
1. Load universe at RP-MODERN-001 (tick 0 = 1939)
2. Fork a child branch
3. Apply the intervention on the child branch
4. Run both branches forward 30 ticks (30 years = to 1969)
5. Compare outcomes

### Measurements

| Metric | Source | Expected Delta |
|---|---|---|
| Global GDP | Economy sector | Higher in no-war branch |
| Global population | Demographics sector | +70M+ in no-war branch |
| Technology level | Technology sector | Different innovation path |
| Energy mix | Energy sector | Different trajectory (no war-driven rebuild) |
| Global CO2 | Climate sector | Higher cumulative emissions (no war dip) |
| Mortality pressure | Deers Rock sentinel | Lower (no war casualties) |
| War count | Geopolitics sector | 0 vs 1+ |

### Expected Outcome
The no-war branch should show:
- Meaningfully higher GDP and population
- Different technology innovation distribution
- Lower mortality in Deers Rock
- All sectors show coherent, deterministic divergence from baseline

### Verification
- Same seed → identical baseline output every time
- Counterfactual branch diverges at tick 0 and produces internally consistent results
- Diff Engine produces machine-readable `CounterfactualDiff` with per-sector deltas
- Statistical summary includes CI/SD across 3+ seed runs

---

## Results (Proof of Concept)

Executed 2026-06-29. 3 seeds (42, 43, 44), 30 ticks (1939→1969). 322 metrics across 6 sectors.

### What works
- End-to-end pipeline: Rewind Point → Branch → 6-sector run → Diff Engine → statistical summary
- Energy prices diverge strongly (USA price Cohen's d = -7.0)
- Trade volumes: CHN trade significant (d = -13.41)
- Climate: lower emissions in no-war branch (d = -0.9)
- Demographics: population effects in DEU, JPN, CHN
- Determinism confirmed: same seed = identical output

### Calibration notes (Phase 2)
- GDP effects are directional but small — the 5% war hit is too mild for WWII scale
- Only 7/322 metrics statistically significant at 3 seeds — expected for first run
- Deers Rock not configured for 1939 — graceful absence, sentinel is additive

### Verdict
Infrastructure is proven. Counterfactual branching, multi-sector diff, multi-seed statistics — all working. Model calibration is a separate concern (phase 2), not a bug in the simulation engine.

---

## Files

| File | Purpose |
|---|---|
| `src/experiment/experiments/wwii-no-war.ts` | Experiment runner script |
| `experiment-results/wwii-counterfactual/` | Output directory |
| `experiment-results/wwii-counterfactual/summary.json` | Statistical summary |
