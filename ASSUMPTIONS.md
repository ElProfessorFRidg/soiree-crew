# ASSUMPTIONS.md

Decisions taken without asking the user, so that work never blocks. Each one says what it rests on and how it gets checked. When an assumption is confirmed or overturned, its status changes here; it is never deleted.

Status values: `open`, `confirmed`, `overturned`.

## Orchestration

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-ORCH-1 | The project lives in `C:\Users\aubin\Documents\soiree-crew`, outside OneDrive, so build folders are not synced. | `LISEZMOI.md` asks for an empty `soiree-crew` folder; OneDrive syncing `node_modules` is slow and error-prone. | User can move it at any time. | open |
| A-ORCH-2 | Recon-Design is split into three subagents (A, B, C) by board, and the four unclear games (O-53, O-54, O-59, O-64) share one recon subagent with four separate sections. | Phase 0 is research, not build; the one-ID-per-brief rule still applies from phase 1 on, including one Spec and one Build agent per game. | Phase 2 game specs each start from a dedicated subagent. | open |
| A-ORCH-3 | Downloaded skills are staged in `research/skill-candidates/` and only moved to `.claude/skills/` after the orchestrator has read them in full. | `<skills>` safety rule; files in `.claude/skills/` load into every session. | `SKILLS.md` lists the review result of each skill. | open |
| A-ORCH-4 | When the drinker has no check-in that night, any member going to the same live party may confirm a drink (AC-07 asks for a check-in at the same venue). | Crews often drink at a flat or before checking in; without this nobody could ever be verified there. | Revisit once BLE cheers and live photos exist. | open |
| A-ORCH-5 | The morning-after screen (QOL-20) stays on the dark theme, toned down, as PROMPT.md says; the prototype shows it light. | PROMPT.md is the master spec; the conflict is listed in FEATURES.md. | One line in the morning screen to flip if the light version is confirmed. | open |
| A-ORCH-6 | The recap is computed on request from what the server keeps, instead of a frozen snapshot at close. | Same figures every time as long as nobody deletes a drink; a deleted drink should leave the recap anyway. | Freeze it at close if crews want an immutable record. | open |
| A-ORCH-7 | Recap reactions are a fixed set of six emojis. | Faster than a keyboard the morning after; keeps the copy reviewable. | Widen if crews ask. | open |

## From recon reports

Merged from `research/*.md` at the end of phase 0.

Every assumption numbered in the 14 reports, with the report's own ID (the reports used three prefixes for Recon-Design: A-DESIGNA, A-DESB, A-DESIGNC; they are kept as written). Wording is condensed; the report section holds the full text. All start `open`.

### Recon-Design A (`research/design-a.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-DESIGNA-1 | The 900 ms timeout stands for "server answer", not for a minimum time to show "Envoi". | `design/prototype/README.md` ("fake server delays"). | Ask the user whether a minimum "Envoi" visibility is wanted. | open |
| A-DESIGNA-2 | The 5 s Undo window starts at the server confirmation. | `Soiree.dc.html` `add()` sets the timer in the 900 ms callback. | MOT-03 / ADP-04 spec review. | open |
| A-DESIGNA-3 | The level thresholds "0,5, 1,0 et 1,5 g/L" are placeholders. | PROMPT `<drunk_mode>`: ADP-01 sets them after research. | Replaced by bac.md §2.5 values once accepted. | open |
| A-DESIGNA-4 | The "Mode soirée" settings screen is meant to be seen sober; during a party it is read-only. | Its closing note. | Confirm with the user. | open |
| A-DESIGNA-5 | Strings on the system board that describe platform behaviour are designer annotations, not UI copy. | Content and placement on OS mock-ups. | Copy writer (VOICE.md). | open |
| A-DESIGNA-6 | Non-friend co-participants may see what a participant shares with "participants d'une soirée", including live BAC. | `Soirees.dc.html` screen 6 copy. | Reconcile with PROF-05 in the profiles spec. | open |
| A-DESIGNA-7 | "Hugo" is the current user across Arrivee, Soirees and Securite. | Demo data. | None needed beyond removing the user from his own invite list. | open |

