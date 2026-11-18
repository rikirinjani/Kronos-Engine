# Zenodo Research Artifact — Final Report

**Date**: 2026-09-08  
**Status**: KRONOS RESEARCH ARTIFACT READY FOR ZENODO PUBLICATION

---

## Git Provenance

| Field | Value |
|-------|-------|
| Commit | `4d7e4128f6ad800fa762f443f36aa4f45d31e4d9` |
| Branch | `master` |
| Tag | `baseline-pre-reopen` |
| Software version | 1.0.0 |
| Freeze date | 2026-09-07 |

---

## Archive Contents

| Directory | Files | Size |
|-----------|-------|------|
| `manuscript/` | 1 | — |
| `source/` (src/, scripts/, docs/, configs) | 156 | 1.16 MB |
| `evidence/p003-wwii/` | 5 | — |
| `evidence/p004-dr-sentinel/` | 7 | — |
| `evidence/phase-f-causal/` | 4 | — |
| `documentation/` | 4 | — |
| **Total** | **181** | **5.97 MB** |

---

## Consistency Check

| Check | Result |
|-------|--------|
| Manuscript experiment numbers match evidence | ✅ P-003: 1,233 metrics / 291 tested / 942 degenerate |
| P-004 metric counts match evidence | ✅ 199 metrics / 106 tested / 93 degenerate |
| Phase F seed count matches evidence | ✅ 5 seeds (42–46) |
| Regional sentinel description | ✅ "30 simulated sentinel instances" — no "30 hospitals" |
| P-004 reproducibility limitation stated | ✅ 3 locations (L295, L327, L365) |
| No "empirical clinical validation" claims | ✅ 0 matches |
| No byte-identical reproducibility claims for P-004 | ✅ All mentions properly disclaim |
| Source code "available upon request" | ✅ Not claimed as public |
| No secrets/credentials in archive | ✅ Clean (grep scan passed) |
| Manuscript is closed version | ✅ Final frozen version included |
| Frozen experiment artifacts untouched | ✅ No reruns, no modifications |

---

## Zenodo Metadata

| Field | Value |
|-------|-------|
| Title | "Kronos Engine v1.0.0 — Research Artifact for JAMIA 2026 Manuscript" |
| Type | `dataset` |
| Version | 1.0.0 |
| License | MIT |
| Creator | Riki Rinjani, Hisfarma IAI, ORCID 0009-0002-9364-2637 |
| Description | Full description in `.zenodo.json` |
| Keywords | counterfactual simulation, agent-based modeling, health system simulation, sentinel adapter, experimental reproducibility, deterministic replay, Kronos Engine, healthcare informatics, TypeScript, multi-scale simulation |
| Language | English |
| Repository | `https://github.com/rikirinjani/Kronos-Engine` (not yet public) |

---

## DOI

**Not yet created.** No DOI has been reserved or minted. The Zenodo record will receive a DOI upon publication, which requires human authorization.

---

## Blockers

| Blocker | Severity | Status |
|---------|----------|--------|
| Repository is private | HIGH | Not yet public; source available upon request |
| No Zenodo API token | HIGH | No credentials found in MemPalace; requires manual provision |
| No GitHub→Zenodo integration | MEDIUM | Cannot auto-ingest releases until repo is public |

---

## Human Authorization Required

Before publication, the following must be provided:

1. **Zenodo API token**: Generate at https://zenodo.org/account/settings/applications/tokens/new
2. **Repository visibility**: Make `github.com/rikirinjani/Kronos-Engine` public, or authorize Zenodo for private repos
3. **Publication approval**: Confirm the archive contents are correct

If Zenodo authentication is available, the publication command would be:

```bash
# Using Zenodo API
curl -H "Authorization: TOKEN <your-token>" \
     -F "metadata=@zenodo-package/source/.zenodo.json" \
     https://zenodo.org/api/depositions
```

Or via GitHub integration (after making repo public):

```bash
# Tag a release on GitHub — Zenodo auto-ingests
git tag v1.0.0
git push origin v1.0.0
```

---

## Determinism Scope

| Component | Byte-Reproducible | Notes |
|-----------|------------------|-------|
| Kronos Engine core | ✅ | Deterministic mulberry32 PRNG |
| P-003 (WWII) | ✅ | 30 seeds, deterministic |
| Phase F (causal-null) | ✅ | 5 seeds, paired execution |
| P-004 (Deers Rock) | ❌ | Unseeded Math.random()/Date.now() |

---

## What Is NOT Included

- `node_modules/` (94 packages, zero runtime deps)
- `dist/` (compiled JS, rebuildable from src/)
- `.git/` (Git history)
- `self-harness/` (PM-1 traces, internal dev process)
- `qms/` (QMS records, internal quality system)
- `.github/` (CI workflows)
- Secrets, credentials, tokens

---

**KRONOS RESEARCH ARTIFACT READY FOR ZENODO PUBLICATION.**
