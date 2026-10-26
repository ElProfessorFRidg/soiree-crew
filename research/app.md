# Recon-App: what Soirée2Malade (S2M) does

Report by the Recon-App subagent, phase 0. Every source was read on 2026-10-26. Reviews and release notes are paraphrased, never copied. No card text, question, recipe or image from S2M is reproduced here.

## 1. Summary

- The App Store version history is complete: 21 releases, from 1.0 (2026-04-24) to 2.0.6 (2026-10-21). It is condensed release by release in 2.1. Almost every O-xx in `PROMPT.md` traces back to one of these releases. The history also shows what S2M broke and had to fix, and those fixes are our acceptance criteria: double counting from the widget, the app freezing after a drink was added, drinks lost offline, group BACs stuck at zero during a trip, a party left open for days, a duplicated friend request, an invitation reported as sent when it had failed.
- **La Courbe (O-64) is no longer in S2M's catalogue.** It appears only in the older Google Play description (7 launch games) and as a tag on one App Store screenshot. The current list is 13 named games plus Gribouille, which makes the 14. La Bombe and Les Mines were added without a release note. No rules for La Courbe, Qui a ?, La Bombe or Les Mines are public in any source I could reach.
- **The age gate depends on the country.** The English landing page says 21+ to download and use the app. The French page and the stores say 18+. O-02 should be country-aware (see 5).
- The strongest user complaints, in order: BAC accuracy (it under-estimates, the units look wrong, food, height and sleep are ignored); forgetting to log drinks once drunk; slowness on modest Android phones; GDPR and account deletion, plus a lost friend list; "made by AI". The strongest requests: richer charts, seeing what friends drank (per day, month and year), a photo when logging a drink, photos and videos private to the group, an end-of-party ranking, and statuses like "gone to bed" or "unwell".
- Several reviews celebrate drinking competitively ("beating my own record", "drinking contest"). The S2M developer answered two of them publicly: they refuse to glorify records, and they refuse a ranking by BAC because of prevention concerns. This supports RANK-07, PROF-06 and ranking by drinks or grams rather than by BAC.
- I propose 5 new IDs and 2 changes to existing IDs (see 5). Everything else S2M does already maps to an existing ID.

## 2. Findings

### 2.1 Version history (App Store FR, complete)

Source: App Store FR product page, "Historique des versions" (the serialized page data holds all 21 entries; the US page shows the same entries in English). Dates are UTC.

