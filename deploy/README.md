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
| `OPERATOR_IDS` | no | Comma-separated account ids who review venue claims (COM-11). Get one with `select id from users where username = '<name>'`. `OPERATOR_USERNAMES` still works but is weaker: a name nobody holds can be registered by anyone. |
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

## Android builds on this server

The APK can be built here instead of on GitHub (`deploy/android`): a Linux image with JDK 17, the Android SDK and NDK, and Node 22. **The iOS IPA cannot**: Xcode only runs on macOS, so it stays on GitHub Actions' macOS runners.

1. Make a host folder for the result, for example `/srv/soiree-crew/downloads`, and set `DOWNLOADS_HOST_DIR` to it for the stack, so the API serves it read-only at `/download/soiree-crew.apk` (and `/download/android.json`).
2. Give the builder read access to the private repository: a read-only GitHub deploy key in a folder (`ANDROID_DEPLOY_KEY_DIR`, containing `id_ed25519` and a `known_hosts` with github.com).
3. Build: `docker compose -f deploy/docker-compose.yml --profile android run --rm android-builder` (about 15 to 25 minutes the first time, a few minutes after, thanks to the Gradle cache volume). It exits at once when the latest commit is already built.
4. Run it from a systemd timer or cron every 15 minutes to follow `main`. Give the machine 8 GB of RAM or swap for Gradle.

Server builds are numbered from 1001 up and check this server for updates (`CREW_UPDATE_SERVER`), not GitHub. They are signed with the same Expo template key as the GitHub builds, so either installs over the other; a real release key comes with the store release.

## After the first deploy

Set the repository variable `CREW_SERVER_URL` to `PUBLIC_URL` (and `CREW_PUBLIC_SERVERS` for other public servers, comma-separated): the next app builds suggest that server on the connect screen.

```bash
gh variable set CREW_SERVER_URL --body "https://crew.example.com" --repo ElProfessorFRidg/soiree-crew
```
