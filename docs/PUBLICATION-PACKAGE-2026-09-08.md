# Publication Package — Kronos Engine (JAMIA 2026)

**Date**: 2026-09-08  
**Status**: READY FOR FINAL AUTHOR REVIEW / SUBMISSION

---

## 1. Complete list of manuscript-language changes made in this session

### Round 1: 11 scientific-language fixes (prior session)
1. **Abstract Phase F framing** (L10): "independently confirmed" → "the Phase F results in this study"
2. **Abstract domain generalization** (L12): "validated across historical and healthcare domains" → "demonstrated across two domains (historical and healthcare)"
3. **§3.1 P-003 validation** (L257): "validates the historical domain" → "provides initial architectural validation of the historical domain"
4. **§2.6 climate contradiction** (L186): "no policy-relevant climate effect" → "the current experimental configuration produces no detectable climate effect"
5. **P-004 conclusion contradiction** (L412): "P-004 also empirically validated" → "P-004 also provided initial architectural validation of the health-domain sentinel"
6. **P-004 "real hospital effects"** (L414): "real hospital effects" → "system-level clinical effects"
7. **P-004 "100+ ticks"** (L414): "over 100+ ticks" → "across multiple simulation cycles"
8. **Limitations "cross-validated"** (L377): "cross-validated experimentally" → "demonstrated by P-003 and P-004"
9. **§4.2 "regulatory-grade"** (L345): "regulatory-grade confidence" → "formal statistical confidence"
10. **§2.5 "independently runnable"** (L163): "independently runnable for other health domains" → "adaptable to other health domains; each sentinel instance derives its configuration from its calibration profile"
11. **Regional sentinel table header** (L359): "each hospital derives" → "each sentinel instance derives"
12. **Conclusion aspirational language** (L430): "a step toward reliable, transparent counterfactual reasoning about complex health systems" → "a foundational component for rigorous health-system simulation studies"

### Round 2: 5 final manuscript-language fixes (prior session)
1. **P-004 conclusion contradiction** (L412): "provided initial architectural validation of the health-domain sentinel" → "demonstrated health-domain propagation without empirical clinical validation"
2. **Determinism claim qualified** (L228): "Deterministic replay under identical seeds" → "Supports reproducible re-execution of identical experimental sequences under stated execution conditions"
3. **p = 0.903 framing** (L275): "statistically indistinguishable from chance" → "close to the number expected by chance under the nominal α = 0.05 threshold"
4. **Climate delay framing** (L283): "realistic one-day propagation lag" → "introducing a one-day propagation delay"
5. **Table 2 header** (L359): "each hospital derives" → "each sentinel instance derives"

### Round 3: 4 publication-preparation fixes (this session)
1. **Figure 2 caption** (L439): "WWII GDP divergence — bar chart with 95% confidence intervals for all nine nations, ordered by magnitude" → "WWII GDP null result — 95% CIs for all nine primary outcomes (all non-significant under multiplicity correction)"
2. **Comparison table** (L355): "Native (seeded RNG, sorted order)" → "Partial (KE core; Deers Rock dependency not yet seeded; see Section 3.5)"
3. **§4.1** (L335): "developed, tested, and validated independently" → "developed and tested independently"
4. **§4.4** (L363–365): Added new limitation bullet: "Healthcare-simulator reproducibility: The hospital simulator wrapped by P-004 uses unseeded pseudo-random functions (`Math.random()` / `Date.now()`); consequently, P-004 is not byte-reproducible run-to-run (Section 3.5). The frozen committed summary is the reference artifact for that experiment."

### Round 4: Figure placeholder consistency (this session)
1. **Figure 2 placement marker** (L273): "Bar chart of GDP divergence per nation with 95% CIs" → "Bar chart of GDP null result per nation with 95% CIs. All nine primary outcomes are non-significant under Bonferroni-corrected threshold."

---

## 2. Global consistency search results

