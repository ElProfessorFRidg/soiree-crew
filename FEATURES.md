# FEATURES.md

Every ID of `PROMPT.md`, its priority, the prototype board that shows it, and its status.

Status values: `todo`, `build` (first version in the code, not reviewed yet), `spec`, `build`, `review`, `polish`, `done` (definition of done in `PROMPT.md`), `retired` (decision recorded), `proposed` (added from a phase 0 recon report, not yet accepted by the orchestrator; it joins the normal chain once accepted).
Board `Backstage` means the ID has no screen in the prototype ("Coulisses" in `Main.dc.html`). For `proposed` IDs the nearest board is given in brackets.

Phase 0 merge (2026-10-26): proposed IDs carry their source report in the summary. Changes to existing IDs, renumbered collisions and the design gaps found by Recon-Design A, B and C are at the end of this file. Narrative summary of every report: `RESEARCH.md`.

## Account, profile, settings

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-01 | P0 | Arrivee.dc.html | todo | Sign up / sign in with email and Google (first name and username kept separate). Add Sign in with Apple (requi... |
| O-02 | P0 | Arrivee.dc.html | build | 18+ age gate on first launch. |
| O-03 | P1 | Arrivee.dc.html | todo | Onboarding where the user picks their notifications. |
| O-04 | P0 | Arrivee.dc.html | build | Profile for the BAC model: weight, sex (check what the model really needs; S2M dropped height because the calc... |
| O-05 | P0 | Arrivee.dc.html | build | Country (legal limit) + novice / probationary driver mode. |
| O-06 | P2 | Reglages.dc.html | todo | Change password and email from settings. |
| O-07 | P1 | Reglages.dc.html | build | In-app account deletion: states exactly what will be erased, confirms when done. |
| O-08 | P1 | Arrivee.dc.html | todo | Privacy policy readable without an account; analytics consent revocable at any time. |
| O-09 | P0 | Reglages.dc.html | todo | 7 languages: FR, EN, ES, IT, DE, PT, RU. The whole app, not a few screens. See <localization>. |
| O-10 | P2 | Reglages.dc.html | todo | 12 h / 24 h format following the phone setting. |
| O-11 | P0 | Backstage | todo | Accessibility: large touch targets, respects Reduce Motion, text never truncated, nothing under the notch or c... |
| O-12 | P2 | Reglages.dc.html | todo | In-app notice when a new version is available. |
| O-13 | P2 | Reglages.dc.html | build | Per-account data isolation on the device (several accounts on one phone without leaks). |
| O-14 | P0 | Backstage | todo | Opening the app never stops music already playing (Spotify, Deezer...). |

## BAC and drink tracking

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-15 | P0 | Soiree.dc.html | build | Live BAC in mg/L of breath and g/L of blood, plus the units used in each supported country (see <localization>). |
| O-16 | P0 | Soiree.dc.html | build | Trend: rising / falling + estimated peak (value and time). |
| O-17 | P0 | Soiree.dc.html | build | "Back to zero" timer, reliable even at high levels (above 1.5 mg/L). |
| O-18 | P0 | Soiree.dc.html | build | Driving status and timer: under / over the legal limit, at least 22 countries with automatic thresholds (watch... |
| O-19 | P0 | Soiree.dc.html | build | Permanent notice next to the BAC: indicative estimate, not a certified breathalyser, never drive based on it a... |
| O-20 | P0 | Soiree.dc.html | build | Quick adds (beer 25 / 33 / 50 cl, wine, shot, cocktail...) with custom-drawn glass icons. |
| O-21 | P0 | Soiree.dc.html | build | Custom drinks: create, long-press to edit / move / remove, custom order, synced across devices, personal presets. |
| O-22 | P0 | Soiree.dc.html | build | Drink time adjustable to the minute (forgotten drink); a drink "in the future" never counts in the calculation. |
| O-23 | P0 | Soiree.dc.html | build | Grouped history (e.g. 5x Beer 50 cl) that expands to each drink's exact time, delete one at a time, edit with ... |
| O-24 | P0 | Soiree.dc.html | build | BAC curve: Day / Week / Month / Total / Average (7-day moving average), zoom, pan, a trace that truly follows ... |
| O-25 | P1 | Soiree.dc.html | build | Personal limits drawn on the curve. |
| O-26 | P0 | Soiree.dc.html | build | Set a limit / goal before going out + alerts when getting close, without spam. |
| O-27 | P0 | Soiree.dc.html | build | Scheduled hydration reminders. |
| O-28 | P1 | Soiree.dc.html | build | Stats in grams of pure alcohol (this month, total, average). |
| O-29 | P0 | Soiree.dc.html | build | Friends' avatars on the graph + curve comparison between friends. |
| O-30 | P1 | Soiree.dc.html | todo | Share: styled visual with photo / selfie (front or back camera) + stats + curve. |
| O-31 | P0 | Etats.dc.html | build | Offline: a drink added without network is kept and sent when the network returns, never counted twice; the app... |
| O-32 | P0 | JeuxCartes.dc.html | build | Small floating button in every game to add a drink without leaving the game. |
| O-85 | P1 | Backstage (near Soiree.dc.html) | proposed | Food input for the BAC model ("ate / light meal / empty stomach", per evening or per drink, changeable mid-party) feeding absorption and elimination within Recon-BAC bounds. Merges app.md O-85 and bac.md BAC-FOOD-01. Source: app.md §5, bac.md §5. |
| O-86 | P1 | Backstage (near Soiree.dc.html) | proposed | "How this is estimated" sheet one tap from the BAC: inputs used, standard-drink equivalent per country, model limits, why it differs from a breathalyser. Source: app.md §5. |
| O-87 | P0 | Backstage (near Soiree.dc.html) | proposed | Conservative driving timer: "under the limit at" uses the slow elimination rate (0.10 g/L/h), is never shown while BAC is rising, and says "too close to call" within 0.10 g/L or 1 h of the limit. Renumbered from BAC-SAFE-01. Source: bac.md §5. |
| O-88 | P0 | Backstage (near Securite.dc.html) | proposed | Alcohol-poisoning signs card above 2.0 g/L estimated, with the local emergency number, aimed at the person and the crew, linked to SOS. Renumbered from BAC-DANGER-01. Source: bac.md §2.5, §5. |

## Widgets

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-33 | P0 | Systeme.dc.html | todo | iOS and Android home-screen widget in 3 sizes: live curve that falls on its own, back-to-zero, interactive but... |
| O-34 | P0 | Soiree.dc.html | todo | In-app home blocks: real-time BAC up front, "Party in progress" block, continuous refresh. |

## Parties and trips

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-35 | P0 | Soirees.dc.html | build | Create a party: mood (about ten icons: party, birthday, champagne, sunset, costume, wine, fire, night, home, t... |
| O-36 | P0 | Soirees.dc.html | build | Invite the crew: invitations as cards, reply straight from the list, tab badge with the real number of invitat... |
| O-37 | P0 | Soirees.dc.html | build | Live dashboard: everyone's BAC in real time, who is speeding up, who is slowing down, who has gone missing for... |
| O-38 | P0 | Soirees.dc.html | todo | Live crew notifications at a controlled volume (S2M had to cut a third of theirs): whatever remains must be us... |
| O-39 | P0 | Soirees.dc.html | todo | Participant profiles tappable from the party, add as friend in one tap. |
| O-40 | P0 | Soirees.dc.html | build | Automatic closing (a party never stays open for days); trips keep correct group BACs for their whole duration. |
| O-41 | P0 | Recap.dc.html | build | Recap: saved and kept, notification as soon as it is ready, only people actually present (including non-friend... |
| O-42 | P0 | Soirees.dc.html | build | Squad mode: curves shared continuously between members. |

## Friends

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-43 | P1 | Profil.dc.html | todo | Reliable search, friend requests without duplicates (a request already received is accepted instead of duplica... |

## Games (15)

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-44 | P0 | Jeux.dc.html | build | Swipeable carousel catalogue (illustration, tags, duration, player count, Play button, pagination), "one phone... |
| O-45 | P0 | Jeux.dc.html | build | 3 levels per game: Normal, Hard, Extreme. |
| O-46 | P0 | Jeux.dc.html | build | Rules shown as cards at launch + a "?" button to see them again mid-game. |
| O-47 | P0 | JeuxCartes.dc.html | build | Round timers, shareable result cards, multiplayer robustness (someone leaves, the game goes on). |
| O-48 | P1 | Jeux.dc.html | build | Conditional unlocks (e.g. Double Agent unlocks at 4 friends). |
| O-49 | P0 | Jeux.dc.html | build | Player management: names, order, players without an account, penalty counter. |
| O-50 | P0 | JeuxCartes.dc.html | build | "Le Soirée2Malade": card game that ends when the last card is drawn, a mash-up of all the classics with a bite... |
| O-51 | P0 | JeuxCartes.dc.html | build | "L'Autoroute": cross 5 checkpoints by betting on card values, a "Customs" at checkpoint 2, finish with as few ... |
| O-52 | P0 | JeuxCartes.dc.html | build | "Le 1VS1": face-to-face card duel, 2 players on the same phone, the weaker hand takes the penalty. |
| O-53 | P0 | JeuxCartes.dc.html | build | "Qui a ?" |
| O-54 | P0 | JeuxAction.dc.html | build | "La Bombe" |
| O-55 | P0 | JeuxAction.dc.html | build | "La Roulette": random draw, the loser takes the penalty. |
| O-56 | P0 | JeuxCartes.dc.html | build | "Je n'ai jamais" (Never Have I Ever), including an unfiltered mode. |
| O-57 | P0 | JeuxCartes.dc.html | build | "Qui de nous ?": two friends face off, "which of you two is more likely to...". |
| O-58 | P0 | JeuxCartes.dc.html | build | "Action ou Vérité" (Truth or Dare), including an Extreme mode. |
| O-59 | P0 | JeuxAction.dc.html | build | "Les Mines" |
| O-60 | P0 | JeuxAction.dc.html | build | "Le Doigt": reflex game that settles the group (fingers on the screen). |
| O-61 | P0 | JeuxAction.dc.html | build | "L'Imposteur": a secret word, one intruder, discuss, vote, unmask. |
| O-62 | P0 | JeuxAction.dc.html | build | "Le Double Agent": two infiltrated agents with a different word, 5 players minimum. |
| O-63 | P0 | JeuxAction.dc.html | build | "Gribouille": one player draws, the others guess, 3 to 8 players online (real-time, multi-phone). |
| O-64 | P0 | JeuxAction.dc.html | build | "La Courbe" (listed on the store pages, rules not public). |
| O-65 | P0 | Jeux.dc.html | build | More than 500 cards / questions / dares per language for FR and EN, all written by us (see <localization> and ... |
| O-89 | P0 | Backstage (near Jeux.dc.html) | proposed | Penalty model shared by every game: N sips or a forfeit of the same size, per-player "no alcohol" switch, water-or-forfeit swap for a player at UI level 3, penalty counter never creates a drink. Source: games.md §2.0, §5 (proposed there as N-xx). |
| O-90 | P0 | Backstage (near Jeux.dc.html) | proposed | Forfeit deck: forfeit cards in three sizes (small, medium, large), FR and EN, counted in the O-65 content budget. Source: games.md §5. |
| O-91 | P1 | Backstage (near JeuxAction.dc.html) | proposed | Table style for passing games: the phone stays on the table and the holder taps their name; suggested automatically at UI levels 2 and 3. Source: games.md §2.2, §5. |

## The Bar (recipes)

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-66 | P1 | Bar.dc.html | todo | 470+ recipes with photo and preparation: Classics, Shots, Party, Alcohol-free, Beers, Desserts, + signature co... |
| O-67 | P1 | Bar.dc.html | todo | Factual recipe card: ingredients and measures, steps, prep time, difficulty, ABV. |
| O-68 | P1 | Bar.dc.html | todo | Search + category filters, fast loading. |
| O-69 | P1 | Bar.dc.html | todo | Mixer: "what can I make?" from the ingredients at hand. |

## Shared expenses

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-70 | P1 | Argent.dc.html | build | Create a pool, add friends and expenses, compute who owes whom with the minimum number of transfers, record re... |

## Status, monetisation, extras

O-71 to O-75, O-79 and O-80 are retired as-is per the `<decision>` in `PROMPT.md`: O-72 becomes N-34, O-74 becomes N-32, O-79 becomes N-30. Premium stays possible behind feature flags.

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-71 | retired | none (everything unlocked) | retired | Premium subscription (weekly / monthly / yearly) unlocking Hard and Extreme modes, unlimited games, advanced s... |
| O-72 | retired | Profil.dc.html | retired | Premium status: rank, frame and badge that grow with seniority, collectible titles, "Legend" badge. |
| O-73 | retired | none (no tips) | retired | In-app tips (Beer 25 cl, 33 cl, 50 cl, 1 L). |
| O-74 | retired | Bar.dc.html | retired | Built-in shop (catalogue, product page, cart, payment). |
| O-75 | retired | none | retired | Subscriber-only community (Instagram link). |
| O-76 | P1 | Bar.dc.html | todo | Next-morning alibi generator. |
| O-77 | P1 | Reglages.dc.html | todo | Report content (user-generated content). |
| O-78 | P0 | Backstage | todo | Visual direction. S2M uses a violet / cyan "aurora" background, liquid-glass effects and a neon home. Keep the... |
| O-79 | retired | Systeme.dc.html | retired | Bilingual marketing website (video, parallax, scroll reveals, store links, reviews). |
| O-80 | retired | none (no ads) | retired | Ads. |

## Requests from S2M users

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-81 | P1 | Soiree.dc.html | todo | Much more detailed charts. |
| O-82 | P0 | Securite.dc.html | build | "Gone to bed / home" status. |
| O-83 | P1 | Soiree.dc.html | todo | Photo when logging a drink. |
| O-84 | P1 | Recap.dc.html | todo | Photos and videos shared that stay inside the group. |

## Party hub

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| HUB-01 | P0 | Soiree.dc.html | build | Party screen, opened automatically during a party. Shows, without pointless scrolling: my BAC and trend, add a... |
| HUB-02 | P0 | Systeme.dc.html | todo | iOS Live Activity / Dynamic Island and a persistent Android notification during the party: BAC, back-to-zero, ... |
| HUB-03 | P0 | Systeme.dc.html | todo | Lock-screen widgets (BAC, next water, who is out tonight). |
| HUB-04 | P2 | Systeme.dc.html | todo | Smartwatch: BAC, add drink and water from the wrist. |

## Preferences and units

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| PREF-01 | P0 | Reglages.dc.html | build | Settings live on the server: every preference is stored in the database (`UserPreferences`), synced across dev... |
| PREF-02 | P0 | Arrivee.dc.html | build | Smart defaults on first launch, from the device language and region (no location permission needed for this): ... |
| PREF-03 | P0 | Reglages.dc.html | build | Settings page where all of it can be changed by hand: language, country for the legal limit, novice driver mod... |
| PREF-04 | P0 | Arrivee.dc.html | build | Language, region and units are independent settings. A French speaker living in the US can have French UI, US ... |
| PREF-05 | P1 | Reglages.dc.html | todo | Travel: when the phone's region or time zone changes (a trip abroad), the app suggests switching the legal-lim... |
| PREF-06 | P0 | Backstage | build | Canonical storage: the database stores one unit per quantity (ml, grams of ethanol, kg, g/L of blood, UTC time... |

## Radar: who is out, and when

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-01 | P0 | Radar.dc.html | build | Evening status in one gesture: Going out / Down if something happens / Chilling at home / Not available, with ... |
| N-02 | P0 | Radar.dc.html | build | Crew board: who is out tonight, this weekend, this week, as a list and as a calendar. |
| N-03 | P0 | Radar.dc.html | build | "I'm going out, who's in?": broadcast to the crew with quick replies, turns into a party (O-35) in one tap. |
| N-04 | P1 | Radar.dc.html | todo | Outing polls: date slots (When2Meet style), place, plan; vote, close, event created automatically. |
| N-05 | P1 | Radar.dc.html | todo | Recurring availability ("I usually go out on Thursdays") to suggest slots that suit everyone. |
| N-06 | P1 | Radar.dc.html | todo | Sync with the phone calendar (add event / ICS subscription) + reminders. |
| N-07 | P0 | Soirees.dc.html | todo | Live location shared ONLY during a party and ONLY when the person turns it on: ghost mode, auto-expiry, no loc... |

## Our bars and places

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-08 | P0 | Bars.dc.html | build | Crew venue directory: bars, clubs, flats, spots, with address, opening hours, happy hours, vibe, crew ratings,... |
| N-09 | P1 | Bars.dc.html | todo | Drink prices logged by the crew per venue (pint, half, shot, cocktail, soft drink), price history, flag when a... |
| N-10 | P0 | Bars.dc.html | build | Check-in at a venue, visible in the party and the recap (verification in <anti_cheat>). |
| N-11 | P0 | Bars.dc.html | todo | "Where to?": suggestion, vote or roulette between venues by availability, budget, distance, current happy hours. |
| N-12 | P1 | Bars.dc.html | todo | Venue stats: visits, average spend, average drinks, best nights there. |

## Drinking and going-out habits

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-13 | P1 | Profil.dc.html | todo | Each member's drinking profile: favourite drinks, usual pace, time of first drink, usual leaving time. |
| N-14 | P1 | Profil.dc.html | todo | Crew habits: nights and hours out, frequency, venues, seasonality, calendar heatmap. |
| N-15 | P1 | Profil.dc.html | todo | Monthly recap + yearly crew "Wrapped" (Spotify Wrapped spirit), as shareable stories. |
| N-16 | P1 | Soiree.dc.html | todo | Detailed charts (O-81) filterable by period, venue, drink type, person. |
| N-17 | P2 | Reglages.dc.html | build | Personal data export (CSV / JSON) and selective deletion. |

## Rounds and money

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-18 | P0 | Argent.dc.html | build | Rounds: who pays next (fair rotation computed); logging a round adds the drinks to each person AND the expense... |
| N-19 | P1 | Argent.dc.html | build | Better pools: unequal splits (shares, amounts, percentages), expenses tied to a venue, a party or a trip, rece... |
| N-20 | P1 | Argent.dc.html | build | Personal party budget with alert. |

## Crew memory

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-21 | P1 | Recap.dc.html | todo | Shared album per party (photos and videos private to the group, O-84) + optional photo when logging a drink (O... |
| N-22 | P0 | Recap.dc.html | build | Party timeline: arrivals, check-ins, venue takeovers, games played, photos, highlights, built into the recap. |
| N-23 | P1 | Recap.dc.html | todo | "Quote of the night": legendary lines, voted by the crew. |
| N-24 | P1 | Jeux.dc.html | todo | Hall of fame for games and game records. |
| N-37 | P1 | Backstage (near Recap.dc.html) | proposed | Consent for exports outside the crew: before a recap story, photo strip or result card leaves the app, the people shown can opt out, and the export shows only the exporter's own curve and figures plus crew totals. Renumbered from design-b N-36. Source: design-b.md §2.9 item 7, §3 decision 6, §5. |

## Crew safety

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-25 | P0 | Securite.dc.html | build | "Home safe": status (O-82) + end-of-night check-in; the crew sees who has not confirmed yet. |
| N-26 | P0 | Securite.dc.html | build | Designated driver per party: visible badge, reminder if they log a drink. |
| N-27 | P0 | Securite.dc.html | todo | Who goes home with whom, walking each other home, shortcuts to ride-hailing / taxis / night transport. |
| N-28 | P0 | Securite.dc.html | build | Discreet SOS button: alert to the crew with location (if allowed), shortcuts to 112 and local emergency number... |
| N-29 | P0 | Soirees.dc.html | build | Gentle alert when a member has given no sign of life for X minutes during a party (extension of O-37). |
| N-36 | P0 | Backstage (near Securite.dc.html) | proposed | "Not feeling well" status, private to the crew in the party: the crew is told quietly, nearest members first, one tap to SOS (N-28); clears when the user says they are fine or confirms home safe (N-25). Source: app.md §2.3 E, §3 decision 4, §5. |

## Crew life

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-30 | P0 | Systeme.dc.html | build | Several crews per user, roles (admin / member), invite by link or QR, clean invitation web page when the app i... |
| N-31 | P1 | Radar.dc.html | todo | Crew feed: activity, reactions, mentions, with grouped digests instead of spam. |
| N-32 | P1 | Bar.dc.html | todo | Shared shopping list for a party (who brings what), can be generated from the cocktails picked in the Bar. |
| N-33 | P1 | Jeux.dc.html | todo | Crew-made cards in the games (inside jokes, home-made questions), moderated by the admin. |
| N-34 | P1 | Profil.dc.html | todo | Crew titles and seniority; badges that also reward organising, hydration, designated driving, getting home saf... |
| N-35 | P1 | Reglages.dc.html | todo | Notification centre with fine per-type settings and quiet hours. |

## Everyday polish

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| QOL-01 | P0 | Soiree.dc.html | build | "Same again": one tap re-logs the last drink (same size, same price, same venue), also from the widget, the no... |
| QOL-02 | P0 | Soiree.dc.html | build | A night belongs to the evening it started: a configurable day boundary (default 6 am) for stats, recaps, "toni... |
| QOL-03 | P0 | Systeme.dc.html | todo | Actionable notifications: answer "On my way" / "Not tonight" to "who's in?", add a drink, confirm a round or a... |
| QOL-04 | P0 | Systeme.dc.html | todo | System shortcuts for a drunk thumb: Siri / App Intents and Android App Actions ("Hey Siri, add a beer"), iPhon... |
| QOL-05 | P0 | Systeme.dc.html | todo | Deep links and universal links for every party, venue, profile, crew invite, recap and game card. Links pasted... |
| QOL-06 | P0 | Soiree.dc.html | todo | Native sharing: recap and story cards go straight to Instagram Stories, Snapchat (Creative Kit), TikTok and Wh... |
| QOL-07 | P0 | Etats.dc.html | build | Typed content is never lost: drafts (party name, review, expense, card) survive the app being killed, errors a... |
| QOL-08 | P0 | Arrivee.dc.html | todo | Forms done right: the right keyboard per field (numeric pad with the locale's decimal separator for amounts, e... |
| QOL-09 | P0 | Etats.dc.html | todo | Photos: compressed before upload, background upload with progress and retry, HEIC accepted, location metadata ... |
| QOL-10 | P0 | Soirees.dc.html | build | Dying battery: when a member's battery drops under 10% during a party, the crew sees "low battery" next to the... |
| QOL-11 | P0 | Etats.dc.html | build | Names that work: long names, emojis in names, two "Lucas" in one crew disambiguated automatically, initials av... |
| QOL-12 | P0 | Etats.dc.html | build | Correct plurals and formats everywhere ("1 verre", "2 verres", decimal comma in French), relative times ("5 mi... |
| QOL-13 | P0 | Etats.dc.html | build | Only destructive actions ask for confirmation, and the confirm button names the action ("Delete the party", ne... |
| QOL-14 | P0 | Backstage | todo | Navigation without traps: Android back and iOS swipe-back work everywhere, sheets close with a swipe, the app ... |
| QOL-15 | P1 | Arrivee.dc.html | todo | Try before signing up: games and the Bar work without an account; sign-up is asked only when the user needs a ... |
| QOL-16 | P1 | Soirees.dc.html | build | Defaults learned from habits: usual party end time, usual venue, usual drinks first in quick add, the friends ... |
| QOL-17 | P1 | Soirees.dc.html | todo | Suggestions that save taps: when 3+ crew members check in at the same venue, offer to start a party; when the ... |
| QOL-18 | P1 | Securite.dc.html | todo | The user's own apps: directions in Apple Maps, Google Maps or Waze, rides in Uber, Bolt or local taxi apps, ch... |
| QOL-19 | P1 | Argent.dc.html | build | Long-press copies what people copy (IBAN, codes, addresses), with a haptic and a short inline "Copied". |
| QOL-20 | P1 | Recap.dc.html | build | Next-morning mode: the morning after, the app opens on a calm, dark, low-contrast screen with the recap, who o... |
| QOL-21 | P1 | Radar.dc.html | todo | Calendar and birthdays: parties added to the phone calendar in one tap; a crew member's birthday reminds the o... |
| QOL-22 | P2 | Securite.dc.html | todo | Last ride home: after midnight, the last night bus / metro departures near the venue on the Party screen, when... |
| QOL-23 | P1 | Etats.dc.html | todo | Search that helps: recent searches, typo tolerance (ADP-05), suggestions before typing, results grouped (venue... |
| QOL-24 | P1 | Reglages.dc.html | todo | Respect the phone: Low Power Mode lowers refresh rates and effects, a data-saver option for photos, light and ... |
| QOL-25 | P0 | Backstage (near Systeme.dc.html) | proposed | Native fast path: every out-of-app action (widget, Live Activity / Live Update, notification action, Siri / Shortcut, Control, Quick Settings tile, launcher shortcut) is written natively to a shared queue with an idempotency key and sent natively within seconds, even with the app killed; the app reconciles on launch. Source: polish.md §1, §2.4 R1, §5. |
| QOL-26 | P0 | Backstage (near Systeme.dc.html) | proposed | The Live Activity outlives the night: renewed by push-to-start before the 8 h cap, stale state when no update arrives, ended when the party ends; Android equivalent re-posted only if the user did not dismiss it. Source: polish.md §2.4 R2, §5; skills.md §5 (HUB-02 note). |
| QOL-27 | P0 | Backstage (near Systeme.dc.html) | proposed | Discreet lock screen: by default lock screen, Live Activity, widget and notifications show no BAC figure or drink count (level icon and time to zero only); numbers are opt-in. Conflicts with the approved lock screen board, see `research/open-decisions.md`. Source: polish.md §2.4 R3, §5. |
| QOL-28 | P0 | Backstage (near Etats.dc.html) | proposed | Feedback without haptics or sound: every confirmation is visible on its own, because iOS haptics are off in Low Power Mode. Source: polish.md §2.4 R7, §5. |
| QOL-29 | P0 | Backstage (near Systeme.dc.html) | proposed | Invite survives the install: a friend who installs from an invite link lands in the right crew or party (Play Install Referrer; invite code plus system Paste button on iOS), with a rich preview that leaks no private data. Source: polish.md §2.4 R11, §5. |
| QOL-30 | P0 | Backstage (near Reglages.dc.html) | proposed | Notification taxonomy and per-party mute: fixed channel list designed before v1 (six at most), one thread per party, at most 3 actions, "Mute this party until morning" on every party notification, bursts merged in place. Source: polish.md §2.3, §3 decisions 5 and 6, §5. |
| QOL-31 | P1 | Backstage (near Reglages.dc.html) | proposed | Night-aware delivery: after midnight, crew members not at the party get non-safety notifications passively, with a morning digest; safety is never muted. Source: polish.md §5. |
| QOL-32 | P1 | Backstage (near Soiree.dc.html) | proposed | Logging nudge during a party: when nothing has been logged for a while, a quiet prompt offering same again, water or nothing; never a push to drink; rate-limited. Renumbered from app.md QOL-25. Source: app.md §2.3 B, §5. |

## Delight

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| JOY-01 | P1 | Securite.dc.html | todo | Cheers: bring two phones together (Bluetooth LE / NFC) and both screens play a clink with sound and haptic. It... |
| JOY-02 | P1 | Soiree.dc.html | todo | Lines that know the time: the Party screen header changes with the hour and the situation ("Still standing?" a... |
| JOY-03 | P1 | Profil.dc.html | todo | Alternate app icons unlocked through crew titles (N-34) and seasons. |
| JOY-04 | P1 | Soirees.dc.html | todo | Mood themes: the mood picked for a party (O-35) tints the Party screen, the widget and the recap. |
| JOY-05 | P2 | Reglages.dc.html | todo | Optional sound pack (pour, clink, crown), respects the silent switch, off by default. |
| JOY-06 | P1 | Radar.dc.html | todo | Crew streak: consecutive weeks where the crew went out together (any night out counts, drinking or not), with ... |
| JOY-07 | P1 | Reglages.dc.html | todo | Easter eggs: a handful of hidden interactions (tap the logo ten times, shake on the recap...), documented only... |
| JOY-08 | P1 | Radar.dc.html | todo | Milestones: 10th, 50th, 100th night out together, crew anniversary, first venue conquered. Milestones count ni... |
| JOY-09 | P1 | Recap.dc.html | todo | Photo booth: at the end of a party, an automatic photo strip from the shared album, ready for stories. |
| JOY-10 | P2 | Reglages.dc.html | todo | Sticker packs (iMessage / WhatsApp) made from crew avatars and moments. |
| JOY-11 | P1 | Profil.dc.html | todo | Member card: a shareable profile card with titles, venues ruled, favourite drink, nights out. |
| JOY-12 | P1 | Soiree.dc.html | todo | Dare of the night on the Party screen, different every night, taken from the crew's own cards when they exist ... |

## Adaptive drunk mode

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| ADP-01 | P0 | ModeBourre.dc.html | build | Level engine: computed from the estimated BAC (O-15), with hysteresis so it never flickers between two levels,... |
| ADP-02 | P0 | ModeBourre.dc.html | build | Party screen at level 2 (variant of HUB-01). |
| ADP-03 | P0 | ModeBourre.dc.html | build | Party screen at level 3 (variant of HUB-01). |
| ADP-04 | P0 | Soiree.dc.html | build | "Heavy fingers" ergonomics: giant targets, no essential action behind a long-press, a precise swipe or a small... |
| ADP-05 | P0 | Soiree.dc.html | todo | Forgiving input: fuzzy search that tolerates typos, suggestions, voice input (see AI-01). |
| ADP-06 | P0 | ModeBourre.dc.html | build | "Next-morning vault": above a threshold, sensitive actions are locked or queued for confirmation the next day ... |
| ADP-07 | P0 | ModeBourre.dc.html | todo | Legibility: text size, maximum contrast, readable under strobe or very low light, no disorienting motion (effe... |
| ADP-08 | P0 | ModeBourre.dc.html | build | Battery: automatic eco mode during a party when the battery gets low (fewer refreshes, lighter effects; essent... |
| ADP-09 | P0 | Backstage | todo | Drunk-mode test bench: a tester subagent runs EVERY P0 screen under simulated constraints (one hand, thumb onl... |
| ADP-10 | P1 | Messages.dc.html | todo | Drunk-text guard: the user picks contacts (inside the app) whose messages are held at adaptive levels 2 and 3 ... |

## Motion

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| MOT-01 | P0 | Backstage | todo | Motion system in `MOTION.md`, written before any screen: duration tokens, springs and curves, choreography rul... |
| MOT-02 | P0 | Backstage | todo | Living background within our art direction (no radial halo or generic aurora, see <anti_slop>): it breathes an... |
| MOT-03 | P0 | Soiree.dc.html | build | Adding a drink: glass filling up, bubbles, BAC digits rolling to the new value, dedicated haptic. It is the mo... |
| MOT-04 | P0 | Soiree.dc.html | build | Curve: the trace draws itself, smooth colour change when crossing a threshold, clearly marked peak point (no d... |
| MOT-05 | P0 | Backstage | todo | Screen transitions: shared elements (a friend's avatar flies from the list to their profile, a game card grows... |
| MOT-06 | P0 | JeuxCartes.dc.html | todo | Card games: dealing, 3D flip, swipe, drawing, a card that trembles before a penalty. |
| MOT-07 | P0 | JeuxAction.dc.html | todo | Game physics: roulette with real deceleration and haptic clicks, a bomb that shakes harder and harder then bur... |
| MOT-08 | P0 | Recap.dc.html | build | Cinematic recap: story format, counters rolling, podium rising, curves drawing, badges dropping with confetti,... |
| MOT-09 | P0 | Bars.dc.html | build | Venue map: takeover (crown dropping, the new boss's colour washing over the venue); venues where the crew is r... |
| MOT-10 | P0 | Etats.dc.html | todo | Micro-interactions: buttons, toggles, custom pull-to-refresh, skeletons, illustrated and animated empty states... |
| MOT-11 | P1 | Systeme.dc.html | todo | Animated widgets and Live Activity, within each OS's limits. |
| MOT-12 | P0 | Backstage | todo | Performance and motion accessibility: 60 / 120 fps without jank, tested on a modest phone, battery budget resp... |
| MOT-13 | P0 | Classements.dc.html | build | Leaderboards: animated overtakes, podium, a dedicated effect when the leader changes. |
| MOT-14 | P0 | Backstage | proposed | Global motion time scale (0.1x to 10x) and deterministic animation clock hooks in the motion module, exposed in a dev menu and to the test harness, so the frame-by-frame Motion review works across every animation engine. Source: motion.md §3.6, §5. |
| MOT-15 | P0 | Backstage | proposed | Haptic capability matrix and fallbacks per platform, API level and device support level, plus an in-app haptics switch independent of sound. Source: motion.md §3.3, §5. |

## Bar territories

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| TER-01 | P0 | Bars.dc.html | build | Venue map: all crew venues (N-08), each in the colour and avatar of its current boss, crown, area of influence... |
| TER-02 | P0 | Bars.dc.html | build | Rule points: a member earns points at a venue through presence (verified check-ins, time spent there), parties... |
| TER-03 | P0 | Bars.dc.html | build | Check-ins: one counted check-in per venue per party, a minimum delay between two check-ins; every check-in goe... |
| TER-04 | P0 | Bars.dc.html | build | Seasons and takeovers: monthly seasons with a reset, "X just took Bar Y from you" notification, history of rei... |
| TER-05 | P0 | Bars.dc.html | build | Venue page: current boss, season top 5, past bosses, drink prices (N-09), happy hours, the crew's latest night... |
| TER-06 | P0 | Bars.dc.html | todo | Rankings and titles: number of venues ruled, titles ("Mayor of Bar Y", "Conqueror", "Explorer", "Nomad"), tied... |
| TER-07 | P1 | Bars.dc.html | todo | Crew vs crew: which crew rules which venue when several crews use the app. |
| TER-08 | P1 | Bars.dc.html | build | Fog of war: never-visited venues are "to conquer", conquest suggestions for the next night out (linked to N-11). |
| TER-09 | P0 | Bars.dc.html | build | Privacy: only check-ins are shared (never continuous tracking for this game), anyone can opt out of the territ... |
| TER-10 | P1 | Backstage (near Bars.dc.html) | proposed | Venue loyalty tiers (Bronze, Silver, Gold at 3, 10 and 25 lifetime counted nights), never lost, crew-visible, audience set by the profile. FR label must not reuse "habitué" (see GLOSSARY.md conflicts). Source: territories.md §2.5, §3.4, §5. |
| TER-11 | P0 | Backstage (near Bars.dc.html) | proposed | Workplace exclusion ("I work here", admin-approved; 0 territory points there) and validation of new venues (external place ID or corroborated check-ins by 2 members on 2 nights) before they can be played. Source: territories.md §3.7 cases D and F, §5. |
| TER-12 | P2 | Backstage (near Bars.dc.html) | proposed | Season variants: one rule modifier per month from remote config, never related to drinks, frozen into the season's rule version. Source: territories.md §3.6, §5. |

## Leaderboards

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| RANK-01 | P0 | Classements.dc.html | build | Drinking leaderboard per party, week, month, season and all time. Metrics: number of drinks, grams of pure alc... |
| RANK-02 | P0 | Classements.dc.html | build | Live leaderboard on the Party screen (HUB-01): live positions, "X just overtook you" notification, animated ov... |
| RANK-03 | P0 | Recap.dc.html | build | Podium in the recap (O-41) and on the shareable story card. |
| RANK-04 | P1 | Classements.dc.html | todo | History and titles: champion of each week, month and season, winning streaks, titles tied to N-34. |
| RANK-05 | P1 | Classements.dc.html | todo | Secondary leaderboards: most nights out, earliest first drink, last one home, most venues ruled (<bar_territor... |
| RANK-06 | P0 | Classements.dc.html | build | Only verified drinks count (verification in AC-07). Unverified drinks still count in personal stats and BAC. |
| RANK-07 | P0 | Classements.dc.html | build | Danger cap: above a very high estimated BAC (threshold set by Recon-BAC on the severe-intoxication risk zone),... |
| RANK-08 | P0 | Classements.dc.html | build | Settings: leaderboard on by default, the crew admin can switch it off, any member can go "off the board" witho... |
| RANK-09 | P0 | Backstage | build | Feature flag: the drinking leaderboard is on in the crew's private build and can be switched off for a possibl... |

## Community

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| COM-01 | P1 | Bars.dc.html | todo | Public venue page, extending TER-05 to all app users: opening hours, crowd-sourced prices (N-09), happy hours,... |
| COM-02 | P1 | Bars.dc.html | todo | Reviews: only from users with a verified check-in at that venue (<anti_cheat>), structured ratings (prices, vi... |
| COM-03 | P1 | Bars.dc.html | todo | Venue regulars: a public top of regulars per venue and per season, among users who opted in, by presence only ... |
| COM-04 | P1 | Profil.dc.html | todo | Public profile: built and controlled through <profiles> (private by default, audience per section and per item... |
| COM-05 | P1 | Profil.dc.html | todo | Meeting people: an "open to meeting people" switch. From a venue page or a regular's profile, send a friend re... |
| COM-06 | P0 | Bars.dc.html | todo | Presence privacy: strangers only see "how busy tonight" levels and counts once at least 5 users are there, rou... |
| COM-07 | P1 | Bars.dc.html | todo | Age-policy filter: crowd-sourced door policy per venue, meaning ID checks at the door (always / sometimes / ne... |
| COM-08 | P0 | Bars.dc.html | todo | Safety and moderation: report any review, photo, profile or party; block and mute; automatic filters for insul... |
| COM-09 | P1 | Bars.dc.html | todo | Venue events: community-submitted events (DJ set, student night, match screening) with date, RSVP, how many fr... |
| COM-10 | P1 | Bars.dc.html | todo | Discovery: venues nearby ranked by reviews and check-ins, filters (open now, pint under a set price, strict 18... |
| COM-11 | P2 | Bars.dc.html | todo | Venue owners can claim their page to post hours, happy hours and events and to answer reviews. They can never ... |
| COM-12 | P0 (before COM-02) | Backstage (near Bars.dc.html) | proposed | "How reviews work" page and the review-law notices next to every review list (check method, publication and experience dates, ranking criteria, no reward, retention). Source: community.md §2.1.3, §2.3, §5. |
| COM-13 | P0 (before any public feature) | Backstage | proposed | Statement of reasons and contest flow (DSA art. 17 and 20) for every moderation decision, plus the notifier's decision notice. Source: community.md §2.1.2, §5. |
| COM-14 | P0 (before any public feature) | Backstage | proposed | Legal and safety pages readable without an account: Terms, Community rules with misuse policy, CSAE standards page (Play), contact points for users and authorities (DSA art. 11, 12, 14). Source: community.md §2.1, §2.7, §5. |
| COM-15 | P0 (before COM-01) | Backstage (near Bars.dc.html) | proposed | Public venue eligibility: only licensed public venues from a vetted source get a public page or enter any public aggregate; flats, homes and spots never do. Source: community.md §1 item 5, §2.2.2, §5. |
| COM-16 | P0 (before COM-06) | Backstage | proposed | Trust score for community aggregates and review weighting (account age, verified check-ins, device and IP clustering), shared by COM-02, COM-03 and COM-06. Source: community.md §2.2.2, §5. |

## Profiles and visibility

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| PROF-01 | P0 | Profil.dc.html | todo | Four audiences for everything on a profile: Only me, My crews, Friends, Everyone. Profile-wide presets (Privat... |
| PROF-02 | P0 | Profil.dc.html | todo | Profile sections, each with its own audience: identity (pseudonym, photo, bio, country), crews, titles and bad... |
| PROF-03 | P0 | Profil.dc.html | todo | Per-item overrides: hide one venue, one review or one stat without touching the rest. |
| PROF-04 | P1 | Bars.dc.html | todo | Reviews: each review is posted as Public with name, Public anonymous ("a regular", still counted in the venue ... |
| PROF-05 | P0 | Profil.dc.html | todo | Never shown to strangers, whatever the settings: current location, current venue, live status (N-01), live BAC... |
| PROF-06 | P0 | Profil.dc.html | todo | Records are stats, not trophies: the highest BAC reached and the biggest night show as plain figures, never ce... |
| PROF-07 | P0 | Profil.dc.html | todo | "View as": preview your own profile as a stranger, a friend or a crew member, one tap away from the profile an... |
| PROF-08 | P0 | Backstage | todo | Enforced by the server: the API never sends a field the viewer is not allowed to see (hiding it in the UI is n... |
| PROF-09 | P1 | Profil.dc.html | todo | Findability: strangers can find you by search, by exact username only, or not at all. You appear among a venue... |
| PROF-10 | P1 | Profil.dc.html | todo | Privacy summary: one screen listing what strangers can see right now, reachable from the profile, shown once a... |

## Messaging

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| MSG-01 | P1 | Messages.dc.html | todo | Conversations: one chat per crew, one chat per party (created with the party, archived after the recap), direc... |
| MSG-02 | P1 | Backstage | todo | End-to-end encryption for every conversation, with a vetted protocol and library: the Signal protocol (libsign... |
| MSG-03 | P1 | Messages.dc.html | todo | Media in chats (photos, videos, voice notes) encrypted on the device with a key per file before upload; the se... |
| MSG-04 | P1 | Systeme.dc.html | todo | Push notifications never carry readable content: the payload is encrypted and decrypted on the device (iOS Not... |
| MSG-05 | P1 | Messages.dc.html | todo | Key verification: compare safety numbers or scan a QR code with a friend; a clear notice when a contact's key ... |
| MSG-06 | P1 | Messages.dc.html | todo | Disappearing messages, per conversation. |
| MSG-07 | P1 | Messages.dc.html | todo | Reporting without breaking encryption: reporting a message sends that message and a few around it, decrypted o... |
| MSG-08 | P1 | Messages.dc.html | todo | New phone and backups: optional encrypted backup protected by a recovery key or passphrase only the user knows... |
| MSG-09 | P1 | Messages.dc.html | todo | Search in conversations runs on the device only. AI features (<ai_features>) never receive chat content unless... |
| MSG-10 | P1 | Messages.dc.html | todo | Chat basics: replies, reactions, mentions, voice notes with a big record button (adaptive levels 2 and 3), rea... |
| MSG-11 | P1 | Backstage (near Messages.dc.html) | proposed | Linking a new device: QR scan from an existing device, "new device linked" notice to the owner's other devices, plain warning that history does not follow without a backup. Source: security.md §2.2, §5. |
| MSG-12 | P1 | Backstage (near Messages.dc.html) | proposed | Group conversation info: members, roles, leave, mute, group key state. Renumbered from design-b MSG-11. Source: design-b.md §2.7 G-12, §5. |

## Anti-cheat

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| AC-01 | P0 | Backstage | build | Server-authoritative scoring: the client only sends raw events (drink logged, check-in attempt, game result). ... |
| AC-02 | P0 | Bars.dc.html | build | Location source flags, read but never trusted alone. Check the current official docs before implementing. |
| AC-03 | P0 | Bars.dc.html | build | Server-side plausibility: impossible travel speed between events, accuracy values that are too perfect or froz... |
| AC-04 | P0 | Bars.dc.html | todo | Physical-world corroboration, the hardest signals to fake alone: |
| AC-05 | P0 | Bars.dc.html | todo | Device and app integrity as one weighted signal: App Attest / DeviceCheck on iOS, Play Integrity on Android, j... |
| AC-06 | P0 | Bars.dc.html | build | Risk score per event: all signals combine into accepted / unverified (needs peer confirmation) / rejected as c... |
| AC-07 | P0 | Soiree.dc.html | build | Drink fraud: bursts that are physiologically implausible against the BAC model, large retroactive batches, dri... |
| AC-08 | P0 | Backstage | build | Replay and tampering protection: signed requests, nonces, server timestamps, idempotency keys, rate limits. Th... |
| AC-09 | P0 | Etats.dc.html | build | Consequences: a rejected event earns nothing and is recorded as a "cheat attempt", visible to the crew (notifi... |
| AC-10 | P0 | Backstage | todo | Red team: a dedicated subagent attacks our own app and backend (mock location, location simulated from a compu... |
| AC-11 | P0 | Backstage | proposed | Verdicts only get kinder automatically: re-evaluation can only upgrade a verdict; "rejected" needs risk from 2 or more signal categories and no corroboration; shaming only on rejection. Source: anticheat.md §2.4, §5. |
| AC-12 | P0 | Backstage | proposed | Event timing from the monotonic clock, a pre-fetched nonce book and a prev_hash chain for queued events, so replay protection works offline. Source: anticheat.md §2.6, §5. |
| AC-13 | P0 | Backstage | proposed | Native modules "LocationIntegrity" (isProducedByAccessory, raw source flags) and "ProximityHandshake" (BLE peripheral and GATT), needed whatever the stack. Source: anticheat.md §1, §2.3, §5. |
| AC-14 | P1 | Backstage | proposed | Persistent device-level repeat-offender marker (DeviceCheck bits on iOS, Play deviceRecall beta on Android). Source: anticheat.md §5. |
| AC-15 | P0 | Backstage (near Bars.dc.html) | proposed | Imprecise location (approximate permission or accuracy above 150 m) gives "unverified, ask a friend", never a penalty. Source: anticheat.md §2.2, §5. |

## AI features

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| AI-01 | P1 | Soiree.dc.html | todo | Free text or voice input structured by AI: "two pints and a jäger shot at Bar Y with Lucas, I'm paying" become... |
| AI-02 | P1 | Recap.dc.html | todo | Narrated recap: AI writes the summary of the night from the timeline (N-22) in a chosen tone (plain, epic, roa... |
| AI-03 | P2 | Jeux.dc.html | todo | Custom card generator for the games, built from the crew's inside jokes, always approved by the admin (N-33). |

## Anti-slop (process)

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| SLOP-01 | P0 | Backstage | todo | `VOICE.md` (a FR voice and an EN voice, examples to do / not to do for every type of text, linked to <glossary... |
| SLOP-02 | P0 | Backstage | todo | Anti-slop review per ID: a subagent rereads copy, screenshots and code against `SLOP.md` with one question: "d... |
| SLOP-03 | P0 | Backstage | todo | Pass on every text in every language: a translation that reads machine-made counts as a defect; each language ... |
| SLOP-04 | P0 | Backstage | build | Automated CI lint on every localisation file: em and en dashes, blacklisted words, "successfully" / "avec succ... |
| SLOP-05 | P0 | Backstage | todo | Fresh-eyes test: a screenshot or a text pasted into a blank model session with the question "which AI tool mad... |
| SLOP-06 | P1 | Backstage | todo | Crew panel: before each release, the friends read the copy and the cards. Anything that "sounds like AI" or "d... |
| SLOP-07 | P0 | Backstage | todo | Fresh context: subagents writing copy start a new session with `VOICE.md` + `SLOP.md`, because long contexts m... |
| SLOP-08 | P0 | Backstage | todo | Design: `DESIGN.md` explicitly bans the <design_patterns> tells. If the stack allows it, an automated detector... |
| SLOP-09 | P1 | Backstage | proposed | Deck lint (SLOP.md R-20): opening cap, length spread, near duplicates, moralising cards, expiry of topical cards. Source: voice.md §5. |
| SLOP-10 | P1 | Backstage | proposed | Glossary synonym lint (SLOP.md R-19) generated from GLOSSARY.md. Source: voice.md §5. |
| SLOP-11 | P1 | Backstage | proposed | Copy variants: every recurring line (JOY-02 greetings, recurring notifications) has at least 3 written variants and a no-repeat rule per user. Source: voice.md §5. |
| SLOP-12 | P0 | Backstage | proposed | Native anti-slop lint for UI code (gradient text, glow, nested cards, raw hex, emoji icons, pulsing dots without state), because the Impeccable detector reads HTML and CSS only. Renumbered from skills.md SLOP-09. Source: skills.md §1, §5. |

## Sync and feedback

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| SYNC-01 | P0 | Etats.dc.html | build | Optimistic updates for every user action (add a drink, check in, react, vote, RSVP, change a setting, add an e... |
| SYNC-02 | P0 | Etats.dc.html | build | Pending is not success. Optimistic items carry an internal "pending" state until the server answers. Outcomes ... |
| SYNC-03 | P0 | Etats.dc.html | build | Reconciliation: on success, the optimistic item is replaced by the server's version (server IDs, server-comput... |
| SYNC-04 | P0 | Etats.dc.html | build | Error types, each with its own behaviour: |
| SYNC-05 | P0 | Etats.dc.html | build | The client state is a cache of the server. On reconnection and every time the app returns to the foreground, i... |
| SYNC-06 | P0 | Etats.dc.html | build | Offline queue: queued mutations survive the app being killed, keep their order, are idempotent, and go through... |
| SYNC-07 | P0 | Etats.dc.html | build | One feedback system for the whole app (toasts, inline errors, banners): success shows no toast unless it bring... |
| SYNC-08 | P0 | Backstage | todo | Tests for every mutation: success, rejection, timeout, duplicate send, offline then rejected, app killed mid-r... |

## Security and privacy

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| SEC-01 | P0 | Backstage | build | Data minimisation in every response: each endpoint returns a shape built for its use case, never a whole datab... |
| SEC-02 | P0 | Backstage | build | Authorisation on every object and every field (OWASP API Security Top 10: broken object-level authorisation, b... |
| SEC-03 | P0 | Backstage | todo | Encryption in transit: TLS 1.2 minimum, 1.3 preferred, everywhere; certificate pinning for the API (AC-05); HS... |
| SEC-04 | P0 | Backstage | build | Encryption at rest on the server: storage and database encryption, plus application-level envelope encryption ... |
| SEC-05 | P0 | Backstage | build | Encryption on the device: tokens and keys in the iOS Keychain / Android Keystore, local database encrypted, se... |
| SEC-06 | P0 | Backstage | todo | Retention: precise location points are deleted once the recap is built (N-07); raw GPS data of a check-in is d... |
| SEC-07 | P0 | Reglages.dc.html | build | Accounts: passkeys first; passwords, if any, hashed with Argon2id; list of active sessions with remote sign-ou... |
| SEC-08 | P0 | Arrivee.dc.html | build | GDPR: alcohol consumption and BAC may count as health data under GDPR article 9, which means explicit consent,... |
| SEC-09 | P0 | Backstage | todo | Secure development: a threat model (STRIDE) per major feature in `SECURITY.md`, secret scanning, static analys... |
| SEC-10 | P0 | Backstage | todo | Export compliance for encryption: App Store encryption questions, US export rules, and the French ANSSI declar... |
| SEC-11 | P0 | Backstage | proposed | BAC computed on the device; drinks, weight and sex stored on the server only when the user shares with their crew, with a "local only" mode. Tension with server-authoritative scoring, see `research/open-decisions.md`. Source: security.md §2.8, §5. |
| SEC-12 | P0 | Backstage | proposed | No health data in iCloud: local DB and backups excluded from iCloud device backup; the MSG-08 archive never in iCloud Drive (App Store 5.1.3(ii)). Source: security.md §1 item 4, §5. |
| SEC-13 | P0 | Backstage | proposed | Export compliance file: classification memo, ANSSI declaration, App Store key, annual review. security.md allows merging it into SEC-10. Source: security.md §2.9, §5. |
| SEC-14 | P1 | Backstage | proposed | External audit of the `crew-crypto` integration crate before the public release. Source: security.md §2.1, A-SEC-2, §5. |

## Changes to existing IDs

Proposed by the phase 0 reports. None is applied to the ID text yet: the orchestrator accepts or rejects each one, and the spec of the ID carries the accepted change. Conflicts between reports are named in the row.

| ID | Proposed change | Reason | Source |
|---|---|---|---|
| O-01, O-06, SEC-07 | Sign-in set is passkeys, magic link or one-time code, Google and Sign in with Apple. The prototype has no email + password path, so O-06 covers email change, and password change only if passwords are kept. | Passkeys first (SEC-07); Apple 4.8; prototype screens. | security.md §2.6; design-a.md §2.1 screen 3; design-c.md §2.6 screen 4 |
| O-02 | The age gate follows the legal drinking age of the selected country (18 by default, 21 in the US) and re-checks when the country changes (PREF-05). The "Non" answer is persisted and its relaunch behaviour defined. | S2M's English landing page requires 21+; the prototype does not persist "Non". | app.md §3 decision 2, §5; design-a.md §2.1 screen 1 |
| O-04 | "Weight, body-model sex (other or prefer not maps to the female model), optional height and age, all used by the formula", plus the missing profile photo. Input bounds 30 to 250 kg, 120 to 230 cm, 18 to 100 years (prototype: 35 to 250 kg). | Without height a BMI 35 man is told he is under 0.5 g/L about 1 h too early (T11). | bac.md §2.1.2, §5; design-a.md §2.7 |
| O-05, O-18 | Country picker gets a region level for UK, Canada, Australia and the US (Utah); novice mode carries a per-country definition; zero-tolerance countries show only back to zero ("any alcohol is over your limit"); Morocco and Tunisia ship as zero tolerance until verified. | Subnational limits; safe direction for unverified rows. | bac.md §2.3, §2.6 |
| O-15, O-18 | Build a BAC reference test set first (bac.md T1 to T14) and treat every bug in S2M's release notes as an acceptance test for the matching ID. | Under-estimation is S2M's most damaging complaint. | app.md §3 decisions 3 and 7; bac.md §2.7 |
| O-19 | Short notice on every BAC surface: levels 1 to 3, Live Activity, lock-screen and home widgets, watch, share card, participant profile. Never "you can drive"; long form on tap. Wording: bac.md proposes « Estimation indicative, pas un éthylotest. Ne prends jamais le volant sur la foi de ce chiffre. », DESIGN.md §9 and SLOP.md UI-19 use « Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base. »: VOICE.md picks one. | Guardrail "always visible"; missing on most surfaces. | design-a.md §2.7, §3 decision 3; bac.md §2.6; voice.md §2.4 |
| O-24, O-25 | Threshold colours and limit lines in data units, converted per locale, not relative to the curve's box. Band 1 starts at min(0.25 mg/L, the user's legal limit) and the safe green is never used above the user's limit. The personal limit line follows the O-26 slider. | Prototype lines sit at fixed pixels; a French novice at 0.20 mg/L would see "OK" green. | design-a.md §2.2 screen 4, §3 decision 5; bac.md §2.5, §3 decision 7 |
| O-27 | Hydration: a nudge 20 min after an alcoholic drink if no water was logged since the previous one, plus a 45 min fallback (adjustable 15 to 120 min), at most one per 20 min, silent in quiet hours. | No official interval exists. | bac.md §2.5 |
| O-32 | Floating add-drink button on all 14 games, action games included (in the bottom bar for Le Doigt). One tap logs the user's last drink, never pauses a timer, logs for the phone owner only. Absorbs design-c's optional GAME-FAB. | Prototype shows it on 3 of 14 games. | design-c.md §1, §3 decision 1, §5.3; games.md §2.0 |
| O-38 | Also covers friend notifications outside a party (over limit, "already drunk"): opt-in per friend, rate-limited, BAC kind off by default, inside the per-night notification budget. | S2M sends them and had to cut a third of its notifications. | app.md §3 decision 5, §5; polish.md §3 decision 5 |
| O-40 | One written closing rule that reconciles the party end time, the 6 am day boundary and "no one active". | The prototype shows three different rules. | design-a.md §2.7, §5 |
| O-44 | Durations computed from settings or measured (crew median after 3 games, else one declared number with its source), never a range. Real swipe carousel, one original illustration per game. | Anti-slop bans invented ranges. | design-b.md G-17, §3 decision 7; games.md §2.0, §3 decision 12, §5; design-c.md §9 |
| O-45 | One level naming set for every game (Normal, Hard, Extreme mapped to one FR set in VOICE.md). The FR UI never says "niveau" for it (reserved for UiLevel). | Three naming sets in the prototype. | design-c.md §1 item 3, §3 decision 2; app.md §6 |
| O-46 | "?" rules sheet on all 14 games, hidden during live timed phases (fuse, curve). Absorbs design-c's optional GAME-RULES-SHEET. | Missing on action games; prevents stalling. | design-c.md §5.1, §5.3; games.md §2.0, §5 |
| O-48 | The unlock is a crew-size condition (4 friends in the crew), separate from the minimum players at the table (O-62: 5). A locked game cannot be launched. | Prototype shows "4 amis" next to "5 joueurs minimum" and does not block play. | design-b.md G-18, §5 |
| O-53 | "Qui a ?" is a designation game (everyone points on zero, penalty per finger), not a confession game. | Confession is O-56; the catalogue already promises designation. | games.md §2.1, §3 decision 1 |
| O-60 | The chosen finger is shown visually, never by name. | Touches carry no identity. | design-c.md §3 decision 4 |
| O-64 | Keep it, designed from scratch as a crash game ("Ça grimpe": heavy-tailed crash point, integer stake in sips, first out takes 1). ID text adds "no longer in S2M's catalogue". Priority P0 or P1 to decide. app.md also floated a game on real BAC curves, which games.md rejects because it rewards drinking faster. | La Courbe left S2M; the prototype version is solved by exiting at x1.5. | app.md §3 decision 1, §5; games.md §2.4, §3 decisions 8 and 9; design-c.md §3 decision 5 |
| O-66, O-67, O-68 | Recipe units follow the user's unit system (cl or oz as a local override, US and UK fl oz differ); search covers ingredients. | Prototype uses the US factor only and does not search ingredients. | design-c.md §2.3, §3 decision 9 |
| O-77 | Merge into the COM-08 report flow (one flow for crew and public content). | One report path. | community.md §5 |
| O-82 | Pair with the new N-36 "not feeling well" status. | Users asked for the middle ground between bed and SOS. | app.md §5 |
| HUB-01 | Live leaderboard reorders only on server answers; "Autre verre" opens the add sheet; the hero button becomes QOL-01 "same again". | Prototype gaps. | design-a.md §2.7 |
| HUB-02 | iOS: state the 8 h Live Activity limit and its renewal (QOL-26). Android: "persistent notification" becomes a Live Update (promoted ongoing notification) started only by the user's own action, native builder, at most 3 actions (Same again, Water, Heading home). | ActivityKit lifetime; Android Live Update rules. | skills.md §5; polish.md §2.4 R2 and R4, §3 decision 3, §5 |
| PREF-02, PREF-03 | Add the missing defaults and settings: first day of week, date format, drink-size presets, emergency numbers, novice mode, currency picker, mg/100 mL for the UK. Emergency numbers per country from bac.md (Norway: 112 is police, 113 ambulance; Morocco 150, 190, 177). | Missing in the prototype; bac.md table. | design-a.md §2.1 screen 5; design-c.md §5.1, §5.2 item 20; bac.md §2.4 |
| QOL-04 | Android App Actions become launcher shortcuts plus a Quick Settings tile (AppFunctions later, P2). The Siri example becomes "Add a beer in <App name>". Ten App Shortcuts and two Controls listed in polish.md. | Assistant left Android phones in Sept 2026; Siri phrases must contain the app name. | polish.md §2.4 R5 and R6, §3 decision 4, §5 |
| QOL-06 | Formats: Stories at least 720 x 1280 at 9:16, sticker 640 x 480, video up to 20 s; TikTok needs the asset saved to Photos first; share assets rendered on the server. | Platform specs. | polish.md §2.2, §3 decision 7, §5 |
| QOL-08 | Amount fields accept both "," and "." whatever the keyboard shows. | Some Android keyboards show "." in French. | polish.md §5 |
| QOL-09 | System photo picker only; EXIF stripped on the device and again on the server. | Play photo permission policy since 28 May 2025. | polish.md §2.4 R10, §5 |
| QOL-10 | Battery shown with the time of the reading, reported only while the app or its party session runs. | The value is only known while our code runs. | polish.md §5 |
| QOL-19 | Long-press copy (the prototype uses tap) plus a visible Copy button at levels 2 and 3. No in-app "Copied" on Android 13+ (the system shows one); sensitive values flagged. | ADP-04; Android 13 rule. | design-c.md §5.2 item 6; polish.md §2.4 R8, §5 |
| QOL-20 | Wording aligned with the approved light morning theme if the user confirms (PROMPT says dark). | Conflict between PROMPT and the approved design. | design-b.md G-2, §3 decision 1, §5 |
| QOL-21 | Add to calendar through the system event editor, no calendar permission. | iOS 17 EventKitUI. | polish.md §5 |
| O-03, N-03, N-35 | Quiet-hour defaults never silence safety, N-29 or live notifications of a party the user is in (prototype default: 2 h to 11 h). | Conflict with the night-out priority. | design-a.md §2.7 conflict 9, §5; design-c.md §5.2 item 19 |
| N-11 | Wheel result computed from the final resting angle and revealed on stop, haptic ticks, "Tourner" disabled while spinning; vote and suggestion modes need screens. | Prototype names the mirrored segment. | design-b.md G-3, §3 decision 2 |
| N-28, ADP-04 | Add "cancel a sent alert". SOS hold resolved in an ADR: 2 s hold at levels 0 and 1, big tap plus a cancellable countdown at levels 2 and 3 (or a documented exception). | No cancel flow; long-press is forbidden at levels 2 and 3. | design-a.md §2.7, §3 decision 2, §5 |
| N-30 | Invite links keep admin approval or a member cap so crews stay closed groups under the DSA. Define what the invite page shows a non-member (prototype: inviter, crew name, 4 initials, count). | DSA recital 14; SEC-01. | community.md A-COM-2, §5; design-a.md §2.4 screen 5 |
| N-33, RANK-08 | Admin-only controls (crew card queue, crew leaderboard switch) gated by role in the UI and enforced on the server; refusals carry a reason. | Prototype has no role gate. | design-b.md §3 decision 13 |
| ADP-01 | Thresholds 0.50 / 0.80 / 1.20 g/L (0.25 / 0.40 / 0.60 mg/L at 2000:1), exit at entry minus 0.10 g/L after 10 min at the level. Prototype placeholder: 0.5 / 1.0 / 1.5. | Recon-BAC research. | bac.md §2.5, §3 decision 6; design-a.md A-DESIGNA-3 |
| ADP-06 | Vault locks when max(current BAC, projected peak within 60 min) is at least 0.80 g/L and unlocks at back to zero, then asks to confirm queued actions (prototype: 11 h). All 6 listed actions, and the blocked-action interstitial, are specified. | BAC keeps rising after the last drink; a clock rule fails on trips. | bac.md §2.5; design-a.md §2.7, §5 |
| RANK-07 | Danger cap at 1.20 g/L (prototype hard-codes 2 g/L), copy generated from the remote-config value in the user's unit, crossing it switches to level 3. | Margin below the fatal 5th percentile with a 21 % CV. | bac.md §2.5; design-b.md G-10 and G-19, §5 |
| RANK-09, PROF-06 | Drinking leaderboard and records also off in any public Google Play build, not only the App Store one. | Play bans favourable portrayal of competition drinking. | bac.md §2.6; community.md §2.1.5 |
| MOT-01 | Names the five spring tokens and the rule "springs for space and gesture, curves for time"; Android uses a custom MotionScheme, never M3 Expressive's default. | M3 Expressive bounces by default. | motion.md §3.1, §5 |
| MOT-02 | The living background is a bubble field that encodes crew activity, mood and time, renders on demand at 30 Hz or less, static when idle, off in eco mode, with Reduce Motion and at levels 2 and 3. | No decorative motion. | motion.md §3.4, §5 |
| TER-01, TER-02 | Flats and private homes from N-08 are never territories. | The host always wins and a home becomes a map pin. | territories.md §3.1, §5 |
| TER-03 | One counted check-in per venue per night (06:00 to 06:00), whatever the number of parties; 20 min minimum delay; 15 min vesting; at most 6 per night. Conflict: anticheat.md §2.2 still writes "per party". | Farming. | territories.md §3.2, §5; anticheat.md §2.2 |
| TER-04 | Ghost crown at reset, 12 h closing window, 7-day admin correction window with replay, 30 min delay on takeover notifications, alert at a gap of 10 points or less plus "can take it tonight". | Opening race, fewer notifications. | territories.md §3.3, §5 |
| TER-06 | Separate "boss" (live crown) from "Mayor" (crown held at season close). | Two different states. | territories.md §3.4, §5 |
| AC-04 | For territory points, a one-tap peer confirmation counts only if the confirmer is checked in at the venue or did a BLE handshake. Conflict on the window: territories.md says ±30 min, anticheat.md says ±20 min (passive) and ±30 min (active). | Collusion. | territories.md §3.1, §3.7 case C, §5; anticheat.md §2.3 |
| AC-05 | On Android 13+, MEETS_DEVICE_INTEGRITY is the good tier; never require STRONG. | STRONG lost about 14.5 % of verdicts in May 2025. | anticheat.md §3 decision 3, §5 |
| AC-06 | Check-in UI shows neutral progress without per-signal verdicts, one plain line on rejection, and the missing "unverified, a friend must confirm" outcome. | The prototype tells a cheater which signal caught them. | design-b.md G-4, §3 decision 3 |
| COM-02 | Add visit month and year, exact publication date, a 12 h publication delay applied to every review, no reward, owner and staff exclusion, disclosed sort criteria. Conflict: design-b.md proposes month only for strangers and exact date for friends; community.md proposes month and year for everyone. | French review law; stalker scenario. | community.md §2.3, §3 decision D6, §5; design-b.md G-7, §3 decision 5, §5 |
| COM-07 | Only the positive fact is shown and filterable ("ID checked every time"); door reports are structured answers only. | Play and Apple rules on alcohol and minors. | community.md §2.6, §5 |
| COM-09 | RSVP names friends-only; counts follow COM-06. | Event stalking. | community.md §5 |
| COM-11 | Owners cannot attach perks to boss, Mayor or Legend status. | Foursquare's mayor discounts made cheating worth it. | territories.md §3.7 case K, §5 |
| PROF-01, PROF-02 | Decide whether audiences nest (prototype: Moi < Crews < Amis < Tous). Identity becomes a section with its own audience (the prototype always shows first name and photo to strangers). | PROF-08 tests depend on it. | design-c.md §1 items 7 to 9, §3 decisions 6 and 7 |
| PROF-04 | Review audience defaults to the user's reviews-section audience (Friends for a new account), not "Public". | Profile defaults say nothing is public until the user turns it on. | design-b.md G-5, §3 decision 4 |
| MSG-02 | MLS (RFC 9420) through a permissively licensed implementation (OpenMLS by default, mls-rs as fallback) for every conversation, 1:1 included; libsignal dropped. | libsignal is AGPL-3.0, unsupported outside Signal, and conflicts with App Store terms. | security.md §2.1, §5 |
| MSG-08 | Generated recovery key only in v1; a passphrase only once a server-side attempt limit exists (the prototype shows a 6-word phrase). | Offline brute force. | security.md §2.3, §5; design-b.md §2.3 screen 4 |
| SEC-06 | Keep, per user, HMAC keyed hashes of exact check-in coordinates and accuracy for 30 days; raw GPS still deleted after verification. | Needed for the "identical coordinates" check. | anticheat.md §2.2, §5 |
| SEC-09 | "OWASP MASVS L2" becomes "OWASP MASVS v2 with the MAS-L2, MAS-R and MAS-P profiles". | Levels moved to MAS Profiles. | security.md §2.5, §5 |
| SLOP-04 | Scope widened to notification templates, widget and Live Activity strings, store, legal and game decks; fixtures of bad and good strings; reasoned allowlist. | Without fixtures the regexes drift; without an allowlist the lint gets switched off. | voice.md §5 |
| SYNC-03, SYNC-07 | Error toasts use a verb ("Réessayer", "Fermer"), never "OK"; the grouped failure message gets a "Voir" action listing each action with its reason. | SYNC-03 asks for Retry; DESIGN.md asks for verbs. | design-c.md §3 decision 8; voice.md §2.4, §3 decision 10, §5 |
| AI-02, AI-03 | Plain label « Écrit par l'IA, validé par le crew » / "Written by AI, approved by the crew", no sparkle icon. | Honesty; possible EU AI Act art. 50 duty (A-VOICE-8). | voice.md §3 decision 7, §5 |
| JOY-01 | Bluetooth LE plus bump detection, UWB on capable iPhones, both apps in the foreground on iOS, phone-to-phone QR fallback; no NFC promise between iPhones; the proof line waits for the server. | iOS background advertising and NFC limits. | anticheat.md §2.3, §5; polish.md §2.4 R9, §5; design-a.md §2.6 screen 4 |
| JOY-12 | Never a drinking dare or a physically risky challenge. | App Store 1.4.3 and 1.4.5. | polish.md §2.4 R14, §5 |

## ID renumbering

Collisions and non-standard prefixes found in the reports, and the ID each proposal received. Each source report keeps its own wording; `FEATURES.md` uses the assigned ID.

| Report | Proposed as | Assigned | Why |
|---|---|---|---|
| app.md §5 | QOL-25 (logging nudge) | QOL-32 | polish.md proposes QOL-25 to QOL-31 as one block and cites QOL-25 throughout; the single app.md ID moves. |
| polish.md §5 | QOL-25 to QOL-31 | kept | First block. |
| app.md §5 | N-36 (not feeling well, P0) | N-36, kept | P0, keeps the number. |
| design-b.md §5 | N-36 (consent for exports, P1) | N-37 | Collides with app.md N-36. |
| security.md §5 | MSG-11 (linking a new device) | MSG-11, kept | Needed by the MSG-02 multi-device design before any group UI. |
| design-b.md §5 | MSG-11 (group conversation info) | MSG-12 | Collides with security.md MSG-11. |
| voice.md §5 | SLOP-09, SLOP-10, SLOP-11 | kept | Block of three. |
| skills.md §5 | SLOP-09 (native anti-slop lint) | SLOP-12 | Collides with voice.md SLOP-09. |
| bac.md §5 | BAC-SAFE-01 | O-87 | PROMPT.md has no BAC-xx group; placed in "BAC and drink tracking". |
| bac.md §5 | BAC-DANGER-01 | O-88 | Same. |
| bac.md §5 | BAC-FOOD-01 | merged into O-85 | Same proposal as app.md O-85 (food input). |
| app.md §5 | O-85, O-86 | kept | Next free O numbers at the time. |
| games.md §5 | "Penalty model for games" (N-xx, number left to the orchestrator) | O-89 | Placed in the Games group, next to the shared game IDs O-44 to O-49. |
| games.md §5 | "Forfeit deck" (no number) | O-90 | Games group. |
| games.md §5 | "Table style" (no number) | O-91 | Games group. |
| design-c.md §5.3 | GAME-RULES-SHEET (optional) | not assigned | design-c offers it only "if the orchestrator wants them tracked separately"; folded into the O-46 change. |
| design-c.md §5.3 | GAME-FAB (optional) | not assigned | Same; folded into the O-32 change. |
| security.md §5 | SEC-13 (export compliance file) | SEC-13, kept | security.md says it can merge into SEC-10; orchestrator decision. |

No collision for MOT-14, MOT-15, TER-10 to TER-12, AC-11 to AC-15, SEC-11, SEC-12, SEC-14 and COM-12 to COM-16.

## Design gaps per ID

From the three Recon-Design reports (A: Arrivee, Soiree, ModeBourre, Systeme, Soirees, Securite; B: Recap, Radar, Messages, Bars, Classements, Jeux; C: JeuxCartes, JeuxAction, Bar, Argent, Profil, Reglages, Etats). States: **missing** (no screen), **partial** (part of the PROMPT requirement has no screen), **ambiguous** (two readings), **conflict** (contradicts PROMPT.md or DESIGN.md). IDs not listed were judged complete on their board, apart from the board-wide gaps below.

Board-wide gaps:
- Adaptive levels: only ModeBourre shows levels 1 to 3. No other board shows a level variant, so every spec writes its "Behaviour at levels 0, 1, 2, 3" from DESIGN.md §6 and PROMPT.md (design-a.md §2.2 (g); design-b.md G-20; design-c.md conventions and §5.1).
- Pending is not success: almost every instant "done" state in the prototype needs the SYNC-01 to SYNC-03 treatment (design-a.md conflict 3; design-b.md G-6; design-c.md §1 item 10, §5.2 item 21).
- Demo data and demo controls are placeholders and must not ship (design-a.md §1, design-b.md G-1, G-11, G-14; design-c.md §2.11, §5.2 item 23).

| ID | State | Gap | Source |
|---|---|---|---|
| O-01 | partial | No email + password path; fields read-only. | A §2.7 |
| O-02 | partial | "Non" answer not persisted, relaunch undefined. | A §2.7 |
| O-04 | partial | No profile photo; weight only by ±1 stepper. | A §2.7 |
| O-06 | partial | Email change only, no password row. | C §2.8, §5.1 |
| O-07 | partial | No "account deleted" confirmation. | C §5.1 |
| O-10 | partial | Time format row static. | C §5.1 |
| O-13 | partial (annotation only) | Only a row label. | C §2.8 |
| O-15 | conflict | Unit swap has no pop (DESIGN §5 says pop 350 ms); trend line says g/L in mg/L. | A §2.7 conflict 5, bugs |
| O-18 | partial | France only; "Sous la limite à" hard-coded and disagrees with "Volant". | A §2.7 |
| O-19 | partial | Notice absent on levels 1 to 3, Live Activity, widgets, watch, share card, participant profile. | A §2.7 |
| O-20 | partial | Quick-add tiles have no custom glass icons. | A §2.7 |
| O-21 | partial | Long-press menu static; create, reorder and sync not shown. | A §2.7 |
| O-23 | partial | Pre-swiped item only; collapse and edit unwired; delete toast has no timeout. | A §2.7 |
| O-24 | partial | No zoom, pan, hour labels, peak marker or profile reminder; limit lines at fixed pixels; gradient relative to the curve. | A §2.7 |
| O-25 | partial | "Ta limite" line not linked to the limit slider. | A §2.7 |
| O-26 | partial | "Without spam" alert rules not shown. | A §2.7 |
| O-29 | partial | One friend only, avatar at a fixed point. | A §2.7 |
| O-32 | partial | FAB on 3 of 14 games; toast only on Grand Paquet. | C §5.1 |
| O-33 | partial | Wide widget and water not wired; no presets; static curve; no double-count proof. | A §2.7 |
| O-35 | partial | Moods are text chips, not icons; Trip has no end day; automatic name ignores the picked day. | A §2.7 |
| O-36 | partial | Badge shows "0" instead of hiding; QR join is on Arrivee. | A §2.7 |
| O-37 | partial | BAC values change without animation; speeding up / slowing down is text-driven. | A §2.7 |
| O-39, O-43 | partial | "Demande envoyée" instant, no failure state; friend search dead; duplicate-request rule not shown; participant profile shows a non-friend's live BAC (PROF-05) and an "Écrire" button (COM-05). | A §2.7, conflicts 11 and 12; C §5.1 |
| O-40 | ambiguous | Three closing rules (6 h, nobody active, end time). | A §2.7 |
| O-41 | partial | No recap archive, group stats, story card or notification UI; figures inconsistent (41 vs 26 drinks). | B §2.7, G-1 |
| O-42 | ambiguous | Squad chip toggles only its own style. | A §2.7 |
| O-44 | partial | No swipe; same placeholder illustration on 15 cards; durations are ranges. | B §2.7, G-17 |
| O-45 | conflict | Three level naming sets; level changes no content in the demo. | B §2.7; C §5.2 item 1 |
| O-46 | partial | No "?" on the 7 action games. | C §5.1 |
| O-47 | partial | No result cards, no "someone leaves" state; timer on two games only. | C §5.1 |
| O-48 | ambiguous | Lock "4 amis" vs "5 joueurs minimum"; "Jouer" stays active. | B G-18; C §5.2 item 3 |
| O-49 | partial | No penalty counter (except Autoroute), no remove, no reorder; every guest gets the same colour. | B §2.7; C §5.1 |
| O-50 | partial | 6-card loop, no end of deck. | C §2.8 |
| O-51 | partial | One player; same card shown in both slots; no end card. | C §2.8 |
| O-53 | conflict | Screen plays confession while the catalogue promises designation. | C §2.1; games.md §2.1 |
| O-54 | partial | Colour and shake leak the real fuse; no rules, no FAB. | C §2.2; games.md §2.2 |
| O-55 | partial | Result shown at the tap, 4 s before the wheel stops; no detent haptics. | C §2.8 |
| O-58 | partial | Truths not per level; re-flip overlaps the flip. | C §2.8 |
| O-59 | partial | Duplicate mines possible; no end; no player decision. | C §2.8 |
| O-60 | partial | Clicks instead of multi-touch; 6 fingers max vs "2 à 8"; picks by finger order. | C §2.8 |
| O-62 | partial | Coral card reveals the agents; second-agent vote not handled. | C §2.8 |
| O-63 | partial | Drawer screen only; no guesser, lobby, scoring or round end. | C §5.1 |
| O-64 | partial | Exit multiplier rewards nothing; crash uniform from x1.6 (exit at x1.5 always safe). | C §2.8; games.md §2.4 |
| O-65 | missing | Content requirement, no screen. | B §2.7 |
| O-66, O-68 | partial | 8 recipes, colour blocks, no ingredient search. | C §5.1 |
| O-70 | partial | No pool creation, no add friends, add-expense button dead; amounts do not add up. | C §5.1, §5.2 item 23 |
| O-77 | partial | Report row dead. | C §2.8 |
| O-84, N-21 | partial | Photo strip and counts only; no album browser, upload or video. | B §2.7 |
| HUB-01 | partial | Live leaderboard row never reorders; "Autre verre" links to "#"; round is only a tile. | A §2.7 |
| HUB-02 | partial | Water button not wired; no expanded Dynamic Island. | A §2.7 |
| PREF-01 | partial (annotation only) | Only a note. | C §2.8 |
| PREF-02 | partial | First day of week, drink-size presets and date format missing. | A §2.7 |
| PREF-03 | partial | Drink presets, novice mode, country picker, currency picker, first day of week, emergency numbers missing; no mg/100 mL. | C §5.1, §5.2 item 20 |
| N-01 | partial | Time and place editors static; no expiry. | B §2.7 |
| N-02 | partial | No list view, no "this weekend"; "Chill maison" absent from the calendar; colour-only encoding. | B §2.7 |
| N-03 | partial | Plural bug "1 personnes"; create button inert. | B G-9 |
| N-04 | partial | Single choice instead of multi-slot; no "plan" option; no closed state. | B §2.7 |
| N-05 | partial | Chips static; no slot suggestion. | B §2.7 |
| N-06 | partial | One switch; no add-event, ICS or reminders. | B §2.7 |
| N-07 | ambiguous | Share and ghost mode can both be on; settings copy "jamais gardée" vs SEC-06. | A §2.7; C §5.2 item 18 |
| N-08 | partial | No address, crew ratings or HQ; bars only. | B §2.7 |
| N-09 | partial | No cocktail or soft prices, no history, no price entry. | B §2.7 |
| N-11 | partial | Wheel only; formula names the mirrored segment; no vote or suggestion screen; filters inert. | B G-3 |
| N-12 | missing | Only popular days. | B §2.7 |
| N-14, N-15 | partial | Heatmap only; Wrapped entry only, no monthly recap. | C §2.8 |
| N-17 | partial | No selective deletion. | C §5.1 |
| N-18 | partial | No choice of participants or drink; adds drinks to others' BAC without their confirmation (AC-07 question). | C §5.1 |
| N-19 | partial | Static chips; no editable amounts. | C §2.8 |
| N-20 | partial | The 90 % alert is not shown. | C §5.1 |
| N-22 | partial | No photos or highlights in the timeline. | B §2.7 |
| N-23 | partial | Vote only, no quote submission. | B §2.7 |
| N-28 | partial | No cancel after send; a second press silently un-sends. | A §2.7 |
| N-29 | conflict in data | Sami "rentré" on the Party screen but missing on the dashboard; home status suppression not shown. | A §2.7 |
| N-32 | partial | No "who brings what" assignment; add-to-list button dead. | C §5.1 |
| N-33 | partial | No game picker; admin queue not role-gated; no refusal reason. | B §2.7 |
| N-34 | partial | Titles only; badges for organising, hydration, driving, home safe, wins not shown. | C §5.1 |
| QOL-01 | partial | Fixed pint, not "same as last". | A §2.7 |
| QOL-03 | partial | Second buttons show the wrong confirmation; done state instant. | A §2.7 |
| QOL-09 | partial | No retry, no blurred placeholder. | C §5.1 |
| QOL-17 | partial | Only the "3 friends checked in" suggestion. | A §2.7 |
| QOL-18 | partial | Map app choice not shown. | A §2.7 |
| QOL-19 | conflict | Copy on tap, not long-press; no haptic. | C §5.2 item 6 |
| QOL-20 | conflict | Light theme vs PROMPT "dark"; photos missing. | B G-2 |
| QOL-21 | partial | One-tap "add party to calendar" not on Radar. | B §2.7 |
| QOL-23 | partial | No suggestions before typing, no empty result. | C §5.1 |
| JOY-01 | partial | Button-triggered, no proximity, no sound; proof line instant. | A §2.7 |
| JOY-02 | partial | No "never the same line two nights in a row". | A §2.7 |
| JOY-03 | partial | Golden icon promised by the easter egg not in the list; no unlock rule. | C §5.1 |
| JOY-04 | partial | Mood tints only the name field and the create button. | A §2.7 |
| JOY-10 | partial (annotation only) | Row only. | C §2.8 |
| ADP-01 | partial | No hysteresis or transition; manual selector changes only the tag. | A §2.7 |
| ADP-03 | conflict | "Ajouter un verre quand même" is 40 px vs the 88 px rule at level 3 (DESIGN.md contradicts itself). | A §2.7 conflict 7 |
| ADP-04 | conflict | SOS 2 s hold and swipe-only history editing at levels 2 and 3. | A §2.7 |
| ADP-06 | partial | 2 of 6 vault actions; no blocked-action interstitial; read-only note vs live switches. | A §2.7, conflict 8 |
| ADP-07 | partial | No max-contrast or strobe treatment. | A §2.7 |
| ADP-08 | partial | Switch only. | A §2.7 |
| MOT-03 | partial | No glass, no bubbles. | A §2.7 |
| MOT-04 | partial | No draw-on, threshold transition, peak point or gliding avatars. | A §2.7 |
| MOT-06 | partial | No deal, swipe or tremble. | C §2.8 |
| MOT-07 | partial | No haptics, no roulette clicks. | C §2.8 |
| MOT-08 | partial | Curves do not draw; badges fade instead of dropping; no takeover replay; no export. | B §2.7 |
| MOT-09 | partial | Takeover only on the check-in screen, not on the map. | B §2.7 |
| MOT-10 | partial | No pull-to-refresh, launch screen, badge unlock or animated empty state. | C §5.1 |
| MOT-11 | partial | Button pops only. | A §2.7 |
| MOT-13 | partial | No leader-change effect; overtake plays on tap. | B §2.7, G-6 |
| TER-01 | partial | No area of influence, no live highlight, inert filters. | B §2.7 |
| TER-02 | partial | Discovery points missing from the copy; +3 per check-in is a demo value. | B §2.7 |
| TER-03 | missing | One counted check-in per venue per party and the minimum delay not represented. | B §2.7 |
| TER-04 | partial | No reign history. | B §2.7 |
| TER-05 | partial | Top 3 instead of top 5; no past bosses, latest nights or album photos. | B §2.7 |
| TER-07 | ambiguous | "Crews" map scope does nothing. | B §2.7 |
| TER-08 | partial | No conquest suggestion. | B §2.7 |
| TER-09 | partial | No private toggle at check-in; opted-out member's look undefined. | B §2.7, §2.9 item 13 |
| RANK-01 | partial | Periods change no data; "Soirées" metric placeholder. | B §2.7 |
| RANK-02 | ambiguous | Full screen with the Soirée tab; overtake on tap. | B §2.7, G-6 |
| RANK-03 | partial | No story card with the podium. | B §2.7 |
| RANK-04 | partial | No titles tied to N-34. | B §2.7 |
| RANK-07 | partial | Hard-coded 2 g/L; no level 3 switch. | B §2.7, G-10, G-19 |
| RANK-08 | partial | Admin switch not role-gated. | B §2.7 |
| COM-01 | partial | No popular hours; "214 personnes" has no period. | B §2.7 |
| COM-02 | partial | No photos, "useful" votes or per-criterion display; no draft, PII filter or length limit. | B §2.7, §2.4 screen 5 |
| COM-04 | partial | Crew-name consent not shown. | C §2.8 |
| COM-05 | partial | Own "open to meeting people" switch and request audience setting missing; block sheet dead. | C §5.1 |
| COM-06 | ambiguous | Public scope shows crew bosses and the same pins; threshold, rounding and delay not shown. | B §2.7, §2.9 item 1 |
| COM-07 | partial | No official age-policy question, no confidence level. | B §2.7 |
| COM-08 | partial | Venue report icon only; no review, photo or profile report; no block or mute. | B §2.7 |
| COM-09 | partial | No RSVP, no event submission. | B §2.7 |
| COM-10 | partial | No ranked nearby list; shared want-to-go list missing. | B §2.7 |
| COM-11 | partial | Label only, no owner replies. | B §2.7 |
| PROF-02 | partial | 6 of 10 sections (identity, crews, titles and badges, member card missing). | C §5.1 |
| PROF-03 | partial | Un-hide only, no way to hide one item. | C §5.1 |
| PROF-04 | conflict | Review audience defaults to "Public"; dated visit shown to strangers. | B G-5, G-7 |
| PROF-05 | partial (annotation only) | Note only; open party of a stranger shown with venue and time. | C §2.8, §5.2 item 16 |
| PROF-06 | partial | Records chip can reach "Tous" although the Public preset caps it. | C §5.2 item 15 |
| PROF-07 | partial | No entry from the profile; Settings links to the board root. | C §5.1 |
| PROF-10 | partial | No first-time automatic display. | C §5.1 |
| MSG-03 | partial | No video; placeholder photo. | B §2.7 |
| MSG-05 | partial | No QR scanning; 30-digit number. | B §2.7 |
| MSG-07 | ambiguous | Report starts from the info screen, not a message. | B §2.7 |
| MSG-08 | partial | No backup opt-in or restore flow. | B §2.7 |
| MSG-10 | partial | No edit or delete for everyone, no big record button at levels 2 and 3, no failed state; receipts never displayed; typing switch unwired. | B §2.7, G-15 |
| AC-02 to AC-05 | conflict | Shown to the user signal by signal, which leaks the detection model. | B G-4 |
| AC-06 | partial | No "unverified" outcome. | B §2.7 |
| AC-09 | partial | Repeat-offender flag not shown. | C §2.8 |
| SEC-07 | partial | No new-device alert. | C §5.1 |
| SEC-08 | conflict | Health consent asked after weight and sex were entered. | A §2.7 conflict 10 |
| SYNC-03 | partial | No "Retry" anywhere. | C §5.1 |
| SYNC-05 | partial (annotation only) | Re-sync only implied by a note. | C §5.1 |
| SYNC-07 | partial | No toast queue; error toasts use "OK" and never auto-dismiss. | C §5.1, §5.2 item 12 |
| AI-02 | partial | No editor behind "Modifier"; one "Valider" does not show crew approval; no opt-in. | B §2.7 |
| AI-03 | partial | Duplicates on repeated taps (minor). | B §2.7 |