| Version | Date | What changed (condensed) | Our IDs |
|---|---|---|---|
| 1.0 | 2026-04-24 | First release, no notes. The launch games, per the older Google Play text: Truth or Dare, Never Have I Ever, La Roulette, Qui a ?, L'Autoroute, Le S2M, La Courbe. | O-44..O-65 |
| 1.1 | 2026-04-27 | S2M+ subscription added. | O-71 |
| 1.2 | 2026-05-05 | Bug fixes and performance. | - |
| 1.3 | 2026-05-12 | Full visual overhaul: violet and cyan "aurora" background, liquid-glass navigation, windows and buttons, smoother redrawn BAC curves. New premium period "Average" (7-day moving average). The "Month" period now centres on nearby months. Google sign-up and sign-in fixed. | O-78, O-24, O-01 |
| 1.4 | 2026-05-21 | Hydration reminders. Live trend: still rising or not, plus estimated peak value and time. Personal limits drawn on the curve. Share a photo with stats and curve. New custom glass icons for quick adds. Refined BAC estimate. Profile photo fixed. | O-27, O-16, O-25, O-30, O-20, O-04 |
| 1.5 | 2026-05-30 | "21 fixes + 1 game". New game Le 1VS1 (Normal free, Hard and Extreme for S2M+). Driving and back-to-zero timers now reliable above 1.5 mg/L. No more break in the curve 24 h after a drink. BAC home widget refreshes continuously. 3 new round timers in the games. Friends' BAC syncs up to 4x faster. Recap shows every participant, not only friends. No more spam of over-limit notifications. Participant profiles tappable from a party, add a friend from there. Parties tab badge shows the real number of invitations. "Party in progress" page redesigned. Hour labels on curves no longer overlap. Profile summary under the BAC curve. Visual confirmation when editing weight or height. S2M+: Instagram community for subscribers, and BAC shared between Squad members. | O-52, O-17, O-18, O-24, O-34, O-47, O-37, O-41, O-38, O-39, O-36, O-04, O-75, O-42 |
| 1.6 | 2026-06-05 | BAC and curve update instantly after a drink is added and stay consistent with the history. Grouped history (e.g. "5x Beer 50 cl") expands to each drink's time, with single delete. Quick add Beer 33 cl. Selfie share switches between front and back cameras. Music (Spotify, Deezer) keeps playing when the app opens. | O-15, O-23, O-20, O-30, O-14 |
| 1.7 | 2026-06-12 | New neon home with the live BAC up front and animations tuned for modest phones. New game Qui de nous ?. In-app update alerts. Better per-account isolation on the device. Email sign-up fixed (first name and username kept separate). | O-34, O-78, O-57, O-12, O-13, O-01 |
| 1.8 | 2026-06-19 | S2M+ status: rank, frame and badge that grow with seniority, collectible titles, one new tier per subscribed month, visible to the crew on the profile, in friends and at parties. Qui de nous ? fixed (players now shown). Deleting custom drinks works again. Faster launch. **The app no longer asks for location.** | O-72, O-57, O-21 |
| 1.9 | 2026-06-27 | Performance. | - |
| 1.9.1 | 2026-07-01 | Faster and smoother, especially at launch. | MOT-12 |
| 1.9.2 | 2026-07-10 | New games L'Imposteur and Le Doigt; games and shareable cards reworked. Recap notification as soon as the party ends; the recap shows only people actually present. New "Party" home widget. Driving timer: choose a country, legal limit set automatically (22 countries), new novice / probationary driver mode tied to the real limit. Crash when sharing the recap fixed. | O-61, O-60, O-47, O-41, O-34, O-05, O-18 |
| 1.9.3 | 2026-07-24 | New feature Kwitt: create a pot, add expenses, minimum-transfer settlement, add friends, record repayments, live tracking; splits are always equal. Trip mode (S2M+ only). Google sign-in back. Recap saved and kept, notification when ready, shareable as a card. Big performance pass (less heat, lighter home, recap and Bar freezes fixed). Friends: search finds the right profiles, an invite is no longer shown as sent when it failed, a request already received is accepted instead of duplicated. Estimates: counters ignore drinks in the future, the time to the legal limit can no longer be announced wrongly, a party no longer stays open for days. New tab bar, Friends tab redesigned, animated curve on the tracking screen, Legend badge and S2M+ button reworked. Repeats the notice that the estimate is not a certified breathalyser. | O-70, O-35, O-40, O-01, O-41, O-43, O-22, O-18, O-24, O-72, O-19 |
| 1.10.0 | 2026-08-10 | The Bar grows to 470+ recipes with photo and preparation, new Beers and Desserts sections. New game Le Double Agent (two agents with a different word, 5 players minimum, unlocked from 4 friends). Long-press a drink to edit, move or remove it; custom drinks synced across devices. Floating bubble to add a drink in every game. Change password and email in settings. Fixes: group BAC no longer stuck at zero during a multi-day trip, offline drinks no longer lost, profile no longer frozen when a value goes out of bounds, Bar opens faster. | O-66, O-62, O-48, O-21, O-32, O-06, O-40, O-31, O-04 |
| 2.0.0 | 2026-08-23 | 7 languages, the whole app. Home widget in 3 sizes: curve that falls on its own, back-to-zero, add-a-drink buttons, personal presets. Curves: zoom, pan, a trace that follows the finger, friends' avatars on the graph, legal thresholds corrected for Poland, Russia and Morocco. Party lists update live (BACs, arrivals, departures), even after backgrounding. Fixed: recap crash, QR scan crash on iPhone, subscription not unlocking after payment, duplicated participants, friend list not refreshing. All buttons enlarged, Reduce Motion respected, game descriptions no longer truncated. **Notifications cut by a third.** | O-09, O-33, O-24, O-29, O-18, O-37, O-36, O-11, O-38 |
| 2.0.1 | 2026-08-29 | 12 h / 24 h follows the phone. Privacy policy readable without an account, stating what is collected and who receives it. Analytics consent revocable in Settings. Account deletion says what it erases and confirms when done. **Height no longer asked: the calculation never used it.** Bar cards describe preparation only. | O-10, O-08, O-07, O-04, O-67 |
| 2.0.2 | 2026-09-07 | Built-in shop (catalogue, product pages, cart, payment). Referral fixed: invite links work end to end. Friend profile opens correctly, friend list updates live after a disconnect, subscription prices always shown, faster launch, simpler Friends screen, more reliable friend search. | O-74, O-36, O-43 |
| 2.0.3 | 2026-09-15 | Freeze when adding a drink fixed. Drinks added offline are kept and sent when the network returns. A drink counted twice from the widget fixed. | O-31, O-33 |
| 2.0.4 | 2026-10-02 | New game Gribouille: one player draws, the others guess, 3 to 8 online; Hard and Extreme for S2M+. Full history now shown in the recap, the profile and friends' pages. Multiplayer games no longer freeze when someone leaves. Subscription stays active offline. Buttons no longer hidden under the notch or camera. Small fixes. | O-63, O-43, O-47, O-71, O-11 |
| 2.0.5 | 2026-10-14 | New BAC screen: clearer curve, entry to the minute, history editable with a swipe. Profile, sign-in, sign-up and 18+ screen redesigned. New onboarding tutorial where notifications are chosen. Parties: invitations as cards, reply from the list, recap reworked. Smoother animations. The freeze after adding a drink is gone. Fixes in games and reporting. | O-22, O-23, O-02, O-03, O-36, O-41, O-77 |
| 2.0.6 | 2026-10-21 | All 14 games redesigned (bigger, rules as cards, "?" button to see them again). New swipeable catalogue with a one-phone / several-phones filter. Kwitt reworked: owed to you / you owe at a glance, one pot per screen. Friends and settings redone. Fixes: La Bombe, more reliable purchases, large amounts displayed correctly in Kwitt. | O-44, O-46, O-70, O-54 |

