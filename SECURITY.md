# Security (SEC-09)

Threat model per major feature (STRIDE), then the checks that run on every change. Data handling and rights are in `docs/PRIVACY.md`.

## Baseline

- Transport: the server runs behind HTTPS (TLS 1.2+, set at the host). The app accepts plain `http://` only for local network addresses (localhost, 10.x, 192.168.x, 172.16 to 31.x, `.local`), for a server at home.
- Identity: random 32-byte device tokens; the server stores SHA-256 hashes only. New phones join with a 10-character one-time code from a signed-in phone, valid 10 minutes. No passwords (A-ORCH-9).
- Health data, IBANs and SOS locations are sealed with AES-256-GCM under `DATA_KEY`, outside the database.
- Every endpoint checks crew membership and answers 404, not 403, for other crews' ids (SEC-01).
- Logs keep paths, never query strings or bodies (the live socket token rides in the query).
- Responses carry HSTS (when `PUBLIC_URL` is https), `nosniff`, `no-referrer` and `DENY` framing.

## Threat model

| Feature | Threat | STRIDE | Mitigation |
|---|---|---|---|
| Sign-up, sign-in | Guessing transfer codes | S | 10 attempts per 10 min per address, codes single-use and short-lived |
| Sessions | Stolen phone stays signed in | S, E | Devices list with remote sign-out; sign-out deletes the session on the server; new-device alert |
| Drinks and BAC | Someone else logs or deletes my drinks | T | Mutations carry my token; a drink id owned by another user is rejected |
| Drinks and BAC | Database leak exposes health data | I | Sealed columns; `DATA_KEY` kept out of the database |
| Live dashboard | A stranger watches a crew's night | I | Crew-only; BACs only during a party |
| Rounds | A member inflates someone's drinks | T, R | Round drinks are visible to their owner and removable; the expense names the payer |
| Leaderboards | Fake drinks to win | T | Only drinks confirmed by a friend count; danger cap; burst limits (AC-07) |
| Check-ins and territories | Mock location, teleporting | S, T | Weighted anti-cheat signals, reject bands, corroboration, overturn by the crew (AC-01 to AC-09); raw coordinates dropped |
| Pools | Editing someone else's expense | T | Only the creator or payer deletes; splits validated server-side |
| Pools | IBAN harvesting | I | Sealed; shown to pool members only |
| SOS | Fake alert spam | D | Crew-only: only members receive it, and any member can resolve it |
| Recap | Reactions as harassment | T | Fixed emoji set, one per person per participant, removable |
| Export | Someone exports my data | I | Needs my session; contains my data only |
| Account deletion while drunk | Irreversible action regretted | T | Next-morning vault from UI level 2 (ADP-06) |
| Messaging | The server or its host reads chats | I | MLS end to end (ADR 0005): the server holds ciphertext, key packages and welcomes, never a key; media sealed per file on the phone |
| Messaging | The server adds a device it controls to a group | S, I | Every leaf key is checked against the device list, devices are visible per person, safety numbers cover all of a person's keys, and a change shows a notice (MSG-05) |
| Messaging | A member poses as another member | S | The MLS sender is read from the authenticated framing, never from the payload; leaf keys must match the device list |
| Messaging | Someone who left keeps reading | I | Members who leave a crew or party and signed-out phones are removed by a commit; the next epoch has keys they never get (post-compromise security), and each device renews its own keys daily |
| Messaging | A reporter or moderator sees more than needed | I | Only the reported message and up to 3 around it, decrypted on the reporter's phone by their choice, sealed at rest |
| Messaging | Lost phone, history exposed | I | History, group state and keys sealed on the phone with a Keychain / Keystore key; the backup opens only with the user's 160-bit recovery key |
| Whole API | Request floods | D | Body size limit 512 KB; per-route limits on auth; the host's proxy for the rest |

## Route audit (October 2026)

Every route was checked for an ownership or membership test before it reads or writes. The ones without one are scoped by design: the caller's own account and sessions, the caller's own crews and parties lists, the public invite page, and photo files behind a signed, expiring link.

## Checks on every change

- `pnpm check`: typecheck, 270+ tests including authorisation tests per route, slop lint.
- CI runs the same on every push before building.
- Dependencies: `pnpm audit --prod` in CI, reported, not blocking yet.
- Secrets: nothing secret in the repo; `DATA_KEY` and tokens come from the environment. `apps/server/data` (local PGlite and its dev key) is git-ignored.

## Export compliance (SEC-10)

