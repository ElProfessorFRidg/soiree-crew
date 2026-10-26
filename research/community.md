# Recon-Community: legal duties and safety design for COM-01 to COM-11 and PROF-01 to PROF-10

Report owner: Recon-Community (phase 0). Read date for every source: 2026-10-26 unless stated otherwise.
Scope: EU Digital Services Act (DSA), French online-review law, App Store and Google Play UGC rules, abuse patterns in location-based social apps, presence aggregation thresholds, moderation tooling.
Not legal advice. Items marked "verify" need a lawyer or a fresh official read before the first public build.

---

## 1. Summary

1. **The DSA applies to us in two layers.** Crew-only content (crew chats, party albums, crew venue pages, crew leaderboards) is shared with a closed group chosen by humans, so it is "hosting" only. Every public item (public venue page, reviews, public profile, open party, events, regulars list) makes us an **online platform** (DSA recital 14). Hosting duties apply whatever our size: notice and action (art. 16), statement of reasons (art. 17), reporting threats to life to the police (art. 18), terms and conditions (art. 14), points of contact (art. 11, 12). The online-platform section (art. 20 to 28: internal complaints, trusted flaggers, misuse suspension, dark patterns, minors) **does not legally apply to micro and small enterprises** (art. 19), except art. 24(3). We should still build art. 20 and art. 23 from day one, for three reasons: App Store 1.2 and Play UGC require timely handling and blocking anyway, the exemption only lasts 12 months after we outgrow it, and it costs little at design time.
2. **French review law is stricter than the DSA for COM-02.** L111-7-2 (version in force since 17 Feb 2024) and D111-16 to D111-19 require us to show, **next to the reviews**: whether reviews are checked, the publication date, the **date of the experience**, the ranking criteria. A dedicated page must say whether reviewers get anything in exchange, how long reviews stay up, and how the check works. A refused review gets its reason. Venue owners must get a **free channel to report doubts about authenticity**, which must be reasoned. Since 28 May 2022, claiming reviews come from real customers without taking steps to verify it, or posting or altering fake reviews, is a misleading commercial practice (L121-4 27° and 28°). Our "verified check-in only" rule is exactly the verification step the law asks for, and we must say so on the page.
3. **Apple 5.1.2(iii) turns COM-06 into a store rule, not just good practice.** Apps may not "facilitate" re-identifying users from data presented as aggregated or anonymised. If a stranger can work out that a specific person is at a bar from our busyness counts, we break the guideline. The thresholds in section 2.2 are therefore requirements.
4. **Presence privacy proposal (COM-06):** live busyness is shown as a **level, never an exact count**, computed only from trusted, non-private check-ins, published on a **fixed 30-minute grid with a 30-minute lag** (so 30 to 60 minutes old), with **k ≥ 5 distinct trusted users from ≥ 2 distinct crews**, **deterministic noise** (same answer for every repeated query), and suppressed entirely for small venues and for private places (flats, homes). Historical "popular hours" use a 10-user cell minimum over at least 4 weeks (same rule as the ONS 10-5 rule). Regulars are built from closed months only.
5. **Never let private places go public.** N-08 lets crews add flats and spots. The Strava heatmap (2018) and StravaLeaks (2024) cases show how aggregates over a small, specific population reveal sensitive locations. Only licensed public venues (bar, pub, club, café) may have a public page or appear in any public aggregate. Flats and homes stay crew-only, always.
6. **Perspective API is shutting down on 31 December 2026** (no new quota since February 2026). Do not build on it. Proposed v1 text stack: rule-based PII and name detection (French phone formats, emails, IBAN, addresses, named persons) + an EU-based classifier (Mistral moderation `mistral-moderation-2603`, has a PII category) with OpenAI `omni-moderation-latest` (free, text and images, EU data residency on approval) or a self-hosted Qwen3Guard (Apache-2.0, 119 languages) as the swap. Images: Sightengine (Paris; free tier 2,000 ops/month, Starter $29 for 10,000) or AWS Rekognition in an EU region, plus CSAM hash matching.
7. **Door policy (COM-07) must not become a guide for minors.** Google Play bans "depicting or encouraging the use or sale of alcohol or tobacco to minors", Apple 1.4.3 rejects apps that encourage minors to drink. So we publish and filter only the positive fact ("ID checked every time"), never "never checks ID" as a searchable filter, and door reports never contain free text about who was inside.
8. **Google Play Child Safety Standards apply to us** if the app is listed as Social (they cover age-gated adult apps too): a public CSAE standards page, an in-app feedback channel, CSAM handling, and a named child-safety contact in Play Console.

---

## 2. Findings

### 2.1 Duty checklist per regulation and store policy

#### 2.1.1 What we are under the DSA

| Our content | DSA category | Why |
|---|---|---|
| Crew chats, party chats, DMs (MSG-01) | Interpersonal communication, outside "online platform" | Recital 14: communication "between a finite number of persons determined by the sender" |
| Crew albums, crew venue pages, crew cards (N-21, N-08, N-33), crew leaderboard | Hosting service | Stored at the user's request but shared with a closed group admitted by human decision (recital 14: public only if users are "automatically registered or admitted without a human decision") |
| Public venue page, reviews, review photos, public profile, open party, community events, regulars list (COM-01 to COM-05, COM-09) | Online platform | Made "easily accessible to recipients of the service in general". Recital 13: storing comments in a social network is an online platform service, not an ancillary feature |

Size: DSA art. 19(1) excludes providers that "qualify as micro or small enterprises as defined in Recommendation 2003/361/EC" from Section 3 (art. 19 to 28), except art. 24(3), and keeps that exclusion for 12 months after the status is lost. Micro: fewer than 10 staff and turnover or balance sheet ≤ €2 M; small: fewer than 50 staff and ≤ €10 M (Recommendation 2003/361, not re-read in this pass, verify). Art. 15(2) also exempts micro and small enterprises from yearly transparency reports.

France: Arcom is the Digital Services Coordinator, designated by the SREN law (loi n° 2024-449 of 21 May 2024), with a cooperation agreement with CNIL and DGCCRF signed 27 June 2024.

#### 2.1.2 DSA duties