### Recon-Design B (`research/design-b.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-DESB-1 | "Toi" is Hugo. | Classements data, Bars season row and Recap podium use avatar H a1. | Treat "Toi" as the current user in specs. | open |
| A-DESB-2 | Calendar code `x` (`#2A3431`) means "no status set". | No legend entry, darkest tone. | Designer; give "Chill maison" a value too. | open |
| A-DESB-3 | Recap curve values and "pic moyen 0,74" are g/L of blood. | Legal line at y = 120 maps to about 0.53. | Display unit set per PREF-02 (bac.md §2.4). | open |
| A-DESB-4 | A time reply ("Vers 22 h") to "Je sors, qui vient ?" counts as yes. | `yesCount` counts every tinted reply. | N-03 spec. | open |
| A-DESB-5 | The poll bar denominator of 8 is the demo voter count. | `round(v/8·100)`. | N-04 decides invited people vs voters. | open |
| A-DESB-6 | One check-in worth +3 points is a demo number. | 16 to 19 between venue page and check-in. | TER-02 / AC-01 scoring spec (territories.md rescales to 10). | open |
| A-DESB-7 | The 30-digit safety number is a placeholder; Signal-style numbers have 60 digits. | General knowledge, not repo files. | Recon-Security (security.md §2.2 confirms 60 digits from account keys). | open |
| A-DESB-8 | The 900 ms message send delay mirrors the app-wide fake server delay. | `design/prototype/README.md`. | None. | open |
| A-DESB-9 | "7 jours" for the cheat mark and "J-5" for the season end are product values, not placeholders. | Consistent across screens. | AC-09 and TER-04 specs. | open |

### Recon-Design C (`research/design-c.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-DESIGNC-1 | The 52-card count in Le Grand Paquet is a placeholder. | 6-card deck, counter `52 - drawn`. | O-50 game subagent sets deck size from O-65 content. | open |
| A-DESIGNC-2 | The 20 s Grand Paquet timer is a visual demo of O-47, not the intended duration. | No consequence at 0; setting lives on the Jeux board. | Jeux game sheet spec. | open |
| A-DESIGNC-3 | "Ça grimpe" is the team's interpretation of S2M's "La Courbe". | FEATURES maps O-64 there; S2M rules not public. | O-64 subagent research (games.md §2.4). | open |
| A-DESIGNC-4 | Plural « vous » in pass-the-phone games addresses the group and is intended. | Lines spoken to several players. | VOICE.md rule and SLOP-04 allowlist. | open |
| A-DESIGNC-5 | "Il boit" after a vote is a demo shortcut, not a voice choice. | Also used for Jade. | VOICE.md (gender-neutral phrasing). | open |
| A-DESIGNC-6 | The Argent board lives under the "Moi" tab; the Bar screen shows "Soirée" active by mistake. | Tab bars in the files. | Navigation spec. | open |
| A-DESIGNC-7 | The budget alert at 90 % is a notification; the 80 % and 70 % tiers are on-screen only. | Copy « On te prévient à 90 % ». | N-20 spec. | open |
| A-DESIGNC-8 | Demo audiences on "Mon profil" are Hugo's choices, not new-account defaults. | PROMPT profile defaults. | PROF-02 spec. | open |
| A-DESIGNC-9 | "Position pendant les soirées" on by default is demo state. | N-07: shared only when turned on. | N-07 spec. | open |
| A-DESIGNC-10 | Colours missing from `tokens.json` are intentional tint shades to add as tokens (list in the report). | Repeated use across boards. | DESIGN.md owner. | open |

### Recon-App (`research/app.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-APP-1 | La Courbe was removed from S2M or renamed. | Absent from the current 13-name list; 13 + Gribouille = 14. | Install S2M 2.0.6 and browse the catalogue. | open |
| A-APP-2 | "Qui a ?" is a "who is most likely to" group vote. | S2M's English name "Who's Most Likely". | Play it or watch an S2M video. | open |
| A-APP-3 | La Bombe and Les Mines were added without a release note, between 1.0 and 1.9.3. | Not in the launch 7 or any note; in the current list. | Wayback Machine or the app. | open |
| A-APP-4 | S2M's BAC profile asks for sex. | Not confirmed; norm for Widmark-type models. | The app, or Recon-BAC. | open |
| A-APP-5 | Apple's "environment scanning" data type comes from the camera (QR or selfie). | QR and selfie features; no AR seen. | S2M permission prompts. | open |
| A-APP-6 | The alibi generator (O-76) was not seen in any S2M source. | Sources read. | Ask where O-76 came from; kept regardless. | open |
| A-APP-7 | S2M shows no ads. | No "Contains ads"; no ad network in the policy. | The app. | open |
| A-APP-8 | Free S2M users get a limited number of games. | "Unlimited games" is a premium perk. | Irrelevant to us; for the record. | open |

