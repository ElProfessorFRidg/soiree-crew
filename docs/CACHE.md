# Shared build caches

## iOS compiler cache

Local ccache uses an explicit directory, a 500 MB limit and compiler content hashing. CI checks a real local compiler hit before Xcode, resets the counters and reports actual Xcode cache activity afterwards. A warning means no measured speedup; prebuilt React Native artifacts and Swift are not accelerated by ccache.

Remote storage is optional. ccache 4.14 needs an installed HTTPS helper (ccache-storage-https), @layout=bazel and explicit request/data timeouts. The workflow discovers the Homebrew helper, checks a real compilation against the remote backend and falls back to local caching if unavailable. Main additionally checks a remote round trip. Credentials are masked and probe statistics are isolated.

Settings: CREW_CACHE_URL, CREW_CACHE_PASSWORD (ci writer), and CREW_CACHE_READ_PASSWORD (ci-read reader). Do not configure the reader unless the VPS enforces GET-only authorization for that account. Protect the writer secret from untrusted workflow changes; client read-only is not a security boundary. Infrastructure/account configuration is separate from this repository and must be verified on the VPS before enabling remote storage.

## GitHub Actions cache

Build and OTA jobs explicitly restore pnpm caches; only main saves. Native caches prefer the same device and lockfile before same-device fallbacks. ExpoModulesJSI uses a device-specific exact lockfile key. A main-only job retains the two newest caches per family on main (including recognized legacy native keys); unrelated and PR caches are untouched. Cache quota/eviction are also governed by GitHub.

## Docker builds on the VPS

The server installs from manifests before copying sources and uses a BuildKit pnpm store mount. A code-only rebuild can reuse these layers. Cold builds and cross-preview concurrency still require separate measurements. VPS storage and cleanup are controlled outside this repository.

## GitHub release recovery

Releases are staged as drafts. Only missing assets are uploaded; valid assets are never clobbered. Size and SHA-256 must match before publishing. Only an incomplete starter asset in a draft may be removed. Published releases are verified without mutation. Transient API errors are retried; identity or integrity failures stop publication. Reruns of the same workflow run are serialized at the release job.
