# @crew/server

API and live socket for crews and parties (ADR 0002).

## Run locally

```bash
DATA_KEY=$(openssl rand -base64 32) pnpm --filter @crew/server dev
```

Without `DATABASE_URL` it stores data in `apps/server/data` with PGlite.

## Deploy (Coolify or any Docker host)

Build from the repository root with `apps/server/Dockerfile`, then set:

- `DATABASE_URL`: a PostgreSQL 16 database
- `DATA_KEY`: `openssl rand -base64 32`, kept secret and backed up (losing it makes health data unreadable)
- `PUBLIC_URL`: the https address of the server, used in invite links

Expose port 8787 behind HTTPS.
