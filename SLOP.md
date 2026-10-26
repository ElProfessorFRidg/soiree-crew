# SLOP.md

The catalogue of AI tells for this app: copy (EN and FR), design, game cards, code and notifications. Use it two ways:

1. As a review checklist (SLOP-02, SLOP-03). Each line has a "Fail if" test: answer yes or no. One yes is a defect.
2. As the source of the CI lint (SLOP-04). The rules the lint can check are in "Machine-checkable rules for SLOP-04" at the end.

Source of truth: `PROMPT.md` <anti_slop>. Everything there is here, plus what Recon-Voice found in October 2026 (sources and dates in `research/voice.md`). Voice, tone and examples live in `VOICE.md`. This file only says what to hunt.

Ground rules for reviewers:

- A pattern is banned because AI puts it everywhere, not because no human ever writes it. One instance can pass when the content earns it. Density is the signal: two tells in one string, or the same tell across a screen, is a defect.
- Clean but voiceless text also fails. Removing tells is half the job. The other half is `VOICE.md`.
- The best fix is often deletion. Ask "does the screen work without this text?" before rewriting it.
- The writer distrusts itself first. The model building this app is Claude. Its own 2026 tells are marked [Claude] below.
- Tells change with each model generation. When you meet a new one, add a row and a line in the Changelog.

IDs are stable. Cite them in review defects (for example "CS-03 on `party.empty.body`").

---

## 1. Copy structure tells

The most revealing tells, and the hardest to see. They apply to every text in EN and FR.

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| CS-01 | Cascading negation | The text denies something nobody claimed, then states the real point: "It's not X. It's Y.", "Not an A. Not a B.", « Ce n'est pas X, c'est Y », « Pas un picolo. Pas un compteur. » | Write only the second half. Keep a negation only when the misconception is real for this user (the BAC notice is the one approved case). |
| CS-02 | "Not only / not just" and "Y rather than X" | "not only... but also", "it's not just..., it's...", "more than a...", "rather than simply", « non seulement... mais aussi », « il ne s'agit pas de... mais de », « plus qu'un(e)... », « plutôt que de simplement » | State the claim directly. |
| CS-03 | Glued fragments | Two or more clipped fragments stand in for a sentence: "Fast. Fun. Ruthless.", « Simple. Rapide. » | One real sentence, or the one fragment that matters. |
| CS-04 | Always three | A list of exactly three adjectives, benefits or examples where the real count is different or nobody counted. | Give the real number of items. Two is fine. Five is fine. |
| CS-05 | Fake range | "5 to 10 minutes", « de 5 à 10 min », or a range with unrelated ends: "from chill drinks to legendary nights", « du petit verre à la soirée mythique » | A computed number, a list, or nothing. |
| CS-06 | Empty metaphor pair | "Less a hammer, more a scalpel." « Moins un marteau qu'un scalpel. » | Say what the thing does. |
| CS-07 | X-of-Y shortcut | "the Excel of nights out", « le Tinder des soirées » | Say what the thing does. |
| CS-08 | Warming up | The text opens with throat-clearing: "Here's the thing.", "Let's be clear.", "Let's talk about", "Picture this", « Soyons clairs », « Parlons de », « Imagine un peu » | Start one sentence later. |
| CS-09 | Self-applause | A line announces importance instead of showing it: "And that changes everything.", "That's what matters.", "This matters.", "Why X matters" [Claude], « Et ça change tout. », « C'est ça qui compte. » | Delete it. Nothing is lost. |
| CS-10 | Closing recap | "In short", "At the end of the day", "Overall", "In summary", « En somme », « En résumé », « En bref », « Au final », « En définitive » | Stop typing. |
| CS-11 | Trailing participle clause | A sentence ends on ", highlighting / reflecting / underscoring / contributing to / ensuring / offering..." or « , soulignant / reflétant / témoignant de / offrant / garantissant... » | Cut the clause, or make it a separate concrete sentence. |
| CS-12 | Copula avoidance | "serves as", "stands as", "functions as", "represents", "marks", "boasts", "features", "offers" where "is" or "has" works. FR: « se positionne comme », « constitue », « fait office de », « s'impose comme », « dispose de », « représente » | Use is / has, est / a. |
| CS-13 | Synonym cycling (elegant variation) | The same thing has two or more names in one screen or text (crew, squad, gang; soirée, sortie, fête). | Repeat the noun. The glossary sets one word per concept. |
| CS-14 | Corrective disclaimer (mid-2026 tell, GPT-5.6 era) | "should be read as X rather than Y", "should not be confused with", "should be treated as", "does not establish", "not necessarily", « ne doit pas être confondu avec », « ne saurait être considéré comme », « ne permet pas d'établir » | State what the thing is. Drop the disclaimer unless it is legally required. |
| CS-15 | Metronome rhythm | In any text of 4 sentences or more, all sentences have about the same length (most between 8 and 20 words, a 2026 tell), one idea per paragraph, no digression. | Vary length on purpose. Merge two short ones, split a long one, allow one aside. |
| CS-16 | Fake revelation | "But there's a catch.", "Here's the twist.", « Mais il y a un hic. », « Le vrai sujet est ailleurs. » | Say the catch. |
| CS-17 | Paragraph padding | A text opens with context nobody asked for and closes with a summary. | Keep the middle. |
| CS-18 | Vague association | "associated with", "in connection with", "linked to" where a direct claim is possible. « en lien avec », « associé à » | Name the relation: caused, paid, checked in, won. |
| CS-19 | Vague attribution | "Experts say", "Studies show", "Many people", « Les experts estiment », « De nombreuses études » | Name the source, or drop the claim. In-app, there are no experts: only the data. |
| CS-20 | Generic positive ending | "The future looks bright.", "The night is only getting started!", « L'avenir s'annonce prometteur. », « Et ce n'est que le début ! » | End on a concrete fact. |
| CS-21 | Despite-challenges frame | "Despite these challenges...", « Malgré ces défis... » followed by vague optimism. | State the problem and the fact. No moral. |
| CS-22 | False balance | Every claim is immediately weighed ("pros and cons", « d'un côté... de l'autre »). No position taken. | Take the position. Delete the counterweight unless it is true and useful. |
| CS-23 | Parenthetical asides [Claude] | More than one parenthetical aside per text, or an aside that only softens. | Make it a sentence or cut it. |
| CS-24 | Hedging stack | Two or more hedges in one sentence: "may potentially", "might perhaps", « pourrait éventuellement », « il semblerait que peut-être » | One hedge where the doubt is real. None elsewhere. |
| CS-25 | Superlative reflex [Claude] | "the most powerful", "perhaps the most", "the best", « le plus puissant », « sans doute le meilleur » without a fact that proves it. | Frank superlatives are allowed when true and checkable in the app ("the most check-ins this month"). Otherwise cut. |
| CS-26 | Impersonal opener | "It is...", "It seems...", "There is no doubt...", « Il est à noter que », « Il semble que » | Start with the subject that acts. |
| CS-27 | Leaked prompt context | Copy repeats the brief instead of talking to the user: "3 campuses, one app", "Built for crews", a feature list read back as a slogan. | Write what the user needs on this screen. |
| CS-28 | Implementation detail in copy | The user reads how it works inside: "Syncing mutations", "Optimistic update", "Server-side verification", « File d'attente de mutations » | Say what happens for the user ("3 changes will send when you get signal"). |
| CS-29 | Lyrical filler (fiction, recap) | "a moment suspended in time", "a whispered promise", "the night held its breath", « un instant suspendu », « une promesse murmurée », « la nuit retenait son souffle » | Concrete narration: who, where, what time, what happened. |
| CS-30 | The list as escape | A bulleted list where a choice or a sentence is needed. | One sentence that decides. |

---

## 2. Vocabulary blacklist, English

Status "ban": the lint fails the build (see R-10). Status "watch": the lint reports it, a reviewer decides. Inflections are covered by the regexes in R-10.