### Recon-Games (`research/games.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-GAMES-1 | Sip caps, fuse ranges, mine counts, curve speed and deck lengths are starting values, not researched values. | Report judgement. | Crew playtest (SLOP-06) at each level before spec freeze. | open |
| A-GAMES-2 | The UI level that shapes a game screen is the level of that phone's signed-in user; others' levels only change their own penalty. | ADP-01 is per user. | drunk_mode spec owner. | open |
| A-GAMES-3 | The "sip" unit and forfeit sizes (small, medium, large) are a cross-game convention we introduce. | Prototype copy uses « gorgées ». | VOICE.md and O-49 / O-89 spec. | open |
| A-GAMES-4 | S2M's "Qui a ?" is a designation game. | Name, separate confession and two-player games, catalogue line. | S2M 2.0.6 rules cards. | open |
| A-GAMES-5 | S2M's "La Bombe" is a pass-the-phone timer game. | Name, 2.0.6 fix, Tic Tac Boum lineage. | S2M rules cards. | open |
| A-GAMES-6 | A category word takes a tipsy player a few seconds, so fuses under about 10 s end before the second holder. | Piatnik 10 to 60 s range, Categories timing. | Timed playtest. | open |
| A-GAMES-7 | S2M's "Les Mines" is a turn-based mine grid. | Name and casino Mines format. | S2M rules cards. | open |
| A-GAMES-8 | A 5x5 grid fits at UI level 2 on a 390 pt phone with ADP-04 targets. | Layout estimate. | DESIGN.md target tokens and the ADP-09 bench. | open |
| A-GAMES-9 | S2M removed or replaced "La Courbe". | Store descriptions and game count. | S2M 2.0.6 catalogue; archived 1.0 listing. | open |
| A-GAMES-10 | A heavy-tailed crash point (chance to pass x about 1/x) feels fair and tense. | Commercial crash games. | Playtest with round length and penalty logs. | open |
| A-GAMES-11 | Game records stay inside the games and award no leaderboard points. | Design choice. | RANK owner; if records feed leaderboards, add the games to AC-10. | open |
| A-GAMES-12 | Passing a phone between drunk people risks drops; table style reduces it. | Common sense, no source. | Crew playtest. | open |
| A-GAMES-13 | Several-phone players sit together, so latency mostly matters for La Courbe exits. | Product use. | Real-time ADR. | open |

### Recon-BAC (`research/bac.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-BAC-1 | Absorption half-lives of 6 min (fasted or unknown) and 40 min (fed) reproduce Jones & Jönsson 1994. | Own calibration (COMPUTED). | Compare to at least one more published fasted and fed curve in phase 1. | open |
| A-BAC-2 | Vmax = beta is acceptable although it slows elimination by 3 to 14 % in 0.3 to 1.5 g/L. | Model choice, safe direction. | Compare to Jones 2010 data; rescale if too slow. | open |
| A-BAC-3 | Blood water fraction 0.80 in the Watson conversion. | University lab page, not Watson 1981 itself (UNVERIFIED). | Read the paper. | open |
| A-BAC-4 | Per mille is displayed as g/L. | Statute text not read (UNVERIFIED). | German and Swiss statutory definition. | open |
| A-BAC-5 | "Other / prefer not to say" uses the female body model. | Safety product choice. | Product review. | open |
| A-BAC-6 | Input bounds 30 to 250 kg, 120 to 230 cm, 18 to 100 years. | Product choice (prototype: 35 to 250 kg). | O-04 spec. | open |
| A-BAC-7 | Hydration interval 45 min and nudge delay 20 min. | No official interval exists. | Beta feedback. | open |
| A-BAC-8 | Danger cap and level thresholds assume the 21 % CV of Searle 2015; self-reported drinks are probably worse. | Searle 2015. | Revisit with real data. | open |

