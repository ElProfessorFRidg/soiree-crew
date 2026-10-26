# Recon-Design, part B: Recap, Radar, Messages, Bars, Classements, Jeux

Report by Recon-Design (part B of 3). Read on 2026-10-26. Scope: six boards of `design/prototype/`, read in full (markup and logic class). Facts come only from the repository files listed in section 8. French UI copy is quoted verbatim; everything else is in English.

All six boards use the same `<style>` block, and it is identical line for line to `design/base.css` (checked by diff). No board adds CSS of its own. Board-specific visuals are inline styles, listed per screen below.

---

## 1. Summary

- Every ID that `SCREENS.md` and `FEATURES.md` map to these six boards (76 IDs) has at least one visible element. Many are only partial: about a third of the sub-requirements in `PROMPT.md` for these IDs have no screen (list in 2.7).
- **Conflict, decision needed:** QOL-20 in `PROMPT.md` asks for a "calm, dark, low-contrast" next-morning screen. The prototype (Recap, screen 6) and `DESIGN.md` §1 use the **light** theme for it.
- **Logic bug in the prototype:** the "On va où ?" wheel computes its result from the final angle with a formula that, by our reading, names the mirrored segment, not the one under the pointer. The result text also appears at the tap, 3.2 s before the wheel stops. Implement it from the real final angle, shown on stop.
- **Anti-cheat conflict:** the check-in screen shows the user each signal's verdict ("Position non simulée ✗", "Téléphone intègre ?"). That tells a cheater which signal caught them. The middle verdict of AC-06 ("unverified, needs peer confirmation") is missing too. The prototype goes straight from accepted to rejected.
- **Privacy conflicts:** the review form defaults to "Public", but the profile defaults say nothing is public until the user turns it on. A public named review shows "Visite du 7 juin", a dated presence that strangers can see. That conflicts with PROF-05 (no dates for strangers) and is required by COM-02 ("visit date shown"). Recap story sharing and the photo booth take group-private material outside the group, and the prototype asks for no consent from the people shown.
- **Sync conflict:** the leaderboard re-ranks and shows the overtake banner on the tap, and the check-in plays the takeover on a client timer. SYNC-02 says these outcomes play only on the server's answer.
- **Demo data is not computed:** Recap says "41 verres", but the per-person counts add up to 26. Its curves include Sami, who is not in the attendee list, and leave out Théo and Nora. "pic moyen 0,74" has no unit. The spec must say every figure is computed.
- **Anti-slop flags:** fake duration ranges on every game card ("10 à 20 min"; `PROMPT.md` bans made-up ranges but O-44 requires a duration). Plural "vous" in 5 strings would fail the SLOP-04 lint. There are many explanatory footnotes under titles and settings, and several big-number-plus-small-label stat grids.
- **Adaptive levels 0 to 3:** none of the six boards shows a per-level variant. Every spec for these IDs has to write its "Behaviour at levels 0, 1, 2, 3" section from scratch.

---

## 2. Findings

Conventions: durations in ms, sizes in px. "Token" means `design/tokens.json`. "No handler" means the control has no `onClick` in the logic class (static in the prototype). Avatar classes: a1 `#F4B33D`, a2 `#9BD8A8`, a3 `#8CCBEA`, a4 `#F2C6A0`, a5 `#D6C8F2`, a6 `#FF9C8A`, a7 `#E8E3D2`.

Cast used across boards: "Toi" is Hugo (avatar H, a1; see A-DESB-1). Crew name "Les Quais".

### 2.1 Board "Le récap" (`Recap.dc.html`)

Board IDs: O-41, MOT-08, RANK-03, N-21, N-22, N-23, JOY-09, AI-02, QOL-20, O-84. Canvas 2732 × 1010. Six screens.

Logic class state: `{t:0, rise:'rise', conf:true, span:12, votes:[3,5,1], my:-1, tone:1}`.
`componentDidMount` calls `play()`. `play()` clears timers, sets `t:0`, `conf:false`, toggles `rise` between `'rise'` and `'rise pop1'` (to restart the CSS animation), then:
- an interval every **45 ms** increments `i` and sets `t = min(1, i/20)` and stops at `i >= 20`. That is **20 steps, 900 ms**.
- a timeout of **200 ms** sets `conf:true` (confetti appears).
- Counter easing: `e = 1 - (1 - t)^3` (cubic ease-out).

#### Screen 1: "Récap 1, les chiffres"
(a) IDs: O-41, MOT-08.
(b) Layout, top to bottom: story progress, 5 segments (`.bar`, height 4, gap 4). Only the first is filled, with `#F1EEE6`; this indicator exists on screen 1 only. Top row: date (small) on the left, chip "Rejouer" with a replay icon (16 px) on the right. H1 at 44 px (the token h1 is 32). A `grid3` of three numerals, 72 px, amber, each with a small label. Label "Qui était là". Six rows (avatar 38, h3 name, small detail, emoji 22 px on the right). A footnote in small text.
(c) States and interactions: "Rejouer" calls `play()` and restarts the counters, podium and confetti. Counters: `c1 = round(6·e)`, `c2 = round(41·e)`, `c3 = (0.74·e).toFixed(2)` with `.` replaced by `,` (French decimal comma).
Attendee rows (initial, name, avatar, detail, emoji):
- H, Hugo, a1, "6 verres, 3 eaux", 😵
- M, Malik, a3, "7 verres", 🏎️
- J, Jade, a2, "5 verres, 5 eaux", 💧
- I, Inès, a5, "4 verres", 👑
- T, Théo, a4, "0 verre, SAM", 🚗
- N, Nora, a7, "4 verres, invitée", 👋

(d) Motion: count-up over 900 ms, cubic ease-out, 20 steps of 45 ms. This matches `DESIGN.md` ("~900 ms, ease-out cubic").
(e) Copy: "Samedi 14 juin", "Rejouer", "Samedi au Zinc", "présents", "verres", "pic moyen", "Qui était là", "Seulement les gens vraiment présents, amis ou pas."
(f) Simulated: all figures are hard-coded. "41 verres" does not match the rows, which add up to 6+7+5+4+0+4 = 26. "pic moyen 0,74" has no unit. Real: server-computed recap built from present participants only (O-41), the average peak in the user's BAC unit (PREF-06), and replay of a stored recap.
(g) Levels: none shown.

