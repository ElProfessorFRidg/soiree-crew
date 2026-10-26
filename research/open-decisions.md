# Open decisions after phase 0

Merged from the 14 recon reports on 2026-10-26. Part (a) needs the user's answer, part (b) needs the user's action, part (c) the orchestrator settles alone and records in `ASSUMPTIONS.md` or an ADR. Each item names its source.

## (a) Decisions that need the user

| # | Decision | Options | Recommended | Source |
|---|---|---|---|---|
| D-01 | Next-morning screen theme (QOL-20). | Light, as the approved prototype and DESIGN.md §1 show; dark, as PROMPT.md writes. | Light, recorded in an ADR, QOL-20 wording updated. | design-b.md G-2, §3 decision 1 |
| D-02 | English spelling base. | en-US base with an en-GB override file; en-GB base; one neutral file. | en-US base plus en-GB overrides only where words differ (breathalyser, pint). | voice.md §3 decision 8 |
| D-03 | Inclusive and gender-neutral French. | Épicène phrasing; point médian; declared pronoun per user. | Épicène phrasing, no point médian; gendered game and profile lines rewritten neutral. | voice.md §3 decision 9; design-c.md §3 decision 10 |
| D-04 | Age gate by country (O-02). | 18+ everywhere; legal drinking age of the chosen country (21 in the US), re-checked on country change. | Country-aware, 18 by default. The age table per country still needs a sourced pass (Recon-BAC did not cover it). | app.md §3 decision 2, §5 |
| D-05 | Keep La Courbe (O-64). | Crash game "Ça grimpe" redesigned (games.md); game on real BAC curves (app.md idea); demote to P1. | Crash game with the games.md rules, kept P0. The BAC-curve game is rejected because it rewards drinking faster. | app.md §3 decision 1; games.md §2.4 |
| D-06 | Height (and age) in onboarding (O-04). | Weight and sex only, as S2M; optional height and age, used by the formula. | Optional but encouraged; "other / prefer not to say" uses the female body model, said in the UI. | bac.md §2.1.2, §3 decision 3; app.md §2.5 |
| D-07 | SOS press-and-hold vs the drunk-mode rule (no essential long-press at levels 2 and 3). | 2 s hold everywhere as a documented exception; hold at levels 0 and 1, big tap plus a cancellable countdown at levels 2 and 3. | Hold at 0 and 1, tap plus cancellable countdown at 2 and 3, and a cancel-after-send flow (N-28). | design-a.md §2.7, §3 decision 2 |
| D-08 | Source licence of the client. | Closed or permissive, with OpenMLS for E2EE; fully open source under AGPL, which makes libsignal possible but keeps the App Store GPL risk. | Closed or permissive with OpenMLS (MSG-02 change). | security.md §2.1, §7 item 3 |
| D-09 | BAC numbers on the lock screen (QOL-27 vs the approved Systeme board, HUB-02, HUB-03, O-33). | Show the figure by default, as the prototype; discreet by default (level icon and time to zero), figures opt-in. | Discreet by default with a one-tap opt-in; the approved design stays as the opt-in look. | polish.md §2.4 R3, §5 |
| D-10 | Where drinks and BAC live (SEC-11). | Server by default under explicit consent (needed for crew features, leaderboards, AC-01); on the device by default with sharing opt-in; both, with a "local only" mode. | Server under explicit art. 9 consent, plus a "local only" mode that switches off crew sharing and leaderboards. | security.md §2.8, §5; PROMPT operating principle 12 |
| D-11 | Profile audiences nest or not (PROF-01). | Nested scale as in the prototype (Only me < My crews < Friends < Everyone, so Friends also reaches crew members); four independent audiences. | Nested, recorded in an ADR and GLOSSARY.md, because PROF-08 tests depend on it. | design-c.md §1 item 7, §3 decision 6 |
| D-12 | freeRASP (third-party RASP sending a weekly report to Talsec). | Use it; in-house jail-monkey-class heuristics at low weight. | In-house heuristics in v1; freeRASP only after a security and GDPR review. | anticheat.md §3 decision 6, §7 item 5 |
| D-13 | Paid lawyer review (French consumer law, DSA, Loi Evin, product liability, MDR, AI Act). | Before the first public feature; never (private crew build only). | Before any public feature or public store release; not needed for the private crew build. | community.md §7; bac.md §2.6, §7; voice.md A-VOICE-8 |

