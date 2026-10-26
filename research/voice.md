# Recon-Voice report

Phase 0, SLOP-01 groundwork. Deliverable companion: `SLOP.md` at the repo root (the catalogue and the SLOP-04 rules). This report covers sources, tone lessons, the outline for `VOICE.md` and the do / don't pairs.

## 1. Summary

- The tells moved in 2026. Most models were tuned to drop the em dash (GPT-5.1, then a hard suppression around September 2026, per Wikipedia), and Claude Opus 5.5 cut its own by about 99 % (Graphite study, reported by remio.ai). Dash-free text no longer proves anything. What still gives a model away is structure (Hassid's 9 tells: negation setups, glued fragments, triads, fake ranges, self-applause, closing recaps) and a new vocabulary: "quietly", "steady", "dependable", "matters", "leverage" (GPT-6 era), "dependable", "thoughtful", "meaningful", "This matters", "is more than a" (Claude). Over-correction is itself a tell: too many full stops and commas, sentences stuck between 8 and 20 words.
- Claude is the model writing this app, so its own tells are tagged [Claude] in `SLOP.md`: parenthetical asides, superlative reflex ("perhaps the most"), "This matters", the "dependable / steady / thoughtful / meaningful" family, and (per the July 2026 study cited by Wikipedia) more em dashes than professional writers.
- French needs its own list, not a translation of the English one. The humaniseur-fr skill and two French articles add calques ("faire du sens", "impacter"), adjective doublets ("robuste et fiable"), formulaic openings ("À l'ère de", "Dans un monde où"), maritime metaphors ("naviguer") and French typography (no-break spaces, « », sentence case, no Oxford comma).
- The strongest lesson from good apps is the tone-by-channel matrix (Monzo): kindness always, wit never in operational or support text, one joke rather than five. Duolingo and Mailchimp agree: voice constant, tone adapts, forced humour is worse than none. Deliveroo's fake-receipt April Fools email was read as phishing: no jokes near money.
- `SLOP.md` now has 9 sections, about 200 testable items, and 21 lint rules with exact regexes, Unicode-safe word boundaries (JavaScript `\b` breaks on é), severities, an allowlist format and fixture tests. Smoke tests of the core French and English patterns passed in Node 22.
- Two DESIGN.md §9 samples need a note: « Estimation, pas un éthylotest. » has the negation shape (kept: the misconception is real, O-19 requires it), and « 2 actions n'ont pas pu être enregistrées. » has no reason and no action, which SYNC-07 requires.

## 2. Findings

### 2.1 Sources and what each brought

| Source | Status | What it brought |
|---|---|---|
| Wikipedia, Signs of AI writing (October 2026 version) | Read in 3 passes (page is 251 000 characters). Read through a summarising fetch tool, not raw text. | Vocabulary by model era, including a new "mid-2026 onward (GPT-6)" list: challenge, clearer, dependable, echoed, foster, leverage, matters, multifaceted, practical, prioritize, quietly, steady, universally; more full stops and commas; sentences in an 8 to 20 word band. Corrective hedging ("should not be confused", "should be treated as", "rather than") tied to GPT-5.6 (July 2026). Em dash moved to "historical indicators" (2022 to September 2026) because newer models suppress it, which made comma and period density a sign. July 2026 study: only Claude uses more em dashes than professional writers. Also: copula avoidance, negative parallelism, rule of three, vague association, canned notability, "Despite these challenges", elegant variation, placeholder residue ("2025-XX-XX"), `utm_source` tracking links, curly quotes (ChatGPT and DeepSeek use them, Claude and Gemini usually not). Caveat: humans detect AI text near chance; detectors have real error rates. |
| impeccable.style/slop | Read | 37 design and copy tells with a detection mode for each (source, browser, design review). Added to SLOP.md: decorative grid lines, repeating stripes, hairline + wide shadow, crushed letter spacing, oversized hero headline, single font, soft spotlight, monotonous spacing, "calling things theater". |
| The Fountain Institute, signs of a vibe-coded UI | Read | 7 signs with fixes. The fix wording "one dominant, one accent, one neutral" and "map each dot to a state and label it" went into DE-03 and DE-25. Root cause it names: the model outputs the statistical average of "modern UI". |
| notes.nicolasdeville.com, Hassid's 9 tells (14 Aug 2026) | Read | The 9 structural tells (negation setup, glued fragments, empty metaphor pair, self-applause, X-of-Y shortcut, warming up, always three, fake range, closing recap), plus paragraph padding and long-context drift. The page suggests prompting with ASD-STE100. |
| Apple HIG, Writing | Read (via the JSON endpoint; the HTML page is script-rendered) | Buttons are clear verbs, not clever ("Send", not "Let's do it!"). Errors next to the problem, no blame, say how to fix, no "oops" or "uh-oh", avoid "we". Empty states give the next step and never hold crucial information. One capitalisation style per element type. Settings: describe what happens when on; link straight to a setting. |
| Material Design 3, writing / content design | Failed: m3.material.io and m2.material.io return only the page title (script-rendered). | Secondary sources only (a UX-writing skill based on M3, Chrome DevTools writing guide): sentence case for buttons and headings, no period on buttons, no exclamation marks in errors and empty states. Marked as secondary. |
| remio.ai, Opus 5.5 tells (2 Oct 2026), citing Graphite and Arize | Read | Claude-specific frequencies versus humans: "dependable" 23x, "steady" 11x, "thoughtful" 9x, "meaningful" 8x, "Looking ahead" 40x, "is more than a ... it" 98x, "Rather than simply" 32x, "This matters" 116x, "Why ... matters" 92x. Em dashes down about 99 %. Total tells only 4 % lower than Opus 5. GPT-6 Astra hedges more ("does not establish" 275x versus Opus 5.5). Graphite is a marketing company; figures are indicative. |
| PCWorld, Claude ranks "sounds like AI" habits (29 Jun 2026) | Read | Parenthetical asides ranked above em dashes; long sentences; "actually", "rather", "very"; "may / might"; impersonal "It is / It seems" openers. |
| Optimizely, "In defense of the em dash" (10 Aug 2026) | Read | Counterpoint: "picture this", colon-led lists and one-line punch endings are ordinary writing. The real problem is flattened, opinion-free prose; banning words does not fix it. Its test (a position someone could disagree with, specific details, a particular voice) went into the VOICE.md outline. |
| humaniseur-fr (samber/cc-skills, SKILL.md) | Read | 38 French patterns (the listings say 27). Added: calques (faire du sens, adresser, impacter, supporter, définitivement, basiquement, implémenter), adjective doublets, Oxford comma, false balance, constant granularity, lyrical filler (« instant suspendu »), « À l'ère de », « Plongeons », « Découvrez comment », « Au final ». French typography: no-break spaces before ; : ! ?, « », sentence case, consistent apostrophes, keep U+00A0 and U+202F, strip zero-width characters. It also notes « néanmoins » and « toutefois » are legitimate in human French: kept as "watch", not "ban", in SLOP.md. |
| pasqualepillitteri.it, Pangram's 9 signals (27 Aug 2026), FR | Read | Multipliers against human text: Markdown 12x (bold 43x), stock phrases 12x (« approfondissez » 45x), dash 10x, bullet lists 9x, triads 4x, « non seulement... mais aussi » 3x, odd Unicode 3x (box-drawing 940x, ≈ 241x, ⚠ 57x, arrows 48x), « Bien sûr ! Voici » 70x, functional emojis (✅ 167x, 🚀 26x, ❌ 24x). 😊 and ❤️ appear almost only in human text. |
| pasqualepillitteri.it, 12 signes (18 Mar 2026), FR | Read | « naviguer » as a metaphor, fake revelations (« Le vrai sujet est ailleurs »), « Dans un monde de plus en plus », « À l'ère du numérique », no firm opinion, empty conclusions. |
| noqta.tn, AI design slop 2026 (4 Jun 2026) | Read | Letter-spaced uppercase eyebrows, untrue "Live" / "New" badges, vague slogans ("Scale without limits"), plastic illustrations and laptop stock photos. |
| zeli.app thread on AI UI slop (27 Sep 2026) | Read | Copy tells from practitioners: implementation detail in user-facing text, prompt context leaking into copy ("3 campuses, one app"), wrong labels ("inactive"), every screen treated as a landing page, prompt rules pasted into every code comment. |
| Monzo tone of voice | Read | See 2.3. |
| Mailchimp voice and tone | Read | See 2.3. |
| giffgaff tone of voice | Read (found while searching) | "Do be friendly, but not annoying" pairs: a good format for VOICE.md traits. |
| Duolingo design guide (voice, tone) | Failed: design.duolingo.com/writing/* now redirects to a blog hub with no guide text. | Search snippets only: voice constant, tone adapts to the reader's state; tone down exclamation marks on heavy subjects. Marked as secondary. |
| French Wikipedia, Signes d'écriture par l'IA | Failed: 404 at the guessed URL. | Press coverage only: French Wikipedia banned generative AI drafting on 14 Sep 2026 (104 of 113 votes). No tell list obtained. |
| Lydia, Free, Back Market, Deliveroo FR, Le Slip Français, BlaBlaCar | Partial. No public tone guide found for any of them. | Lydia: « je te fais un Lydia » became everyday speech. Le Slip Français: offbeat humour lives in its ads (coverage of its 2012 BETC ad). Deliveroo: April Fools email with a fake huge receipt was taken for phishing. BlaBlaCar: 2026 content designer posting describes one writing system for all squads and internal tools such as a tone consistency checker. Free and Back Market: nothing usable found; their in-app copy was not studied. |
| French typography guides (UCLouvain, Université de Nantes, Blender French team) | Read via search results | Capitals only at sentence start and for proper nouns; no-break space before ! ? : ; and in dates and amounts; « » quotes. |

### 2.2 What this means for the catalogue

- Do not rely on dashes and a word list. They are the cheapest tells and the first ones models fixed. The lint catches them, but the review must hunt structure (SLOP.md section 1).
- Watch the over-correction. A model told "no dashes" writes short, comma-chopped sentences of the same length. FO-02 and CS-15 cover it.
- Detectors and humans are both unreliable (Wikipedia caveats). The process in PROMPT.md (checklist, fresh-eyes model, crew panel) is the right one; the lint is the floor.
- Flattened, voiceless text is the 2026 problem, more than any single word (Optimizely, Hassid's "long-context drift"). VOICE.md has to give positions and specifics, not only bans.

### 2.3 Tone-of-voice lessons from good apps

| Lesson | Source | How it applies here |
|---|---|---|
| Set humour intensity per channel. Operational and customer service: kindness high, wit none. Social and campaigns: wit high. | Monzo | VOICE.md gets a channel matrix: errors, sync, BAC, driving, SOS, deletion, money, legal at wit 0; games, recap, crew notifications, Party screen lines high. |
| Humour is seasoning: one joke, not five. Never punch down. No obvious puns. | Monzo | One joke per screen at most. Roast tone (AI-02) aims at the night, never at a body, money or someone who is not in the crew. |
| Own a mistake once, sincerely, then say what you do about it. Don't apologise for news that is not your fault. | Monzo | Server errors: no "sorry" stack. « Le serveur ne répond pas. On réessaie tout seuls. » is the model. |
| Lead with what the reader cares about; everyday words; active voice. | Monzo, Mailchimp, Apple | Errors start with the outcome (« Pinte refusée »), then the reason. |
| Forced humour is worse than none. When unsure, keep a straight face. | Mailchimp | Default tone is plain. Jokes are opt-in per string, reviewed. |
| Read the reader's emotional state before choosing the tone. | Mailchimp, Duolingo (secondary) | 4 am at level 3 is not 9 pm at level 0. Copy shortens with the adaptive level (UI-24). |
| Voice constant, tone adapts. Tone down exclamation on heavy subjects. | Duolingo (secondary) | One voice per language, tone per channel. No "!" in safety text (R-06). |
| Buttons are verbs, not clever lines. Errors next to the field with the fix. No "oops". | Apple HIG | UI-07, UI-08, R-12. |
| Sentence case; no exclamation in errors and empty states. | Material (secondary), Chrome DevTools guide | Sentence case in EN and FR (R-07). |
| Write traits as "X, but not Y" boundaries. | giffgaff, Mailchimp | Good format for the VOICE.md trait list. This is a style-guide device, not app copy: CS-01 still applies to the app. |
| Become the word people use, keep the UI plain. | Lydia (« je te fais un Lydia ») | Glossary words short enough to be spoken by the crew (« le récap », « la tournée »). |
| Offbeat humour lives in marketing, not in transactional screens. | Le Slip Français coverage | Store texts and social posts can be bolder than the app. |
| No jokes near money, receipts or security: they read as fraud. | Deliveroo April Fools email | UI-25. ExpensePool and payment copy stay exact. |
| Tone consistency is a system with tooling, not a person rereading strings. | BlaBlaCar content designer posting | Confirms SLOP-04 and the allowlist-with-reason approach. |
| Copying a famous voice reads as derivative. | Unsourced opinion | Do not imitate Duolingo's guilt-trip notifications (NO-07). |

### 2.4 Review of the DESIGN.md §9 samples against SLOP.md

| Sample | Verdict | Note |
|---|---|---|
| « Pinte refusée : la soirée est fermée depuis 6 h. » | Pass | « 6 h » becomes a formatted placeholder (FO-17). « Pinte » is the drink's name: in the catalogue it is `{drinkName}` with « verre » as the generic word. Space before « : » becomes U+00A0 (R-17). |
| « Le serveur ne répond pas. On réessaie tout seuls. » | Pass | Sets the rule for « on »: the app says « on » only for what it does by itself, never for blame or apology. Apple HIG says to avoid "we" in errors; this use is about action, not blame, so it stays. |
| « Pas de réseau. 3 actions partiront dès que tu captes. » | Pass | « 3 » becomes an ICU plural. « actions » is the user-facing word for PendingMutation, which the glossary says is never shown: see Glossary additions. |
| « 2 actions n'ont pas pu être enregistrées. » | Fix | No reason and no action, which SYNC-07 requires. Proposal: keep the line and add a « Voir » button that lists each action with its reason. |
| « Jade a modifié la dépense entre-temps. Sa version est gardée. » | Pass | Hyphen in « entre-temps » is a word hyphen, not a dash (R-01 does not match). |
| « Pas encore de soirée. Lance la première, le crew sera prévenu. » | Pass | « Pas de... » opening is not a cascade (R-13 checked). |
| « Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base. » | Pass, recorded exception | Negation shape (CS-01), kept because the misconception is real and O-19 requires the notice. This is the one approved case. |
| « Check-in refusé : position simulée. Aucun point. » | Pass | Glossary word « check-in ». |
| « Le Zinc est à toi. » | Pass | Venue name is a placeholder; R-07 skips placeholders. |
| « Doucement. Le récap est prêt. » | Pass | « récap » is missing from the glossary: see Glossary additions. |
| « Encore debout ? », « Bien dormi ? », « Ça commence à chauffer. » | Pass | Needs several variants per slot so no line repeats two nights in a row (JOY-02, NO-11). |
| Confirm: « Supprimer « Samedi au Zinc » ? », « Garder » / « Supprimer la soirée » | Pass | Nested guillemets in a title with a party name: allowed; inner « » take U+202F. |

### 2.5 Proposed outline for VOICE.md

```
VOICE.md
0. How to use this file
   - Writers start a fresh session with VOICE.md + SLOP.md + GLOSSARY.md (SLOP-07).
   - Every string: read it aloud. If a friend would not say it, rewrite it.
   - The positions test: does the text take a stand, give a specific, sound like us? (2026 lesson)
1. Who is talking
   - The friend in the crew who keeps track: knows the numbers, never lectures, jokes when it is safe.
   - Traits as boundaries ("direct, not cold"; "funny, not try-hard"; "precise, not technical"; "caring, not preachy").
2. Rules shared by both languages
   - One word per concept (GLOSSARY.md). Sentence case. No dashes. One emoji max, never as structure.
   - Numbers are computed placeholders. No invented figures, no ranges.
   - Punctuation: full stop on full sentences in body text; none on buttons, labels, titles; "!" never in functional text.
   - Channel matrix (clarity / warmth / humour) per text type, Monzo-style.
   - Adaptive levels: level 2 and 3 strings are shorter versions, never longer.
3. French voice
   - « tu » everywhere; « vous » only as plural to the crew (allowlisted). « on » for what the app does by itself.
   - Spoken French, correct grammar. Ne-dropping (« t'as », « c'est pas ») allowed in games and crew notifications only.
   - Typography: U+202F before ; ! ? and inside « », U+00A0 before :, apostrophe ’, times by the formatter.
   - No calques, no Title Case, weekdays and months lowercase.
   - Inclusive writing: épicène phrasing, no point médian (proposal, see Decisions).
   - References: French ones, dated, with expiry for topical cards.
4. English voice
   - Spelling base (en-US or en-GB, see Decisions), contractions on, plain verbs.
   - Dry humour, no forced slang, no hype words.
   - References: English-language ones, not translated French jokes.
5. Per text type (each with rules, 3 to 5 do / don't pairs per language, linked SLOP.md IDs)
   5.1 Buttons, labels, tabs, titles
   5.2 Errors (field errors, server, cheat rejections)
   5.3 Offline and sync (pending actions, conflicts, grouped failures)
   5.4 Empty states
   5.5 First use (one sentence + the action, then never again)
   5.6 Settings and permissions (what happens when on; permission prompts that state the real use)
   5.7 Confirmations and destructive actions
   5.8 Success feedback (none by default; when a toast earns its place)
   5.9 Notifications: crew, party, system, recap; quiet hours; variants
   5.10 Party screen lines by hour and situation (JOY-02)
   5.11 Games and cards: per-game tone, card shapes, structure cap, punchlines, crew-made cards (N-33)
   5.12 Recap: plain / epic / roast tones (AI-02), what roast may and may not target, AI label
   5.13 Safety: BAC notice (O-19, fixed wording), driving status, SOS, heading home, adaptive levels
   5.14 Money: rounds, pool, who owes what (exact, no jokes)
   5.15 Legal: terms, privacy, age gate; STE clarity, « tu », short sentences
   5.16 Store listing and share cards
   5.17 Widgets and Live Activities (character limits)
   5.18 Accessibility labels (VoiceOver / TalkBack)
6. Reference bank (FR and EN), with dates and expiry
7. Crew slang import rules (N-33): what the app may reuse, moderation
8. Review: link to SLOP.md checklist and SLOP-02 / 03 / 05 / 06 steps
```

### 2.6 Do / don't pairs, French (built from DESIGN.md §9)

| # | Situation | Don't | Do | SLOP IDs hit by "don't" |
|---|---|---|---|---|
| 1 | Drink refused, party closed | « Oups ! Une erreur est survenue lors de l'ajout de ta pinte. Merci de réessayer ultérieurement. » | « Pinte refusée : la soirée est fermée depuis 6 h. » | UI-06, R-12 (Oups), VF-R3, FO-15 |
| 2 | Slow server | « Le serveur rencontre actuellement des difficultés. Veuillez patienter quelques instants. » | « Le serveur ne répond pas. On réessaie tout seuls. » | VF-R1 (veuillez), VF-R3, CS-26 |
| 3 | Offline | « Vous êtes hors ligne 📡 Vos actions seront synchronisées automatiquement dès le retour de la connexion ! » | « Pas de réseau. 3 actions partiront dès que tu captes. » | VF-R1, FO-05, CS-28 (synchronisées), FO-15 |
| 4 | Edit conflict | « Conflit de synchronisation détecté. La version la plus récente a été conservée afin de garantir la cohérence de tes données. » | « Jade a modifié la dépense entre-temps. Sa version est gardée. » | CS-28, R-09 (afin de), R-11 (garantir) |
| 5 | Empty party list | « Ton aventure commence ici ! 🎉 Crée ta première soirée et vis des moments inoubliables avec ton crew. » | « Pas encore de soirée. Lance la première, le crew sera prévenu. » | UI-17, R-11 (aventure, moments inoubliables), FO-07 |
| 6 | BAC notice | « ⚠️ Attention : il est important de noter que ce taux n'est qu'une estimation et ne saurait en aucun cas remplacer un éthylotest homologué. » | « Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base. » | UI-19, FO-07, R-11 (il est important de), CS-14 (ne saurait) |
| 7 | Check-in rejected | « Nous avons détecté une activité suspecte. Malheureusement, ce check-in ne peut pas être validé. » | « Check-in refusé : position simulée. Aucun point. » | CS-19 (vague), UI-06 (no precise reason), VF-R3 |
| 8 | Venue taken | « Félicitations ! 👑🔥 Tu es désormais le boss incontesté du Zinc ! Continue comme ça ! » | « Le Zinc est à toi. » | UI-22, FO-06, FO-15, CS-20 |
| 9 | Next morning | « Bonjour ! ☀️ Nous espérons que tu as passé une soirée inoubliable. Découvre dès maintenant ton récap personnalisé ! » | « Doucement. Le récap est prêt. » | UI-23, R-11 (découvre, inoubliable), NO-01 |
| 10 | Delete a party | Titre « Êtes-vous sûr ? », texte « Cette action est irréversible. », boutons « Annuler » / « OK » | Titre « Supprimer « Samedi au Zinc » ? », boutons « Garder » / « Supprimer la soirée » | UI-09, VF-R1 |

### 2.7 Do / don't pairs, English (written natively, same situations)

| # | Situation | Don't | Do | SLOP IDs hit by "don't" |
|---|---|---|---|---|
| 1 | Drink refused, party closed | "Oops! Something went wrong while adding your drink. Please try again later." | "Can't add that pint. The party ended at 6 am." | UI-06, R-12 (Oops), FO-15 |
| 2 | Slow server | "We're experiencing some issues on our end. Hang tight!" | "The server's not answering. We'll keep trying." | R-12 (Hang tight), UI-06 (no reason), FO-15 |
| 3 | Offline | "You're offline 📡 Don't worry, your actions will be synced seamlessly once you're back online!" | "No signal. 3 changes will send when you're back." | FO-05, R-10 (seamlessly), CS-28, FO-15 |
| 4 | Edit conflict | "A sync conflict was detected. The most recent version has been kept to ensure data consistency." | "Jade edited this expense at the same time. Her version stays." | CS-28, CS-11 (ensure), passive voice |
| 5 | Empty party list | "Your journey starts here! 🎉 Create your first party and make unforgettable memories with your crew." | "No parties yet. Start one and your crew gets a heads-up." | UI-17, R-10 (journey, unforgettable), FO-07 |
| 6 | BAC notice | "Important: this estimate is for informational purposes only and should not be treated as a substitute for a certified breathalyzer." | "An estimate, not a breathalyzer. Never drive based on it." | UI-19, CS-14 (should not be treated as) |
| 7 | Check-in rejected | "We've detected suspicious activity. Unfortunately, this check-in couldn't be validated." | "Check-in rejected: fake location. No points." | CS-19, UI-06 |
| 8 | Venue taken | "Congratulations! 👑🔥 You're now the undisputed boss of The Zinc! Keep up the great work!" | "The Zinc is yours." | UI-22, FO-06, FO-15 |
| 9 | Next morning | "Good morning! ☀️ We hope you had an amazing night. Discover your personalized recap now!" | "Easy does it. Your recap's ready." | UI-23, NO-01, FO-15 |
| 10 | Delete a party | Title "Are you sure?", body "This action cannot be undone.", buttons "Cancel" / "OK" | Title "Delete "Saturday at The Zinc"?", buttons "Keep" / "Delete party" | UI-09 |

The EN "do" lines are not translations: "Easy does it" and "heads-up" have no word-for-word French match, and the French « dès que tu captes » has no English twin. That is the intent of <localization>.

### 2.8 Text in sources aimed at models

No source page contained instructions aimed at an AI reading it. Two pages carry model-directed text by design, reported here and not followed:

- humaniseur-fr SKILL.md: it is a skill, so it instructs a model (for example "One pass only" and "Ask the user before starting to humanize"). Read as data.
- zeli.app thread: a commenter posted style rules for an AI writer ("No special formatting", "No passive voice"). Quoted only as an example of practitioners' rules.

## 3. Decisions proposed

1. Adopt `SLOP.md` as written, with the lint rules R-01 to R-21 as the SLOP-04 spec. Reason: every rule has a test and a severity; the catalogue keeps all of PROMPT.md and adds the 2026 tells.
2. Two severities (error, warn) plus an allowlist with a mandatory reason. Reason: words like "challenge", « défi », "epic" and plural « vous » are legitimate in some strings; a lint without escape hatches gets disabled.
3. Sentence case in both languages, for every element type. Reason: French requires it; Material recommends it; one rule is easier to lint than per-element Title Case (Apple allows either, as long as it is consistent).
4. Punctuation: full stop on full sentences in body text; no full stop on buttons, labels and titles; "!" never in functional namespaces, at most one elsewhere. Reason: matches DESIGN.md §9 and Material (secondary).
5. FR typography in catalogues: U+202F before ; ! ? and inside « », U+00A0 before :, apostrophe ’. EN: ’ and “ ”. Reason: correct French, and a typed convention is lintable (R-17).
6. « on » in French and "we" in English only for what the app does by itself (« On réessaie tout seuls »), never in blame or apology. Reason: reconciles DESIGN.md §9 with Apple's "avoid we in errors".
7. AI-written recap (AI-02) and AI cards (AI-03) carry a plain label (« Écrit par l'IA, validé par le crew » / "Written by AI, approved by the crew"), no sparkle icon. Reason: honesty, UI-11, and possible EU AI Act transparency duties (A-VOICE-8).
8. EN spelling base: en-US for the base `en` catalogue, with an en-GB override file only for strings whose spelling or word differs (breathalyser, pint wording). Reason: one EN voice, units are already a separate setting (PREF-04). Needs the user's yes; not blocking.
9. Inclusive French: épicène phrasing (« le crew sera prévenu », « tout le monde »), no point médian. Reason: reads like speech, and screen readers handle it badly. Needs the user's yes; not blocking.
10. The grouped-failure sample gets a « Voir » / "See" action listing each failed action with its reason. Reason: SYNC-07.

## 4. Assumptions

- A-VOICE-1: The Wikipedia per-era vocabulary lists (including the GPT-6 era list) are accurate. Based on: three passes through a summarising fetch tool, not the raw page. Verify: read the raw wikitext before SLOP-04 freezes its lists.
- A-VOICE-2: The Graphite multipliers for Opus 5.5 are indicative. Based on: secondary article (remio.ai) citing a study by a marketing company. Verify: fetch the Graphite study itself.
- A-VOICE-3: Deck thresholds (opening cap 5 % or 15 cards, length CV 0.35, Jaccard 0.8, triads 10 %) are good starting values. Based on: no source, judgement. Verify: run them on the first 500 cards per language and tune with the card author and critical friend.
- A-VOICE-4: The lint runs in a Node 20+ toolchain (needed for `\p{RGI_Emoji}` with the `v` flag). Based on: stack not chosen yet. Verify: Recon-Stack decision; port patterns if the toolchain differs.
- A-VOICE-5: Plural « vous » addressed to the whole crew does not break the « tu » voice for French readers. Based on: everyday French usage, unsourced. Verify: crew panel (SLOP-06).
- A-VOICE-6: Archivo (DESIGN.md §2) has glyphs for U+202F, U+00A0, « », ’ and “ ”. Based on: not checked. Verify: inspect the font's character map before adopting R-17; else fall back to U+00A0 everywhere.
- A-VOICE-7: French consumer apps aimed at under-30s mostly use « tu », so « tu » in legal texts is acceptable. Based on: unsourced. Verify: Recon-Legal, and the terms of two French apps in the same audience.
- A-VOICE-8: The EU AI Act transparency obligations (Article 50, applicable from August 2026) may cover AI-generated text shown to users. Based on: memory, not read in this recon. Verify: Recon-Legal.
- A-VOICE-9: Free, Back Market, Deliveroo FR and BlaBlaCar in-app copy would give more French lessons than found here. Based on: no public guides found. Verify: a short manual audit of their apps' error, empty and notification texts, if the user wants it.

## 5. Scope changes

| Proposed | Priority | Reason |
|---|---|---|
| SLOP-04: widen scope to notification templates, widget and Live Activity strings, store texts, legal texts, game decks; add fixture tests (bad and good corpus, §9 samples in the good one) and the reasoned allowlist | P0 (change to existing ID) | Without fixtures the regexes drift; without the allowlist the lint gets switched off. |
| SLOP-09 Deck lint (R-20): opening cap, length spread, near duplicates, moralising, expiry of topical cards | P1 | Turns the <content_patterns> rules into checks before the crew panel sees the deck. |
| SLOP-10 Glossary synonym lint (R-19), generated from GLOSSARY.md | P1 | Enforces "one word per concept" across 500+ cards and every screen. |
| SLOP-11 Copy variants: every recurring line (JOY-02 greetings, recurring notifications) has at least 3 written variants and a no-repeat rule per user | P1 | NO-11; same line every night reads as a bot. |
| AI-02 / AI-03: add the plain AI label (Decision 7) | P1 (change) | Honesty and UI-11. |
| SYNC-07: grouped failure shows an action and per-item reasons | P0 (change) | §9 sample fix. |

## 6. Glossary additions

| Concept | Code / EN UI | FR UI | Note |
|---|---|---|---|
| Summary of a night | `Recap` / recap | récap | Used in DESIGN.md §9 and many IDs, missing from the glossary. |
| Game card | `Card` / card | carte | |
| Dare (game) | `Dare` / dare | défi | « gage » is the penalty, not the dare. |
| Taking a venue (VenueBoss change) | `VenueTakeover` / takeover | prise du lieu (UI line: « {venue} est à toi. ») | Proposal; the noun is rarely shown. |
| Count of pending actions shown to the user | `PendingMutation` count / changes | actions | Conflicts with "never shown as a word": §9 shows « 3 actions partiront ». Proposal: the word is allowed only as a count in sync messages. |
| Recap tone (AI-02) | `RecapTone` (plain, epic, roast) / plain, epic, roast | sobre, épique, chambrage | « chambrage » proposed for roast; to settle in branding. |

## 7. Blockers

None. Decisions 8 (EN spelling base) and 9 (inclusive French) need the user's yes, but phase 0 can continue without them.

## 8. Sources

All read on 2026-10-26.

| URL | Status |
|---|---|
| https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing | Read (3 passes, summarised fetch) |
| https://impeccable.style/slop | Read |
| https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui | Read |
| https://notes.nicolasdeville.com/ai/ai-writing-tells/ | Read |
| https://developer.apple.com/design/human-interface-guidelines/writing | HTML empty (script-rendered) |
| https://developer.apple.com/tutorials/data/design/human-interface-guidelines/writing.json | Read |
| https://m3.material.io/foundations/content-design/style-guide/word-choice | Failed (title only) |
| https://m3.material.io/foundations/content-design/style-guide/ux-writing-best-practices | Failed (title only) |
| https://m2.material.io/design/communication/writing.html | Failed (title only) |
| https://chromium.googlesource.com/devtools/devtools-frontend/+show/main/docs/styleguide/ux/writing.md | Search snippet only (secondary for Material) |
| https://www.remio.ai/fr/post/claude-opus-5-5-writing-tells-changed-but-they-did-not-disappear-fr | Read |
| https://www.pcworld.com/article/3179916/claude-ranked-my-sounds-like-ai-writing-habits.html | Read |
| https://www.optimizely.com/field-notes/articles/in-defense-of-the-em-dash-and-everything-else-on-this-ai-tell-trial | Read |
| https://raw.githubusercontent.com/samber/cc-skills/main/skills/humaniseur-fr/SKILL.md | Read |
| https://skills.sh/samber/cc-skills/humaniseur-fr | Search result (listing) |
| https://pasqualepillitteri.it/fr/news/13026/9-signaux-ecriture-ia-pangram | Read |
| https://pasqualepillitteri.it/fr/news/404/reconnaitre-texte-ecrit-ia-detector-checker | Read |
| https://noqta.tn/en/blog/ai-design-slop-overused-ui-patterns-fix-2026 | Read |
| https://zeli.app/story/49867038 | Read |
| https://monzo.com/tone-of-voice | Read |
| https://styleguide.mailchimp.com/voice-and-tone/ | Read |
| https://www.giffgaff.design/writing/tone-of-voice/ | Read |
| https://design.duolingo.com/writing/voice | Failed (redirect to blog hub, no guide) |
| https://design.duolingo.com/writing/tone | Failed (same redirect) |
| https://blog.duolingo.com/hub/design/ | Read (no voice guide on it) |
| https://fr.wikipedia.org/wiki/Wikipédia:Signes_d'écriture_par_l'IA | Failed (404) |
| https://korben.info/wikipedia-en-francais-interdit-la-redaction-par-ia.html | Search snippet (French Wikipedia ban, 14 Sep 2026) |
| https://hugobentz.substack.com/p/la-veritable-histoire-derriere-le | Search snippet (« je te fais un Lydia ») |
| https://www.ozap.com/actu/pour-sa-premiere-publicite-le-slip-francais-casse-des-oeufs/444142 | Search snippet (Le Slip Français ad tone) |
| https://www.buzzwebzine.fr/pourquoi-le-slip-francais-mieux-que-les-autres-pub-humour/ | Search snippet |
| https://www.presse-citron.net/ce-mysterieux-mail-de-deliveroo-etait-une-tres-mauvaise-idee/ | Search snippet (April Fools email read as phishing) |
| https://iphonesoft.fr/2021/04/01/deliveroo-pire-idee-poisson-avril | Search snippet |
| https://www.indexventures.com/startup-jobs/blablacar/content-designer/ | Search snippet (BlaBlaCar writing system, tone checker) |
| https://www.uclouvain.be/fr/system/files/uclouvain_assetmanager/groups/cms-editors-cirtes/documents/ConsignestypoPUL.pdf | Search snippet (French capitals, no-break spaces) |
| https://developer.blender.org/docs/handbook/translating/french_team/ | Search snippet (French UI typography) |

Facts without a source in this report are marked "unsourced" or "memory" in the Assumptions.
