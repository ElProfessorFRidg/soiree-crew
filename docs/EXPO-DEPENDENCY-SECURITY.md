# Expo CLI dependency advisories (20 November 2026)

## Scope and exposure

The project's lockfile currently resolves `apps/mobile > expo@58.0.21 > @expo/cli@58.1.17 > node-forge@1.4.0` and `zod@3.25.76`. Another `node-forge@1.4.0` instance is required by `@expo/code-signing-certificates@0.0.7`. The backend has a distinct `zod@4.6.7` copy.

The vulnerable packages shown in the supplied audit sit in the Expo CLI *tooling path*. This is not evidence that the installed iOS/Android bundle executes those code paths or exposes a remotely reachable endpoint. Conversely, `pnpm audit --prod` does not isolate runtime exposure: Expo is a production dependency even though its CLI is used principally in builds. Treat build machines, CI inputs and certificate/signing operations as a separate attack surface.

## Known advisories

- `node-forge`: GHSA-86w9-cpqp-85rv has **no upstream patched release** as of this review. Even upgrading from 1.4.0 to 1.4.1, if it becomes available, must be checked against this advisory before calling it fixed. Other Forge advisories list >=1.4.1 as patched, but 1.4.1 has not been verified as published.
- `zod`: GHSA-mrhx-c7xc-m3w5 is patched by >=4.6.6. Expo CLI currently resolves Zod 3.25.76; a package-manager override to 4.x is a breaking-major substitution and should only be proposed after testing Expo start, prebuild, iOS and Android builds.
- The supplied audit reports **24 total findings (6 low, 9 moderate, 9 high)**. This document investigates the two packages shown, not every finding.

## Remediation plan

1. Let Dependabot create upstream Expo-compatible patch/minor dependency update PRs; test with `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm test`, Expo prebuild and iOS/Android builds.
2. When Expo upstream removes the Forge dependency, replaces its affected code path, or publishes a compatible safe fix for Zod, take that dependency update and verify both actual resolved paths and the audit results.
3. Do not downgrade the security audit threshold, ignore these advisories as 'fixed', or force a major override merely to silence the audit.
4. In the meantime restrict CI secrets and trusted build inputs; keep GitHub Actions permissions minimal and avoid exposing build tooling to untrusted scripts.

Upstream references: https://github.com/advisories/GHSA-86w9-cpqp-85rv and https://github.com/advisories/GHSA-mrhx-c7xc-m3w5. Expo has been tracking CLI Forge exposure in https://github.com/expo/expo/issues/51773.

**Status:** monitoring/mitigation only. The lockfile is still vulnerable. No runtime vulnerability or exploit has been demonstrated in the installed Soirée Crew app by this review.