| Article | Duty | Applies to us | Feature that satisfies it | IDs |
|---|---|---|---|---|
| 11 | Single electronic point of contact for authorities (EU Commission, Board, DSCs), published | Yes, all intermediaries | `legal@` address on the website and in Settings > Legal | COM-08 |
| 12 | Single point of contact for users, quick and direct, "not solely" automated | Yes | Contact form in app and web, human answer | COM-08, O-77 |
| 14 | Terms and conditions in plain language covering content moderation policies, tools (including algorithmic decisions and human review) and complaint handling | Yes | Community rules page + Terms, versioned, accepted before posting any public item (also a Play UGC requirement) | COM-08 |
| 15 | Yearly transparency report | No while micro/small (15(2)) | Keep the moderation log structured so the report can be generated later | COM-08 |
| 16(1) | Easy, electronic notice mechanism for anyone, including non-users | Yes | "Report" on every public item (review, photo, profile, open party, event, venue page edit, door report, owner reply) + a web form for non-users (public venue pages are shareable, QOL-05) | COM-08, O-77 |
| 16(2) | Help notifiers give: (a) substantiated explanation of why it is illegal, (b) exact location (URL), (c) name and email (not required for child sexual abuse offences), (d) statement of good faith | Yes | Report form: reason picker + free text + item link pre-filled + name/email for "illegal content" reports + good-faith checkbox. Two paths: "breaks the rules" (light) and "illegal content" (DSA notice) | COM-08 |
| 16(4), 16(5) | Acknowledge receipt if email known; tell notifier the decision and redress options | Yes | Notifier gets a receipt and a decision notice (in app inbox + email) | COM-08 |
| 16(6) | Process notices timely, diligently, objectively; disclose use of automated means | Yes | Queue with SLA; decision notice says "automated filter" when it was | COM-08 |
| 17(1), 17(3) | Statement of reasons to the affected user for any removal, demotion, visibility restriction, account suspension or termination. Must contain: type, scope and duration of the restriction; facts relied on (incl. whether triggered by a notice); use of automated means; legal ground (illegal content) or contractual ground (rule broken); redress (internal complaint, out-of-court, court) | Yes, all hosting | `ModerationDecision` record rendered into a notice in the author's language; template per rule; sent in app + email | COM-08, MSG-07 |
| 18 | Inform police/judicial authorities promptly of information giving rise to a suspicion of a criminal offence involving a threat to life or safety | Yes | Escalation path in the moderator tool ("threat to life" button), documented contact (Pharos / local police), logged | COM-08 |
| 20 | Internal complaint system: free, electronic, at least 6 months after the decision; not solely automated; reverse without undue delay if justified | Not legally while micro/small, **build anyway** | "Contest this decision" on every decision notice, reviewed by a different moderator | COM-08 |
| 21 | Out-of-court dispute settlement info | Not while micro/small | Mention certified bodies in the decision notice once applicable | COM-08 |
| 22 | Priority for trusted flaggers | Not while micro/small | Priority lane field in the queue, empty at launch | COM-08 |
| 23 | Suspend, after warning, users who frequently post manifestly illegal content and notifiers who frequently send manifestly unfounded notices; case by case; policy in terms | Not while micro/small, **build anyway** | Strike ladder (users) + notifier credibility score (defeats owners burying reviews, section 2.5) | COM-08, COM-11 |
| 24(3) | Give user numbers to the DSC on request | Yes | Monthly active recipients metric computed and kept | COM-08 |
| 25 | No dark patterns | Not while micro/small; GDPR and consumer law still apply | One-tap "back to private", privacy toggles with neutral design | PROF-01, PROF-10 |
| 27 | Explain recommender system parameters | Not while micro/small | Discovery ranking explained in one line + methodology page (also needed for D111-17 ranking criteria) | COM-10, COM-02 |
| 28 | Protect minors on platforms accessible to minors | Not while micro/small; the app is 18+ (O-02) | Age gate; Commission guidelines of 14 July 2025 exclude micro/small too | O-02, COM-07 |

#### 2.1.3 French law on online reviews (COM-02, COM-11)

| Source | Duty | Feature |
|---|---|---|
| L111-7-2 (in force since 17 Feb 2024) | "Information loyale, claire et transparente" on how reviews are published and handled | "How reviews work" page linked under every review list |
| L111-7-2 | Say whether reviews are checked, and if so the main characteristics of the check | Badge next to reviews: "Avis de clients passés ici, vérifiés par check-in" + link |
| L111-7-2 | Show the date of the review and its updates | "Publié le 12 oct. 2026 · modifié le 14 oct." |
| L111-7-2, D111-19 | Tell a consumer whose review was refused why | Rejection notice with the rule broken (same object as the DSA statement of reasons) |
| L111-7-2 | Free feature for the owner of the product or service to report a doubt about authenticity, provided the report is reasoned | Venue owner (claimed page, COM-11) and anyone else: "Doute sur l'authenticité" report with mandatory reason. Does not hide the review by itself |
| D111-17, near the reviews | Whether a check procedure exists; publication date; **date of the consumption experience**; ranking criteria, including chronological ordering | Visit date shown; sort menu (Récents / Utiles) with criteria disclosed; chronological sort available |
| D111-17, dedicated page | Whether a counterpart is given for posting; maximum publication/retention period | "No reward for reviews"; retention period stated (proposal: reviews stay while the account exists, max 5 years, see A-COM-6) |
| D111-18 | If checked: main characteristics of the check, whether the author can be contacted, whether and how a review can be edited, grounds for refusal | Same page |
| L121-4 27° (since 28 May 2022) | Misleading to claim reviews come from people who used the product without taking the steps needed to verify it | Verified check-in requirement (AC-xx) is the verification; never claim more than it proves ("passé ici", not "a consommé") |
| L121-4 28° | Misleading to post or have others post fake reviews, or alter reviews to promote products | No seeded reviews, no reviews by staff, owners or the team; owners can never edit or hide (COM-11); no AI-generated reviews (AI-xx never writes reviews) |
| DGCCRF guidance | DGCCRF found operators biasing moderation by removing negative reviews or delaying them | Moderation rules identical for positive and negative reviews; publication delay identical for all |

Penalties cited by secondary sources: 2 years' prison and €300,000 fine for misleading practices, up to 10 % of turnover for companies (verify current amounts on Légifrance).

Other French law useful for the community rules (not re-read in full in this pass): Code pénal 223-1-1 (since loi n° 2021-1109): disclosing information that identifies or locates someone to expose them to a direct risk is a crime (3 years, €45,000 per secondary sources). This backs our "no personal data in public content" rule. Defamation of named staff in reviews is a press-law risk (loi du 29 juillet 1881, not verified in this pass).

LCEN / décret n° 2021-1362 (20 Oct 2021): hosting providers must keep data identifying content creators (identity data, account data, technical data). The exact retention period was not confirmed in this pass (sources say one year). Recon-Security must reconcile this with SEC-06 retention.

#### 2.1.4 Apple App Store Review Guidelines

| Guideline | Requirement (paraphrase, read 2026-10-26) | Feature | IDs |
|---|---|---|---|
| 1.2 | UGC apps must have: a method for filtering objectionable material before it is posted; a way to report offensive content and timely responses; the ability to block abusive users; published contact information | Pre-publication filter (2.4), report on every item, block everywhere, contact page | COM-08, O-77 |
| 1.2 | Random or anonymous chat, "Chatroulette-style" experiences, "hot-or-not" objectification, threats, bullying do not belong on the store | No random matching, no stranger chat before an accepted request (COM-05 already), no rating of people, "felt safe" rating is about the venue | COM-05, COM-02 |
| 1.1.4 | "Hookup" apps are treated as overtly sexual content | COM-05 is framed and designed as meeting people and crews, not dating: no photos-first browsing of people, no "who is single", no gender filter | COM-05 |
| 1.4.3 | No encouraging excessive alcohol; apps that encourage minors to drink are rejected | Drinking leaderboard never public (COM-03), RANK-09 flag, PROF-06 records off in public build, door policy wording (2.6) | COM-03, PROF-06, COM-07 |
| 5.1.1(i) | Privacy policy in app and metadata, incl. retention and how to revoke consent | O-08 | PROF-10 |
| 5.1.1(v) | Account deletion in app | O-07 (must also delete or anonymise reviews, see A-COM-7) | PROF-xx |
| 5.1.1(viii) | No compiling personal information from sources other than the user | Never import or scrape people data; venues only from public venue data | COM-01 |
| 5.1.2(i) | Disclose sharing with third parties, "including with third-party AI", and get explicit permission | Moderation provider named in the privacy policy and in the "post publicly" consent; prefer EU/self-hosted | COM-08 |
| 5.1.2(iii) | Do not "attempt, facilitate, or encourage others to identify anonymous users" from data presented as anonymized or aggregated | COM-06 thresholds (2.2) | COM-06, COM-01, COM-03 |