## (b) Blockers that need the user

| # | Blocker | What the user does | Blocks | Source |
|---|---|---|---|---|
| B-01 | Apple Developer Program account | Enrol (as the legal entity if one exists, see B-03). Enables App Attest, DeviceCheck key, App Groups, Associated Domains, broadcast push for Live Activities, TestFlight. | Phase 1 spikes on device (NSE + MLS, App Attest, widget fast path); HUB-02, O-33, QOL-04, QOL-25, AC-05, MSG-04. | anticheat.md §7; polish.md §7; security.md §7 |
| B-02 | Google Play Console and a linked Google Cloud project | Create both. | AC-05 (Play Integrity), internal testing track, quota request. | anticheat.md §7 items 2 and 3 |
| B-03 | Legal entity and account holder | Decide company or individual, and whose Apple and Google accounts. Apple 5.1.1(ix) expects a legal entity for apps with sensitive data; ANSSI and PhotoDNA ask for a Kbis or equivalent. | Store submission of a public build; SEC-10; COM-08 (PhotoDNA). | security.md §1 item 9, §7 item 1; community.md §7 |
| B-04 | ANSSI cryptology declaration | File it on demarche.numerique.gouv.fr at least one month before distribution in France (plan 60 days); upload the attestation to App Store Connect. | First external TestFlight in France (A-SEC-9) and any French store release; SEC-10, SEC-13, MSG-02. | security.md §2.9, §7 item 2 |
| B-05 | Apple notification filtering entitlement | Request it once B-01 exists. | Silent MLS control pushes (MSG-04); otherwise those events go over the socket only. | security.md §2.3, §7 item 5 |
| B-06 | Domain name | Buy one domain for Universal Links, App Links, invite pages, OG images and the passkey relying party. | Phase 1 auth (SEC-07, O-01 passkeys); N-30, QOL-05, QOL-29. | polish.md §7 item 4; security.md §2.6 |
| B-07 | EU hosting and KMS account | Open the account with the provider the Architect picks; budget about $0.06 to $1 per key per month. | Phase 1 security foundation (SEC-04) and backend. | security.md §2.4, §7 item 4 |
| B-08 | Privacy contact (and DPO later) | Name a real person for the privacy policy and the processing register. | Phase 1 register (SEC-08); O-08 policy. | security.md §2.8, §7 item 7 |
| B-09 | IP geolocation database | Create a free MaxMind GeoLite2 account, or pick another provider. | AC-03 country check in the scoring core (phase 1). | anticheat.md §7 item 4 |
| B-10 | Social sharing developer apps | Meta developer account and Facebook App ID (Instagram Stories); Snap Kit app (Creative Kit); TikTok for Developers app with Share Kit. | QOL-06 (P0, phase 2), JOY-09, RANK-03 share cards. | polish.md §2.2 QOL-06, §7 items 1 and 2 |
| B-11 | Moderation provider accounts and keys | Mistral, or OpenAI with EU residency approval, for text; Sightengine or AWS for images. | COM-08 build, so every public COM feature. | community.md §2.4.2, §7 |
| B-12 | Named moderators and Play child-safety contact | Two real people from the crew agree to moderate (24 h SLA, 1 h for threats) and one is named in Play Console. | First public feature; Play listing as Social. | community.md §2.4.1, §7 |
| B-13 | PhotoDNA (or equivalent CSAM hashing) | Apply with the legal entity's details. | COM-08 image pipeline before public photos. | community.md §2.4.2, §7 |
| B-14 | Physical test devices | One ProMotion iPhone (13 Pro or later); a modest Android (API 30 to 33, 60 or 90 Hz, 4 GB, A-MOTION-7); an old Android, a custom-ROM Android and two iPhones for RT-20; a rooted or jailbroken device only if wanted. | Phase 1 motion demo (MOT-01), MOT-12, ADP-09, AC-10 RT-20. | motion.md §7; anticheat.md §7 item 6 |
| B-15 | Red team scope consent | Confirm that the red team may attack our own staging, accounts and devices, including a rooted test device. | AC-10 RT-10. | anticheat.md A-AC-10 |
| B-16 | External audit budget for `crew-crypto` | Approve a budget. | Public release (SEC-14). | security.md §7 item 6 |
| B-17 | Transit data accounts | IDFM PRIM key and TfL key (both free); read the Licence Mobilités terms. | QOL-22 (P2). | polish.md §2.5, §7 item 5 |
| B-18 | Play Integrity quota increase | Request it in Play Console before public launch if more than about 1,500 daily users. | Public launch only. | anticheat.md §7 item 3 |
| B-19 | Rive account | Only if the Architect picks Rive; free tier is enough. | Empty states, badges, launch animation (MOT-10). | motion.md §7 |
| B-20 | Optional: install S2M 2.0.6 | Screenshot the rules cards of « Le Qui A ? », « La Bombe », « Les Mines » and check whether « La Courbe » exists (Normal mode is free). | Nothing; would confirm A-GAMES-4, 5, 7, 9 and A-APP-1 before the O-53, O-54, O-59, O-64 specs. | games.md §7; app.md §7 |