#### Screen 2: "Récap 2, les courbes"
(a) IDs: O-41 (everyone's curves with a time-range slider), MOT-08 (curves).
(b) H2. A panel (`#28322F`, radius 18, padding 12 8) holds an SVG with viewBox 340 × 220:
- the legal-limit line is horizontal at y = 120, `#FF7A66`, dash "5 5";
- five polylines, `stroke-linejoin: round`, stroke width 3.5 for the user and 2 for the others;
- then a range input (`accent-color #F4B33D`), and a top row of two small texts.

Below the panel: a row of five name tags filled with each person's color, then a footnote.
(c) Slider: `min 4`, `max 26`, default `12` (hours). Point count `n = max(2, round(span/26·12))`. The points are spread over the full width (`x = i·340/(n-1)`), so the slider zooms the time axis. `y = 210 - v·170`.
Curve data (12 samples each, values on a 0 to 1.1 scale):
- Toi `[0,.1,.25,.4,.55,.7,.74,.6,.45,.3,.15,0]`
- Malik `[0,.2,.45,.7,.9,1.1,1.05,.9,.7,.5,.3,.1]`
- Jade `[0,.1,.2,.35,.45,.55,.5,.4,.3,.2,.1,0]`
- Inès `[0,0,.1,.2,.3,.45,.48,.42,.3,.2,.1,0]`
- Sami `[0,.15,.3,.5,.62,.5,.35,.2,.1,0,0,0]`

Colors: Toi `#F4B33D`, Malik `#8CCBEA`, Jade `#9BD8A8`, Inès `#D6C8F2`, Sami `#FF9C8A`. The legal line at y = 120 maps to v ≈ 0.53, which fits 0.5 g/L (A-DESB-3).
Texts: `"{span} h affichées"` and `"de 20 h à {(20+span) % 24} h"`.
Name tags have no handler: "Touche un nom pour isoler sa courbe" is promised but not built.
(d) Motion: none. The curves do not draw themselves; MOT-08 asks for "curves drawing".
(e) Copy: "Les courbes de la nuit", aria "Courbes des participants", aria "Durée affichée", "12 h affichées" (dynamic), "de 20 h à 8 h" (dynamic), tags "Toi", "Malik", "Jade", "Inès", "Sami", "Ligne pointillée : limite légale. Touche un nom pour isoler sa courbe."
(f) Simulated: static data. Sami has a curve but is not in the attendee list of screen 1, and Théo and Nora have no curve. The tap-to-isolate is missing. Real: participants' stored curves, isolation on tap, draw-in animation, the start hour from party start (not a fixed "20 h"), and a legal line per the viewer's country (PREF-02).
(g) Levels: none.

#### Screen 3: "Récap 3, podium et badges"
(a) IDs: RANK-03, MOT-08, O-41 (custom badges).
(b) Top row: H2 and the "Rejouer" chip. A podium (flex, height 260, gap 10) has three columns in visual order 2, 1, 3:
- 2nd: avatar J (a2), bar 120 px, `#34403C`, numeral 40 px "2", `animation-delay .2s`.
- 1st: crown icon 26 px amber, avatar M (a3), bar 180 px **amber** with dark text, numeral 48 px "1", no delay.
- 3rd: avatar H (a1), bar 90 px, `#34403C`, numeral 36 px "3", `animation-delay .35s`.
Bars have radius 12 12 0 0.

Then a footnote, label "Badges de la soirée", and a `grid2` of four `pan` cards (padding 12), each with an icon (22), an h3 and a small line:
- water icon: "Chameau", "Jade, 5 eaux"
- car icon (mint): "SAM en or", "Théo, 0 verre"
- crown (amber): "Nouveau boss", "Hugo, Le Zinc"
- dice: "Imbattable", "Inès, 4 parties"

The confetti layer has 16 pieces.
(c) Confetti piece i: `left = (i·6.3 + 3) % 96 %`, `top 60px`, color cycles through `#F4B33D, #9BD8A8, #8CCBEA, #FF9C8A, #D6C8F2, #F1EEE6`, `animation-delay = ((i·37) % 10)/12 s` (0 to 0.75 s). "Rejouer" restarts it.
(d) Motion:
- Podium `.rise`: `scaleY 0→1`, 800 ms, `cubic-bezier(.2,.8,.2,1)`, transform-origin bottom, delays 0 / 200 / 350 ms. This matches `DESIGN.md`.
- Confetti `.conf`: 8 × 14 px, radius 2, keyframes `translateY(-30px) rotate(0)` to `translateY(520px) rotate(600deg)`, 1800 ms, `cubic-bezier(.3,.6,.4,1)`. `DESIGN.md` calls it easeOut, but the curve is not the easeOut token.
- Badges: `.fadein` (translateY 14→0, opacity, 350 ms easeOut), no stagger. MOT-08 asks for "badges dropping", and that drop is not shown.
(e) Copy: "Le podium", "Rejouer", "Verres vérifiés seulement.", "Badges de la soirée", "Chameau", "Jade, 5 eaux", "SAM en or", "Théo, 0 verre", "Nouveau boss", "Hugo, Le Zinc", "Imbattable", "Inès, 4 parties".
(f) Simulated: static ranking. The podium is Malik 1, Jade 2, Hugo 3, while screen 1 has Malik 7 drinks, Hugo 6, Jade 5. The podium only makes sense if not all of those drinks were verified, and that is not explained. Real: podium from server verified-drink counts (RANK-06), badges computed server-side, and podium plus badges on the shareable story card (RANK-03; no story card is designed).
(g) Levels: none.

#### Screen 4: "Récap 4, le fil et la phrase"
(a) IDs: N-22, N-23.
(b) H2. A vertical timeline: a 2 px left border `#3A4643` (not a token), margin-left 8. Each entry has a 12 px dot in its event color at left -7, an hour numeral 20 px (min-width 64) and body text. Then label "Phrase de la nuit" and three `pan` buttons, each with the quote at 17 px weight 600 in « », a small author line and an amber tag with the vote count.
(c) Timeline (hour, event, dot color):
- "20 h 45", "Hugo lance la soirée", `#F4B33D`
- "21 h 10", "Check-in de 4 personnes au Zinc", `#9BD8A8`
- "22 h 30", "Partie de Roulette, Malik perd 3 fois", `#D6C8F2`
- "0 h 52", "Hugo prend Le Zinc à Inès", `#F4B33D`
- "1 h 30", "Tournée de Théo", `#8CCBEA`
- "2 h 55", "Tout le monde est rentré", `#9BD8A8`

Quotes (text, author, base votes):
- "Je conduis pas, je pilote", "Malik, 1 h 12", 3
- "On rentre à pied, c'est à 4 minutes", "Jade, 2 h 40", 5
- "Le serveur m'a reconnu, c'est grave ?", "Inès, 23 h 05", 1

Vote rule: one vote per user. Tapping a quote sets `my = i`, and tapping it again clears it (`-1`). The voted quote shows `count + 1` and the ring `inset 0 0 0 2px #F4B33D`.
(d) Motion: no transition on the ring or the count.
(e) Copy: "Le fil de la soirée", "Phrase de la nuit", the six timeline lines and three quotes above, with « » around quotes.
(f) Simulated: local vote with no server round-trip, no way to add a quote, no photos in the timeline (N-22 lists photos and highlights). Real: an optimistic vote with server reconciliation (SYNC-01), quote submission, and a timeline built from server events.
(g) Levels: none.

#### Screen 5: "Récap 5, album et récap raconté"
(a) IDs: JOY-09, N-21, O-84, AI-02, MOT-08 (export).
(b) H2 "Photomaton". A 3 × 2 strip of 3:4 flat color blocks (`#8CCBEA, #F2C6A0, #9BD8A8, #D6C8F2, #F4B33D, #FF9C8A`) on a `#F1EEE6` frame (padding 8, radius 10, gap 6), then a footnote. A top row with H2 "Le récap raconté" and the neutral tag "IA, à valider". A segmented control with 3 tones. The story paragraph (`.fadein`, `#28322F`, radius 14, padding 14). A `grid2` of "Modifier" (secondary, pencil icon) and "Valider" (primary, check icon). A footnote. An outline full-width "Partager en story" with a share icon 22.
(c) Tone segmented: "Sobre", "Épique", "Roast", default index 1 (Épique). Picking a tone swaps the text instantly. "Modifier", "Valider" and "Partager en story" have no handler.
Texts per tone, verbatim:
- Sobre: "Six au Zinc, 41 verres, Hugo a pris le bar à Inès. Tout le monde est rentré avant 3 h."
- Épique: "Samedi, le Zinc a changé de boss. Hugo a fini par faire tomber Inès à 0 h 52, pendant que Théo, SAM impeccable, ramenait tout le monde à bon port."
- Roast: "Malik a cru qu'il pilotait, Inès s'est fait reconnaître par le serveur, et Hugo a volé le Zinc. Jade, elle, a bu de l'eau. Respect."

(d) Motion: `.fadein` on the paragraph, 350 ms (it replays only on mount in the prototype).
(e) Copy: "Photomaton", "Fait à partir de l'album de la soirée, privé au groupe : 38 photos, 4 vidéos.", "Le récap raconté", "IA, à valider", "Sobre", "Épique", "Roast", "Modifier", "Valider", "Le crew valide avant tout partage. L'IA ne lit jamais vos discussions.", "Partager en story".
(f) Simulated: placeholder color blocks instead of photos, canned AI texts, a single "Valider" (no multi-member approval), no editor, no share. Real:
- AI-02 generation from the timeline only, with the provider behind an ADR, opt-in per crew, and nothing shared before crew approval;
- photo strip built from the real album;
- story export as image or video in the right formats (QOL-06, MOT-08);
- an album browser (N-21 / O-84), which has no screen here.

(g) Levels: none.

#### Screen 6: "Le lendemain matin"
(a) IDs: QOL-20, O-41 (notification timing).
(b) Light theme (`.ph.lt`, bg `#EEF0EA`). Top row: small "Dimanche, 11 h 30" and the neutral tag "Mode lendemain". H1 at 38 px. A pressable `pan` link to the recap with a chevron. A `pan` titled "Les comptes" with two rows (avatar, text, h3 amount) and the small secondary button "Voir la cagnotte", which links to `Argent.dc.html`. A water `pan` (row) with a water icon, text and the small water button "Fait". A footnote.
(c) "Fait" has no handler. Amounts: "12,40 €" (owed by me to Malik) and "6,00 €" (Jade owes me).
(d) Motion: none.
(e) Copy: "Dimanche, 11 h 30", "Mode lendemain", "Doucement. Le récap est prêt.", "Samedi au Zinc", "6 présents, 41 verres, podium et photos", "Les comptes", "Tu dois à Malik", "12,40 €", "Jade te doit", "6,00 €", "Voir la cagnotte", "Un grand verre d'eau avant le café.", "Fait", "Écran plus doux le matin. La notif du récap attend 11 h."
(f) Simulated: static. Real:
- automatic opening the morning after, using QOL-02's day boundary;
- recap notification held until a decent hour (the prototype says 11 h);
- balances from the pools (O-70);
- water reminder;
- photos, which QOL-20 lists and which are missing here.

(g) Levels: none. This screen is the post-party state.

### 2.2 Board "Radar du crew" (`Radar.dc.html`)

Board IDs: N-01, N-02, N-03, N-04, N-05, N-06, N-31, JOY-06, JOY-08, QOL-21. Canvas 2286 × 1010. Five screens.

Logic class state: `{st:0, sent:false, rep:0, cal:true, vote:-1}`. Only interval: the replies ticker (below). No `componentDidMount`.

#### Screen 1: "Ce soir"
(a) IDs: N-01, N-02 (tonight list), JOY-06, QOL-21, N-03 (entry point).
(b) Top row: H1 with the crew name and an IconButton (chat icon) that links to `Messages.dc.html`, aria "Discussions". An amber-tinted `pan` (`#4A3E22`) with a flame icon 26, h3 `#F8E3B4` and small text `#E8D3A4` (the latter is not a token). Label. A `grid2` of four status tiles (`.tile`, min height 76; selected = `.on`, inverted). When status = "Je sors", a chip row (`.fadein`). The primary full button "Je sors, qui vient ?" (people icon), which links to the anchor `#qui-vient`. A `pan` row for the birthday (calendar icon, h3 and small text, small secondary button). Label. Five crew rows (avatar, name, detail, status tag). A footnote. The tab bar with Crew active.
(c) Status tiles (label, sub-line), single choice, default index 0:
- "Je sors", "Le crew est prévenu"
- "Chaud si ça bouge", "Visible, sans engagement"
- "Chill maison", "Pas ce soir, mais joignable"
- "Pas dispo", "Rien ce soir"

`goingOut = (st === 0)` shows the chips "À partir de 21 h" (on), "Au Zinc" and "Changer" (pencil icon). The chips have no handler.
Crew board (initial, name, avatar, detail, tag, tag tint):
- J, Jade, a2, "Au Zinc vers 21 h", "sort", amber
- M, Malik, a3, "Dès 20 h", "sort", amber
- I, Inès, a5, "Si c'est près", "chaud", mint
- T, Théo, a4, "Peut conduire", "chaud", mint
- S, Sami, a6, "Révisions", "pas dispo", neutral

"Préparer" has no handler.
(d) Motion: the chips fade in (350 ms) when switching to "Je sors". The tiles switch instantly.
(e) Copy: "Les Quais", aria "Discussions", "7 semaines de suite", "Le crew sort ensemble chaque semaine. Une semaine calme ne casse pas la série.", "Ton statut ce soir", the four tiles above, "À partir de 21 h", "Au Zinc", "Changer", "Je sors, qui vient ?", "Anniv de Jade jeudi", "Préparer une soirée ?", "Préparer", "Qui sort ce soir", the board rows above, "Les statuts disparaissent seuls le lendemain matin.", tab labels "Soirée", "Crew", "Jeux", "Bars", "Moi".
(f) Simulated: local status, no server write, no expiry, no streak computation. Real:
- status as an optimistic mutation (SYNC-01) with auto-expiry the next morning (N-01, QOL-02 boundary);
- time window and place editors;
- streak with a freeze (JOY-06);
- birthday reminder a few days before, pre-filling a "birthday" party (QOL-21);
- crew switcher for several crews (N-30), which has no screen.

(g) Levels: none.

#### Screen 2: "Je sors, qui vient ?"
(a) IDs: N-03.
(b) A back IconButton, H1 and chips "21 h" (on), "Le Zinc" and "Un mot" (plus icon). Before sending: the primary full button "Prévenir le crew" (send icon). After sending (`.fadein` block): a small line, reply rows (`.row.fadein`: avatar, name, tag), and the primary full button "Créer la soirée avec {N}".
(c) `send()` sets `sent:true`, `rep:0`, then an interval of **1100 ms** adds one reply until all 4 are shown (at 1.1, 2.2, 3.3 and 4.4 s). Replies (initial, name, avatar, text, tint):
- J, Jade, a2, "J'arrive", mint
- M, Malik, a3, "J'arrive", mint
- T, Théo, a4, "Pas ce soir", none
- I, Inès, a5, "Vers 22 h", amber

`yesCount` = replies with a non-empty tint, plus 1 (me), suffixed with " personnes". So "Vers 22 h" counts as yes (A-DESB-4). The sequence is 1, 2, 3, 3, 4. **Bug:** right after sending, the button reads "Créer la soirée avec 1 personnes", which breaks QOL-12 plural agreement. "Créer la soirée" has no handler. The chips have no handler.
(d) Motion: block and rows fade in (350 ms each, as rows arrive).
(e) Copy: aria "Retour", "Je sors ce soir", "21 h", "Le Zinc", "Un mot", "Prévenir le crew", "Envoyé à 11 personnes. Ils répondent depuis la notif.", replies above, "Créer la soirée avec 4 personnes" (final state).
(f) Simulated: replies on a timer, recipient count hard-coded at 11, no pending state on send. Real:
- broadcast through the server, then push with actionable replies (QOL-03);
- live replies;
- one tap creating a party (O-35) pre-filled with time, place and the yes list;
- the optional note ("Un mot") editor.

(g) Levels: none.

#### Screen 3: "La semaine"
(a) IDs: N-02 (calendar), N-05, N-06.
(b) H1. A segmented control "Liste" / "Calendrier" with Calendrier on and no handler, so the list view does not exist. Grid: a 70 px name column plus 7 day columns, gap 6. The header has weekday initials. Each person row has 7 cells (height 30, radius 8) colored by status. Legend tags. A `pan` with h3, a chip row of the 7 days (static, jeu and sam on) and a small line. A row with the calendar-sync switch.
(c) Weekdays `['l','m','m','j','v','s','d']`. Color code:
- `o` = `#F4B33D` (sort)
- `m` = `#9BD8A8` (chaud si ça bouge)
- `n` = `#34403C` (pas dispo)
- `x` = `#2A3431`: no legend entry, read as "no status" (A-DESB-2); not a token.

Rows:
- Toi `nxooxoo`
- Jade `xmxomox`
- Malik `oxnxoox`
- Inès `xxmxoon`
- Théo `nnxxmoo`

"Chill maison" has no color. The usual-nights chips have no handler. The switch `cal` defaults to on and toggles.
(d) Motion: switch knob 220 ms easeToggle; background transition 200 ms (base.css).
(e) Copy: "Cette semaine", "Liste", "Calendrier", "l m m j v s d", names, legend "sort", "chaud si ça bouge", "pas dispo", "Mes soirs habituels", "lun", "mar", "mer", "jeu", "ven", "sam", "dim", "Sert à proposer les bons créneaux au crew.", "Synchroniser avec mon calendrier", "Les soirées acceptées y apparaissent", aria "Synchroniser le calendrier".
(f) Simulated: static grid, static chips. Real:
- statuses per day from the server;
- list view;
- "this weekend" view (N-02);
- recurring availability stored and used to suggest slots (N-05);
- calendar write and ICS subscription plus reminders (N-06).

The calendar encodes status by color only, and `n` and `x` are nearly the same dark tone. That fails `DESIGN.md` §8 if ported as is.
(g) Levels: none.

#### Screen 4: "Sondage de sortie"
(a) IDs: N-04.
(b) A back IconButton and H1. Label "Quel soir ?". Three slot `pan` buttons, each with a top row (h3 label, small count) and an 8 px progress bar. Label "Où ?". Place chips (static, "Chez Jade" on). The primary full button "Clore et créer la soirée" (`margin-top: auto`, no handler).
(c) Slots and base votes: "Jeudi 19" 4, "Vendredi 20" 6, "Samedi 21" 2. Single choice: tapping toggles my vote (+1) on that slot and clears it from any other. The count text is `v + (v > 1 ? ' votes' : ' vote')`. The bar width is `round(v/8·100)%`, a hard-coded denominator of 8 (A-DESB-5). The ring on my choice is `inset 0 0 0 2px #F4B33D`.
(d) Motion: bar width transition 600 ms `cubic-bezier(.2,.8,.2,1)` (base.css `.bar i`).
(e) Copy: aria "Retour", "Anniv de Jade", "Quel soir ?", "Jeudi 19", "Vendredi 20", "Samedi 21", "4 votes" / "1 vote" pattern, "Où ?", "Chez Jade", "Le Zinc", "La Capsule", "Clore et créer la soirée".
(f) Simulated: single choice, local counts. Real per N-04:
- When2Meet-style multi-slot availability (the prototype is single choice: gap);
- place vote;
- "plan" option (missing);
- close, then party or event created automatically;
- vote as an optimistic mutation.

(g) Levels: none.

#### Screen 5: "Fil du crew"
(a) IDs: N-31, JOY-08.
(b) H1. An amber-tinted milestone `pan`. Label "Cette nuit, en résumé" and three event rows (icon 22, text, small time). Label "Plus tôt" and two rows with avatars. A chip row of reactions. A footnote. Tab bar with Crew active.
(c) The reaction chips "😂 4", "🔥 2" and "+" have no handler.
(d) Motion: none.
(e) Copy: "Fil du crew", "50e soirée ensemble", "Depuis le 3 février. La prochaine compte pour la 51e.", "Cette nuit, en résumé", "Hugo a pris Le Zinc à Inès", "0 h 52", "Malik a perdu 3 fois à la Roulette", "22 h 30", "Tout le monde est rentré", "2 h 55", "Plus tôt", "Inès a ajouté 3 cartes au jeu du crew", "hier, @Hugo mentionné", "Jade a noté La Capsule 4 sur 5", "vendredi", "😂 4", "🔥 2", "Un résumé par soirée au lieu d'une notif par événement."
(f) Simulated: static digest. Real: server-built digest per party (N-31), reactions (optimistic), mentions linked to the item, and milestones computed on nights (never on drinks; JOY-08).
(g) Levels: none.

### 2.3 Board "Messagerie" (`Messages.dc.html`)

Board IDs: MSG-01, MSG-03, MSG-05, MSG-06, MSG-07, MSG-08, MSG-09, MSG-10, ADP-10. Canvas 1840 × 1010. Four screens.

Logic class state: `{draft:'', mine:[], ver:false, eph:2, read:true, typ:true, report:false, rev:false, held:true}`.

#### Screen 1: "Discussions"
(a) IDs: MSG-01, MSG-09, ADP-10.
(b) H1. A search input with a leading icon (padding-left 44) and a footnote. Rows:
- crew chat: square avatar (radius 12) "LQ" a1, h3 "Les Quais", preview, time "2 h 41" and an amber unread tag "3";
- party chat: square "SZ" a2, "Samedi au Zinc", "Archivée après le récap", "dim.";
- direct message: round "J" a2, "Jade", "Message vocal, 0:12", "hier";
- direct message with a stranger after acceptance: round "N" a7, "Nora", "Demande acceptée, dites bonjour", "hier";
- held-message row: clock icon amber, h3, small text and the small secondary button "Voir" linking to `#sauvegarde`.

Tab bar with Crew active.
(c) The search field has no handler.
(d) Motion: none.
(e) Copy: "Discussions", placeholder "Chercher dans tes messages", aria "Chercher", "La recherche se fait sur ton téléphone. Le serveur ne peut pas lire tes messages.", "Les Quais", "Jade : quelqu'un a vu mes clés ?", "2 h 41", "3", "Samedi au Zinc", "Archivée après le récap", "dim.", "Jade", "Message vocal, 0:12", "hier", "Nora", "Demande acceptée, dites bonjour", "1 message retenu", "Pour Camille, à confirmer ce matin", "Voir".
(f) Real: on-device search index (MSG-09), decrypted previews on device, per-party chat archived after the recap (MSG-01), and the stranger DM only after a request is accepted (COM-05).
(g) Levels: none. The held row is the result of ADP-10 at levels 2 and 3.

#### Screen 2: "Conversation"
(a) IDs: MSG-03, MSG-10, MSG-06 (header).
(b) Header (padding 54 16 10, bottom border): back IconButton, a title "Les Quais" with a lock icon 12 and a small E2EE line, and an IconButton "Infos" (dots) linking to `#infos`. Message list (gap 10, padding-top 12). Bubbles have max-width 270:
- incoming bubbles: `#2C3734`, radius 18 18 18 4;
- outgoing bubbles: amber with dark text, radius 18 18 4 18.

Sequence:
1. Jade's text, with her name in `#9BD8A8` (her avatar color), weight 700.
2. An incoming encrypted photo: a placeholder 150 px high, `#46534F`, image icon 40 in `#8E9893` (not a token), and a caption.
3. My reply with a quote block (3 px left border, 13 px, opacity .75) and a mention.
4. A reactions row ("😂 2", "🔑 1"), right-aligned.
5. An incoming voice note (mic icon amber, 8 px bar at 40%, width 140, "0:12"), with no sender name.
6. The `mine` list (new messages).
7. A typing line.

Composer (padding 10 14 30, top border): input, primary square send button (52 × 52), secondary square voice button (52 × 52).
(c) `send()`: trims the draft, ignores it if empty, appends `{id, t, st:'envoi'}` and clears the draft. After **900 ms**, `st` becomes `'envoyé ✓'`. No failure, offline or queued state. The typing line "Malik écrit..." is static and does not obey the typing switch on screen 3. The voice button has no handler.
(d) Motion: new outgoing bubble `.fadein` 350 ms; status text swap with no transition.
(e) Copy: aria "Retour", "Les Quais", "Chiffré de bout en bout, messages éphémères 24 h", aria "Infos", "Jade", "quelqu'un a vu mes clés ?", "Photo chiffrée sur ton téléphone avant l'envoi", "Jade : quelqu'un a vu mes clés ?", "@Malik les avait dans sa poche", "😂 2", "🔑 1", "0:12", "envoi", "envoyé ✓", "Malik écrit...", placeholder "Message", aria "Message", aria "Envoyer", aria "Message vocal".
(f) Simulated: the 900 ms fake server and a static typing indicator. Real:
- MLS or Signal-group E2EE (MSG-02, ADR);
- per-file media keys and thumbnails made on device (MSG-03);
- offline send queue and failure with retry (MSG-10, SYNC-04);
- read receipts (not displayed at all here);
- edit or delete for everyone within a window (missing);
- big record button at levels 2 and 3 (missing);
- video messages (missing).

(g) Levels: none shown. MSG-10 requires the big record button at levels 2 and 3.

#### Screen 3: "Infos et clé de sécurité"
(a) IDs: MSG-05, MSG-06, MSG-07, MSG-10 (receipt and typing switches).
(b) Back IconButton. H1 "Jade" (a direct conversation, while screen 2 is the crew chat). An amber-tinted notice `pan` with a key icon. A `pan` centered: QR placeholder 140 × 140 on `#F1EEE6` (icon 110), the safety number as a numeral 22 px with letter-spacing 2, centered on two lines, and a small button. Label "Messages éphémères". A segmented control with 4 items. Two switch rows. An outline full-width "Signaler un message" (flag icon 18). Report sheet: scrim, grab handle, H2, text, `grid2` "Annuler" (secondary) / "Signaler" (danger).
(c) Interactions:
- Verify toggle: `ver` false gives a primary button "Marquer comme vérifié"; true gives a secondary button "Vérifié avec Jade".
- Disappearing messages: "Non", "1 h", "24 h", "7 j", default index 2 ("24 h").
- Read receipts (`read`) and typing indicator (`typ`) both default to on and toggle.
- "Signaler un message" opens the sheet. Both sheet buttons close it.

The safety number shown is 30 digits ("37129 04881 55302 / 91846 20375 66418"). Signal-style safety numbers are 60 digits (see A-DESB-7).
(d) Motion: sheet slide-up 320 ms easeOut (base.css `.sheet`), switches 220 ms.
(e) Copy: aria "Retour", "Jade", "La clé de Jade a changé. Nouveau téléphone, sûrement. Vérifiez ensemble si vous voulez être sûrs.", "37129 04881 55302", "91846 20375 66418", "Marquer comme vérifié", "Vérifié avec Jade", "Messages éphémères", "Non", "1 h", "24 h", "7 j", "Accusés de lecture", "Indicateur d'écriture", "Signaler un message", "Signaler ce message", "Ton téléphone déchiffre ce message et les 3 autour, puis les envoie à la modération. Personne d'autre ne les voit.", "Annuler", "Signaler".
(f) Simulated: placeholder QR, no camera scan (MSG-05 includes "scan a QR code"), and reporting from the info screen without choosing a message. Real:
- libsignal safety numbers and QR scan;
- key-change detection;
- per-conversation disappearing timer synced to all members;
- report flow started from a specific message (long-press), sending that message and the 3 around it, decrypted on the reporter's device (MSG-07, COM-08);
- block and mute (COM-08), missing here;
- group info (members, leave, mute), not designed.

(g) Levels: none.

#### Screen 4: "Sauvegarde et messages retenus"
(a) IDs: MSG-08, ADP-10.
(b) H1. A `pan` with h3, a small line, a passphrase box (`#1E2624`, radius 12, padding 12, weight 700, letter-spacing .5) and a `grid2` of two small buttons. A danger-tinted `pan` (`#4E2C27`, h3 `#FFD3CB`, small `#F3B9AE`; the last is not a token). Label "Retenu cette nuit". The held card (`.fadein`): a top row with h3 and the neutral tag "niveau 2", the message text in « », and a `grid2` "Supprimer" (secondary) / "Envoyer quand même" (primary). Empty-state line.
(c) Interactions:
- Reveal toggle: masked "•••• •••• •••• •••• •••• ••••" (6 groups) or "zinc tonnerre capsule orage pinte velours" (6 words). The button reads "Afficher" or "Cacher".
- "Je l'ai notée" has no handler.
- Both held-card buttons call `del` (they only remove the card). "Envoyer quand même" does not send.
- With no card: "Rien en attente. Tu nous remercieras plus tard."

(d) Motion: held card fade-in 350 ms.
(e) Copy: "Tes messages, ta clé", "Sauvegarde chiffrée", "Protégée par une phrase que toi seul connais. On ne peut pas la retrouver pour toi.", "Afficher", "Cacher", "Je l'ai notée", "Sans cette phrase", "Ton historique ne reviendra pas sur un nouveau téléphone.", "Retenu cette nuit", "Pour Camille, 3 h 12", "niveau 2", "« t'es réveillée ? »", "Supprimer", "Envoyer quand même", "Rien en attente. Tu nous remercieras plus tard."
(f) Simulated: fixed passphrase, no backup on/off control (MSG-08 says "optional"), no restore flow. Real:
- generated recovery passphrase;
- encrypted backup;
- restore on a new phone;
- the app-switcher snapshot hiding the passphrase (SEC-05);
- held messages actually queued on device and sent only after morning confirmation (ADP-10);
- contact picking, which is on `ModeBourre.dc.html`.

(g) Levels: the tag "niveau 2" shows the level at which the message was held.

### 2.4 Board "Les bars" (`Bars.dc.html`)

Board IDs: TER-01 to TER-09, N-08 to N-12, COM-01, COM-02, COM-03, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11, AC-02 to AC-06, MOT-09, PROF-04 (30 IDs). Canvas 2732 × 1010. Six screens.

Logic class state: `{scope:0, f:{open:true, hh:false, friends:false, adult:true, terr:false, cheap:false}, sel:0, mode:'ok', step:-1, rot:0, spins:0, cr:{0:4,1:3,2:3,3:4,4:2,5:5}, door:1, aud:0, play:true, priv:false}`.

#### Screen 1: "Carte des bars"
(a) IDs: TER-01, TER-08 (faded pin), COM-06 (busy level), COM-10 (filters), MOT-09 (partly), TER-07 (scope "Crews").
(b) A full-bleed map background `#26302D` (not a token), as an SVG with 5 roads (stroke `#34403C`, width 18) and a river (stroke `#2B4650`, width 30; not a token). On top: a segmented scope control on `rgba(30,38,36,.92)` and a horizontal chip scroller. Pins are absolutely positioned buttons: crown 18 px in the boss color (if the venue has a boss), a round initials badge (38 px, or 46 px when selected with a `3px solid #F1EEE6` border; ring `0 0 0 4px #1E2624`) and a name tag at 11 px. A bottom sheet with no entry animation (padding-bottom 110) holds a grab handle, a top row (H2 name, small description) with a busy tag, and a second row (crown icon, "Boss : name") with the small primary "Voir" linking to `#le-zinc`. Tab bar with Bars active, overlaid at the bottom.
(c) Scope: "Mon crew", "Tout le monde", "Crews", default 0. It changes nothing on the map.
Filter chips (multi-toggle, default on: "Ouvert" and "18+ strict"): "Ouvert", "Happy hour", "Mes potes", "18+ strict", "Terrasse", "Pinte < 6 €". They do not filter pins.
Pins (name, initials, color, x, y, has boss, description, boss, busy label, busy tint):

| Venue | Initials | Color | x, y | Boss | Description | Boss name | Busy | Tint |
|---|---|---|---|---|---|---|---|---|
| Le Zinc | I | `#D6C8F2` | 150, 330 | yes | "Bar rock, 400 m" | Inès | "Blindé ce soir" | red |
| La Capsule | H | `#F4B33D` | 230, 250 | yes | "Bière artisanale, 800 m" | Toi | "Animé" | amber |
| Quai 12 | J | `#9BD8A8` | 70, 470 | yes | "Bar à quiz, 1,1 km" | Jade | "Calme" | mint |
| Chez Odette | ? | `#56635F` | 270, 520 | no | "Bar à vin, jamais visité" | Personne | "Trop peu de check-ins" | neutral |

The never-visited pin has opacity .75 and no crown. Tapping a pin sets `sel`, which grows the pin and updates the sheet. Default selection: Le Zinc.
(d) Motion: pin size change is instant (no transition declared). The sheet has `animation: none`. There is no takeover wash on the map and no "crew is here now" animation (MOT-09 and TER-01 ask for both).
(e) Copy: "Mon crew", "Tout le monde", "Crews", "Ouvert", "Happy hour", "Mes potes", "18+ strict", "Terrasse", "Pinte < 6 €", venue names, descriptions, "Boss : Inès" pattern, "Personne", "Blindé ce soir", "Animé", "Calme", "Trop peu de check-ins", "Voir".
(f) Simulated: SVG fake map, scope and filters without effect. Real:
- native maps (`design/prototype/README.md`);
- pins in the boss color and avatar, with crown and area of influence (TER-01: area missing);
- "crew is here now" highlight only while live;
- filters applied;
- public scope following COM-06 (aggregated, delayed, with a threshold of at least 5);
- crews scope following TER-07.

(g) Levels: none.

#### Screen 2: "Page d'un bar"
(a) IDs: TER-05, N-08, N-09, N-12 (popular days only), COM-01, COM-02 (display), COM-03, COM-07 (tags), COM-08 (report button), COM-09, COM-10 (save), COM-11 (owner label), TER-02 (points copy).
(b) Top row: back IconButton, then IconButtons "Enregistrer" (star) and "Signaler" (flag). H1 at 40 px and a small info line. Tags: "Rock", "Terrasse", "18+ strict" (mint), "Carte demandée souvent". A `grid2` with primary "Check-in" (pin icon, links to `#check-in`) and secondary "Y aller" (car icon, no handler). Boss `pan`:
- header: crown 26 amber, h3, small points line, and "J-5" on the right;
- two ranked rows (numeral 20, avatar 30, name, points), rank 2 "Toi" 16 and rank 3 "Malik" 11;
- a footnote.

Label "Prix relevés par les gens", then a `grid3` of price `pan`s (padding 10, gap 0; small label, numeral 26) and a price-change line. Label "Ça se remplit quand", then 7 bars (flex, height 70, gap 6; radius 6 6 2 2; day label 11 px) and a source line. Header row "Avis vérifiés" with the rating summary. One review `pan` (h3 author, 4 amber stars 16, text, small date). An event `pan` (amber tag date, h3, small line). Label "Les habitués" and one row (avatar a7, handle, title line, chevron). Outline full-width "Donner mon avis" (pencil icon), linking to `#avis`.
(c) Popular-days heights in px: lun 20, mar 28, mer 26, jeu 46, ven 64, sam 70, dim 30. Saturday (index 5) is `#F4B33D` and the others `#46534F`. Prices: Pinte "6,50 €", Demi "3,80 €", Shot "3 €". The season top shows 3 members (boss plus ranks 2 and 3); TER-05 asks for a top 5. The save and report buttons have no handler.
(d) Motion: popular-days bars `.rise` (scaleY, 800 ms easeOut, no stagger) on mount.
(e) Copy: aria "Retour", aria "Enregistrer", aria "Signaler", "Le Zinc", "Bar, ouvert jusqu'à 2 h. Happy hour 18 h à 20 h. Page gérée par l'établissement.", "Rock", "Terrasse", "18+ strict", "Carte demandée souvent", "Check-in", "Y aller", "Inès, boss du mois", "18 points. Toi : 16.", "J-5", "2", "Toi", "16", "3", "Malik", "11", "Points au check-in, au temps passé, aux soirées organisées et aux jeux gagnés ici. Jamais aux verres.", "Prix relevés par les gens", "Pinte", "6,50 €", "Demi", "3,80 €", "Shot", "3 €", "Pinte passée de 6 € à 6,50 € il y a 3 jours.", "Ça se remplit quand", "lun", "mar", "mer", "jeu", "ven", "sam", "dim", "D'après les check-ins de 214 personnes. Ce soir : blindé.", "Avis vérifiés", "4,3 sur 5, 128 avis", "Un habitué", "Bonne pinte, musique trop forte après minuit. Le videur demande la carte.", "Visite du 7 juin", "Jeudi 19", "DJ set rock", "3 potes y vont, 41 personnes de l'app", "Les habitués", "@nora.ln", "Légende du Zinc, saison de mai", "Donner mon avis".
(f) Missing from this page against `PROMPT.md`:
- address (N-08), crew ratings and the "HQ" venue (N-08);
- cocktail and soft-drink prices, a price history view, and logging a price (N-09);
- visits, average spend, average drinks and best nights (N-12);
- popular hours and "app users this month" (COM-01);
- per-criterion ratings on a review, "useful" votes and review photos (COM-02);
- report on a single review (COM-08);
- RSVP on the event (COM-09);
- owner replies (COM-11);
- past bosses, the crew's latest nights and linked album photos (TER-05);
- door-policy confidence (COM-07);
- discovery points ("first in the crew to discover it", TER-02), missing from the points footnote.

Real: venue data from the server, aggregated presence under COM-06 rules, and the directions shortcut ("Y aller", QOL-18).
(g) Levels: none.

#### Screen 3: "Check-in et prise de bar"
(a) IDs: N-10, TER-03, TER-04 (takeover and notice), AC-02, AC-03, AC-04, AC-05, AC-06, MOT-09.
(b) H1. A segmented demo control "Vrai check-in" / "Faux GPS". A `pan` listing signals (`.top.fadein`: label on the left, a symbol on the right). While idle: the primary full "Faire le check-in" (pin icon). Won block (relative, overflow hidden, padding 24 0): a wash circle 120 × 120 amber at top 40, a crown 64 px amber (`.drop`), avatar a1 84 × 84 font 32 (`.pop1`), centered H2 and a centered small line. Caught block: a danger-tinted `pan` (`.fadein`) with an h3 `#FFD3CB`, small text `#F3B9AE`, and a red tag with a flag icon. When done: secondary full "Recommencer". Footnote with `margin-top: auto`.
(c) `run()`: sets `step:0` (the first signal shows immediately), then a **650 ms** timeout chain increments `step` until 3. Signals appear at 0, 650, 1300 and 1950 ms, and the verdict shows at 1950 ms (`done = step >= 3`).
Signals in "ok" mode (all ✓, mint h3):
- "Position cohérente"
- "Position non simulée"
- "Jade est là aussi (Bluetooth)"
- "Téléphone intègre"

Signals in "fake" mode:
- "Position cohérente" ✗ (red)
- "Position non simulée" ✗ (red)
- "Personne du crew à proximité" ✗ (red)
- "Téléphone intègre" ? (muted)

Switching mode resets `step:-1`. "Recommencer" resets too. Points shown on a win: "19 points contre 18", against "Toi : 16" on the venue page, so one check-in is worth +3 in the demo.
(d) Motion:
- crown `.drop`: 700 ms `cubic-bezier(.2,.9,.25,1.2)` (easeOvershoot); keyframes `translateY(-70px) scale(1.5)` with opacity 0, then `translateY(4px) scale(1)` at 70%, then none;
- wash: `scale .2→4`, opacity `.85→0`, 1000 ms, CSS keyword `ease-out` (not the easeOut token), forwards;
- avatar `.pop1`: scale .7, then 1.08 at 60%, then 1, 350 ms easeOut;
- signals and the refusal card: `.fadein` 350 ms.

All of these match the `DESIGN.md` numbers (700 / 1000 / 350, every 650 ms).
(e) Copy: "Check-in au Zinc", "Vrai check-in", "Faux GPS", the signal labels above, "✓", "✗", "?", "Faire le check-in", "Le Zinc est à toi", "Tu passes devant Inès, 19 points contre 18. Elle vient d'être prévenue.", "Check-in refusé : position simulée", "Aucun point. Le crew voit « tentative de triche » sur ton profil pendant 7 jours. Un admin peut l'annuler si c'est une erreur.", "Tricheur du week-end", "Recommencer", "Le serveur décide. Position, cohérence du trajet, potes présents et intégrité du téléphone sont croisés."
(f) Simulated:
- the verdict comes from a client timer and the demo segmented control;
- the 4 signals are decided locally;
- there is no "unverified" outcome;
- there is no private check-in option at the moment of check-in (only the default switch on screen 6).

Real:
- AC-01 server scoring and AC-06 risk score with three outcomes;
- the takeover animation played on the server's answer (SYNC-02);
- TER-03 rules (one counted check-in per venue per party, a minimum delay);
- "X just took Bar Y" notification to the old boss (TER-04);
- the cheat-attempt record visible to the crew for a limited time, overturnable by the admin (AC-09).

The demo segmented control must not ship.
(g) Levels: none.

#### Screen 4: "On va où ?"
(a) IDs: N-11, TER-08 (Chez Odette is on the wheel).
(b) H1. Static chips: "Ouvert" (on), "Happy hour en cours" (on), "Moins de 6 €", "À 10 min". A wheel 300 × 300, centered, margin 10 0: `conic-gradient(#F4B33D 0 90deg, #9BD8A8 90deg 180deg, #8CCBEA 180deg 270deg, #D6C8F2 270deg 360deg)`, labels rotated 45 / 135 / 225 / 315°, weight 800, dark. The pointer is a triangle at the top (borders 12 / 12 / 22, `#F1EEE6`, top -14). Then a centered H2 result and a `grid2` "Tourner" (primary) / "Faire voter" (secondary, no handler).
(c) `spin()`: `rot += 1440 + floor(random·360)` (4 turns plus a random angle) and `spins++`. Result: `w = ['Le Zinc','Chez Odette','Quai 12','La Capsule']` and `idx = (4 - floor(((rot % 360) + 360) % 360 / 90)) % 4`.
**Defect:** with CSS clockwise rotation, the segment under the top pointer is at wheel angle `(360 - rot % 360)`, so the correct conic index is `3 - q` for `q = floor(rot % 360 / 90)`. The formula yields index `q`, the mirror. For example, `rot % 360 = 45` puts Chez Odette under the pointer, and the text says Le Zinc. Also, `wheelTxt` updates on tap, before the 3.2 s spin ends, and "Tourner" stays enabled while spinning.
(d) Motion: `transition: transform 3.2s cubic-bezier(.12,.75,.18,1)`. This is not the `easeSpin` token (`.1,.7,.15,1`); `DESIGN.md` calls it "easeSpin-like".
(e) Copy: "On va où ?", "Ouvert", "Happy hour en cours", "Moins de 6 €", "À 10 min", "Le Zinc", "La Capsule", "Quai 12", "Chez Odette", "Tourne pour choisir", "Ce soir : {venue}", "Tourner", "Faire voter".
(f) Real:
- the candidate list from filters (availability, budget, distance, current happy hours; N-11);
- conquest suggestions (TER-08);
- the result computed from the final angle and revealed on stop;
- haptic clicks;
- a vote flow ("Faire voter"), which has no screen;
- an AI or heuristic "suggestion" mode (N-11's first option), which has no screen.

(g) Levels: none.

#### Screen 5: "Écrire un avis"
(a) IDs: COM-02, COM-07, PROF-04.
(b) Top row: back IconButton and the mint tag "Visite vérifiée samedi" (check icon). H1. Six criterion rows, each with a label and 5 star buttons (24 px; on `#F4B33D`, off `#56635F`; aria "{critère} {n} sur 5"). Field with label "Ton avis" and a textarea (min height 84, padding 12). Footnote. Label and segmented "La carte d'identité à l'entrée". Label and segmented "Qui voit cet avis". The explanation line for the selected audience. Primary full "Publier" (no handler).
(c) Criteria and default stars: Prix 4, Ambiance 3, Musique 3, Service 4, Attente 2, Sentiment de sécurité 5. Tapping star n sets that criterion to n.
Door: "Toujours", "Parfois", "Jamais", default index 1 (Parfois).
Audience: "Public", "Anonyme", "Amis", "Moi", default index 0 (**Public**). Explanations:
- Public: "Avec ton pseudo, sur la page du bar et ton profil."
- Anonyme: "Signé « un habitué », compte dans la note du bar."
- Amis: "Seuls tes amis le voient, sur la page du bar et ton profil."
- Moi: "Juste pour toi, comme un carnet."

(d) Motion: none beyond the switch-free segmented swap.
(e) Copy: aria "Retour", "Visite vérifiée samedi", "Le Zinc", "Prix", "Ambiance", "Musique", "Service", "Attente", "Sentiment de sécurité", aria "Prix 4 sur 5" pattern, "Ton avis", placeholder "Ce qui vaut le coup, ce qui coince", "Parle du lieu, pas des gens : pas de noms.", "La carte d'identité à l'entrée", "Toujours", "Parfois", "Jamais", "Qui voit cet avis", "Public", "Anonyme", "Amis", "Moi", the four explanation lines above, "Publier".
(f) Missing:
- photos (COM-02, QOL-09);
- the official age policy question ("18+ only, or all ages early in the evening"; COM-07);
- draft persistence (QOL-07);
- automatic filter for names or personal data (COM-08);
- a length limit;
- submission and moderation states.

Real: posting gated on a server-verified check-in.
(g) Levels: none.

#### Screen 6: "Saison et titres"
(a) IDs: TER-04, TER-06, TER-07, TER-08, TER-09.
(b) H1 and a small line. A `grid3` of stat `pan`s (padding 12, gap 0; numeral 40, the first in amber; small label). A danger-tinted alert row (warning icon `#FF7A66`, text `#FFD3CB`). Label "Tes titres" with tags: "Maire du Zinc" (amber, crown 14), "Explorateur", "Nomade", "Conquérant, mai". Label "Crews" with two rows. Label "À tester" with one row and the neutral tag "jamais visité". Label "Confidentialité" with two switch rows.
(c) Switches: `play` (participate) defaults to on and `priv` (private check-in by default) defaults to off; both toggle.
(d) Motion: switches 220 ms.
(e) Copy: "Saison de juin", "Se termine dans 5 jours. Les points repartent de zéro le 1er.", "3", "bars à toi", "14", "visités", "5", "à conquérir", "Malik est à 2 points de te prendre La Capsule.", "Tes titres", "Maire du Zinc", "Explorateur", "Nomade", "Conquérant, mai", "Crews", "Les Quais tiennent 6 bars", "1er du quartier", "Crew des Halles tient La Capsule", "2e", "À tester", "Chez Odette", "jamais visité", "Confidentialité", "Participer au jeu des bars", "Seuls tes check-ins comptent, jamais ta position en continu", aria "Participer", "Check-in privé par défaut", "Invisible et sans points", aria "Check-in privé".
(f) Missing: history of reigns and their length (TER-04), and the link of titles to crew titles (N-34). Real: monthly reset on the server, a threat alert computed server-side, and both switches as server preferences (PREF-01).
Demo-data inconsistency: "Maire du Zinc" for Toi, while the venue page says Inès is the boss. La Capsule's boss is "Toi" on the map, but "Crew des Halles tient La Capsule" here.
(g) Levels: none.

### 2.5 Board "Classements" (`Classements.dc.html`)

Board IDs: RANK-01, RANK-02, RANK-04, RANK-05, RANK-06, RANK-07, RANK-08, MOT-13. Canvas 948 × 1010. Two screens. The tab bar shows **Soirée** active on both.

Logic class state: `{period:0, metric:0, m:5, off:false, crew:true, prevLead:'Toi'}`. `prevLead` is never read, so no leader-change detection is implemented.

#### Screen 1: "Classement en direct"
(a) IDs: RANK-01, RANK-02, RANK-06, RANK-07, RANK-08, MOT-13.
(b) Top row: H1 and the neutral tag "en direct" with a `.dot.live` (8 px, mint, opacity pulse 1600 ms ease-in-out infinite). A horizontal chip scroller with 5 periods. A segmented control with 3 metrics. When Malik is ranked above me, an amber-tinted overtake `pan` (`.fadein`, up-arrow icon). A list container 330 px high with absolutely positioned rows:
- `top = index·66`, height 60, radius 14, padding 0 12, gap 12;
- rank numeral 28 (width 26), avatar 38, h3 name, small sub-line;
- on the leader only, a crown 22 amber (`.drop`);
- value numeral 30.

My row background is `#3A4643` (not a token); the others are `#28322F`. Then the secondary full demo button, two footnotes, and a switch row.
(c) Data (name, initials, avatar, drinks, grams):
- Toi, H, a1, 6, 62
- Malik, M, a3, `m` (initially 5), `m·11`
- Jade, J, a2, 5, 48
- Inès, I, a5, 4, 40
- Nora, N, a7, 4, 38

Sorting is descending by grams when the metric is "Grammes", and by drinks otherwise ("Soirées" also sorts by drinks). The JS sort is stable, so ties keep the base order and Toi stays above Malik at 6 vs 6.
Values:
- "Grammes": `{g} g`, with sub-line `{drinks} verres`;
- "Soirées": `'3'` for everyone (placeholder);
- "Verres": `{drinks}`, with sub-line `{g} g d'alcool`.

The demo button sets `m += 1`. In "Verres", Malik passes me after 2 taps (7 > 6). In "Grammes", after 1 tap (66 > 62).
The overtake banner shows whenever Malik's index < my index and I am not off the board. It is a persistent state, not a one-shot event.
The off-board switch removes "Toi" from the list.
Periods: "Ce soir", "Semaine", "Mois", "Saison", "Depuis toujours", default 0. They change no data.
(d) Motion:
- rows: `transition: top .7s cubic-bezier(.3,.8,.2,1)` (easeReorder 700 ms) and background 300 ms;
- crown `.drop` 700 ms easeOvershoot on the row at index 0, which plays when that row mounts. There is no dedicated leader-change effect beyond that (MOT-13);
- banner fade-in 350 ms;
- live dot pulse 1600 ms.

(e) Copy: "Classement", "en direct", "Ce soir", "Semaine", "Mois", "Saison", "Depuis toujours", "Verres", "Grammes", "Soirées", "Malik vient de te passer devant.", names, "62 g d'alcool" pattern, "6 verres" pattern, "62 g" pattern, "Simuler : Malik prend une pinte vérifiée", "Seuls les verres vérifiés comptent (photo ou pote présent). Ce soir, 3 verres non vérifiés ne sont pas comptés.", "Au-delà de 2 g/L estimés, les verres ne rapportent plus rien.", "Me retirer du classement", "Tu gardes tes stats perso", aria "Hors classement".
(f) Simulated: the demo button (must not ship), instant re-rank on tap, and a hard-coded danger cap of **2 g/L** (RANK-07 says Recon-BAC sets it). Real:
- server-computed ranks per period and metric;
- the overtake animation and "X just overtook you" notification only on the server's answer (SYNC-02);
- the banner as a one-shot event;
- "Soirées" metric data;
- RANK-07's switch to adaptive level 3, which has no screen;
- the RANK-09 feature flag.

The "3 verres non vérifiés" line does not say whose drinks they are.
(g) Levels: none shown. The danger-cap line implies level 3 behaviour that is not designed.

#### Screen 2: "Palmarès"
(a) IDs: RANK-04, RANK-05, RANK-08.
(b) H1. A `grid3` of champion `pan`s (padding 12, gap 4; small period, avatar, h3 name): Semaine Malik (a3), Mois Toi (a1), Saison Inès (a5). A streak `pan` row (flame icon amber). Label "Les autres classements" and 7 rows (category, small winner, h3 value). Label "Réglages du crew" and a switch row.
(c) Secondary boards (category, winner, value):
- "Le plus de soirées", Jade, "14"
- "Premier verre le plus tôt", Malik, "17 h 40"
- "Dernier rentré", Sami, "4 h 12"
- "Le plus de bars dominés", Toi, "3"
- "Le plus de parties gagnées", Inès, "22"
- "Le mieux hydraté", Jade, "1 eau / verre"
- "SAM le plus fiable", Théo, "9 soirées"

This covers all 7 secondary boards that RANK-05 lists.
The crew switch `crew` defaults to on and toggles for anyone. The copy says only the admin can switch it off, but the prototype has no role gate.
(d) Motion: switch 220 ms.
(e) Copy: "Palmarès", "Semaine", "Mois", "Saison", "Malik", "Toi", "Inès", "Malik gagne la semaine pour la 3e fois d'affilée.", "Les autres classements", the rows above, "Réglages du crew", "Classement des verres", "Activé par défaut. Seul l'admin peut le couper.", aria "Classement du crew".
(f) Real: champions computed per period, the streak computed, the admin-only switch (UI gated by role and enforced on the server; RANK-08), and titles tied to N-34 (missing).
(g) Levels: none.

### 2.6 Board "Jeux, catalogue" (`Jeux.dc.html`)

Board IDs: O-44, O-45, O-46, O-48, O-49, O-65, N-24, N-33, AI-03. Canvas 1840 × 1010. Four screens.

Logic class state: `{i:0, mode:0, level:0, rule:0, players:[Hugo, Jade, Malik, Léon(guest)], newP:'', timer:1, crew:true, draft:'', approved:12, queue:[2 items]}`.

#### Screen 1: "Catalogue des jeux"
(a) IDs: O-44, O-48. It also shows a dare of the night, which belongs to JOY-12 on the Soirée board.
(b) Top row: H1 and a small position text "{n} sur {total}". A segmented filter with 3 items. The game card (`.fadein`): radius 26, the game's own background color, dark text, height 380, padding 22, overflow hidden. It holds:
- top row: tags (bg `rgba(30,38,36,.14)`) and, if locked, a dark tag with a lock icon and "4 amis";
- a decorative dice icon 220 px at right -20, top 60, opacity .18 (the same icon on every game);
- the game name as a **numeral 64 px**, and the description below it at margin-top 8;
- bottom row: h3 "{duration}, {players} joueurs" and a dark tag with the phone mode.

Pager row: prev IconButton, dots and next IconButton. Primary full "Jouer" (dice icon), linking to the game board. A dare `pan` row (flame icon amber). Tab bar with Jeux active.
(c) Filter: "Tous", "Un téléphone", "Plusieurs". Picking one resets the index to 0. "Plusieurs" leaves only Dessine vite (1 game).
Prev and next wrap around modulo the filtered list length. Dots: active 18 × 6 amber, others 6 × 6 `#46534F`, radius 3, gap 5, `transition: width .25s` (not a token).
Locked state: `locked = (name === 'Agent double')`. The "Jouer" link stays active while locked.
The 15 games (name, description, duration, players, mode, tags, card color, target board):

| # | Name | Description | Duration | Players | Mode | Tags | Color | Board |
|---|---|---|---|---|---|---|---|---|
| 1 | Le Grand Paquet | "Un paquet qui mélange défis, règles et votes. Fini quand la dernière carte tombe." | 10 à 20 min | 2 à 16 | Un téléphone | Groupe, Défis | `#F4B33D` | JeuxCartes |
| 2 | L'Autoroute | "Cinq péages, une douane au 2e. Parie plus haut ou plus bas." | 10 à 30 min | 2 à 10 | Un téléphone | Stratégie, Bluff | `#9BD8A8` | JeuxCartes |
| 3 | Face-à-face | "Deux joueurs, deux cartes, le plus faible boit." | 5 min | 2 | Un téléphone | Duel | `#FF9C8A` | JeuxCartes |
| 4 | Qui a ? | "Une question, tout le monde désigne quelqu'un." | 10 min | 3 à 12 | Un téléphone | Groupe, Vote | `#8CCBEA` | JeuxCartes |
| 5 | La Bombe | "Une catégorie, un mot chacun, et ça peut sauter à tout moment." | 5 à 15 min | 3 à 12 | Un téléphone | Réflexe | `#FF9C8A` | JeuxAction |
| 6 | La Roulette | "Elle tourne, elle ralentit, elle choisit." | 5 min | 2 à 12 | Un téléphone | Hasard | `#D6C8F2` | JeuxAction |
| 7 | Je n'ai jamais | "Les classiques et ceux du crew." | 10 à 30 min | 3 à 16 | Un téléphone | Groupe, Aveux | `#F2C6A0` | JeuxCartes |
| 8 | Qui de nous deux ? | "Deux potes face au groupe, le groupe tranche." | 10 min | 4 à 12 | Un téléphone | Vote | `#9BD8A8` | JeuxCartes |
| 9 | Action ou vérité | "Trois niveaux, du gentil au très gênant." | 15 à 40 min | 2 à 12 | Un téléphone | Défis | `#F4B33D` | JeuxCartes |
| 10 | Les Mines | "Une grille, quelques pièges. À toi de deviner où." | 5 min | 2 à 8 | Un téléphone | Hasard | `#8CCBEA` | JeuxAction |
| 11 | Le Doigt | "Tout le monde pose un doigt, le téléphone en garde un." | 1 min | 2 à 8 | Un téléphone | Réflexe | `#E8E3D2` | JeuxAction |
| 12 | L'Imposteur | "Un mot secret, un intrus. Discutez, votez." | 10 à 20 min | 4 à 12 | Un téléphone | Bluff | `#D6C8F2` | JeuxAction |
| 13 | Agent double | "Deux infiltrés avec un autre mot. 5 joueurs minimum." | 15 min | 5 à 12 | Un téléphone | Bluff | `#FF9C8A` | JeuxAction |
| 14 | Dessine vite | "Un dessine, les autres devinent sur leur téléphone." | 10 à 20 min | 3 à 8 | Plusieurs téléphones | En ligne | `#9BD8A8` | JeuxAction |
| 15 | Ça grimpe | "La courbe monte. Descends avant le crash." | 5 min | 2 à 10 | Un téléphone | Nerfs | `#F4B33D` | JeuxAction |

(d) Motion: the card fades in (350 ms; in the prototype it plays on mount only) and the dots change width over 250 ms. There is no swipe (O-44 asks for a "swipeable carousel") and no shared-element transition into the game (MOT-05).
(e) Copy: "Jeux", "1 sur 15" pattern, "Tous", "Un téléphone", "Plusieurs", all names, descriptions, durations and tags above, "{durée}, {n} joueurs", "Plusieurs téléphones", "4 amis", aria "Jeu précédent", aria "Jeu suivant", "Jouer", "Défi du soir : le perdant de la prochaine partie choisit la musique pendant 30 min."
(f) Simulated: the shared placeholder illustration, buttons instead of swipe, and the lock flag by name without blocking play. Real:
- swipe carousel with pagination;
- original illustration per game;
- unlock rule computed from the crew (O-48);
- durations computed or justified (see Gaps, G-17).

(g) Levels: none.

#### Screen 2: "Fiche du jeu"
(a) IDs: O-45, O-46, O-49, O-47 (round timer), N-33 (crew cards switch).
(b) Top row: back IconButton, a centered h3 "Le Grand Paquet" and a 44 px spacer. A segmented control with 3 levels. The rules card (`pan.fadein`, min height 150, bg `#F1EEE6`, dark text): small "Règle {n} sur 3", rule text at 18 px weight 650, and a bottom row with a small hint and the small dark button "Suivante". Label "Joueurs, dans l'ordre". Player rows: a drag-handle icon 18 (no drag logic), avatar 32 (font 12), name, and the neutral tag "sans compte" for guests. An add row: input "Prénom" and a primary "+" button. A timer row with a segmented control (width 190). A crew-cards switch row. Primary full "Lancer, {n} joueurs", linking to `JeuxCartes.dc.html`.
(c) Interactions:
- Levels: "Normal", "Difficile", "Extrême", default 0. They change nothing else.
- Rules cycle `(rule + 1) % 3`:
  1. "Chacun pioche à son tour. La carte dit quoi faire."
  2. "Une carte Règle reste active jusqu'à la prochaine carte Règle."
  3. "Une carte Vote : tout le monde désigne quelqu'un en même temps."
- Players by default: Hugo (H, a1), Jade (J, a2), Malik (M, a3), Léon (L, a7, guest).
- `addP`: ignores empty input, appends `[name, first letter uppercased, 'a7', guest:true]` (every added player gets a7 and is a guest), and clears the input.
- Timer: "Off", "30 s", "60 s", default index 1 ("30 s").
- Crew-cards switch defaults to on.
- `playersN` = player count, with no lower-bound check against the game's minimum.

Missing:
- penalty counter (O-49);
- removing a player;
- reordering (handle only);
- a stable avatar color for added players (QOL-11; every guest gets a7).

(d) Motion: the rules card fades in on mount (350 ms). Switch 220 ms.
(e) Copy: aria "Retour", "Le Grand Paquet", "Normal", "Difficile", "Extrême", "Règle 1 sur 3" pattern, the three rules above, "Le bouton ? les remontre en partie.", "Suivante", "Joueurs, dans l'ordre", "Hugo", "Jade", "Malik", "Léon", "sans compte", placeholder "Prénom", aria "Ajouter un joueur", aria "Ajouter", "Minuteur par manche", "Off", "30 s", "60 s", "Ajouter les cartes du crew", "12 cartes validées par l'admin", aria "Cartes du crew", "Lancer, 4 joueurs".
(f) Real: a per-game sheet (only Grand Paquet is drawn), level-filtered decks (O-45, O-65), rules cards at launch plus the "?" mid-game (O-46, on the game boards), player order applied in game, penalty counter, and a minimum player count enforced.
(g) Levels: none.

#### Screen 3: "Cartes du crew"
(a) IDs: N-33, AI-03.
(b) H1. An input row (placeholder "Je n'ai jamais...") with a primary send button. Secondary full "Proposer des cartes à partir de nos blagues (IA)". Label "À valider par l'admin". Queue cards (`pan.fadein`): a top row with the source tag (amber for AI) and the small game name, the card text, and a `grid2` "Refuser" (secondary) / "Valider" (primary). Empty line "Tout est traité." Counter line.
(c) Interactions:
- `submit`: ignores empty input and **prepends** `{text, src:'Toi', game:"Je n'ai jamais"}` (always that game; there is no game picker).
- `gen`: prepends 2 AI proposals on every tap (duplicates on repeat):
  - "Qui de nous deux a déjà dormi au Zinc ?", source "IA, d'après vos phrases cultes", game "Qui de nous deux";
  - "Je n'ai jamais piloté sans permis (Malik)", same source, game "Je n'ai jamais".
- Refuse or approve removes the card from the queue. Approve also adds 1 to `approved` (starts at 12).
- Initial queue:
  - "Je n'ai jamais raté le dernier bus exprès." from "Inès" for "Je n'ai jamais";
  - "Qui de nous deux finit toujours chez Jade ?" from "Malik" for "Qui de nous deux".
- The admin view is not gated by role.

(d) Motion: queue cards fade in (350 ms).
(e) Copy: "Cartes du crew", placeholder "Je n'ai jamais...", aria "Nouvelle carte", aria "Proposer", "Proposer des cartes à partir de nos blagues (IA)", "À valider par l'admin", "Inès", "Malik", "Toi", "IA, d'après vos phrases cultes", "Je n'ai jamais", "Qui de nous deux", the four card texts above, "Refuser", "Valider", "Tout est traité.", "12 cartes validées dans le paquet du crew."
(f) Real:
- submission queued on the server;
- admin-only moderation with a reason sent to the author (COM-08 spirit);
- AI generation opt-in per crew from the crew's quotes, never chat content (MSG-09);
- cost limits;
- admin approval required (AI-03);
- draft kept (QOL-07);
- a game picker.

(g) Levels: none.

#### Screen 4: "Panthéon"
(a) IDs: N-24, O-47 (shareable result card).
(b) H1. Five record rows (trophy icon 20 amber, game name, small record, avatar 32). Label "Dernière partie". An amber-background `pan` (dark text; the small line in `#3A3010`, not a token): small context, H2 result, text, and a small dark "Partager" button (share icon 16). Tab bar with Jeux active.
(c) Records (game, record, initials, avatar):
- "La Roulette", "3 défaites d'affilée", M, a3
- "La Bombe", "Survit 9 manches", I, a5
- "Dessine vite", "Trouvé en 4 s", J, a2
- "Ça grimpe", "Sorti à × 7,4", H, a1
- "Les Mines", "0 piège en 12 cases", T, a4

"Partager" has no handler.
(d) Motion: none.
(e) Copy: "Panthéon", the records above, "Dernière partie", "La Roulette, samedi 22 h 30", "Malik perd 3 manches sur 5", "Record du crew égalé.", "Partager".
(f) Real: records computed from stored game results, a share card exported natively (QOL-06), and the hall of fame on the profile under PROF-02 audiences.
(g) Levels: none.

### 2.7 Gaps

ID accounting: `SCREENS.md` and `FEATURES.md` agree on the lists for all six boards: Recap 10, Radar 10, Messages 9, Bars 30, Classements 8, Jeux 9, so 76 IDs in total. Every ID has at least one element on its board. "Partial" below means part of the `PROMPT.md` requirement has no screen. "Ambiguous" means the prototype allows two readings.

Status per ID:

| ID | Status | What is missing or unclear |
|---|---|---|
| O-41 | partial | No recap archive ("saved and kept"), no group stats, no story card, no recap notification UI on this board; figures inconsistent (G-1). |
| MOT-08 | partial | Curves do not draw, badges fade instead of dropping, venue takeovers not replayed (one timeline line only), no video or image export. |
| RANK-03 | partial | Podium shown; the shareable story card with the podium is not designed. |
| N-21 | partial | Only the photo strip and counts; no album browser and no upload. The drink photo is on the Soirée board. |
| N-22 | partial | No photos or highlights in the timeline. |
| N-23 | partial | Vote only; no way to submit a quote. |
| JOY-09 | ok (static) | Placeholder blocks. |
| AI-02 | partial | No editor behind "Modifier"; a single "Valider" does not show the crew approving; no opt-in control. |
| QOL-20 | **conflict** | Light theme against PROMPT's "dark" (G-2); photos missing. |
| O-84 | partial | Counts only; no viewer; no video playback. |
| N-01 | partial | Time and place editors static; no expiry behaviour. |
| N-02 | partial | No list view of the week, no "this weekend" view; "Chill maison" absent from the calendar; color-only encoding. |
| N-03 | ok | Plural bug at 1 (G-9); create button inert. |
| N-04 | partial | Single choice instead of When2Meet multi-slot; no "plan" option; no closed state. |
| N-05 | partial | Chips static; no slot suggestion shown. |
| N-06 | partial | One switch; no add-event, ICS subscription or reminders. |
| N-31 | ok | Static digest. |
| JOY-06 | ok | Freeze only described in copy. |
| JOY-08 | ok | One milestone. |
| QOL-21 | partial | Birthday prompt shown; one-tap "add party to calendar" is not on this board. |
| MSG-01 | ok | |
| MSG-03 | partial | No video; placeholder photo. |
| MSG-05 | partial | No QR scanning; 30-digit number (A-DESB-7). |
| MSG-06 | ok | |
| MSG-07 | **ambiguous** | Report opens from the info screen, so which message is reported? It should start from a message. |
| MSG-08 | partial | No opt-in or opt-out for the backup, no restore flow. |
| MSG-09 | ok | Note only. |
| MSG-10 | partial | No edit or delete for everyone, no big record button at levels 2 and 3, no offline or failed state, read receipts never displayed, typing switch not wired. |
| ADP-10 | ok | "Envoyer quand même" only deletes in the demo. |
| TER-01 | partial | No area of influence, no live "crew here now" highlight, filters inert. |
| TER-02 | partial | Discovery points missing from the copy; the +3 per check-in is a demo number. |
| TER-03 | missing | One counted check-in per venue per party and the minimum delay are not represented. |
| TER-04 | partial | No history of reigns or their length. |
| TER-05 | partial | Top 3 instead of top 5; no past bosses, no crew's latest nights, no album photos. |
| TER-06 | ok | |
| TER-07 | **ambiguous** | Two rows plus a "Crews" map scope that does nothing; what the map shows in that scope is undefined. |
| TER-08 | partial | No conquest suggestion in "On va où ?". |
| TER-09 | partial | No private toggle at the moment of check-in. |
| N-08 | partial | No address, crew ratings or HQ; only bars (no flats or spots). |
| N-09 | partial | No cocktail or soft drink prices, no history view, no price entry. |
| N-10 | ok | |
| N-11 | partial | Wheel only; no suggestion mode, no vote screen, filters inert; wheel defect (G-3). |
| N-12 | mostly missing | Only popular days. |
| COM-01 | partial | No popular hours; "app users this month" unclear ("214 personnes" has no period). |
| COM-02 | partial | No photos, no "useful" votes, no per-criterion display on a review. |
| COM-03 | ok | One regular. |
| COM-06 | **ambiguous** | Scope "Tout le monde" shows the same pins, bosses and busy labels as the crew scope; the 5-user threshold, rounding and delay are not shown, apart from "Trop peu de check-ins". |
| COM-07 | partial | No official age-policy question, no confidence level. |
| COM-08 | partial | Venue report icon only; no review, photo or profile report here; no block or mute. |
| COM-09 | partial | No RSVP, no event submission. |
| COM-10 | partial | No ranked "nearby" list; the shared want-to-go list is not shown. |
| COM-11 | partial | Label only; no owner replies. |
| AC-02 to AC-05 | ok as signals | See G-4: shown to the user. |
| AC-06 | partial | No "unverified, needs peer confirmation" outcome. |
| MOT-09 | partial | Takeover shown on the check-in screen, not on the map. |
| PROF-04 | **conflict** | Default "Public" (G-5). |
| RANK-01 | partial | Periods do not change data; the "Soirées" metric is a placeholder. |
| RANK-02 | **ambiguous** | A full screen with the Soirée tab active; how it embeds in HUB-01 is not shown here. Overtake shown on tap (G-6). |
| RANK-04 | partial | No titles tied to N-34. |
| RANK-05 | ok | All 7 boards. |
| RANK-06 | ok | |
| RANK-07 | partial | Hard-coded 2 g/L; the switch to level 3 is not designed. |
| RANK-08 | partial | The admin switch is not role-gated in the demo. |
| MOT-13 | partial | No dedicated leader-change effect (the crown drop is tied to the mount of row 0); the podium lives in the Recap board. |
| O-44 | partial | No swipe; placeholder illustration; durations are ranges (G-17). |
| O-45 | ok (selector) | The level does not change content in the demo. |
| O-46 | ok | The "?" itself is on the game boards. |
| O-48 | **ambiguous** | Lock badge "4 amis" on a game whose copy says "5 joueurs minimum"; "Jouer" stays active while locked. |
| O-49 | partial | No penalty counter, no remove, no reorder. |
| O-65 | no screen | Content requirement (500+ cards per language); nothing to show. |
| N-24 | ok | |
| N-33 | partial | No game picker; admin queue not role-gated; no reason on refusal. |
| AI-03 | ok | Duplicates on repeated taps. |

Numbered gaps and conflicts:

- **G-1** Recap figures are not consistent: 41 drinks against 26 in the per-person rows; the podium order does not match the drink counts without an unexplained unverified share; curves for Sami, who is not in the attendee list; no curves for Théo and Nora; "pic moyen 0,74" without a unit. `PROMPT.md` anti-slop says "a displayed number is computed, or it is not displayed".
- **G-2** QOL-20 says the next-morning screen is "calm, dark, low-contrast". The prototype screen and `DESIGN.md` §1 ("Light theme exists for daytime screens (next-morning mode...)") say light.
- **G-3** "On va où ?" wheel: the result formula names the mirrored segment, and the result shows at the tap, not when the wheel stops (see 2.4, screen 4).
- **G-4** The check-in shows the user each anti-cheat signal and its verdict. That leaks the detection model to cheaters, against the AC threat model ("make cheating more trouble than it is worth"). Signals are computed client-side in the demo, while AC-01 says scoring is on the server.
- **G-5** The review audience defaults to "Public". `PROMPT.md` <profiles> says "nothing public until the user turns it on", and PROF-04 says "The default follows the profile setting".
- **G-6** The leaderboard overtake and the check-in takeover play on the tap or on a client timer. SYNC-02 says they play only on the server's answer. The specs must define the pending visual (the prototype has none for these two).
- **G-7** COM-02 requires the "visit date shown" on reviews. PROF-05 forbids dates for strangers in venue history. A named public review with "Visite du 7 juin" puts a dated presence in front of strangers. Needs a rule (see Decisions).
- **G-8** Plural "vous" in a tu app, which the SLOP-04 lint would fail: "L'IA ne lit jamais vos discussions." (Recap), "Demande acceptée, dites bonjour" (Messages), "Vérifiez ensemble si vous voulez être sûrs." (Messages), "Un mot secret, un intrus. Discutez, votez." (Jeux), "IA, d'après vos phrases cultes" (Jeux). These address a group, which is legitimate French, but the lint as written in `PROMPT.md` has no exception.
- **G-9** Plural agreement: "Créer la soirée avec 1 personnes" right after sending (Radar). "{n} joueurs" with n = 1 would read "1 joueurs" (Jeux; there is no minimum check).
- **G-10** The leaderboard danger cap is hard-coded as "Au-delà de 2 g/L estimés" in the copy. RANK-07 says Recon-BAC sets it, so the copy must come from the configured value and the user's unit.
- **G-11** Demo-only controls are drawn as product UI: the segmented "Vrai check-in / Faux GPS", the button "Simuler : Malik prend une pinte vérifiée", and the check-in "Recommencer". They must not ship (PROMPT principle 6). They could move to a QA or chaos menu (SYNC-08).
- **G-12** The Messages info screen is for "Jade" (a direct message), while the conversation above is the crew group "Les Quais". Group info (members, the MLS group, leave, mute) is not designed.
- **G-13** Naming collisions against the glossary:
  - "fil" is used both for the crew feed ("Fil du crew", N-31) and the party timeline ("Le fil de la soirée", N-22);
  - the cheat record is called "tentative de triche" in the text and "Tricheur du week-end" in the tag;
  - the review audience uses "Public", while the profile audience chips (per `SCREENS.md`) use "Tous";
  - the door policy is labelled "La carte d'identité à l'entrée", while the glossary FR term is "contrôle à l'entrée".
- **G-14** Data inconsistency across boards: the boss of Le Zinc is Inès on the map and venue page, Hugo took it in the recap, and the user's title says "Maire du Zinc". La Capsule is ruled by "Toi" on the map but "Crew des Halles tient La Capsule" on the season screen. These are placeholders, but specs must not copy them as rules.
- **G-15** The typing indicator ignores its own switch, and read receipts are never displayed although they have a switch.
- **G-16** The Recap story-progress indicator exists on slide 1 only. Story navigation (tap to advance, hold to pause) is not defined.
- **G-17** Every game card shows a duration range ("10 à 20 min", "15 à 40 min"...). O-44 requires a duration. `PROMPT.md` anti-slop bans "Made-up numbers or round ranges ("5 to 10 min")".
- **G-18** O-48 ("Double Agent unlocks at 4 friends") against O-62 and the card copy ("5 joueurs minimum"): two different thresholds for one game, and the lock does not block play.
- **G-19** RANK-07: crossing the cap must switch the screen to adaptive level 3. Nothing on these boards shows it.
- **G-20** Adaptive levels: none of the six boards shows level 1, 2 or 3 behaviour (only the "niveau 2" tag on a held message). This affects the P0 IDs among them: N-01, N-02, N-03, N-10, N-22, TER-01 to TER-06, TER-09, COM-06, COM-08, AC-02 to AC-06, MOT-08, MOT-09, MOT-13, RANK-01 to RANK-03, RANK-06 to RANK-08, O-41, O-44 to O-46, O-49, O-65.

Token and motion deviations (for the MOTION.md and tokens owners):

- Colors not in `tokens.json`:
  - `#3A4643` (timeline line, my leaderboard row);
  - `#E8D3A4` (amber-tinted sub text);
  - `#F3B9AE` (danger-tinted sub text);
  - `#8E9893` (image placeholder);
  - `#26302D` and `#2B4650` (map);
  - `#2A3431` (calendar "no status");
  - `#3A3010` (text on amber);
  - `rgba(30,38,36,.92)` and `rgba(30,38,36,.14)`.

  From base.css: `#3D4A46` and `#232D2A` (input), `#E3E7E4` (tag text), `#36433F` (skeleton).
- Easings or durations not in tokens:
  - wheel `cubic-bezier(.12,.75,.18,1)`, against easeSpin `(.1,.7,.15,1)`;
  - confetti `cubic-bezier(.3,.6,.4,1)`, which `DESIGN.md` calls easeOut;
  - `.wash` and `.rip` use the CSS keyword `ease-out`, not the easeOut token;
  - dots width 250 ms;
  - leaderboard row background 300 ms;
  - switch track background 200 ms;
  - live dot `ease-in-out` 1600 ms (this one is in `DESIGN.md`).
- Type deviations: H1 at 44 px (Recap 1), 40 px (venue) and 38 px (next morning), where the h1 token is 32. Game names are set in the numeral style (64 px, width 62%, weight 900), which `DESIGN.md` reserves for figures.

### 2.8 Design tells to watch

Against `PROMPT.md` <design_patterns> and <ui_copy>:

1. **Big number + small label grids** (listed tell: "big number + small label landing-page layout"): Recap 1 (three 72 px amber numerals over "présents / verres / pic moyen"), Saison (three 40 px over "bars à toi / visités / à conquérir"), venue prices (three 26 px). These are on-brand per `DESIGN.md` (numerals are the memorable element), but three-up grids are also the "always three" pattern. Vary them by context, and do not make three the default.
2. **Grid of identical cards (icon + title + text)**: the Recap badges (`grid2` of 4 identical `pan`s) and the Palmarès champions (`grid3` of 3 identical `pan`s).
3. **Accent overuse**: the amber game card (Le Grand Paquet, Action ou vérité, Ça grimpe) sits above an amber "Jouer" button; the amber "Dernière partie" card in Panthéon; three amber numerals on Recap 1; amber podium plus crown. `DESIGN.md` says "never two competing amber elements on one screen except the BAC number plus the primary button".
4. **Semantic color misuse**: the danger tint carries a game event ("Malik est à 2 points de te prendre La Capsule."), but `DESIGN.md` reserves danger for danger and SOS. The amber tint carries a security notice (key changed).
5. **Explanatory footnotes everywhere** (listed tell: "no subtitle under every title", "no description under a setting that repeats its name"):
   - "Les statuts disparaissent seuls le lendemain matin."
   - "Un résumé par soirée au lieu d'une notif par événement."
   - "Sert à proposer les bons créneaux au crew."
   - "Écran plus doux le matin. La notif du récap attend 11 h."
   - "Photo chiffrée sur ton téléphone avant l'envoi"
   - "Le serveur décide. Position, cohérence du trajet, potes présents et intégrité du téléphone sont croisés."
   - "Seulement les gens vraiment présents, amis ou pas."
   - "La recherche se fait sur ton téléphone. Le serveur ne peut pas lire tes messages."
   - "Le bouton ? les remontre en partie."

   Several read as designer annotations rather than UI copy. Each needs a "first use only, then never again" or a "delete" decision.
6. **Same placeholder illustration on 15 game cards** (a 220 px dice icon at 18% opacity). O-44 needs a real illustration per game. The listed tells are "illustrations made of generic shapes" and "grids of identical cards".
7. **Text glyphs as status icons**: "✓", "✗" and "?" in the check-in list and "envoyé ✓". `DESIGN.md` §7 asks for the custom stroke icon set.
8. **Pulsing live dot** on "en direct": allowed only while something is really live (`DESIGN.md` motion table). The spec must tie it to a real live state.
9. **Copy to review for slop and tone**:
   - "Nouveau téléphone, sûrement." is a guess the app cannot verify, in a security notice that should be plain (<ui_copy>: SOS, errors and security are plain);
   - "ramenait tout le monde à bon port" is a stock phrase in the Épique story;
   - every recap story is the same length;
   - "Tu nous remercieras plus tard." is fine as humour but sits on a safety screen.
10. **Emoji**: participant reactions (😵 🏎️ 💧 👑 🚗 👋), chat reactions and feed reactions are user content, which is allowed. The recap emoji per person appears system-assigned, so the spec must say whether the crew picks it (O-41 says "emoji reaction").
11. **Fake ranges**: game durations (G-17).

### 2.9 Privacy check (COM-06, PROF-05, TER-09, MSG rules)

1. **Map scope "Tout le monde"** (COM-06, PROF-05): the prototype shows the same pins, boss initials, crowns and busy labels in every scope. Bosses are crew-internal data. For strangers, the public scope must show only aggregated venue data ("how busy tonight" levels, counts at 5 or more users, rounded and delayed), never a member's initials or boss status, unless that member is a public regular under COM-03 and PROF-09.
2. **"Mes potes" filter** (N-07, TER-09): shows where friends are now. It must be fed only by check-ins (TER-09) or by opted-in live location during a party (N-07), for friends only, and it must be absent from the public scope.
3. **Busy labels and counts**: "Blindé ce soir", "D'après les check-ins de 214 personnes. Ce soir : blindé.", "41 personnes de l'app" (event RSVP). The prototype shows "Trop peu de check-ins" below the threshold, which is good. The spec must still define the threshold (at least 5), the rounding and the delay. RSVP counts are future intent, not presence, and are fine.
4. **Review visit date** (COM-02 against PROF-05): see G-7. Proposed rule in Decisions.
5. **Review default "Public"** (PROF-04, profile defaults): see G-5.
6. **Crew feed** shows "Jade a noté La Capsule 4 sur 5": the feed must respect the review's audience (PROF-04). A review marked "Moi" must not appear.
7. **Recap sharing outside the group** (PROF-05: "shared albums" never shown to strangers):
   - "Partager en story" and the photo booth ("ready for stories", JOY-09) push group-private photos, names, other people's BAC curves and the venue and time of the night to Instagram, Snapchat and similar apps;
   - the prototype only has the crew validating the AI text;
   - the spec needs a rule on what the exported story may contain (e.g. no other person's BAC or curve, no photo of someone who did not agree) and who approves it.
8. **Check-in signals** reveal "Jade est là aussi (Bluetooth)". That is fine inside the crew. The verdict detail is a security issue (G-4), not a privacy one.
9. **Cheat mark** "tentative de triche sur ton profil pendant 7 jours": AC-09 says visible to the crew. The spec must make the profile item crew-only, never part of the public profile (PROF-02 sections).
10. **Leaderboard grams and drinks per person**: crew-only, never public (COM-03), behind the RANK-09 flag. The prototype is consistent.
11. **Messages**:
    - the in-app chat list shows a decrypted preview, which is fine on device;
    - the report sheet text matches MSG-07 ("Ton téléphone déchiffre ce message et les 3 autour, puis les envoie à la modération. Personne d'autre ne les voit.");
    - AI cards use "phrases cultes" (quotes of the night, N-23), not chat content, which is consistent with MSG-09. If quotes can be created from a chat message, that path must stay on device or be excluded from AI-03 input;
    - the passphrase reveal screen must be hidden from the app-switcher snapshot (SEC-05).
12. **Radar statuses and places** ("Au Zinc vers 21 h"): live status is never shown to strangers (PROF-05). Radar is crew-only in the prototype. The API must not expose N-01 outside the crew (PROF-08).
13. **Territory opt-out** (TER-09): the switches exist (participate, private check-in by default). Two items are missing: a per-check-in private option, and what an opted-out member looks like on other members' maps.

---

## 3. Decisions proposed

1. **QOL-20 theme.** Follow the approved design (light, calm, low contrast) and record it in an ADR. Also ask the user to confirm, because `PROMPT.md` says "dark" explicitly. Reason: the prototype was validated by the user and `DESIGN.md` is explicit. It's the only real conflict in tone between the two sources.
2. **Wheel.** Compute the venue from the final resting angle (`segment = floor(((360 - rot % 360) % 360) / segmentAngle)`). Reveal the result on stop, add haptic ticks per segment, and disable "Tourner" while spinning. Reason: G-3.
3. **Check-in feedback.** While waiting for the server, show neutral progress ("Vérification..."-style steps without verdicts). On acceptance, show the takeover from the server's verdict. On rejection, show the reason in one plain line (the `DESIGN.md` voice sample: "Check-in refusé : position simulée. Aucun point.") without per-signal detail. Add the "unverified" outcome: "Un pote présent doit confirmer". Reason: G-4, AC-06, SYNC-02.
4. **Review audience default** = the user's "reviews" section audience (Friends for a new account). Reason: G-5, PROF-04.
5. **Visit date on reviews.** Show the month only ("juin 2026") to strangers, and the exact date to friends. Reason: it satisfies COM-02 (a visit date is shown) and PROF-05 (no exact dates for strangers). Recon-Community should confirm against the French rules on online reviews (the date-of-experience requirement).
6. **Story export.** Exports carry only the exporting user's own curve and figures plus crew-level totals. Other people's photos or names appear only if they allowed it in their settings or approved that recap. Reason: privacy item 7.
7. **Game durations.** Show the crew's median play time once 3 or more games of that type have been recorded. Before that, show one declared typical length per game (one number, not a range), with the source in the content file. Reason: G-17. It needs an ADR, since O-44 asks for a duration and anti-slop bans invented ranges.
8. **French plural "vous".** Rewrite to tu where one person is addressed (e.g. the key notice). For strings that address a group (game rules, "dites bonjour"), allow plural vous through a reviewed allowlist in the SLOP-04 lint. Reason: G-8. The lint must stay strict for everything else.
9. **Demo controls.** Remove from product UI, and move them to a debug-only QA or chaos panel (SYNC-08). Reason: G-11.
10. **Danger cap copy.** Generate it from the remote-config threshold, in the user's BAC unit. Reason: G-10.
11. **Threat alert color.** Use the amber tint, not danger, for game events. Reason: `DESIGN.md` §1 semantic colors.
12. **Single-word glossary fixes.** Use "fil" only for the party timeline and "activité du crew" (or similar) for N-31. Use "tentative de triche" everywhere and drop the "Tricheur du week-end" name or define it as a separate badge. Use one FR word for `Audience.everyone`, and one FR label for `DoorPolicy`. Reason: G-13.
13. **Admin-only controls** (crew leaderboard switch, crew-card queue) are role-gated in the UI and enforced on the server. Reason: RANK-08, N-33, SEC-02.

---

## 4. Assumptions

- **A-DESB-1** "Toi" is Hugo. Based on: the Classements data `['Toi','H','a1']`, the Bars season row with avatar H a1 for "Toi", and the Recap podium avatar H. Verify: confirm with the designer, or simply treat "Toi" as the current user in specs.
- **A-DESB-2** Calendar code `x` (`#2A3431`) means "no status set". Based on: it has no legend entry and is the darkest tone. Verify: with the designer. The spec must also give "Chill maison" a value.
- **A-DESB-3** The Recap curve values and "pic moyen 0,74" are in g/L of blood. Based on: the legal line at y = 120 maps to about 0.53, close to the French 0.5 g/L limit. Verify: Recon-BAC sets the display unit per PREF-02.
- **A-DESB-4** In "Je sors, qui vient ?", a time reply ("Vers 22 h") counts as yes. Based on: `yesCount` counts every reply with a non-empty tint. Verify: in the N-03 spec.
- **A-DESB-5** The poll bar denominator of 8 is the number of voters in the demo. Based on: `round(v/8·100)`. Verify: the real denominator is the number of invited people or of voters (to decide in N-04).
- **A-DESB-6** One check-in worth +3 points is a demo number, not a scoring rule. Based on: 16 → 19 between the venue page and the check-in screen. Verify: the TER-02 and AC-01 scoring spec.
- **A-DESB-7** The 30-digit safety number is a placeholder. Based on: libsignal safety numbers are 60 digits (12 groups of 5). That is general knowledge, not from the repo files; Recon-Security should confirm against the libsignal docs.
- **A-DESB-8** The 900 ms message send delay mirrors the app-wide fake server delay. Based on: `design/prototype/README.md` ("around 900 ms").
- **A-DESB-9** "7 jours" for the cheat mark and "J-5" / "5 jours" for the season end are product values shown in the design, not placeholders. Based on: they are consistent across screens. Verify: the AC-09 and TER-04 specs.

---

## 5. Scope changes

- **Proposed N-36 [P1] Consent for exports outside the crew**: before a recap story, photo strip or result card leaves the app, the people shown can opt out and the exporter's card shows only what is allowed. Reason: privacy item 7. PROMPT has share requirements (QOL-06, JOY-09, MOT-08) but no consent rule.
- **Proposed MSG-11 [P1] Group conversation info**: members, roles, leave, mute, group key state. Reason: G-12. MSG-01 creates group chats, but no ID covers their settings screen.
- **Change O-48**: clarify the unlock as a crew-size condition (4 friends in the crew) distinct from the minimum players at the table (O-62: 5). Reason: G-18.
- **Change QOL-20**: align the wording with the approved light morning theme, if the user confirms Decision 1.
- **Change COM-02**: specify the date granularity per viewer (Decision 5).
- **Change RANK-07**: make its copy derive from the configured threshold (Decision 10).

---

## 6. Glossary additions

| Concept | Code / EN UI | FR UI (as in the prototype) |
|---|---|---|
| Monthly territory period | `Season` / season | saison |
| Loss of a venue to another member | `VenueTakeover` / takeover | prise de bar |
| Points toward ruling a venue | `RulePoints` / points | points |
| Earned name tied to venues or seasons | `Title` / title | titre |
| Venue no crew member has visited | `UnvisitedVenue` / to conquer | à conquérir, jamais visité |
| Aggregated crowd level | `BusyLevel` / busy | (labels: "Blindé", "Animé", "Calme") |
| Crew-written game card | `CrewCard` / crew card | carte du crew |
| Game records board | `HallOfFame` / hall of fame | Panthéon |
| Voted line of a party | `NightQuote` / quote of the night | phrase de la nuit |
| Chronological party events | `PartyTimeline` / timeline | fil de la soirée |
| Crew activity digest | `CrewFeed` / crew feed | fil du crew (collides with the line above, see G-13) |
| Photo strip from the album | `PhotoStrip` / photo booth | photomaton |
| AI-written recap | `NarratedRecap` / narrated recap | récap raconté |
| Morning-after screen state | `MorningMode` / morning mode | mode lendemain |
| Consecutive weeks out together | `CrewStreak` / streak | série |
| Count-based celebration of nights | `Milestone` / milestone | (no term; "50e soirée ensemble") |
| "I'm going out, who's in?" broadcast | `GoingOutCall` / who's in | Je sors, qui vient ? |
| Outing poll | `OutingPoll` / poll | sondage de sortie |
| Usual nights out | `RecurringAvailability` / usual nights | soirs habituels |
| Message held by the drunk-text guard | `HeldMessage` / held message | message retenu |
| Key fingerprint shown for verification | `SafetyNumber` / safety number | clé de sécurité |
| Per-conversation expiry | `DisappearingMessages` / disappearing messages | messages éphémères |
| Backup secret | `RecoveryPassphrase` / recovery phrase | phrase (de sauvegarde) |
| Rejected event recorded as cheating | `CheatAttempt` / cheat attempt | tentative de triche |
| Player without an account | `GuestPlayer` / guest | sans compte |
| Per-round countdown | `RoundTimer` / round timer | minuteur par manche |
| Game difficulty | `GameLevel` (normal, hard, extreme) | Normal, Difficile, Extrême |
| Nightly dare | `NightDare` / dare of the night | défi du soir |

---

## 7. Blockers

None. Everything in this report can be decided by the orchestrator, except Decision 1 (QOL-20 theme), which should be confirmed with the user because it contradicts `PROMPT.md` in plain words.

---

## 8. Sources

All local files, read on 2026-10-26. No web source was used. A-DESB-7 relies on general knowledge, marked as such.

- `C:\Users\aubin\Documents\soiree-crew\PROMPT.md` (<mission>, <operating_principles>, <glossary>, <design_reference>, <scope> in full, <drunk_mode>, <motion>, <quality_bars> including <anti_slop> and <sync_and_feedback>)
- `C:\Users\aubin\Documents\soiree-crew\design\DESIGN.md`
- `C:\Users\aubin\Documents\soiree-crew\design\SCREENS.md`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\README.md`
- `C:\Users\aubin\Documents\soiree-crew\design\tokens.json`
- `C:\Users\aubin\Documents\soiree-crew\design\base.css`
- `C:\Users\aubin\Documents\soiree-crew\research\README.md`
- `C:\Users\aubin\Documents\soiree-crew\FEATURES.md` (ID to board map)
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Main.dc.html` (spot check of the ID map format)
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Recap.dc.html`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Radar.dc.html`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Messages.dc.html`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Bars.dc.html`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Classements.dc.html`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Jeux.dc.html`
