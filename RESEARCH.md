# RESEARCH.md

Phase 0 recon, merged on 2026-10-26 from the 14 reports in `research/`. One section per report: what changes what we build, the key numbers, and a link. Then the themes several reports raise.

Companion outputs: proposed IDs, changes and design gaps in `FEATURES.md`; every numbered assumption in `ASSUMPTIONS.md`; glossary additions and conflicts in `GLOSSARY.md`; user decisions and blockers in `research/open-decisions.md`; inputs for the stack ADR in `research/stack-inputs.md`. Catalogue of AI tells: `SLOP.md`. Skills: `SKILLS.md`.

## Recon-Design A: Arrivee, Soiree, ModeBourre, Systeme, Soirees, Securite

Report: [research/design-a.md](research/design-a.md). 81 IDs, all accounted for.
- The add-drink sequence (MOT-03) is fully timed: fill 700 ms, server stand-in 900 ms, digit roll 14 steps of 45 ms, Undo 5 s from the server answer, double-tap guard. The bubbles MOT-03 requires are not drawn.
- SOS needs a 2 s press-and-hold, but ADP-04 forbids essential long-presses at levels 2 and 3, where SOS lives (open-decisions D-07).
- The BAC notice (O-19) is missing on levels 1 to 3 and on every lock-screen, widget, watch and share surface.
- Only the add-pint flow has a pending state; notification actions, add friend, home safe, SOS "Alerte envoyée", cheers proof and widget counters complete instantly (SYNC-02).
- Curve limit lines sit at fixed pixels (0.39 and 0.56 g/L on the chart scale) instead of 0.5 g/L and the user's limit; threshold colours are relative to each curve.
- The level thresholds "0,5, 1,0 et 1,5 g/L" are placeholders; quiet hours default to 2 h to 11 h, which would mute the second half of a night.
- Other conflicts: health consent asked after weight and sex; a non-friend's live BAC and an "Écrire" button on the participant profile (PROF-05, COM-05); a 40 px "add anyway" button at level 3 against the 88 px rule.
- 8 prototype bugs listed so specs do not copy them (e.g. `dur()` can print "1 h 60").
- 7 assumptions, 4 clarifications (N-28 cancel, O-40 closing rule, ADP-06 interstitial, quiet hours), 12 glossary terms, no blocker.

## Recon-Design B: Recap, Radar, Messages, Bars, Classements, Jeux

Report: [research/design-b.md](research/design-b.md). 76 IDs; about a third of their sub-requirements have no screen.
- QOL-20 conflict: PROMPT asks for a dark next-morning screen; the prototype and DESIGN.md use the light theme (open-decisions D-01).
- The check-in screen shows each anti-cheat signal and its verdict, which teaches cheaters what caught them, and skips the "unverified" outcome of AC-06.
- Privacy leaks: review audience defaults to Public; a named review shows "Visite du 7 juin" to strangers; the public map scope shows crew bosses; recap story and photo booth export group-private material without consent (proposed N-37).
- Leaderboard overtakes and venue takeovers play on the tap or a client timer, not on the server answer.
- Demo numbers are not computed (41 drinks shown vs 26 in the rows); every game card shows a duration range ("10 à 20 min"); the danger cap is hard-coded at 2 g/L.
- Demo-only controls drawn as product UI: "Vrai check-in / Faux GPS", "Simuler : Malik prend une pinte vérifiée".
- The "On va où ?" wheel names the mirrored segment and shows the result 3.2 s early.
- Glossary collisions: « fil » for two concepts, « tentative de triche » vs « Tricheur du week-end », « Public » vs « Tous », door policy wording.
- None of the six boards shows a level 1 to 3 variant.
- 9 assumptions, 2 proposed IDs (N-37, MSG-12 after renumbering), 4 changes, 28 glossary terms, no blocker beyond D-01.

## Recon-Design C: JeuxCartes, JeuxAction, Bar, Argent, Profil, Reglages, Etats

