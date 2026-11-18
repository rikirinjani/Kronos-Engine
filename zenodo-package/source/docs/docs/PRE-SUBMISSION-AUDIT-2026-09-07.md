# Pre-Submission Audit: jamia-2026-kronos-engine.md

**Updated:** 2026-09-07 (post-F1–F17 reconciliation)
**Manuscript:** `docs/papers/jamia-2026-kronos-engine.md`
**Previous audit:** 2026-09-06 (CONDITONAL FREEZE)

---

## Audit Summary

| Category | Items | Status |
|---|---|---|
| BLOCKERS | 0 | ✅ None |
| REQUIRED MANUSCRIPT FIXES (F1–F17) | 17 | ✅ All applied |
| EVIDENCE STATUS | All pass | ✅ Consistent |
| FINAL VERDICT | — | **FREEZE — READY FOR HUMAN AUTHOR REVIEW** |

---

## BLOCKERS

**None.**

All critical issues from the 2026-09-06 audit have been resolved:
- C1 (fabricated hospital table): Removed in prior session
- C2 (integration test overclaim): Corrected in prior session
- C3 (contribution overclaims): Fixed by F1–F3
- C4 (byte-reproducibility claim): Fixed by F4

---

## REQUIRED MANUSCRIPT FIXES — All Applied

### F1–F4: Terminology & Scope Corrections

| # | Location | Change | Status |
|---|---|---|---|
| F1 | Abstract L19 | "independently validated" → "independently developed" | ✅ |
| F2 | Abstract L23 | "independently validated" → "independently developed" | ✅ |
| F3 | Contribution #3 L43 | "independently validated" → "independently developed" | ✅ |
| F4 | Section 2.2 L83 | "byte-reproducible" → "seed-reproducible" | ✅ |

### F5–F8: Accuracy & Counts

| # | Location | Change | Status |
|---|---|---|---|
| F5 | Section 2.2 L89 | "immutable audit trail" → "reproducible audit artifacts" | ✅ |
| F6 | Section 2.4 L119 | "implemented and validated" → "implemented and integration-tested" | ✅ |
| F7 | Section 3.4 L299 | "323 tests, 36 files" → "333 tests, 37 files; 1 pre-existing timeout excluded from analysis" | ✅ |
| F8 | Supplementary L409 | "All 323 tests" → "332 of 333 tests pass (1 pre-existing timeout)" | ✅ |

### F9–F13: Framing & Language

| # | Location | Change | Status |
|---|---|---|---|
| F9 | Section 3.1 L271 | Deleted orphaned drafting-history sentence | ✅ |
| F10 | Introduction L35 | "the only window" → "a window" | ✅ |
| F11 | Discussion L23 | "generalizes to any" → "designed to generalize to any" | ✅ |
| F12 | Required Figures L419 | "WWII GDP divergence" → "WWII counterfactual: GDP differences across pre-specified primary outcomes" | ✅ |
| F13 | Section 4.4 L345 | "weak weather→hospital signal" → degenerate metrics / causal disconnect framing | ✅ |

### F14–F17: References & Comparison

| # | Location | Change | Status |
|---|---|---|---|
| F14 | Section 4.4 L347 | "illustrative calibration targets" — already correct, no change needed | ✅ |
| F15 | Section 4.3 L330 | "No \| No \| No" → "Varies \| Varies \| Varies" for zero-modification integration | ✅ |
| F16 | References | Removed orphaned ref [8] (FDA, never cited in body) | ✅ |
| F17 | References | Split old [5] "See also" into [5]+[6]; renumbered [6]→[7], [7]→[8]; all in-text citations updated | ✅ |

---

## Evidence Verification

### Determinism Audit (exp-1)

- RNG chain: Seeded Mulberry32 throughout. No Math.random in simulation path.
- P-004 traceable: Seeds 42–71 via `run-dr-counterfactual.ts`.
- Byte-reproducibility: Structural equality only; claim removed (F4).
- Cross-platform: Linux-only CI; claim not made.

**Verdict:** No determinism defect. Manuscript claims correctly scoped.

### P-004 Degeneracy Trace (exp-2)

- Intervention: State patch (config params), not event injection.
- Adapter: Reads discrete events, not config params.
- Causal chain: Broken at climate→event step (GDP overwhelms intervention by ~100,000×).
- All sentinelOutput metrics: Degenerate (stdDev=0).
- df=1: Economy cadence=3, rare 2-seed non-degeneracy.

**Verdict:** Legitimate model behavior, not a code defect. Manuscript accurately describes as "design-scope limitation."

### Test Count + 30-Sentinel (exp-3)

- 333 tests, 37 files, 1 pre-existing timeout (health-surveillance.test.ts).
- 30-sentinel heatmap: Separate run from `run-heatmap.ts`, matches Section 3.3 table.
- All ICU/Mortality/Surge metrics zero (10-tick horizon).

**Verdict:** Manuscript counts now accurate.

---

## Reference Integrity

| # | Reference | Cited |
|---|---|---|
| [1] | Suhrcke et al. 2011 | ✅ Line 33 |
| [2] | Watts et al. 2021 | ✅ Line 33 |
| [3] | Walker et al. 2020 | ✅ Line 33 |
| [4] | Gatewood et al. 2020 | ✅ Line 33 |
| [5] | Kannampallil et al. 2011 | ✅ Line 33 |
| [6] | Kannampallil & Abraham 2019 | ✅ Line 33 |
| [7] | Meyer et al. 2020 | ✅ Line 33 |
| [8] | Hernán & Robins 2020 | ✅ Line 35 |
| [9] | Tracy et al. 2018 | ✅ Lines 35, 323 |
| [10] | Auchincloss & Diez Roux 2008 | ✅ Lines 35, 323 |
| [11] | Homer & Hirsch 2006 | ✅ Lines 35, 323 |
| [12] | Jacobson et al. 2006 | ✅ Lines 35, 323 |
| [13] | Harrison 1998 | ✅ Lines 111, 238, 347 |
| [14] | WHO 2021 | ✅ Line 309 |
| [15] | Benjamini & Hochberg 1995 | ✅ Line 215 |
| [16] | Cohen 1988 | ✅ Line 215 |

**No orphaned references. No missing citations.**

---

## FINAL VERDICT

# ✅ FREEZE — READY FOR HUMAN AUTHOR REVIEW

All 17 manuscript fixes applied and verified. All audit items pass. Evidence matrix internally consistent. No blockers remain.

**Before submission, the human author should:**
1. Review final manuscript for tone, flow, and readability
2. Verify DR synchronization against authoritative KE commit (Mac Mini at `6096b59`, 3 behind Windows HEAD `4d7e412`)
3. Add figures (Figure 1: architecture diagram, Figure 2: GDP bar chart, Figure 3: sentinel network map)
4. Format per JAMIA submission guidelines
