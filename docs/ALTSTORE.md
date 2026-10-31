# AltStore and SideStore source

Add this source once in AltStore or SideStore (Browse, then Sources, then +):

```
https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/source.json
```

Soirée Crew then shows up with every published version, its notes, its size and the screenshots of the build. New versions appear as updates in AltStore, which re-signs and installs them over the old one (data kept).

How it is kept up to date:

- The `release` job of `.github/workflows/build.yml` publishes the GitHub release, then runs `tools/ci/altstore-source.mjs`. The script puts the new version on top of `source.json`, keeps the last 40, refreshes the screenshots taken by the `ios-launch` job, the icon, and the privacy strings read from `apps/mobile/app.json`.
- The source lives on the `altstore` branch, never on `main`: pushing it does not start a build.
- Each version links to its own release asset (`releases/download/<tag>/soiree-crew-unsigned.ipa`), so an older version stays installable.

In the app (O-12), the check runs on its own:

- **At launch:** it checks unless it already did in the last 10 minutes.
- **Back from the background:** at most every 6 hours.
- **When a newer version is out:** the first time it is seen, a toast says so with "Installer", and a banner stays in Me and Settings. On iOS "Mettre à jour avec AltStore" opens AltStore or SideStore on this source, and falls back to the IPA download when neither is installed.

The setting "Chercher les nouvelles versions" turns the automatic checks off; "Vérifier maintenant" asks at once.