### Recon-Motion (`research/motion.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-MOTION-1 | Reanimated's `duration` spring mode uses a different perceptual duration than Apple's (actual about 1.5x). | Reanimated 4.x source comments. | Same token in physics and duration modes on device vs SwiftUI. | open |
| A-MOTION-2 | SwiftUI `.smooth` / `.snappy` / `.bouncy` use bounce about 0 / 0.15 / 0.3 at 0.5 s. | Memory of WWDC23. | Read `Spring.snappy.bounce` at runtime. | open |
| A-MOTION-3 | Compose honours Android's animator duration scale through `MotionDurationScale`. | Secondary blogs. | Test app with scale 0 and 10. | open |
| A-MOTION-4 | Flutter's `MediaQuery.disableAnimations` reflects Android "Remove animations" and iOS Reduce Motion. | Docs, unverified mapping. | Device test. | open |
| A-MOTION-5 | iOS suppresses haptics during microphone recording unless explicitly allowed. | Prior knowledge. | Voice input plus H4 on a device (ADP-05). | open |
| A-MOTION-6 | The bubble field costs under 2 % average CPU and no measurable battery over 10 min on a modest Android. | Design budget (40 sprites, 30 Hz, on demand). | Power Profiler, Perfetto, Xcode Energy gauge. | open |
| A-MOTION-7 | The "modest Android phone" is an API 30 to 33 device, 60 or 90 Hz, 4 GB (e.g. Galaxy A). | Report proposal. | User confirms the reference device. | open |
| A-MOTION-8 | Reference-app observations are the author's reading, not documented rationale. | Report §2.3. | None. | open |
| A-MOTION-9 | `EFFECT_HEAVY_CLICK` is available from API 29. | Prior knowledge. | `VibrationEffect` reference. | open |
| A-MOTION-10 | SwiftUI has no first-party multi-pointer API, so Le Doigt on native iOS needs a UIKit wrapper. | Prior knowledge. | iOS 26 SwiftUI gesture docs. | open |

### Recon-Territories (`research/territories.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-TER-1 | A typical crew goes out 1 to 2 nights a week, mostly as a group, at 3 to 15 venues. | PROMPT crew size, prototype numbers. | Season telemetry. | open |
| A-TER-2 | An OS geofence exit event, registered only during a live party and sending only "exited" plus server time, satisfies TER-09; it probably needs iOS "Always" permission. | Platform APIs. | Privacy and location review; fallback to manual re-checks. | open |
| A-TER-3 | Current Swarm mayorship rules (after 2024) are unknown. | No source after 2015. | Swarm help pages if needed; no design impact. | open |
| A-TER-4 | All scoring numbers (10, 18, 12, 5, 20, 15, 20 min, 3 h) are first guesses. | Worked example. | Retune after 2 seasons, at a season boundary. | open |
| A-TER-5 | Each crew has one time zone for nights and seasons; a travelling crew keeps its home zone. | Design choice. | Crew settings spec. | open |
| A-TER-6 | A places provider gives a stable external place ID for venue validation. | Assumed; no maps recon report exists. | Maps and places decision in the stack ADR. | open |
| A-TER-7 | Public scoring (COM-03) is presence-only; crew scoring adds organiser, game and discovery points; both read the same event log. | COM-03 and TER-02. | Scoring spec. | open |
| A-TER-8 | Pokémon GO decay and badge numbers come from community measurements. | GamePress, Bulbapedia. | Only the qualitative lesson is used. | open |

### Recon-AntiCheat (`research/anticheat.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-AC-1 | `@expo/app-integrity` is production-usable at the SDK we pick. | SDK 58 docs; a search summary said "alpha". | Changelog and npm tag at the stack decision. | open |
| A-AC-2 | iOS `sourceInformation` is nil for ordinary fixes. | expo-location source comment. | Device test. | open |
| A-AC-3 | Real fixes rarely repeat accuracy to 0.1 m five times or match a pin to 1e-5°. | General GNSS knowledge, unsourced. | RT-20 field data. | open |
| A-AC-4 | 250 / 130 km/h, 75 m radius and 150 m max accuracy suit European nightlife. | Unsourced. | RT-20 and venue data. | open |
| A-AC-5 | Android cannot discover iOS background-advertised services. | Apple doc wording. | Device test. | open |
| A-AC-6 | iOS gives an app-readable monotonic clock and boot session identifier. | General knowledge. | Apple docs. | open |
| A-AC-7 | App Attest `generateAssertion` works offline. | Inferred from Apple docs. | Device in airplane mode. | open |
| A-AC-8 | Play Integrity Standard token requests need the network. | Documented latency. | Verify; Keystore signing covers offline. | open |
| A-AC-9 | Play internal and closed testing count as "installed from Google Play". | Not verified. | Play Console test setup. | open |
| A-AC-10 | The red team works only on our accounts and devices, including our own rooted device if chosen. | Process assumption. | Confirm with the user before RT-10. | open |
| A-AC-11 | DeviceCheck bits persist across reinstalls. | Commonly stated, not verified. | Apple per-device data doc. | open |
| A-AC-12 | The Niantic three-strike policy cited is from 2018. | 9to5Mac 2018; current page unreachable. | Precedent only. | open |
| A-AC-13 | Keybox-leak and proxying bypass classes come from community and vendor sources. | Indicative sources. | Not relied on. | open |

