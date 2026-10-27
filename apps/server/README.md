# @crew/server

API and live socket for crews and parties (ADR 0002).

## Run locally

```bash
DATA_KEY=$(openssl rand -base64 32) pnpm --filter @crew/server dev
```

Without `DATABASE_URL` it stores data in `apps/server/data` with PGlite. Stop it with Ctrl+C, or by creating `apps/server/data/.shutdown`: a hard kill (common on Windows) can leave the PGlite files unreadable. Wait for `data/postmaster.pid` to disappear before starting it again.

## Deploy (Coolify or any Docker host)

Build from the repository root with `apps/server/Dockerfile`, then set:

- `DATABASE_URL`: a PostgreSQL 16 database
- `DATA_KEY`: `openssl rand -base64 32`, kept secret and backed up (losing it makes health data unreadable)
- `PUBLIC_URL`: the https address of the server, used in invite links and photo links
- `UPLOAD_DIR` (optional, default `./data/uploads`): where album photos are kept. Mount it as a volume so photos survive a redeploy

Expose port 8787 behind HTTPS.

Optional AI (ADR 0004): set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` (and `AI_MODEL` to change the model). Each crew admin still has to turn it on in Settings. Without these, the app writes recap stories from templates.
