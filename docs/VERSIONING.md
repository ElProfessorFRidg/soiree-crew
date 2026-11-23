# Version names

Every native release uses `major.minor.build`. For example, Build run 310 in series 0.2 produces 0.2.310.

- **Last component**, automatic. GitHub Actions assigns a unique run number within the Build workflow. Public and Preview releases use this number, so concurrent PRs get distinct numerical versions.
- **Series** (`major.minor`), by hand: `expo.version` in `apps/mobile/app.json`, written `0.1.0`, `0.2.0`, `1.0.0`.

When to move the series:

| Move | When |
| --- | --- |
| 0.x to 0.(x+1) | A set of features people notice comes in together, or the server stops accepting what older apps send (a migration older builds cannot follow). Write the reason in the commit that changes `app.json`. |
| 0.x to 1.0 | The app is ready for people outside the crew: the P0 features of `FEATURES.md` are `done`, sign-in and push work on a signed build, and the public server is up. |
| 1.x to 2.0 | A change that forces everyone to update or loses data on older apps. |

A new tag reads `v0.2.310+build.310` or `v0.2.311-preview.28+build.311`. Previously published tags stay installable. Preview releases have their own app ID and never move the public latest release.

An OTA update keeps the installed IPA’s version and build. The Settings screen shows the OTA revision separately. See [OTA.md](OTA.md).

The app shows its name in Settings ("Soirée Crew 0.2.310 (build 310)"). CI passes `APP_VERSION` and `BUILD_NUMBER` to the whole iOS and Android jobs, because Xcode reads the app config a second time when it bundles the JavaScript.
