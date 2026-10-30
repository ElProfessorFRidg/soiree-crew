# Version names

Every release of `main` is named `major.minor.patch`: 0.1.1, 0.1.2, 0.1.3...

- **Patch**, automatic. CI (`version` job, `tools/ci/next-version.mjs`) takes the highest release tag of the current series and adds one. Nobody edits it.
- **Series** (`major.minor`), by hand: `expo.version` in `apps/mobile/app.json`, written `0.1.0`, `0.2.0`, `1.0.0`. The next release after a change starts at `.1`.

When to move the series:

| Move | When |
| --- | --- |
| 0.x to 0.(x+1) | A set of features people notice comes in together, or the server stops accepting what older apps send (a migration older builds cannot follow). Write the reason in the commit that changes `app.json`. |
| 0.x to 1.0 | The app is ready for people outside the crew: the P0 features of `FEATURES.md` are `done`, sign-in and push work on a signed build, and the public server is up. |
| 1.x to 2.0 | A change that forces everyone to update or loses data on older apps. |

Tags read `v0.1.3+build.71`. The part after `+` is the CI run number: the iOS build number, and what the in-app update check compares (O-12), so apps built before version names still see newer releases. Releases from before this scheme are tagged `v0.1.0-build.N` and do not count towards any patch.

The app shows its name in Settings ("Soirée Crew 0.1.3 (build 71)"). CI passes `APP_VERSION` and `BUILD_NUMBER` to the whole iOS and Android jobs, because Xcode reads the app config a second time when it bundles the JavaScript.