#### 2.1.5 Google Play

| Policy | Requirement | Feature | IDs |
|---|---|---|---|
| User Generated Content | Users accept terms that prohibit objectionable content **before** creating or uploading UGC | Community rules accepted on first public post | COM-08 |
| UGC | In-app reporting and blocking of UGC and users; 1:1 features need user blocking | Report + block on every item and profile, block in chats | COM-08, MSG-07 |
| UGC | "Robust, effective, and ongoing" moderation | Pipeline 2.4 | COM-08 |
| UGC | Monetisation must not reward objectionable behaviour | No paid boosts of reviews or regulars | COM-02, COM-03 |
| Inappropriate Content (alcohol) | No "favorable portrayal of excessive, binge or competition drinking"; no depicting or encouraging alcohol use or sale to minors | RANK-09 off in a Play public build; COM-07 positive-only filter | RANK-09, PROF-06, COM-07 |
| Inappropriate Content (harassment) | No apps that facilitate threats, harassment, bullying, e.g. "posting content in order to humiliate someone publicly" | No naming people in reviews, quote-of-the-night (N-23) stays crew-only, shame badge (AC-09) crew-only | COM-02, AC-09 |
| Child Safety Standards | For Social, Dating, anonymous and random chat apps, including adult-only ones: published CSAE standards web page naming the app, in-app feedback channel, CSAM action, compliance with law, named child safety point of contact in Play Console | CSAE page on the website, report flow, CSAM hash matching (2.4), named contact | COM-08 |

#### 2.1.6 Coverage of each ID with a legal or safety angle

| ID | Legal / store duty | Safety counter (section) |
|---|---|---|
| COM-01 | Apple 5.1.2(iii); DSA online platform for user edits (prices, tags); L111-7-2 for ratings | Aggregates follow 2.2; only public licensed venues; user edits go through moderation and are reportable |
| COM-02 | L111-7-2, D111-17 to D111-19, L121-4 27°/28°, DSA 16/17 | 2.3 rules; scenarios S3, S4, S5 |
| COM-03 | Apple 1.4.3, 5.1.2(iii); Play alcohol | Presence only, closed months, opt-in via public venues section (PROF-09), rounded visit counts, no dates (PROF-05); S1 |
| COM-04 | GDPR (consent for crew name), DSA 14 | Crew name public only with crew consent; S1 |
| COM-05 | Apple 1.2 (no random/anonymous chat), 1.1.4 (no hookup framing); Play UGC 1:1 blocking | Request gate, request audience setting, cooldown after decline, block; S2 |
| COM-06 | Apple 5.1.2(iii); GDPR data minimisation | 2.2 |
| COM-07 | Apple 1.4.3, Play alcohol/minors | 2.6 |
| COM-08 | DSA 11, 12, 14, 16, 17, 18 (+20, 23 voluntary); Apple 1.2; Play UGC + CSAE | 2.4 |
| COM-09 | DSA (events are public UGC); Apple 1.2 | RSVP names friends-only, counts with k ≥ 5 and rounded, events reportable, host cannot see stranger RSVPs' profiles beyond their public audience |
| COM-10 | DSA 27 (voluntary), D111-17 ranking criteria | Ranking explained; "pint under X" uses crowd prices with source count |
| COM-11 | L111-7-2 (owner authenticity-doubt channel), L121-4 28° | Owners cannot delete, hide, edit or reorder reviews; claimed label; owner replies are UGC (moderated, reportable); owner and staff accounts cannot review their own venue; S4 |
| PROF-01 | GDPR art. 25 (privacy by default) | New account: nothing public |
| PROF-02 | Apple 1.4.3 (records), PROF-06 | Drinks and records sections cannot be set to Everyone in a public build while RANK-09 is off |
| PROF-03 | GDPR | Per-item overrides enforced by the server |
| PROF-04 | L111-7-2 (anonymous reviews still need verification) | "Public anonymous" is anonymous to readers only; moderation and notices still reach the author; S1 |
| PROF-05 | Apple 5.1.2(iii) | Fields never sent to strangers; no dates/weekdays/times for strangers; S1 |
| PROF-06 | Apple 1.4.3, Play "competition drinking" | Plain figures, never public in a public build |
| PROF-07 | GDPR transparency | "View as stranger" built from the same server serializer as the real stranger view (not a client simulation) |
| PROF-08 | SEC-01, SEC-02, GDPR | Blocked users get a 404-equivalent, not a "blocked" page; tests per audience |
| PROF-09 | GDPR | Default "exact username only"; regulars require public venues section |
| PROF-10 | GDPR art. 12 transparency, DSA 25 spirit | Summary generated from the same visibility engine |
| MSG-07 | DSA 16/17 (account actions need a statement of reasons); Play UGC (1:1 blocking) | Reporter-side decryption of the message + up to N surrounding messages, explicit confirm, sent to queue; reported user gets art. 17 notice if their account is restricted; the reporter can block in the same flow |
| TER-09 | GDPR minimisation; Apple 5.1.2(iii) | Private check-ins excluded from every aggregate (2.2); crew-vs-crew (TER-07) shows crew names only if the crew is public, else "un autre crew" |
| O-77 | Apple 1.2, Play UGC, DSA 16 | Merged into COM-08 report flow |

### 2.2 Presence privacy design (COM-06)

#### 2.2.1 What the attacks look like in real apps

- **Trilateration from distances.** Grindr's distance display let researchers locate users from three spoofed positions (Pen Test Partners and Synack, 2019; 15,000 users located in San Francisco). KU Leuven (2024) used "oracle trilateration" on distance filters of Badoo, Bumble, Hinge, Hily to reach about 2 m. Hiding the number is not enough when a filter ("within 5 km") still answers yes or no. Lesson: **the server must never answer any question about the distance between two people**, not even as a filter.
- **Aggregates over small or specific populations.** Strava's 2018 global heatmap revealed military bases because the few users there were the only ones in the area. Le Monde's StravaLeaks (Oct 2024) tracked heads of state through their bodyguards' public runs, including a private weekend in Honfleur. Lesson: an aggregate over a handful of people is a list of those people; start and end points reveal homes and hotels.
- **Features that put strangers next to you by default.** Strava Flyby (2020): a cyclist was greeted by name by a stranger who had seen her on Flyby; Strava switched it to default off. Snap Map (2017): schools and police warned it could build "a picture of home addresses, travel routes, schools and workplaces"; Ghost Mode was the answer. Lesson: opt-in, off by default, reversible in one tap (already in our principles).
- **The business model leaks data.** Life360 sold precise location to about a dozen data brokers (The Markup, Dec 2021) and promised to stop in Jan 2022. Lesson: no location data, raw or "de-identified", ever leaves our systems; say so in the privacy policy.
- **Breaches of "safety" apps.** Tea (July 2025): an unsecured storage bucket exposed about 72,000 images, including 13,000 verification selfies and ID photos, then DMs. Lesson: never store ID documents for door-policy or age checks; venue photos stripped of metadata; storage buckets private by default, tested (SEC-09).
- **Differencing.** Statistical agencies have handled this for decades: if you publish "5" at 22:00 and "6" at 22:05 and know who just walked in, rounding alone does not protect them. ONS uses a "10-5 rule" (suppress below 10, round to 5) or cell-key perturbation; random or consistent perturbation is stronger than fixed rounding against differencing. Google's Community Mobility Reports added Laplace noise (ε = 0.11 per daily visit count), bounded each user's contribution and only used opted-in users.