The app itself only uses the system's HTTPS: `ITSAppUsesNonExemptEncryption` is `false` in `app.json`. The AES-256-GCM sealing runs on the server, not in the app. A public release still needs the App Store questionnaire answered and the French ANSSI declaration checked by the publisher; the working memo is `docs/EXPORT_COMPLIANCE.md`.

## Red team (AC-10), first pass

A dedicated agent attacked the local dev server with throwaway accounts (mock and forged locations, clock games, drink batches, replayed and forged requests, IDOR, privilege escalation, collusion, rate limits, malformed input). Fixed:

- Pools were readable by any crew member, members' IBANs included: every pool route now requires being in the pool.
- A drink's "logged at" came from the client, so a backdated batch looked logged on the spot: the server now stamps it on receipt. A friend present still vouches for a drink that arrived late (offline).
- A jump between two bars under 5 km apart was not flagged: a "city speed" signal (over 90 km/h on more than 1 km) now makes the check-in wait for a friend's confirmation (anti-cheat config version 2).
- Empty or oversized bodies and malformed ids answered 500: they now answer 400, 413 and 404.

Known and accepted: a modified client that sends a plausible fix with `mocked: false` gets an accepted check-in. Location alone cannot prove presence; that is why points need corroboration over time (AC-04, AC-06) and why the admin can overturn.

## Second audit (28 October 2026)

Two fresh reviewers went through every server route and every platform path (iOS, Android, web). Fixed, each with a regression test in `apps/server/src/security.test.ts` where it is server-side:

- A cheers between two accounts lifted two unverified check-ins into points. A cheers now vouches like a one-tap confirmation: only a check-in that stood on its own signals can vouch, and the nightly cap applies.
- Re-sending a known pool id added the sender to that pool: an existing id is now a replay of my own request or a 409.
- A crew admin could overturn their own rejected check-in: refused now.
- Someone could say "going" to a finished night and get it counted: closed nights refuse sign-ups, and status needs "going".
- Someone who walked into an open crew could join a night already under way and read live levels and positions: refused, and their live view shows no levels. An invite still works.
- A confirmed drink could be edited and stay confirmed: changing volume, strength or time drops the confirmation.
- Leaving a crew kept its live and coming nights, and their chats: they go with it now.
- Public place pages showed presence in real time: COM-06 applied (a day late, at least five people, rounded to five, private check-ins excluded).
- Crew mates who were not at a night saw everyone's BAC curve in the recap: curves are for the people who were there.
- Five wrong passwords from anywhere locked the owner out: the limit is per login and address, with a looser one per login.
- Sessions never expired and a new password left other devices signed in: 90 days idle ends a session, and a new password signs the other devices out. scrypt raised to 2^17.
- Invite codes, uploads and payment links: rate limits on invite lookups, a daily upload budget per account, https payment links only.
- Account deletion left the sealed chat backup on disk: it goes with the account.
- Operators can be listed by account id (`OPERATOR_IDS`), so an unclaimed username cannot become an operator.
- Web check-ins never count on their own (a browser can fake its position).
- App side: confirmation dialogs work on web; an SOS goes out even when the location fails; the microphone always stops; decrypted voice and video files are deleted; http to a server is limited to localhost and real private addresses; a crash shows a retry screen instead of a blank app.

Known and still open:

- The app's local store (profile, drinks) is not encrypted at rest (SEC-05 asks for it), and the app-switcher snapshot is not hidden.
- The live socket carries the session token in its URL, which can end up in proxy logs.
- Drink kind, times and water times are stored in clear on the server; only volume, strength and the body profile are sealed. The sealing key does not rotate.
- The offline envelope trust (AC-12) is stored but not used by scoring yet.
- Report evidence in chat is what the reporter's phone sends; admins should read it as unverified.
- Voice notes recorded in a desktop browser (webm) may not play on iPhone. The web photo queue lives in localStorage, and two web tabs share one chat state.
- `TRUST_PROXY=true` must only be set when the port is not reachable directly, or IP rate limits can be dodged.

## Not done yet (before any public release)

- An independent review of `packages/mls` and of ts-mls, which has had no formal audit (ADR 0005), or a move to OpenMLS behind the same interface.

- Certificate pinning and app integrity (App Attest, Play Integrity) as anti-cheat signals (AC-05, SEC-03).
- Passkeys and optional 2FA (SEC-07).
- Static analysis beyond TypeScript strict mode, OWASP MASVS L2 review.
- A second red-team pass with two phones: BLE handshake, real mock-location apps and an intercepting proxy (AC-10).
