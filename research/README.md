# research/

Phase 0 recon reports, one file per recon subagent. The orchestrator merges them into `RESEARCH.md`, `ASSUMPTIONS.md`, `GLOSSARY.md`, `SKILLS.md` and `FEATURES.md`.

Every report uses the same sections:

1. Summary: the findings that change what we build, in a few lines.
2. Findings: the detail, organised by topic.
3. Decisions proposed: what the report recommends, with the reason.
4. Assumptions: each one numbered `A-<REPORT>-<n>`, with what it is based on and how to verify it later.
5. Scope changes: IDs missing from `PROMPT.md` (proposed new ID, priority, reason) or IDs that should change.
6. Glossary additions: new concepts, one English term each, plus the French UI term.
7. Blockers: only what truly needs the user (accounts, keys, paid services).
8. Sources: every URL used, with the date it was read. Facts without a source are marked as such.

Reports are in English. No product code is written in phase 0.
