# Over-the-air fixes on iOS

GitHub Actions keeps producing the iPhone and iPad IPAs. Once an IPA that ships Expo Updates is installed, the app fetches available fixes at launch. Offline, it starts with the code already on the device. A finished download is applied at the next cold start.

Updates come from our own server, not from Expo: no Expo account and no EAS. The server speaks the Expo Updates protocol (version 1) and lives in `deploy/ota/server.mjs`.

## How it fits together

- **Server**: `https://ota.crew.57.128.183.60.sslip.io`, a Coolify service (`crew-ota`) running `deploy/ota/server.mjs` on `node:22-alpine`. Updates and assets are stored in `/srv/crew-ota/data` on the VPS. The server only stores the SHA-256 of the publish token.
- **Signing**: CI builds and signs every manifest with the code signing key. The IPA embeds `apps/mobile/certs/ota-certificate.pem` and rejects anything not signed with the matching key. The server never sees the key, so a compromised server cannot push code to the app.
- **Publishing**: the **Expo OTA** workflow runs `expo export`, uploads the files the server does not have yet (`PUT /assets/<sha256>`, checked against their hash), then posts the signed manifest (`POST /publish`). `tools/ci/publish-ota.mjs` does this; `tools/ci/publish-ota.test.mjs` covers it end to end.
- **Channels**: one server for everything. The app sends `expo-channel-name` (`preview-iphone`, `preview-ipad`, `public-iphone`, `public-ipad`) and its runtime version (`crew-<channel>-<target>-<build>`), so an update only reaches the exact IPA it was built for.

## OTA or new IPA

On every push to a PR or to `main`, the **Build** workflow picks the route and records why:

1. **Checks only** when nothing that ships in the app changed (server, docs).
2. **OTA update** when the change only touches the app's JS and assets compared with the IPA the phones run:
   - Preview: the newest preview IPA among the PRs still open, since the Preview app holds whichever one was installed last;
   - public: the newest public IPA.
3. **New IPA** otherwise, with the reason: native code, dependencies, configuration, the certificate, or no IPA with OTA yet.

A needed IPA builds on its own. An OTA update publishes on its own. To get a full Preview IPA when an OTA update would do, comment `/ipa` on the PR. `ipa-command.yml` checks the author has write access, starts **Build** for that PR and reacts with 🚀.

The decision and its reason appear in the run summary and in a one-line comment on the PR (`tools/ci/report-route.mjs`), with the reason folded underneath. One comment tracks Preview and is updated on each push. After a merge, a second comment gives the public decision. A **New IPA needed** comment lists the files that rule out an OTA update.

A change goes to Preview first, on its PR, then to the public app when it merges. Each OTA update adds an entry to What's new, GitHub and AltStore.

## In the app

- Settings and What's new show the installed IPA and the active OTA fix.
- When a fix has downloaded, a toast offers to restart now (`system/OtaNotices.tsx`). Otherwise it applies at the next cold start.
- On the first launch that runs a new fix, a toast says the app was updated and opens What's new.
- The channel switch on the Versions screen chooses which releases and notes to show. The OTA channel itself belongs to the installed app: the Preview app gets Preview fixes, the public app gets public fixes.

## Settings

| Where | Name | Value |
|---|---|---|
| GitHub variable | `CREW_OTA_URL` | `https://ota.crew.57.128.183.60.sslip.io` |
| GitHub secret | `OTA_PUBLISH_TOKEN` | Publish token. The server holds its SHA-256 in `OTA_PUBLISH_TOKEN_SHA256`. |
| GitHub secret | `OTA_SIGNING_KEY` | PEM private key matching `apps/mobile/certs/ota-certificate.pem`. Keep an offline copy: a lost key means a new certificate, so a new IPA for everyone. |

Without `CREW_OTA_URL`, IPAs are built with updates turned off, as before. Forks never get the server URL or the secrets.

## Enable Preview

1. Set the three settings above.
2. Build and install a new Preview IPA. In its release, `ios-build-info-iphone.json` or `ios-build-info-ipad.json` names the embedded channel, runtime and update server.
3. Push a JavaScript or UI fix to this PR's branch. **Build** reuses the latest compatible IPA of this PR. From `main`, it uses the latest public release. The **Expo OTA** workflow can also publish by hand from the exact tag of an IPA.
4. When a new binary is needed, **Build** compiles as usual. **Force IPA** asks for a new binary explicitly.
5. Open the connected app, relaunch it after the download, then check the fix and the OTA identifier in Settings. Check an offline start too.

Once Preview is validated, ship a public IPA. Public OTA publishing runs from `main`. Older IPAs keep receiving new releases through GitHub.

## Compatibility and rollback

The workflow reuses the version, build number and channel validated in the IPA. It compares the fix with the exact commit of that release. The app's JS, TS and asset files, and those of its shared packages, are eligible. Server and documentation changes may ride along. A change to dependencies, native code, the certificate or the server configuration requires a new IPA. Each model and each build has its own runtime.

To roll back, run **Expo OTA** by hand on the IPA tag:

- with **rollback** ticked, the installed IPAs go back to their embedded bundle (signed `rollBackToEmbedded` directive);
- without it, from an older commit, it publishes that older code as a new update.

The server keeps the last 30 updates of each channel and runtime in `/srv/crew-ota/data/updates`. Keeping the GitHub tag of the build when a fix ships lets you find the installed IPA version.

OTA release notes are published on GitHub, AltStore and the What's new screen. They change neither the IPA number nor its download link. Both iOS variants get their own entry. Server-only and documentation-only changes do not publish anything to the phones.

## Rotating the signing key

1. Generate a new pair: `openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out apps/mobile/certs/ota-certificate.pem -days 3650 -subj "/CN=Soiree Crew OTA" -addext "keyUsage=critical,digitalSignature" -addext "extendedKeyUsage=critical,codeSigning"`.
2. Store `key.pem` in the `OTA_SIGNING_KEY` secret, then delete the local file.
3. Ship new IPAs. Installed IPAs only trust the certificate they were built with.
