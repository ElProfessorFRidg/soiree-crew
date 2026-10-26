# ASSUMPTIONS.md

Decisions taken without asking the user, so that work never blocks. Each one says what it rests on and how it gets checked. When an assumption is confirmed or overturned, its status changes here; it is never deleted.

Status values: `open`, `confirmed`, `overturned`.

## Orchestration

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-ORCH-1 | The project lives in `C:\Users\aubin\Documents\soiree-crew`, outside OneDrive, so build folders are not synced. | `LISEZMOI.md` asks for an empty `soiree-crew` folder; OneDrive syncing `node_modules` is slow and error-prone. | User can move it at any time. | open |
| A-ORCH-2 | Recon-Design is split into three subagents (A, B, C) by board, and the four unclear games (O-53, O-54, O-59, O-64) share one recon subagent with four separate sections. | Phase 0 is research, not build; the one-ID-per-brief rule still applies from phase 1 on, including one Spec and one Build agent per game. | Phase 2 game specs each start from a dedicated subagent. | open |
| A-ORCH-3 | Downloaded skills are staged in `research/skill-candidates/` and only moved to `.claude/skills/` after the orchestrator has read them in full. | `<skills>` safety rule; files in `.claude/skills/` load into every session. | `SKILLS.md` lists the review result of each skill. | open |

## From recon reports

Merged from `research/*.md` at the end of phase 0.