#### 2.2.2 Proposed rules

Inputs to every public aggregate:

- Only **check-ins** (never continuous location, TER-09).
- Only check-ins that are **verified** by anti-cheat and **not private**. Private check-ins (TER-09) and users who switched "Count me in venue busyness" off never enter any aggregate.
- Only users with a **trust score** above a threshold (account age ≥ 14 days, ≥ 3 verified check-ins, not in a device/IP cluster with other counted accounts). This stops an attacker from creating 4 sock puppets to push a venue to k = 5 and then reading the 5th person as the target.
- Only **public licensed venues** (bar, pub, club, café, concert venue) from a vetted source. Flats, homes and "spots" (N-08) never get a public page and never appear in any public aggregate, map heat layer or regulars list.
- Each user counts at most once per venue per time window.

Live "how busy tonight" (strangers):

| Parameter | Value | Why |
|---|---|---|
| Shown as | A level: Calme / Ça se remplit / Plein (EN: Quiet / Filling up / Packed), relative to that venue's own history | Levels carry less information than counts; relative levels work for big and small venues |
| Count shown | Only as a bucket: "5+", "10+", "25+", "50+", never an exact number | A bucket only moves when many people move |
| Minimum | k ≥ 5 distinct trusted users **and** ≥ 2 distinct crews (users without a crew count as their own crew) in the window | Proposed k from PROMPT.md; the 2-crew rule stops "5 = one known crew" inference |
| Window | Last 60 minutes of check-ins | Smooths arrivals |
| Publication | Snapshots on a fixed grid (every 30 min, at :00 and :30), computed from the window ending 30 min before the snapshot | Data is 30 to 60 min old. Arrivals cannot be matched to a change |
| Noise | Laplace noise added to the count before thresholding and bucketing, **seeded by (venue, snapshot)** so every viewer and every repeated query gets the same value | Repeated queries cannot average the noise away (same approach as Google's DP pipeline) |
| Hysteresis | A level or bucket changes only if the noisy count crosses the boundary by a margin | Stops flicker at boundaries, which would leak single arrivals |
| Small venue rule | No live level at all if the venue has had fewer than 20 distinct trusted users in the last 30 days | At a 30-seat bar, "Filling up" plus the regulars list identifies people |
| Below threshold | Show "Pas assez de données" (EN "Not enough data yet"), same wording whether 0 or 4 people | 0 and 4 must look identical |
| Demographics | Never: no gender ratio, no age split, no "singles" count, no "friends of friends here" for strangers | Each breakdown is a smaller cell, and a gender ratio is a targeting tool |
| Friends | Friends see individual presence only under N-07 rules (opt-in, live, during a party) | Unchanged |

Historical aggregates (COM-01 "popular days and hours", "app users this month"):

- Popular hours: per hour-of-week cell over the last 4 to 8 weeks, suppress cells with fewer than 10 distinct trusted users, show relative bar heights only (no numbers). Recomputed weekly.
- "App users this month": shown only from 10 distinct users, rounded down to the nearest 10 ("40+"), computed on closed calendar months.

Regulars (COM-03):

- Built from **closed months** (or closed seasons), published after the month ends. Never "here now", never "last visit".
- Shown only for users whose venues section is Everyone (PROF-09).
- A public regulars list appears only when the venue has ≥ 3 opted-in regulars that month; a lone "Legend of Bar Y" at a small bar is a routine.
- Visit counts shown as buckets ("10+ visites"), no dates, no weekdays (PROF-05).

Events (COM-09): RSVP count for strangers follows the live rules (k ≥ 5, bucket, no names). Names of going friends visible to friends only.

Reviews: visit date shown as **month and year** for everyone, plus the exact publication date (see 2.3 and A-COM-4).

#### 2.2.3 Attack scenarios and what defeats them

| Attack | How it works | Defeated by |
|---|---|---|
| Trilateration | Spoof 3 positions, read distance to a person | The API never returns or filters on distance between people. "Nearby" is for venues only, computed on the device from venue coordinates |
| Oracle trilateration via filters | "Show regulars within 1 km" yes/no answers | No people search by distance at all. Regulars are attached to venues, not to positions |
| Differencing over time | Watch the count; target walks in; count goes 4 → 5 or 5 → 6 | 30-min grid + 30-min lag, 60-min window, buckets, consistent noise, hysteresis |
| Averaging noise | Query 1,000 times and average | Noise seeded by (venue, snapshot): every query returns the same value |
| Sock puppets to reach k | Attacker plants 4 fake check-ins so the 5th is the target | Trust score (age, verified history, device/IP clustering), 2-crew rule, anti-cheat verification of each check-in |
| Small venue | 3 regulars, one of them the target; "busy" = target present | Small venue rule (no live level under 20 users/month), regulars only with ≥ 3, closed months |
| Nested aggregates | Venue count minus "count without women" = women present | No demographic breakdowns, one aggregate per venue per snapshot |
| Cross-feature join | Regular list (Bob is a Legend at Bar Y) + popular hours (Thursday 23:00) = Bob's Thursday routine | Popular hours need 10 users per cell; regulars from closed months; PROF-05 no weekdays; Bob can hide that venue (PROF-03) |
| Review timing | Review published at 23:40 "great music tonight" = author is there | Publication delay: reviews go live at least 12 h after posting (same delay for everyone, not only negatives, to stay neutral under DGCCRF guidance); visit date shown as month |
| Photo metadata | EXIF GPS or timestamp in a review photo | QOL-09 strips metadata on device; server re-encodes and strips again |
| Home exposure (Strava pattern) | A crew "venue" that is a flat appears on a public heat map | Private places never public |
| Event RSVP | "Bob is going to the Thursday DJ set" | RSVP names friends-only |
| Open party | Strangers learn who attends and when | Attendee list visible to approved attendees only; venue and time are what the host chose to publish |

### 2.3 Review rules (COM-02) under French law

Must be displayed:

- Next to the review list: "Avis de personnes passées ici, vérifiés par un check-in validé. [Comment ça marche]" (EN: "Reviews from people who checked in here. [How it works]"). This states the control (L111-7-2, D111-17) without claiming more than it proves (L121-4 27°): a check-in proves presence, not purchase.
- On each review: publication date, edit date if edited ("modifié le"), visit date (month and year), structured ratings, "useful" count, the author line according to PROF-04 ("Lucas M." / "Un habitué" / friends only).
- Sort control near the list with the criteria named: "Plus récents" (chronological, available always) and "Plus utiles" (useful votes, weighted by voter trust). Default proposal: "Plus récents" (simplest to justify).
- Venue rating: show how it is computed in one line ("Moyenne des avis vérifiés des 12 derniers mois") and the review count.
- Dedicated "How reviews work" page, reachable from every review list: who can post (verified check-in at that venue), no reward of any kind for posting, how long reviews stay online, what the automated filter and the moderators check, the reasons a review can be refused or removed, whether we may contact the author (yes, through the app, about their review only), how to edit or delete one's review, how a venue owner can report a doubt, how to contest a decision.

Rules for posting:

- One review per user per venue per 30 days; edits allowed, edit date shown.
- Posting window: from the verified check-in up to 30 days after it.
- New accounts (under 14 days or under 3 verified check-ins anywhere) can post, but their rating weighs less in the venue average until they pass the threshold. The weighting rule is written on the "How reviews work" page.
- No named individuals: the filter holds any review containing a person name, a phone number, an email, a social handle, a plate, or an address other than the venue's. "Le videur était agressif" passes; "Karim le videur" goes to the queue.
- Photos: of the venue, drinks, food, prices. Photos where faces of other people are detected are held for review (French image rights, Code civil art. 9, not re-read in this pass).
- "Felt safe" rating is about the venue, not people.

Forbidden practices (never build, never allow):

- Any reward for reviews (free drink, points, rule points, badges for "5 reviews"). TER-02 already keeps rule points on presence; reviews must earn no points either.
- Seeded, team-written, staff-written, owner-written or AI-written reviews.
- Owners deleting, hiding, editing, reordering or delaying reviews, or paying to promote a review (COM-11).
- Moderation that treats negative and positive reviews differently, or delays negatives only.
- Filtering out low ratings from the average, or showing "4.8" computed on a hidden subset.
- Asking only happy customers to review ("review gating"). Review prompts go to every verified visitor or to nobody. (General consumer-law principle, not a specific article found in this pass.)

### 2.4 Moderation pipeline (COM-08)

#### 2.4.1 Flow

1. **On device, before sending:** metadata stripping (QOL-09), length limits, a local PII hint ("Ton avis contient un numéro de téléphone") so the user can fix it before the server refuses it.
2. **Server, synchronous (target under 500 ms):**
   - Rules: French and international phone formats (libphonenumber), emails, IBAN, URLs, social handles, plates, street addresses, a FR/EN insult list maintained by us.
   - Named-person detection on reviews and owner replies (Microsoft Presidio with a French spaCy model and French context words; Presidio ships English recognisers by default, so French needs configuration).
   - ML text classifier (provider swappable, see 2.4.2).
   - Outcome: **publish**, **hold for human review** (author sees "en cours de vérification"), or **refuse** with the rule broken (D111-19, DSA 17).
3. **Server, asynchronous (images):** CSAM hash matching first, then a nudity/violence/weapons/drugs classifier, then face detection on review photos. Matches on CSAM: block, preserve evidence, report to the competent authority, never shown to moderators without a protocol.
4. **After publication:** reports (DSA 16 path and "rule break" path), owner authenticity doubts (L111-7-2), velocity and similarity detectors (section 2.5 S3), all feeding one queue.
5. **Moderator queue:** sorted by severity (threat to life > CSAM > doxxing > harassment > fake review > spam), with item, context, reporter credibility, author history, previous decisions. Actions: keep, remove, restrict visibility, warn, strike, suspend, escalate to police (art. 18). Every action writes a `ModerationDecision` and sends the statement of reasons.
6. **Complaints:** "Contest" on every decision, handled by a different moderator, outcome sent with reasons.
7. **Strikes:** warning → 7-day posting suspension → 30-day suspension → ban. Manifestly illegal content (threats, doxxing, CSAM) skips steps. Ban evasion detection on device and account signals (AC-05).
8. **Rate limits:** per account and per device: reviews (3/day), photos (10/day), friend requests (10/day, 50/week), reports (20/day), open party join requests (5/hour).
9. **Crew-level moderation** (N-33 cards, crew albums) stays with the crew admin; platform moderators only act on reports.

Moderators at launch: the project team itself (2 named people, A-COM-9). Target response time: 24 h for reports, 1 h for "threat to life" and "my personal data is exposed".

#### 2.4.2 Tool options

| Need | Option | Facts found | Cost | EU hosting |
|---|---|---|---|---|
| Text classifier | **Mistral moderation** (`mistral-moderation-2603`; `2411` deprecated 31 Mar 2026) | Categories include sexual, hate, violence and threats, dangerous, criminal, self-harm, **PII** | Listed free by third-party trackers since the "Moderation 2" rename; the official pricing page does not show it (verify) | Mistral is a French company; API hosting region not confirmed in this pass (verify) |
| Text + image classifier | **OpenAI `omni-moderation-latest`** | Text and images, free endpoint, better in non-English than the previous model | Free | EU data residency (`eu.api.openai.com`) covers `/v1/moderations`, zero data retention eligible, but requires approval |
| Text classifier, self-hosted | **Qwen3Guard-Gen** (0.6B / 4B / 8B) | Apache-2.0, 119 languages, safe / controversial / unsafe, has a PII category | GPU instance cost only (e.g. a small EU GPU VM); not priced in this pass | Self-hosted in the EU (no third-party AI sharing, simplest under Apple 5.1.2(i)) |
| Text classifier, self-hosted | Llama Guard 3/4 | Llama Guard 3 lists French among 8 languages; a Qwen report scored Llama Guard 4 poorly on French (competitor source) | GPU cost | Self-hosted |
| Text classifier | ~~Perspective API~~ | **Shuts down 31 Dec 2026**, no new quota since Feb 2026, no migration | n/a | Do not use |
| PII | Microsoft Presidio (open source) + libphonenumber | Needs French NLP model and recognisers configured | Free | Self-hosted |
| Images | **Sightengine** (Kozelo SAS, Paris) | Nudity, violence, etc.; counts only successful calls | Free 2,000 ops/month (500/day); Starter $29/month for 10,000; Growth $99 for 40,000 | French company; data location to verify |
| Images | AWS Rekognition `DetectModerationLabels` | Group 2 API | About $0.001 per image for the first million (US price from a secondary source; verify EU price) | EU regions exist (Paris, Ireland, Frankfurt) |
| Images | Azure AI Content Safety | Text and image; available in Sweden Central and France Central | Free web tier; paid per 1,000 text records or per image (prices not visible in this pass) | EU regions |
| CSAM | Microsoft PhotoDNA Cloud Service | Free for qualified organisations after third-party vetting | Free | Microsoft cloud |
| CSAM | Cloudflare CSAM Scanning Tool | Fuzzy hashing against NCMEC lists, blocks the URL and notifies; operators still file their own reports | Free for Cloudflare users | Only if media is served through Cloudflare |

Cost estimate at 10,000 users (assumptions: 2,000 reviews and 5,000 review/profile photos per month): text classification free or near free; images within Sightengine Starter ($29/month) or about $5/month on Rekognition. Human moderation time is the real cost.

Recommendation: start with rules + Presidio (self-hosted) + Mistral moderation for text, Sightengine or Rekognition (EU) for images, PhotoDNA application filed early. Keep a `ModerationProvider` interface so we can move text to a self-hosted Qwen3Guard if consent, cost or hosting becomes a problem. Name every provider in the privacy policy and in the consent shown on the first public post (Apple 5.1.2(i)). Never send chat content to any provider (MSG-09); MSG-07 reports go to human moderators only.

### 2.5 Abuse scenarios and counters (input for the phase-3 community safety audit)

**S1. Stalker (ex-partner, knows the target's crew and favourite bars)**

| Vector | Counter |
|---|---|
| Watches busyness of the target's usual bar | 2.2 rules (lag, buckets, noise, small venue rule) |
| Reads the regulars list and the target's venue history | Regulars from closed months; buckets; no dates for strangers (PROF-05); target can hide one venue (PROF-03) or go private in one tap |
| Reads the target's public reviews for timing | Visit month only, 12 h publication delay, "Public anonymous" option (PROF-04) |
| Finds the target by name | Findability default "exact username only" (PROF-09); search never returns blocked users |
| Uses a friend's account or a new account after being blocked | Block hides everything both ways and returns "not found" (PROF-08); new-account trust threshold; ban-evasion signals; blocked users are removed from each other's mutual-friend lists |
| Joins the target's open party | Host approval required; host sees requester's mutual friends; the target, if attending, can see the pending list and the host can be warned by a block (blocked users' join requests to parties where the blocker is an approved attendee are refused silently) |
| Uses crew-vs-crew (TER-07) to see where the target's crew rules | Crew names public only if the crew opted in |
| Watches "who's going" on events | RSVP names friends-only |

**S2. Harasser (met the target at a venue, keeps contacting)**

| Vector | Counter |
|---|---|
| Repeated friend requests | Request audience setting (nobody / friends of friends / everyone; default friends of friends); a declined request sets a 90-day silent cooldown; rate limits |
| Messages | No messages before an accepted request (COM-05); block in one tap from any surface, including inside a chat; MSG-07 report with context |
| Comments under the target's reviews or owner-reply style pile-ons | No replies to reviews by users (only owner replies on claimed pages); "useful" votes only |
| Mass false reports against the target | Reporter credibility score; art. 23(2)-style suspension of manifestly unfounded notifiers after a warning; reports never remove content automatically except CSAM hash matches |
| Photos of the target in venue reviews | Face detection holds the photo; "This is me" report path with priority |
| Threats | Art. 18 escalation; immediate suspension |

**S3. Fake-review farm (paid accounts pushing a venue up or a competitor down)**

| Vector | Counter |
|---|---|
| Accounts without real visits | Verified check-in required (anti-cheat AC-02 to AC-06) |
| Spoofed check-ins | Same anti-cheat signals as territories; review-eligible check-ins need risk score "accepted", not "unverified" |
| Bursts of reviews on one venue | Velocity detector per venue (e.g. reviews in 48 h > 3x the venue's 90-day daily average) → new reviews held, venue flagged |
| Near-duplicate text | Similarity detection (embeddings or MinHash) across reviews of the same venue and the same author cluster |
| Account clusters | Device, IP range, creation time, check-in co-location patterns; cluster members' weights set to zero pending review |
| Young accounts | Reduced weight until 14 days and 3 verified check-ins |
| Incentives offered by the venue ("free shot for 5 stars") | Text detector for reward mentions; reviews mentioning a reward are held; venue warned; repeated: "claimed" status removed |
| Legal exposure | L121-4 28°: we document detection and removal; DGCCRF uses its own detection tool (Polygraphe, per a Senate document) |

**S4. Venue burying reviews (owner wants negative reviews gone)**

| Vector | Counter |
|---|---|
| Owner deletes or hides | Impossible by design (COM-11); claimed pages labelled |
| Owner mass-reports negatives | Owner reports go through the L111-7-2 authenticity-doubt channel: reason mandatory, human review, the review stays visible meanwhile unless manifestly illegal; repeated unfounded reports → suspension of the owner's reporting after a warning (art. 23(2) logic) |
| Owner floods positives to push negatives down | S3 counters; default sort chronological; rating = trust-weighted average of the last 12 months, explained |
| Owner threatens a defamation claim | DSA notice path (art. 16) with substantiated explanation; legal review before removal; the author gets a statement of reasons and can contest |
| Owner's staff post positive reviews | Owner and staff accounts linked to a claimed page cannot review that venue; device/cluster links to the owner account reduce weight |
| Owner replies attack the reviewer | Owner replies are moderated UGC; no personal data about the reviewer allowed; reviewer can report |

**S5. Doxxing or humiliation of staff or customers in reviews**

Counter: named-person and PII detection holds the review; community rule "no review may target a named individual" (COM-02); Code pénal 223-1-1 cited in the rules; Play harassment policy compliance.

**S6. Minor-related misuse of door policy**

Counter: section 2.6.

### 2.6 Age-policy filter (COM-07) wording

Principles:

- It describes the **door** (what staff check) and the **venue's own rule** (official age policy). It never describes the crowd.
- No count, map, heat layer, badge, review field or free text about minors, anywhere. Door reports are structured answers only.
- Only the positive fact is filterable and shown as a badge. "Never checks ID" is stored to compute confidence but is never displayed as a feature or filter, because publishing it would point minors to venues that may serve them (Play: no depicting or encouraging the sale of alcohol to minors; Apple 1.4.3).

Door report (asked once after a verified check-in, skippable):

| FR | EN |
|---|---|
| À l'entrée, on t'a demandé une pièce d'identité ? | Did they ask for ID at the door? |
| Oui · Non · Je ne sais plus | Yes · No · Don't remember |

Official age policy (from a claimed page, COM-11, or the venue's published rules; crowd reports only raise or lower confidence):

| FR | EN |
|---|---|
| Réservé aux 18 ans et plus | 18+ only |
| Tous âges en début de soirée, 18+ ensuite | All ages early evening, 18+ later |
| Non renseigné | Not stated |

Venue page display:

| Case | FR | EN |
|---|---|---|
| Strong signal | Pièce d'identité demandée à chaque fois · d'après 14 visites vérifiées ces 3 derniers mois | ID checked every time · based on 14 verified visits in the last 3 months |
| Weak or mixed signal | Contrôle à l'entrée : pas assez d'infos | Door checks: not enough info |
| Official policy | Règle du lieu : réservé aux 18 ans et plus | Venue rule: 18+ only |

Filter label: FR "18+ strict" with the explanation line "Lieux réservés aux 18 ans et plus, pièce d'identité demandée à l'entrée", EN "Strict 18+" / "18+ venues that check ID at the door". Criteria: official policy 18+ only AND "ID checked" confidence high (proposal: at least 8 verified reports in 90 days, at least 80 % "Oui", recency-weighted).

Words never used anywhere: "mineurs présents", "sans mineurs", "pas de contrôle", "facile d'entrer", "minors", "no minors", "no ID needed", "easy to get in".

### 2.7 What must be in place before the first public feature

Ship-blockers for any COM-xx feature:

1. COM-06 aggregation service live with the 2.2 rules, trust score, private-place exclusion, and tests that try differencing, averaging and sock-puppet attacks (part of AC-10 red team).
2. PROF-08 visibility engine enforced server-side with tests per audience and section; PROF-05 fields unreachable by strangers; block returning "not found"; PROF-07 "View as" using the same serializer.
3. COM-08: report on every public item, block and mute everywhere, pre-publication filters (rules + PII + classifier + image + CSAM hash), moderator queue with decision records, statement-of-reasons notices (FR/EN), "Contest" flow, strike ladder, rate limits, art. 18 escalation path, moderators named with on-call hours.
4. Legal texts published (FR and EN), reachable without an account: Terms, Community rules (incl. misuse policy and suspension durations), "How reviews work" page (D111-17/18), Privacy policy naming moderation providers, CSAE standards page (Play), contact points for users and authorities (DSA 11, 12).
5. Store configuration: Play Console child-safety contact and CSAE URL; App Store age rating answers covering UGC; support URL with contact.
6. RANK-09 and PROF-06 flags verified off in the public build.
7. Venue source vetted (licensed public venues only); flats/homes never public.
8. Data: retention for moderation records and LCEN identification data agreed with Recon-Security (SEC-06).
9. PhotoDNA (or equivalent) access requested; CSAM handling protocol written.

---

## 3. Decisions proposed

| # | Decision | Reason |
|---|---|---|
| D1 | Treat every public surface as a DSA online platform and build art. 20 (complaints) and art. 23 (misuse) even while exempt | Store rules need it anyway; exemption ends 12 months after growth; retrofitting moderation is harder |
| D2 | Two report paths: "breaks the rules" (one tap + reason) and "illegal content" (full DSA art. 16 notice) | Keeps reporting fast for drunk users (ADP) while meeting 16(2) when it matters |
| D3 | COM-06 parameters as in 2.2: levels and buckets only, k ≥ 5 trusted users and ≥ 2 crews, 30-min grid + 30-min lag, seeded Laplace noise, small-venue suppression, 10-user cells for history | Apple 5.1.2(iii); defeats the attacks listed in 2.2.3 |
| D4 | Private places (flats, homes, spots) are never public | Strava heatmap / StravaLeaks pattern |
| D5 | The server never computes or filters on distance between two people | Grindr / KU Leuven trilateration |
| D6 | Reviews show visit month+year and exact publication date, go live after a 12 h delay applied to all reviews | D111-17 needs an experience date; month precision follows common practice (Tripadvisor shows "Date of experience: April 2024"); delay defeats live inference while staying neutral between positive and negative |
| D7 | Moderation stack v1: rules + Presidio + Mistral moderation (text), Sightengine or Rekognition EU (images), PhotoDNA (CSAM), behind a swappable interface; no Perspective API | Perspective ends 31 Dec 2026; EU-first; low cost |
| D8 | COM-07 shows and filters only positive door facts | Play and Apple minor-alcohol rules |
| D9 | Reviews and rule points stay separate: writing a review earns nothing | D111-17 counterpart disclosure, L121-4, Play monetisation rule |
| D10 | Blocked users get "not found", and blocks remove both sides from mutual-friend lists, regulars lists and RSVP lists as seen by the other | Stalker scenario S1 |
| D11 | Crew names and crew-vs-crew results public only when the crew opted in (admin toggle) and any member can hide the crew from their own profile | COM-04, TER-07 |

---

## 4. Assumptions

- **A-COM-1** We qualify as a micro or small enterprise under Recommendation 2003/361 at launch. Based on: a friends' project with no staff. Verify: when a legal entity is created, check headcount and turnover each year.
- **A-COM-2** Crew-only content is not "dissemination to the public" because crew membership is a human decision (invite/approval). Based on: DSA recital 14. Verify: if crews ever become joinable by open link without approval, re-assess (N-30 invite links must keep an admin approval or a limited audience).
- **A-COM-3** k = 5 with the extra rules in 2.2 is enough; k alone would not be. Based on: PROMPT.md COM-06, ONS 10-5 rule, Google mobility DP. Verify: red team (AC-10) runs differencing and sock-puppet attacks on staging data; raise k to 10 if any attack succeeds.
- **A-COM-4** Showing the visit date as month and year satisfies D111-17 "date de l'expérience de consommation". Based on: the decree sets no precision; Tripadvisor practice. Verify: lawyer or DGCCRF reading before launch. Fallback: exact date shown, with the 12 h publication delay kept.
- **A-COM-5** A 12 h publication delay for all reviews is compatible with L111-7-2 (it is applied equally). Based on: DGCCRF criticism targets delays applied to negatives only. Verify: with the lawyer as A-COM-4; disclose it on the "How reviews work" page.
- **A-COM-6** Review retention: while the account exists, at most 5 years. Based on: no legal maximum found; D111-17 only requires stating it. Verify: Recon-Security retention table.
- **A-COM-7** On account deletion (O-07), reviews are deleted, not kept as "anonymous". Based on: GDPR erasure is simplest and the venue rating recomputes. Verify: product decision; if kept, they must be truly anonymised.
- **A-COM-8** Mistral moderation is processed in the EU and currently free. Based on: third-party pricing trackers; Mistral is a French company. Verify: official Mistral pricing and data-location docs (could not be confirmed in this pass; search budget ran out).
- **A-COM-9** Two named team members can moderate at launch with a 24 h report SLA. Based on: expected volume for one city. Verify: measure queue volume in the first public month.
- **A-COM-10** The LCEN identification-data retention period is one year. Based on: secondary sources about décret 2021-1362 and 2022-1327. Verify: Recon-Security reads the decree.
- **A-COM-11** The app is listed in the Play "Social" category, so Child Safety Standards apply. Based on: community features. Verify: category choice at store setup; build the CSAE page anyway.
- **A-COM-12** Door policy thresholds (8 reports in 90 days, 80 % "yes") give a useful badge without false confidence. Based on: none beyond judgement. Verify: tune on real data; never show the badge on fewer reports.

---

## 5. Scope changes

| Proposed ID | Priority | Reason |
|---|---|---|
| COM-12 "How reviews work" page and review-law notices | P0 before COM-02 | Required by L111-7-2 and D111-17/18; not listed anywhere in PROMPT.md |
| COM-13 Statement of reasons and contest flow (DSA 17 + 20) | P0 before any public feature | COM-08 mentions "the reason sent to the author" but not the redress flow or the notifier's decision notice |
| COM-14 Legal and safety pages (Terms, Community rules with misuse policy, CSAE standards page, authority and user contact points) | P0 before any public feature | DSA 11, 12, 14; Play CSAE; Apple 1.2 contact |
| COM-15 Public venue eligibility (licensed public venues only; private places never public) | P0 before COM-01 | Strava pattern; not stated in N-08 / COM-01 |
| COM-16 Trust score for community aggregates and review weighting | P0 before COM-06 | Sock-puppet defence; shared by COM-02, COM-03, COM-06 |
| Change COM-02 | | Add: visit month, publication delay, no reward, owner/staff exclusion, sort criteria disclosure |
| Change COM-07 | | Add: positive-only display and filter; structured reports only |
| Change COM-09 | | RSVP names friends-only; counts follow COM-06 |
| Change O-77 | | Merge into COM-08 (same report flow for crew and public content) |
| Change N-30 | | Crew invite links must keep admin approval or a member cap, so crews stay "closed groups" (A-COM-2) |

---

## 6. Glossary additions

| Concept | Code / EN UI | FR UI |
|---|---|---|
| Moderation decision on an item or account | `ModerationDecision` / decision | décision |
| Notice sent to the author explaining a decision | `StatementOfReasons` / reason for this decision | motif de la décision |
| Report on an item or person | `Report` / report | signalement |
| User contesting a decision | `Appeal` / contest | contestation |
| Strike on an account | `Strike` / warning | avertissement |
| Busyness level shown to strangers | `BusynessLevel` / how busy | affluence |
| Account trust used for aggregates and review weight | `TrustScore` / (never shown) | (jamais affiché) |
| Door report after a check-in | `DoorReport` / door check | contrôle à l'entrée (already `DoorPolicy` for the aggregate) |
| Owner of a claimed venue page | `VenueOwner` / owner | gérant |

---

## 7. Blockers

- **Lawyer review** (French consumer law + DSA) of A-COM-4, A-COM-5 and the Terms before the first public feature. Paid service; the user decides.
- **PhotoDNA application** needs a legal entity and contact details from the user.
- **Moderation provider accounts and keys** (Mistral or OpenAI with EU residency approval; Sightengine or AWS). Needed before COM-08 build.
- **Named moderators and child-safety contact** (Play Console): real people from the crew must agree.
- The web search budget for this session ran out before Mistral data location and the Code de la santé publique article on sale of alcohol to minors could be confirmed. A follow-up pass can close A-COM-8.

---

## 8. Sources (all read 2026-10-26)

EU law
- DSA, Regulation (EU) 2022/2065, official ELI: https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng (EUR-Lex returned empty pages to the fetcher; article texts read on the mirror below)
- DSA art. 16 (mirror): https://www.eu-digital-services-act.com/Digital_Services_Act_Article_16.html
- DSA art. 17: https://www.eu-digital-services-act.com/Digital_Services_Act_Article_17.html
- DSA art. 19: https://www.eu-digital-services-act.com/Digital_Services_Act_Article_19.html
- DSA art. 20: https://www.eu-digital-services-act.com/Digital_Services_Act_Article_20.html
- DSA art. 23: https://www.eu-digital-services-act.com/Digital_Services_Act_Article_23.html
- DSA art. 28: https://www.eu-digital-services-act.com/Digital_Services_Act_Article_28.html
- DSA recitals 13 and 14: https://www.eu-digital-services-act.com/Digital_Services_Act_Preamble_11_to_20.html
- Art. 11, 12, 14, 15, 18, 24 contents: from knowledge of the regulation, not re-read in this pass (verify on EUR-Lex)
- Commission art. 28 guidelines (14 July 2025), secondary: https://www.taylorwessing.com/en/insights-and-events/insights/2025/07/rd-european-commission-guidelines-on-protection-of-minors-under-the-digital-services-act ; https://dsa-observatory.eu/2025/07/30/do-the-dsa-guidelines-on-protecting-minors-online-strike-the-right-balance/
- Arcom as DSC: https://www.arcom.fr/en/professional-space/regulations-on-digital-services-or-dsa-obligations-and-concerned-services ; https://formation.lefebvre-dalloz.fr/actualite/convention-de-cooperation-signee-entre-larcom-la-cnil-et-la-dgccrf-dans-le-cadre-du-respect-du-reglement-europeen-sur

French law
- L111-7-2 Code de la consommation (version since 17 Feb 2024): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049571119
- Décret n° 2017-1436 (D111-16 to D111-19): https://www.legifrance.gouv.fr/jorf/id/JORFARTI000035720943
- L121-4 Code de la consommation (27°, 28°, since 28 May 2022): https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044563107
- DGCCRF on fake reviews: https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques-et-les-faq/avis-en-ligne-attention-aux-faux-commentaires ; https://www.economie.gouv.fr/dgccrf/Publications/Vie-pratique/Fiches-pratiques/Faux-avis-consommateurs-sur-internet
- Senate document (Polygraphe, penalties): https://senat.fr/leg/ppl24-488.pdf
- Fake review penalties (secondary): https://www.lettredesreseaux.com/la-minute-des-reseaux-6-les-nouvelles-mesures-de-protection-des-consommateurs-face-aux-avis-clients-fictifs.html
- National Assembly answer on verification disclosure: https://www.assemblee-nationale.fr/dyn/15/questions/QANR5L15QE41186.pdf
- Décret 2021-1362 (secondary): https://www.dalloz-actualite.fr/document/decr-n-2021-1362-20-oct-2021-jo-21-oct ; https://www.lemondedudroit.fr/pi-tic/298-telecommunications/78030-conservation-des-donnees-de-connexion.html
- Code pénal 223-1-1 (secondary): https://www.lemag-juridique.com/veille/articles/penal-divulgation-donnees-personnelles-forces-lordre-quand-lexposition-danger-devient-delit-8948.htm
- Loi 1881 (defamation), Code civil art. 9 (image rights), Code de la santé publique (sale of alcohol to minors): not re-read in this pass

Stores
- Apple App Store Review Guidelines (1.1.4, 1.2, 1.4.3, 2.3.6, 5.1.1, 5.1.2): https://developer.apple.com/app-store/review/guidelines/
- Google Play User Generated Content: https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play Inappropriate Content (alcohol, harassment): https://support.google.com/googleplay/android-developer/answer/9878810
- Google Play Child Safety Standards: https://support.google.com/googleplay/android-developer/answer/14747720

Abuse patterns
- Grindr trilateration 2019: https://www.metroweekly.com/2019/08/grindr-and-other-gay-dating-apps-are-exposing-users-exact-location/
- KU Leuven 2024 oracle trilateration: https://techcrunch.com/2024/07/31/bumble-and-hinge-allowed-stalkers-to-pinpoint-users-locations-down-to-2-meters-researchers-say ; https://www.techradar.com/pro/privacy-flaw-in-top-dating-apps-could-have-revealed-user-location-down-to-2-metres
- Strava StravaLeaks 2024: https://www.theregister.com/2024/10/29/macron_location_strava/ ; https://computing.co.uk/news/2024/security/world-leaders-locations-exposed-strava
- Strava heatmap 2018 (secondary summary): https://www.nssmag.com/en/article/38731
- Strava Flyby 2020: https://dcrainmaker.com/2020/10/strava-flyby-feature.html ; https://totalwomenscycling.com/news/reader-story-followed-home-with-strava-flybys
- Snap Map 2017: https://tripwire.com/state-of-security/snap-map-feature-stirs-privacy-concerns-among-parents-schools ; https://futurefive.co.nz/story/snap-map-or-snap-stalk-new-zealand-police-raise-concern-over-apps-new-feature
- Zenly shutdown (3 Feb 2023) and Ghost Mode: https://www.life360.com/blog/what-happened-to-zenly ; https://app.dealroom.co/companies/zenly
- Life360 data sales: https://themarkup.org/privacy/2021/12/06/the-popular-family-safety-app-life360-is-selling-precise-location-data-on-its-tens-of-millions-of-user ; https://themarkup.org/privacy/2022/01/27/life360-says-it-will-stop-selling-precise-location-data
- Tea breach July 2025: https://www.wlox.com/2025/07/26/tea-an-app-women-anonymously-talk-about-men-they-date-has-been-breached-user-ids-exposed/ ; https://www.tomsguide.com/computing/online-security/what-is-the-tea-app

Aggregation and disclosure control
- Google Community Mobility Reports anonymization: https://arxiv.org/pdf/2004.04145
- ONS statistical disclosure control (10-5 rule, cell key perturbation): https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/methodologies/comparisonofposttabularstatisticaldisclosurecontrolmethods
- Differencing and rounding (academic): https://eprints.soton.ac.uk/44610/1/44610-01.pdf
- Tripadvisor experience date display (example page): https://www.tripadvisor.in/ShowUserReviews-g187791-d23740898-r987026210-Rome_Video_Guide-Rome_Lazio.html

Moderation tools
- Perspective API shutdown: https://perspectiveapi.com/
- Mistral moderation docs: https://docs.mistral.ai/capabilities/guardrailing/
- Mistral pricing (moderation not listed): https://mistral.ai/pricing ; third-party: https://usagepricing.com/blueprint/activity/mistral-ai-2026-08-26-price-change
- OpenAI moderation: https://developers.openai.com/api/docs/guides/moderation ; data residency: https://developers.openai.com/api/docs/guides/your-data
- Qwen3Guard: https://huggingface.co/Qwen/Qwen3Guard-Gen-4B ; report: https://arxiv.org/pdf/2510.14276
- Sightengine pricing: https://sightengine.com/pricing
- AWS Rekognition pricing (secondary): https://cloudburn.io/tools/amazon-rekognition-pricing-calculator ; official: https://aws.amazon.com/rekognition/pricing/
- Azure AI Content Safety: https://azure.microsoft.com/en-us/pricing/details/content-safety/ ; https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/ai-services/content-safety/overview.md
- Presidio: https://pypi.org/project/presidio-analyzer/1.10.0
- PhotoDNA: https://www.microsoft.com/en-us/photodna/cloudservice
- Cloudflare CSAM Scanning Tool: https://blog.cloudflare.com/the-csam-scanning-tool ; https://blog.cloudflare.com/a-simpler-path-to-a-safer-internet-an-update-to-our-csam-scanning-tool/