Google Play "What's new" (read the same day) matches 2.0.6. Play shows only the latest notes, so its history cannot be read further back. No gap remains: the App Store page holds every version.

### 2.2 Full S2M feature list mapped to our IDs

Sources: the three store pages, both landing pages, the screenshots (5 on App Store FR, 9 on Google Play FR) and the version history.

| S2M feature (as observed) | Source | Our ID |
|---|---|---|
| Email and Google sign-up, first name and username kept separate | VH 1.3, 1.7, 1.9.3 | O-01 |
| 18+ screen | VH 2.0.5, store age rating | O-02 (change proposed, see 5) |
| Onboarding tutorial with notification choices | VH 2.0.5 | O-03 |
| Weight, height (removed in 2.0.1), profile photo, visual confirmation, bounded values | VH 1.4, 1.5, 1.10.0, 2.0.1 | O-04 |
| Country for the legal limit (22 countries), novice / probationary mode | VH 1.9.2, 2.0.0 | O-05, O-18 |
| Change password and email | VH 1.10.0 | O-06 |
| In-app account deletion; Play says "deletion built into the app" | VH 2.0.1, GP description | O-07 |
| Privacy policy without an account; revocable analytics consent | VH 2.0.1 | O-08 |
| 7 languages | VH 2.0.0 | O-09 |
| 12 h / 24 h | VH 2.0.1 | O-10 |
| Bigger buttons, Reduce Motion, no truncation, nothing under the notch | VH 2.0.0, 2.0.4 | O-11 |
| In-app update notice | VH 1.7 | O-12 |
| Per-account isolation on the device | VH 1.7 | O-13 |
| Music never interrupted | VH 1.6 | O-14 |
| Live BAC in mg/L of breath and g/L of blood | Screenshot s1 | O-15 |
| Trend (rising) + estimated peak with time | VH 1.4, s1 | O-16 |
| Back-to-zero countdown (hh:mm:ss) | s1, VH 1.5 | O-17 |
| "Under legal limit" status + novice countdown | s1 | O-18 |
| Permanent "indicative estimate, not a certified breathalyser" notice next to the BAC | s1, VH 1.9.3 | O-19 |
| Quick adds with custom glass icons (beer 25/33/50, ...) | VH 1.4, 1.6 | O-20 |
| Custom drinks: long-press edit / move / remove, synced, presets | VH 1.10.0, 2.0.0 | O-21 |
| Entry to the minute; future drinks ignored | VH 2.0.5, 1.9.3 | O-22 |
| Grouped history, expand, single delete, swipe edit | VH 1.6, 2.0.5 | O-23 |
| Curve periods Day / Week / Month / Total / Avg; zoom, pan, finger trace; threshold colours; legal line; animated; no overlapping labels; profile under the curve; "Limits" button; share and camera buttons on the curve | s1, VH 1.3, 1.5, 2.0.0 | O-24, O-25, O-30 |
| "Set myself a limit" + alerts when getting close | s1, store descriptions, landing | O-26 |
| Hydration reminders | VH 1.4, s1 | O-27 |
| Grams of pure alcohol: this month, total, average | s5 (paywall) | O-28 |
| Friends' avatars on the graph, curve comparison between friends (premium) | VH 2.0.0, s5 | O-29 |
| Photo + stats + curve share, front / back camera | VH 1.4, 1.6 | O-30 |
| Offline queue, no double count, no freeze | VH 1.10.0, 2.0.3, 2.0.5 | O-31 |
| Floating add-drink bubble in games | VH 1.10.0 | O-32 |
| Home widget, 3 sizes | VH 2.0.0, 2.0.3 | O-33 |
| Home blocks: live BAC, "Party" widget | VH 1.5, 1.7, 1.9.2 | O-34 |
| Create a party: about 10 mood icons, name, Party / Trip type, start-day strip, start and end time with steppers | GP screenshots | O-35 |
| Invitations as cards, reply from the list, tab badge, invite links, QR scan | VH 1.5, 2.0.0, 2.0.2, 2.0.5 | O-36 |
| Live dashboard: who speeds up, slows down, missing for 20 min, arrivals and departures | Landing, VH 2.0.0 | O-37, N-29 |
| Crew / over-limit notifications (cut by a third); reviewers receive friends' "already drunk" pushes even outside a party | VH 1.5, 2.0.0, review 2026-05-17 | O-38 (note: also outside parties, see 3) |
| Participant profile from a party, add as friend | VH 1.5 | O-39 |
| Automatic close; trips keep group BAC | VH 1.9.3, 1.10.0 | O-40 |
| Recap: saved, notification, only people present, overlaid curves, participant list with drink count and an emoji per person, custom badges, group stats, story card | VH, s4, store descriptions | O-41 |
| Squad: BAC shared continuously (premium) | VH 1.5, s5 | O-42 |
| Friends: search, requests, live list, profile with full history, referral | VH 1.9.3, 2.0.2, 2.0.4 | O-43 |
| Game catalogue carousel: illustration, tags, duration, player count, "Play now" button, pagination ("1/9", later "2/7"), "Playable" eyebrow, one / several phones filter | s3, GP screenshots, VH 2.0.6 | O-44 |
| Normal / Hard / Extreme | Store descriptions | O-45 |
| Rules as cards + "?" | VH 2.0.6 | O-46 |
| Round timers, share cards, multiplayer robustness | VH 1.5, 1.9.2, 2.0.4 | O-47 |
| Unlock at 4 friends | VH 1.10.0 | O-48 |
| Players, penalties | Game descriptions | O-49 |
| Each game | See 2.4 | O-50..O-64 |
| The Bar: 470+ recipes, Classics / Shots / Party / Alcohol-free / Beers / Desserts; search field; category chips with counts; card shows difficulty, ABV in degrees, prep time; the Bar header carries a health notice and "forbidden under 18" | VH 1.10.0, GP screenshots | O-66, O-67, O-68 |
| Mixer ("what can I make?") | GP screenshots | O-69 |
| Kwitt (equal split only) | VH 1.9.3, 2.0.6 | O-70 (N-19 adds unequal splits) |
| S2M+ subscription | Stores | O-71 (retired by decision) |
| S2M+ ranks, frames, titles, Legend badge | VH 1.8, 1.9.3 | O-72 -> N-34 |
| Beer tips (IAP) | App Store IAP list | O-73 |
| Shop | VH 2.0.2 | O-74 -> N-32 |
| Subscriber Instagram community | VH 1.5 | O-75 |
| Report content | VH 2.0.5 | O-77 |
| Aurora, glass, neon | VH 1.3, 1.7 | O-78 |
| Bilingual landing with video, auto language detection by browser language and a cookie for manual choice | Landing FR / EN (raw HTML) | O-79 -> N-30 |
| Alibi generator | Not found in any source read | O-76 (keep; origin not confirmed, see A-APP-6) |
| Age gate 21+ in English, 18+ in French | Landing /en | **MISSING nuance**: change to O-02 |
| Location permission dropped in 1.8 | VH 1.8 | No S2M feature. A constraint for N-07 / N-10 (opt-in, asked only when needed) |
| Support contact and "data hosted in Europe" claim | GP description | SEC-xx (fact only) |

