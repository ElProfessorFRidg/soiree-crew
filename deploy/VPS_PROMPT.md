# Prompt for the Claude session on the VPS

Paste everything below the line into Claude Code running on the server.

---

You are on my VPS. Coolify is installed, plus other protection layers (firewall, fail2ban or CrowdSec, maybe a WAF or Cloudflare in front). Your job: deploy the Soirée Crew API as a **public server** that anyone can sign up on, behind HTTPS, without weakening or breaking anything already running here. Work carefully, explain each change before you make it, and ask me before anything destructive or anything that touches another service.

## 1. Look before you touch

1. Inventory, read-only: OS and version, `docker ps`, Coolify version and where it runs, which proxy Coolify uses (Traefik or Caddy) and its config, open ports (`ss -tlnp`), firewall rules (ufw / nftables / iptables), fail2ban jails or CrowdSec scenarios and bouncers, any WAF / ModSecurity / Cloudflare in front, disk space, RAM, existing backups.
2. Write a short report of what is there and what you plan to change. Wait for my OK.

## 2. Domain

Ask me for the domain (for example `crew.mydomain.tld`). Check the DNS A/AAAA record points to this server before going on.

## 3. Deploy with Coolify

- Source: GitHub repository `ElProfessorFRidg/soiree-crew`, branch `main`. It is **private**: set it up through a GitHub App or a deploy key in Coolify (read-only), never a personal token pasted in a file.
- Resource type: Docker Compose, compose file `deploy/docker-compose.yml` (read `deploy/README.md` in the repo: it lists every variable and what the proxy must allow).
- Domain on the `server` service, port 8787, HTTPS with Let's Encrypt, HTTP redirected to HTTPS.
- Environment, set in Coolify as secrets:
  - `POSTGRES_PASSWORD`: generate 40+ random characters.
  - `DATA_KEY`: `openssl rand -base64 32`. Show it to me once so I store it offline, and tell me plainly that losing it makes the sealed data unreadable for good. Never rotate it afterwards.
  - `PUBLIC_URL=https://<the domain>` (no trailing slash).
  - `SERVER_NAME`, `SERVER_DESCRIPTION`: ask me. `PUBLIC_SERVER=true`.
  - `OPERATOR_USERNAMES`: leave empty for now (see step 7).
  - Leave the AI variables empty unless I give you a key.
- Make sure nothing publishes port 8787 or 5432 on the host: only the proxy reaches the API, and PostgreSQL is reachable from the API container only.
- Persistent volumes: `pgdata` and `uploads` must survive redeploys.
- Turn on automatic deploys on push to `main` only if I say yes.

## 4. Fit the protection layers

- Firewall: only SSH (on its current port), 80 and 443 open to the world. Do not lock me out: keep the current SSH session open while you test a new one.
- Proxy / WAF: WebSocket upgrade must work on `/v1/live`. Allow request bodies up to 18 MB on `PUT /v1/chat/backup` and 9 MB on `/v1/conversations/*/blobs` and `/v1/parties/*/photos`. If ModSecurity / OWASP CRS or Cloudflare is in front, check these paths are not blocked (large base64 JSON bodies look suspicious to some rules) and add narrow exceptions for these paths only.
- Do not log query strings for `/v1/live` (the session token is in it). If the proxy logs full URLs, strip the query for that path.
- Rate limiting at the proxy: generous (for example 30 requests per second average per IP, burst 120) so normal chat and sync never hit it; the API already limits sign-ups, sign-ins and writes itself and answers 429.
- fail2ban / CrowdSec: if they read the proxy logs, make sure a normal phone (one request every few seconds, many 401 on an expired session) is not banned. A useful extra jail: many 401 on `POST /v1/sessions/password` from one IP.
- Security headers: the API sets HSTS, nosniff, no-referrer and frame DENY itself; do not add a conflicting CSP on the API.

## 5. Backups

- Daily PostgreSQL dump of the `crew` database (Coolify scheduled backup or a cron job), kept 14 days, and a copy off the machine if there is a target (S3-compatible bucket, another server). Ask me where.
- Daily copy of the `uploads` volume to the same place.
- Test one restore into a scratch database and tell me it worked.

## 6. Check it works

From outside the server:
1. `curl -s https://<domain>/v1/health` gives `{"ok":true}`.
2. `curl -s https://<domain>/v1/info` gives the name, `"public":true`.
3. Create a throwaway account: `curl -s -X POST https://<domain>/v1/accounts -H 'content-type: application/json' -d '{"username":"smoketest1","displayName":"Smoke"}'` gives a token; then `curl -s https://<domain>/v1/crews -H "authorization: Bearer <token>"` gives `{"crews":[]}`.
4. WebSocket: `npx wscat -c "wss://<domain>/v1/live?token=<token>"` connects and stays open.
5. A 6 MB upload is accepted: create a crew, then a conversation list call, then post a 6 MB base64 blob to `/v1/conversations/<id>/blobs` and get 201.
6. Delete the throwaway account afterwards: `curl -s -X DELETE https://<domain>/v1/me -H "authorization: Bearer <token>"` (check the exact route in `apps/server/src/routes/accounts.ts`).
7. Restart the stack and check data and photos are still there.

## 7. Hand-over

Tell me:
- the public URL;
- what you changed on the machine (firewall, proxy, jails, cron), so I can undo it;
- where the secrets live and that `DATA_KEY` is saved by me;
- how to see the logs and redeploy in Coolify.

Then remind me to:
- create my own account in the app on this server and send you my username, so you set `OPERATOR_USERNAMES=<it>` and redeploy (it lets me review venue claims);
- set the GitHub variable so the next app builds suggest this server:
  `gh variable set CREW_SERVER_URL --body "https://<domain>" --repo ElProfessorFRidg/soiree-crew`

Never paste secrets into the repository, an issue or a commit.