Report: [research/design-c.md](research/design-c.md). 82 IDs.
- The in-game add-drink button (O-32) is on 3 of 14 games; the "?" rules button (O-46) is on none of the 7 action games.
- Three level naming sets exist across games (Normal / Difficile / Extrême, Gentil / Piquant / Sans filtre, Gentil / Piquant / Extrême) against O-45.
- Game demo bugs: Roulette result at the tap, Autoroute shows the same card twice, duplicate mines, Le Doigt names players by finger order, the Agent double card colour reveals the role. Player counts in the games (6 fingers, 4-name rotations) do not match the catalogue (2 to 8, 3 to 12).
- "Ça grimpe" (O-64) promises a reward no rule computes.
- Profile audiences are a nested scale (Moi < Crews < Amis < Tous); only 6 of the 10 PROF-02 sections exist; no way to hide one item; strangers always see first name and photo (open-decisions D-11).
- Error toasts close with "OK"; no "Retry" anywhere; Argent, Profil and Réglages change state instantly.
- Amber overuse on many screens; touch targets below 44 px (steppers 34, chips 32, the `segmentedItem` token 38).
- 53 icons inventoried; missing ones listed (help, minus, copy, device, game identities).
- 10 assumptions, 10 decisions (FAB and "?" on all games, one level set, gender-neutral copy), 2 optional IDs folded into O-32 and O-46, about 40 glossary terms, no blocker.

## Recon-App: Soirée2Malade

Report: [research/app.md](research/app.md).
- 21 releases from 1.0 (2026-04-24) to 2.0.6 (2026-10-21), condensed; almost every O-xx traces to one. S2M's bug fixes become our acceptance tests: widget double count, freeze after adding a drink, offline drinks lost, trip group BAC at zero, party open for days, duplicated friend request, invite shown as sent when it failed.
- La Courbe (O-64) has left S2M's catalogue; the current 14 games are 13 named plus Gribouille. No public rules for La Courbe, Qui a ?, La Bombe or Les Mines.
- The English landing page says 21+, French pages and stores 18+: O-02 should follow the country (open-decisions D-04).
- Top complaints: BAC under-estimation (about twice the drinks before 0.5 g/L), forgetting to log once drunk, slowness on modest Android, GDPR and deletion, "made by AI". S2M refused BAC rankings and record glorification, which supports RANK-07 and PROF-06.
- Ratings: App Store FR 4.9 (136), Play 4.7 (34). S2M dropped height in 2.0.1, location in 1.8, and cut notifications by a third in 2.0.0.
- Proposed O-85 (food input), O-86 (how BAC is estimated), N-36 (not feeling well), and a logging nudge renumbered QOL-32; changes to O-02, O-38, O-64.
- 8 assumptions, 6 glossary terms, no blocker. The web search budget ran out before classic game rules were researched.

## Recon-Games: O-53, O-54, O-59, O-64

Report: [research/games.md](research/games.md).
- "Qui a ?" becomes a designation game (everyone points on zero, penalty per finger), not a second confession game; optional secret vote on several phones.
- La Bombe: the prototype leaks the fuse through its 33 % / 66 % colour steps; escalation must follow elapsed time over the longest possible fuse. Fuses 15 to 40 s (Normal) down to 6 to 25 s (Extreme), app is the referee, table style at levels 2 and 3.
- Les Mines: distinct mines, push-your-luck turn (stop or one more, extra safe tiles give sips), numbers at Normal only; 4 / 6 / 7 mines by level.
- La Courbe: crash game with a heavy-tailed crash point (chance to pass x about 1/x), integer stake in sips instead of a casino multiplier, "first out takes 1"; server-drawn crash point in several-phones mode. A game on real BAC curves is rejected (rewards drinking faster).
- Shared penalty model: sips or a forfeit, per-player "no alcohol", water-or-forfeit at UI level 3, penalties never log a drink (proposed O-89, O-90, O-91).
- No casino codes anywhere (no bet, coins, cash out).
- 13 assumptions (all game numbers are playtest starting values), 11 glossary terms, no blocker; optional user check of S2M's rules cards.

## Recon-BAC

