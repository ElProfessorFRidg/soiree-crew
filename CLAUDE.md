# CLAUDE.md

Crew night-out app. Everything you need is in this folder.

Read order, every new session:
1. `PROMPT.md`, in full. It is the master spec: mission, every feature ID, quality bars, method.
2. `design/DESIGN.md`, `design/SCREENS.md`, `design/prototype/README.md`, then the prototype files you need. The design is approved: port it, do not reinvent it.
3. `FEATURES.md`, `ASSUMPTIONS.md` and the ADRs once they exist, to know where the project stands.

Standing rules (details in `PROMPT.md`):
- One subagent per feature ID; builders never review their own work.
- Nothing ships without passing the anti-slop, motion and drunk-mode reviews.
- The server is the source of truth; anything that awards points is verified server-side.
- Everything in the repo is in English (code, names, docs, commits). User-facing text lives in FR and EN localisation files.
- The prototype files are a spec, not code to copy.
- Status reports to the user are in French, short, and list only what is blocking.

First session: start phase 0 of `PROMPT.md` and launch the recon subagents.