Nothing else S2M ships lacks an ID. The only gaps are the requests S2M never answered (see 3 and 5).

### 2.3 User complaints and requests

Sources: App Store FR (8 reviews on the page, 44 unique through Apple's public review feed, which only returns the FR storefront plus 1 BE; 136 ratings, average 4.9, split 126/7/2/0/1). Google Play (34 ratings, average 4.7; 14 reviews with text read through the store's public review endpoint in FR and EN). The App Store US and GB pages have no reviews.

**A. BAC accuracy and model inputs (most serious)**
- Play, 2★, 2026-06-26 (v1.8.0): the app needs about twice the drinks before it shows the user over 0.5 g/L. → O-15, O-18, Recon-BAC. Proposed O-86 (transparency) and a reference test set (see 3).
- App Store, 3★, 2026-05-11 (v1.2): suspects a units problem in the calculation. → O-15, PREF-06.
- App Store BE, 4★, 2026-09-29 (v2.0.3): wants height back (weight alone is not precise enough) and an "ate or not" input. → O-04 (Recon-BAC decides about height); **MISSING: food input** → proposed O-85.
- App Store, 4★, 2026-07-01 (v1.9.1): the estimate ignores sleep, energy and food. → O-19, O-85.
- One positive data point, App Store 5★, 2026-10-17: the estimate matched a police breathalyser. Anecdotal.

**B. Forgetting to log once drunk**
- App Store 5★, 2026-08-16: past a certain BAC you forget to log drinks. → QOL-01, QOL-04, O-33, HUB-02, ADP-04, AI-01. Proposed QOL-25 (logging nudge).

**C. Performance**
- Play 2★, 2026-06-20 (v1.8.0): lags and bugs heavily on phones that are not the latest; unusable. → MOT-12, QOL-24, ADP-08. S2M itself shipped 4 performance releases (1.9, 1.9.1, 1.9.3, 2.0.2).

