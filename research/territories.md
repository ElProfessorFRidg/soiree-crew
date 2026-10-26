# Recon-Territories: scoring and seasons for the bar territory game

Report for TER-01 to TER-09, with COM-03, COM-06, PROF-05, AC-01 and SEC-06 as constraints. Phase 0, no product code.

## 1. Summary

- Every working presence game counts **days or nights, not taps**. Foursquare counted one check-in per day over 60 days, then 30 days. Strava Local Legends counts efforts over a rolling 90 days. Untappd gives badge progress once per 24 h. We count **one check-in per venue per night** (06:00 to 06:00), even when the member is in more than one party that night.
- Points must not compound. Turf pays points per hour of holding, Ingress paid for days held, Pokémon GO pays coins for time defended. Each of those games then needed decay, caps or retirement: Ingress retired its Guardian medal in 2018 because of spoofing and griefing. **Holding a venue earns no points here.** The monthly reset (TER-04) does the job decay does in games with no seasons, so there is **no decay inside a season**.
- Tie verification to rewards and nothing else. Foursquare's 2010 "cheater code" still let anyone check in anywhere, but refused points for unverified locations. It also caused false rejections that had to be fixed. Our "unverified" state (AC-06) waits for confirmation from a friend instead of rejecting.
- Swarm's 2014 friend-only mayorships showed that competing among friends is meaningful. The 2015 backlash showed people also want a wider stage. The crew game is the core, and COM-03 "Legend of Bar Y" is the opt-in public layer, scored only on presence.
- Proposed formula, per member, venue and night: check-in 10, time at venue up to 18 (capped at 3 h), organiser 12, game wins up to 10, first discovery 20 (once ever). The boss is the member with the most season points (minimum 15). A tie keeps the current boss.
- Time at venue is measured without continuous tracking. It runs from check-in to the earliest of a set of discrete events (next check-in, "Heading home", end of the party, leaving the venue's geofence). It is only credited up to 20 min after the last proof of presence.
- Each abuse case listed in section 3.7 has a counter. The two that need new IDs are excluding a member's own workplace and making a new venue validate before it can be played.

## 2. Findings

### 2.1 Foursquare and Swarm mayorships

- **2010 rule:** mayor = checked in on the most days in the last 60 days, and only one check-in per day counts. In August 2010 the check-in screen began showing "days away from mayor" instead of check-ins (TechCrunch, 26 Aug 2010). Lesson: the unit is the day, and showing the distance to the crown motivates people.
- **2010 cheater code:** GPS and Wi-Fi verification. Anyone could still check in anywhere, but unverified check-ins earned no points, badges or mayorships. The trigger was venues giving discounts to mayors: rewards with real value made cheating worth it. Foursquare had held back earlier because of Gowalla's indoor GPS false rejections, and legitimate users then hit "too far away" errors that needed fixes to reduce false positives (TechCrunch 7 Apr 2010, Network World). Lessons: (a) never let a venue attach real perks to a crown (this matters for COM-11); (b) design for false positives from day one.
- **2014 split:** check-ins moved to Swarm, mayorships became friends-only, and a venue could have many mayors. Foursquare said this made mayorships "more attainable" and set friends against friends rather than strangers. Users complained about the loss of the game, and 2014 coverage called it the "death of badges and mayors" (VentureBeat, Droid Life).
- **2015 return:** global mayorships came back. Mayor = most check-ins in the last 30 days, only one per day counts, and **ties go to the reigning mayor** (Droid Life, 22 Jun 2015). Swarm also added coins: a check-in pays 1 to 10+ coins depending on how rare it is, new places and check-ins with friends pay more, and there are streak and mayorship bonuses. A weekly leaderboard resets while coin balances persist (TechCrunch 2015, The Points Guy 2017). Lessons: we take incumbent-wins-ties, the bonus for new places (discovery), and the bonus for being with friends (corroborated check-ins earn more than solo ones).
- **2024 onward:** Foursquare City Guide closed (app on 15 Dec 2024, web on 28 Apr 2025). Swarm absorbed search, tips and ratings. The app got a July 2025 update and is on version 7.x (Wikipedia, AppDeveloper Magazine, PhoneArena). **I could not find a source for the current Swarm mayorship rules after 2024** (A-TER-3). Lesson: once the discovery app was folded in, the check-in-and-game app was the one Foursquare kept, so the social check-in loop is the part that lasts.

### 2.2 Gowalla

- The original app ran from 2009 to 2012 (founders hired by Facebook, service shut down). It relaunched on 10 Mar 2023 as a map-first app: check in with trusted contacts, see friends' check-ins, stamps, and a paid "street team" tier. Active development paused on 20 Apr 2023 (TechCrunch, Wikipedia). Lessons: sharing by check-in only, with trusted friends, is a privacy model people accept, and it matches TER-09. Novelty alone did not keep users. The 2010 Foursquare article cites Gowalla's strict indoor GPS rejections as the problem to avoid.

### 2.3 Turf

- Rounds last about a month. Round points and zone ownership reset, lifetime points carry over and decide rank. Taking a zone pays 65 to 185 takeover points, plus 50 for a neutral zone. A revisit pays half. Everyone who assists gets the takeover points. Only the owner earns 1 to 9 points per hour (TP = 200 − 15 × PPH, so a zone held 15 h always yields 200). The core rule is physical presence, and spoofing counts as cheating (Turf wiki, Wikipedia, ESOC club notes). Lessons: monthly reset plus a lifetime layer works for years. Sharing a capture among everyone present maps to our shared discovery bonus. Points per hour for holding are exactly the compounding loop we avoid.

### 2.4 Ingress

- Resonators decay 15% a day unless recharged, which forces upkeep. The Guardian medal paid for consecutive days a portal was held (3, 10, 20, 90 and 150 days). It was **discontinued on 2 Apr 2018 because of "widespread cheating"** (scraping and GPS spoofing) aimed at taking down opponents' Guardian portals (Ingress wiki, fevgames). Lesson: a big reward for a long reign makes a target, and attackers will cheat to hit it. Reign length here is cosmetic (history, a "longest reign" stat). It is never points, and it ends with each season.

### 2.5 Pokémon GO gyms

- The June 2017 rework replaced Prestige with motivation decay. A defender's CP drains over time (about 1 to 10% an hour, scaling with CP, per community measurements) and drops about 28% of max CP per lost battle. Berries restore it with diminishing returns. Niantic's stated aims were ending "camping" and creating interaction (TouchArcade, GamePress, Kotaku). The rework was needed because gyms had no reset.
- **Coins for defending are capped:** 1 coin per 10 min (6 an hour), 50 a day per account, reached after about 8 h 20 min. A 2020 regional test with a 30-coin gym cap was rolled back after player feedback (GamePress, pokemongo.com news). Lesson: rewards for time spent need a daily cap and a concave curve. Our time-at-venue score is concave and capped at 3 h a night.
- **Gym badges** progress for any team and never transfer: about 1,000 points per raid, 100 for placing a defender, 10 per berry, 1 per minute of defending. Tiers are Bronze 500, Silver 4,000 and Gold 30,000 (Bulbapedia, iMore). Lesson: next to the rival crown, give everyone a personal tier per venue that nobody can take (proposed TER-10).

### 2.6 Strava segments and Local Legends

- Local Legend = most efforts on a segment over a **rolling 90 days**. It rewards repeat participation, not speed. It was built so everyday riders can earn recognition that KOM leaderboards rarely give them. **Private activities do not count.** The top 10 get notified, and a progress graph shows how many more efforts are needed to take the title (BikeRadar, DC Rainmaker, Jun 2020). This is the closest model to TER-02. Lessons: rank by presence, show "nights needed to take it", and private check-ins never count (TER-09).
- **Leaderboard integrity:** Strava says its ML uses 57 factors (speed, acceleration and others) to flag vehicle activities. Since 2024 it auto-removes "irregular, improbable or impossible" efforts and holds back faulty GPS data, alongside manual flags from athletes. It reports 4.45 M activities removed from leaderboards in a year (company figures) (TechCrunch 16 May 2024, Cycling Weekly, road.cc). Lesson: automatic plausibility checks plus social flagging, as in AC-03 and AC-09.

### 2.7 Untappd badges

- Some badges progress **once per 24 h** and level up at most **once every 20 days**. Monthly badges use a **moving 30-day window** and need an account at least 30 days old. Venue badges are not awarded beyond 60 miles from the venue, though progress still counts. There are automated systems against coordinated rating abuse (Untappd help centre). Lessons: cap progress per day, require a minimum account age before an account can corroborate anyone (alt accounts), and a sync that arrives late can still count once it is verified.

### 2.8 Zenly

- Zenly was map-first, with ghost mode (freeze or blur your location) and a **fog of war** that cleared where you had walked ("Footsteps", 2018, built into the map in 2022). It had 35 M MAU in 2022 and Snap shut it down on 3 Feb 2023 for cost reasons (TechCrunch May 2022, Mapbox, Life360). Lesson: fog of war is well loved, but Zenly cleared it from continuous tracking. **Ours must clear only through accepted check-ins** (TER-08, TER-09).

### 2.9 Game design writing: feedback loops and resets

- Positive feedback loops ("the rich get richer") make the early leader unbeatable. Negative loops (Mario Kart's item balance, rubber-banding) keep people in contention but feel unfair when strong. Good competitive games mix both (Chemeketa game reader, bugnet, Systems and Us). Applied here: the point sources stay linear and capped per night, so no compounding. The monthly reset is the catch-up. The one mild bias, ties going to the incumbent, gives stability without compounding.

### 2.10 What the prototype already fixes (Bars.dc.html)

- The boss is shown as "Inès, boss du mois, 18 points. Toi : 16." A real check-in takes the user from 16 to 19 and the takeover screen says "Le Zinc est à toi", which implies a check-in is worth about 3 points. **This report rescales points** (check-in = 10). The design should keep the mechanics shown and change only the numbers.
- The check-in goes through four visible signals: coherent position, position not simulated, a crew member nearby (Bluetooth), phone integrity. A fake GPS attempt shows "Check-in refusé", a crew-visible "tentative de triche" for 7 days that an admin can cancel, and a "Tricheur du week-end" tag. This matches AC-09 and stays as is.
- Season screen: the month resets on the 1st, with "Malik est à 2 points de te prendre La Capsule". Titles shown: "Maire du Zinc", "Explorateur", "Nomade", "Conquérant, mai". It also lists crews holding bars ("Les Quais tiennent 6 bars"), a "to try" (never visited) list, a toggle to take part in the game and a "private check-in by default" toggle. All of these are specified below.
- Venue page: "Légende du Zinc, saison de mai" (COM-03) and the line "Points au check-in, au temps passé, aux soirées organisées et aux jeux gagnés ici. Jamais aux verres." That line is the TER-02 rule and must stay.

## 3. Decisions proposed

Every constant below is part of a versioned rule set, `territory_rules_v1`, kept in remote config. A season **freezes the rule version in force at its start**. Changes apply from the next season, unless an admin correction replays the season (section 3.3). Reason: AC-01 requires replayable scoring, and players need rules that do not move under them mid-month.

### 3.1 Definitions

- **Night:** 06:00 to 06:00 in the crew's time zone. A night belongs to the season of its start date, so the night of 31 Oct into 1 Nov counts for October.
- **Territory venue:** a venue of type bar, club or public spot in the crew directory (N-08) that has been validated (section 3.7, case F). **Flats and private homes are never territories.** The host would always win, and a home address would turn into a map pin. They stay as places for parties.
- **Counted check-in:** a check-in at a territory venue that AC-06 accepts, made by a member who takes part in the game, not private, and not the first check-in rejected by the limits below.
- **Vesting:** a counted check-in earns its points only once the member has 15 min of time at the venue. Before that it shows as "pending".
- **Corroborated:** while the check-in is open, at least one other crew member (an eligible corroborator, section 3.7, case B) either has a counted check-in at the same venue within ±30 min, or completes a BLE handshake with this member (AC-04). A rotating QR code or a live photo seen by the crew also counts.
- **Solo:** accepted by AC-06 without corroboration. A solo check-in can still be counted, with lower caps.

### 3.2 Scoring formula (TER-02, TER-03)

Points are computed per member, venue and season. Each night adds at most the sum of the rows below. **No row uses drinks, grams of alcohol, BAC or spending.** The scoring engine does not receive those events at all, as a structural guarantee and not just a rule.

| Source | Points | Conditions and caps |
|---|---|---|
| Check-in | **10** | One counted check-in per venue per night, whatever the number of parties. Vests after 15 min. Leaving and coming back the same night resumes the time count but does not add another 10. |
| Time at venue | **0 to 18** | Concave curve (table below), capped at 180 min a night per venue. A solo check-in is capped at 60 min (9 points). |
| Organiser | **12** | Goes to the party's organiser, set when the party is created and not transferable after the party starts. It is earned at a venue where at least 3 distinct crew members, the organiser included, have vested check-ins during that party. At most 2 venues per party. |
| Game won | **5 per win** | The game is played during the party, server-side result, at least 3 human participants who each have a vested check-in at that venue. At most 2 wins per member per venue per night (10) and 6 per member per venue per season. |
| First discovery | **20, once ever** | The venue's first counted check-in by anyone in the crew, ever. Every member whose counted check-in lands within 15 min of the first one shares the bonus. Paid only once the venue is validated. At most 3 discovery bonuses per member per season. Never paid again after a reset. |

**Time-at-venue curve** (whole minutes, integer points):

| Minutes at venue | Points earned | Running total |
|---|---|---|
| 0–15 | 0 (vesting window) | 0 |
| 15–60 | +1 per full 5 min | 9 at 60 min |
| 60–120 | +1 per full 10 min | 15 at 120 min |
| 120–180 | +1 per full 20 min | 18 at 180 min |
| after 180 | 0 | 18 (cap) |

Reference values: 45 min → 6, 90 → 12, 150 → 16, 180+ → 18.

Maximum for one member, venue and night: 10 + 18 + 12 + 10 + 20 = 70, which is rare. A typical full night is 28 (check-in plus 3 h). The cap is meant to stop rewarding staying late after 3 h. Going home early costs at most 18 points, and "Heading home" never takes points away.

**How time at venue is measured without continuous tracking (TER-09, SEC-06)**

- **Start:** server time when the check-in is accepted.
- **End:** the earliest of: a counted check-in elsewhere; "Heading home"; the end of the party; a geofence exit. The geofence is an OS region of 100 m around the venue, registered only while the member is checked in during a live party. The device sends only "exited" and the server time, never coordinates (A-TER-2).
- **Proof ceiling:** time is credited only up to the **last proof of presence + 20 min**. Proofs are discrete events at the venue: the check-in itself; a BLE handshake with another checked-in member; a game played at the venue; a one-tap "still here" re-check. The re-check is a verified location sample that is discarded after the verdict, and the app prompts for it 60 and 120 min after check-in when no other proof exists. **Drink logs are never proofs.** Using them would bring drinking back into the score.
- Example: check in at 22:00, last BLE handshake at 22:40, no other proof, party ends at 03:00. Credited time = 22:00 to 23:00 = 60 min = 9 points.

**Check-in limits (TER-03)**

- **Minimum delay between two counted check-ins** by the same member, at any venues: **20 min**, plus the AC-03 travel-speed check.
- **At most 6 counted check-ins per member per night.**
- **Solo check-ins count on at most 2 nights per member per week** (Monday to Sunday). Later solo check-ins are recorded with 0 points.
- Check-ins outside the venue's opening hours are rejected (AC-03).
- A check-in made while the member is opted out, or marked private, scores 0 and **can never be converted** later.
- Events queued offline (AC-08) score only once verified, using the server time of the proof. A check-in whose device time is more than 10 min from the server time on upload is marked unverified until a crew member corroborates it.

**Boss (TER-02)**

- Boss of a venue = the eligible member with the highest season points there, with **at least 15 points and one vested check-in this season**. Below that the venue is "up for grabs".
- **Tie-breaks, in order:** (1) more counted nights at the venue this season; (2) more credited minutes at the venue this season; (3) the current boss keeps the crown (Swarm 2015); (4) the first to reach the tied total, by server time.
- Recalculated on every scoring event and by a 5-min job during live parties.

### 3.3 Seasons, reset, reigns and alerts (TER-04)

- **Season = calendar month** in the crew's time zone, as TER-04 and the prototype require. It **starts at 06:00 on the 1st**.
- **Reset:** all season points go to 0. Lifetime stats are kept (venues visited, nights per venue, reigns, titles, discovery marks).
- **Ghost crown:** each venue shows last season's Mayor faded and marked "defending" until someone reaches 15 points. Whoever gets there first takes it, the previous Mayor included. This avoids a blank map on the 1st and gives every month an opening race.
- **Closing:** the season ends at 06:00 on the 1st. A **12-hour window** follows for offline events and verdicts. Final standings and titles are published at **18:00 on the 1st** as a season recap card. **Admin corrections** (AC-09 overturns) are accepted for **7 days** after publication. They trigger a full replay of the season from the event log, and any reissued title comes with a notice. After 7 days the season is frozen.
- **What replay covers:** the inputs are the stored events and their AC-06 verdicts. Raw GPS is deleted after verification (SEC-06), so the risk model is not re-run. An admin changes a verdict, and replay rebuilds points, bosses and reigns deterministically. Notifications are never re-sent by a replay.
- **Reign:** an interval during which a member is boss of a venue. It is stored with venue, member, server start and end time, the reason it ended (taken by X / season end / boss left the game / points cancelled) and peak points. A reign always ends at the season close. The same person winning again starts a new reign and raises a "consecutive seasons" counter. The venue page shows the current season's reigns and the list of past Mayors. The profile shows "longest reign". **Reign dates and lengths are visible to the crew and to friends only.** Strangers see at most "Mayor of Le Zinc, May 2026" (PROF-05, COM-06).
- **"X just took Bar Y from you":** the server state is exact, but **notifications are delayed by 30 min** so a back-and-forth on one night produces one notification for whoever holds the venue when things settle. It goes to the dethroned boss only (push plus the map animation, MOT-09). The takeover also appears in the party timeline (N-22).
- **"About to be dethroned" alert threshold:**
  - **Gap alert:** a challenger is within **10 points** (one check-in) of the boss.
  - **Live alert:** a challenger has an open vested check-in at the venue and could pass the boss tonight with the time points still available, as in "Malik can take La Capsule tonight". This only reveals a check-in the boss can already see under crew rules. A private check-in never triggers it.
  - **Limits:** at most 1 alert per venue per boss per 24 h, and 3 per boss per night across all venues. The passive in-app banner (prototype: "Malik est à 2 points de te prendre La Capsule") is always shown when the gap is 10 points or less.
- **Out-of-reach honesty:** when the gap is larger than what the challenger could earn on the nights left in the season (each night counted at 28), the venue page says so and points to other targets (section 3.5). People should not be strung along.

### 3.4 Titles (TER-06, with N-34)

| Title (FR) | Unlock rule | Duration |
|---|---|---|
| **Boss** of X (boss) | Live crown under the rule in 3.2. | While held |
| **Mayor of X** (Maire de X) | Boss of X when the season closes. | Permanent, shown as "Mayor of X, Nov 2026". It is the active badge until the next season closes. A counter shows consecutive seasons. |
| **Conqueror** (Conquérant) | One per crew per season: the member with the most **venue-days** ruled in the season (days as boss, summed over venues, 0.1-day precision). Requires ruling at least 2 distinct venues during the season, or 3 if the crew has 10 or more territory venues. Ties: more distinct venues ruled, then most points across all venues. | Permanent, seasonal ("Conqueror, Nov") |
| **Explorer** (Explorateur) | Lifetime distinct territory venues with a counted check-in. Tier I = 5, II = 15, III = 30, IV = 50. Private and rejected check-ins never count. | Permanent, tiered |
| **Nomad** (Nomade) | In one season, counted nights at **4 or more distinct venues**, and no single venue above 50% of your counted check-ins that season. Several members can earn it. | Permanent, seasonal |
| **Discoverer of X** (Découvreur) | Shared the first-discovery bonus at X. | Permanent mark on the venue page, crew only |
| **Regular of X**, Bronze/Silver/Gold (Habitué) | Lifetime counted nights at X: 3, 10, 25. Never lost. Inspired by Pokémon GO gym badges (proposed TER-10). | Permanent |
| **Legend of X** (Légende de X, COM-03) | Public, opt-in (PROF-09). Top regular at X across all crews **by presence points only** (check-in plus time), at least 3 counted nights in the season, accepted check-ins only (unverified ones excluded). Ties share the rank. | Permanent, seasonal |

Conqueror counts venue-days instead of venues held on the last night, so a last-day sweep before the reset cannot steal it. Holding a venue earns a title and never points, which keeps the scores linear.

Crew titles (N-34): "Crew of X" (section 3.5), and a crew badge for the most Mayors held across a season.

### 3.5 Crew vs crew (TER-07) and fog of war (TER-08)

**Crew vs crew**

- A check-in counts for the crew of the **party it was made in**. A member is in at most one party at a time, so people in several crews cannot double-count.
- **Crew presence score** at a venue = sum of the season presence points (check-in plus time only, no organiser or game points) of the crew's **top 3 contributors**, with at least 2 contributors. Taking only the top 3 lets a crew of 5 compete with a crew of 30. Organiser and game points stay out because they are internal to each crew and could be inflated.
- **Crew of X** = the crew with the highest presence score. Tie-breaks: more distinct contributors, then the incumbent crew, then the first to reach the total.
- **Privacy (COM-04, COM-06):** only crews whose admin opted in are shown by name. A crew that did not opt in is shown as "a crew" or left out. Crews with fewer than 3 members are never shown. Standings are **recomputed once a day at 12:00 for the nights before** and never live, so a rival crew can never learn where a crew is tonight. Other crews see totals rounded to 5 and never individual contributions. Crew takeover notifications go out with that daily update.

**Fog of war**

- **Crew fog:** a territory venue (or a candidate from COM-10 discovery or the directory) with no counted check-in by any crew member, ever, shown as "to conquer". **Personal fog:** a venue the member has never checked in at. The map shows crew fog by default, and a toggle switches to personal fog.
- Fog clears only with a counted check-in. A private check-in clears only your own personal fog, visible to you alone. Unverified and rejected check-ins clear nothing. Fog never comes from location history (there is none).
- **Conquest suggestions for "Where to?" (N-11):** up to 3, one of each kind when available. **Discover:** the nearest open venue still in fog, worth +20. **Attack:** the venue where the gap between the boss and the best member likely to go tonight (status N-01) is smallest and at most 28 points, so it is winnable in one night. **Defend:** a venue where a crew member is within 10 points of losing it. Suggestions use crew data only, never strangers' presence.

### 3.6 What gets boring, and how the design avoids it

| Failure mode | Seen in | Counter |
|---|---|---|
| One very social member sweeps every venue | Rich-get-richer loops; Turf points per hour | No points for holding. Caps per night. Monthly reset. Organiser and game points rotate around the crew. Nomad, Explorer and Regular tiers reward people who never hold a crown. |
| The whole crew always goes out together, so scores are identical | Specific to friend groups (worked example: presence-only at Le Zinc is 81-81-81) | Organiser and game points break the symmetry. The tie-break chain is deterministic. |
| A lead in week 1 decides the month | Positive loops | A night is worth at most about 28 to 70, so a lead is "a night or two". "Nights needed" is shown (Strava's progress graph). Out-of-reach is said honestly, with other targets suggested. |
| A permanent incumbent nobody can touch | Pokémon GO before 2017, Ingress Guardian | Monthly reset with an opening race for the ghost crown. Long reigns are cosmetic only. |
| Too many notifications | General | 30-min delay on takeovers. Alert limits (1 per venue per 24 h, 3 per night). Crew vs crew updates once a day. A season recap instead of a stream of pushes. |
| A small crew with few venues, so the map goes stale | Specific to crews of 5 | Fog of war plus a "Discover" suggestion every night out. Explorer tiers. Nomad threshold set at 4 venues. |
| Same rules every month | Swarm and Foursquare decline once the game is the only draw | **Season variants** (proposed TER-12): one per month, announced on the 1st, for example "discovery ×2" or "game wins ×2 (still capped)", never touching drinks. Part of the frozen rule version, so replay still works. |
| No stage beyond the crew | Swarm 2014 backlash | COM-03 Legend of X, opt-in and presence-only. |
| Rewarding staying late or drinking more | Safety (RANK-07 spirit) | Time cap at 3 h. Drinks are never an input or a proof. Leaving never costs points. |

### 3.7 Abuse cases and counters

| # | Abuse | Counter |
|---|---|---|
| A | **Farming**: repeated check-ins, check in and leave, bar-crawl tapping, several parties in one night to repeat check-ins | One per venue per **night** (not only per party). 20-min minimum delay. 15-min vesting. Time cap of 3 h, credited only up to the last proof + 20 min. 6 counted check-ins per night. Solo check-ins on at most 2 nights a week, with a 60-min time cap. A crawl of 6 venues yields many small check-ins and no crowns, which is fine because it earns Nomad. |
| B | **Alt accounts**: a second phone or account to provide corroboration, meet the organiser quorum or fill a game | Joining a crew needs an invitation and admin approval. A corroborator, quorum member or game participant must (1) have an account at least 14 days old, (2) have at least 2 past nights corroborated by 2 other distinct members, and (3) have a distinct device-integrity identity (App Attest / Play Integrity, AC-05; the same device behind two accounts is flagged). Coordinates identical to the metre or matching trajectories across two accounts, AC-03, are flagged as one person. The attendee list is visible to the crew, so social checking applies. |
| C | **Collusion between two friends**: confirming each other's fake check-ins, throwing games, one-tap confirmation from home | A one-tap peer confirmation counts for points **only** if the confirmer has their own accepted check-in at that venue or a BLE handshake (stricter than AC-04's "confirms in one tap", which still unlocks personal stats). **Pair concentration:** if more than 60% of a member's corroborations this season (with at least 4) come from the same single person, those corroborations count as weak and the check-in needs a third signal. Games need 3 or more participants checked in at the venue, with caps of 10 a night and 30 a season per venue. The organiser is set at party creation and cannot be handed over. Trading venues ("you take Le Zinc, I take Capsule") is allowed: it is real play, both people still have to be there, and the caps limit it. |
| D | **A bar you work at** (or live above) | **Workplace exclusion** (proposed TER-11): a member can declare "I work here", and any crew member can suggest it for admin approval. That member earns 0 territory points at that venue and cannot be its boss or Legend. Check-ins still appear in the timeline. Automatic prompt to the admin when someone has counted check-ins at one venue on 3 or more nights a week for 2 weeks, mostly solo or with time at the cap: "regular or staff?". Check-ins outside opening hours are rejected. A shift longer than 3 h earns nothing extra. The weekly solo cap already limits someone living above the bar. |
| E | **Location spoofing or a modified client** | No points until AC-06 accepts. Mock and simulated location flags (AC-02), plausibility checks (AC-03), peer and BLE corroboration (AC-04), integrity (AC-05). A rejected attempt is visible to the crew (AC-09, the 7-day badge from the prototype). The public Legend uses accepted check-ins only. |
| F | **Fake or duplicate venues** (a "bar" at home to farm discovery and always be boss) | A new venue becomes a territory only once it matches an external place ID (A-TER-6) **or** has corroborated check-ins from at least 2 members on 2 different nights. Homes are never territories. The discovery bonus is held until validation. Merging duplicates combines points, and discovery goes to whoever was earliest. At most 3 discovery bonuses per member per season. |
| G | **Clock tampering, replayed events, late offline batches** | Server timestamps, nonces, signatures (AC-08). A device clock more than 10 min off on upload means unverified until corroborated. Offline events score only after verification. |
| H | **Opt-out games**: dodging alerts, hiding and then sniping, private check-ins turned public later | Nothing accrues while opted out or private, and nothing converts afterwards. Opting out ends your reigns immediately ("left the game") and hands each venue to the next eligible member. Rejoining restores only the points earned this season before opting out. One rejoin per 7 days. |
| I | **Using the game to track someone**: alerts or the map revealing where a person is | Alerts and the map only show check-ins the viewer can already see under crew rules. Private check-ins trigger nothing. Crew vs crew data is daily and delayed. The public Legend shows no dates, weekdays or times, and is built from season totals updated at most once a day, never "here now" (COM-06, PROF-05). Blocked users see nothing (PROF-08). |
| J | **Party inflation**: fake parties to collect the organiser bonus | Quorum of 3 eligible members with vested check-ins at that venue. At most 2 venues per party. One check-in per venue per night, so a second party adds nothing. |
| K | **Real perks for crowns** (raising the stakes the way Foursquare's mayor discounts did) | Owners of claimed pages (COM-11) cannot attach offers to boss, Mayor or Legend status. Crowns stay purely social. |

### 3.8 Worked example: one month, 6 members, 4 venues

Crew: Hugo, Inès, Malik, Jade, Sam, Léa. Season: November 2026. Venues: **Le Zinc (Z)**, **La Capsule (C)**, **Quai 12 (Q)**, and **Chez Odette (O)**, which is in fog at the start. October Mayors: Z Inès, C Hugo, Q Jade, O none. All check-ins below are accepted and corroborated unless marked solo. The arithmetic was checked with a script. "Time" is credited minutes.

| Night | Organiser | Venue: member (time, extras) → points this night → season total at venue | Boss afterwards |
|---|---|---|---|
| Fri 6 | Inès | **Z**: Inès (180, org) 40→40; Hugo (150, 1 win) 31→31; Malik (120, 1 win) 30→30; Sam (180) 28→28; Jade (90) 22→22 | Z: Inès reclaims the ghost crown |
| Sat 7 | Hugo | **C**: Hugo (120, org) 37; Léa (120, 2 wins) 35; Malik (120) 25; Jade (60) 19. Then **Q** (20+ min later): Hugo (60, org, 2nd venue) 31; Malik (90) 22; Léa (90) 22 | C: Hugo. Q: **Hugo takes it** (Jade had a ghost crown and 0 points) |
| Thu 12 | — | **Q**: Jade solo (120 at the venue, solo cap 60) 19→19. Sam tries a check-in at O from his sofa with fake GPS → **rejected**, 0 points, cheat badge for 7 days | unchanged |
| Fri 13 | Malik | **Z**: Malik (180, org, 2 wins) 50→80; Sam (180, 1 win) 33→61; Hugo (180) 28→59; Jade (120) 25→47; Léa (120) 25→25 | Z: **Malik takes it from Inès** ("Malik just took Le Zinc from you") |
| Sat 14 | Jade | **O**, first visit by the crew: Jade, Inès, Léa and Sam check in within 15 min → +20 discovery each once O is validated (external place ID). Jade (180, org) 60; Inès (150, 2 wins) 56; Léa (120) 45; Sam (90) 42 | O: Jade, first ever boss. 4 Discoverer marks |
| Fri 20 | Inès | **Z**: Inès (180, org, 1 win) 45→85; Jade (180, 1 win) 33→80; Hugo (120) 25→84; Sam (120) 25→86. Malik (80) is not there. Malik gets the live alert "Sam can take Le Zinc tonight". Jade reaches 80 and ties Malik: **the incumbent keeps it**. Then Inès, Hugo and Sam all pass 80; after the 30-min delay only the final holder is announced | Z: **Sam**, 86 to Inès 85 |
| Sat 21 | Hugo | **C**: Hugo (180, org, 1 win) 45→82; Léa (180, 1 win) 33→68; Malik (120) 25→50. Gap 14 > 10, no alert | C: Hugo |
| Fri 27 | Malik | **Z**: Malik (180, org, 1 win; quorum Malik, Inès, Léa) 45→125; Inès (120) 25→110; Léa (90) 22→47 | Z: **Malik takes it back from Sam** |
| Sat 28 | Jade | **Q**: Jade (120, org) 37→56; Sam (120) 25; Inès (90) 22. Then **O**: Jade (60, org, 2nd venue) 31→91; Inès (60) 19→75; Sam (60) 19→61 | Q: **Jade takes it from Hugo** (56 to 31). O: Jade |
| Mon 30 | — | **O**: Inès solo (90 at the venue, capped at 60) 19→94. When her check-in vests (85 against 91, potential 94), Jade gets "Inès can take Chez Odette tonight". Jade doesn't come | O: **Inès takes it from Jade** on the last night |

**Season close (1 Dec, 18:00):**

- **Mayors:** Le Zinc → Malik (125), La Capsule → Hugo (82), Quai 12 → Jade (56), Chez Odette → Inès (94). Four different Mayors among six members.
- **Venue-days** (approximate times): Hugo C 23.4 + Q 21.0 = **44.4** → **Conqueror of November** (2 venues ruled). Jade O 16.1 + Q 2.3 = 18.4. Malik Z 7.1 + 3.3 = 10.4. Inès Z 7.1 + O 0.3 = 7.4. Sam Z 6.9. Inès's one-night grab of Chez Odette makes her Mayor, but it barely counts toward Conqueror. That is the intended result.
- **Nomad:** Léa (C 2, Q 1, Z 2, O 1 → 4 venues, top 33%) and Jade (Z 3, C 1, Q 2, O 2 → 4 venues, top 38%). Léa never ruled a venue but earns Nomad.
- **Explorer:** nobody yet, since the crew only has 4 venues and Explorer I needs 5. The suggestions for December lead with "Discover".
- **Regular of Le Zinc, Bronze** (3 nights): Inès, Hugo, Malik, Sam, Jade.
- **Why organiser and game points matter:** with presence alone, Malik, Inès and Sam all have 81 points at Le Zinc (3 nights, 480 min each). The public Legend of Le Zinc would show them as a shared rank.
- **Reset:** on 1 Dec at 06:00 all points go to 0, and each venue shows its November Mayor as a ghost crown until someone reaches 15 points.

## 4. Assumptions

- **A-TER-1** A typical crew goes out 1 to 2 nights a week, mostly as a group, at 3 to 15 venues. Based on the PROMPT (5 to 30 friends) and the prototype (14 visited, 5 to conquer). Verify with season telemetry: nights per member, venues per crew.
- **A-TER-2** An OS geofence exit event (iOS region monitoring, Android Geofencing API) registered only during a live party and sending only "exited" plus server time satisfies TER-09's "never continuous tracking". It probably needs "Always" location permission on iOS. Verify with Recon-Privacy and Recon-Location. Fallback: manual "still here" re-checks only.
- **A-TER-3** Current Swarm mayorship rules (after 2024) are unknown. I found no source after the 2015 rules (30 days, one per day, ties to the incumbent). Verify in the Swarm app or help pages if it matters. It does not change the design.
- **A-TER-4** All the numbers (10, 18, 12, 5, 20, 15, 20 min, 3 h) are first guesses calibrated on the worked example. Plan to retune after 2 seasons. Changes apply only at a season boundary.
- **A-TER-5** Each crew has a single time zone for nights and seasons. Verify against crew settings. A crew that travels keeps its home time zone.
- **A-TER-6** A places provider gives a stable external place ID for venue validation (case F). Verify with the map and places recon.
- **A-TER-7** Public scoring (COM-03) is presence-only, as COM-03 requires, while crew scoring adds organiser, game and discovery points, which TER-02 allows. Both read the same event log.
- **A-TER-8** Pokémon GO decay rates and badge numbers come from community measurements (GamePress, Bulbapedia), not Niantic documentation. Only the qualitative lesson is used.

## 5. Scope changes

- **TER-10 [P1] (new)** Venue loyalty tiers: Regular of X, Bronze/Silver/Gold at 3, 10 and 25 lifetime counted nights. Never lost, crew-visible, audience controlled by the profile. Reason: progress nobody can take away, for members who never win crowns (Pokémon GO gym badges).
- **TER-11 [P0] (new)** Workplace exclusion and validation of new venues (abuse cases D and F). Reason: without it, staff and fake venues break TER-02 from day one.
- **TER-12 [P2] (new)** Season variants: one rule modifier per month from remote config, never related to drinks, frozen into the season's rule version. Reason: keeps months different over the long run.
- **TER-03 (change)** Read "one counted check-in per venue per night (06:00–06:00), whatever the number of parties". State the 20-min delay, the 15-min vesting and the cap of 6 per night.
- **TER-04 (change)** Add: ghost crown at reset, a 12-hour closing window, a 7-day correction window with replay, a 30-min delay on takeover notifications, an alert threshold of 10 points or less plus the "can take it tonight" alert.
- **TER-01, TER-02 (change)** Flats and private homes from N-08 are never territories.
- **TER-06 (change)** Separate "boss" (live crown) from "Mayor" (crown held at season close). Exact rules in 3.4.
- **COM-11 (change)** Owners cannot attach perks to boss, Mayor or Legend status.
- **AC-04 (note)** For territory points, a one-tap peer confirmation requires the confirmer to be checked in at the venue or to have done a BLE handshake.

## 6. Glossary additions

| English term | French UI term |
|---|---|
| Boss (live crown) | Boss |
| Mayor (crown held at season close) | Maire |
| Reign | Règne |
| Takeover | Prise |
| Ghost crown | Couronne fantôme |
| Season | Saison |
| Season variant | Règle du mois |
| Night (06:00–06:00) | Nuit |
| Counted check-in | Check-in compté |
| Vesting (15 min) | Validation sur place |
| Corroborated check-in | Check-in confirmé |
| Solo check-in | Check-in solo |
| Time at venue | Temps sur place |
| Proof of presence | Preuve de présence |
| First discovery | Découverte |
| Territory venue | Bar en jeu |
| Venue-days | Jours de règne |
| Conqueror | Conquérant |
| Explorer | Explorateur |
| Nomad | Nomade |
| Regular (tier) | Habitué (bronze, argent, or) |
| Legend | Légende |
| Fog of war | Brouillard |
| Crew presence score | Score de présence du crew |
| Workplace exclusion | Mon lieu de travail |

## 7. Blockers

None. Nothing in this report needs an account, key or paid service. The places provider used for venue validation (A-TER-6) belongs to the map and places recon.

## 8. Sources

All read on 2026-10-26.

- TechCrunch, "Foursquare Starts To Enforce The Rules, Cracks Down On Fake Check-Ins", 7 Apr 2010: https://techcrunch.com/2010/04/07/foursquare-starts-to-enforce-the-rules-cracks-down-on-fake-check-ins
- TechCrunch, "Foursquare Starts Emphasizing Days Rather Than Check-Ins With Mayor Countdowns", 26 Aug 2010: https://techcrunch.com/2010/08/26/foursquare-mayor-countdowns
- Network World, "Foursquare makes it harder to unlock badges" (false positives): https://www.networkworld.com/article/734004/collaboration-social-foursquare-makes-it-harder-to-unlock-badges.html
- Droid Life, "Swarm gets mayorships", 22 Jun 2015: https://www.droid-life.com/2015/06/22/swarm-gets-mayorships-like-it-had-when-it-was-relevant-as-foursquare/
- Windows Central, "Swarm taps into Foursquare's roots, rolls out Mayorships again" (article body not retrievable, cited through search summary): https://windowscentral.com/swarm-taps-foursquares-roots-rolls-out-mayorships-again
- VentureBeat, "Foursquare's new Swarm app means the death of badges, mayors": https://venturebeat.com/ai/foursquares-new-swarm-app-means-the-death-of-badges-mayors/
- Engadget, "Foursquare and Swarm: Breaking up is never easy", 2015: https://www.engadget.com/2015-06-24-foursquare-swarm-split.html
- TechCrunch, "Swarm gets back into the game with leaderboards", 20 Aug 2015: https://techcrunch.com/2015/08/20/swarm-gets-back-into-the-game-with-leaderboards/amp/
- The Points Guy, Swarm review, Aug 2017: https://thepointsguy.com/2017/08/swarm-foursquare-travel-app-review
- Wikipedia, Foursquare Swarm: https://en.wikipedia.org/wiki/Foursquare_Swarm
- Wikipedia, Foursquare City Guide: https://en.wikipedia.org/wiki/Foursquare_City_Guide
- AppDeveloper Magazine, "City Guide app by Foursquare to be replaced with new Swarm app": https://appdevelopermagazine.com/city-guide-app-by-foursquare-to-be-replaced-with-new-swarm-app/
- PhoneArena, Foursquare sunsetting City Guide: https://www.phonearena.com/news/foursquare-is-sunsetting-its-city-guide-app-and-focusing-on-its-check-ins-app-swarm_id163767
- TechCrunch, Gowalla relaunch, Mar 2023: https://techcrunch.com/?p=2497783
- Wikipedia, Gowalla: https://en.wikipedia.org/wiki/Gowalla
- Turf wiki, Points: https://wiki.turfgame.com/en/wiki/Points
- Wikipedia, Turf (video game): https://en.wikipedia.org/wiki/Turf_(video_game)
- ESOC, Turf notes: https://www.esoc.org.uk/news/turf-handling-increased-activity
- Ingress wiki, Guardian: https://ingress.wiki.gg/wiki/Guardian
- fevgames, Guardian medal: https://fevgames.net/ingress/ingress-guide/concepts/medal/guardian/
- Ingress wiki, Recharging (15% daily decay): https://ingress.wiki.gg/wiki/Recharging
- GamePress, Motivation: https://gamepress.gg/pokemongo/node/239146
- GamePress, Gyms (coin rate and cap): https://pogo.gamepress.gg/gyms
- Pokémon GO official news, PokéCoin update 2020: https://pokemongo.com/news/pokecoinupdate
- TouchArcade, Pokémon GO gym overhaul, 19 Jun 2017: https://toucharcade.com/2017/06/19/pokemon-go-huge-gym-overhaul-raid-battle-mode-new-items-and-more-detailed/
- Kotaku, new Pokémon GO gyms: https://kotaku.com/the-new-pokemon-go-gyms-are-live-now-heres-what-you-ne-1796335788
- Bulbapedia, Gym (GO), gym badges: https://bulbapedia.bulbagarden.net/wiki/Gym_(GO)
- iMore, Pokémon GO gyms: https://www.imore.com/pokemon-go-gyms
- DC Rainmaker, Strava Local Legends, 10 Jun 2020: https://dcrainmaker.com/2020/06/strava-legends-feature.html
- BikeRadar, Strava Local Legend: https://www.bikeradar.com/news/strava-local-legend/
- TechCrunch, Strava AI against leaderboard cheats, 16 May 2024: https://techcrunch.com/2024/05/16/strava-taps-ai-to-weed-out-leaderboard-cheats-unveils-family-plan-dark-mode-and-more
- Cycling Weekly, Strava clamps down on vehicle cheats: https://www.cyclingweekly.com/news/strava-clamps-down-on-vehicle-cheats-in-new-update
- Untappd help centre, rules and policies: https://help.untappd.com/hc/en-us/sections/360008215472-Rules-Guidelines-and-Policies
- Untappd Lounge, All about Untappd badges (2023): https://lounge.untappd.com/everything-you-need-to-know-about-untappd-badges
- Untappd help, badges beyond 60 miles: https://help.untappd.com/hc/en-us/articles/360037071292-How-can-I-check-in-to-venues-that-are-greater-than-60-miles-away
- TechCrunch, Zenly rolls out its own maps, 18 May 2022: https://techcrunch.com/2022/05/18/social-maps-app-zenly-rolls-out-its-own-maps/amp/
- Mapbox blog, "Clear the fog with Zenly" (403 on fetch, cited through search summary): https://blog.mapbox.com/clear-the-fog-with-zenly-fc7778b06c33
- Life360, What happened to Zenly: https://www.life360.com/blog/what-happened-to-zenly
- Chemeketa game design reader, Feedback loops: https://computerscience.chemeketa.edu/cis125greader/MechanicsDynamics/FeedbackLoops.html
- Bugnet, Positive and negative feedback loops in game design: https://bugnet.io/blog/positive-and-negative-feedback-loops-in-game-design
- Systems and Us, Feedback loops in games, 2015: https://systemsandus.com/2015/01/04/the-feedback-loops-in-games-what-makes-monopoly-world-of-warcraft-and-mario-kart-so-much-fun/
- Local: `PROMPT.md` (bar_territories, leaderboards, anti_cheat, community, profiles, SEC-06), `design/prototype/Bars.dc.html`, `research/README.md`.
- Unsourced (design judgement): every number in section 3, the geofence approach to time at venue, the pair-concentration threshold of 60%.