### 2.1 AI vocabulary (Wikipedia, by model era, plus 2026 studies)

| Word / phrase | Status | Fail if | Fix |
|---|---|---|---|
| additionally | ban | present | "and", "also", or a new sentence |
| align with | ban | present | "match", "fit" |
| boast(s, ed, ing) | ban | present | "has" |
| bolster(ed) | ban | present | "back", "strengthen", or cut |
| crucial | ban | present | cut, or say why it matters |
| deep dive | ban | present | "look at" |
| delve | ban | present | "look at", "go into" |
| emphasize, emphasizing | ban | present | cut |
| enduring | ban | present | cut |
| enhance(d, s, ment) | ban | present | "improve", or name the change |
| foster(ing) | ban | present | "build", "help" |
| garner(ed) | ban | present | "get", "win" |
| highlight (verb: highlights the, highlighting, highlighted) | ban | used as a verb | "show". The noun "highlights" (N-22 recap) is allowed. |
| interplay | ban | present | "mix" |
| intricate, intricacies | ban | present | cut |
| key (adjective: "key feature", "key moment") | watch | used as hollow adjective | name the thing |
| landscape (abstract) | watch | not about scenery or screen orientation | cut |
| leverage | ban | present | "use" |
| meticulous(ly) | ban | present | cut |
| multifaceted | ban | present | cut |
| pivotal | ban | present | cut |
| prioritize | watch | in UI copy | "put first" |
| robust | ban | present | cut, or say what it survives |
| showcase, showcasing | ban | present | "show" |
| tapestry | ban | present | cut |
| testament | ban | present | cut |
| underscore(s, d) | ban | present | cut |
| valuable | ban | present | cut, or say what it gives |
| vibrant | ban | present | cut |
| nestled, in the heart of, renowned, rich (heritage, history) | ban | present | a fact about the place |
| commitment to | ban | present | say what is done |
| echoed | watch | present | cut |
| quietly [GPT-6 era] | ban | present | cut |
| steady [Claude] | watch | adjective used as praise | cut |
| dependable [Claude, 23x human rate] | ban | present | cut |
| thoughtful [Claude] | ban | present | cut |
| meaningful [Claude] | ban | present | cut |
| universally | ban | present | cut |
| clearer, practical | watch | hollow praise | say what changed |
| challenge | watch | outside games | allowed in games (a dare); elsewhere name the problem |
| looking ahead, what comes next, adds another layer [Claude] | ban | present | cut |
| actually, rather, very [Claude filler] | watch | more than once per screen | cut |

### 2.2 Hollow marketing

| Word / phrase | Status | Fix |
|---|---|---|
| supercharge, turbocharge | ban | say what it does |
| world-class, best-in-class, next-generation, cutting-edge, state-of-the-art | ban | a checkable fact or nothing |
| seamless(ly), effortless(ly), frictionless | ban | cut |
| unleash, unlock your, elevate, empower, revolutionize, reimagine(d) | ban | the plain verb |
| game-changer, game-changing | ban | cut |
| in today's world, in today's fast-paced world, in the digital age | ban | cut |
| whether you're X or Y | ban | talk to this user |
| ready to...? (as a hook) | ban | the information |
| your journey (starts here), adventure, unforgettable, epic (as praise), magic(al), ultimate | ban | the fact. "Epic" stays allowed as the name of a recap tone (AI-02). |
| simply, easily, in just a few taps, in seconds | ban | cut |
| join thousands / millions, the community of | ban | true numbers only, computed |
| never miss (a night) again, the best party app, precise BAC | ban | the true claim |
| smart, intelligent, AI-powered (as a selling word) | ban | say what it does |

### 2.3 Chatbot residue

| Phrase | Status | Fix |
|---|---|---|
| Of course!, Certainly!, Absolutely!, Great question, I hope this helps, Feel free to, Let me know, Is there anything else, Would you like..., Happy to help, Here's what you need to know, Sure! Here is | ban | delete |
| As an AI, as of my last update, I'm sorry, but | ban | delete |
| Oops, Whoops, Uh-oh, Yikes | ban | the error and its reason (Apple HIG) |
| Hang tight, Sit tight | ban | say what happens and when |

---

## 3. Vocabulary blacklist, French

Models drift to formal written French even when asked for casual French. Every French string is read aloud: it must sound like a friend talking, in « tu ».

### 3.1 Vocabulaire IA et formules

