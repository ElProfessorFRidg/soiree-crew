# @crew/server

API and live socket for crews and parties (ADR 0002).

## Run locally

```bash
DATA_KEY=$(openssl rand -base64 32) pnpm --filter @crew/server dev
```

Without `DATABASE_URL` it stores data in `apps/server/data` with PGlite. Stop it with Ctrl+C, or by creating `apps/server/data/.shutdown`: a hard kill (common on Windows) can leave the PGlite files unreadable. Wait for `data/postmaster.pid` to disappear before starting it again.

## Deploy (Coolify or any Docker host)

See `deploy/README.md` (compose file with PostgreSQL, every variable, what the proxy must allow, backups) and `deploy/VPS_PROMPT.md` (step-by-step brief for setting up a public server).

Optional AI (ADR 0004): set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (and `AI_MODEL` to change the model). Each crew admin still has to turn it on in Settings. Without these, the app writes recap stories from templates.
