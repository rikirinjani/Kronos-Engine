# Kronos Engine — Release Checklist (v1.0.0)

Human gates that **must** be completed before the actual Zenodo/GitHub release.
No author names, ORCID iDs, affiliations, or DOI values were invented in the
release metadata — every unknown is a clearly-marked placeholder.

Target release: `v1.0.0` — planned date `2026-08-31`

---

## 1. Authorship placeholders

- [ ] Fill in author name(s) in `CITATION.cff` (`authors` and
      `preferred-citation.authors`)
- [ ] Fill in author name(s) in `.zenodo.json` (`creators[].name`)
- [ ] Replace the copyright holder placeholder
      `<Kronos Engine contributors — pending human approval>` in `LICENSE`
- [ ] Add ORCID iD(s) in `CITATION.cff` (`authors[].orcid`,
      `preferred-citation.authors[].orcid`) and `.zenodo.json`
      (`creators[].orcid`)
- [ ] Add affiliation(s) in `CITATION.cff` (`authors[].affiliation`) and
      `.zenodo.json` (`creators[].affiliation`)

**Where:** `CITATION.cff`, `.zenodo.json`, `LICENSE`
**What:** real names/ORCIDs/affiliations, or keep placeholders and note why.

## 2. JAMIA manuscript DOI

- [ ] Obtain the DOI of the accepted JAMIA manuscript
- [ ] Add it to `CITATION.cff` → `preferred-citation.doi`
- [ ] Add it to `.zenodo.json` → `related_identifiers[0].identifier`
      (the `isSupplementTo` entry, currently `<JAMIA DOI — pending>`)
- [ ] Fill in `CITATION.cff` → `preferred-citation.title`
      (`<JAMIA manuscript title — pending>`) and `year`
      (`<year of publication — pending>`)

**Where:** `CITATION.cff`, `.zenodo.json`
**What:** the real JAMIA DOI and manuscript citation details.

## 3. License confirmation

- [ ] Confirm MIT is the final intended license for the project
- [ ] If MIT is confirmed: no further action (SPDX `MIT` is already set in
      `package.json`, `CITATION.cff`, and Zenodo license key `mit`)
- [ ] If a different license is chosen: update `LICENSE` text,
      `package.json` → `license`, `CITATION.cff` → `license`,
      and `.zenodo.json` → `license` together

**Where:** `LICENSE`, `package.json`, `CITATION.cff`, `.zenodo.json`
**What:** explicit sign-off on the license choice.

## 4. GitHub release

- [ ] Merge the release-metadata work into the release branch
- [ ] Create and push tag `v1.0.0` (annotated) on the merged commit
- [ ] Create the GitHub release `v1.0.0` with release notes

**Where:** GitHub repository (Kronos-Engine-remediation)
**What:** the `v1.0.0` tag + GitHub release entry.

## 5. Zenodo GitHub integration

- [ ] Enable the Zenodo GitHub App for this repository (repo settings →
      Integrations → Zenodo)
- [ ] Verify the repo is published on Zenodo with a Zenodo repository DOI
      after the `v1.0.0` release is created

**Where:** GitHub repo settings + Zenodo web UI
**What:** automated Zenodo deposit triggered by the `v1.0.0` tag.

## 6. Zenodo metadata precedence

- [ ] Verify that Zenodo used `.zenodo.json` (not `CITATION.cff`) as the
      metadata source for the deposited record
- [ ] Confirm `upload_type: software`, `access_right: open`,
      `license: mit`, and `language: eng` on the Zenodo record

**Where:** Zenodo record page for Kronos Engine
**What:** visual check of the deposited record fields.

## 7. Manuscript publication

- [ ] Submit/publish the JAMIA manuscript describing Kronos Engine
- [ ] After publication, update the Zenodo record (if needed) so
      `isSupplementTo` points at the final published DOI

**Where:** JAMIA submission portal; Zenodo record (post-publication update)
**What:** the manuscript is live and linked from the Zenodo record.

---

### Definition of done

All seven sections above fully checked and the placeholders
`<... pending>` / `<... pending human approval>` no longer appear in
`LICENSE`, `CITATION.cff`, or `.zenodo.json` (unless explicitly agreed).
