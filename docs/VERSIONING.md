# Version names

Native releases use a short `major.minor.patch` version and a separate GitHub Actions build number. For example, a Preview may use `0.2.12` with build 289 and the next IPA may use `0.2.13` with build 290.

- **Patch**, automatic. Public and Preview builds reserve the next number in the current series through a Git tag. Concurrent PRs get distinct versions. A rerun keeps its reservation. Abandoned builds can leave gaps.
- **Series** (`major.minor`), by hand: `expo.version` in `apps/mobile/app.json`, written `0.1.0`, `0.2.0`, `1.0.0`.

When to move the series:

| Move | When |
| --- | --- |
| 0.x to 0.(x+1) | A set of features people notice comes in together, or the server stops accepting what older apps send (a migration older builds cannot follow). Write the reason in the commit that changes `app.json`. |
| 0.x to 1.0 | The app is ready for people outside the crew: the P0 features of `FEATURES.md` are `done`, sign-in and push work on a signed build, and the public server is up. |
| 1.x to 2.0 | A change that forces everyone to update or loses data on older apps. |

A new release tag reads `v0.2.13+build.290` or `v0.2.12-preview.28+build.289`. Previously published tags stay installable. Preview releases have their own app ID and never move the public latest release.

An OTA update keeps the installed IPA’s version and build. The Settings screen shows the OTA revision separately. See [OTA.md](OTA.md).

The app shows its name in Settings ("Soirée Crew 0.2.13 (build 290)"). CI passes `APP_VERSION` and `BUILD_NUMBER` to the whole iOS and Android jobs, because Xcode reads the app config a second time when it bundles the JavaScript.
