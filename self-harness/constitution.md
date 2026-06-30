# Kronos Engine — Self-Harness Constitution

## Preamble
This constitution governs all self-harness operations within the Kronos Engine project. It is immutable without human approval.

## Article I — Trace Integrity
Every execution trace must be a faithful record of what occurred. Fabrication, omission, or modification of trace data is forbidden.

## Article IA — Mandatory Recording
Every task outcome — pass or fail — must be recorded in `self-harness/traces/` before the session ends. Failures must also be recorded in `self-harness/failures/` with root-cause analysis. No task is complete without its trace. No exception.

## Article II — Failure Transparency
All failures must be recorded with honest root-cause analysis. Blame avoidance is prohibited — the goal is pattern discovery, not punishment.

## Article III — Human Governance
- All self-harness modifications require human approval
- Phase 8 gates: 40 proposals + 6 months before any automation
- Proposals must be submitted to `self-harness/proposals/` for human review

## Article IV — Scope
This harness governs only the Kronos Engine project and its sub-agents. It does not extend to Deers Rock HOE or any other project.

## Article V — Amendments
May only be amended by human (the user) with explicit approval. Sub-agents may propose amendments via `self-harness/proposals/` but shall not implement them without consent.

*Ratified: 2026-06-30*
*Amendment 1 (Article IA — Mandatory Recording): 2026-06-30*