Report: [research/bac.md](research/bac.md).
- Model: one compartment, first-order absorption per drink, Michaelis-Menten elimination (Km 0.05 g/L), RK4 from the full drink list, so late, edited or deleted drinks never cause jumps. r 0.70 / 0.60 L/kg, beta 0.15 g/L/h, absorption half-life 6 min fasted or unknown and 40 min fed (computed).
- Height matters: with weight and sex only, a BMI 35 man is under-estimated by about 18 % at peak and told he is under 0.5 g/L about 1 h too early. Ask height (optional) and use Watson or Forrest (open-decisions D-06).
- The driving timer uses 0.10 g/L/h, never shows "under the limit" while BAC is rising, and says "too close to call" near the limit (proposed O-87).
- Storage in g/L of blood; breath derived with each country's legal ratio (2000:1 FR and most of the EU, 2100:1 US, about 2286:1 UK).
- 34 legal-limit rows (25 countries plus regions); Russia, Morocco and Tunisia UNVERIFIED (ship as zero tolerance until verified); corrections to the brief (Victoria professionals 0.00, Japan's new 2026 tier, Morocco 150 / 190 / 177, Norway 112 = police).
- Thresholds: levels at 0.50 / 0.80 / 1.20 g/L with 0.10 g/L hysteresis and 10 min dwell; vault from 0.80 g/L including the projected peak, unlocked at back to zero; danger cap 1.20 g/L; poisoning signs card from 2.0 g/L (proposed O-88).
- 14 engine test cases (T1 to T14), notice wording FR and EN, legal risk notes (Loi Evin, product liability directive, MDR) all UNVERIFIED.
- 8 assumptions, 15 glossary terms, no blocker; legal review before a public release.

## Recon-Motion

Report: [research/motion.md](research/motion.md).
- Springs for space and gestures, timing curves for durations that mean something (SOS hold, toast stay, fuse, digit roll, loops). One exact conversion drives every stack.
- Five spring tokens (`snap` 0.20 s, `standard` 0.35 s, `move` 0.45 s, `gesture` 0.35 s / bounce 0.15, `signature` 0.45 s / bounce 0.30 for the few overshoot moments) plus effects springs. Our bezier tokens are very front-loaded (easeOut is 50 % done at 13 % of its time).
- Material 3 Expressive bounces by default: Android needs a custom MotionScheme.
- All 27 DESIGN.md motion rows are feasible in native, React Native and Flutter; RN is weaker on shared elements, SwiftUI on multi-touch. Motion favours native; RN is the stronger cross-platform choice for a first-party iOS feel.
- Living background: an event-driven bubble field (crew drinks release bubbles, mood sets speed, time of night shifts lightness by 2 % at most), on demand at 30 Hz or less, off in eco mode, Reduce Motion and levels 2 and 3.
- Haptic vocabulary of 12 meanings mapped to iOS and Android with API fallbacks; per-level motion rules (level 2: no overshoot, 400 ms max; level 3: fades, 250 ms max).
- Proposed MOT-14 (global motion time scale) and MOT-15 (haptic capability matrix); 10 assumptions; blocker: physical test devices.

## Recon-Territories

Report: [research/territories.md](research/territories.md).
- Presence games that last count nights, not taps: one counted check-in per venue per night (06:00 to 06:00), whatever the number of parties.
- Holding a venue earns no points (Turf, Ingress and Pokémon GO all needed decay or retirement); the monthly reset does the decay's job.
- Formula per member, venue and night: check-in 10 (vests after 15 min), time at venue 0 to 18 (concave, capped at 3 h, 60 min for solo), organiser 12, game wins 5 each (capped), first discovery 20 once. Boss needs at least 15 points; ties keep the incumbent.
- Time at venue without continuous tracking: from check-in to the earliest discrete end event, credited only up to the last proof of presence plus 20 min; drink logs are never proofs, and the scoring engine never receives drinks, BAC or spending.
- Seasons: ghost crown at reset, 12 h closing window, 7-day admin correction with deterministic replay, takeover notifications delayed 30 min.
- Titles separated: boss (live) and Mayor (season close); Conqueror, Explorer, Nomad, Regular tiers, Legend (public, presence-only).
- Eleven abuse cases with counters; new TER-10 (loyalty tiers), TER-11 (workplace exclusion and venue validation), TER-12 (season variants).
- 8 assumptions, 25 glossary terms, no blocker; the places provider is left to a maps recon that does not exist.

## Recon-AntiCheat

Report: [research/anticheat.md](research/anticheat.md).
- iOS `isSimulatedBySoftware` only catches Xcode's own simulation (Apple DTS, October 2025); Android `isMock()` helps but hides on rooted phones. Attestation (App Attest, Play Integrity) raises the cost, never decides alone.
- `expo-location` exposes `mocked`; `@expo/app-integrity` wraps App Attest and Play Integrity; `isProducedByAccessory` and phone-to-phone BLE need native modules (proposed AC-13).
- Play Integrity stricter since May 2025 (STRONG lost about 14.5 % of verdicts); 10,000 requests a day by default, so calls are rationed. IP geolocation: country level only (France 51 % within 50 km).
- Risk score in four categories (flags, integrity, plausibility, behaviour) minus corroboration credits; "rejected" needs 70 points from 2 or more categories and no credit; everything ambiguous becomes "unverified, ask a friend" (proposed AC-11, AC-15).
- Foreground BLE handshake with rotating 60 s tokens, rotating QR for house parties, camera-only live photo, drink-burst rules (40 g in 30 min, 60 g in 60 min).
- Offline-compatible replay protection with monotonic time, nonce book and hash chain (proposed AC-12); 20 red-team scenarios including an honest-night field test with zero honest rejections.
- 13 assumptions; blockers: Apple and Google developer accounts, quota, GeoLite2 account, freeRASP decision, test devices.

## Recon-Security

Report: [research/security.md](research/security.md).
- E2EE: MLS (RFC 9420) through OpenMLS (MIT) for every conversation, 1:1 included; libsignal is AGPL-3.0, unsupported outside Signal and in conflict with App Store terms (MSG-02 change, open-decisions D-08). No public full audit of OpenMLS: budget an external audit of our crate (proposed SEC-14).
- One MLS leaf per device, credentials signed by an account identity key, 60-digit safety numbers; a new device never gets old history.
- Push payloads carry no content or names; the iOS Notification Service Extension decrypts; silent control pushes need Apple's filtering entitlement.
- Backups: a generated recovery key only (no passphrase without a server-side attempt limit); never iCloud Drive (Apple 5.1.3(ii)), DB excluded from device backups (proposed SEC-12).
- GDPR: drinks, BAC and weight plus sex are art. 9 health data; explicit consent per purpose (7 consents), a mandatory register and DPIA before the first public build. BAC on the device with a "local only" mode would shrink the server scope (proposed SEC-11, open-decisions D-10).
- Export: an ANSSI declaration at least one month before distribution in France, probably before external TestFlight; US mass-market 5D992.c.
- Apple 5.1.1(ix) expects a legal entity for apps with sensitive data.
- 12 assumptions; 7 blockers (legal entity, ANSSI, licence, KMS, entitlement, audit budget, privacy contact).

## Recon-Community

Report: [research/community.md](research/community.md).
- DSA: crew-only content is hosting; every public item makes us an online platform. Hosting duties always apply (art. 11, 12, 14, 16, 17, 18); build complaints (art. 20) and misuse suspension (art. 23) even while exempt as a small enterprise.
- French review law (L111-7-2, D111-16 to D111-19, L121-4): show the check method, publication and experience dates, ranking criteria, a dedicated "How reviews work" page, and an owner channel for authenticity doubts (proposed COM-12).
- Apple 5.1.2(iii) makes COM-06 a store rule. Presence design: levels and buckets only, k ≥ 5 trusted users from ≥ 2 crews, 30 min grid with 30 min lag, seeded noise, no live level at small venues, private places never public (proposed COM-15, COM-16).
- Reviews: visit month and year, 12 h publication delay for all reviews, no reward, owners cannot hide anything. Conflicts with design-b on date granularity.
- Door policy: only the positive fact ("ID checked every time") is shown or filterable.
- Perspective API shuts down on 31 Dec 2026; proposed stack: rules + Presidio + Mistral moderation, Sightengine or Rekognition EU, PhotoDNA. Images cost about $29 a month at 10,000 users.
- Six abuse scenarios (stalker, harasser, fake-review farm, venue burying reviews, doxxing, minors) and nine ship-blockers before any public feature; proposed COM-13 and COM-14.
- 12 assumptions; blockers: lawyer review, PhotoDNA, provider accounts, named moderators.

## Recon-Polish

Report: [research/polish.md](research/polish.md).
- Every out-of-app action (widget, Live Activity, notification, Siri, Control, tile) runs without our JS runtime: a native fast path is needed (proposed QOL-25). This is the report's biggest architecture finding.
- Live Activities live 8 h (12 h on the Lock Screen) with 4 KB of data, so a 21:00 to 06:00 night needs push-to-start renewal (QOL-26). Widgets get about 40 to 70 reloads a day.
- Android Live Updates must be started by the user's own action; Android App Actions are gone since Assistant left phones in September 2026; Siri phrases must include the app name (10 shortcuts max).
- Sixteen platform rules force design changes: no in-app "Copied" on Android 13+, haptics silent in iOS Low Power Mode (QOL-28), no NFC "cheers" on iPhone, system photo picker only, Firebase Dynamic Links shut down (QOL-29), App Store 1.4.3 / 1.4.5 on dares and nudges.
- Notification budget proposal: 3 alerting notifications per hour and 8 per night, safety exempt; six channels; mute a party until morning (QOL-30, QOL-31). Lock screen discreet by default (QOL-27, open-decisions D-09).
- Hermes lacks `Intl.PluralRules` and `RelativeTimeFormat`; FormatJS polyfills needed.
- Transit data exists for QOL-22: 216 GTFS-RT datasets in France, IDFM, Lyon, Bordeaux, Toulouse, Marseille, TfL.
- 12 assumptions; blockers: Meta, Snap and TikTok developer apps, Apple account, domain, transit keys.

## Recon-Voice

Report: [research/voice.md](research/voice.md); catalogue: [SLOP.md](SLOP.md).
- Dash-free text proves nothing in 2026: most models now suppress dashes. What gives a model away is structure (negation setups, glued fragments, triads, fake ranges, self-applause) and new vocabulary ("dependable", "steady", "This matters" for Claude); over-correction into short chopped sentences is itself a tell.
- `SLOP.md` has 9 sections, about 200 testable items and 21 lint rules (R-01 to R-21) with Unicode-safe regexes, severities, a reasoned allowlist and fixtures.
- Tone by channel (Monzo): wit zero in errors, sync, BAC, driving, SOS, deletion, money and legal; one joke at most per screen; no jokes near money.
- French needs its own list (calques, adjective doublets, typography with U+202F and « »).
- One DESIGN.md sample fails (« 2 actions n'ont pas pu être enregistrées. » has no reason and no action); the BAC notice is the one approved negation.
- Proposed SLOP-09 (deck lint), SLOP-10 (glossary synonym lint), SLOP-11 (copy variants); AI label for AI-02 and AI-03.
- 9 assumptions; user decisions on en-US vs en-GB and inclusive French (open-decisions D-02, D-03).

## Recon-Skills

Report: [research/skills.md](research/skills.md); tables: [SKILLS.md](SKILLS.md).
- 21 candidates staged in `research/skill-candidates/` (103 Markdown files), read in full at pinned commits; nothing installed, no script run, no prompt injection found.
- Six skills need edits before install: Expo's telemetry `npx` call, PowerSync's `@latest` installs, script and offer to write into CLAUDE.md, Impeccable's binary-download launcher, Detox's vendor cloud upload, and a PowerSync sample that mints a JWT for any user id.
- Several skills contradict the design (system font and SF Symbols, sub-300 ms rule, no animation for frequent actions, em dashes allowed): project files win.
- PowerSync's generic CRUD upload clashes with server-authoritative events (AC-01).
- No vetted skill for game design, i18n libraries or location anti-spoofing.
- Agent roles defined for `.claude/agents/`; proposed SLOP-12 (native anti-slop lint, renumbered) and a HUB-02 note on the 8 h Live Activity limit.
- 5 assumptions; no blocker. Both `research/skills.md` and `SKILLS.md` end with two stray tool-markup lines (`</content>`, `</invoke>`) to delete.

## Cross-cutting findings

1. **Pending is not success, almost everywhere.** The prototype completes actions instantly or on client timers: notification actions, friend requests, home safe, SOS sent and "seen", cheers proof, widget and Live Activity counters, RSVP, settings, audiences, transfers, sessions, leaderboard overtakes and venue takeovers. Only the add-pint flow and the Etats board model pending states. Every spec must apply SYNC-01 to SYNC-03, and outcomes decided by the server animate on its answer. (design-a.md conflict 3; design-b.md G-6; design-c.md §1 item 10, §5.2 item 21)
2. **Adaptive levels are designed for one screen only.** Levels 1 to 3 exist for the Party screen (ModeBourre); no other board shows a level variant. Game, recap, territory, leaderboard, community, money and settings specs write their level behaviour from DESIGN.md §6, motion.md §3.5 and games.md §2.0. (design-a.md §2.2 (g); design-b.md G-20; design-c.md §5.1)
3. **Out-of-app actions need native code whatever the stack.** Widgets, Live Activities, Controls, Siri, tiles and notification actions run without the JS runtime; BLE peripheral, `isProducedByAccessory`, UWB, the NSE decryption, Live Update builder and several share kits are native too. A native fast path and its sync with the offline queue are P0 architecture. (polish.md §1 item 1, §2.4 R1; anticheat.md §1 item 3; security.md §2.3; motion.md §3.2)
4. **The BAC notice and BAC figures are inconsistent across surfaces.** The notice is missing on levels 1 to 3, widgets, Live Activity, watch and share cards, while polish.md argues the lock screen should show no BAC figure by default. Both need one rule per surface. (design-a.md §2.7; bac.md §2.6; polish.md QOL-27)
5. **Numbers disagree between the prototype and the research, and between reports.** Level thresholds 0.5 / 1.0 / 1.5 (prototype) vs 0.50 / 0.80 / 1.20 g/L (bac.md); danger cap 2 g/L vs 1.20 g/L; vault unlock at 11 h vs at back to zero; one check-in per venue per party (anticheat.md) vs per night (territories.md); peer window ±20 vs ±30 min; review dates exact to friends (design-b.md) vs month and year for everyone (community.md); a check-in worth 3 points vs 10. Demo numbers do not add up (41 vs 26 drinks, 116.30 vs 142.80 €) and must all be computed. (design-a.md A-DESIGNA-3; design-b.md G-1, G-10; design-c.md §5.2 item 23; bac.md §2.5; territories.md §3.2; anticheat.md §2.2, §2.3; community.md §2.2.2)
6. **Privacy leaks to strangers in the prototype.** Public map scope shows crew bosses; a non-friend participant's live BAC; dated reviews; review audience defaulting to Public; a stranger's open party with venue and time; recap exports with other people's curves and photos; the cheat line on a public venue page; strangers always seeing first name and photo. COM-06, PROF-05 and PROF-08 rules close them. (design-a.md conflict 12; design-b.md §2.9; design-c.md §5.2 items 14, 16, 17)
7. **Amber overuse and other design tells.** DESIGN.md allows only the BAC plus the primary button in amber per screen; many screens carry three to five amber elements (Party level 0, new party, limits, lock screen, recap, Panthéon, pools, stats, profile). Also: big number plus small label grids, identical card grids, icon tiles above headings, danger tint on a game event, ✓ / ✗ glyphs and Unicode arrows instead of icons, one placeholder illustration on 15 game cards, explanatory footnotes and designer annotations rendered as UI text. (design-a.md §2.8; design-b.md §2.8; design-c.md §5.2 item 8, §9)
8. **Demo controls and annotations must not ship.** "Vrai check-in / Faux GPS", "Simuler : Malik prend une pinte vérifiée", "Simuler : une pinte à 6,50 €", the Etats server-mode segmented control, the level selector notes and about 15 annotation strings belong in a debug-only QA or chaos panel, or nowhere. (design-b.md G-11; design-c.md §2.11; design-a.md §2.8)
9. **Copy patterns the lint will catch.** Plural « vous » in several strings (needs a reasoned allowlist for crew-plural use), duration ranges on every game card, missing singulars ("1 personnes", "1 gorgées"), masculine-only strings, "OK" and "Off" in French UI, "OK" on error toasts. (design-a.md §2.8; design-b.md G-8, G-9, G-17; design-c.md §3 decision 10, §5.2 item 24; voice.md §3)
10. **Glossary drift.** 26 naming conflicts found while merging (round, gage, niveau, fil, boss vs Mayor, habitué, Squad vs the synonym lint, safety number, recovery key, busyness labels, takeover). Resolutions are proposed in `GLOSSARY.md`. (all reports §6; SLOP.md R-19)
11. **Store and legal rules shape features, not just copy.** App Store 1.4.3 and 1.4.5 and Google Play's ban on favourable competition drinking keep the drinking leaderboard and records behind RANK-09 in any public build, ban drinking dares and "another one?" nudges, and steer the door-policy filter. Apple 5.1.1(ix), 5.1.2(iii) and 5.1.3(ii), the DSA, French review law, GDPR art. 9 and the ANSSI declaration add work before any public build. (bac.md §2.6; community.md §2.1; polish.md §2.4 R14; security.md §1)
12. **Gaps in phase 0 itself.** No report covers maps and places (A-TER-6 and A-AC-4 point to a recon that was not run); the country age table for O-02 is not sourced; the shared web-search budget ran out in app.md, security.md, community.md, anticheat.md, bac.md and polish.md, so several facts stay UNVERIFIED or [U]; S2M's four unpublished game rules remain inferred. (app.md §2.4; security.md intro; community.md §7; anticheat.md research gaps; bac.md §8; polish.md intro; games.md §1)
