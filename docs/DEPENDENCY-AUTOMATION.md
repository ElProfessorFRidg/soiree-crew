# Dependency updates and Dependabot auto-merge

- Dependabot checks pnpm/npm workspace dependencies daily, and GitHub Actions weekly.
- Security update PRs are issued when fixable advisories are detected; Dependabot does not bypass Expo compatibility constraints.
- The `pull_request_target` workflow only enables auto-merge for Dependabot **patch** updates. It does not check out PR code.
- **Repository settings required:** Settings → General → Pull Requests → Allow auto-merge. This is currently disabled and cannot be toggled by the available GitHub connector.
- **Before enabling:** Settings → Rules → Rulesets (or Branch protection rules) → protect `main`, require pull requests and successful status checks from the `Build` workflow: `checks` and `build-gate`. `build-gate` is green only when the route the build chose was carried out; a dependency update always takes the new IPA route, so it still needs `ios` and `ios-launch` to pass (docs/OTA.md). Set any other critical checks to required. Do not bypass protections for Dependabot. The existing Build pipeline is expensive but validates native iOS artifacts.
- Settings → Advanced Security → enable Dependabot alerts and Dependabot security updates.
- If auto-merge is enabled **without** required branch checks, GitHub may merge a patch PR without waiting for successful CI. Therefore do not enable auto-merge until protection is active.
- Critical/high advisories are not necessarily fixed by a patch. Major/minor security upgrades remain manual for compatibility review. A package with no patched upstream release cannot be fixed by Dependabot alone.
- The `pnpm audit --prod` step in `Build` currently has `continue-on-error: true`; it is informational, not a gating security scan.