**Patterns searched** (13 terms):
- `regulatory-grade` → 0 matches in primary MS ✅
- `cross-validated` → 0 matches in primary MS ✅
- `validated independently` → 0 matches in primary MS ✅
- `definitive evidence` → 0 matches in primary MS ✅
- `proven causal` → 0 matches in primary MS ✅
- `rigorous statistical` → 0 matches in primary MS ✅
- `comprehensive evidence` → 0 matches in primary MS ✅
- `independently confirmed` → 0 matches in primary MS ✅
- `empirically confirmed` → 0 matches in primary MS ✅
- `GDP divergence` → 0 matches in primary MS (fixed L273 + L439) ✅
- `real hospital effects` → 0 matches in primary MS ✅
- `100+ ticks` → 0 matches in primary MS ✅
- `cross-platform` → 0 matches in primary MS ✅

**Residual matches** exist in superseded older drafts (v1-draft, v2-redraft, v3-redraft2, v4-agent-reviewed, (7)). These are historical artifacts and do not affect the primary manuscript.

---

## 3. Artifact integrity confirmation

| Artifact | Location | Frozen | Authoritative |
|----------|----------|--------|---------------|
| P-003 calibrated summary | `experiment-results/wwii-counterfactual/p003-calibrated-summary.json` | ✅ | ✅ |
| P-003 calibrated runs | `experiment-results/wwii-counterfactual/p003-calibrated-runs.json` | ✅ | ✅ |
| P-003 sensitivity sweep | `experiment-results/wwii-counterfactual/sensitivity-sweep.json` | ✅ | ✅ |
| P-004 30-seed summary | `experiment-results/dr-counterfactual/p004-30seeds-summary.json` | ✅ | ✅ |
| P-004 30-seed runs | `experiment-results/dr-counterfactual/p004-30seeds-runs.json` | ✅ | ✅ |
| P-004 heatmap | `experiment-results/dr-counterfactual/heatmap.json` | ✅ | ✅ |
| Phase F manifest | `experiment-results/phase-f/manifest.json` | ✅ | ✅ |
| Phase F statistical summary | `experiment-results/phase-f/statistical-summary.json` | ✅ | ✅ |
| Phase F results | `experiment-results/phase-f/results.json` | ✅ | ✅ |

**Git provenance**: commit `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9`, branch `master`, tag `baseline-pre-reopen`.

---

## 4. Zenodo evidence package

**Location**: `zenodo-package/` (in repository root)  
**Contents**: 24 files, ~5MB total

| Directory | Contents |
|-----------|----------|
| `manuscript/` | Primary manuscript (Markdown) |
| `evidence/p003-wwii/` | 5 frozen JSON files (P-003 WWII counterfactual) |
| `evidence/p004-dr-sentinel/` | 7 frozen JSON files (P-004 Deers Rock sentinel) |
| `evidence/phase-f-causal/` | 4 frozen JSON/MD files (Phase F causal-null replication) |
| `documentation/` | 4 docs (freeze, claim audit, submission readiness, reproducibility) |
| `software/` | .zenodo.json, CITATION.cff, LICENSE |

**Zenodo metadata**: Updated `.zenodo.json` with correct title, description, keywords, creator ORCID, and dataset type.

**Zenodo publication blocker**: Repository is private. No API token found in MemPalace. Publication requires:
1. GitHub repository made public (or Zenodo GitHub integration authorized for private repos)
2. Zenodo API token provided by author
3. Human-initiated publication command

---

## 5. Remaining action items

1. **Author review** of manuscript changes (Rounds 1–4)
2. **Zenodo publication**: Requires human authorization (credentials not found)
3. **GitHub release**: Tag a release once manuscript is accepted
4. **ORCID verification**: Confirm 0009-0002-9364-2637 is publicly linked
5. **Figure preparation**: Replace figure placeholders with actual generated figures (outside scope of this work)

---

## Declaration

**Kronos Engine publication package READY FOR FINAL AUTHOR REVIEW / SUBMISSION.**

All manuscript claims are grounded in frozen evidence. All frozen artifacts are verifiable against commit `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9`. The manuscript does not fabricate authors, ORCID, affiliations, DOI, or Zenodo identifiers. The manuscript does not claim cross-platform reproducibility, byte-identical reproducibility (except P-003 and Phase F), empirical clinical validity, or validated health outcomes.

The Zenodo evidence package is assembled and ready for publication pending human authorization.