| Mot / formule | Status | Fix |
|---|---|---|
| plonger dans, plongeons, approfondir, approfondissez | ban | « regarder », « voir » |
| il est important de noter / souligner, il convient de, il est crucial de, il est essentiel de, il est fondamental de | ban | dire la chose |
| en outre, par ailleurs, de plus, également (connecteur) | ban | « et », « aussi », ou une nouvelle phrase |
| néanmoins, toutefois | watch | trop écrit pour l'app : « mais » |
| en somme, en conclusion, en définitive, en résumé, au final, comme nous l'avons vu | ban | s'arrêter |
| divers, diverses, nombreux, nombreuses, particulièrement (quantifieurs vagues) | ban | le vrai nombre ou rien |
| mettre en œuvre, faciliter, optimiser, garantir, assurer (au sens de garantir) | ban | le verbe simple : faire, aider, régler |
| incontournable, holistique, robuste, réinventé, révolutionnaire, disruptif, véritable | ban | couper |
| au cœur de, dans le paysage, la pierre angulaire, mettre en lumière, naviguer (figuré) | ban | couper |
| crucial, essentiel, significatif | ban | couper ou dire pourquoi |
| sublimer, booster, révolutionner, propulser, libérer, libère | ban | le verbe simple |
| de manière fluide, en toute simplicité, en toute sérénité, en quelques clics, en un clin d'œil | ban | couper |
| expérience unique / inoubliable / immersive, moments inoubliables | ban | le fait |
| que tu sois X ou Y, dans un monde où, à l'ère de, dans le monde effréné d'aujourd'hui | ban | parler à cette personne |
| prêt à... ? (accroche), découvre, découvrez, ton aventure commence, l'aventure | ban | l'information |
| symbolisant, soulignant, témoignant de, reflétant (participes de fin de phrase) | ban | voir CS-11 |
| se positionne comme, constitue, fait office de, s'impose comme, dispose de | ban | est, a |
| robuste et fiable, simple et intuitif, rapide et efficace (doublets d'adjectifs) | ban | un seul adjectif précis, ou aucun |
| afin de, en raison du fait que, dans le but de, au niveau de | watch | « pour », « parce que », « sur » |
| défi | watch | permis dans les jeux (un défi à relever) ; ailleurs, nommer le problème |

### 3.2 Résidus de chatbot

| Formule | Status | Fix |
|---|---|---|
| Bien sûr !, Bien sûr ! Voici, Excellente question, J'espère que cela t'aide / vous aide, N'hésite pas à, N'hésite pas si, Je serais ravi de t'aider, Voici ce que tu dois savoir | ban | supprimer |
| Oups, Aïe, Mince alors (en erreur) | ban | l'erreur et sa raison |
| Selon les informations disponibles, À ma connaissance | ban | supprimer |

### 3.3 Anglicismes et calques

| Calque | Status | Fix |
|---|---|---|
| faire du sens | ban | avoir du sens |
| adresser un problème | ban | traiter, régler |
| impacter | ban | toucher, changer |
| supporter (une fonction) | ban | prendre en charge, gérer |
| définitivement (= definitely) | ban | sans doute, carrément |
| basiquement | ban | en gros |
| implémenter | ban | (jamais en UI) |
| éligible à | watch | qui a droit à |
| Title Case calqué : « Mes Soirées », « Ajouter Un Verre » | ban | « Mes soirées », « Ajouter un verre » |
| virgule d'Oxford : « la bière, le vin, et le cidre » | ban | « la bière, le vin et le cidre » |
| jours et mois en majuscule en milieu de phrase : « le Samedi 12 Octobre » | ban | « le samedi 12 octobre » (sauf nom de soirée choisi par l'utilisateur) |
| traduction mot à mot de l'anglais (« Bon travail ! », « Tu as ceci ! ») | ban | écrire en français, pas traduire |

### 3.4 Registre

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| VF-R1 | « vous » dans une app en « tu » | « vous », « votre », « vos », « veuillez » adressés à une seule personne | « tu », « ton », « ta », « tes ». Le « vous » pluriel au crew (« Vous êtes 4 au Zinc ») est permis, déclaré dans l'allowlist (R-08). |
| VF-R2 | Argot forcé | « trop stylé frérot 🔥💯 », « c'est le feu », « wesh », verlan plaqué | Langue parlée correcte. L'argot vient du crew (N-33). |
| VF-R3 | Français écrit administratif | « Merci de bien vouloir », « ultérieurement », « suite à », « procéder à » | Ce qu'on dirait à voix haute. |

---

## 4. Form tells

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| FO-01 | Em dash and en dash | Any U+2014 or U+2013 in app text, store text, notifications, cards. Also U+2012, U+2015 and a spaced hyphen used as a pause ("word - word"). | Comma, colon, full stop or parentheses. Ranges are written with words, and only when computed. |
| FO-02 | Over-correction of dashes (post September 2026) | Models hard-coded to avoid dashes now pile up full stops and commas: every sentence short, chopped into 2 or 3 clauses with commas. | Vary rhythm (CS-15). A semicolon is not the answer either. |
| FO-03 | Mechanical bold | Bold used on key words inside running text in the app. | No bold inside sentences. Hierarchy comes from type styles (DESIGN.md §2). |
| FO-04 | "**Word:** sentence" lists | Inline bold header plus colon at the start of list items, in app copy, store text or recap. | Prose, or a plain list. |
| FO-05 | Emoji as structure | An emoji at the start of a title, button, label, notification title, or used as a bullet or nav icon. | Custom icon set (`design/icons.json`). Emojis stay fine in reactions and user content. |
| FO-06 | Emoji stacking | More than one emoji in one string. | One at most, only where the tone allows it (games, crew notifications). |
| FO-07 | Functional emojis | ✅ ❌ 🚀 ✨ 🎉 🔥 💯 👉 ⚠️ or keycap digits used as status, bullet, warning or hype. | Icons and words. |
| FO-08 | Unusual Unicode | Arrows (U+2192 and friends), approx sign (U+2248), box-drawing characters (U+2500 block), warning sign (U+26A0), checkmarks, stars as bullets. | Words. |
| FO-09 | Quote and apostrophe mix | Straight and curly quotes or apostrophes mixed in one locale file. FR uses straight " instead of « ». | One convention per locale (proposal in R-17). |
| FO-10 | Title Case | EN: every word capitalised in a title or button when the convention is sentence case. FR: any English-style Title Case. | Sentence case in both languages. Proper nouns only. |
| FO-11 | Markdown residue | `**`, `__`, `#` headings, backticks visible in a string. | Remove. |
| FO-12 | Placeholder residue | "[Insert...]", "TODO", "Lorem", "XX", "2025-XX-XX", "INSERT_", "{{" unfilled, an ICU placeholder shown raw to the user. | Fill it or remove the string. |
| FO-13 | Zero-width characters | U+200B, U+200C, U+200D (outside emoji sequences), U+FEFF in strings. | Remove. Keep U+00A0 and U+202F (French spacing). |
| FO-14 | Stacked punctuation | "!!", "?!", "!?", "!!!", « ! ! » | One mark. |
| FO-15 | Exclamation reflex | More than one "!" in a string, or any "!" in errors, safety, SOS, BAC, driving, deletion and legal text. | Full stop. Excitement comes from motion and haptics. |
| FO-16 | Missing French spacing | FR: no space, or a breaking space, before ; : ! ? or inside « ». | Narrow no-break space U+202F before ; ! ? and inside « », no-break space U+00A0 before :. |
| FO-17 | Literal numbers in strings | A digit typed into a localisation string. | A placeholder filled with a computed value. Static numbers only for fixed facts (emergency numbers come from data, not strings). |
| FO-18 | Tracking links | Share or help links carrying `utm_source=chatgpt.com`, `utm_source=openai` or similar copied from an AI answer. | Clean URL. |

---

## 5. UI copy tells

What a real app does not do.

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| UI-01 | Explaining the feature everywhere | A subtitle under a title that says what the screen is ("Here you can track...", « Ici, tu peux suivre... », "This screen lets you", « Cet écran te permet de »). | Delete. A clear title is enough (Apple HIG). |
| UI-02 | Setting description repeating its name | "Notifications: Turn notifications on or off." | No description, or say what changes when it is on (Apple HIG). |
| UI-03 | Help bubbles and tutorials | A help bubble on most screens, or a tutorial of more than one step. | First use: one sentence plus the action, at most, then never again. |
| UI-04 | Several texts saying the same thing | Title + subtitle + placeholder + helper all say one thing for one field. | Keep one. Usually the label. |
| UI-05 | Success toast for every action | "Drink added successfully!", « Verre ajouté avec succès ! », « Ton verre a bien été ajouté ». | No toast. Motion and haptics confirm (SYNC-07). A toast only when it says something new ("Your 3rd round tonight"). |
| UI-06 | Error without reason or action | "Something went wrong", "An error occurred", "Unexpected error", « Une erreur est survenue », « Une erreur inattendue s'est produite », « Erreur » alone. | The reason, then the action (SYNC-07, DESIGN.md §9). |
| UI-07 | Blaming or vague error | "Invalid input", "You entered a wrong value", « Saisie invalide ». | Say how to fix it, next to the field (Apple HIG). |
| UI-08 | Clever button | "Let's do it!", "Let's go!", "Yes, I'm in!", « C'est parti ! », « Go ! » on a functional button. | A clear verb with its object: "Delete party", « Supprimer la soirée ». |
| UI-09 | Generic confirm dialog | "Are you sure?" with "OK" / "Cancel", « Êtes-vous sûr ? » | Title names the action and the object, buttons name the outcomes: "Keep" / "Delete party" (DESIGN.md §9). |
| UI-10 | Badges and sparkle | "New" badges, sparkles, flames, pills or pulsing "Live" on items that are not new or live. | Only when true, and removed after first view. |
| UI-11 | Sparkle for AI features | ✨ icon or "Magic" label on AI features (AI-02, AI-03). | A plain label that says what it does, and a plain note that AI wrote it. |
| UI-12 | Promises the app does not keep | "precise BAC", "never miss a night again", "the best party app", "join thousands of party people" for 12 friends, fake reviews, fake counters, fake urgency. | Every claim true and checkable in the app. |
| UI-13 | Made-up numbers | A number not computed from data, a round range ("5 to 10 min"). | Computed, or not displayed. |
| UI-14 | Several names for one thing | A word not in the glossary used for a glossary concept ("squad", « groupe », « bande » for crew). | `GLOSSARY.md` word. |
| UI-15 | Forced slang | "this slaps fr fr 💯", « trop stylé frérot 🔥 ». | Plain speech. Slang comes from the crew (N-33). |
| UI-16 | One tone everywhere | Jokes in SOS, errors, driving, BAC, deletions, payments or legal text. Or no voice at all in games, recap and crew notifications. | Tone by channel (VOICE.md). Jokes belong in games, recap and crew notifications. |
| UI-17 | Motivating or preachy empty state | "Start your adventure!", « Ton aventure commence ici ! », "Nothing here yet... but not for long!" | One useful sentence plus the action. |
| UI-18 | Ad-style notification | See section 9. | Information first, one line. |
| UI-19 | BAC notice bloated or repeated | The O-19 notice longer than two short sentences, legalistic, or shown more than once per screen. | « Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base. » |
| UI-20 | Every screen a landing page | A functional screen carries a tagline, a hero line or a slogan. | The function. Slogans live in the store listing, if anywhere. |
| UI-21 | Untrue or vague labels | A label that misstates the data ("inactive" for someone who just left; "friends" for crew members). | The exact state, glossary word. |
| UI-22 | Reflex cheer | "Awesome!", "Great job!", "Congrats!", « Super ! », « Génial ! », « Bravo ! », « Félicitations ! » on routine actions. | Nothing. Keep praise for real events (a venue taken, a podium). |
| UI-23 | Reflex greeting | "Hey there!", "Welcome back!", « Coucou ! », « Re-bonjour ! » on every open. | Lines that know the time (JOY-02) and change, or nothing. |
| UI-24 | Long text at adaptive levels 2 and 3 | Any string at level 2 or 3 longer than its level 0 version, or a full sentence where one word does. | Shorter and simpler as the level rises (ADP rules). |
| UI-25 | Humour around money | A joke in ExpensePool, payment or amount text. (Deliveroo's fake-receipt April Fools email was read as phishing.) | Plain and exact. |
| UI-26 | Accessibility labels that narrate | VoiceOver / TalkBack labels like "Button to add a drink", "Image of a beer". | "Add drink". Role is announced by the system. |

---

## 6. Design tells

Visual tells of an AI-made app. `DESIGN.md` bans them (SLOP-08). Source tags: Impeccable (I), Fountain Institute (F), noqta 2026 (N), PROMPT.md (P).

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| DE-01 | AI palette | Violet to blue or indigo gradients, bright cyan on dark, purple-ish hue as the brand colour (P, I, F, N). | Slate and amber (DESIGN.md §1). |
| DE-02 | Gradient text | Colour shifts across a heading or a number (I). | Solid colour. |
| DE-03 | Competing neons | Five or six saturated colours with equal weight; dark mode with glowing borders (I, F). | One dominant, one accent, one neutral, each with a written role. Accent is scarce. |
| DE-04 | Halo, aurora, spotlight | Radial gradient or soft glow behind content, aurora background (P, I, F). | Depth from surface levels and type. The living background (MOT-02) reacts to state, never a generic halo. |
| DE-05 | Glassmorphism by default | Blur or frosted glass with no real layering problem to solve (P, I). | Opaque surfaces. |
| DE-06 | Reflex cream / beige | Warm cream surfaces as a stand-in for taste (P, I). | Token palette. |
| DE-07 | Cards in cards | A card nested in a card (P, I, F). | Group with space and type. Cards only for independently actionable items. |
| DE-08 | Identical card grids | Grid of icon + title + text cards, every item the same weight (P, I). | Hierarchy: one item leads. |
| DE-09 | Side stripe | Thick coloured border on one side of a rounded card, often a different colour per card (P, I, F, N). | Remove, or a status colour with a defined meaning. |
| DE-10 | Hairline + wide shadow | Thin border and broad shadow both defining the same card (P, I). | One or the other. |
| DE-11 | Huge radii | Large corner radius on every element, cards, inputs and badges alike (P, I, N). | Token radii. Pills only where they belong. |
| DE-12 | Icon tile above heading | Rounded square icon stacked above every heading (P, I). | Remove. |
| DE-13 | Label or pill above heading | Small eyebrow label or badge above a heading (P, I). | Remove. |
| DE-14 | Letter-spaced uppercase eyebrows | Wide tracking on small uppercase labels by default (I, N). | Token type styles. |
| DE-15 | Decorative numbering | 01 / 02 / 03 beside headings with no sequence (P, I). | Remove. |
| DE-16 | Hero metric | Big number + small label + stats row, landing-page style (P, I). | Only for real live numbers on the Party screen, styled by tokens. |
| DE-17 | Emojis as icons | Emojis as icons, bullets or navigation (P, F). | `icons.json`. |
| DE-18 | Default fonts | Inter or Geist; one font with no hierarchy; reflex italic serif headline (P, I, N). | Archivo variable and the type scale (DESIGN.md §2). |
| DE-19 | Flat hierarchy, monotonous spacing | Headings and body too close in size or weight; equal gaps everywhere (I). | Type scale and spacing tokens. |
| DE-20 | Oversized hero headline / crushed tracking | A long headline at display size filling the screen; letters set too tight (I). | Type scale. |
| DE-21 | Pulsing dot, blinking cursor, marquee | A dot pulses with no state change, a cursor blinks on static text, text auto-scrolls (P, I, F). | Motion only on a state change (DESIGN.md §5). |
| DE-22 | Elastic bounce on routine actions | Overshoot easing on everyday taps (P, I). | Token easings. Bounce reserved for the rare celebration listed in the motion table. |
| DE-23 | Generic illustrations | Shapes-and-blobs scenes, sloppy SVG mascots, generated images with broken hands or text, stock laptop photos (P, I, N). | Real content: crew photos, real data, the custom icon set. |
| DE-24 | Decorative grid lines and stripes | Grid-line backgrounds or repeating gradient stripes filling space (I). | Empty space. |
| DE-25 | Status dots with no meaning | Coloured dots on nav items or headers with no defined state (F). | Map each dot to a state and label it in text, or remove it. |
| DE-26 | Misaligned details | Small layout errors that add up (a dot off the timeline, uneven icon sizes). | Pixel review on each screen. |

---

## 7. Game-card tells

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| GC-01 | Repeated structure | More than the cap of cards in a deck share the same opening ("Who is most likely to...", « Qui est le plus susceptible de... »). Cap in R-20. | Cap per structure. Write new shapes. |
| GC-02 | Fits any group | The card works for any group of strangers anywhere; no place, age, habit or reference. | Anchor it: a place, a time, a habit of this kind of crew. |
| GC-03 | Sanitised dares | Every dare is safe enough for a corporate seminar. | Real stakes inside the safety rules (no driving, no forced drinking, no harm). |
| GC-04 | Same length | Card lengths cluster (low variance, see R-20). | Some cards are four words. Some are a story. |
| GC-05 | No punchline | The card ends on the setup. | The last words carry the joke or the sting. |
| GC-06 | No references, or stale references | No local or current references; or references that were current when the model was trained. | Current FR references in FR, current EN references in EN. Each topical card carries an expiry date. |
| GC-07 | Translated deck | An EN card is a translation of an FR card, or the reverse. | Separate decks, separate authors' briefs. |
| GC-08 | Rule of three in prompts | "Kiss, marry, avoid" style triads everywhere. | Vary. |
| GC-09 | Moralising card | A card ends with advice ("...and remember to drink water!"). | Safety lives in the safety features, not in punchlines. |
| GC-10 | Near duplicates | Two cards differ only by a word. | Merge or cut. |
| GC-11 | Lyrical filler | "an unforgettable moment", « un moment magique » in a card. | Concrete. |

Process (PROMPT.md): a card author writes, a critical friend cuts ruthlessly, the crew tests for real (SLOP-06).

---

## 8. Code tells

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| CO-01 | Paraphrasing comments | A comment restates the next line: `// Handle click`, `// Function to fetch data`, `// This function...`, `// Increment counter`. | Delete. Comment only the why. |
| CO-02 | Emojis in logs, commits, README | Any emoji in log messages, commit messages, README or docs. | Plain text. |
| CO-03 | README "✨ Features" | README sections with emoji headers, feature lists in marketing tone, badges wall. | What it is, how to run it, where things are. |
| CO-04 | Generic names | `handleData`, `processData`, `doStuff`, `data2`, catch-all `utils` / `helpers` / `common` files. | Names from the glossary and the domain. |
| CO-05 | Dead code and leftovers | Unused functions, commented-out blocks, `console.log` / `print` left in production code, unused dependencies. | Delete. |
| CO-06 | Swallowed errors | Empty `catch`, or `catch` that only logs, wrapped around everything. | Handle or rethrow. Errors surface to the user with a reason (SYNC-07). |
| CO-07 | Mock data in production | Demo people, venues or prices (prototype placeholders) reachable in a release build. | Fixtures only in tests and seed. |
| CO-08 | Prompt rules leaking into code | The same comment pasted everywhere ("Real services, no mocks", "Follows best practices") because a prompt asked for it. | Delete. |
| CO-09 | Client secrets | API keys or service-role keys in the client bundle. | Server only (engineering standards). |
| CO-10 | Missing access rules / unvalidated input | Tables without per-crew rules, endpoints trusting client input. | Rules tested, input validated server-side. |
| CO-11 | User-facing text in code | A string literal shown to users outside the localisation catalogues. | Catalogue key. |
| CO-12 | French identifiers | `ajouterVerre`, `Soiree`. | Glossary English terms. |
| CO-13 | Over-hedged docs | ADRs and docs with "robust", "seamless", "leverage", closing summaries. | Same vocabulary rules as the app. |
| CO-14 | Uniform boilerplate | Every file opens with the same header block or docstring that says nothing. | Remove. |

---

## 9. Notification tells

| ID | Tell | Fail if | Fix |
|---|---|---|---|
| NO-01 | Ad-style hook | "Don't miss this!", "Last chance", "Hurry", « Ne rate pas ça ! », « Dernière chance », « Vite ! » | The information first, in one line. |
| NO-02 | Question bait | "Ready to party tonight?", « Prêt pour ce soir ? » with no information. | Say what happened or what is on. |
| NO-03 | Emoji opener | Title or body starts with an emoji. | Words first. One emoji at most, crew notifications only. |
| NO-04 | Exclamation opener | Title starts with an interjection: "Hey!", "Psst!", « Hé ! », « Psst ! » | Start with the fact. |
| NO-05 | Title repeats body | Title and body say the same thing, or the title is the app name (the system already shows it). | Title: who or what. Body: the new fact. |
| NO-06 | Fake urgency or FOMO | "Your crew is waiting!" when nobody is, "X people are partying right now" when the number is not live. | Only true, live facts. |
| NO-07 | Guilt trip | "We miss you", "You haven't logged a drink in a while", « Tu nous manques ». The Duolingo passive-aggressive style copied. | No win-back nags. Re-engagement is the crew's job, not the app's. |
| NO-08 | Safety notification with personality | Jokes, emoji or exclamation in SOS, driving, BAC, "Heading home" or safety alerts. | Plain, direct, one action. |
| NO-09 | Bad timing | The recap notification at 6 am; a reminder during quiet hours. | Decent hour (QOL-20), quiet hours respected. |
| NO-10 | Too long | Body over 2 lines on a lock screen, or truncated before the key fact. | Key fact in the first 40 characters. |
| NO-11 | Same line every time | Identical wording for a recurring event across nights. | Several written variants per event, never the same line two nights in a row (JOY-02 rule). |
| NO-12 | Marketing in operational channel | A promo mixed into an operational notification. | Separate channels, separately switchable (PREF-03). |

---

## 10. Machine-checkable rules for SLOP-04

### 10.1 Scope and behaviour

- Files: every localisation catalogue (all locales), notification templates, widget and Live Activity strings, store listing texts, legal texts, game decks and recipes (localised content files). Rules marked "locale: fr" or "locale: en" run only on that locale. Other locales (P2) get their own lists before they ship.
- Severity: `error` fails the build. `warn` is printed in the CI summary and must be read in SLOP-02 review. The build fails while any `error` remains (SLOP-04).
- Allowlist: `slop-allow.yaml` (format proposal): `{ key, rule, reason, reviewer }`. One entry per string and rule. No wildcards. An entry without a reason is itself an error. SLOP-02 reviews every new entry.
- Output: `file:key: RULE-ID matched "<excerpt>"`.
- Normalisation before matching, in this order:
  1. Unicode NFC.
  2. Replace ICU / placeholder tokens (`{name}`, `{count, plural, ...}` arms are checked one by one, `%s`, `%1$@`, `{{x}}`) with the neutral token `X`. Check each plural and select arm as its own string.
  3. Strip inline markup tags the catalogue format allows (`<b>`, `<link>`), keeping their text.
  4. Matching is case-insensitive (`i`) and Unicode-aware (`u`, or `v` where noted).
- Word boundaries: JavaScript `\b` fails on accented letters (é, è, à). Every word regex below uses these lookarounds instead:
  - `L` = `(?<![\p{L}\p{N}_])` (left boundary)
  - `R` = `(?![\p{L}\p{N}_])` (right boundary)
  - Written below as `L(...)R`. Expand them literally in code.
- Implementation note: the patterns below are written for JavaScript (ES2024, Node 20 or later, needed for `\p{RGI_Emoji}` with the `v` flag). Other engines (PCRE2, Swift Regex, ICU) support the same constructs with minor syntax changes.
- Tests: the lint ships with a fixture of bad strings (at least one per rule) that must fail, and a fixture of good strings that must pass, starting with the DESIGN.md §9 samples (with their numbers and names turned into placeholders).

### 10.2 Rules

**R-01 Dashes (FO-01).** Severity error, all locales.

```
[\u2012\u2013\u2014\u2015]
(?<=\p{L}|\p{N}|X)\s+-{1,2}\s+(?=\p{L}|\p{N}|X)
--
```

The second pattern catches a spaced hyphen used as a pause. Hyphenated words ("check-in", « peut-être ») have no spaces and do not match.

**R-02 "Successfully" (UI-05).** Severity error.

```
locale en:  L(successful(?:ly)?|success!)R
locale fr:  L(avec\s+succès|a\s+bien\s+été|ont\s+bien\s+été|est\s+bien\s+(?:enregistré|ajouté|pris\s+en\s+compte|envoyé)e?s?|réussie?s?\s+!)R
```

**R-03 Emoji count (FO-06).** Severity error when count > 1 in one string (after normalisation, per plural arm).

```
count of matches of   /\p{RGI_Emoji}/gv
```

Fallback without the `v` flag (counts a ZWJ sequence, skin tone, flag or keycap as one):

```
(?:\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*|[\u{1F1E6}-\u{1F1FF}]{2}|[0-9#*]\uFE0F?\u20E3)
```

Exclude U+00A9, U+00AE, U+2122 (©, ®, ™) from the fallback count: they are `Extended_Pictographic` but legal text uses them.

**R-04 Emoji position (FO-05, NO-03).** Severity error. For keys whose last segment is `title`, `button`, `label`, `tab`, `header`, `cta`, or any notification title: the string starts with an emoji (R-03 pattern anchored with `^\s*`).

**R-05 Functional emojis and odd Unicode (FO-07, FO-08).** Severity error in all keys outside namespaces `game.*`, `card.*`, `reaction.*`; warn inside them.

```
[\u2705\u274C\u274E\u2714\u2716\u26A0\u2728\u{1F680}\u{1F389}\u{1F525}\u{1F4AF}\u{1F449}\u2190-\u21FF\u2248\u2500-\u257F\u2605\u2606\u25AA\u25CF\u2022]
[0-9#*]\uFE0F?\u20E3
```

**R-06 Stacked punctuation and exclamation (FO-14, FO-15).** Severity error.

```
[!?¡¿][\s\u00A0\u202F]*[!?]              stacked marks, all locales
count("!") > 1 per string                 more than one exclamation mark
"!" anywhere in namespaces: error.*, sync.*, safety.*, sos.*, bac.*, driving.*, heading_home.*, delete.*, confirm.*, legal.*, pool.*, payment.*
```

**R-07 French Title Case heuristic (FO-10, section 3.3).** locale fr. Severity: error when the score is 2 or more, warn when 1.

Algorithm, per string:
1. Split into sentences on `[.!?…]` followed by space, and on line breaks. A colon does not start a sentence in French.
2. Tokenise each sentence into words `\p{L}[\p{L}'’\-]*`. Skip the first word of each sentence, and the first word after an opening `«` or `"`.
3. Skip a word if: it is all capitals of 2 to 5 letters (SOS, GPS, IA, BAC); it is in `proper-nouns.txt` (app name, game names, brand names, placeholder token `X`); it follows a placeholder directly.
4. Score = number of remaining words whose first letter is uppercase.
5. Extra: any weekday or month name capitalised at a non-initial position is a score of 2 on its own:

```
L(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche|Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre)R
```
(case-sensitive match, applied only to non-initial words)

Same algorithm runs on locale en for keys ending in `title`, `button`, `label`, `tab`, `header` with severity warn (sentence case is the proposed EN convention, see `research/voice.md`).

**R-08 "vous" in French (VF-R1).** locale fr. Severity error.

```
L(vous|votre|vos|veuillez)R
```

Allowlist entries with `reason: crew-plural` are accepted for strings addressed to the whole crew. Store and legal texts follow the same « tu » unless a legal review decides otherwise (assumption in `research/voice.md`).

**R-09 Formal French register (VF-R3).** locale fr. Severity warn.

```
L(merci\s+de\s+bien\s+vouloir|ultérieurement|suite\s+à|procéder\s+à|afin\s+de|en\s+raison\s+du\s+fait\s+que|dans\s+le\s+but\s+de|au\s+niveau\s+de|néanmoins|toutefois)R
```

**R-10 English blacklist (section 2).** locale en. Severity error unless marked (warn).

```
L(additionally)R
L(align(?:s|ed|ing)?\s+with)R
L(boast(?:s|ed|ing)?)R
L(bolster(?:s|ed|ing)?)R
L(crucial(?:ly)?)R
L(deep[\s-]dives?)R
L(delv(?:e|es|ed|ing))R
L(emphasi[sz](?:e|es|ed|ing))R
L(enduring)R
L(enhanc(?:e|es|ed|ing|ement|ements))R
L(foster(?:s|ed|ing)?)R
L(garner(?:s|ed|ing)?)R
L(highlight(?:s|ed|ing)?)R(?=\s+(?:the|its|their|your|how|that|a|an)\b)
L(highlight(?:ed|ing))R
L(interplay)R
L(intricate|intricac(?:y|ies))R
L(leverag(?:e|es|ed|ing))R
L(meticulous(?:ly)?)R
L(multifaceted)R
L(pivotal)R
L(robust(?:ly|ness)?)R
L(showcas(?:e|es|ed|ing))R
L(tapestr(?:y|ies))R
L(testament)R
L(underscor(?:e|es|ed|ing))R
L(valuable)R
L(vibrant)R
L(nestled|renowned)R
L(in\s+the\s+heart\s+of)R
L(commitment\s+to)R
L(quietly)R
L(dependab(?:le|ly|ility))R
L(thoughtful(?:ly)?)R
L(meaningful(?:ly)?)R
L(universally)R
L(looking\s+ahead|what\s+comes\s+next|adds?\s+another\s+layer)R
L(supercharg(?:e|es|ed|ing)|turbocharg(?:e|es|ed|ing))R
L(world[\s-]class|best[\s-]in[\s-]class|next[\s-]gen(?:eration)?|cutting[\s-]edge|state[\s-]of[\s-]the[\s-]art)R
L(seamless(?:ly)?|effortless(?:ly)?|frictionless)R
L(unleash(?:es|ed|ing)?|elevat(?:e|es|ed|ing)|empower(?:s|ed|ing)?|revolutioni[sz](?:e|es|ed|ing)|reimagin(?:e|es|ed|ing))R
L(unlock\s+your)R
L(game[\s-]chang(?:er|ers|ing))R
L(in\s+today'?s\s+(?:fast[\s-]paced\s+)?world|in\s+the\s+digital\s+age)R
L(whether\s+you'?re)R
L(ready\s+to\s+[^?.!]{1,40}\?)
L(your\s+journey|journeys?|adventures?|unforgettable|ultimate|magical)R
L(simply|easily|in\s+just\s+a\s+few\s+(?:taps|clicks)|in\s+seconds)R
L(thousands\s+of|millions\s+of|join\s+the\s+community)R
L(never\s+miss)R
L(ai[\s-]powered)R
```

Warn only:

```
L(key)R(?=\s+(?:feature|moment|part|insight|takeaway)s?)
L(prioriti[sz](?:e|es|ed|ing))R
L(landscapes?)R                      (abstract use; "landscape mode" passes on review)
L(echo(?:es|ed))R
L(steady|steadily)R
L(clearer|practical)R
L(challeng(?:e|es|ed|ing))R          (allowlisted in game.* and card.*)
L(epic)R                             (allowed as the recap tone name)
L(actually|rather|very)R             (warn when 2 or more in one screen namespace)
L(the\s+most|perhaps\s+the\s+most|the\s+best)R
```

**R-11 French blacklist (section 3).** locale fr. Severity error unless marked (warn).

```
L(plong(?:er|e|es|ez|eons|eant|é|ée)\s+dans|plongeons)R
L(approfondi(?:r|ssez|ssons|t|s))R
L(il\s+(?:est|serait)\s+(?:important|essentiel|crucial|fondamental|primordial)\s+de)R
L(il\s+convient\s+de)R
L(en\s+outre|par\s+ailleurs)R
(?:^|[.!?;]\s+)de\s+plus\s*,         (connector only: « de plus en plus » and « une de plus » pass)
L(également)R(?=\s*,)
L(en\s+somme|en\s+conclusion|en\s+définitive|en\s+résumé|au\s+final|comme\s+nous\s+l'avons\s+vu|en\s+bref)R
L(divers(?:es)?|nombreu(?:x|se|ses)|particulièrement)R
L(mett(?:re|ons|ez|ent|ant)\s+en\s+(?:œuvre|oeuvre|lumière|avant))R
L(facilit(?:er|e|es|ent|é|ée))R
L(optimis(?:er|e|es|ent|é|ée|ation))R
L(garanti(?:r|t|ssent|ssant))R
L(incontournables?|holistiques?|robustes?|réinventée?s?|révolutionnaires?|disruptif|disruptive|véritables?)R
L(au\s+c(?:œ|oe)ur\s+de|dans\s+le\s+paysage|pierre\s+angulaire|naviguer\s+dans)R
L(cruciale?s?|cruciaux|essentiel(?:le)?s?|significati(?:f|ve|fs|ves))R
L(sublim(?:er|e|es|é|ée)|boost(?:er|e|es|é)|révolutionn(?:er|e|é)|propuls(?:er|e|é)|libèr(?:e|es)|libérer)R
L(de\s+manière\s+fluide|en\s+toute\s+(?:simplicité|sérénité)|en\s+quelques\s+clics|en\s+un\s+clin\s+d'(?:œ|oe)il)R
L(expériences?\s+(?:unique|inoubliable|immersive)s?|moments?\s+inoubliables?)R
L(que\s+tu\s+sois|dans\s+un\s+monde\s+où|à\s+l'ère\s+(?:de|du|des)|monde\s+effréné)R
L(prêt(?:e|s|es)?\s+à\s+[^?.!]{1,40}\?)
L(découvr(?:e|ez|ir)|ton\s+aventure|l'aventure|aventure)R
L(symbolisant|soulignant|témoignant\s+de|reflétant)R
L(se\s+positionne\s+comme|constitu(?:e|ent)|fait\s+office\s+de|s'impose\s+comme|dispose\s+de)R
L(faire\s+du\s+sens|fait\s+du\s+sens|adress(?:er|e)\s+(?:un|le|ce)\s+problème|impact(?:er|e|é|ée|ent)|basiquement|définitivement|implément(?:er|e|é|ation))R
L(des\s+milliers|des\s+millions|rejoins\s+la\s+communauté)R
L(ne\s+rate\s+plus\s+(?:jamais|aucune))R
L(taux\s+précis)R
```

Adjective doublets (warn): `L(\p{L}+)R\s+et\s+L(fiable|intuitif|intuitive|efficace|rapide|simple|fluide)R` when the first word is also in the list.

Oxford comma (error): `,\s+\p{L}[\p{L}\s']*,\s+et\s` (a comma right before the final « et » of a list).

**R-12 Chatbot residue (section 2.3, 3.2).** Severity error.

```
locale en:
L(of\s+course!|certainly!|absolutely!|great\s+question|i\s+hope\s+this\s+helps|feel\s+free\s+to|let\s+me\s+know|is\s+there\s+anything\s+else|would\s+you\s+like|happy\s+to\s+help|here'?s\s+what\s+you\s+need\s+to\s+know|as\s+an\s+ai|as\s+of\s+my\s+last|oops|whoops|uh-oh|yikes|hang\s+tight|sit\s+tight)R
locale fr:
L(bien\s+sûr\s*!|excellente\s+question|j'espère\s+que\s+(?:cela|ça)\s+(?:t'|vous\s+)aide|n'hésite\s+pas|je\s+serais\s+ravie?\s+de|voici\s+ce\s+que\s+tu\s+dois\s+savoir|selon\s+les\s+informations\s+disponibles|à\s+ma\s+connaissance|oups|aïe)R
```

**R-13 Structure patterns (section 1).** Severity error unless marked.

```
CS-01 en:  L(it'?s|this\s+is|that'?s|this\s+isn'?t)\s+(?:not\s+)?[^.!?]{1,40}[.,;]\s+(?:it'?s|this\s+is|that'?s)R      (warn)
CS-01 en:  (?:^|[.!?]\s+)not\s+(?:a|an|the)\s+[^.!?]{1,30}\.\s+not\s+                                                    (error)
CS-01 fr:  L(ce\s+n'est\s+pas|c'est\s+pas)\s+[^.!?]{1,40}[.,;]\s+c'est\s                                                  (warn)
CS-01 fr:  (?:^|[.!?]\s+)pas\s+(?:un|une|de)\s+[^.!?]{1,30}\.\s+pas\s+                                                    (error)
CS-02 en:  L(not\s+only|not\s+just|isn'?t\s+just|more\s+than\s+(?:just\s+)?(?:a|an)|rather\s+than\s+simply)R
CS-02 fr:  L(non\s+seulement|il\s+ne\s+s'agit\s+pas|plus\s+qu'une?\s|plutôt\s+que\s+de\s+simplement)R
CS-03:     (?:^|[.!?]\s+)(?:\p{L}+[.!?]\s+){2,}\p{L}+[.!?]?\s*$      three or more one-word sentences in a row (warn on 2)
CS-05:     \d+\s*(?:to|-|à|ou)\s*\d+\s*(?:min|minutes?|h|heures?|hours?|hrs?|s|sec|jours?|days?)R
CS-05:     L(from\s+[^,.]{1,30}\s+to\s+[^,.]{1,30})R  and  L(du\s+[^,.]{1,30}\s+(?:au|à\s+la)\s+[^,.]{1,30})R            (warn)
CS-07 en:  L(the\s+\p{Lu}\p{L}+\s+of)R      ("the Tinder of")                                                             (warn)
CS-07 fr:  L(le|la)\s+\p{Lu}\p{L}+\s+(?:des|du|de\s+la)R                                                                   (warn)
CS-08 en:  ^(?:here'?s\s+the\s+thing|let'?s\s+be\s+clear|let'?s\s+talk\s+about|picture\s+this|imagine\s+this)
CS-08 fr:  ^(?:soyons\s+clairs|parlons\s+de|imagine\s+un\s+peu|tu\s+sais\s+quoi)
CS-09 en:  L(and\s+that\s+changes\s+everything|that'?s\s+what\s+matters|this\s+matters|that\s+matters|why\s+[^.!?]{1,30}\s+matters)R
CS-09 fr:  L(et\s+ça\s+change\s+tout|c'est\s+(?:ça|cela)\s+qui\s+compte)R
CS-10 en:  L(in\s+short|at\s+the\s+end\s+of\s+the\s+day|overall|in\s+summary|in\s+conclusion|all\s+in\s+all)R
CS-10 fr:  (covered by R-11)
CS-11 en:  ,\s+(?:highlighting|reflecting|underscoring|contributing\s+to|ensuring|offering|showcasing|emphasizing|symbolizing)R
CS-11 fr:  ,\s+(?:soulignant|reflétant|témoignant|offrant|garantissant|symbolisant|contribuant)R
CS-12 en:  L(serves\s+as|stands\s+as|functions\s+as|acts\s+as)R
CS-14 en:  L(should\s+(?:not\s+)?be\s+(?:read|treated|seen|confused)\s+(?:as|with)|does\s+not\s+establish|not\s+necessarily|not\s+to\s+be\s+confused)R
CS-14 fr:  L(ne\s+doit\s+pas\s+être\s+confondue?|ne\s+saurait|ne\s+permet\s+pas\s+d'établir|n'est\s+pas\s+nécessairement)R
CS-16 en:  L(but\s+there'?s\s+a\s+catch|here'?s\s+the\s+twist)R
CS-16 fr:  L(mais\s+il\s+y\s+a\s+un\s+(?:hic|problème)|le\s+vrai\s+sujet)R
CS-18 en:  L(associated\s+with|in\s+connection\s+with)R                                                                    (warn)
CS-19 en:  L(experts?\s+(?:say|agree|argue)|studies\s+show|many\s+people)R
CS-19 fr:  L(les\s+experts|de\s+nombreuses\s+études|selon\s+les\s+spécialistes)R
CS-20 en:  L(the\s+future\s+looks|only\s+getting\s+started|just\s+the\s+beginning)R
CS-20 fr:  L(l'avenir\s+s'annonce|ce\s+n'est\s+que\s+le\s+début)R
CS-21:     L(despite\s+these\s+challenges|malgré\s+ces\s+défis)R
CS-26 en:  ^(?:it\s+is|it\s+seems|there\s+is\s+no\s+doubt)R                                                               (warn)
CS-26 fr:  ^(?:il\s+est\s+à\s+noter|il\s+semble(?:rait)?\s+que)R
```

**R-14 UI copy patterns (section 5).** Severity error unless marked.

```
UI-01 en:  L(here\s+you\s+can|this\s+(?:screen|page|section|tab)\s+(?:lets|allows|shows)|allows\s+you\s+to|lets\s+you)R
UI-01 fr:  L(ici,?\s+tu\s+peux|(?:cet|cette)\s+(?:écran|page|section|onglet)\s+(?:te\s+permet|permet|affiche)|te\s+permet\s+de)R
UI-06 en:  L(something\s+went\s+wrong|an?\s+(?:unexpected\s+)?error\s+(?:has\s+)?occurred|unexpected\s+error|unknown\s+error)R
UI-06 fr:  L(une\s+erreur\s+(?:inattendue\s+)?(?:est\s+survenue|s'est\s+produite)|erreur\s+inconnue|erreur\s+inattendue)R  and  ^\s*erreur\s*[.!]?\s*$
UI-07:     L(invalid\s+input|wrong\s+value|saisie\s+invalide|valeur\s+incorrecte)R
UI-08:     in *.button / *.cta keys:  ^(?:let'?s\s+(?:do\s+it|go)|yes,\s+i'?m\s+in|c'est\s+parti|go)\s*!?$
UI-09:     L(are\s+you\s+sure|êtes-vous\s+sûrs?|es-tu\s+sûre?)R  and  *.button keys equal to "OK" (warn)
UI-22 en:  ^(?:awesome|great\s+job|congrats|congratulations|nice|amazing)\s*!                                             (warn, error in toast.*)
UI-22 fr:  ^(?:super|génial|bravo|félicitations|top)\s*!                                                                  (warn, error in toast.*)
UI-23:     ^(?:hey(?:\s+there)?|welcome\s+back|coucou|re-?bonjour)\s*!                                                     (warn)
UI-24:     for keys with a level variant (*.level2, *.level3): length(level N) > length(level N-1)                      (error)
```

**R-15 Notifications (section 9).** Applies to `notification.*` and push templates. Severity error.

```
NO-01 en:  L(don'?t\s+miss|last\s+chance|hurry|act\s+now|limited\s+time)R
NO-01 fr:  L(ne\s+(?:rate|manque)\s+pas|dernière\s+chance|vite\s*!|plus\s+que\s+quelques)R
NO-02:     title matches  ^[^.!]{1,40}\?$  and body contains no placeholder X                                           (warn)
NO-03:     title or body starts with an emoji (R-04)
NO-04 en:  ^(?:hey|psst|yo|hi\s+there)\s*[!,]
NO-04 fr:  ^(?:hé|hey|psst|coucou)\s*[!,]
NO-05:     normalised title equals normalised body, or title equals the app name
NO-07 en:  L(we\s+miss\s+you|haven'?t\s+(?:logged|opened|seen)|it'?s\s+been\s+a\s+while)R
NO-07 fr:  L(tu\s+nous\s+manques|ça\s+fait\s+longtemps|tu\s+n'as\s+pas\s+(?:ouvert|ajouté))R
NO-08:     namespaces sos.*, safety.*, driving.*, bac.*, heading_home.*: any emoji, any "!"
NO-10:     body longer than 110 characters after placeholder expansion with the longest realistic values            (warn)
NO-11:     recurring event templates with fewer than 3 variants                                                     (warn)
```

**R-16 Residue (FO-11, FO-12, FO-13, FO-18).** Severity error, all locales.

```
\*\*|__|^\s*#{1,6}\s|`
\[(?:insert|describe|add|todo)[^\]]*\]|L(todo|tbd|fixme|lorem|ipsum)R|\bXX\b|\d{4}-XX-XX|INSERT_|\{\{[^}]*\}\}
[\u200B\u200C\uFEFF\u2060]            (U+200D allowed only inside emoji sequences)
utm_source=(?:chatgpt|openai|perplexity|claude|gemini|copilot)
```

**R-17 Quotes, apostrophes and French spacing (FO-09, FO-16).** Severity error.

Proposed convention (to confirm in VOICE.md): apostrophe U+2019 ’ in FR and EN; FR quotes « » with U+202F inside; EN quotes “ ” (U+201C, U+201D).

```
all:       (?<=\p{L})'(?=\p{L})                 straight apostrophe between letters
fr:        "                                    straight double quote
fr:        «(?!\u202F)|(?<!\u202F)»             missing narrow no-break space inside guillemets
fr:        (?<=[\p{L}\p{N}X»)])[;!?]            no space before ; ! ?
fr:        (?<=[\p{L}\p{N}X»)])\x20[;!?:]       breaking space before ; ! ? :   (must be U+202F, or U+00A0 before :)
fr:        (?<=[\p{L}\p{N}X»)]):(?!//)          no space before : (URLs excluded)
en:        [\u00A0\u202F][;:!?]                 French spacing leaked into English
en:        «|»
file:      both ’ and ' used as apostrophe in one locale file
```

Times in FR use « 6 h », « 23 h 30 » with U+00A0 or U+202F, produced by the formatter, never typed (FO-17).

**R-18 Numbers and ranges (FO-17, UI-13).** Severity warn for any digit `\p{Nd}` in a string after placeholder replacement; error for a range (`CS-05` pattern). Allowlist with reason `fixed-fact` for true constants (for example "24/7" if ever used).

**R-19 Glossary synonyms (CS-13, UI-14).** Severity warn. Generated from `GLOSSARY.md`: for each concept, the list of rejected synonyms. Seed list:

```
en:  L(squad|gang|group\s+of\s+friends|team)R       -> crew
en:  L(night\s+out|event|hangout)R                   -> party
en:  L(beverage|booze)R                              -> drink
en:  L(preferences|options)R  (in settings.*)        -> settings
en:  L(messages|conversation)R (as a screen name)    -> chat
en:  L(blood\s+alcohol\s+level|alcohol\s+level)R     -> BAC
fr:  L(groupe|bande|équipe|squad)R                    -> crew
fr:  L(fête|sortie|événement|évènement)R              -> soirée
fr:  L(boissons?|consos?|consommations?)R             -> verre
fr:  L(alcoolémie)R                                   -> taux (allowed in bac.notice.* and legal.*)
fr:  L(paramètres|préférences|options)R               -> réglages
fr:  L(messagerie|conversation)R                      -> discussion
fr:  L(tableau\s+des\s+scores|podium\s+général)R      -> classement
fr:  L(cagnotte\s+commune|pot\s+commun|kwitt)R        -> cagnotte (until branding sets the final name)
```

**R-20 Game decks (section 7).** Runs per deck file (one locale, one game). Thresholds are starting values to tune on the first 500 cards per language (assumption in `research/voice.md`).

- GC-01 Opening cap (error): normalise each card (lowercase, strip placeholders and punctuation), take its first 4 words. No 4-word opening may cover more than 5 % of the deck, or more than 15 cards, whichever is lower. First 2 words: 12 % max (warn).
- GC-04 Length spread (error): coefficient of variation (standard deviation / mean) of card length in characters below 0.35. Also warn if more than 60 % of cards fall within ±20 % of the median length.
- GC-10 Near duplicates (error): two cards with word-set Jaccard similarity of 0.8 or more.
- GC-08 Triads (warn): more than 10 % of cards contain a list of exactly three items `\p{L}+,\s+\p{L}+,?\s+(?:or|and|ou|et)\s+\p{L}+`.
- GC-09 Moralising (error): `L(remember\s+to|don'?t\s+forget\s+to|stay\s+safe|drink\s+responsibly|n'oublie\s+pas\s+de|pense\s+à\s+boire|avec\s+modération)R`.
- GC-06 Expiry (error): every card tagged `topical` has an `expires` date; an expired card fails the build.
- All copy rules R-01 to R-18 also run on cards (R-05 and the R-10 / R-11 entries for "challenge" and « défi » at warn).

**R-21 Long-text rhythm (CS-15, FO-02).** For strings of 4 sentences or more (recap, store text, onboarding, legal), severity warn:

- 80 % or more of sentences between 8 and 20 words.
- Standard deviation of sentence length below 4 words.
- More than one parenthetical `\([^)]{3,}\)` (CS-23).
- More than one hedge from `L(may|might|could|perhaps|possibly|peut-être|pourrait|éventuellement|sans\s+doute)R` per sentence (CS-24).

### 10.3 What the lint cannot see

The lint is a floor, not the review. These stay with humans and fresh-context reviewers (SLOP-02, SLOP-05, SLOP-06): rule of three (CS-04) beyond decks, synonym cycling across screens, false balance, voiceless text, wrong tone for the channel, fits-any-group cards, design tells (section 6 has its own detector under SLOP-08), and any tell not yet in this file.

---

## Changelog

One line per change: date, ID, what was added or changed, source.

- 2026-10-26: Created by Recon-Voice from PROMPT.md <anti_slop> plus Wikipedia "Signs of AI writing" (October 2026 version), Impeccable /slop, Fountain Institute, Hassid's 9 tells, humaniseur-fr, Pangram signals, Graphite study on Opus 5.5 (via remio.ai), PCWorld Sonnet 4.6 test, noqta and HN threads on AI UI, Apple HIG Writing. Sources in `research/voice.md`.
- 2026-10-26: Added CS-14 to CS-30, GPT-6 era and Claude vocabulary, FO-02 (dash over-correction), FO-07, FO-08, FO-13, FO-16 to FO-18, UI-10, UI-11, UI-20 to UI-26, GC-06 to GC-11, CO-08, CO-11 to CO-14, all of section 9 beyond PROMPT.md, and the SLOP-04 rules.
