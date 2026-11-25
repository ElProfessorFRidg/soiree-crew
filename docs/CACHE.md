# Shared build caches

## Compile cache for the iOS CI (`crew-cache`)

`ccache` serves the C, C++ and Objective-C compiles of React Native and the native modules. GitHub's own cache is per branch and capped at 10 GB, so the iOS builds also share one on our VPS:

- **Server**: `https://cache.crew.57.128.183.60.sslip.io`, `bazel-remote` in Docker (`/srv/crew-cache/compose.yml`), HTTPS through Traefik, basic auth, objects compressed, 10 GB cap (least recently used objects leave first).
- **CI**: the `Use the shared compile cache` step of `build.yml` sets `CCACHE_REMOTE_STORAGE`. PRs read it (`read-only`), `main` reads and writes, so a PR can never add objects that later builds trust. The local cache stays on as the fallback, and a build never fails because the server is down.
- **Settings**: GitHub variable `CREW_CACHE_URL` (the URL above) and secret `CREW_CACHE_PASSWORD`. Without them the step does nothing. Fork and Dependabot runs have no secrets.
- **CrowdSec**: a cache miss is a plain 404, which the `http-probing` scenario would count against the runner. `/etc/crowdsec/parsers/s02-enrich/crew-cache-whitelist.yaml` exempts this one host (the password still protects it).

## Docker builds on the VPS

All Coolify builds run on one BuildKit daemon, so layers are shared already. The server image keeps its package store in a cache mount (`crew-pnpm-store`) and installs from the manifests only, so a code change rebuilds in seconds. The nightly cleanup keeps the build cache under a size cap instead of dropping everything older than three days.

## GitHub Actions cache

PRs only restore; `main` saves (see `build.yml`). Never save from a PR: its copy cannot be read by another PR and crowds out main's.