**D. Trust, privacy, deletion**
- App Store 1★, 2026-08-22 (v1.10.0): accuses the app of pushing drinking, calls it non-compliant with GDPR because the profile cannot be deleted, insecure and buggy, friend list lost. → O-07, N-17, SEC-xx, O-43, product guardrails, RANK-07/09.
- Play 1★, 2026-06-14: "an app made by AI". → SLOP-xx (the whole anti-slop bar).

**E. Requests for features S2M never shipped**
- More detailed charts (App Store 5★, 2026-05-13). → O-81, N-16.
- Pushes when a member vomits, goes to hospital, falls into an alcohol coma, or goes to bed (same review). → O-82 (bed / home), N-25, N-28 (SOS), N-29. No "unwell" status → proposed N-36.
- Seeing friends' drinks per day, month and year from their profile (App Store 5★, 2026-05-16); seeing which drinks friends had (App Store 5★, 2026-05-28). → O-43 (partly shipped in 2.0.4), N-13, PROF-02. Must respect the audience rules.
- Photo when logging a drink (App Store 5★, 2026-05-17). → O-83, N-21.
- Photos and videos that stay inside the group (App Store 5★, 2026-05-30). → O-84, N-21, MSG-03.
- End-of-party ranking: each person's peak, most drinks, fastest rise (App Store 4★, 2026-05-31). → RANK-01, RANK-03, O-41. The S2M developer refused a ranking by BAC on prevention grounds; we rank by drinks and grams, with the RANK-07 cap.
- Request to track cigarettes (App Store 5★, 2026-05-16) and a THC curve (Play 4★, 2026-10-08). → **Not proposed.** THC: legal and store risk, no reliable model. Cigarettes: off-mission; if ever wanted, it fits as a custom non-alcohol item with no BAC effect (O-21). Recorded as a decision, see 3.

**F. Behaviour worth noting (not complaints)**
- Several 5★ reviews praise the competition: drinking contests, beating one's limits, rising "to register my night". One reviewer says the app made them notice their drinking was excessive, yet the urge to beat themselves keeps them going. → RANK-07, PROF-06, product guardrails. This is the strongest argument for those IDs.
- What reviewers praise most: all games in one place, cocktail recipes, the live party feature, the friends' notifications, the "French humour" tone, a responsive developer.

### 2.4 Games

Current catalogue: 14 games (2.0.6). App Store FR / US and Play EN list 13 names; Gribouille (2.0.4) is the 14th.

English names come from S2M's own US and Play EN listing.

