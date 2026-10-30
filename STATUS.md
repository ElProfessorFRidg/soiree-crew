# Status

Generated from FEATURES.md on 2026-10-30 by `pnpm status`. Edit FEATURES.md, not this file.

| Status | Count |
|---|---|
| Built | 142 |
| Partly built | 161 |
| To do | 2 |
| Proposed (not in the brief yet) | 4 |
| Total | 309 |

## Partly built

- **O-01** (P0, Account, profile, settings): Sign up / sign in with email and Google (first name and username kept separate). Add Sign in with Apple (requi
- **O-04** (P0, Account, profile, settings): Profile for the BAC model: weight, sex (check what the model really needs; S2M dropped height because the calc
- **O-07** (P1, Account, profile, settings): In-app account deletion: states exactly what will be erased, confirms when done.
- **O-09** (P0, Account, profile, settings): 7 languages: FR, EN, ES, IT, DE, PT, RU. The whole app, not a few screens. See <localization>.
- **O-11** (P0, Account, profile, settings): Accessibility: large touch targets, respects Reduce Motion, text never truncated, nothing under the notch or c
- **O-13** (P2, Account, profile, settings): Per-account data isolation on the device (several accounts on one phone without leaks).
- **O-19** (P0, BAC and drink tracking): Permanent notice next to the BAC: indicative estimate, not a certified breathalyser, never drive based on it a
- **O-21** (P0, BAC and drink tracking): Custom drinks: create, long-press to edit / move / remove, custom order, synced across devices, personal presets.
- **O-22** (P0, BAC and drink tracking): Drink time adjustable to the minute (forgotten drink); a drink "in the future" never counts in the calculation.
- **O-23** (P0, BAC and drink tracking): Grouped history (e.g. 5x Beer 50 cl) that expands to each drink's exact time, delete one at a time, edit with 
- **O-24** (P0, BAC and drink tracking): BAC curve: Day / Week / Month / Total / Average (7-day moving average), zoom, pan, a trace that truly follows 
- **O-85** (P1, BAC and drink tracking): Food input for the BAC model ("ate / light meal / empty stomach", per evening or per drink, changeable mid-party) feeding absorption and elimination within Reco
- **O-88** (P0, BAC and drink tracking): Alcohol-poisoning signs card above 2.0 g/L estimated, with the local emergency number, aimed at the person and the crew, linked to SOS. Renumbered from BAC-DANG
- **O-33** (P0, Widgets): iOS and Android home-screen widget in 3 sizes: live curve that falls on its own, back-to-zero, interactive but
- **O-35** (P0, Parties and trips): Create a party: mood (about ten icons: party, birthday, champagne, sunset, costume, wine, fire, night, home, t
- **O-36** (P0, Parties and trips): Invite the crew: invitations as cards, reply straight from the list, tab badge with the real number of invitat
- **O-37** (P0, Parties and trips): Live dashboard: everyone's BAC in real time, who is speeding up, who is slowing down, who has gone missing for
- **O-38** (P0, Parties and trips): Live crew notifications at a controlled volume (S2M had to cut a third of theirs): whatever remains must be us
- **O-41** (P0, Parties and trips): Recap: saved and kept, notification as soon as it is ready, only people actually present (including non-friend
- **O-42** (P0, Parties and trips): Squad mode: curves shared continuously between members.
- **O-43** (P1, Friends): Reliable search, friend requests without duplicates (a request already received is accepted instead of duplica
- **O-47** (P0, Games (15)): Round timers, shareable result cards, multiplayer robustness (someone leaves, the game goes on).
- **O-48** (P1, Games (15)): Conditional unlocks (e.g. Double Agent unlocks at 4 friends).
- **O-63** (P0, Games (15)): "Gribouille": one player draws, the others guess, 3 to 8 players online (real-time, multi-phone).
- **O-65** (P0, Games (15)): More than 500 cards / questions / dares per language for FR and EN, all written by us (see <localization> and 
- **O-66** (P1, The Bar (recipes)): 470+ recipes with photo and preparation: Classics, Shots, Party, Alcohol-free, Beers, Desserts, + signature co
- **O-68** (P1, The Bar (recipes)): Search + category filters, fast loading.
- **O-70** (P1, Shared expenses): Create a pool, add friends and expenses, compute who owes whom with the minimum number of transfers, record re
- **O-76** (P1, Status, monetisation, extras): Next-morning alibi generator.
- **O-77** (P1, Status, monetisation, extras): Report content (user-generated content).
- **O-83** (P1, Requests from S2M users): Photo when logging a drink.
- **O-84** (P1, Requests from S2M users): Photos and videos shared that stay inside the group.
- **HUB-01** (P0, Party hub): Party screen, opened automatically during a party. Shows, without pointless scrolling: my BAC and trend, add a
- **HUB-02** (P0, Party hub): iOS Live Activity / Dynamic Island and a persistent Android notification during the party: BAC, back-to-zero, 
- **HUB-03** (P0, Party hub): Lock-screen widgets (BAC, next water, who is out tonight).
- **PREF-02** (P0, Preferences and units): Smart defaults on first launch, from the device language and region (no location permission needed for this): 
- **PREF-05** (P1, Preferences and units): Travel: when the phone's region or time zone changes (a trip abroad), the app suggests switching the legal-lim
- **N-01** (P0, Radar: who is out, and when): Evening status in one gesture: Going out / Down if something happens / Chilling at home / Not available, with 
- **N-02** (P0, Radar: who is out, and when): Crew board: who is out tonight, this weekend, this week, as a list and as a calendar.
- **N-03** (P0, Radar: who is out, and when): "I'm going out, who's in?": broadcast to the crew with quick replies, turns into a party (O-35) in one tap.
- **N-06** (P1, Radar: who is out, and when): Sync with the phone calendar (add event / ICS subscription) + reminders.
- **N-08** (P0, Our bars and places): Crew venue directory: bars, clubs, flats, spots, with address, opening hours, happy hours, vibe, crew ratings,
- **N-09** (P1, Our bars and places): Drink prices logged by the crew per venue (pint, half, shot, cocktail, soft drink), price history, flag when a
- **N-11** (P0, Our bars and places): "Where to?": suggestion, vote or roulette between venues by availability, budget, distance, current happy hours.
- **N-12** (P1, Our bars and places): Venue stats: visits, average spend, average drinks, best nights there.
- **N-13** (P1, Drinking and going-out habits): Each member's drinking profile: favourite drinks, usual pace, time of first drink, usual leaving time.
- **N-14** (P1, Drinking and going-out habits): Crew habits: nights and hours out, frequency, venues, seasonality, calendar heatmap.
- **N-16** (P1, Drinking and going-out habits): Detailed charts (O-81) filterable by period, venue, drink type, person.
- **N-17** (P2, Drinking and going-out habits): Personal data export (CSV / JSON) and selective deletion.
- **N-18** (P0, Rounds and money): Rounds: who pays next (fair rotation computed); logging a round adds the drinks to each person AND the expense
- **N-19** (P1, Rounds and money): Better pools: unequal splits (shares, amounts, percentages), expenses tied to a venue, a party or a trip, rece
- **N-20** (P1, Rounds and money): Personal party budget with alert.
- **N-21** (P1, Crew memory): Shared album per party (photos and videos private to the group, O-84) + optional photo when logging a drink (O
- **N-22** (P0, Crew memory): Party timeline: arrivals, check-ins, venue takeovers, games played, photos, highlights, built into the recap.
- **N-24** (P1, Crew memory): Hall of fame for games and game records.
- **N-25** (P0, Crew safety): "Home safe": status (O-82) + end-of-night check-in; the crew sees who has not confirmed yet.
- **N-26** (P0, Crew safety): Designated driver per party: visible badge, reminder if they log a drink.
- **N-28** (P0, Crew safety): Discreet SOS button: alert to the crew with location (if allowed), shortcuts to 112 and local emergency number
- **N-29** (P0, Crew safety): Gentle alert when a member has given no sign of life for X minutes during a party (extension of O-37).
- **N-36** (P0, Crew safety): "Not feeling well" status, private to the crew in the party: the crew is told quietly, nearest members first, one tap to SOS (N-28); clears when the user says t
- **N-31** (P1, Crew life): Crew feed: activity, reactions, mentions, with grouped digests instead of spam.
- **N-34** (P1, Crew life): Crew titles and seniority; badges that also reward organising, hydration, designated driving, getting home saf
- **N-35** (P1, Crew life): Notification centre with fine per-type settings and quiet hours.
- **QOL-01** (P0, Everyday polish): "Same again": one tap re-logs the last drink (same size, same price, same venue), also from the widget, the no
- **QOL-02** (P0, Everyday polish): A night belongs to the evening it started: a configurable day boundary (default 6 am) for stats, recaps, "toni
- **QOL-03** (P0, Everyday polish): Actionable notifications: answer "On my way" / "Not tonight" to "who's in?", add a drink, confirm a round or a
- **QOL-04** (P0, Everyday polish): System shortcuts for a drunk thumb: Siri / App Intents and Android App Actions ("Hey Siri, add a beer"), iPhon
- **QOL-05** (P0, Everyday polish): Deep links and universal links for every party, venue, profile, crew invite, recap and game card. Links pasted
- **QOL-06** (P0, Everyday polish): Native sharing: recap and story cards go straight to Instagram Stories, Snapchat (Creative Kit), TikTok and Wh
- **QOL-07** (P0, Everyday polish): Typed content is never lost: drafts (party name, review, expense, card) survive the app being killed, errors a
- **QOL-09** (P0, Everyday polish): Photos: compressed before upload, background upload with progress and retry, HEIC accepted, location metadata 
- **QOL-10** (P0, Everyday polish): Dying battery: when a member's battery drops under 10% during a party, the crew sees "low battery" next to the
- **QOL-11** (P0, Everyday polish): Names that work: long names, emojis in names, two "Lucas" in one crew disambiguated automatically, initials av
- **QOL-12** (P0, Everyday polish): Correct plurals and formats everywhere ("1 verre", "2 verres", decimal comma in French), relative times ("5 mi
- **QOL-14** (P0, Everyday polish): Navigation without traps: Android back and iOS swipe-back work everywhere, sheets close with a swipe, the app 
- **QOL-15** (P1, Everyday polish): Try before signing up: games and the Bar work without an account; sign-up is asked only when the user needs a 
- **QOL-16** (P1, Everyday polish): Defaults learned from habits: usual party end time, usual venue, usual drinks first in quick add, the friends 
- **QOL-17** (P1, Everyday polish): Suggestions that save taps: when 3+ crew members check in at the same venue, offer to start a party; when the 
- **QOL-18** (P1, Everyday polish): The user's own apps: directions in Apple Maps, Google Maps or Waze, rides in Uber, Bolt or local taxi apps, ch
- **QOL-19** (P1, Everyday polish): Long-press copies what people copy (IBAN, codes, addresses), with a haptic and a short inline "Copied".
- **QOL-20** (P1, Everyday polish): Next-morning mode: the morning after, the app opens on a calm, dark, low-contrast screen with the recap, who o
- **QOL-21** (P1, Everyday polish): Calendar and birthdays: parties added to the phone calendar in one tap; a crew member's birthday reminds the o
- **QOL-22** (P2, Everyday polish): Last ride home: after midnight, the last night bus / metro departures near the venue on the Party screen, when
- **QOL-24** (P1, Everyday polish): Respect the phone: Low Power Mode lowers refresh rates and effects, a data-saver option for photos, light and 
- **QOL-25** (P0, Everyday polish): Native fast path: every out-of-app action (widget, Live Activity / Live Update, notification action, Siri / Shortcut, Control, Quick Settings tile, launcher sho
- **QOL-27** (P0, Everyday polish): Discreet lock screen: by default lock screen, Live Activity, widget and notifications show no BAC figure or drink count (level icon and time to zero only); numb
- **QOL-29** (P0, Everyday polish): Invite survives the install: a friend who installs from an invite link lands in the right crew or party (Play Install Referrer; invite code plus system Paste bu
- **QOL-30** (P0, Everyday polish): Notification taxonomy and per-party mute: fixed channel list designed before v1 (six at most), one thread per party, at most 3 actions, "Mute this party until m
- **JOY-01** (P1, Delight): Cheers: bring two phones together (Bluetooth LE / NFC) and both screens play a clink with sound and haptic. It
- **JOY-02** (P1, Delight): Lines that know the time: the Party screen header changes with the hour and the situation ("Still standing?" a
- **JOY-03** (P1, Delight): Alternate app icons unlocked through crew titles (N-34) and seasons.
- **JOY-04** (P1, Delight): Mood themes: the mood picked for a party (O-35) tints the Party screen, the widget and the recap.
- **JOY-06** (P1, Delight): Crew streak: consecutive weeks where the crew went out together (any night out counts, drinking or not), with 
- **JOY-08** (P1, Delight): Milestones: 10th, 50th, 100th night out together, crew anniversary, first venue conquered. Milestones count ni
- **JOY-09** (P1, Delight): Photo booth: at the end of a party, an automatic photo strip from the shared album, ready for stories.
- **JOY-10** (P2, Delight): Sticker packs (iMessage / WhatsApp) made from crew avatars and moments.
- **JOY-11** (P1, Delight): Member card: a shareable profile card with titles, venues ruled, favourite drink, nights out.
- **JOY-12** (P1, Delight): Dare of the night on the Party screen, different every night, taken from the crew's own cards when they exist 
- **ADP-01** (P0, Adaptive drunk mode): Level engine: computed from the estimated BAC (O-15), with hysteresis so it never flickers between two levels,
- **ADP-06** (P0, Adaptive drunk mode): "Next-morning vault": above a threshold, sensitive actions are locked or queued for confirmation the next day 
- **ADP-07** (P0, Adaptive drunk mode): Legibility: text size, maximum contrast, readable under strobe or very low light, no disorienting motion (effe
- **ADP-09** (P0, Adaptive drunk mode): Drunk-mode test bench: a tester subagent runs EVERY P0 screen under simulated constraints (one hand, thumb onl
- **MOT-01** (P0, Motion): Motion system in `MOTION.md`, written before any screen: duration tokens, springs and curves, choreography rul
- **MOT-04** (P0, Motion): Curve: the trace draws itself, smooth colour change when crossing a threshold, clearly marked peak point (no d
- **MOT-06** (P0, Motion): Card games: dealing, 3D flip, swipe, drawing, a card that trembles before a penalty.
- **MOT-08** (P0, Motion): Cinematic recap: story format, counters rolling, podium rising, curves drawing, badges dropping with confetti,
- **MOT-09** (P0, Motion): Venue map: takeover (crown dropping, the new boss's colour washing over the venue); venues where the crew is r
- **MOT-10** (P0, Motion): Micro-interactions: buttons, toggles, custom pull-to-refresh, skeletons, illustrated and animated empty states
- **MOT-11** (P1, Motion): Animated widgets and Live Activity, within each OS's limits.
- **MOT-12** (P0, Motion): Performance and motion accessibility: 60 / 120 fps without jank, tested on a modest phone, battery budget resp
- **MOT-13** (P0, Motion): Leaderboards: animated overtakes, podium, a dedicated effect when the leader changes.
- **MOT-14** (P0, Motion): Global motion time scale (0.1x to 10x) and deterministic animation clock hooks in the motion module, exposed in a dev menu and to the test harness, so the frame
- **TER-01** (P0, Bar territories): Venue map: all crew venues (N-08), each in the colour and avatar of its current boss, crown, area of influence
- **TER-02** (P0, Bar territories): Rule points: a member earns points at a venue through presence (verified check-ins, time spent there), parties
- **TER-04** (P0, Bar territories): Seasons and takeovers: monthly seasons with a reset, "X just took Bar Y from you" notification, history of rei
- **TER-05** (P0, Bar territories): Venue page: current boss, season top 5, past bosses, drink prices (N-09), happy hours, the crew's latest night
- **TER-08** (P1, Bar territories): Fog of war: never-visited venues are "to conquer", conquest suggestions for the next night out (linked to N-11).
- **TER-11** (P0, Bar territories): Workplace exclusion ("I work here", admin-approved; 0 territory points there) and validation of new venues (external place ID or corroborated check-ins by 2 mem
- **RANK-02** (P0, Leaderboards): Live leaderboard on the Party screen (HUB-01): live positions, "X just overtook you" notification, animated ov
- **RANK-04** (P1, Leaderboards): History and titles: champion of each week, month and season, winning streaks, titles tied to N-34.
- **RANK-05** (P1, Leaderboards): Secondary leaderboards: most nights out, earliest first drink, last one home, most venues ruled (<bar_territor
- **COM-01** (P1, Community): Public venue page, extending TER-05 to all app users: opening hours, crowd-sourced prices (N-09), happy hours,
- **COM-02** (P1, Community): Reviews: only from users with a verified check-in at that venue (<anti_cheat>), structured ratings (prices, vi
- **COM-05** (P1, Community): Meeting people: an "open to meeting people" switch. From a venue page or a regular's profile, send a friend re
- **COM-07** (P1, Community): Age-policy filter: crowd-sourced door policy per venue, meaning ID checks at the door (always / sometimes / ne
- **COM-08** (P0, Community): Safety and moderation: report any review, photo, profile or party; block and mute; automatic filters for insul
- **COM-10** (P1, Community): Discovery: venues nearby ranked by reviews and check-ins, filters (open now, pint under a set price, strict 18
- **PROF-02** (P0, Profiles and visibility): Profile sections, each with its own audience: identity (pseudonym, photo, bio, country), crews, titles and bad
- **PROF-03** (P0, Profiles and visibility): Per-item overrides: hide one venue, one review or one stat without touching the rest.
- **PROF-04** (P1, Profiles and visibility): Reviews: each review is posted as Public with name, Public anonymous ("a regular", still counted in the venue 
- **PROF-09** (P1, Profiles and visibility): Findability: strangers can find you by search, by exact username only, or not at all. You appear among a venue
- **MSG-04** (P1, Messaging): Push notifications never carry readable content: the payload is encrypted and decrypted on the device (iOS Not
- **MSG-12** (P1, Messaging): Group conversation info: members, roles, leave, mute, group key state. Renumbered from design-b MSG-11. Source: design-b.md §2.7 G-12, §5.
- **AC-02** (P0, Anti-cheat): Location source flags, read but never trusted alone. Check the current official docs before implementing.
- **AC-03** (P0, Anti-cheat): Server-side plausibility: impossible travel speed between events, accuracy values that are too perfect or froz
- **AC-04** (P0, Anti-cheat): Physical-world corroboration, the hardest signals to fake alone:
- **AC-05** (P0, Anti-cheat): Device and app integrity as one weighted signal: App Attest / DeviceCheck on iOS, Play Integrity on Android, j
- **AC-06** (P0, Anti-cheat): Risk score per event: all signals combine into accepted / unverified (needs peer confirmation) / rejected as c
- **AC-07** (P0, Anti-cheat): Drink fraud: bursts that are physiologically implausible against the BAC model, large retroactive batches, dri
- **AC-08** (P0, Anti-cheat): Replay and tampering protection: signed requests, nonces, server timestamps, idempotency keys, rate limits. Th
- **AC-09** (P0, Anti-cheat): Consequences: a rejected event earns nothing and is recorded as a "cheat attempt", visible to the crew (notifi
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
- **SEC-07** (P0, Security and privacy): Accounts: passkeys first; passwords, if any, hashed with Argon2id; list of active sessions with remote sign-ou
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

- Account, profile, settings: O-02, O-03, O-05, O-06, O-08, O-10, O-12, O-14
- BAC and drink tracking: O-15, O-16, O-17, O-18, O-20, O-25, O-26, O-27, O-28, O-29, O-30, O-31, O-32, O-86, O-87
- Widgets: O-34
- Parties and trips: O-39, O-40
- Games (15): O-44, O-45, O-46, O-49, O-50, O-51, O-52, O-53, O-54, O-55, O-56, O-57, O-58, O-59, O-60, O-61, O-62, O-64, O-89, O-90, O-91
- The Bar (recipes): O-67, O-69
- Status, monetisation, extras: O-78
- Requests from S2M users: O-81, O-82
- Preferences and units: PREF-01, PREF-03, PREF-04, PREF-06
- Radar: who is out, and when: N-04, N-05, N-07
- Our bars and places: N-10
- Drinking and going-out habits: N-15
- Crew memory: N-23, N-37, N-38, N-39, N-40
- Crew safety: N-27
- Crew life: N-30, N-32, N-33
- Everyday polish: QOL-08, QOL-13, QOL-23, QOL-28, QOL-32
- Delight: JOY-05, JOY-07
- Adaptive drunk mode: ADP-02, ADP-03, ADP-04, ADP-05, ADP-08, ADP-10
- Motion: MOT-02, MOT-03, MOT-05, MOT-07, MOT-15
- Bar territories: TER-03, TER-06, TER-07, TER-09, TER-10, TER-12
- Leaderboards: RANK-01, RANK-03, RANK-06, RANK-07, RANK-08, RANK-09
- Community: COM-03, COM-04, COM-06, COM-09, COM-11
- Profiles and visibility: PROF-01, PROF-05, PROF-06, PROF-07, PROF-08, PROF-10
- Messaging: MSG-01, MSG-02, MSG-03, MSG-05, MSG-06, MSG-07, MSG-08, MSG-09, MSG-10, MSG-11
- Anti-cheat: AC-01, AC-11, AC-12, AC-15
- AI features: AI-03
- Anti-slop (process): SLOP-01, SLOP-02, SLOP-05, SLOP-07, SLOP-08, SLOP-10, SLOP-11
- Sync and feedback: SYNC-02, SYNC-05, SYNC-06, SYNC-07
- Security and privacy: SEC-01, SEC-02, SEC-06, SEC-08, SEC-12
