# Build caches

## What is cached, and who writes it

| Cache | Holds | Written by | Read by | Where |
|---|---|---|---|---|
| pnpm store | downloaded npm packages | `main` | every run | GitHub Actions cache |
| CocoaPods | pod downloads for the iOS build | `main` | every iOS build | GitHub Actions cache |
| ExpoModulesJSI slice | one precompiled framework | `main` | every iOS build | GitHub Actions cache |
| BuildKit store | layers of the server image, pnpm store used by its install | any build on the VPS | any build on the VPS | VPS Docker |

### Why only `main` writes

GitHub keeps one cache namespace per branch. A pull request can read the caches of `main` and its own, never another PR's. Before this policy every PR run saved its own copy: the repository held 10.9 GB against a 10 GB quota, 9.8 GB of it from PR branches, and the caches of `main` were the ones evicted. Now PRs only **restore** (`actions/cache/restore`) and `main` **saves** (`actions/cache/save`), once per run, in `build.yml` and `ota.yml`.

The `prune-build-caches` job (`tools/ci/prune-build-caches.mjs`, tested) then keeps the two newest caches of each family on `main`. It only deletes caches of `main` whose key matches a known family (pnpm store, CocoaPods, JSI slice), so caches of anything else are never touched.

Keys carry the tool version (`xcode26.6`), the target (`iphone`/`ipad`) and the lockfile hash, so a dependency change or an Xcode bump never restores an incompatible cache. To invalidate a whole family by hand, bump its `-v3-` marker in the key and in `prune-build-caches.mjs`.

The first build on `main` after this change creates the caches; until then every run is cold. The JSI slice has not been seen to hit in any run examined, so its benefit is unproven.

## ccache was measured and removed

A shared compile cache (ccache on our VPS, read-only for PRs, writable by `main`) was built and tested, then removed because it has nothing to serve.

- Run `45800266779` (macOS 26, ccache 4.14.3, remote cache reachable and probed OK): after the Xcode build `ccache --show-stats` reported an **empty cache and zero calls** (`Cache size 0.0 / 0.5 GB`), on iPhone and iPad.
- Why: the build log shows React Native Core and its dependencies as prebuilt frameworks (`[ReactNativeCore] Prebuilt xcconfig configuration`, `[ReactNativeDependencies] Prebuilt deps`) and the Expo modules precompiled (`[Expo-precompiled]`). Xcode makes almost no C or C++ compiler call, and Swift compiles are not served by ccache.
- Cost without benefit: about 20 s per job for `brew install ccache`, 500 MB of GitHub cache per target per run, and a server to run and defend.
- Time in the iOS job: `Build the app without signing` is 1177 s (iPhone) and 1280 s (iPad) out of about 25 minutes. The 12 earlier successful iOS runs took between 11 and 28 minutes with the same cache state, and one run had 717 s for iPhone against 1543 s for iPad, so runner variance, not caching, dominates the numbers. The same builds with ccache removed took 1103 s / 1127 s (pull request run) and 775 s / 1228 s (dispatched run) for iPhone / iPad.

What was built is in the history of PR #44 (commit `b81ed1d`): a `bazel-remote` server behind Traefik with read and write accounts enforced server-side, GitHub environments restricted to `main`, a pinned and checksummed HTTPS helper, fallbacks for every failure, and a Linux integration test against the live server (all passed, cold compile stored, empty local cache served from the remote). It can be restored from there if a cacheable compile ever appears.

Xcode 26's own compilation cache (`COMPILATION_CACHE_ENABLE_CACHING`) is the candidate that could serve Swift and Clang compiles. It was not tried: it needs explicit modules and its remote mode uses a different protocol, so it needs its own measured experiment (cold run, then warm run from the same cache).

## Docker builds on the VPS

All Coolify builds run on one BuildKit daemon, so identical layers are shared already. `apps/server/Dockerfile` adds two things:

1. The lockfile and the `package.json` of every workspace package are copied first, then `pnpm fetch` and `pnpm install` run, and only then the code is copied. A code change keeps the install layer.
2. The pnpm store is a BuildKit cache mount (`crew-pnpm-store`, `sharing=locked`) shared by every build on that worker.

When you add or remove a workspace package, add or remove its `COPY .../package.json` line: `tools/ci/server-image-manifests.test.mjs` fails the `checks` job if you forget (the install would otherwise succeed and the server fail at run time).

`tools/ci/check-server-image.sh` (job `server-image`; it runs when the server, its packages, the i18n catalogues it copies, the lockfile or the check itself changed) builds on a fresh builder and verifies, from the built images and not from the build log: a cold build works; a code-only change keeps the install; a change to the dependency inputs does not; `fastify`, `pg`, `zod` and `tsx` resolve; the API answers `/v1/ready` as a non-root user. Builder, images and container are removed on success, failure and interruption. Run on the VPS: 4 min 39 s, passing. It starts the API on its embedded database (PGlite) because no `DATABASE_URL` is set, so a PostgreSQL migration is not exercised here.

The VPS timer `vps-cleanup` runs hourly: at 04:00 it drops build cache older than three days (the pnpm cache mount included), and at any hour it drops all of it once the disk is 80 % full. The next build then starts cold and refills it. The cache is bounded by age, not by size.

## GitHub release

`tools/ci/publish-release.mjs` creates the release as a draft, uploads the files by release id, checks each one (state, size, SHA-256), then publishes. It can be re-run at any point and never overwrites a valid asset or changes a published release.

Checked against the real API with a throwaway preview release (created and removed by the test; `latest` never moved): fresh create; re-run on a published release leaves it untouched; a different IPA under the same tag is refused; an interrupted draft (1 of 4 files uploaded) is completed; a draft holding a different file is left unpublished; duplicate drafts and a tag on another commit are refused. It also ran with the Actions token (`contents: write`) in a throwaway workflow.

Which commit the release points at: `main` and dispatched runs use the commit they built. A pull request run builds GitHub's synthetic merge commit, so its release is anchored to the pull request's own head commit (`RELEASE_SHA`, `build.yml`). Probed with the Actions token: a draft or published release at the current branch tip, the default branch, the current head or the current merge ref is accepted; a target that touches workflow files and is no longer the tip of anything (an older commit of the branch, or a merge ref that moved because `main` or the PR changed) is refused with `403 Resource not accessible by integration`. A run that was superseded by a newer push therefore fails at `release` and in `build-gate` with the message "This run was probably superseded by a newer commit" and publishes nothing; the newest commit has its own run. Re-run on the newest commit, not the old one.

An older version of the publisher left a draft for PR #41 (`v0.2.55-preview.41+build.368`, 4 assets). It is not touched automatically: delete it by hand if it is no longer wanted.

## Limits

- The signing key and publish token of the OTA server are repository secrets, so a workflow in a branch of this repository can read them. They are not protected by an environment.
- `build-gate` for a new IPA requires `release` and `altstore` only when the run is allowed to publish (same-repository PR, `main`, or a dispatch with `pr`). Fork runs never publish.

## Native version reservations

`crew-version/vX.Y.Z` annotated tags reserve unique native versions. Their annotation identifies the Build run (`build-N`), not the source revision. New reservation tags point to a fetched, already-published `main` commit instead of the temporary PR merge commit. This avoids GitHub's workflow-file permission rejection without expanding token scopes. Existing reservations remain valid, and reruns reuse their own version. The actual release tag still identifies the build source commit; never substitute the reservation anchor for release provenance.
