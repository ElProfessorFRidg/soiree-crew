# Build caches

Four caches work together. Each has one writer and a clear way to be rebuilt or thrown away.

| Cache | What it holds | Who writes | Who reads | Where |
|---|---|---|---|---|
| pnpm store | downloaded npm packages | `main` | every run | GitHub Actions cache |
| Native build cache | ccache objects and CocoaPods downloads | `main` | every iOS build | GitHub Actions cache |
| ExpoModulesJSI slice | one precompiled framework | `main` | every iOS build | GitHub Actions cache |
| Shared compile cache | the same ccache objects, shared by all branches | `main` only | every iOS build | our VPS (`crew-cache`) |
| BuildKit store | server image layers, pnpm store for the image | any build on the VPS | any build on the VPS | VPS Docker |

## Why only `main` writes

GitHub keeps one cache namespace per branch. A pull request can read the caches of `main` and its own, never another PR's. Before this policy every PR run saved its own copy, so the repository held 10.9 GB against a 10 GB quota (9.8 GB of it from PR branches) and `main`'s caches were evicted first. Now PRs only **restore** (`actions/cache/restore`) and `main` **saves** (`actions/cache/save`), once per run. The `prune-build-caches` job then keeps the two newest caches of each family on `main` (`tools/ci/prune-build-caches.mjs`, tested in `prune-build-caches.test.mjs`). It only touches caches of `main` whose key matches a known family, so caches of any other feature are never deleted.

Keys carry the tool version (`xcode26.6`), the target (`iphone`/`ipad`) and the lockfile hash, so a dependency change or an Xcode bump never restores an incompatible cache. Bump the `-v2-` part of a key to invalidate a whole family by hand.

## The shared compile cache

`ccache` serves the C, C++ and Objective-C compiles of React Native and the native modules. GitHub's per-branch cache cannot share them between PRs, so the iOS builds also use one server.

```
iOS runner (macOS)                                         VPS 57.128.183.60
ccache ──helper──▶ ccache-storage-https ──HTTPS──▶ Traefik ──▶ bazel-remote (10 GB, LRU, zstd)
          GET/HEAD: account ci-read or ci                      only reachable through Traefik
          PUT:      account ci only
```

- **Server**: `https://cache.crew.57.128.183.60.sslip.io`. `bazel-remote` in Docker, defined in `deploy/cache/compose.yml`, installed in `/srv/crew-cache`. It has no accounts of its own and is not published on any port: Traefik is the only way in.
- **Permissions are enforced by the server, not by the client.** Two Traefik routers split the methods: `GET`/`HEAD` accept the read account or the write account, `PUT` accepts the write account only, every other method has no route. A workflow that edits its own `CCACHE_REMOTE_STORAGE` or drops `read-only` still cannot write with the read credential (it gets `401`). Checked live: read account `PUT` → 401, write account `PUT` → 200, `DELETE`/`POST` → no route.
- **Credentials live in GitHub environments** (Settings → Environments):

  | Environment | Who can use it | Secret |
  |---|---|---|
  | `crew-cache-main` | deployment branch `main` only | `CREW_CACHE_WRITE_PASSWORD` |
  | `crew-cache-preview` | any branch | `CREW_CACHE_READ_PASSWORD` |

  The `ios` job picks the environment from the ref (`build.yml`). A pull request that points its job at `crew-cache-main` is refused by the environment's branch rule before any step runs. There is no repository-level cache secret. `CREW_CACHE_READ_PASSWORD` also exists as a **Dependabot** secret, because Dependabot runs cannot read environment secrets. Fork runs have no secrets at all.
- **Repository variables**: `CREW_CACHE_URL` (the URL above) and `CREW_CACHE_ENABLED` (`true`/`false`). Setting `CREW_CACHE_ENABLED` to `false` is the off switch: builds then use the local cache only.
- **HTTPS helper**: Homebrew's `ccache` has no HTTPS backend (the built-in HTTP one is plain text and deprecated). `tools/ci/install-ccache-helper.sh` installs the official `ccache-storage-http-go` release, pinned to a version and checked against its SHA-256 before it is unpacked. The same program serves `http` and `https`, so it is installed under both names.
- **Always falls back**: `tools/ci/configure-ccache.sh` runs a probe compile against the server before enabling it. Any problem (no credential, wrong password, read account asked to write, server down, certificate mismatch, plain `http://`, timeout, no helper) prints a warning and leaves the local cache alone. A build never fails because of the cache. Timeouts are 5 s per request and 3 s per transfer.
- **No credential in logs**: the URL and the encoded password are masked, GitHub masks secrets by itself, and the credentials are never part of a cache key or artifact. The password is hex, so it needs no percent-encoding.
- **CrowdSec**: a cache miss is an ordinary `404`, which the `http-probing` scenario counts against the caller (this banned the CI runner once, and once an administrator). `/etc/crowdsec/parsers/s02-enrich/crew-cache-whitelist.yaml` ignores only `GET`/`HEAD` of `/ac/<64 hexadecimal digits>`. Traefik logs in the common format here, which has no Host field, so the rule is the shape of the request; other probes, and a malformed `/ac/zz`, still count. After editing any parser **restart** CrowdSec (`systemctl restart crowdsec`; a reload does not load new parsers) and check with `cscli explain --file line.log --type traefik`.