### Recon-Security (`research/security.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-SEC-1 | OpenMLS 0.9.x builds and runs in production on iOS arm64 and Android arm64 / armv7. | CI targets built but not tested. | Spike: `crew-crypto` + UniFFI + 2 devices + NSE before the ADR is final. | open |
| A-SEC-2 | No public full audit of OpenMLS exists. | Nothing found; only NCC's libxmtp review. | Ask the maintainers; budget an external audit (SEC-14). | open |
| A-SEC-3 | Signing device credentials with an account identity key is a safe standard composition in MLS. | Sesame model, RFC 9750 §3.7. | Security reviewer plus an external cryptographer. | open |
| A-SEC-4 | MLS decryption in the iOS Notification Service Extension is viable with a cross-process lock. | NSE documentation. | Phase 1 spike with memory measurements. | open |
| A-SEC-5 | Google deprioritises high-priority FCM messages that show no notification. | None (page 404). | Firebase docs. | open |
| A-SEC-6 | Crypto-shredding (destroying the per-user DEK) satisfies erasure in backups. | No EDPB or CNIL position found. | CNIL guidance or counsel. | open |
| A-SEC-7 | BAC on the device, stored on the server only when shared, reduces the art. 9 scope. | WP29 domestic exception. | DPIA. | open |
| A-SEC-8 | No annual BIS self-classification report is owed for a mass-market 5D992.c app. | 2021 rule; Apple says "might". | BIS FAQ or counsel, or file defensively. | open |
| A-SEC-9 | The ANSSI declaration is needed before external TestFlight in France. | Apple's wording on documentation before TestFlight review. | App Store Connect setup. | open |
| A-SEC-10 | Integrating a library someone else declared does not exempt us. | Decree applies to each supplier. | controle@ssi.gouv.fr. | open |
| A-SEC-11 | Supabase Auth passkeys are not production-ready in October 2026. | Absent from docs; open bug. | Stack choice. | open |
| A-SEC-12 | op-sqlite supports SQLCipher. | Not re-read. | op-sqlite docs. | open |

### Recon-Community (`research/community.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-COM-1 | We qualify as a micro or small enterprise (Rec. 2003/361) at launch. | Friends' project, no staff. | Each year once a legal entity exists. | open |
| A-COM-2 | Crew-only content is not dissemination to the public because membership is a human decision. | DSA recital 14. | Re-assess if crews become joinable by open link without approval (N-30). | open |
| A-COM-3 | k = 5 with the extra rules of §2.2 is enough; k alone would not be. | PROMPT COM-06, ONS 10-5 rule, Google mobility DP. | Red team differencing and sock-puppet attacks; raise k to 10 if any succeeds. | open |
| A-COM-4 | Visit date as month and year satisfies D111-17. | Decree sets no precision; Tripadvisor practice. | Lawyer or DGCCRF reading; fallback exact date with the 12 h delay. | open |
| A-COM-5 | A 12 h publication delay applied to all reviews is compatible with L111-7-2. | DGCCRF targets delays on negatives only. | Lawyer; disclose on the reviews page. | open |
| A-COM-6 | Reviews stay while the account exists, at most 5 years. | No legal maximum found. | Security retention table. | open |
| A-COM-7 | On account deletion, reviews are deleted, not kept as anonymous. | GDPR erasure is simplest. | Product decision; if kept, truly anonymised. | open |
| A-COM-8 | Mistral moderation is processed in the EU and currently free. | Third-party pricing trackers. | Official Mistral pricing and data-location docs. | open |
| A-COM-9 | Two named team members can moderate at launch with a 24 h SLA. | One-city volume. | Measure the first public month. | open |
| A-COM-10 | LCEN identification-data retention is one year. | Secondary sources. | Read décret 2021-1362. | open |
| A-COM-11 | The app is listed as Social on Play, so Child Safety Standards apply. | Community features. | Category at store setup; build the CSAE page anyway. | open |
| A-COM-12 | Door-policy thresholds (8 reports in 90 days, 80 % "yes") give a useful badge. | Judgement. | Tune on real data. | open |

