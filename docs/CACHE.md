# Build caches and release recovery

This runbook covers the GitHub Actions build/OTA workflows and the Coolify server Dockerfile. It does not assert that the external VPS is configured or that any measured speedup is guaranteed.

## 1. Cache inventory

| Cache | Scope | Writers | Retention / key |
| --- | --- | --- | --- |
| pnpm store (GitHub) | OS + architecture + lockfile | main | two recent entries per family |
| ccache + CocoaPods (GitHub) | Xcode + device + lockfile + run | main | two recent entries per device |
| ExpoModulesJSI (GitHub) | Xcode + device + exact lockfile | main | two recent entries per device |
| Optional remote ccache | Dedicated HTTPS backend | protected main only | external VPS capacity/eviction |
| Docker pnpm store | BuildKit worker | builds on that worker | external builder GC |

PRs restore the GitHub caches without saving them. GitHub's own branch isolation and eviction still apply. Same-device native fallbacks are preferred; the JSI slice is exact-key only. Old legacy families may be retained separately. A main-only cleanup job runs after successful build/check jobs; unrelated and PR-scoped caches are never deleted by this script.

Local ccache is capped at 500 MB and checks compiler contents. The CI uses a separate probe directory, checks a real repeat compilation, resets statistics, then reports Xcode's own calls. A zero-call warning means no proven acceleration. Swift and prebuilt binaries are not accelerated by ccache.

## 2. Remote cache: disabled until explicitly approved

Keep CREW_CACHE_ENABLED unset or false until the following infrastructure checks are done. Local caching works independently.

1. In repository Settings > Environments, create crew-cache-main and restrict deployment branches to exactly main. Do not use a broad wildcard. Put CREW_CACHE_WRITE_PASSWORD **only** in that environment, never in repository/organization secrets available to PRs. Remove and rotate any old CREW_CACHE_PASSWORD.
2. Create crew-cache-preview with a distinct CREW_CACHE_READ_PASSWORD. Never put the writer password in this environment.
3. On the VPS, enforce authentication and method authorization server-side: ci can read/write; ci-read can only GET (and HEAD if needed). Deny PUT, POST, PATCH, DELETE and other methods for the reader. Do not expose the backend port outside its reverse proxy. Use valid TLS, a bounded cache volume and a private upstream. Disable Bazel action-cache payload validation if necessary for ccache's opaque entries.
4. Verify on a disposable cache namespace: unauthenticated requests fail; writer PUT/GET succeeds; reader GET succeeds but PUT/DELETE fail; writer can remove the test object. Never test on an existing production object. Verify no redirect to another origin and no credentials in proxy logs. Rotate secrets after any suspected disclosure.
5. Set CREW_CACHE_URL to the verified HTTPS endpoint. Set CREW_CACHE_ENABLED=true only after these checks. A missing helper or credential causes a warning and local-only fallback. The ccache 4.14 HTTPS helper (ccache-storage-https) must be installed on the runner; the workflow detects it, does not silently install an unpinned binary. Configuration uses helper=, @layout=bazel and explicit timeouts. Main additionally checks a read-after-write round trip. Do not count probe hits as build hits.

If the VPS fails, set CREW_CACHE_ENABLED=false immediately; no app code or releases need changing. Client-side read-only is defense in depth, not authorization. A PR with access to the reader secret must still be unable to write at the reverse proxy.

References: https://ccache.dev/manual/4.14.html and https://ccache.dev/storage-helpers.html.

## 3. Docker image

The server copies workspace manifests and the lockfile before installing; code-only changes retain the dependency layer. The pnpm BuildKit mount uses sharing=locked to serialize access to the same worker store. A cold build still needs network access. The host's build cache and garbage collection are not controlled by this repository.

The server-image CI job tests relevant changes using an isolated BuildKit builder: a cold build, a code-only warm rebuild (asserts the install layer was cached), then starts the image using a disposable data key, verifies /v1/ready and checks non-root execution. It never uses the production database or credentials. The build gate requires this job to succeed.

Manual reproduction: from repository root, run bash tools/ci/check-server-image.sh with a disposable GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT and Docker Buildx available. The script temporarily appends a comment to a server source file and restores it on exit; use a clean checkout. For a concurrency benchmark, build two distinct image tags against the same disposable builder and compare wall time, cache hits and disk usage. Do not clear the production builder cache merely to benchmark.

## 4. Release transaction and recovery

1. Validate tag, channel, version and commit identity.
2. Locate or create a draft for that exact tag.
3. Compare each existing asset's name, byte size and SHA-256 against the downloaded CI artifact. Reject unexpected, duplicate or corrupted assets. An empty starter asset in a draft is the only automatically removable asset.
4. Upload missing files without clobbering, re-list and verify all assets.
5. Publish the draft; preview releases never become public latest. Verify the tag points to the expected commit.
6. Only then expose the tag to the downstream AltStore job.

A failed or lost response can be retried without replacing valid assets. Published releases are verified without modification. Authentication/identity/integrity failures stop immediately; transient HTTP/network errors use bounded backoff. Same-run publication jobs are serialized. If an immutable published release is incomplete or corrupted, do not delete it automatically: investigate and create a new release with a fresh version/build.

The required build-gate now waits for server-image and, on an authorized IPA route, release and AltStore as well as compilation and simulator checks. Fork PRs are not expected to publish. Android is required only when explicitly requested.

## 5. Verification and rollback

- On a PR: inspect checks, server-image, both iOS builds/launch jobs, release, AltStore and build-gate. On OTA/checks-only routes inspect the expected route rather than requiring skipped jobs.
- On main: verify cache save/prune results and the public release; a PR cannot exercise main-only writes or the prune job.
- Inspect actual ccache hit/miss counters and compare cold/warm wall times before claiming gains.
- A safe rollback for remote storage is the feature flag; for a code regression revert the relevant commit through a new PR. Never disable the required build gate to merge a broken build.
- The VPS setup, remote helper availability and production cache permissions require independent operational verification; a green preview alone is insufficient.