| S2M name (EN listing) | Added | Public rules | Our ID |
|---|---|---|---|
| Le Soirée2Malade / Le S2M (The S2M) | 1.0 | A card game that ends when the last card is drawn; a mix of the best-known classic games with a bite. 10 to 20 min, 2 to 16 players. Tags Group, Interactive, Dares. (Screenshot s3) | O-50 |
| L'Autoroute (The Highway) | 1.0 | Cross 5 checkpoints by betting on the value of cards; a "Customs" stop at checkpoint 2; finish with as few penalties as possible. 10 to 30 min, 2 to 10 players. On-card tags: Strategy, Bluff, Apéro (PROMPT says "Drinks"; the screenshot says Apéro). (GP screenshots) | O-51 |
| Le 1VS1 / Un contre Un (One vs One) | 1.5 | Face-to-face card duel, 2 players on one phone, the weaker hand takes the penalty. Normal free, Hard and Extreme premium. | O-52 |
| Qui a ? / Le Qui A ? (Who's Most Likely) | 1.0 | No rules published. S2M's own English name ("Who's Most Likely") points to a "who is most likely to..." vote where the group names a player. Inference, see A-APP-2. | O-53 |
| La Bombe (The Bomb) | Not announced; present in the 13-game list (by 1.9.3 at the latest, A-APP-3) | No rules published. Fixed in 2.0.6. The name suggests a hidden timer passed from hand to hand; unverified. | O-54 |
| La Roulette (Roulette) | 1.0 | Random draw, the loser takes the penalty (landing). | O-55 |
| Je n'ai jamais (Never Have I Ever) | 1.0 | Has an unfiltered mode (landing). | O-56 |
| Qui de nous ? (Which One of Us) | 1.7 | Two friends face off: which of the two is more likely to... Fixed in 1.8 (players not shown). | O-57 |
| Action ou Vérité (Truth or Dare) | 1.0 | Has an Extreme mode (landing). | O-58 |
| Les Mines (Minefield) | Not announced | No rules published. The EN name "Minefield" suggests a grid of tiles with hidden mines; unverified. | O-59 |
| Le Doigt (The Finger) | 1.9.2 | Reflex game that settles the group. | O-60 |
| L'Imposteur (The Impostor) | 1.9.2 | One secret word, one intruder; discuss, vote, unmask. | O-61 |
| Le Double Agent (The Double Agent) | 1.10.0 | Two infiltrated agents with a different word, 5 players minimum, unlocked from 4 friends. | O-62, O-48 |
| Gribouille | 2.0.4 | One player draws, the others guess, 3 to 8 players online. Hard and Extreme premium. | O-63 |
| La Courbe | 1.0, later gone | Listed in the old Play description (7 launch games) and as a tag on an App Store screenshot. **Missing from the current 13-name list**, so it was probably removed or renamed. No rules found. | O-64 |

Free tier: Normal mode only, and a limited number of games ("unlimited games" is a premium perk). Catalogue size seen in screenshots: "2 / 7" (Play, early) and "1 / 9" (App Store).

Research limit: this turn's shared web-search budget ran out before I could look up the classic rules of these games under the same names. Search engines also index S2M poorly; the queries I made returned nothing about the app. Instagram and TikTok sit behind a login wall. The 48 YouTube Shorts are app promos and fail compilations with no text rules in their titles or descriptions. Each game's subagent must run that research (as `PROMPT.md` already asks for O-53, O-54, O-59, O-64).

### 2.5 What S2M asks and stores at onboarding

- **Order (from 2.0.5):** 18+ screen → sign up / sign in (email with first name and username, or Google) → onboarding tutorial with notification choices. Source: VH 2.0.5, 1.7, 1.9.3. Sign in with Apple is never mentioned in any source.
- **BAC profile:** weight; height until 2.0.1 (dropped because the formula never used it); profile photo. **Sex is not confirmed by any source** (it is standard in Widmark-type models; Recon-BAC must confirm what is needed). Country for the legal limit and the novice driver mode (1.9.2). Values are bounded (1.10.0).
- **Permissions:** location was asked until 1.8, then dropped. Camera for selfie sharing and QR scan. Notifications are chosen during onboarding.
- **Analytics consent:** asked, and revocable in Settings (2.0.1).
- **App Store privacy label (self-declared by S2M SAS):** linked to the user: email address (analytics and app functionality), photos or videos, user ID, crash, performance and other diagnostics. Not linked: name, "environment scanning" (an ARKit-type category; probably the camera or QR scan, unconfirmed).
- **Google Play data safety:** "No data collected", "No data shared", encrypted in transit, deletion can be requested. This contradicts the Apple label.
- **Privacy policy (Flycricket template, effective 2026-04-16):** IP address, pages viewed, time in the app, operating system. Says no precise location and no AI. Third parties named: Expo, RevenueCat. Indefinite retention ("a reasonable period"). Deletion by email. A "not for children under 13" clause, inconsistent with the 18+ rating. The policy URL given in the store descriptions (`soiree2malade.vercel.app/politique-confidentialite`) returns 404.
- **Claims:** "Designed in France", "Data hosted in Europe" (Play description). Support goes to a Gmail address, the legal contact to info@ at the brand domain.
- **Seller:** S2M SAS, Guilherand-Granges (07), France, DUNS registered; it declared itself an EU trader on the App Store.

### 2.6 Monetisation (for the record only)

- **S2M+ subscription** (App Store FR): weekly €1.99, monthly €4.99, yearly €29.99. US: weekly $1.99, monthly $3.99, yearly $24.99. Billing through RevenueCat (named in the privacy policy).
- **What S2M+ unlocks** (stores, version history, paywall screenshot): Hard and Extreme modes, unlimited games, advanced stats (monthly curve and total, the "Average" period, grams this month / total / average), curve comparison with friends, Squad (shared BAC curves), Trip mode, signature cocktails, the S2M+ status (rank, frame, badge, titles, one tier per month), and the subscribers' Instagram community.
- **Tips** sold as beers: 25 cl €0.99, 33 cl €1.99, 50 cl €2.99, 1 L €4.99 (US $0.99 / 1.99 / 2.99 / 3.99).
- **Shop** inside the app (2.0.2), linked to the brand's clothing shop at soiree2malade.com (party T-shirts, jerseys, caps, a partner collection).
- **Landing:** "free"; no ads seen in the app sources. O-80 (ads) is not confirmed by any store page; the Play listing does not show "Contains ads".
- **Paywall social proof:** a 5-star row, "Top Entertainment", "41,120+ users" (S2M's own claim, unverified). Play: 10K+ downloads.
- **Ratings:** App Store FR 4.9 (136 ratings). Play 4.7 (34 ratings). Age ratings: App Store 18+; Play PEGI 16 (FR) and Teen (US).

### 2.7 Brand and social presence

- Instagram @soirees2malades (linked from the landing page) and @soiree2malade (linked from the shop). TikTok @soirees2malades. X @soiree2malade (bio asks fans to send clips by Instagram DM). YouTube @soiree2malade (648 subscribers; "S2M ZAP" compilations of party fails, plus about 48 Shorts promoting the app since 2026-06-25; the most-viewed Short has about 25k views).
- The shop claims 130k+ followers across TikTok and Instagram (unverified).
- None of these accounts helps with game rules: the text could not be read without logging in, or none was posted.

## 3. Decisions proposed

1. **Keep O-64 (La Courbe) and design it from scratch.** S2M seems to have dropped it, so there is no reference to match. Its name makes it a natural vehicle for our curve: the game subagent could, for example, build a "guess the curve / guess the peak" game played on our own BAC curves. Reason: parity asks for a game in that slot, and nothing public constrains its design. Alternatively, demote it to P1, since it is not part of S2M's current offer.
2. **O-02 must follow the country's legal drinking age** (18 by default, 21 for the US, and others per Recon-BAC / Recon-Legal). Reason: S2M's own English landing page requires 21+.
3. **Write a BAC reference test set before building O-15 / O-18**: published worked examples (e.g. standard drinks against 0.5 g/L for a given weight and sex) that the engine must reproduce. Reason: the most damaging complaint (Play 2★, the most-upvoted critical review) is under-estimation. A model that is too lenient is a safety bug, not a cosmetic one.
4. **Ship an "Unwell / need help" status next to "Gone to bed" (O-82)** (proposed N-36). Reason: users asked for it explicitly. It closes the gap between a status update and the SOS button (N-28).
5. **Friends' notifications outside a party** (S2M sends over-limit and "already drunk" pushes between friends; reviewers like them and the developer cut a third of them). Keep them under N-35 as opt-in per friend, rate-limited and off by default for the BAC kind. Reason: privacy by design (PROF-05 forbids showing live BAC to strangers, and even between friends it should be a choice).
6. **Do not track THC.** Do not add cigarette tracking as a feature; a custom non-alcohol item (O-21) is enough. Reason: legal and store risk, and no reliable model.
7. **Treat every bug in S2M's release notes as an acceptance test for the matching ID.** Examples: widget double count (O-33), freeze after adding a drink (O-31), trip group BAC at zero (O-40), duplicated participants (O-41), invitation shown as sent when it failed (O-43), large amounts in the pool (O-70), QR crash (O-36), subscription stays active offline (feature flags work offline). Reason: these are real failure modes in the same domain, proven in production.

## 4. Assumptions

- **A-APP-1:** La Courbe was removed from S2M or renamed. Based on: it is absent from the current 13-name list on App Store FR / US and Play EN, while 13 + Gribouille = the 14 games announced in 2.0.6. Verify: install S2M 2.0.6 and browse the catalogue.
- **A-APP-2:** "Qui a ?" is a "who is most likely to..." group vote. Based on: S2M's own English name "Who's Most Likely" (US App Store, Play EN). Verify: play it in the app, or watch an S2M video of it.
- **A-APP-3:** La Bombe and Les Mines were added without a release note, between 1.0 and 1.9.3. Based on: neither is among the 7 launch games nor in any "new game" note; both are in the current list; the catalogue grew from "2 / 7" to "1 / 9" in screenshots. Verify: Wayback Machine snapshots of the store page, or the app.
- **A-APP-4:** S2M's BAC profile asks for sex. Not confirmed by any source; it is the norm for Widmark-type models. Verify: the app's profile screen, or Recon-BAC.
- **A-APP-5:** The Apple "environment scanning" data type comes from the camera (QR scan or selfie share). Based on: the QR and selfie features; nothing in the sources mentions AR. Verify: the app's permission prompts.
- **A-APP-6:** The next-morning alibi generator (O-76) was not seen in any source I read. It may come from an in-app screen or an earlier brief. Verify: the app, or ask the orchestrator where O-76 came from. We keep it regardless.
- **A-APP-7:** S2M shows no ads (O-80). Based on: no "Contains ads" label on Play, and no ad network in the privacy policy (only Expo and RevenueCat). Verify: the app.
- **A-APP-8:** Free S2M users get a limited number of games per period. Based on: "unlimited games" being a premium perk. The exact limit is unknown. Irrelevant to us (everything unlocked), noted for the record.

## 5. Scope changes

| Proposed ID | Priority | What | Reason |
|---|---|---|---|
| O-85 | P1 | Food input for the BAC model: "ate / light meal / empty stomach" per party, changeable mid-party, feeding the absorption rate within bounds Recon-BAC sets. | Requested twice (App Store BE 2026-09-29, App Store 2026-07-01); S2M never shipped it. |
| O-86 | P1 | "How this is estimated" sheet one tap from the BAC: inputs used (weight, sex, food, drinks), the standard-drink equivalent of each drink for the user's country, model limits, and why it can differ from a breathalyser. | Accuracy is the top complaint (Play 2★, upvoted; App Store 3★ on units). Transparency answers it without overpromising. Complements O-19. |
| QOL-25 | P1 | Logging nudge during a party: when nothing has been logged for a while, a quiet prompt ("still on the same glass?") offering same again, water or nothing. Never a push to drink. Off at adaptive level 0 if the user wants; rate-limited. | Forgetting to log once drunk is the most common usage complaint, and an accurate BAC depends on it. |
| N-36 | P0 | "Not feeling well" status (private to the crew in the party): the crew is told quietly, nearest members first, with a one-tap path to SOS (N-28). Clears itself when the user says they are fine or confirms they are home safe (N-25). | Explicit request (App Store 2026-05-13) for alerts when someone is sick or in trouble; nothing covers the middle ground between "gone to bed" and SOS. |
| O-02 (change) | P0 | The age gate follows the legal drinking age of the selected country (18 by default, 21 in the US, etc.), and re-checks when the country changes (PREF-05). | S2M's English landing page requires 21+. |
| O-64 (change) | P0, or P1 | Keep it, designed from scratch (see decision 1). The ID text should say "no longer in S2M's catalogue". | A-APP-1. |
| O-38 (clarify) | P0 | Also covers friend notifications outside a party (over-limit, "already drunk"), opt-in per friend, rate-limited. | S2M sends them, reviewers value them, and S2M had to cut them back. |

## 6. Glossary additions

| Concept | Code / EN UI | FR UI |
|---|---|---|
| Penalty taken in a game (sip, dare) | `Penalty` / penalty | gage |
| Game difficulty level | `GameLevel` (normal, hard, extreme) / level | niveau (Normal, Difficile, Extrême). Do not confuse with `UiLevel`; name it "mode" in the UI if needed. |
| Game played on one or several phones | `PlayMode` (single_device, multi_device) / one phone, several phones | un téléphone, plusieurs téléphones |
| Food state for the BAC model | `MealState` (fasting, light, full) / food | estomac (à jeun, léger, plein) |
| Feeling-unwell status | `NightStatus.unwell` / not feeling well | pas bien |
| Recipe "what can I make" tool | `Mixer` / mixer | mixeur (final name in branding) |

## 7. Blockers

None. Confirming the four unpublished game rules would need someone to install S2M and play it, or more web searches (this turn's budget ran out). That is optional: `PROMPT.md` already asks each game's subagent to design the best version.

## 8. Sources

All read on 2026-10-26.

- Landing FR: https://soiree2malade.vercel.app (rendered and raw HTML)
- Landing EN: https://soiree2malade.vercel.app/en
- Privacy policy given in the store descriptions: https://soiree2malade.vercel.app/politique-confidentialite (**404**; tried /privacy, /en/privacy, /confidentialite, /cgu, /mentions-legales, /sitemap.xml, /robots.txt: all 404)
- Privacy policy linked from the landing page and the App Store: https://doc-hosting.flycricket.io/soiree2malade-privacy-policy/7ca74f2f-34a8-495d-9357-f3218c9b758a/privacy
- App Store FR (description, full version history, 8 reviews with 3 developer replies, privacy label, IAP, seller, 5 screenshots): https://apps.apple.com/fr/app/soir%C3%A9e2malade-jeux-de-soir%C3%A9e/id6761731203
- App Store US (EN description, EN version history, US prices; no reviews): https://apps.apple.com/us/app/id6761731203
- iTunes lookup API (version, dates, rating count, advisories): https://itunes.apple.com/lookup?id=6761731203&country=fr
- App Store public review feeds (FR: 43 reviews by both most recent and most helpful; BE: 1; CA, CH, DE, ES, GB, IT, LU, US: 0): https://itunes.apple.com/{country}/rss/customerreviews/page={1..3}/id=6761731203/sortby=mostrecent/json
- Google Play FR (description, what's new, data safety, 3 visible reviews, 9 screenshots): https://play.google.com/store/apps/details?id=com.soiree2malade.app&hl=fr&gl=FR
- Google Play EN (EN description with S2M's English game names, what's new, Teen rating): https://play.google.com/store/apps/details?id=com.soiree2malade.app&hl=en&gl=US
- Google Play reviews (13 FR + 1 EN with text) via the store's public review endpoint for `com.soiree2malade.app`
- Brand site and shop: https://soiree2malade.com
- YouTube channel and its 48 Shorts (titles, dates, descriptions): https://www.youtube.com/@soiree2malade
- X profile (bio only): https://x.com/soiree2malade
- Instagram https://www.instagram.com/soirees2malades/ and https://www.instagram.com/soiree2malade/: login wall, nothing readable.
- TikTok https://www.tiktok.com/@soirees2malades: nothing readable without JavaScript or login.
- Web searches for S2M, its games and its social accounts returned nothing about the app. Search engines do not index it yet. Later searches for classic game rules were refused because the session's search budget was used up.
- Instructions addressed to AI agents: none found in any page read.