## (c) Decisions the orchestrator takes alone

Listed so they are not asked. Each goes to `ASSUMPTIONS.md` or an ADR when taken.

- ID collisions and new IDs: the numbering in `FEATURES.md` "ID renumbering", and which proposed IDs are accepted (FEATURES.md).
- BAC model, constants, the two elimination rates and the reference test set (bac.md §3).
- Adaptive level thresholds 0.50 / 0.80 / 1.20 g/L with hysteresis, vault at 0.80 g/L with the 60 min projection and unlock at back to zero, danger cap 1.20 g/L, poisoning card from 2.0 g/L (bac.md §2.5).
- Morocco and Tunisia shipped as zero tolerance until verified; unverified legal rows flagged (bac.md §2.3).
- The O-19 notice wording, picked in VOICE.md between bac.md and DESIGN.md §9 (bac.md §2.6; voice.md §2.4).
- Quiet-hour defaults that never mute safety, N-29 or a party the user is in (design-a.md conflict 9; polish.md QOL-31).
- Notification budget per night and the channel taxonomy (polish.md §3 decisions 5 and 6).
- Every glossary conflict C-01 to C-26 in `GLOSSARY.md`, through VOICE.md where a FR label is still open.
- Game rules for O-53, O-54, O-59, O-64, the shared penalty model, forfeit sizes, table style, no casino vocabulary (games.md §3).
- Level naming set for games, catalogue durations computed or hidden (design-c.md §3 decision 2; design-b.md §3 decision 7).
- Territory scoring rule set `territory_rules_v1`, including "per night" for TER-03 over anticheat.md's "per party" (territories.md §3; anticheat.md §2.2).
- Anti-cheat risk score, bands, two-category rule, kindness rules, ration of Play Integrity calls (anticheat.md §2.4, §3).
- Check-in UI without per-signal verdicts, with the "unverified" outcome (design-b.md §3 decision 3).
- Review visit date granularity until the lawyer reads it: month and year for everyone with a 12 h delay (community.md D6; design-b.md decision 5), and reviews deleted on account deletion (A-COM-7).
- COM-06 aggregation parameters, private places never public, no distance between people (community.md §3).
- E2EE design: OpenMLS, one leaf per device, recovery key only, NSE decryption (security.md §3), within the licence choice D-08.
- Merging SEC-13 into SEC-10 or not.
- Motion tokens (five springs, effects springs), native sheets and switches keeping system springs (ADR), haptic vocabulary, living background (motion.md §3).
- Demo controls moved to a debug-only QA panel (design-b.md G-11; design-c.md §2.11).
- Prototype bugs fixed in specs, never copied (design-a.md §2.7; design-b.md G-3; design-c.md §3 decision 3).
- Plural « vous » allowlist rule in SLOP-04 for strings addressed to the crew (design-b.md §3 decision 8; voice.md §3).
- Skill installs after the edits listed in skills.md §2.3, and the order of installation (skills.md §3).
- Stack choice itself, from `research/stack-inputs.md` (PROMPT `<stack>`).
