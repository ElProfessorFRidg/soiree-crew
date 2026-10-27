# Deploying the server

`deploy/docker-compose.yml` runs the API (`apps/server/Dockerfile`) with PostgreSQL 17 and two volumes: `pgdata` (the database) and `uploads` (album photos, encrypted chat files, encrypted history backups, mounted at `/data`). Migrations run on every start.

## Environment

| Variable | Required | What |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Long random string. |
| `DATA_KEY` | yes | `openssl rand -base64 32`. Seals health data, IBANs, SOS locations, emails, reports. **Back it up offline: without it that data cannot be read, ever.** Never change it on a running server. |
| `PUBLIC_URL` | yes | `https://crew.example.com`, no trailing slash. Used in invite links and photo links. |
| `SERVER_NAME` | no | Shown on the connect screen (default "Soirée Crew"). |
| `SERVER_DESCRIPTION` | no | One sentence under the name. |
| `PUBLIC_SERVER` | no | `true` lists the server as public in the apps that know it. |
| `OPERATOR_USERNAMES` | no | Comma-separated app usernames who review venue claims (COM-11). |
| `TRUST_PROXY` | set | `1` in the compose file: one reverse proxy in front. Keep port 8787 unpublished, or a client could fake its address. |
| `AI_PROVIDER`, `ANTHROPIC_API_KEY`, `AI_MODEL` | no | ADR 0004. Off without them. |
| `SEASON_VARIANTS` | no | JSON, e.g. `{"2026-12":"games"}` (TER-12). |

## What the proxy must allow

- WebSocket upgrade on `GET /v1/live` (the token travels in the query string: never log query strings).
- Request bodies up to 18 MB on `PUT /v1/chat/backup`, 9 MB on `POST /v1/conversations/:id/blobs` and `POST /v1/parties/:id/photos`; 512 KB elsewhere (the app enforces it).
- No caching of `/v1/*`.

## Health

`GET /v1/health` answers `{"ok":true}`; the image has a Docker `HEALTHCHECK` on it. `GET /v1/info` is public and says how the server presents itself.

## Backups

Daily `pg_dump` of the `crew` database and a copy of the `uploads` volume, kept off the machine. Chat content and history backups are end-to-end encrypted: the server cannot open them, and neither can its backups.

## After the first deploy

Set the repository variable `CREW_SERVER_URL` to `PUBLIC_URL` (and `CREW_PUBLIC_SERVERS` for other public servers, comma-separated): the next app builds suggest that server on the connect screen.

```bash
gh variable set CREW_SERVER_URL --body "https://crew.example.com" --repo ElProfessorFRidg/soiree-crew
```
