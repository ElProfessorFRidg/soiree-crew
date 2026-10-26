# FEATURES.md

Every ID of `PROMPT.md`, its priority, the prototype board that shows it, and its status.

Status values: `todo`, `spec`, `build`, `review`, `polish`, `done` (definition of done in `PROMPT.md`), `retired` (decision recorded).
Board `Backstage` means the ID has no screen in the prototype ("Coulisses" in `Main.dc.html`).

## Account, profile, settings

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-01 | P0 | Arrivee.dc.html | todo | Sign up / sign in with email and Google (first name and username kept separate). Add Sign in with Apple (requi... |
| O-02 | P0 | Arrivee.dc.html | todo | 18+ age gate on first launch. |
| O-03 | P1 | Arrivee.dc.html | todo | Onboarding where the user picks their notifications. |
| O-04 | P0 | Arrivee.dc.html | todo | Profile for the BAC model: weight, sex (check what the model really needs; S2M dropped height because the calc... |
| O-05 | P0 | Arrivee.dc.html | todo | Country (legal limit) + novice / probationary driver mode. |
| O-06 | P2 | Reglages.dc.html | todo | Change password and email from settings. |
| O-07 | P1 | Reglages.dc.html | todo | In-app account deletion: states exactly what will be erased, confirms when done. |
| O-08 | P1 | Arrivee.dc.html | todo | Privacy policy readable without an account; analytics consent revocable at any time. |
| O-09 | P0 | Reglages.dc.html | todo | 7 languages: FR, EN, ES, IT, DE, PT, RU. The whole app, not a few screens. See <localization>. |
| O-10 | P2 | Reglages.dc.html | todo | 12 h / 24 h format following the phone setting. |
| O-11 | P0 | Backstage | todo | Accessibility: large touch targets, respects Reduce Motion, text never truncated, nothing under the notch or c... |
| O-12 | P2 | Reglages.dc.html | todo | In-app notice when a new version is available. |
| O-13 | P2 | Reglages.dc.html | todo | Per-account data isolation on the device (several accounts on one phone without leaks). |
| O-14 | P0 | Backstage | todo | Opening the app never stops music already playing (Spotify, Deezer...). |

## BAC and drink tracking

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-15 | P0 | Soiree.dc.html | todo | Live BAC in mg/L of breath and g/L of blood, plus the units used in each supported country (see <localization>). |
| O-16 | P0 | Soiree.dc.html | todo | Trend: rising / falling + estimated peak (value and time). |
| O-17 | P0 | Soiree.dc.html | todo | "Back to zero" timer, reliable even at high levels (above 1.5 mg/L). |
| O-18 | P0 | Soiree.dc.html | todo | Driving status and timer: under / over the legal limit, at least 22 countries with automatic thresholds (watch... |
| O-19 | P0 | Soiree.dc.html | todo | Permanent notice next to the BAC: indicative estimate, not a certified breathalyser, never drive based on it a... |
| O-20 | P0 | Soiree.dc.html | todo | Quick adds (beer 25 / 33 / 50 cl, wine, shot, cocktail...) with custom-drawn glass icons. |
| O-21 | P0 | Soiree.dc.html | todo | Custom drinks: create, long-press to edit / move / remove, custom order, synced across devices, personal presets. |
| O-22 | P0 | Soiree.dc.html | todo | Drink time adjustable to the minute (forgotten drink); a drink "in the future" never counts in the calculation. |
| O-23 | P0 | Soiree.dc.html | todo | Grouped history (e.g. 5x Beer 50 cl) that expands to each drink's exact time, delete one at a time, edit with ... |
| O-24 | P0 | Soiree.dc.html | todo | BAC curve: Day / Week / Month / Total / Average (7-day moving average), zoom, pan, a trace that truly follows ... |
| O-25 | P1 | Soiree.dc.html | todo | Personal limits drawn on the curve. |
| O-26 | P0 | Soiree.dc.html | todo | Set a limit / goal before going out + alerts when getting close, without spam. |
| O-27 | P0 | Soiree.dc.html | todo | Scheduled hydration reminders. |
| O-28 | P1 | Soiree.dc.html | todo | Stats in grams of pure alcohol (this month, total, average). |
| O-29 | P0 | Soiree.dc.html | todo | Friends' avatars on the graph + curve comparison between friends. |
| O-30 | P1 | Soiree.dc.html | todo | Share: styled visual with photo / selfie (front or back camera) + stats + curve. |
| O-31 | P0 | Etats.dc.html | todo | Offline: a drink added without network is kept and sent when the network returns, never counted twice; the app... |
| O-32 | P0 | JeuxCartes.dc.html | todo | Small floating button in every game to add a drink without leaving the game. |

## Widgets

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-33 | P0 | Systeme.dc.html | todo | iOS and Android home-screen widget in 3 sizes: live curve that falls on its own, back-to-zero, interactive but... |
| O-34 | P0 | Soiree.dc.html | todo | In-app home blocks: real-time BAC up front, "Party in progress" block, continuous refresh. |

## Parties and trips

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-35 | P0 | Soirees.dc.html | todo | Create a party: mood (about ten icons: party, birthday, champagne, sunset, costume, wine, fire, night, home, t... |
| O-36 | P0 | Soirees.dc.html | todo | Invite the crew: invitations as cards, reply straight from the list, tab badge with the real number of invitat... |
| O-37 | P0 | Soirees.dc.html | todo | Live dashboard: everyone's BAC in real time, who is speeding up, who is slowing down, who has gone missing for... |
| O-38 | P0 | Soirees.dc.html | todo | Live crew notifications at a controlled volume (S2M had to cut a third of theirs): whatever remains must be us... |
| O-39 | P0 | Soirees.dc.html | todo | Participant profiles tappable from the party, add as friend in one tap. |
| O-40 | P0 | Soirees.dc.html | todo | Automatic closing (a party never stays open for days); trips keep correct group BACs for their whole duration. |
| O-41 | P0 | Recap.dc.html | todo | Recap: saved and kept, notification as soon as it is ready, only people actually present (including non-friend... |
| O-42 | P0 | Soirees.dc.html | todo | Squad mode: curves shared continuously between members. |

## Friends

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-43 | P1 | Profil.dc.html | todo | Reliable search, friend requests without duplicates (a request already received is accepted instead of duplica... |

## Games (15)

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| O-44 | P0 | Jeux.dc.html | todo | Swipeable carousel catalogue (illustration, tags, duration, player count, Play button, pagination), "one phone... |
| O-45 | P0 | Jeux.dc.html | todo | 3 levels per game: Normal, Hard, Extreme. |
| O-46 | P0 | Jeux.dc.html | todo | Rules shown as cards at launch + a "?" button to see them again mid-game. |
| O-47 | P0 | JeuxCartes.dc.html | todo | Round timers, shareable result cards, multiplayer robustness (someone leaves, the game goes on). |
| O-48 | P1 | Jeux.dc.html | todo | Conditional unlocks (e.g. Double Agent unlocks at 4 friends). |
| O-49 | P0 | Jeux.dc.html | todo | Player management: names, order, players without an account, penalty counter. |
| O-50 | P0 | JeuxCartes.dc.html | todo | "Le Soirée2Malade": card game that ends when the last card is drawn, a mash-up of all the classics with a bite... |
| O-51 | P0 | JeuxCartes.dc.html | todo | "L'Autoroute": cross 5 checkpoints by betting on card values, a "Customs" at checkpoint 2, finish with as few ... |
| O-52 | P0 | JeuxCartes.dc.html | todo | "Le 1VS1": face-to-face card duel, 2 players on the same phone, the weaker hand takes the penalty. |
| O-53 | P0 | JeuxCartes.dc.html | todo | "Qui a ?" |
| O-54 | P0 | JeuxAction.dc.html | todo | "La Bombe" |
| O-55 | P0 | JeuxAction.dc.html | todo | "La Roulette": random draw, the loser takes the penalty. |
| O-56 | P0 | JeuxCartes.dc.html | todo | "Je n'ai jamais" (Never Have I Ever), including an unfiltered mode. |
| O-57 | P0 | JeuxCartes.dc.html | todo | "Qui de nous ?": two friends face off, "which of you two is more likely to...". |
| O-58 | P0 | JeuxCartes.dc.html | todo | "Action ou Vérité" (Truth or Dare), including an Extreme mode. |
| O-59 | P0 | JeuxAction.dc.html | todo | "Les Mines" |
| O-60 | P0 | JeuxAction.dc.html | todo | "Le Doigt": reflex game that settles the group (fingers on the screen). |
| O-61 | P0 | JeuxAction.dc.html | todo | "L'Imposteur": a secret word, one intruder, discuss, vote, unmask. |
| O-62 | P0 | JeuxAction.dc.html | todo | "Le Double Agent": two infiltrated agents with a different word, 5 players minimum. |
| O-63 | P0 | JeuxAction.dc.html | todo | "Gribouille": one player draws, the others guess, 3 to 8 players online (real-time, multi-phone). |
| O-64 | P0 | JeuxAction.dc.html | todo | "La Courbe" (listed on the store pages, rules not public). |
| O-65 | P0 | Jeux.dc.html | todo | More than 500 cards / questions / dares per language for FR and EN, all written by us (see <localization> and ... |

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
| O-70 | P1 | Argent.dc.html | todo | Create a pool, add friends and expenses, compute who owes whom with the minimum number of transfers, record re... |

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
| O-82 | P0 | Securite.dc.html | todo | "Gone to bed / home" status. |
| O-83 | P1 | Soiree.dc.html | todo | Photo when logging a drink. |
| O-84 | P1 | Recap.dc.html | todo | Photos and videos shared that stay inside the group. |

## Party hub

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| HUB-01 | P0 | Soiree.dc.html | todo | Party screen, opened automatically during a party. Shows, without pointless scrolling: my BAC and trend, add a... |
| HUB-02 | P0 | Systeme.dc.html | todo | iOS Live Activity / Dynamic Island and a persistent Android notification during the party: BAC, back-to-zero, ... |
| HUB-03 | P0 | Systeme.dc.html | todo | Lock-screen widgets (BAC, next water, who is out tonight). |
| HUB-04 | P2 | Systeme.dc.html | todo | Smartwatch: BAC, add drink and water from the wrist. |

## Preferences and units

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| PREF-01 | P0 | Reglages.dc.html | todo | Settings live on the server: every preference is stored in the database (`UserPreferences`), synced across dev... |
| PREF-02 | P0 | Arrivee.dc.html | todo | Smart defaults on first launch, from the device language and region (no location permission needed for this): ... |
| PREF-03 | P0 | Reglages.dc.html | todo | Settings page where all of it can be changed by hand: language, country for the legal limit, novice driver mod... |
| PREF-04 | P0 | Arrivee.dc.html | todo | Language, region and units are independent settings. A French speaker living in the US can have French UI, US ... |
| PREF-05 | P1 | Reglages.dc.html | todo | Travel: when the phone's region or time zone changes (a trip abroad), the app suggests switching the legal-lim... |
| PREF-06 | P0 | Backstage | todo | Canonical storage: the database stores one unit per quantity (ml, grams of ethanol, kg, g/L of blood, UTC time... |

## Radar: who is out, and when

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-01 | P0 | Radar.dc.html | todo | Evening status in one gesture: Going out / Down if something happens / Chilling at home / Not available, with ... |
| N-02 | P0 | Radar.dc.html | todo | Crew board: who is out tonight, this weekend, this week, as a list and as a calendar. |
| N-03 | P0 | Radar.dc.html | todo | "I'm going out, who's in?": broadcast to the crew with quick replies, turns into a party (O-35) in one tap. |
| N-04 | P1 | Radar.dc.html | todo | Outing polls: date slots (When2Meet style), place, plan; vote, close, event created automatically. |
| N-05 | P1 | Radar.dc.html | todo | Recurring availability ("I usually go out on Thursdays") to suggest slots that suit everyone. |
| N-06 | P1 | Radar.dc.html | todo | Sync with the phone calendar (add event / ICS subscription) + reminders. |
| N-07 | P0 | Soirees.dc.html | todo | Live location shared ONLY during a party and ONLY when the person turns it on: ghost mode, auto-expiry, no loc... |

## Our bars and places

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-08 | P0 | Bars.dc.html | todo | Crew venue directory: bars, clubs, flats, spots, with address, opening hours, happy hours, vibe, crew ratings,... |
| N-09 | P1 | Bars.dc.html | todo | Drink prices logged by the crew per venue (pint, half, shot, cocktail, soft drink), price history, flag when a... |
| N-10 | P0 | Bars.dc.html | todo | Check-in at a venue, visible in the party and the recap (verification in <anti_cheat>). |
| N-11 | P0 | Bars.dc.html | todo | "Where to?": suggestion, vote or roulette between venues by availability, budget, distance, current happy hours. |
| N-12 | P1 | Bars.dc.html | todo | Venue stats: visits, average spend, average drinks, best nights there. |

## Drinking and going-out habits

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-13 | P1 | Profil.dc.html | todo | Each member's drinking profile: favourite drinks, usual pace, time of first drink, usual leaving time. |
| N-14 | P1 | Profil.dc.html | todo | Crew habits: nights and hours out, frequency, venues, seasonality, calendar heatmap. |
| N-15 | P1 | Profil.dc.html | todo | Monthly recap + yearly crew "Wrapped" (Spotify Wrapped spirit), as shareable stories. |
| N-16 | P1 | Soiree.dc.html | todo | Detailed charts (O-81) filterable by period, venue, drink type, person. |
| N-17 | P2 | Reglages.dc.html | todo | Personal data export (CSV / JSON) and selective deletion. |

## Rounds and money

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-18 | P0 | Argent.dc.html | todo | Rounds: who pays next (fair rotation computed); logging a round adds the drinks to each person AND the expense... |
| N-19 | P1 | Argent.dc.html | todo | Better pools: unequal splits (shares, amounts, percentages), expenses tied to a venue, a party or a trip, rece... |
| N-20 | P1 | Argent.dc.html | todo | Personal party budget with alert. |

## Crew memory

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-21 | P1 | Recap.dc.html | todo | Shared album per party (photos and videos private to the group, O-84) + optional photo when logging a drink (O... |
| N-22 | P0 | Recap.dc.html | todo | Party timeline: arrivals, check-ins, venue takeovers, games played, photos, highlights, built into the recap. |
| N-23 | P1 | Recap.dc.html | todo | "Quote of the night": legendary lines, voted by the crew. |
| N-24 | P1 | Jeux.dc.html | todo | Hall of fame for games and game records. |

## Crew safety

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-25 | P0 | Securite.dc.html | todo | "Home safe": status (O-82) + end-of-night check-in; the crew sees who has not confirmed yet. |
| N-26 | P0 | Securite.dc.html | todo | Designated driver per party: visible badge, reminder if they log a drink. |
| N-27 | P0 | Securite.dc.html | todo | Who goes home with whom, walking each other home, shortcuts to ride-hailing / taxis / night transport. |
| N-28 | P0 | Securite.dc.html | todo | Discreet SOS button: alert to the crew with location (if allowed), shortcuts to 112 and local emergency number... |
| N-29 | P0 | Soirees.dc.html | todo | Gentle alert when a member has given no sign of life for X minutes during a party (extension of O-37). |

## Crew life

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| N-30 | P0 | Systeme.dc.html | todo | Several crews per user, roles (admin / member), invite by link or QR, clean invitation web page when the app i... |
| N-31 | P1 | Radar.dc.html | todo | Crew feed: activity, reactions, mentions, with grouped digests instead of spam. |
| N-32 | P1 | Bar.dc.html | todo | Shared shopping list for a party (who brings what), can be generated from the cocktails picked in the Bar. |
| N-33 | P1 | Jeux.dc.html | todo | Crew-made cards in the games (inside jokes, home-made questions), moderated by the admin. |
| N-34 | P1 | Profil.dc.html | todo | Crew titles and seniority; badges that also reward organising, hydration, designated driving, getting home saf... |
| N-35 | P1 | Reglages.dc.html | todo | Notification centre with fine per-type settings and quiet hours. |

## Everyday polish

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| QOL-01 | P0 | Soiree.dc.html | todo | "Same again": one tap re-logs the last drink (same size, same price, same venue), also from the widget, the no... |
| QOL-02 | P0 | Soiree.dc.html | todo | A night belongs to the evening it started: a configurable day boundary (default 6 am) for stats, recaps, "toni... |
| QOL-03 | P0 | Systeme.dc.html | todo | Actionable notifications: answer "On my way" / "Not tonight" to "who's in?", add a drink, confirm a round or a... |
| QOL-04 | P0 | Systeme.dc.html | todo | System shortcuts for a drunk thumb: Siri / App Intents and Android App Actions ("Hey Siri, add a beer"), iPhon... |
| QOL-05 | P0 | Systeme.dc.html | todo | Deep links and universal links for every party, venue, profile, crew invite, recap and game card. Links pasted... |
| QOL-06 | P0 | Soiree.dc.html | todo | Native sharing: recap and story cards go straight to Instagram Stories, Snapchat (Creative Kit), TikTok and Wh... |
| QOL-07 | P0 | Etats.dc.html | todo | Typed content is never lost: drafts (party name, review, expense, card) survive the app being killed, errors a... |
| QOL-08 | P0 | Arrivee.dc.html | todo | Forms done right: the right keyboard per field (numeric pad with the locale's decimal separator for amounts, e... |
| QOL-09 | P0 | Etats.dc.html | todo | Photos: compressed before upload, background upload with progress and retry, HEIC accepted, location metadata ... |
| QOL-10 | P0 | Soirees.dc.html | todo | Dying battery: when a member's battery drops under 10% during a party, the crew sees "low battery" next to the... |
| QOL-11 | P0 | Etats.dc.html | todo | Names that work: long names, emojis in names, two "Lucas" in one crew disambiguated automatically, initials av... |
| QOL-12 | P0 | Etats.dc.html | todo | Correct plurals and formats everywhere ("1 verre", "2 verres", decimal comma in French), relative times ("5 mi... |
| QOL-13 | P0 | Etats.dc.html | todo | Only destructive actions ask for confirmation, and the confirm button names the action ("Delete the party", ne... |
| QOL-14 | P0 | Backstage | todo | Navigation without traps: Android back and iOS swipe-back work everywhere, sheets close with a swipe, the app ... |
| QOL-15 | P1 | Arrivee.dc.html | todo | Try before signing up: games and the Bar work without an account; sign-up is asked only when the user needs a ... |
| QOL-16 | P1 | Soirees.dc.html | todo | Defaults learned from habits: usual party end time, usual venue, usual drinks first in quick add, the friends ... |
| QOL-17 | P1 | Soirees.dc.html | todo | Suggestions that save taps: when 3+ crew members check in at the same venue, offer to start a party; when the ... |
| QOL-18 | P1 | Securite.dc.html | todo | The user's own apps: directions in Apple Maps, Google Maps or Waze, rides in Uber, Bolt or local taxi apps, ch... |
| QOL-19 | P1 | Argent.dc.html | todo | Long-press copies what people copy (IBAN, codes, addresses), with a haptic and a short inline "Copied". |
| QOL-20 | P1 | Recap.dc.html | todo | Next-morning mode: the morning after, the app opens on a calm, dark, low-contrast screen with the recap, who o... |
| QOL-21 | P1 | Radar.dc.html | todo | Calendar and birthdays: parties added to the phone calendar in one tap; a crew member's birthday reminds the o... |
| QOL-22 | P2 | Securite.dc.html | todo | Last ride home: after midnight, the last night bus / metro departures near the venue on the Party screen, when... |
| QOL-23 | P1 | Etats.dc.html | todo | Search that helps: recent searches, typo tolerance (ADP-05), suggestions before typing, results grouped (venue... |
| QOL-24 | P1 | Reglages.dc.html | todo | Respect the phone: Low Power Mode lowers refresh rates and effects, a data-saver option for photos, light and ... |

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
| ADP-01 | P0 | ModeBourre.dc.html | todo | Level engine: computed from the estimated BAC (O-15), with hysteresis so it never flickers between two levels,... |
| ADP-02 | P0 | ModeBourre.dc.html | todo | Party screen at level 2 (variant of HUB-01). |
| ADP-03 | P0 | ModeBourre.dc.html | todo | Party screen at level 3 (variant of HUB-01). |
| ADP-04 | P0 | Soiree.dc.html | todo | "Heavy fingers" ergonomics: giant targets, no essential action behind a long-press, a precise swipe or a small... |
| ADP-05 | P0 | Soiree.dc.html | todo | Forgiving input: fuzzy search that tolerates typos, suggestions, voice input (see AI-01). |
| ADP-06 | P0 | ModeBourre.dc.html | todo | "Next-morning vault": above a threshold, sensitive actions are locked or queued for confirmation the next day ... |
| ADP-07 | P0 | ModeBourre.dc.html | todo | Legibility: text size, maximum contrast, readable under strobe or very low light, no disorienting motion (effe... |
| ADP-08 | P0 | ModeBourre.dc.html | todo | Battery: automatic eco mode during a party when the battery gets low (fewer refreshes, lighter effects; essent... |
| ADP-09 | P0 | Backstage | todo | Drunk-mode test bench: a tester subagent runs EVERY P0 screen under simulated constraints (one hand, thumb onl... |
| ADP-10 | P1 | Messages.dc.html | todo | Drunk-text guard: the user picks contacts (inside the app) whose messages are held at adaptive levels 2 and 3 ... |

## Motion

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| MOT-01 | P0 | Backstage | todo | Motion system in `MOTION.md`, written before any screen: duration tokens, springs and curves, choreography rul... |
| MOT-02 | P0 | Backstage | todo | Living background within our art direction (no radial halo or generic aurora, see <anti_slop>): it breathes an... |
| MOT-03 | P0 | Soiree.dc.html | todo | Adding a drink: glass filling up, bubbles, BAC digits rolling to the new value, dedicated haptic. It is the mo... |
| MOT-04 | P0 | Soiree.dc.html | todo | Curve: the trace draws itself, smooth colour change when crossing a threshold, clearly marked peak point (no d... |
| MOT-05 | P0 | Backstage | todo | Screen transitions: shared elements (a friend's avatar flies from the list to their profile, a game card grows... |
| MOT-06 | P0 | JeuxCartes.dc.html | todo | Card games: dealing, 3D flip, swipe, drawing, a card that trembles before a penalty. |
| MOT-07 | P0 | JeuxAction.dc.html | todo | Game physics: roulette with real deceleration and haptic clicks, a bomb that shakes harder and harder then bur... |
| MOT-08 | P0 | Recap.dc.html | todo | Cinematic recap: story format, counters rolling, podium rising, curves drawing, badges dropping with confetti,... |
| MOT-09 | P0 | Bars.dc.html | todo | Venue map: takeover (crown dropping, the new boss's colour washing over the venue); venues where the crew is r... |
| MOT-10 | P0 | Etats.dc.html | todo | Micro-interactions: buttons, toggles, custom pull-to-refresh, skeletons, illustrated and animated empty states... |
| MOT-11 | P1 | Systeme.dc.html | todo | Animated widgets and Live Activity, within each OS's limits. |
| MOT-12 | P0 | Backstage | todo | Performance and motion accessibility: 60 / 120 fps without jank, tested on a modest phone, battery budget resp... |
| MOT-13 | P0 | Classements.dc.html | todo | Leaderboards: animated overtakes, podium, a dedicated effect when the leader changes. |

## Bar territories

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| TER-01 | P0 | Bars.dc.html | todo | Venue map: all crew venues (N-08), each in the colour and avatar of its current boss, crown, area of influence... |
| TER-02 | P0 | Bars.dc.html | todo | Rule points: a member earns points at a venue through presence (verified check-ins, time spent there), parties... |
| TER-03 | P0 | Bars.dc.html | todo | Check-ins: one counted check-in per venue per party, a minimum delay between two check-ins; every check-in goe... |
| TER-04 | P0 | Bars.dc.html | todo | Seasons and takeovers: monthly seasons with a reset, "X just took Bar Y from you" notification, history of rei... |
| TER-05 | P0 | Bars.dc.html | todo | Venue page: current boss, season top 5, past bosses, drink prices (N-09), happy hours, the crew's latest night... |
| TER-06 | P0 | Bars.dc.html | todo | Rankings and titles: number of venues ruled, titles ("Mayor of Bar Y", "Conqueror", "Explorer", "Nomad"), tied... |
| TER-07 | P1 | Bars.dc.html | todo | Crew vs crew: which crew rules which venue when several crews use the app. |
| TER-08 | P1 | Bars.dc.html | todo | Fog of war: never-visited venues are "to conquer", conquest suggestions for the next night out (linked to N-11). |
| TER-09 | P0 | Bars.dc.html | todo | Privacy: only check-ins are shared (never continuous tracking for this game), anyone can opt out of the territ... |

## Leaderboards

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| RANK-01 | P0 | Classements.dc.html | todo | Drinking leaderboard per party, week, month, season and all time. Metrics: number of drinks, grams of pure alc... |
| RANK-02 | P0 | Classements.dc.html | todo | Live leaderboard on the Party screen (HUB-01): live positions, "X just overtook you" notification, animated ov... |
| RANK-03 | P0 | Recap.dc.html | todo | Podium in the recap (O-41) and on the shareable story card. |
| RANK-04 | P1 | Classements.dc.html | todo | History and titles: champion of each week, month and season, winning streaks, titles tied to N-34. |
| RANK-05 | P1 | Classements.dc.html | todo | Secondary leaderboards: most nights out, earliest first drink, last one home, most venues ruled (<bar_territor... |
| RANK-06 | P0 | Classements.dc.html | todo | Only verified drinks count (verification in AC-07). Unverified drinks still count in personal stats and BAC. |
| RANK-07 | P0 | Classements.dc.html | todo | Danger cap: above a very high estimated BAC (threshold set by Recon-BAC on the severe-intoxication risk zone),... |
| RANK-08 | P0 | Classements.dc.html | todo | Settings: leaderboard on by default, the crew admin can switch it off, any member can go "off the board" witho... |
| RANK-09 | P0 | Backstage | todo | Feature flag: the drinking leaderboard is on in the crew's private build and can be switched off for a possibl... |

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

## Anti-cheat

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| AC-01 | P0 | Backstage | todo | Server-authoritative scoring: the client only sends raw events (drink logged, check-in attempt, game result). ... |
| AC-02 | P0 | Bars.dc.html | todo | Location source flags, read but never trusted alone. Check the current official docs before implementing. |
| AC-03 | P0 | Bars.dc.html | todo | Server-side plausibility: impossible travel speed between events, accuracy values that are too perfect or froz... |
| AC-04 | P0 | Bars.dc.html | todo | Physical-world corroboration, the hardest signals to fake alone: |
| AC-05 | P0 | Bars.dc.html | todo | Device and app integrity as one weighted signal: App Attest / DeviceCheck on iOS, Play Integrity on Android, j... |
| AC-06 | P0 | Bars.dc.html | todo | Risk score per event: all signals combine into accepted / unverified (needs peer confirmation) / rejected as c... |
| AC-07 | P0 | Soiree.dc.html | todo | Drink fraud: bursts that are physiologically implausible against the BAC model, large retroactive batches, dri... |
| AC-08 | P0 | Backstage | todo | Replay and tampering protection: signed requests, nonces, server timestamps, idempotency keys, rate limits. Th... |
| AC-09 | P0 | Etats.dc.html | todo | Consequences: a rejected event earns nothing and is recorded as a "cheat attempt", visible to the crew (notifi... |
| AC-10 | P0 | Backstage | todo | Red team: a dedicated subagent attacks our own app and backend (mock location, location simulated from a compu... |

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
| SLOP-04 | P0 | Backstage | todo | Automated CI lint on every localisation file: em and en dashes, blacklisted words, "successfully" / "avec succ... |
| SLOP-05 | P0 | Backstage | todo | Fresh-eyes test: a screenshot or a text pasted into a blank model session with the question "which AI tool mad... |
| SLOP-06 | P1 | Backstage | todo | Crew panel: before each release, the friends read the copy and the cards. Anything that "sounds like AI" or "d... |
| SLOP-07 | P0 | Backstage | todo | Fresh context: subagents writing copy start a new session with `VOICE.md` + `SLOP.md`, because long contexts m... |
| SLOP-08 | P0 | Backstage | todo | Design: `DESIGN.md` explicitly bans the <design_patterns> tells. If the stack allows it, an automated detector... |

## Sync and feedback

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| SYNC-01 | P0 | Etats.dc.html | todo | Optimistic updates for every user action (add a drink, check in, react, vote, RSVP, change a setting, add an e... |
| SYNC-02 | P0 | Etats.dc.html | todo | Pending is not success. Optimistic items carry an internal "pending" state until the server answers. Outcomes ... |
| SYNC-03 | P0 | Etats.dc.html | todo | Reconciliation: on success, the optimistic item is replaced by the server's version (server IDs, server-comput... |
| SYNC-04 | P0 | Etats.dc.html | todo | Error types, each with its own behaviour: |
| SYNC-05 | P0 | Etats.dc.html | todo | The client state is a cache of the server. On reconnection and every time the app returns to the foreground, i... |
| SYNC-06 | P0 | Etats.dc.html | todo | Offline queue: queued mutations survive the app being killed, keep their order, are idempotent, and go through... |
| SYNC-07 | P0 | Etats.dc.html | todo | One feedback system for the whole app (toasts, inline errors, banners): success shows no toast unless it bring... |
| SYNC-08 | P0 | Backstage | todo | Tests for every mutation: success, rejection, timeout, duplicate send, offline then rejected, app killed mid-r... |

## Security and privacy

| ID | Priority | Board | Status | Summary |
|---|---|---|---|---|
| SEC-01 | P0 | Backstage | todo | Data minimisation in every response: each endpoint returns a shape built for its use case, never a whole datab... |
| SEC-02 | P0 | Backstage | todo | Authorisation on every object and every field (OWASP API Security Top 10: broken object-level authorisation, b... |
| SEC-03 | P0 | Backstage | todo | Encryption in transit: TLS 1.2 minimum, 1.3 preferred, everywhere; certificate pinning for the API (AC-05); HS... |
| SEC-04 | P0 | Backstage | todo | Encryption at rest on the server: storage and database encryption, plus application-level envelope encryption ... |
| SEC-05 | P0 | Backstage | todo | Encryption on the device: tokens and keys in the iOS Keychain / Android Keystore, local database encrypted, se... |
| SEC-06 | P0 | Backstage | todo | Retention: precise location points are deleted once the recap is built (N-07); raw GPS data of a check-in is d... |
| SEC-07 | P0 | Reglages.dc.html | todo | Accounts: passkeys first; passwords, if any, hashed with Argon2id; list of active sessions with remote sign-ou... |
| SEC-08 | P0 | Arrivee.dc.html | todo | GDPR: alcohol consumption and BAC may count as health data under GDPR article 9, which means explicit consent,... |
| SEC-09 | P0 | Backstage | todo | Secure development: a threat model (STRIDE) per major feature in `SECURITY.md`, secret scanning, static analys... |
| SEC-10 | P0 | Backstage | todo | Export compliance for encryption: App Store encryption questions, US export rules, and the French ANSSI declar... |