### Recon-Polish (`research/polish.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-POLISH-1 | The JS runtime is not reliably available when an iOS widget, Control or Siri intent runs. | Apple widget doc, expo-app-intents pending-queue note. | Spike: widget logs a drink with the app killed, server receives it within 5 s. | open |
| A-POLISH-2 | Push-to-start can restart a Live Activity after the 8 h cap without user action. | Apple push-to-start doc. | On-device test at 8 h. | open |
| A-POLISH-3 | Android Live Update eligibility holds for "party in progress" on Pixel and Samsung. | Android doc; OEMs may add criteria. | Pixel (Android 16) and Samsung One UI. | open |
| A-POLISH-4 | Google Assistant App Actions are not reachable through Gemini on phones in late 2026. | 9to5Google 2026-09-28. | Release notes, Pixel test. | open |
| A-POLISH-5 | In-app browsers of Instagram, Snapchat and TikTok do not open Universal Links in our app. | Common reports. | Manual matrix test with our domain. | open |
| A-POLISH-6 | A budget of 3 alerting notifications per hour and 8 per night keeps opt-out low. | Proposal, no source. | Beta disable rate per channel. | open |
| A-POLISH-7 | Re-encoding images drops GPS EXIF. | Library behaviour. | Geotagged HEIC fixture in CI, plus a server strip. | open |
| A-POLISH-8 | Some Android keyboards show "." on the French decimal pad. | Reports. | Gboard and Samsung Keyboard. | open |
| A-POLISH-9 | BLE RSSI plus bump timing is enough for a fun cheers and a weak proximity signal; true proof needs UWB or server co-location. | Design reasoning. | AC-04 owner. | open |
| A-POLISH-10 | Changing the app icon shows a system alert on iOS. | Prior knowledge. | Device test. | open |
| A-POLISH-11 | `https://wa.me/?text=` still works for text sharing. | FAQ page unreadable. | Device test. | open |
| A-POLISH-12 | Notifee (last release 2024-12) is not maintained. | npm registry date. | GitHub repo status. | open |

### Recon-Voice (`research/voice.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-VOICE-1 | Wikipedia's per-era vocabulary lists (including GPT-6 era) are accurate. | Three passes through a summarising fetch tool. | Read the raw wikitext before SLOP-04 freezes its lists. | open |
| A-VOICE-2 | The Graphite multipliers for Opus 5.5 are indicative. | Secondary article citing a marketing company. | Fetch the Graphite study. | open |
| A-VOICE-3 | Deck thresholds (opening cap 5 % or 15 cards, length CV 0.35, Jaccard 0.8, triads 10 %) are good starting values. | Judgement. | Run on the first 500 cards per language. | open |
| A-VOICE-4 | The lint runs on Node 20 or later (for `\p{RGI_Emoji}` with the `v` flag). | Stack not chosen. | Stack ADR; port patterns if needed. | open |
| A-VOICE-5 | Plural « vous » to the whole crew does not break the « tu » voice. | Everyday usage, unsourced. | Crew panel (SLOP-06). | open |
| A-VOICE-6 | Archivo has glyphs for U+202F, U+00A0, « », ’ and “ ”. | Not checked. | Inspect the font's character map; else U+00A0 everywhere. | open |
| A-VOICE-7 | « tu » in legal texts is acceptable for a French under-30 audience. | Unsourced. | Legal review and two comparable French apps' terms. | open |
| A-VOICE-8 | EU AI Act art. 50 transparency duties (from August 2026) may cover AI-written text shown to users. | Memory, not read. | Legal review. | open |
| A-VOICE-9 | Free, Back Market, Deliveroo FR and BlaBlaCar in-app copy would give more French lessons. | No public guides found. | Manual audit if the user wants it. | open |

### Recon-Skills (`research/skills.md` §4)

| ID | Assumption | Based on | Check | Status |
|---|---|---|---|---|
| A-SKILLS-1 | React Native + Expo is the likely stack. | S2M's stack and the RN skill ecosystem. | Architect ADR. | open |
| A-SKILLS-2 | PolyForm Perimeter allows our use of the dpearson iOS skills. | Licence text (no competing product). | Orchestrator or user reading of the licence. | open |
| A-SKILLS-3 | Voltra supports tappable widget actions on iOS and Android. | Not stated in the skill. | use-voltra.dev docs and a spike. | open |
| A-SKILLS-4 | Removing the telemetry and script sections keeps the edited skills working. | Sections are self-contained. | Run each edited skill once. | open |
| A-SKILLS-5 | `runOnJS` is deprecated, not removed, in Reanimated 4. | Two staged files disagree. | Reanimated changelog for the installed version. | open |
