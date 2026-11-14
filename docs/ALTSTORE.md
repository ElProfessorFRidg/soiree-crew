# AltStore and SideStore source

Add this source once in AltStore or SideStore (Browse, then Sources, then +):

```
https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/source.json
```

The same file works in SideStore, Feather, KSign, ESign and the other apps that read AltStore sources: it carries both the current format (`versions`) and the first one (`version`, `downloadURL` on the app). Scarlet reads its own format:

```
https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/scarlet.json
```

The source shows two independently installable apps once a tested preview has shipped:

- **Soirée Crew**, the public releases from `main`, bundle ID `app.soireecrew.mobile`.
- **Soirée Crew Preview**, tested repository-owned PR builds, bundle ID `app.soireecrew.mobile.preview`, a separate URL scheme and separate local storage. Installing it leaves the public app installed. Server-side data still follows the account/server chosen inside each app.

For the native iPad app, use `source-ipad.json` instead of `source.json` (and `scarlet-ipad.json` instead of `scarlet.json`). A channel appears only after an IPA for that device has actually shipped. Older public releases with only a phone IPA are therefore absent from the native iPad source. Use the source matching your device, rather than adding both. There is no native iPad fallback to a phone compatibility IPA.

Each app's `versions` array contains every published version/build with an immutable release-asset URL, including historical `v0.1.0-build.N` tags and multiple builds of the same version. Previews use tags such as `v0.2.5-preview.4+build.115`; they are GitHub prereleases and never move the public `/latest` link or consume a public patch number. Drafts and fork PRs are not published. A preview is published only after checks, both native builds and both simulator checks pass. The source is then refreshed automatically.

Some sideloading readers expose only the latest install button, even with a complete `versions` array. News cards now link directly to their exact IPA. In the app, **Settings → Versions and downloads** also lists public and Preview builds, including older builds, with a download button for each. This gives people access to the archive without relying on a particular reader's history UI. AltStore, not this source, controls whether its own version-history menu is visible.

How it is kept up to date:

- `.github/workflows/altstore.yml` rebuilds the iPhone and iPad AltStore/Scarlet sources from all pages of GitHub releases (`tools/ci/altstore-source.mjs`). It retains the full downloadable archive, limits only News to 20 cards, and reads privacy strings from `apps/mobile/app.json`.
- **Notes:** each version's notes for people are written in `apps/mobile/store/release-notes.json`, in French (shown) and English. Add the next version's lines there before or after its release; a version without them shows its list of changes, cleaned of commit prefixes and install lines.
- **Screenshots:** new builds use `screens/<tag>/<iphone|ipad>/`, with the exact tag passed by the publishing job, so concurrent public/preview releases and repeated versions cannot mix images. Legacy `screens/<version>/` pictures remain usable. Only `SHOWCASE` screens appear. Expired screenshot artifacts do not affect IPA downloads: those are permanent release assets.
- **Pictures:** `tools/ci/altstore-images.py` (Pillow) draws each build's card next to its screenshots and the source header.
- It runs on its own after each release of the Build workflow, with that build's screenshots. It also runs when its script, its pictures script, the release notes, its workflow or the app icon changes on `main`, and from the Actions tab (Run workflow).
- The Build workflow ignores pushes that only touch Markdown, `docs/`, `research/`, the release notes or the source's scripts and workflow: changing the source never rebuilds the app.
- The source lives on the `altstore` branch, never on `main`: updating it does not start a build either.
- Each version links to its own release asset (`releases/download/<tag>/soiree-crew-unsigned.ipa`), so an older version stays installable.

`CREW_PREVIEW_SERVER_URL`, when configured as a repository variable, selects the preview backend. Otherwise the build suggests `CREW_SERVER_URL`; a separate app ID does not create a separate backend. Both variables are read during prebuild and JavaScript bundling. The preview channel is selected by `CREW_RELEASE_CHANNEL=preview` and is validated against the actual built bundle ID before packaging. A public build never recommends a preview as an automatic update; updates also select the exact iPhone/iPad asset instead of the first `.ipa` in the release.

In the app (O-12), the check runs on its own:

- **At launch:** it checks unless it already did in the last 10 minutes.
- **Back from the background:** at most every 6 hours.
- **When a newer version is out:** the first time it is seen, a toast says so with "Installer", and a banner stays in Me and Settings. On iOS "Mettre à jour avec AltStore" opens AltStore or SideStore on this source, and falls back to the IPA download when neither is installed.

The setting "Chercher les nouvelles versions" turns the automatic checks off; "Vérifier maintenant" asks at once.