### Prove it works

```
# On any Linux with ccache >= 4.13, clang, node, and ccache-storage-https on PATH:
CACHE_URL=https://cache.crew.57.128.183.60.sslip.io READ_PASSWORD=... WRITE_PASSWORD=... bash tools/ci/test-remote-cache.sh
```

It runs `configure-ccache.sh` for nine situations (right and wrong credentials, wrong role, no credential, server down, certificate mismatch, plain HTTP, black hole), then a real compile that must be stored on the server and served back to an empty local cache. Last run: ccache 4.14.3, helper 0.10.1, clang 19, against the live server: all passed.

### Operate it

- **Rotate a password**: generate two bcrypt lines (`docker run --rm httpd:2-alpine htpasswd -nbB ci-read PASSWORD | sed 's/\$/$$/g'`), export `CACHE_READ_HASH` and `CACHE_WRITE_HASH`, `docker compose up -d --force-recreate` in `/srv/crew-cache`, then update the three GitHub secrets (without a trailing newline: `printf %s "$PW" | gh secret set ...`).
- **Empty it**: `docker compose down && rm -rf /srv/crew-cache/data/* && docker compose up -d`. Builds simply start cold.
- **Update it**: `docker compose pull && docker compose up -d`. Check `docker logs crew-cache` and run the test above.
- **Stop using it**: set `CREW_CACHE_ENABLED=false`. Nothing else needs to change.
- **Size**: `du -sh /srv/crew-cache/data`; the 10 GB cap (`--max_size`) evicts the least recently used objects.

## Docker builds on the VPS

All Coolify builds run on one BuildKit daemon, so identical layers are shared already. `apps/server/Dockerfile` adds two things:

1. The lockfile and the `package.json` of every workspace package are copied first, then `pnpm fetch` and `pnpm install` run, and only then the code is copied. A code change therefore keeps the install layer.
2. The pnpm store is a BuildKit cache mount (`crew-pnpm-store`, `sharing=locked`), shared by every build on that worker: a package one build downloaded is not fetched again.

When you add or remove a workspace package, add or remove its `COPY .../package.json` line. `tools/ci/server-image-manifests.test.mjs` fails the `checks` job if you forget (the install would otherwise succeed and the server would fail at run time).

`tools/ci/check-server-image.sh` (job `server-image`, run when the server, its packages, the lockfile or the check itself changed) builds on a fresh builder and checks, on the built images rather than the build log: a cold build works; a code-only change reuses the install; a change to the dependency inputs does not; the run-time dependencies resolve; the API answers `/v1/ready` as a non-root user. Everything it creates (builder, images, container) is removed on success, failure or interruption. Run on the VPS: 4 min 39 s in total.

The VPS timer `vps-cleanup` runs hourly: at 04:00 it drops build cache older than three days (the pnpm cache mount included), and at any hour it drops all of it once the disk is 80 % full. The next build then starts cold and refills it. The cache is bounded by age, not by size.

## GitHub release

`tools/ci/publish-release.mjs` creates the release as a draft, uploads the files by release id, verifies each one (state, size, SHA-256), then publishes. It can be re-run at any point and never overwrites a valid asset or changes a published release. Checked against the real API with a throwaway preview release (created and deleted by the test): fresh create; re-run on a published release leaves it untouched; different IPA under the same tag is refused; an interrupted draft is completed; a draft holding a different file is left unpublished; duplicate drafts and a tag on another commit are refused. The preview release never became `latest`.

## Limits

- The remote cache is only measured end to end on a macOS runner by the build itself (the step prints ccache statistics and warns when Xcode produced no cacheable call). Everything else was run with the same ccache, helper and server on Linux.
- A pull request build cannot warm the shared cache. The first build after a merge to `main` fills it.
- The signing key and publish token of the OTA server are repository secrets, so a workflow in a branch of this repository can read them. They are not covered by the environment split above.

## Native version reservations

`crew-version/vX.Y.Z` annotated tags reserve unique native versions. Their annotation identifies the Build run (`build-N`), not the source revision. New reservation tags point to a fetched, already-published `main` commit instead of the temporary PR merge commit. This avoids GitHub's workflow-file permission rejection without expanding token scopes. Existing reservations remain valid, and reruns reuse their own version. The actual release tag still identifies the build source commit; never substitute the reservation anchor for release provenance.
