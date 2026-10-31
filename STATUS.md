# Status

Generated from FEATURES.md on 2026-10-31 by `pnpm status`. Edit FEATURES.md, not this file.

| Status | Count |
|---|---|
| Built | 244 |
| Partly built | 59 |
| To do | 2 |
| Proposed (not in the brief yet) | 4 |
| Total | 309 |

## Partly built

- **O-01** (P0, Account, profile, settings): Sign up / sign in with email and Google (first name and username kept separate). Add Sign in with Apple (requi
- **O-04** (P0, Account, profile, settings): Profile for the BAC model: weight, sex (check what the model really needs; S2M dropped height because the calc
- **O-09** (P0, Account, profile, settings): 7 languages: FR, EN, ES, IT, DE, PT, RU. The whole app, not a few screens. See <localization>.
- **O-33** (P0, Widgets): iOS and Android home-screen widget in 3 sizes: live curve that falls on its own, back-to-zero, interactive but
- **O-42** (P0, Parties and trips): Squad mode: curves shared continuously between members.
- **O-63** (P0, Games (15)): "Gribouille": one player draws, the others guess, 3 to 8 players online (real-time, multi-phone).
- **O-66** (P1, The Bar (recipes)): 470+ recipes with photo and preparation: Classics, Shots, Party, Alcohol-free, Beers, Desserts, + signature co
- **O-83** (P1, Requests from S2M users): Photo when logging a drink.
- **O-84** (P1, Requests from S2M users): Photos and videos shared that stay inside the group.
- **HUB-02** (P0, Party hub): iOS Live Activity / Dynamic Island and a persistent Android notification during the party: BAC, back-to-zero, 
- **HUB-03** (P0, Party hub): Lock-screen widgets (BAC, next water, who is out tonight).
- **N-18** (P0, Rounds and money): Rounds: who pays next (fair rotation computed); logging a round adds the drinks to each person AND the expense
- **N-21** (P1, Crew memory): Shared album per party (photos and videos private to the group, O-84) + optional photo when logging a drink (O
- **QOL-01** (P0, Everyday polish): "Same again": one tap re-logs the last drink (same size, same price, same venue), also from the widget, the no
- **QOL-03** (P0, Everyday polish): Actionable notifications: answer "On my way" / "Not tonight" to "who's in?", add a drink, confirm a round or a
- **QOL-04** (P0, Everyday polish): System shortcuts for a drunk thumb: Siri / App Intents and Android App Actions ("Hey Siri, add a beer"), iPhon
- **QOL-05** (P0, Everyday polish): Deep links and universal links for every party, venue, profile, crew invite, recap and game card. Links pasted
- **QOL-06** (P0, Everyday polish): Native sharing: recap and story cards go straight to Instagram Stories, Snapchat (Creative Kit), TikTok and Wh
- **QOL-09** (P0, Everyday polish): Photos: compressed before upload, background upload with progress and retry, HEIC accepted, location metadata 
- **QOL-14** (P0, Everyday polish): Navigation without traps: Android back and iOS swipe-back work everywhere, sheets close with a swipe, the app 
- **QOL-15** (P1, Everyday polish): Try before signing up: games and the Bar work without an account; sign-up is asked only when the user needs a 
- **QOL-17** (P1, Everyday polish): Suggestions that save taps: when 3+ crew members check in at the same venue, offer to start a party; when the 
- **QOL-22** (P2, Everyday polish): Last ride home: after midnight, the last night bus / metro departures near the venue on the Party screen, when
- **QOL-24** (P1, Everyday polish): Respect the phone: Low Power Mode lowers refresh rates and effects, a data-saver option for photos, light and 
- **QOL-25** (P0, Everyday polish): Native fast path: every out-of-app action (widget, Live Activity / Live Update, notification action, Siri / Shortcut, Control, Quick Settings tile, launcher sho
- **QOL-29** (P0, Everyday polish): Invite survives the install: a friend who installs from an invite link lands in the right crew or party (Play Install Referrer; invite code plus system Paste bu
- **JOY-01** (P1, Delight): Cheers: bring two phones together (Bluetooth LE / NFC) and both screens play a clink with sound and haptic. It
- **JOY-10** (P2, Delight): Sticker packs (iMessage / WhatsApp) made from crew avatars and moments.
- **ADP-07** (P0, Adaptive drunk mode): Legibility: text size, maximum contrast, readable under strobe or very low light, no disorienting motion (effe
- **ADP-09** (P0, Adaptive drunk mode): Drunk-mode test bench: a tester subagent runs EVERY P0 screen under simulated constraints (one hand, thumb onl
- **MOT-08** (P0, Motion): Cinematic recap: story format, counters rolling, podium rising, curves drawing, badges dropping with confetti,
- **MOT-11** (P1, Motion): Animated widgets and Live Activity, within each OS's limits.
- **MOT-12** (P0, Motion): Performance and motion accessibility: 60 / 120 fps without jank, tested on a modest phone, battery budget resp
- **AC-02** (P0, Anti-cheat): Location source flags, read but never trusted alone. Check the current official docs before implementing.
- **AC-03** (P0, Anti-cheat): Server-side plausibility: impossible travel speed between events, accuracy values that are too perfect or froz
- **AC-04** (P0, Anti-cheat): Physical-world corroboration, the hardest signals to fake alone:
- **AC-05** (P0, Anti-cheat): Device and app integrity as one weighted signal: App Attest / DeviceCheck on iOS, Play Integrity on Android, j
- **AC-06** (P0, Anti-cheat): Risk score per event: all signals combine into accepted / unverified (needs peer confirmation) / rejected as c
- **AC-07** (P0, Anti-cheat): Drink fraud: bursts that are physiologically implausible against the BAC model, large retroactive batches, dri
- **AC-08** (P0, Anti-cheat): Replay and tampering protection: signed requests, nonces, server timestamps, idempotency keys, rate limits. Th
- **AC-10** (P0, Anti-cheat): Red team: a dedicated subagent attacks our own app and backend (mock location, location simulated from a compu
- **AC-13** (P0, Anti-cheat): Native modules "LocationIntegrity" (isProducedByAccessory, raw source flags) and "ProximityHandshake" (BLE peripheral and GATT), needed whatever the stack. Sour
- **AI-01** (P1, AI features): Free text or voice input structured by AI: "two pints and a jäger shot at Bar Y with Lucas, I'm paying" become
- **AI-02** (P1, AI features): Narrated recap: AI writes the summary of the night from the timeline (N-22) in a chosen tone (plain, epic, roa
- **SLOP-03** (P0, Anti-slop (process)): Pass on every text in every language: a translation that reads machine-made counts as a defect; each language 
- **SLOP-04** (P0, Anti-slop (process)): Automated CI lint on every localisation file: em and en dashes, blacklisted words, "successfully" / "avec succ
- **SLOP-09** (P1, Anti-slop (process)): Deck lint (SLOP.md R-20): opening cap, length spread, near duplicates, moralising cards, expiry of topical cards. Source: voice.md §5.
- **SLOP-12** (P0, Anti-slop (process)): Native anti-slop lint for UI code (gradient text, glow, nested cards, raw hex, emoji icons, pulsing dots without state), because the Impeccable detector reads H
- **SYNC-01** (P0, Sync and feedback): Optimistic updates for every user action (add a drink, check in, react, vote, RSVP, change a setting, add an e
- **SYNC-03** (P0, Sync and feedback): Reconciliation: on success, the optimistic item is replaced by the server's version (server IDs, server-comput
- **SYNC-04** (P0, Sync and feedback): Error types, each with its own behaviour:
- **SYNC-08** (P0, Sync and feedback): Tests for every mutation: success, rejection, timeout, duplicate send, offline then rejected, app killed mid-r
- **SEC-03** (P0, Security and privacy): Encryption in transit: TLS 1.2 minimum, 1.3 preferred, everywhere; certificate pinning for the API (AC-05); HS
- **SEC-04** (P0, Security and privacy): Encryption at rest on the server: storage and database encryption, plus application-level envelope encryption 
- **SEC-05** (P0, Security and privacy): Encryption on the device: tokens and keys in the iOS Keychain / Android Keystore, local database encrypted, se
- **SEC-09** (P0, Security and privacy): Secure development: a threat model (STRIDE) per major feature in `SECURITY.md`, secret scanning, static analys
- **SEC-10** (P0, Security and privacy): Export compliance for encryption: App Store encryption questions, US export rules, and the French ANSSI declar
- **SEC-11** (P0, Security and privacy): BAC computed on the device; drinks, weight and sex stored on the server only when the user shares with their crew, with a "local only" mode. Tension with server
- **SEC-13** (P0, Security and privacy): Export compliance file: classification memo, ANSSI declaration, App Store key, annual review. security.md allows merging it into SEC-10. Source: security.md §2.

## To do

- **HUB-04** (P2, Party hub): Smartwatch: BAC, add drink and water from the wrist.
- **SLOP-06** (P1, Anti-slop (process)): Crew panel: before each release, the friends read the copy and the cards. Anything that "sounds like AI" or "d

## Proposed (not in the brief yet)

- **QOL-26** (P0, Everyday polish): The Live Activity outlives the night: renewed by push-to-start before the 8 h cap, stale state when no update arrives, ended when the party ends; Android equiva
- **QOL-31** (P1, Everyday polish): Night-aware delivery: after midnight, crew members not at the party get non-safety notifications passively, with a morning digest; safety is never muted. Source
- **AC-14** (P1, Anti-cheat): Persistent device-level repeat-offender marker (DeviceCheck bits on iOS, Play deviceRecall beta on Android). Source: anticheat.md §5.
- **SEC-14** (P1, Security and privacy): External audit of the `crew-crypto` integration crate before the public release. Source: security.md §2.1, A-SEC-2, §5.

## Built, by section

- Account, profile, settings: O-02, O-03, O-05, O-06, O-07, O-08, O-10, O-11, O-12, O-13, O-14
- BAC and drink tracking: O-15, O-16, O-17, O-18, O-19, O-20, O-21, O-22, O-23, O-24, O-25, O-26, O-27, O-28, O-29, O-30, O-31, O-32, O-85, O-86, O-87, O-88
- Widgets: O-34
- Parties and trips: O-35, O-36, O-37, O-38, O-39, O-40, O-41
- Friends: O-43
- Games (15): O-44, O-45, O-46, O-47, O-48, O-49, O-50, O-51, O-52, O-53, O-54, O-55, O-56, O-57, O-58, O-59, O-60, O-61, O-62, O-64, O-65, O-89, O-90, O-91
- The Bar (recipes): O-67, O-68, O-69
- Shared expenses: O-70
- Status, monetisation, extras: O-76, O-77, O-78
- Requests from S2M users: O-81, O-82
- Party hub: HUB-01
- Preferences and units: PREF-01, PREF-02, PREF-03, PREF-04, PREF-05, PREF-06
- Radar: who is out, and when: N-01, N-02, N-03, N-04, N-05, N-06, N-07
- Our bars and places: N-08, N-09, N-10, N-11, N-12
- Drinking and going-out habits: N-13, N-14, N-15, N-16, N-17
- Rounds and money: N-19, N-20
- Crew memory: N-22, N-23, N-24, N-37, N-38, N-39, N-40
- Crew safety: N-25, N-26, N-27, N-28, N-29, N-36
- Crew life: N-30, N-31, N-32, N-33, N-34, N-35
- Everyday polish: QOL-02, QOL-07, QOL-08, QOL-10, QOL-11, QOL-12, QOL-13, QOL-16, QOL-18, QOL-19, QOL-20, QOL-21, QOL-23, QOL-27, QOL-28, QOL-30, QOL-32
- Delight: JOY-02, JOY-03, JOY-04, JOY-05, JOY-06, JOY-07, JOY-08, JOY-09, JOY-11, JOY-12
- Adaptive drunk mode: ADP-01, ADP-02, ADP-03, ADP-04, ADP-05, ADP-06, ADP-08, ADP-10
- Motion: MOT-01, MOT-02, MOT-03, MOT-04, MOT-05, MOT-06, MOT-07, MOT-09, MOT-10, MOT-13, MOT-14, MOT-15
- Bar territories: TER-01, TER-02, TER-03, TER-04, TER-05, TER-06, TER-07, TER-08, TER-09, TER-10, TER-11, TER-12
- Leaderboards: RANK-01, RANK-02, RANK-03, RANK-04, RANK-05, RANK-06, RANK-07, RANK-08, RANK-09
- Community: COM-01, COM-02, COM-03, COM-04, COM-05, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11
- Profiles and visibility: PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, PROF-07, PROF-08, PROF-09, PROF-10
- Messaging: MSG-01, MSG-02, MSG-03, MSG-04, MSG-05, MSG-06, MSG-07, MSG-08, MSG-09, MSG-10, MSG-11, MSG-12
- Anti-cheat: AC-01, AC-09, AC-11, AC-12, AC-15
- AI features: AI-03
- Anti-slop (process): SLOP-01, SLOP-02, SLOP-05, SLOP-07, SLOP-08, SLOP-10, SLOP-11
- Sync and feedback: SYNC-02, SYNC-05, SYNC-06, SYNC-07
- Security and privacy: SEC-01, SEC-02, SEC-06, SEC-07, SEC-08, SEC-12
