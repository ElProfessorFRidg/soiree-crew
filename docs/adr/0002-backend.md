# ADR 0002: Backend

Status: accepted, 2026-10-27.

## Context

Crew features (crews, parties, live dashboard, check-ins, leaderboards, radar) need a server that is the source of truth (operating principle 12). ADR 0001 planned Supabase, which needs an account the user has not created. The user already self-hosts services with Coolify (Docker).

## Decision

- **Service:** `apps/server`, Node 22, Fastify 5, TypeScript strict, zod validation on every input. One Docker image, deployable on Coolify or any Docker host in the EU.
- **Database:** PostgreSQL 16 in production through `pg`. Tests and local development run the same SQL on PGlite (Postgres compiled to WebAssembly), so no Docker daemon is needed to run the suite. Plain SQL migrations in `apps/server/migrations`, applied in order at start.
- **Sync contract:** the app's sync engine sends batches to `POST /v1/mutations`. Each mutation carries its idempotency key; the server answers per mutation with `accepted`, `rejected` (with a reason) or `temporary`. A replayed key returns the stored answer. `GET /v1/sync?since=` returns the delta.
- **Server-side computation:** the server imports `@crew/bac` and `@crew/units`, so live BACs, verified flags and leaderboards are computed with the same code the app previews (AC-01, SYNC-05).
- **Realtime:** one WebSocket per device (`/v1/live`) carrying crew and party events. The app treats pushed data as a cache refresh, never as a confirmation of its own pending writes.
- **Accounts for v1:** account per device with a session token (stored hashed with SHA-256, kept in the device keychain). Adding a second device uses a one-time transfer code shown on the first. Passkeys and email (SEC-07, O-01) come later and plug into the same session table.
- **Sensitive fields:** weight, sex and the drink history are encrypted at the application level with AES-256-GCM from Node's crypto module; the key comes from the environment (a managed KMS later, SEC-04). No home-made cryptography.

## Rejected

- **Supabase now:** blocked on an account and keys; its row-level security would still need server code for scoring.
- **Firebase:** not EU-first by default, document model fits leaderboards and joins poorly.
- **Docker Postgres for tests:** works in CI, but the user's Docker daemon is not always running; PGlite keeps `pnpm check` self-contained.

## Consequences

- Phones need the server reachable over HTTPS. Until it is deployed, the app keeps the local transport and every crew screen says the crew needs the server address.
- PGlite and Postgres must stay compatible: migrations avoid extensions (distance is computed with a haversine expression instead of PostGIS).
