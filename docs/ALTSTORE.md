# AltStore and SideStore source

Add this source once in AltStore or SideStore (Browse, then Sources, then +):

```
https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/source.json
```

The same file works in SideStore, Feather, KSign, ESign and the other apps that read AltStore sources: it carries both the current format (`versions`) and the first one (`version`, `downloadURL` on the app). Scarlet reads its own format:

```
https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/scarlet.json
```

Soirée Crew then shows up with every published version, its notes, its size and its own screenshots. The cards at the top of the source are one per version: its picture (three of its screens), everything it brings and, behind "Open", its release page. The source has a header made from the latest screens. New versions appear as updates in AltStore, which re-signs and installs them over the old one (data kept).

How it is kept up to date:

- `.github/workflows/altstore.yml` rebuilds `source.json` and `scarlet.json` from the releases published on GitHub, the only record that counts (`tools/ci/altstore-source.mjs`). The workflow keeps the last 40 versions, the icon, and the privacy strings read from `apps/mobile/app.json`. It compiles nothing and takes about a minute.
- **Notes:** each version's notes for people are written in `apps/mobile/store/release-notes.json`, in French (shown) and English. Add the next version's lines there before or after its release; a version without them shows its list of changes, cleaned of commit prefixes and install lines.
- **Screenshots:** each version keeps its own in `screens/<version>/` on the branch, from the CI screenshots of its build (a simulator set to France, Paris time). Only the screens in `SHOWCASE` are shown, in that order. A version released before this layout gets them from its build's `ios-launch` artifact while GitHub keeps it (14 days); otherwise its card uses the header.
- **Pictures:** `tools/ci/altstore-images.py` (Pillow) draws each version's card (`screens/<version>/banner.png`, 5:3 like the cards of Feather and KSign) and the header (`header.png`).
- It runs on its own after each release of the Build workflow, with that build's screenshots. It also runs when its script, its pictures script, the release notes, its workflow or the app icon changes on `main`, and from the Actions tab (Run workflow).
- The Build workflow ignores pushes that only touch Markdown, `docs/`, `research/`, the release notes or the source's scripts and workflow: changing the source never rebuilds the app.
- The source lives on the `altstore` branch, never on `main`: updating it does not start a build either.
- Each version links to its own release asset (`releases/download/<tag>/soiree-crew-unsigned.ipa`), so an older version stays installable.

In the app (O-12), the check runs on its own:

- **At launch:** it checks unless it already did in the last 10 minutes.
- **Back from the background:** at most every 6 hours.
- **When a newer version is out:** the first time it is seen, a toast says so with "Installer", and a banner stays in Me and Settings. On iOS "Mettre à jour avec AltStore" opens AltStore or SideStore on this source, and falls back to the IPA download when neither is installed.

The setting "Chercher les nouvelles versions" turns the automatic checks off; "Vérifier maintenant" asks at once.
