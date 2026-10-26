# Recon-Design, part C: prototype extraction for 7 boards

Boards covered: `JeuxCartes.dc.html`, `JeuxAction.dc.html`, `Bar.dc.html`, `Argent.dc.html`, `Profil.dc.html`, `Reglages.dc.html`, `Etats.dc.html` (all in `design/prototype/`). Also `design/icons.json`.

Conventions in this report:
- Quoted UI copy is verbatim, French, straight apostrophes as in the source. `{x}` marks a value computed by the logic class.
- "Logic" = the `class Component extends DCLogic` block at the bottom of each file.
- Every board embeds the same CSS, byte for byte identical to `design/base.css` (checked with `diff`). Class names below (`pan`, `row`, `seg`, `tile`, `sheet`, `toast`, `sw`, `fab`, `bar`, `tag`, `chip`, `ib`, `btn`, `btn g/o/d/w2/sm`) refer to that file and to `DESIGN.md` § 4.
- Phone frame: 390 × 844, content area `.sc` padding 58 / 20 / 22, gap 16.
- Global Reduce Motion rule in the CSS: `@media (prefers-reduced-motion:reduce)` sets every animation and transition to 0.01 ms and 1 iteration. No board defines a fade fallback of its own.
- No board in this set shows haptics (web prototype). Haptic mapping comes from `DESIGN.md` § 5 only.
- No board in this set shows an adaptive UI level variant (levels 1 to 3). Section (g) of each screen says what `PROMPT.md` requires instead.

---

## 1. Summary

1. Every ID that `SCREENS.md` and `FEATURES.md` assign to these 7 boards is accounted for (82 IDs, table in § 2.8). The two files agree exactly for these boards.
2. Games: O-32 (floating add-drink button "in every game") and O-46 ("?" rules button mid-game) are only partly shown. The FAB exists on 3 of the 7 card games and on none of the 7 action games; the "?" button exists on all card games and on none of the action games.
3. Game levels have three different naming sets: catalogue `Normal / Difficile / Extrême` (Jeux board), Je n'ai jamais `Gentil / Piquant / Sans filtre`, Action ou vérité `Gentil / Piquant / Extrême`. O-45 says Normal, Hard, Extreme.
4. The prototype has demo bugs that must not be copied as rules: the Roulette shows its result at the tap, before the 4 s spin ends; L'Autoroute shows the same card in both slots after a play; Les Mines can place two mines on the same cell after "Nouvelle grille"; Le Doigt names the chosen player by finger order (impossible with real multi-touch); the Agent double card turns coral for agents, which tells them their role.
5. Le Doigt allows 6 fingers, the catalogue says "2 à 8" players. Les Mines rotates 4 names, catalogue says "2 à 8". L'Imposteur plays 6 players fixed.
6. "Ça grimpe" (O-64, S2M's "La Courbe") is designed as a crash game. Its copy "Plus tu restes, plus ça rapporte" promises a reward that no rule computes; only the players still in at the crash drink.
7. Profile visibility is modelled as a linear scale `Moi < Crews < Amis < Tous` (a viewer sees a section when its level is at or above the viewer's need: crew 1, friend 2, stranger 3). So "Amis" is also visible to crew members, and "Crews" is hidden from non-crew friends. `PROMPT.md` lists the four audiences without saying they nest.
8. Profile sections in the prototype: 6 (Bars, Avis, Boissons préférées, Records, Soirées, Jeux). PROF-02 requires 10 (identity, crews, titles and badges, member card are missing). There is no UI to hide one item (PROF-03), only "Remontrer". "Mon profil" has no link to "Voir comme" or "Qui voit quoi" (PROF-07, PROF-10).
9. Strangers always see "Ton prénom, ta photo" in the prototype, while PROF-02 puts identity under its own audience (default Friends) and the stranger profile shown uses a handle (`@nora.ln`).
10. Etats: error toasts close with a button labelled "OK". SYNC-03 asks for "Retry" when it makes sense and DESIGN.md asks for verbs that name the action. Several screens across the boards change state instantly with no pending state (Argent, Profil, Reglages): spec writers must apply SYNC-01 to 07 there even though the prototype does not show it.
11. Several designer annotations are written as UI text and must not ship (list in § 2.11).

---

## 2. Findings

### 2.1 Board "Jeux de cartes" (`JeuxCartes.dc.html`)

Board IDs (SCREENS.md and FEATURES.md agree): O-50, O-51, O-52, O-53, O-56, O-57, O-58, O-32, O-47, MOT-06.

Shared elements of this board:
- Header row `.top`: back icon button (`ib`, icon `back`, label "Retour", link to `Jeux.dc.html`), game name in `h3`, rules button (`ib`, text "?" in `h3`, aria-label "Règles").
- Rules sheet (all 7 screens): `dim` scrim + `sheet` (slide up 320 ms `easeOut`), `grab` handle, title "Règles" (`h2`), rule text (`p`), full-width primary button "Reprendre". Opening and closing toggle the same state key (`rules`: one sheet open at a time across the board).
- FAB (`fab`, 56 px amber, icon `glass`, aria-label "Ajouter un verre sans quitter la partie"): present on screens 1 (Grand Paquet), 2 (Autoroute), 5 (Je n'ai jamais). Absent on screens 3, 4, 6, 7.
- FAB handler: sets `dt:true`, then `dt:false` after **2200 ms** (clears any previous timer). The toast it drives is only rendered on screen 1: toast at `bottom: 40px`, text "Pinte ajoutée, la partie continue". On screens 2 and 5 the FAB fires the same state but nothing is visible there.
- Round timer: `componentDidMount` runs an interval every **1000 ms**: `timer = timer <= 0 ? 100 : timer - 5`. The bar is only rendered on screen 1.
- Demo players: `Hugo, Jade, Malik, Léon` (Grand Paquet), 6 tiles `Hugo a1, Jade a2, Malik a3, Inès a5, Théo a4, Léon a7` (Qui a ?), `Jade a2 / Malik a3` (Face-à-face, Qui de nous deux), static "Au tour d'Inès" (Action ou vérité).
- Animation alternation: content re-mounts its pop animation by toggling the class between `pop1` and `pop2` (both are the same keyframe: scale .7 → 1.08 at 60% → 1, 350 ms `cubic-bezier(.2,.8,.2,1)`).

#### Screen 1. "Le Grand Paquet"
(a) IDs: O-50, O-32, O-46, O-47 (round timer).
(b) Layout, top to bottom: header (back, "Le Grand Paquet", "?"); round timer bar (`bar` 8 px, fill `#8CCBEA`, width transition `1s linear`); row "Au tour de **{who}**" left, "{left} cartes" right (`s`); the card: a full-width unstyled button, height 430, aria-label "Piocher", containing a block radius 24, background `#F1EEE6`, text `#1E2624`, padding 24, column space-between: type tag (tag background = card colour, text `#1E2624`), card text (26 px, weight 750, line-height 1.2, `font-stretch: 85%`), footer "Touche pour piocher" (`s`, colour `#4F5A55`). FAB bottom right; toast; rules sheet.
(c) States and interactions:
- State `p1` = number of cards drawn (starts 0). `who = ['Hugo','Jade','Malik','Léon'][p1 % 4]`. `left = 52 - p1` (no floor: goes negative after 52 draws; the game never ends in the prototype).
- Deck of 6 cards, cycled with `p1 % 6`:
  1. Défi, `#F4B33D`: "Imite le serveur jusqu'à ton prochain tour."
  2. Règle, `#8CCBEA`: "Interdit de dire « verre ». Chaque oubli coûte une gorgée."
  3. Vote, `#9BD8A8`: "Qui finira le plus tard ce soir ? Le plus désigné boit 2 gorgées."
  4. Mini-jeu, `#D6C8F2`: "Pierre-feuille-ciseaux avec ton voisin de gauche. Le perdant boit."
  5. Défi, `#F4B33D`: "Raconte ta pire gueule de bois en 20 secondes chrono."
  6. Vote, `#9BD8A8`: "Qui envoie les pires messages à 3 h ? Le plus désigné boit."
- Tap on the card: `p1 + 1`, toggles pop class. The first card is visible before any tap (card 1 for Hugo).
- Timer: 100 → 0 by 5 every second (20 s), shows empty for one tick, then jumps back to 100 (21 s cycle). Nothing happens when it reaches 0.
(d) Motion: card pop 350 ms `easeOut` (scale .7 → 1.08 → 1) on each draw; timer bar width `1s linear`; toast in 280 ms (`tin`: translateY 14 px → 0, opacity 0 → 1); sheet 320 ms. No 3D flip, deal or swipe on this screen.
(e) Copy: "Le Grand Paquet", "Au tour de", "{n} cartes", "Touche pour piocher", "Pinte ajoutée, la partie continue", "Règles", "Reprendre", card types "Défi", "Règle", "Vote", "Mini-jeu" and the 6 card texts above. Rules text: "Chacun pioche à son tour. Défi : tu le fais ou tu bois 2 gorgées. Règle : elle reste jusqu'à la prochaine carte Règle. Vote : tout le monde désigne en même temps. La partie s'arrête à la dernière carte."
(f) Simulated: a 6-card loop stands for a deck; the remaining count is fake; the drink FAB only shows a toast (no drink logged, no pending state); the timer has no consequence. Real: a shuffled finite deck from the content files (O-65, 500+ cards per language), end of game at the last card (O-50), turn order from the player list (O-49), the FAB opens the real quick-add with SYNC behaviour, active "Règle" cards tracked until the next Règle card (stated in the rules, not shown).
(g) Levels: not shown.

#### Screen 2. "L'Autoroute"
(a) IDs: O-51, O-32, O-46, O-49 (penalty counter).
(b) Layout: header; 5 checkpoint chips in a row (gap 6, each flex 1, height 44, radius 10, weight 800, 13 px); message `p`; two cards side by side (`card3d`, row height 300, gap 14, each 150 × 220, radius 18): current card (background `#F1EEE6`, numeral 80 px + suit `h3`) and next card (background and colour computed, class = pop toggle); either the customs buttons (grid2: "Rouge" `btn d`, "Noir" `btn g`) or the road buttons (grid2: "Plus haut" primary with icon `arrowup`, "Plus bas" `btn g` with icon `arrowdn`); "Pénalités : {pen}" (`s`); FAB; rules sheet.
(c) States and interactions:
- Initial state: `step 0, cur 7, cs 0 (♥), next null, pen 0`, message "Péage 1 : la prochaine carte est plus haute ou plus basse que 7 ?".
- Checkpoint chips: labels `P1, Douane, P3, P4, P5` (index 1 is labelled "Douane"). Background: passed (`i < step`) `#9BD8A8`, current (`i === step`) `#F4B33D`, future `#34403C`. Text `#1E2624` when `i <= step`, else `#C9D0CC`.
- Customs buttons shown only when `step === 1`; road buttons otherwise.
- Each guess draws `nv = 1 + floor(random × 13)` (1 to 13, uniform, with replacement: not a real 52-card deck) and `ns = floor(random × 4)` (suit index into `['♥','♠','♦','♣']`).
- Win test: "Plus haut" wins only if `nv > cur`; "Plus bas" only if `nv < cur` (a tie loses); customs: "Rouge" wins if the suit is ♥ or ♦ (indices 0 and 2), "Noir" otherwise.
- On a win: `step + 1`. On a loss: `step = 0`, `pen + 1`. When `step` reaches 5, the message says the road is done and `step` resets to 0 (a new road starts silently, penalties are kept).
- After every guess, both `cur` and `next` become the drawn card (the two cards show the same value: demo flaw; the intent is previous vs drawn).
- Labels: 1 → "A", 11 → "V", 12 → "D", 13 → "R", others as digits. Red suits drawn in `#C2412E` (not a token), black in `#1E2624`. Next card before the first guess: "?" on `#34403C` in `#F1EEE6`.
- Messages: win and `step >= 5`: "Arrivé au bout de l'autoroute. Bien joué."; win and `step === 1`: "Douane au péage 2 : rouge ou noir ?"; other win: "Péage {step+1} : plus haut ou plus bas que {label} ?"; loss: "Raté. Une gorgée, et retour au péage 1."
(d) Motion: next card pop (350 ms) on each guess; no flip although the container has `card3d`. No trembling before a penalty (MOT-06 asks for it).
(e) Copy: "L'Autoroute", "Douane", "P1", "P3", "P4", "P5", "Rouge", "Noir", "Plus haut", "Plus bas", "Pénalités : {n}", the messages above. Rules: "Cinq péages. Devine si la carte suivante est plus haute ou plus basse. Au péage 2, la douane : rouge ou noir. Une erreur, une gorgée et retour au début."
(f) Simulated: one player only, no turn rotation, random values with replacement, no end screen. Real: 2 to 10 players (catalogue), a real deck, per-player penalty count, a result card at the end (O-47), "finish with as few penalties as possible" (O-51).
(g) Levels: not shown.

#### Screen 3. "Face-à-face"
(a) IDs: O-52, O-46, MOT-06 (3D flip).
(b) Layout: header; top player block rotated 180° (for the player across the table): name "Jade" (`h3`) + card; result line (`h2`, centred, min-height 28); bottom player block: card + name "Malik"; full-width primary button. Each card: `card3d` 150 × 200 containing `flip` (front and back faces, radius 22, padding 22). Back face colours: Jade `#F4B33D`, Malik `#9BD8A8`, both with the `dice` icon at 60 px. Front: `#F1EEE6`, numeral 84 px. No FAB on this screen.
(c) States and interactions:
- Initial: `on false, a 9 (Jade), b 4 (Malik)`. Button "Retourner".
- Tap "Retourner": `on = true`, both cards flip together. Button becomes "Nouvelle manche".
- Result: `a === b` → "Égalité, trinquez"; else the lower value's name + " boit " + `|a - b|` + " gorgées" (no singular: a difference of 1 gives "1 gorgées").
- Tap "Nouvelle manche": `on = false` and new values `1 + floor(random × 13)` for both, set at the same time as the flip back (the new front value is visible while the card turns away).
- Values are shown as raw numbers 1 to 13 (no A/V/D/R, no suit), unlike L'Autoroute.
(d) Motion: 3D flip `rotateY(180deg)`, 550 ms `cubic-bezier(.3,.7,.2,1)` (`easeFlip`), perspective 900 px, backface hidden.
(e) Copy: "Face-à-face", "Jade", "Malik", "Retourner", "Nouvelle manche", "Égalité, trinquez", "{nom} boit {n} gorgées". Rules: "Chacun retourne sa carte. La plus faible boit autant de gorgées que l'écart. Égalité : vous trinquez."
(f) Simulated: fixed names, random values. Real: the two players picked from the player list (O-49), plural handling, values set before the flip back starts or after it ends.
(g) Levels: not shown.

#### Screen 4. "Qui a ?"
(a) IDs: O-53, O-46.
(b) Layout: header; question card (`pan`, background `#8CCBEA`, text `#1E2624`, min-height 170, centred): prefix "Qui a déjà..." (`s`, colour `#1E3A48`) + question (26 px, weight 750); instruction (`s`); grid3 of 6 player tiles (`tile`, centred, avatar 38 + name, `on` = inverted); result line (`h3`, `fadein`); grid2: "Question suivante" (`btn g`), "Valider" (primary). No FAB.
(c) States and interactions:
- Questions, cycled with `q % 4`: "dormi dans un bar ?", "raté un train à cause d'une soirée ?", "envoyé un message à son ex à 3 h ?", "perdu ses clés en rentrant ?".
- Tap a tile: toggles that person in `sel`, clears the result.
- "Valider": counts selected people. `c > 1` → "{c} personnes boivent une gorgée."; `c === 1` → "1 personne boit une gorgée."; `c === 0` → "Personne ? Vraiment ?".
- "Question suivante": next question, selection and result cleared.
(d) Motion: result line `fadein` (350 ms, translateY 14 → 0 + opacity). Tile state switch has no transition.
(e) Copy: "Qui a ?", "Qui a déjà...", "Touchez ceux qui l'ont fait.", "Question suivante", "Valider", results above. Rules: "Une question. Le téléphone tourne, chacun avoue en se touchant. Ceux qui l'ont fait boivent une gorgée."
(f) Simulated: one phone, someone taps for everyone. The rules text ("le téléphone tourne, chacun avoue") and the UI (one person taps every name) describe two different flows. Real rules are to be researched by the game's subagent (PROMPT, O-53 note).
(g) Levels: not shown.

#### Screen 5. "Je n'ai jamais"
(a) IDs: O-56, O-46, O-32, N-33 (crew-card source tag, shown here as "Carte du crew").
(b) Layout: header; segmented control with 3 levels; card (height 380, radius 24, background `#F2C6A0`, text `#1E2624`, padding 24, column space-between): source tag (background `rgba(30,38,36,.14)`), block with "Je n'ai jamais..." (`s`, `#5A4632`) + card text (28 px, weight 750, `font-stretch 85%`), footer "Ceux qui l'ont fait boivent une gorgée." (`s`, `#5A4632`); full-width "Suivante"; FAB.
(c) States and interactions:
- Levels: "Gentil" (index 0, default), "Piquant", "Sans filtre". Picking a level resets the index to 0 and pops the card.
- Cards per level (cycled with `i % length`):
  - Gentil: "Commandé un plat juste pour la photo." (Classique), "Dansé seul sans musique." (Classique), "Oublié le prénom de quelqu'un en plein milieu de la soirée." (Carte du crew).
  - Piquant: "Menti pour sortir plus tôt du taf." (Classique), "Fait semblant de connaître une chanson entière." (Classique).
  - Sans filtre: "Envoyé une capture à la mauvaise personne." (Classique), "Dormi chez quelqu'un dont je ne connaissais pas le nom de famille." (Classique).
- "Suivante": `i + 1`, pop.
(d) Motion: card pop 350 ms on next and on level change.
(e) Copy: "Je n'ai jamais", "Gentil", "Piquant", "Sans filtre", "Classique", "Carte du crew", "Je n'ai jamais...", "Ceux qui l'ont fait boivent une gorgée.", "Suivante", card texts above. Rules: "Lis la carte à voix haute. Ceux qui l'ont déjà fait boivent une gorgée. Les cartes du crew se glissent dans le paquet."
(f) Simulated: 7 cards total. Real: 500+ cards per language (O-65), crew cards from the moderated queue (N-33), "unfiltered mode" = "Sans filtre" (O-56).
(g) Levels: not shown (the segmented control is the game difficulty, not the adaptive UI level).

#### Screen 6. "Qui de nous deux ?"
(a) IDs: O-57, O-46.
(b) Layout: header; question (`p` at 24 px, weight 750); grid2 of two tall tiles (min-height 170, centred, gap 10): avatar 64 px (Jade `a2` "J", Malik `a3` "M", 24 px initial), name `h3`, vote count (numeral 34 px, amber); split bar (`bar` 14 px, amber fill, width `a / (a + b) × 100`, 50 when no votes, transition 600 ms `easeOut`); status line `s`; full-width "Question suivante". No FAB.
(c) States and interactions:
- Question = "Qui de nous deux " + one of: "finit toujours la soirée en cuisine ?", "répond le plus vite à « on sort ? » ?", "a le pire goût musical ?" (cycled `q % 3`).
- Tap a tile: +1 vote for that person, no limit (one person can tap many times).
- Status: no votes → "Chacun vote en touchant un nom."; tie → "Égalité pour l'instant."; else "{leader} mène. Il boit à la fin du vote." ("Il" also when the leader is Jade).
- "Question suivante": next question, votes reset to 0 / 0.
(d) Motion: bar width 600 ms `cubic-bezier(.2,.8,.2,1)`.
(e) Copy: "Qui de nous deux ?", questions above, "Jade", "Malik", "Chacun vote en touchant un nom.", "Égalité pour l'instant.", "{nom} mène. Il boit à la fin du vote.", "Question suivante". Rules: "Deux joueurs, une question. Le groupe vote. Celui qui récolte le plus de votes boit."
(f) Simulated: unlimited taps, no end of vote, fixed pair. Real: one vote per player (pass-the-phone or one per phone), an explicit end of vote, the pair drawn from the player list, gender-neutral result line.
(g) Levels: not shown.

#### Screen 7. "Action ou vérité"
(a) IDs: O-58, O-46, MOT-06 (flip).
(b) Layout: header; segmented control with 3 levels; "Au tour d'Inès" (`p`, static); flip card (`card3d`, height 380): front face `#34403C` centred column "Action" (numeral 54 px), "ou" (`s`), "Vérité" (numeral 54 px); back face (background `#F4B33D` for Action, `#8CCBEA` for Vérité, text `#1E2624`): kind tag (`rgba(30,38,36,.14)`), prompt (26 px, weight 750), footer "Refuser coûte 2 gorgées." (`s`, `#3A4440`); grid2: "Action" (primary), "Vérité" (`btn w2`). No FAB.
(c) States and interactions:
- Levels "Gentil", "Piquant", "Extrême"; default index **1 ("Piquant")**. Changing level flips the card back to the front.
- Tap "Action" or "Vérité": if the card is already showing a prompt, it flips back first and the new prompt flips in after **350 ms**; if not, it flips in at 0 ms. Shared index `i` increments on each pick (actions and truths use the same counter).
- Actions depend on the level (`av[lvl][i % 3]`):
  - Gentil: "Envoie « tu dors ? » au 3e contact de ta liste.", "Montre la dernière photo de ta galerie.", "Fais un discours de 30 s pour le serveur."
  - Piquant: "Mime ton dernier rencard.", "Chante le refrain que le groupe choisit.", "Laisse Jade écrire ta prochaine story."
  - Extrême: "Appelle quelqu'un et chante-lui joyeux anniversaire.", "Échange ton haut avec ton voisin.", "Laisse le groupe choisir ta photo de profil pour 24 h."
- Truths do NOT depend on the level (`vv[i % 3]`): "Ta pire soirée cette année ?", "Qui ici t'énerve le plus en soirée ?", "Le message que tu regrettes le plus ?"
(d) Motion: flip 550 ms `easeFlip`; the 350 ms re-flip delay is shorter than the 550 ms flip, so the new prompt starts turning in before the old one has fully turned away.
(e) Copy: "Action ou vérité", "Gentil", "Piquant", "Extrême", "Au tour d'Inès", "Action", "ou", "Vérité", "Refuser coûte 2 gorgées.", prompts above. Rules: "Action ou vérité, au choix. Refuser coûte 2 gorgées. Trois niveaux, à choisir avant la partie."
(f) Simulated: static player, 9 actions and 3 truths, a hard-coded player name inside a card ("Laisse Jade..."). Real: turn order, cards with player-name placeholders, truths per level, the rules say the level is chosen "avant la partie" while the UI lets it change mid-game.
(g) Levels: not shown.

### 2.2 Board "Jeux d'action" (`JeuxAction.dc.html`)

Board IDs: O-54, O-55, O-59, O-60, O-61, O-62, O-63, O-64, MOT-07.

Shared: header row with back (`ib`, icon `back`, "Retour", link `Jeux.dc.html`), title `h3`, and a right-side tag or text. **No "?" rules button and no FAB on any of the 7 screens.** No rules sheet. Demo names `['Hugo','Jade','Malik','Inès','Théo','Léon']`, avatar classes `['a1','a2','a3','a5','a4','a7']`, colours `['#F4B33D','#9BD8A8','#8CCBEA','#D6C8F2','#FF9C8A','#F2C6A0']`.

#### Screen 1. "La Bombe"
(a) IDs: O-54, MOT-07.
(b) Layout: header (back, "La Bombe", tag "Catégorie"); category card (`pan`, background `#F1EEE6`, text `#1E2624`): "Un mot chacun, sans répéter" (`s`, `#4F5A55`) + "Une marque de bière" (`h2`); bomb area (height 320, centred, relative): explosion layer + bomb disc (180 × 180, round, background computed, `transition: background .4s`, label numeral 48 px); message (`h2`, centred); while running, full-width primary button min-height 64, 18 px: "Mot dit, je passe à {next}"; when idle, same size: "Allumer la mèche".
(c) States and interactions:
- "Allumer la mèche": fuse `lim = 8 + random × 12` seconds (8 to 20 s, uniform), `t = 0`, holder 0. Interval every **200 ms** adds 0.2 s. When `t >= lim`: stop, `boom = true`.
- Fraction `frac = t / lim`. Disc colour: `frac > .66` → `#FF9C8A`; `frac > .33` → `#F4B33D`; else `#F1EEE6`; after the explosion `#FF7A66`.
- Shake class `shk` while running and `frac > .5`.
- Label: idle "Prêt", running "...", exploded "Boum".
- "Mot dit, je passe à {next}": holder + 1. Holder name = `names[holder % 4]` (only Hugo, Jade, Malik, Inès rotate).
- Message: exploded "{holder} boit 2 gorgées"; running "{holder} a la bombe"; idle "Le téléphone passe de main en main".
- After the explosion the idle button comes back ("Allumer la mèche"); a new start resets holder to 0.
(d) Motion: shake `shk` = 250 ms linear infinite loop (translate ±3 px, rotate ±2°); colour change 400 ms; explosion: red disc 140 px `#FF7A66`, `boom` keyframe scale .4 → 3, opacity 1 → 0, 700 ms ease-out, forwards; 14 particles (`conf`: 8 × 14 px, radius 2, `fall` 1800 ms `cubic-bezier(.3,.6,.4,1)`, translateY -30 → 520 px, rotate 0 → 600°), left = `10 + (i × 6) % 80` %, top 40%, colour `cols[i % 6]`, delay `(i % 5) / 20` s (0, 0.05, 0.10, 0.15, 0.20 s).
(e) Copy: "La Bombe", "Catégorie", "Un mot chacun, sans répéter", "Une marque de bière", "Prêt", "...", "Boum", "Le téléphone passe de main en main", "{nom} a la bombe", "{nom} boit 2 gorgées", "Allumer la mèche", "Mot dit, je passe à {nom}".
(f) Simulated: one fixed category, 4-name rotation, no sound or haptic, no rules. Real: category deck, player list (catalogue "3 à 12"), escalating haptics and the heavy explosion haptic (DESIGN.md § 5), timer kept on the device but robust to backgrounding.
(g) Levels: not shown. At levels 2 and 3 DESIGN.md § 6 says "no shake, no long sequences".

#### Screen 2. "La Roulette"
(a) IDs: O-55, MOT-07.
(b) Layout: header (back, "La Roulette", "Manche {round}" `s`); wheel 320 × 320 centred, margin-top 20: disc with `conic-gradient(#F4B33D 0 60deg, #9BD8A8 60deg 120deg, #8CCBEA 120deg 180deg, #D6C8F2 180deg 240deg, #FF9C8A 240deg 300deg, #F2C6A0 300deg 360deg)`, rotated by `rot`; 6 labels at angles `i × 60 + 30`, `translateY(-112px)`, weight 800, 15 px, `#1E2624`; pointer triangle at top (`top: -16px`, borders 14 / 14 / 26, colour `#F1EEE6`); hub disc 64 px `#1E2624`; result (`h2 fadein`, centred, margin-top 16); "Lancer" (full, margin-top auto); static line "Pénalités : Malik 3, Jade 1, Hugo 1".
(c) States and interactions:
- "Lancer": `rot += 1800 + floor(random × 360)` (5 full turns + 0 to 359°); `round + 1` except on the very first spin; `spun = true`.
- Result index: `ang = (360 - rot % 360) % 360`, `idx = floor(ang / 60) % 6`, name = `names[idx]`. Message "{nom} boit"; before any spin "Qui va boire ?".
- The message is computed at the tap: the result appears 4 s before the wheel stops (demo flaw).
(d) Motion: `transform 4s cubic-bezier(.1,.7,.15,1)` (`easeSpin`, 4000 ms). No haptic clicks (MOT-07 asks for them).
(e) Copy: "La Roulette", "Manche {n}", "Qui va boire ?", "{nom} boit", "Lancer", "Pénalités : Malik 3, Jade 1, Hugo 1".
(f) Simulated: 6 fixed names, static penalty line, instant result. Real: segments sized for the actual player count (catalogue "2 à 12"), result revealed on stop, detent haptics, live penalty counter (O-49).
(g) Levels: not shown.

#### Screen 3. "Les Mines"
(a) IDs: O-59, MOT-07.
(b) Layout: header (back, "Les Mines", tag `red` "4 pièges"); "Au tour de **{who}**. Choisis une case." (`p`); 5 × 5 grid (gap 8), cells square (`aspect-ratio: 1`), radius 12, weight 800, 18 px; message (`h3`); "Nouvelle grille" (`btn g full`, margin-top auto).
(c) States and interactions:
- Initial mines at indices `[3, 9, 16, 22]` (cells 4, 10, 17, 23 counting from 1).
- Tap an unrevealed cell: reveal it; `turn + 1`; player = `names[turn % 4]` (4 names). Hit → "Boum. {nom} boit 2 gorgées."; safe → "{nom} s'en sort." A revealed cell ignores taps.
- Cell look: hidden `#34403C`, empty label; safe `#9BD8A8` with "✓"; mine `#FF7A66` with "✗"; revealed cells get `pop1`.
- Default message: "Une case sur six est piégée." (4 of 25 is 16%, 1 in 6 is 16.7%: the copy approximates).
- "Nouvelle grille": clears reveals, 4 new indices `floor(random × 25)` each (duplicates possible, so fewer than 4 distinct mines can happen), turn is kept, message cleared.
- No end of round (play continues after every cell is revealed).
- Cell aria-label "Case {n}".
(d) Motion: pop 350 ms on reveal.
(e) Copy: "Les Mines", "4 pièges", "Au tour de", "Choisis une case.", "Une case sur six est piégée.", "Boum. {nom} boit 2 gorgées.", "{nom} s'en sort.", "Nouvelle grille", "Case {n}".
(f) Simulated: duplicates allowed, 4-name rotation, ✓ / ✗ text glyphs instead of icons. Real: exactly N distinct mines, player list (catalogue "2 à 8"), end condition, mine count tied to level (to be designed; O-59 rules to research).
(g) Levels: not shown.

#### Screen 4. "Le Doigt"
(a) IDs: O-60, MOT-07.
(b) Layout (no `.sc`, full-bleed): the whole phone is an unstyled button (background `#1E2624`, `onPointerDown`, aria-label "Poser un doigt"); finger discs; ripples; overlay top (left/right 20, top 58, pointer-events none): row "Le Doigt" (`h3`) + "{n} doigts" (`s`), then message (`p`); bottom bar (left/right 20, bottom 30, gap 10): back `ib`, "Effacer" (`btn g`, flex 1), "Choisir" (primary, flex 1, disabled when `fingers < 2` or phase is not `add`).
(c) States and interactions:
- Phase `add`: each pointer-down adds a finger at the pointer position (scaled to the 390 px frame), maximum **6**.
- "Choisir": phase `wait`; after **1600 ms** phase `done`, `pick = floor(random × fingers)`.
- Finger disc: 86 × 86, colour `cols[i % 6]`. In `done`: chosen scale 1.35, others opacity 0.15 (transition opacity and transform 400 ms).
- Ripple on every finger during `wait` (`rip` class).
- Messages: add "Touchez l'écran pour poser vos doigts (ici, un clic par doigt)."; wait "Ne bougez plus..."; done "{names[pick]} est choisi." (name taken by finger order: finger 1 = Hugo...).
- "Effacer": back to an empty `add` phase.
- Counter: "{n} doigts" with no singular ("0 doigts", "1 doigts").
(d) Motion: ripple `rip` 1000 ms ease-out infinite, border 3 px `#F4B33D`, scale .5 → 2.2, opacity .9 → 0; selection 400 ms (DESIGN.md: "1600 ms + 400 ms").
(e) Copy: "Le Doigt", "{n} doigts", "Touchez l'écran pour poser vos doigts (ici, un clic par doigt).", "Ne bougez plus...", "{nom} est choisi.", "Effacer", "Choisir", "Poser un doigt", "Retour".
(f) Simulated: clicks instead of touches (the copy says so, it is an annotation); name by finger order. Real: real multi-touch (README, PROMPT design_reference), fingers held down, a lifted finger leaves the round, the chosen finger is highlighted (the app cannot know whose finger it is), count up to the catalogue's 8 or a documented device limit.
(g) Levels: not shown.

#### Screen 5. "L'Imposteur et Agent double"
(a) IDs: O-61, O-62.
(b) Layout: header (back, title `h3` "L'Imposteur" or "Agent double", "{n} joueurs" `s`); segmented "Imposteur" / "Agent double"; deal phase (`fadein` column, gap 12): "Passe le téléphone à **{who}**. Personne d'autre ne regarde." (`p`), word card (unstyled button, height 300, radius 24, background computed, centred column): hint (`s`, `#3A4440`) + word (numeral 52 px); full-width primary next button (disabled until the card was seen). Vote phase (`fadein`): "Discutez, puis votez." (`p`), grid3 of 6 tiles (avatar + name, `on` = selected), result (`h3`), "Nouvelle manche" (`btn g full`).
(c) States and interactions:
- Players: 6 in both modes (`players = mode === 0 ? 6 : 6`).
- Hidden roles (fixed): Imposteur mode → index **4** (Théo); Agent double mode → indices **2 and 4** (Malik, Théo).
- Words: Imposteur mode: crew word "Pinte", impostor shown "Imposteur" (no word). Agent double: crew "Pinte", agents "Demi".
- Card before peeking: background `#34403C`, hint "Touche pour voir ton mot", word "?". After peeking: background `#FF9C8A` for the impostor and for agents, `#F1EEE6` for others; hint "Tu n'as pas de mot. Fonds-toi dans la masse." for the Imposteur-mode impostor, "Ton mot" for everyone else. Tap toggles seen / hidden.
- Next button: "Cacher et passer", or "Tout le monde a vu" for the last player; it hides the card and moves to the next player, or to the vote phase.
- Vote: one accusation for the whole group (tap one tile). Result: none → "Touchez la personne que vous accusez."; right → "Bien vu : {nom} était l'imposteur. Il boit." (Imposteur) or "Bien vu : {nom} était agent double. Il boit."; wrong → "Raté, {nom} était innocent. Les espions gagnent."
- Switching mode or "Nouvelle manche" resets to player 0, deal phase.
(d) Motion: `fadein` 350 ms on phase change. No flip.
(e) Copy: "L'Imposteur", "Agent double", "Imposteur", "{n} joueurs", "Passe le téléphone à", "Personne d'autre ne regarde.", "Touche pour voir ton mot", "Ton mot", "Tu n'as pas de mot. Fonds-toi dans la masse.", "Pinte", "Demi", "Cacher et passer", "Tout le monde a vu", "Discutez, puis votez.", "Touchez la personne que vous accusez.", "Bien vu : {nom} était l'imposteur. Il boit.", "Bien vu : {nom} était agent double. Il boit.", "Raté, {nom} était innocent. Les espions gagnent.", "Nouvelle manche".
(f) Simulated: fixed roles and one word pair; one accusation; Agent double card colour reveals the role. Real: random roles, word pairs deck, player list (catalogue Imposteur "4 à 12", Agent double "5 à 12"), O-62 "5 players minimum", unlock rule O-48 (catalogue lock "4 amis", see Gaps), second agent finding (a wrong vote that hits one agent of two is not handled), gender-neutral result.
(g) Levels: not shown.

#### Screen 6. "Dessine vite (en ligne)"
(a) IDs: O-63, MOT-07 (strokes).
(b) Layout: header (back, "Dessine vite", tag `mint` "3 téléphones"); row "À toi de dessiner : **une capsule**" + countdown (numeral 26 px "{sec} s"); canvas (height 330, radius 20, background `#F1EEE6`, `touch-action: none`), SVG polylines stroke `#1E2624` width 5 round caps and joins, placeholder centred "Dessine ici avec le doigt" (`s`, `#4F5A55`) while empty; row "Les autres devinent sur leur téléphone" (`s`) + "Effacer" (`btn sm g`); guess rows (`row fadein`, min-height 40): avatar 28 px, "{nom} : {guess}", tag `mint` "trouvé" on the right guess.
(c) States and interactions:
- Pointer down starts a stroke, move appends points while drawing, up or leave ends it (coordinates scaled to a 350 px wide canvas).
- Interval every **1000 ms**: only when at least one stroke exists and `sec > 0`: `sec - 1` (starts at **60**), guesses shown `g = min(3, floor((60 - sec) / 4))`, i.e. one new guess every 4 s (at 56, 52, 48 s left).
- Scripted guesses: Jade "un bouchon ?", Malik "une pièce ?", Jade "une capsule !" (marked "trouvé").
- "Effacer": strokes cleared, `sec` back to 60, guesses cleared.
- Nothing happens at 0 s.
(d) Motion: guess rows `fadein` 350 ms. Strokes render on every pointer move (no smoothing).
(e) Copy: "Dessine vite", "3 téléphones", "À toi de dessiner :", "une capsule", "{n} s", "Dessine ici avec le doigt", "Les autres devinent sur leur téléphone", "Effacer", "trouvé", "Jade : un bouchon ?", "Malik : une pièce ?", "Jade : une capsule !".
(f) Simulated: guesses scripted, only the drawer's screen exists. Real (README, PROMPT): online real-time play on 3 to 8 phones (O-63), guesser screen with an input, lobby / join, word choice, scoring, end of round, smooth strokes (MOT-07).
(g) Levels: not shown.

#### Screen 7. "Ça grimpe"
(a) IDs: O-64 (S2M's "La Courbe").
(b) Layout: header (back, "Ça grimpe", "Sors avant le crash" `s`); chart box (height 290, radius 20, background `#28322F`, overflow hidden): SVG `viewBox 0 0 340 290`, `preserveAspectRatio none`, polyline stroke width 4 (colour computed), multiplier at left 20 / top 16 (numeral 64 px, same colour, shake class): "× {mult}"; message (`h3`); grid3 of 3 player tiles (avatar + 13 px status); "Lancer la courbe" (full, margin-top auto, disabled while running).
(c) States and interactions:
- "Lancer la courbe": crash point `crash = 1.6 + random × 5` (1.6 to 6.6, uniform on the multiplier), `m = 1`, points `[[0, 280]]`, nobody out.
- Interval every **120 ms**: `m = round2(m × 1.035)`; `x = min(340, points × 6)`; `y = max(10, 280 - (m - 1) × 45)`; if `m >= crash` → stop, `done = true` (the crash value is not added to the curve), else append the point.
- Derived from these numbers (not stated in the file): the shortest round reaches 1.6 after about 14 ticks (≈ 1.7 s), the longest reaches 6.6 after about 55 ticks (≈ 6.6 s).
- Colour: `#F4B33D` while running, `#FF7A66` after the crash. Shake class when running and `m > 3`.
- Multiplier text uses a decimal comma: `m.toFixed(2).replace('.', ',')`.
- Player tiles (Hugo, Jade, Malik): enabled only while running and not yet out; tap = out at the current multiplier, tile becomes `on` and shows "× {mult}".
- Messages: idle "Plus tu restes, plus ça rapporte. Mais ça crashe."; running "Ça monte. Touchez votre nom pour sortir."; crashed with players still in "Crash à × {m}. {noms} boivent." (one name: "boit."); crashed with everyone out "Crash. Tout le monde est sorti à temps."
- Cash-out values are displayed but never used: nothing is "rapporté".
(d) Motion: curve grows every 120 ms (linear steps); shake 250 ms loop above × 3; colour switch at crash (no transition defined).
(e) Copy: "Ça grimpe", "Sors avant le crash", "× {m}", "Plus tu restes, plus ça rapporte. Mais ça crashe.", "Ça monte. Touchez votre nom pour sortir.", "Crash à × {m}. {noms} boivent.", "boit.", "Crash. Tout le monde est sorti à temps.", "Lancer la courbe". The catalogue (Jeux board) says "La courbe monte. Descends avant le crash." (different verb).
(f) Simulated: 3 fixed players on one phone, crash random on the client. Real: player list (catalogue "2 à 10"), a rule that makes staying longer worth something (or copy that does not promise it), crash point decided before the round starts so it cannot be influenced. Rules of S2M's "La Courbe" are not public (PROMPT): this design is an assumption.
(g) Levels: not shown.

### 2.3 Board "Le Bar" (`Bar.dc.html`)

Board IDs: O-66, O-67, O-68, O-69, O-74 (retired, becomes N-32), O-76, N-32.

#### Screen 1. "Le Bar"
(a) IDs: O-66, O-68.
(b) Layout: `h1` "Le Bar"; search input with leading `search` icon (20 px, `#AEB7B2`, input padding-left 44); horizontal chip scroller (`hs`) of 8 categories; Mixer entry (`pan` row, background `#4A3E22`, icon `filter` in amber, title "Mixeur" `#F8E3B4`, subtitle `#E8D3A4`, chevron) linking to the Mixer screen; result rows (`row`): 52 × 52 colour block (radius 12) as photo placeholder, name `h3`, meta `s`, chevron; empty result line; tab bar with **"Soirée" active** (not a Bar tab: the Bar has no tab).
(c) States and interactions:
- Categories: "Tout" (default), "Classiques", "Shots", "Soirée", "Sans alcool", "Bières", "Gourmands", "Signature".
- Recipes (name, category, meta, colour): Mojito, Classiques, "Facile, 12 %, 5 min", `#9BD8A8`; Spritz, Soirée, "Facile, 11 %, 3 min", `#F2C6A0`; Moscow mule, Classiques, "Facile, 10 %, 3 min", `#8CCBEA`; Tequila paf, Shots, "Facile, 38 %, 1 min", `#F4B33D`; Virgin mojito, Sans alcool, "Facile, 0 %, 5 min", `#9BD8A8`; Panaché, Bières, "Facile, 2 %, 1 min", `#F4B33D`; Espresso martini, Gourmands, "Moyen, 18 %, 6 min", `#D6C8F2`; Le Zinc maison, Signature, "Moyen, 14 %, 7 min", `#FF9C8A`.
- Filter: category match AND (empty query OR name contains query OR category contains query), lowercase, trimmed. Ingredients are not searched although the placeholder suggests "rhum" and the empty state says "Essaie un ingrédient." No typo tolerance here.
- Empty: "Rien pour « {q} ». Essaie un ingrédient."
(d) Motion: none specific.
(e) Copy: "Le Bar", placeholder "Mojito, rhum, sans alcool...", aria "Chercher une recette", category labels, "Mixeur", "Avec ce que t'as dans le frigo", recipe names and metas above, "Rien pour « {q} ». Essaie un ingrédient.", tab labels "Soirée", "Crew", "Jeux", "Bars", "Moi".
(f) Simulated: 8 recipes, colour blocks. Real: 470+ recipes with photos (O-66; DESIGN.md § 7: flat colour blocks until real photos, never generated images), ingredient search, fast loading (O-68), typo tolerance (QOL-23 / ADP-05).
(g) Levels: not shown.

#### Screen 2. "Fiche recette"
(a) IDs: O-67, N-32 (add to list).
(b) Layout: hero block (height 200, bleeds to the screen edges, background `#F2C6A0`, title `h1` at 44 px "Spritz" bottom-left, text `#1E2624`); tags "Facile", "11 %", "3 min", "Soirée"; row "Pour 1 verre" (`h3`) + segmented cl / oz (width 130); 4 ingredient rows (min-height 44: name `p`, quantity `h3`); label "Étapes"; 3 numbered steps (`p`); "Ajouter à la liste de courses" (`btn g full`, icon `plus`, no handler).
(c) States and interactions:
- Ingredients (cl): Apéritif orange 6, Prosecco 9, Eau gazeuse 3, Orange "1 rondelle" (not converted).
- Unit switch: cl → `"{v} cl"` with decimal comma; oz → `(cl × 0.338).toFixed(1)` + " oz" with decimal comma (6 cl → "2,0 oz", 9 → "3,0 oz", 3 → "1,0 oz"). 0.338 is the US fl oz factor.
- Default cl.
(d) Motion: none.
(e) Copy: "Spritz", "Facile", "11 %", "3 min", "Soirée", "Pour 1 verre", "cl", "oz", "Apéritif orange", "Prosecco", "Eau gazeuse", "Orange", "1 rondelle", "Étapes", "1. Remplis un verre à vin de glaçons.", "2. Verse l'apéritif, puis le prosecco.", "3. Complète à l'eau gazeuse, une rondelle d'orange.", "Ajouter à la liste de courses".
(f) Simulated: one recipe, dead add-to-list button, local unit toggle. Real: the unit follows the user's unit system (PREF-03 / PREF-04: US fl oz vs UK fl oz differ), servings, photo, the add-to-list action feeding N-32.
(g) Levels: not shown.

#### Screen 3. "Mixeur"
(a) IDs: O-69.
(b) Layout: `h1` "T'as quoi ?"; wrapping chips of 10 ingredients (toggle, `on` = inverted); title `h3` (count); up to 4 rows (`row fadein`): recipe name `h3`, need line `s`, status tag.
(c) States and interactions:
- Ingredients (key, label, default): rhum "Rhum" on, citron "Citron vert" on, menthe "Menthe" off, sucre "Sucre" on, gaz "Eau gazeuse" on, vodka "Vodka" off, biere "Bière" on, gin "Gin" off, tonic "Tonic" off, prosecco "Prosecco" off.
- Recipes: Mojito (rhum, citron, menthe, sucre, gaz); Gin tonic (gin, tonic, citron); Ti-punch (rhum, citron, sucre); Panaché (biere, gaz); Vodka citron (vodka, citron, gaz).
- Sort by number of missing ingredients ascending, show the first 4.
- Title: `ok > 1` → "{ok} recettes possibles"; `ok === 1` → "1 recette possible"; 0 → "Il te manque un peu de tout". Default state gives "2 recettes possibles" (Ti-punch, Panaché).
- Row: missing → "Manque : {liste en minuscules}" + neutral tag "manque {n}"; complete → "Tu as tout" + `mint` tag "possible".
(d) Motion: rows `fadein` 350 ms.
(e) Copy: "T'as quoi ?", ingredient labels above, "{n} recettes possibles", "1 recette possible", "Il te manque un peu de tout", "Manque : ...", "Tu as tout", "manque {n}", "possible", recipe names.
(f) Simulated: 5 recipes, 10 ingredients. Real: mixer over the full recipe base (O-69), synonyms (lime / citron vert), quantities ignored.
(g) Levels: not shown.

#### Screen 4. "Courses et alibi"
(a) IDs: N-32, O-76, O-74 (retired into N-32).
(b) Layout: `h1` "Courses de samedi"; 5 shopping rows (unstyled buttons, min-height 54, bottom line `#34403C`): check icon (class `mint` when checked, `s` muted otherwise), item name (`p`, line-through when checked), assignee avatar 30 px; note (`s`); alibi card (`pan`, margin-top 10): "Alibi du lendemain" (`h3`), alibi text (`p` 17 px, `fadein`), "Un autre" (`btn sm g`).
(c) States and interactions:
- Items (assignee): "Prosecco, 2 bouteilles" (J, a2), "Apéritif orange" (H, a1), "Eau gazeuse, 3 L" (M, a3), "Glaçons, 2 sacs" (T, a4), "Oranges" (I, a5). Checked by default: items 1 and 4.
- Tap a row: toggles checked.
- Alibis, cycled with "Un autre": "J'étais chez ma grand-mère. Elle fait des crêpes jusqu'à 3 h, tout le monde le sait.", "Réunion du club de lecture. On a beaucoup parlé du chapitre 4.", "Panne de réseau toute la nuit. J'ai même pas vu vos messages, promis.", "J'ai aidé un pote à déménager. Un frigo, au 5e, sans ascenseur."
(d) Motion: `fadein` is declared on the alibi paragraph, but the element is not re-mounted on change, so the fade only plays on first render.
(e) Copy: "Courses de samedi", item names above, "Généré depuis les cocktails choisis. Touche pour cocher, chacun voit qui ramène quoi.", "Alibi du lendemain", alibis above, "Un autre".
(f) Simulated: local check state, fixed assignees, 4 alibis. Real: shared list per party synced across the crew (SYNC rules), assignment UI ("who brings what", N-32, not shown), generation from cocktails picked, alibi content authored per language (O-76).
(g) Levels: not shown.

### 2.4 Board "Argent et tournées" (`Argent.dc.html`)

Board IDs: O-70, N-18, N-19, N-20, QOL-19.

#### Screen 1. "Cagnottes et tournées"
(a) IDs: O-70, N-18.
(b) Layout: `h1` "Cagnottes"; grid2 of two `pan` (gap 2): "On te doit" + numeral 36 px `mint` "18,50 €"; "Tu dois" + numeral 36 px `red` "{owe}"; pool rows (link to pool screen): "Samedi au Zinc" / "6 personnes, 142,80 €" / tag `red` "tu dois {owe}"; "Week-end en Ardèche" / "8 personnes, 1 240 €, en euros et en francs suisses" / tag `mint` "+18,50 €"; next-round card (`pan`, background `#4A3E22`): "Prochaine tournée" (`s`, `#E8D3A4`), row with avatar + name (`h2`, `#F8E3B4`) and reason (`s`), primary "Enregistrer la tournée de {nom}", note (`s`); confirmation line (`s fadein`) after recording; tab bar with "Moi" active.
(c) States and interactions:
- `owe` = "12,40 €", or "0,00 €" once the "Tu paies Malik" transfer is marked paid on the pool screen (shared state).
- Rotation (cycled with `rot % 3`): Théo (a4) "dernière tournée il y a 2 soirées"; Inès (a5) "n'a pas payé depuis 3 soirées"; "Toi" (a1, initial H) "ton tour arrive". The button text becomes "Enregistrer la tournée de Toi" for the third (grammar bug).
- Tap the button: `rot + 1`, shows "Tournée enregistrée : 4 pintes ajoutées, 26 € dans la cagnotte. Prochain : {nom suivant}."
(d) Motion: confirmation `fadein` 350 ms.
(e) Copy: "Cagnottes", "On te doit", "Tu dois", "18,50 €", "12,40 €", "0,00 €", "Samedi au Zinc", "6 personnes, 142,80 €", "tu dois {x}", "Week-end en Ardèche", "8 personnes, 1 240 €, en euros et en francs suisses", "+18,50 €", "Prochaine tournée", "dernière tournée il y a 2 soirées", "n'a pas payé depuis 3 soirées", "ton tour arrive", "Toi", "Enregistrer la tournée de {nom}", "Ajoute les verres à chacun et la dépense dans la cagnotte d'un coup.", "Tournée enregistrée : 4 pintes ajoutées, 26 € dans la cagnotte. Prochain : {nom}."
(f) Simulated: a fixed 3-person rotation, fixed round content (4 pints, 26 €), no pending state, no choice of who is in the round. Real: fair rotation computed (N-18), the round adds drinks to each participant and the expense to the pool in one server mutation (SYNC-01), selection of participants and drink, Undo (QOL-13 relies on Undo for non-destructive actions).
(g) Levels: not shown. ADP-06 puts "large pool expense" in the next-morning vault.

#### Screen 2. "Une cagnotte"
(a) IDs: O-70, N-19, QOL-19.
(b) Layout: header (back `ib` to "#", title "Samedi au Zinc", `ib` `plus` "Ajouter une dépense" with no handler); label "Pour tout régler en 3 virements"; 3 transfer rows: avatar 32 px, text `p`, amount `h3`, button `btn sm` (primary "Marquer payé" or `g` "Payé"); payment card (`pan`): "Payer Malik" (`h3`), IBAN row (unstyled button, min-height 48: "IBAN" `s` + number `p`, tag on the right), grid2 "Lien de paiement" / "Rappel gentil" (`btn sm g`, no handlers); label "Dépenses"; 3 expense rows (title `p`, detail `s`, amount `h3`).
(c) States and interactions:
- Transfers: "Jade paie à Malik" 12,40 € (J, a2); "Tu paies Malik" 12,40 € (H, a1); "Inès paie à Jade" 6,00 € (I, a5).
- "Marquer payé" ↔ "Payé" toggles (reversible with a second tap, no Undo toast, no pending state). Marking transfer 2 updates "Tu dois" on screen 1 to "0,00 €".
- IBAN: **tap** (not long-press) → tag "Copié" (`mint`) for **1800 ms**, then back to "Copier" (neutral).
- Expenses: "Tournée de Malik" / "Au Zinc, 4 parts égales" / 28,00 €; "Courses de l'apéro" / "Ticket en photo, parts inégales" / 64,30 €; "Taxi du retour" / "Jade, Inès, toi" / 24,00 €.
(d) Motion: none beyond button press scale (.97, 120 ms).
(e) Copy: "Samedi au Zinc", "Pour tout régler en 3 virements", "Jade paie à Malik", "Tu paies Malik", "Inès paie à Jade", "Marquer payé", "Payé", "Payer Malik", "IBAN", "FR76 3000 4000 0312 3456 7890 143", "Copier", "Copié", "Lien de paiement", "Rappel gentil", "Dépenses", expense titles and details above. Aria: "Retour", "Ajouter une dépense".
(f) Simulated: fixed transfers (the expenses listed sum to 116,30 €, not the 142,80 € shown on screen 1), tap-to-copy. Real: minimum-transfer computation (O-70), repayments recorded through the server, long-press copy with haptic and inline "Copied" (QOL-19), payment links, reminders as notifications, receipt photos, multi-currency (N-19).
(g) Levels: not shown.

#### Screen 3. "Nouvelle dépense"
(a) IDs: N-19, O-70.
(b) Layout: header (`ib` `x` "Fermer", title "Nouvelle dépense", 44 px spacer); amount row centred (numeral 80 px "36,00" + `h2` "€"); note (`s` centred); chips (static): "Payé par toi" (`on`), "Au Zinc", "Ticket" with `camera` icon 14 px; segmented split mode (4); 4 person rows: avatar 32 px, name, optional stepper (− / count / +, buttons 34 × 34), share value (`h3`, min-width 74, right); "Ajouter" (full, margin-top auto, no handler).
(c) States and interactions:
- Amount fixed at 36 (display "36,00").
- People: Toi (H, a1), Jade (J, a2), Malik (M, a3), Inès (I, a5).
- Modes: "Égal" (default) → 36 / 4 = 9,00 € each; "Parts" → steppers shown, share = `36 × parts / total parts`, parts start at 1 each, minus floors at 0, no maximum (all at 0 divides by zero); "Montants" → fixed 12, 8, 10, 6 €; "%" → 25, 25, 30, 20 % displayed as "{p} %, {montant}".
- Currency format: `toFixed(2)` with a decimal comma + " €".
(d) Motion: none.
(e) Copy: "Nouvelle dépense", "36,00", "€", "Clavier numérique avec virgule. Monnaie : euro.", "Payé par toi", "Au Zinc", "Ticket", "Égal", "Parts", "Montants", "%", "Toi", "Jade", "Malik", "Inès", "−", "Ajouter". Aria: "Fermer", "Moins", "Plus".
(f) Simulated: fixed amount, no keyboard, fixed amounts and percentages, static chips. Real: numeric pad with the locale decimal separator (QOL-08), editable amounts and percentages that must sum to the total, payer picker, venue / party / trip link, receipt photo (N-19), currency per trip, draft kept (QOL-07).
(g) Levels: not shown.

#### Screen 4. "Budget du soir"
(a) IDs: N-20.
(b) Layout: `h1` "Budget de ce soir"; card 1: row "Je me fixe" (`h3`) + numeral 40 px amber "{budget} €", range input; card 2: row "Déjà dépensé" + `h3` amount, progress bar 14 px (colour computed, width 600 ms), message `s`, "Simuler : une pinte à 6,50 €" (`btn sm g`); footnote `s`.
(c) States and interactions:
- Range: min **10**, max **120**, step **5**, default **40** €. Spent starts at **21** €.
- `pct = min(100, round(spent / budget × 100))`.
- Bar colour: `pct >= 90` → `#FF7A66`; `pct >= 70` → `#F4B33D`; else `#9BD8A8` (matches DESIGN.md: ok < 70, amber 70 to 90, danger ≥ 90).
- Message: `pct >= 100` → "Budget dépassé de {spent - budget}."; `pct >= 80` → "Il te reste {budget - spent}. On te prévient à 90 %."; else "Il te reste {budget - spent}."
- Simulate button: spent + 6,50 €.
- Edge case: because `pct` is rounded, a spend at 99.5% or more shows "Budget dépassé de" with a negative amount.
(d) Motion: bar width 600 ms `easeOut`.
(e) Copy: "Budget de ce soir", "Je me fixe", "{n} €", "Déjà dépensé", "Budget dépassé de {x}.", "Il te reste {x}. On te prévient à 90 %.", "Il te reste {x}.", "Simuler : une pinte à 6,50 €", "Calculé avec les prix relevés dans les bars et tes dépenses de la soirée." Aria "Budget".
(f) Simulated: the spending button (prototype control, must not ship), no alert. Real: spending computed from logged drinks × venue prices (N-09) and expenses, the 90% alert as a notification within the volume rules (O-38, N-35), budget bounds per currency.
(g) Levels: not shown.

### 2.5 Board "Profil et visibilité" (`Profil.dc.html`)

Board IDs: PROF-01, PROF-02, PROF-03, PROF-05, PROF-06, PROF-07, PROF-09, PROF-10, COM-04, COM-05, N-13, N-14, N-15, N-34, JOY-03, JOY-11, O-43, O-72 (retired, becomes N-34).

Audience model in the logic: `A = ['Moi','Crews','Amis','Tous']` (index 0 to 3). A viewer sees a section when `aud[section] >= need`, with `need = 3` for a stranger, `2` for a friend, `1` for a crew member. This is a nested scale (see Summary 7).

#### Screen 1. "Mon profil"
(a) IDs: PROF-01, PROF-02, PROF-06, N-34, O-72, COM-04.
(b) Layout: top row: empty left, right group of two `ib`: `euro` "Cagnottes" (link `Argent.dc.html`), `gear` "Réglages" (link `Reglages.dc.html`); identity row: avatar 76 px `a1` "H" (28 px), `h1` "Hugo", `s` "@hugo.dlb, crew Les Quais"; tags: amber with `crown` icon 14 px "Maire du Zinc", "Explorateur", "86 soirées"; grid2 `btn sm g`: "Carte de membre" (link `#carte`), "Amis" with `users` icon (link `#amis`); hint `s`; 6 section cards (`pan`, gap 6): row with section name (`h3`) + audience chip (min-height 32, 13 px, `eye` icon 14 px, label = audience; chip `on` only for "Tous"), content line `s`; tab bar with "Moi" active.
(c) States and interactions:
- Sections (key, label, content, default audience):
  - bars, "Bars", "Favoris : Le Zinc, La Capsule. 14 visités, 3 à toi.", Tous (3)
  - avis, "Avis", "2 avis : Le Zinc, Quai 12.", Tous (3)
  - drinks, "Boissons préférées", "Pinte blonde, spritz, ti-punch.", Amis (2)
  - rec, "Records", "Taux le plus haut : 1,62 g/L. Plus grosse soirée : 11 verres.", Amis (2)
  - nights, "Soirées", "86 soirées, 7 semaines de suite avec le crew.", Tous (3)
  - games, "Jeux", "22 parties gagnées. Imbattable à Dessine vite.", Crews (1)
- Tap a chip: audience cycles Moi → Crews → Amis → Tous → Moi; the preset on screen 3 becomes "none" (`preset = -1`).
- There is no link from this screen to "Voir comme" (screen 2) or "Qui voit quoi" (screen 3).
(d) Motion: none (chip label swap is instant).
(e) Copy: "Hugo", "@hugo.dlb, crew Les Quais", "Maire du Zinc", "Explorateur", "86 soirées", "Carte de membre", "Amis", "Touche l'étiquette d'une section pour choisir qui la voit.", section labels and contents above, "Moi", "Crews", "Amis", "Tous". Aria: "Cagnottes", "Réglages".
(f) Simulated: local state. Real: server-enforced field filtering (PROF-08), the audience change as an optimistic mutation (SYNC-01), the remaining PROF-02 sections, per-item overrides (PROF-03).
(g) Levels: not shown.

#### Screen 2. "Voir mon profil comme..."
(a) IDs: PROF-07, PROF-05.
(b) Layout: back `ib` (link "#"); `h1` "Voir comme"; segmented 3 viewers; preview card (`pan`, background `#F1EEE6`, text `#1E2624`): avatar `a1` "H" + "Hugo" (`h3`) + viewer line (`s`, `#4F5A55`); visible section rows (`row fadein`, border `#D3D8D2`): name `h3` + content `s`; empty line; count line `s`; fixed note `s`.
(c) States and interactions:
- Viewers: "Un inconnu" (default), "Un ami", "Mon crew"; subtitles "Comme quelqu'un qui ne te connaît pas", "Comme Nora, amie hors crew", "Comme Jade, du crew Les Quais".
- Visible = sections with audience ≥ need (3 / 2 / 1).
- For the stranger, the Bars content is replaced by "Le Zinc (34 visites), La Capsule (21 visites)" (visit counts, no dates).
- No visible section: "Rien d'autre que ton prénom et ta photo."
- Count: "{n} sections cachées pour cette personne." (no singular; "1 sections", "0 sections" possible).
(d) Motion: rows `fadein` 350 ms on mount.
(e) Copy: "Voir comme", "Un inconnu", "Un ami", "Mon crew", the 3 subtitles, "Rien d'autre que ton prénom et ta photo.", "{n} sections cachées pour cette personne.", "Ta position et ton bar actuel ne sont jamais visibles pour un inconnu. Pour lui, tes bars n'ont ni date, ni jour, ni heure."
(f) Simulated: preview computed on the client. Real: the preview must be the server's response for that audience (PROF-08 says hiding in the UI is not enough), so "view as" should call the same endpoint with a viewer role.
(g) Levels: not shown.

#### Screen 3. "Confidentialité du profil"
(a) IDs: PROF-01 (presets), PROF-03 (un-hide), PROF-09, PROF-10.
(b) Layout: back `ib`; `h1` "Qui voit quoi"; segmented presets; note `s`; label "Cachés de ton profil"; hidden item rows: `eye` icon 18 px, name, "Remontrer" (`btn sm g`); label "Qui peut te trouver"; segmented findability; summary card (`pan`, background `#4A3E22`): "Ce qu'un inconnu voit maintenant" (`h3`, `#F8E3B4`) + summary (`s`, `#E8D3A4`).
(c) States and interactions:
- Presets: "Privé" → every section 0 (Moi); "Amis" → every section 2; "Public" → every section 3 except Boissons préférées and Records capped at 2 (Amis). No preset is selected by default (`preset = -1`), and any section change on screen 1 deselects it.
- Hidden items (default): "La Cave à Paul", "Avis sur Chez Odette". "Remontrer" removes the item from the list. There is no control to hide an item.
- Findability: "Recherche", "Pseudo exact" (default, index 1), "Personne".
- Summary: "Ton prénom, ta photo" + (if any section is Tous) ", et : {sections en minuscules}." or ". Rien d'autre." + findability suffix: Personne → " Personne ne peut te trouver."; Pseudo exact → " On te trouve seulement avec ton pseudo exact."; Recherche → nothing. Default output: "Ton prénom, ta photo, et : bars, avis, soirées. On te trouve seulement avec ton pseudo exact."
- PROF-10's automatic first-time display when something is switched to Everyone is not shown.
(d) Motion: none.
(e) Copy: "Qui voit quoi", "Privé", "Amis", "Public", "Un réglage d'ensemble, puis section par section sur ton profil.", "Cachés de ton profil", "La Cave à Paul", "Avis sur Chez Odette", "Remontrer", "Qui peut te trouver", "Recherche", "Pseudo exact", "Personne", "Ce qu'un inconnu voit maintenant", summary strings above.
(f) Simulated: local state. Real: server-side audiences, per-item hide action from the items themselves (PROF-03), findability enforced in search (PROF-09) and in public regulars (COM-03), first-time summary (PROF-10).
(g) Levels: not shown.

#### Screen 4. "Mes stats"
(a) IDs: N-13, N-14, N-15, N-17 (export row).
(b) Layout: `h1` "Mes habitudes"; grid2 of 4 `pan` (gap 2): label `s` + value `h3`; label "Les sorties du crew cette année"; heatmap grid 13 columns × 4 rows (52 cells, gap 3, square, radius 3); caption `s`; Wrapped entry (`pan` link to `Recap.dc.html`, background `#F4B33D`, text `#1E2624`): "Prêt en décembre" (`s`, `#3A3010`), `h2` title, `p` line; row "Exporter mes données" + "CSV ou JSON". No back button, no tab bar.
(c) States and interactions:
- Stats: "Boisson préférée" "Pinte blonde"; "Rythme habituel" "1 verre / 38 min"; "Premier verre" "vers 21 h 10"; "Tu rentres" "vers 2 h 30".
- Heatmap colour per cell `i`: `v = (i × 37) % 11`; `v > 8` → `#F4B33D`; `v > 5` → `#9A7A33`; `v > 2` → `#4A5246`; else `#2C3734` (two of these four colours are not tokens).
(d) Motion: none.
(e) Copy: "Mes habitudes", "Boisson préférée", "Pinte blonde", "Rythme habituel", "1 verre / 38 min", "Premier verre", "vers 21 h 10", "Tu rentres", "vers 2 h 30", "Les sorties du crew cette année", "Le samedi gagne, le jeudi monte depuis mars.", "Prêt en décembre", "Ton année 2026 avec Les Quais", "86 soirées, 14 bars, 1 trône. En stories.", "Exporter mes données", "CSV ou JSON".
(f) Simulated: fixed numbers, pseudo-random heatmap. Real: stats computed with the day boundary (QOL-02), crew heatmap with a legend, monthly recap (N-15, not shown), Wrapped generated in December.
(g) Levels: not shown.

#### Screen 5. "Carte de membre"
(a) IDs: JOY-11, JOY-03, N-34.
(b) Layout: back `ib`; member card (radius 24, background `#F4B33D`, text `#1E2624`, padding 22, gap 14): row "Les Quais" (`h3`) + "membre depuis févr. 2026" (`s`, `#3A3010`); avatar 72 px (background `#1E2624`, initial in amber, 28 px) + "Hugo" (numeral 44 px) + "Maire du Zinc" (`p`); grid3 of stats (numeral 32 px + `s` label): 86 "soirées", 3 "bars à lui", 7 "semaines de suite"; "Partager ma carte" (`btn g full`, `share` icon, no handler); label "Icône de l'app"; grid4 of icon tiles (icon square 44 × 44 radius 12 with the `glass` icon 24 px, label 11 px); note `s`.
(c) States and interactions:
- Icons: "Ambre" `#F4B33D` (default selected), "Menthe" `#9BD8A8`, "Eau" `#8CCBEA`, "Couronne" `#56635F` (locked: tile disabled). Selecting an unlocked tile marks it `on`. The locked tile has no lock icon and no unlock condition.
(d) Motion: none.
(e) Copy: "Les Quais", "membre depuis févr. 2026", "Hugo", "Maire du Zinc", "86", "soirées", "3", "bars à lui", "7", "semaines de suite", "Partager ma carte", "Icône de l'app", "Ambre", "Menthe", "Eau", "Couronne", "Les icônes se débloquent avec les titres et les saisons."
(f) Simulated: static card, local icon choice. Real: native alternate icons (JOY-03), unlock rules from titles and seasons (N-34), share to stories in the right format (QOL-06), gender-neutral "bars à lui" (it assumes "lui").
(g) Levels: not shown.

#### Screen 6. "Profil d'une inconnue"
(a) IDs: COM-04, COM-05, PROF-05.
(b) Layout: top row: back `ib`, `ib` `more` "Bloquer ou signaler" (no handler); identity: avatar 76 px `a7` "N", `h1` "@nora.ln", `s` line; tags: amber "Légende du Zinc, mai", neutral "Quiz addict"; label "Ses bars"; rows "Le Zinc" / "34 visites", "Quai 12" / "12 visites"; label "Ses avis publics"; review card (`pan`): "Quai 12" (`h3`) + text (`s`); open party card (`pan`, background `#2A4632`): title (`h3`, `#D4F2DB`), detail (`s`, `#BFE9C8`), primary `btn sm`; grid2: friend request button + "Inviter mon crew" (`btn g`, no handler); note `s`.
(c) States and interactions:
- "Demander à rejoindre" ↔ "Demande envoyée" (toggle, button stays primary).
- "Demander en ami" (primary) ↔ "Demande envoyée" (`btn g`) (toggle; a second tap cancels).
(d) Motion: none.
(e) Copy: "@nora.ln", "Ouverte aux rencontres. 2 amis en commun.", "Légende du Zinc, mai", "Quiz addict", "Ses bars", "Le Zinc", "34 visites", "Quai 12", "12 visites", "Ses avis publics", "Meilleur quiz du quartier, venez tôt.", "Soirée ouverte ce soir", "Quiz au Quai 12, 21 h. Nora valide les demandes.", "Demander à rejoindre", "Demande envoyée", "Demander en ami", "Inviter mon crew", "Pas de message avant qu'elle accepte ta demande." Aria "Bloquer ou signaler".
(f) Simulated: no pending state, no block / report sheet. Real: requests via the server with "never sent when sending failed" (O-43), host approval of join requests (COM-05), block and report (COM-08), "who can send requests" setting (COM-05, not shown anywhere in this board).
(g) Levels: not shown.

#### Screen 7. "Amis"
(a) IDs: O-43.
(b) Layout: `h1` "Amis"; search input (placeholder "Pseudo ou prénom", no handler); label "Demandes reçues"; request rows (`row fadein`): avatar, name `h3`, origin `s`, "Accepter" (`btn sm` primary), refuse `ib` 40 × 40 with `x` icon 16 px; label "Tes amis ({n})"; friend rows: avatar, name, detail, chevron; "Inviter avec mon lien" (`btn g full`, `link` icon, no handler).
(c) States and interactions:
- Requests: Lina (L, a6) "Via le lien de Jade"; Karim (K, a4) "Croisé au Quiz du Quai 12".
- "Accepter": removes the request and adds the person at the top of the friends list with "Ami depuis maintenant" (masculine also for Lina). Count updates.
- Refuse: removes the request (no Undo, no confirmation).
- Friends: Jade (a2) "Les Quais", Malik (a3) "Les Quais", Inès (a5) "Les Quais", Nora (a7) "Amie depuis samedi". Initial count "4".
(d) Motion: request rows `fadein` 350 ms.
(e) Copy: "Amis", "Pseudo ou prénom", "Demandes reçues", "Lina", "Via le lien de Jade", "Karim", "Croisé au Quiz du Quai 12", "Accepter", "Tes amis ({n})", "Les Quais", "Amie depuis samedi", "Ami depuis maintenant", "Inviter avec mon lien". Aria "Chercher", "Refuser".
(f) Simulated: local lists, dead search. Real: reliable search (O-43, QOL-23), duplicate-request handling, live list after disconnect, friend profile with full history, referral link.
(g) Levels: not shown.

### 2.6 Board "Réglages" (`Reglages.dc.html`)

Board IDs: PREF-01, PREF-03, PREF-05, O-06, O-07, O-09, O-10, O-12, O-13, O-77, N-35, N-17, SEC-07, JOY-05, JOY-07, JOY-10, QOL-24.

#### Screen 1. "Réglages"
(a) IDs: O-12, O-77, JOY-07, PREF-03 (entry), O-08 (policy row).
(b) Layout: `h1` "Réglages"; update banner (`pan` row, background `#24404D`): `arrowdn` icon in water colour, title (`h3`, `#D6EEF8`), subtitle (`s`, `#B8E0F3`), `btn sm w2` "Mettre à jour" (no handler); 8 rows with leading icon 20 px, label `p`, chevron 18 px: "Langue, région et unités" (icon `user`), "Notifications" (`bell`), "Sécurité et données" (`shield`), "Confidentialité et apparence" (`eye`), "Mode soirée et garde-fous" (`glass`, link `ModeBourre.dc.html`), "Profil et visibilité" (`users`, link `Profil.dc.html`), "Signaler un problème ou un contenu" (`flag`, link "#"), "Politique de confidentialité" (`lock`, link "#"); logo button (margin-top 18, aria "À propos"): amber square 56 × 56 radius 18 with `glass` icon 30 px, version line `s`; easter egg line; tab bar "Moi" active.
(c) States and interactions:
- Logo taps count up; at **10** taps or more the logo gets `pop1` and the line "T'as trouvé le bar secret. Une icône dorée t'attend." appears (`fadein`). The count never resets (no time window).
(d) Motion: pop 350 ms on the logo at the 10th tap; `fadein` 350 ms on the line.
(e) Copy: "Réglages", "Nouvelle version disponible", "Corrige le partage de récap", "Mettre à jour", the 8 row labels, "[Nom de l'app] 1.0.0", "T'as trouvé le bar secret. Une icône dorée t'attend."
(f) Simulated: banner always shown. Real: store version check (O-12), report flow (O-77), privacy policy readable without an account (O-08), the golden icon added to the icon list (not present on the Profil board), easter egg documented only in `EASTER_EGGS.md` (JOY-07).
(g) Levels: not shown. ModeBourre (other board) says these settings are read-only during a party.

#### Screen 2. "Langue, région et unités"
(a) IDs: O-09, O-10, PREF-01, PREF-03, PREF-05.
(b) Layout: back `ib`; `h1` "Langue, région, unités"; travel banner (`pan fadein`, `#4A3E22`): `h3` + `s` + grid2 "Passer" (primary sm) / "Non merci" (`g` sm); label "Langue de l'app"; 7 language chips; country row (label + current limit `s`, country `s`, chevron, no handler); label "Unités"; segmented 3 systems; examples card (3 rows label / value); label "Taux affiché"; segmented 4 BAC units; example line; rows "Format de l'heure" / "Comme le téléphone (24 h)" and "Monnaie" / "Euro" (no chevrons, no handlers); sync note.
(c) States and interactions:
- Travel banner shown by default. "Passer" hides it and sets the country to "Belgique"; "Non merci" hides it.
- Limit line: France → "0,5 g/L, 0,2 en jeune permis"; any other country → "0,5 g/L, 0,2 pour les conducteurs pro".
- Languages: "Français" (default), "English", "Español", "Italiano", "Deutsch", "Português", "Русский".
- Unit systems and examples (pint / standard drink / weight): "Métrique" "50 cl" / "10 g d'alcool" / "72 kg"; "US" "16 fl oz" / "14 g (US)" / "159 lb"; "UK" "568 ml (pint)" / "8 g (unit)" / "11 st 5".
- BAC units and examples: "g/L" "0,58 g/L de sang"; "mg/L" "0,29 mg/L d'air"; "‰" "0,58 ‰"; "%" "0,058 %". (mg/100 ml, which PREF-02 cites for the UK, is not offered.)
(d) Motion: banner `fadein` 350 ms.
(e) Copy: "Langue, région, unités", "T'es en Belgique ?", "Passer sur la limite belge (0,5 g/L) et garder tes unités ?", "Passer", "Non merci", "Langue de l'app", language names, "Pays pour la limite légale", "France", "Belgique", the two limit lines, "Unités", "Métrique", "US", "UK", "Une pinte", "Verre standard", "Ton poids", the example values, "Taux affiché", unit labels and examples, "Exemple : {x}", "Format de l'heure", "Comme le téléphone (24 h)", "Monnaie", "Euro", "Enregistré sur ton compte : tes autres appareils suivent."
(f) Simulated: the travel trigger, the country picker, currency, time format. Real: region / time-zone change detection (PREF-05), country list with thresholds (O-18, Recon-BAC), server-stored preferences with optimistic update and rollback (PREF-01), drink presets, novice driver mode, first day of week, emergency numbers (PREF-02 / PREF-03, not on this screen).
(g) Levels: not shown.

#### Screen 3. "Notifications"
(a) IDs: N-35, PREF-03.
(b) Layout: back `ib`; `h1` "Notifications"; 8 rows (title `p` + description `s` + switch 52 × 32); quiet hours card (`pan`): row "Heures calmes" + switch, line `s`; row "Résumé du crew" + description + switch (always on, no handler).
(c) States and interactions (defaults):
- "Qui sort ce soir" / "Quand un pote lance une sortie": on
- "Invitations" / "Soirées, demandes d'ami": on
- "Le crew en soirée" / "Arrivées, départs": on
- "Dépassements" / "Classement et prises de bar": on
- "Rappels d'eau" / "Pendant tes soirées": on
- "Prix qui changent" / "Dans tes bars favoris": **off**
- "Récap prêt" / "Le lendemain à 11 h": on
- "Messages" / "Contenu jamais affiché sur l'écran verrouillé": on
- Quiet hours on, "De 2 h à 11 h. Un SOS passe toujours." (no time pickers).
(d) Motion: switch knob 220 ms `cubic-bezier(.3,.7,.3,1)`, track colour 200 ms.
(e) Copy: all labels and descriptions above, "Heures calmes", "De 2 h à 11 h. Un SOS passe toujours.", "Résumé du crew", "Un seul message par soirée au lieu d'un par événement".
(f) Simulated: local toggles. Real: server-stored per-type settings, quiet hours with editable bounds, the crew digest (N-31) as a real toggle.
(g) Levels: not shown.

#### Screen 4. "Sécurité et données"
(a) IDs: SEC-07, O-06, O-07, O-13, N-17, SEC-08 (consent withdrawal row).
(b) Layout: back `ib`; `h1` "Sécurité et données"; row passkeys (`key` icon, title, detail, chevron); row 2FA (title, detail, switch); row "Changer d'e-mail" (chevron); label "Connecté sur"; session rows (`row fadein`): device, last seen, "Déconnecter" (`btn sm g`) for other devices only; row "Comptes sur ce téléphone" / description / "1"; label "Tes données"; rows "Exporter (CSV ou JSON)", "Retirer mon accord pour les données de santé" (chevrons, no handlers); "Supprimer mon compte" (`btn d full`); delete sheet.
(c) States and interactions:
- 2FA default on, toggles.
- Sessions: "iPhone de Hugo" / "Ce téléphone" (no button); "iPad" / "Vu hier à 18 h"; "Chrome sur PC" / "Vu il y a 9 jours". "Déconnecter" removes the row at once (no confirmation, no pending).
- "Supprimer mon compte" opens the sheet; both sheet buttons only close it.
(d) Motion: sheet 320 ms `easeOut`; session rows `fadein`.
(e) Copy: "Sécurité et données", "Clés d'accès", "iPhone de Hugo, ajoutée en février", "Validation en deux étapes", "Code à chaque nouvel appareil", "Changer d'e-mail", "Connecté sur", "iPhone de Hugo", "Ce téléphone", "iPad", "Vu hier à 18 h", "Chrome sur PC", "Vu il y a 9 jours", "Déconnecter", "Comptes sur ce téléphone", "Chaque compte garde ses données à part", "1", "Tes données", "Exporter (CSV ou JSON)", "Retirer mon accord pour les données de santé", "Supprimer mon compte". Sheet: title "Supprimer ton compte ?", body "On efface ton profil, tes verres et ton taux, tes check-ins, tes avis signés, tes photos et tes messages. Les cagnottes gardent les montants, sans ton nom. Les sauvegardes sont purgées sous 30 jours.", buttons "Garder mon compte" / "Supprimer mon compte".
(f) Simulated: everything local. Real: passkeys management, 2FA, remote sign-out, new-device alert (SEC-07, not shown), real deletion with a "done" confirmation (O-07 "confirms when done", not shown), export file (N-17), selective deletion (N-17, not shown), consent withdrawal (SEC-08). No "change password" row: consistent with passkeys first, but O-06 names password.
(g) Levels: not shown. ADP-06 locks account deletion above a threshold.

#### Screen 5. "Confidentialité et apparence"
(a) IDs: QOL-24, JOY-05, JOY-10, PREF-03 (participation toggles), JOY-03 (icon row).
(b) Layout: back `ib`; `h1` "Confidentialité et apparence"; 4 privacy rows with switches; label "Thème"; segmented themes; 3 appearance rows with switches; row "Icône de l'app" / "Ambre" / chevron (link `Profil.dc.html#carte`); row "Stickers du crew pour iMessage et WhatsApp" / chevron.
(c) States and interactions (defaults):
- "Classement des verres" / "Tu apparais dans celui du crew": on
- "Jeu des bars" / "Tes check-ins comptent pour les boss": on
- "Position pendant les soirées" / "Seulement si tu l'actives, jamais gardée": on
- "Statistiques d'usage" / "Anonymes": off
- Theme: "Auto" (default), "Sombre", "Clair".
- "Sons" / "Versé, tchin, couronne. Coupés en mode silencieux": off
- "Économie d'énergie" / "Moins d'animations quand la batterie est basse": on
- "Économie de données" / "Photos en qualité réduite sur réseau mobile": off
(d) Motion: switches 220 ms.
(e) Copy: all labels above, "Thème", "Auto", "Sombre", "Clair", "Icône de l'app", "Ambre", "Stickers du crew pour iMessage et WhatsApp".
(f) Simulated: local toggles. Real: server-stored settings (PREF-01), Low Power Mode detection (QOL-24), sound pack respecting the silent switch (JOY-05), sticker packs (JOY-10).
(g) Levels: not shown.

### 2.7 Board "États et serveur" (`Etats.dc.html`)

Board IDs: SYNC-01 to SYNC-07, O-31, MOT-10, QOL-07, QOL-09, QOL-11, QOL-12, QOL-13, QOL-23, AC-09.

#### Screen 1. "Affiché direct, confirmé par le serveur"
(a) IDs: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-07, O-31.
(b) Layout: `h1` "Le serveur tranche"; label "Réponse simulée du serveur"; segmented 4 modes; mode note `s`; drink rows (`row`, transition transform and opacity 350 ms): `glass` icon 20 px (colour class), "Pinte" + time `s`, status tag; "Ajouter une pinte" (full, `plus` icon); footnote `s`; error toasts (`toast err`, bottom 40, button "OK").
(c) States and interactions:
- Initial rows: "Pinte" 22 h 18 (ok), "Pinte" 22 h 51 (ok).
- "Ajouter une pinte" appends a row with the current time formatted "{H} h {MM}" and status `queue` (mode Hors ligne) or `pending` (other modes); clears toasts.
- Mode "OK": after **900 ms** → `ok`.
- Mode "Refus": after **900 ms** → `gone` + error toast; the row is removed **400 ms** later.
- Mode "Lent": after **1400 ms** → `slow`; **1800 ms** later (3200 ms after the tap) → slow error toast.
- Mode "Hors ligne": stays `queue` forever.
- Status table (tag text, tag class, icon class): ok "enregistrée" mint / mint; pending "envoi" neutral; slow "envoi, nouvel essai" amber tag, neutral icon; queue "en attente du réseau" neutral; gone "refusée" red / red.
- Row opacity: gone 0; pending, queue, slow 0.7; ok 1. Row offset: gone `translateX(-60px)`.
- Toasts stay until "OK" is tapped.
(d) Motion: rejection = slide left 60 px + fade out over 350 ms (the SYNC-03 reverse animation); status tags swap instantly.
(e) Copy: "Le serveur tranche", "Réponse simulée du serveur", "OK", "Refus", "Lent", "Hors ligne", notes: "Le serveur valide. La pinte passe d'« envoi » à « enregistrée ».", "Le serveur refuse. La pinte disparaît et la raison s'affiche.", "Le serveur tarde. « Envoi » reste affiché, l'app réessaie, puis prévient.", "Pas de réseau. La pinte attend dans la file et part au retour du réseau."; "Pinte"; tags above; "Ajouter une pinte"; "Les points, couronnes et dépassements attendent la réponse du serveur avant de s'animer."; toasts "Pinte refusée : la soirée est fermée depuis 6 h." and "Le serveur ne répond pas. On réessaie tout seuls.", button "OK".
(f) Simulated: the whole segmented control and its notes are a prototype device. Real: the shared sync layer with idempotency keys, exponential backoff with jitter, discreet pending indicator after a few seconds, server-replaced items (SYNC-01 to 05), error toasts with an action ("Réessayer" where it makes sense), toast queue and screen reader announcement (SYNC-07).
(g) Levels: not shown. SYNC-07: toasts bigger and simpler at levels 2 and 3.

#### Screen 2. "Hors ligne et conflits"
(a) IDs: O-31, SYNC-04, SYNC-06.
(b) Layout: offline card (`pan` row): `offline` icon 20 px, "Pas de réseau" (`h3`) + count (`s`); 3 rows with a neutral tag (`clock` icon 12 px + "en attente"); note `s`; label "Au retour du réseau"; grouped failure card (`pan`, `#4E2C27`): title `h3` `#FFD3CB`, 3 lines `s` `#F3B9AE`; conflict card (`pan`): `h3`, `s`, "Voir la dépense" (`btn sm g`, no handler).
(c) States: static.
(d) Motion: none.
(e) Copy: "Pas de réseau", "3 actions partiront dès que tu captes", "Pinte, 23 h 41", "Check-in au Zinc", "Vote pour Jade", "en attente", "Ton taux continue d'être calculé sur le téléphone en attendant.", "Au retour du réseau", "2 actions n'ont pas pu être enregistrées", "Check-in au Zinc : trop loin du bar au moment de l'envoi.", "Vote pour Jade : la partie était terminée.", "La pinte, elle, est bien comptée.", "Jade a modifié la dépense entre-temps", "Sa version est gardée : 24 € au lieu de 21 €. Tu peux la modifier à nouveau.", "Voir la dépense".
(f) Simulated: static states. Real: persistent ordered queue surviving app kill (SYNC-06), grouped report, conflict resolution with the server version (SYNC-04), on-device BAC preview (SYNC-05).
(g) Levels: not shown.

#### Screen 3. "Chargements et écrans vides"
(a) IDs: MOT-10, QOL-07, QOL-09.
(b) Layout: row `h1` "Chargement" + chip "Recharger" (icon `undo` 14 px); skeleton (3 blocks height 54, the third 70% wide, gap 10) or loaded rows; draft card (`pan` row): amber `edit` icon, text `s`, "Reprendre" (`btn sm g`, no handler); label "Envoi de photos"; upload card: row "4 photos vers l'album" + "{up} %", progress bar 8 px, note `s`; label "Écran vide"; empty card (`pan` centred, padding 26): amber `cal` icon 40 px, `h3`, `s`, "Créer une soirée" (`btn sm` primary, no handler).
(c) States and interactions:
- Skeleton for **1800 ms** after mount, then 2 rows: "Samedi au Zinc" / "6 présents", "Anniv de Jade" / "jeudi". "Recharger" shows the skeleton again for 1800 ms.
- Upload: starts at **12 %**, +**4** every **300 ms**; when it reaches 100 it restarts at 12 (loop).
(d) Motion: skeleton shimmer 1400 ms linear infinite (gradient `#2C3734` → `#36433F` → `#2C3734`, size 200%); loaded rows `fadein` 350 ms; progress width 600 ms `easeOut`.
(e) Copy: "Chargement", "Recharger", "Samedi au Zinc", "6 présents", "Anniv de Jade", "jeudi", "Brouillon d'avis sur Le Zinc retrouvé.", "Reprendre", "Envoi de photos", "4 photos vers l'album", "{n} %", "Compressées et sans position GPS. Ça continue si tu quittes l'app.", "Écran vide", "Pas encore de soirée", "Lance la première, le crew sera prévenu.", "Créer une soirée".
(f) Simulated: timers. Real: skeletons replaced in place with no layout jump, custom pull-to-refresh (MOT-10, not shown), background upload with retry (QOL-09, retry not shown), blurred placeholders (QOL-09, not shown), drafts surviving app kill (QOL-07), an illustrated and animated empty state (MOT-10: the prototype shows a static icon).
(g) Levels: not shown.

#### Screen 4. "Confirmations, noms, formats"
(a) IDs: QOL-11, QOL-12, QOL-13.
(b) Layout: `h1` "Les détails"; "Supprimer la soirée" (`btn d full`, `trash` icon); label "Deux Lucas dans le crew"; 3 name rows (avatar + name `p` + detail `s`); label "Accords et formats"; row counter + "+1" (`btn sm g`); time row (button); amount row; destructive sheet.
(c) States and interactions:
- Delete button opens the sheet; both buttons close it.
- Names: "LB" (`a3`) "Lucas B." / "Même couleur partout"; "LM" (`a6`) "Lucas M." / "Surnom du crew : « Le Pilote »"; "I" (`a5`) "Inès 🌙 de la Fontaine-Saint-Martin" / "Les noms longs passent à la ligne".
- Counter: starts 1, "+1" increments: `n > 1` → "{n} verres", else "1 verre".
- Time row: tap toggles "il y a 5 min" ↔ "samedi, 22 h 47".
- Amount: "1 234,50 €".
(d) Motion: sheet 320 ms.
(e) Copy: "Les détails", "Supprimer la soirée", "Deux Lucas dans le crew", names and details above, "Accords et formats", "{n} verre(s)", "+1", "Dernier verre", "il y a 5 min", "samedi, 22 h 47", "Dépense", "1 234,50 €". Sheet: "Supprimer « Samedi au Zinc » ?", "Les verres, le récap et l'album de cette soirée disparaissent pour les 6 participants.", "Garder", "Supprimer la soirée".
(f) Simulated: no deletion. Real: deletion through the server, plural rules from the i18n library (QOL-12), narrow no-break space as the French thousands separator, automatic disambiguation of duplicate names (QOL-11), who may delete a party (not stated).
(g) Levels: not shown. ADP-06 vault applies to deletions.

#### Screen 5. "Recherche"
(a) IDs: QOL-23, ADP-05.
(b) Layout: search input (leading `search` icon, placeholder); recents (label "Récent" + 3 chips) when the query is empty; correction line; grouped results (label per group + rows with chevron, `fadein`).
(c) States and interactions:
- Recent chips set the query: "le zinc", "pintte", "jade".
- Typo dictionary (hard-coded): `pintte → pinte`, `zinkc → zinc`, `jdae → jade`. When corrected: "Résultats pour « {fix} »".
- Data: Lieux [Le Zinc, La Capsule, Quai 12]; Amis [Jade, Malik, Inès]; Boissons [Pinte 50 cl, Pinte UK 568 ml, Spritz]; Jeux [La Roulette, La Bombe]. Substring match on the corrected query; empty groups are hidden.
- No "no result" state.
(d) Motion: recents block and rows `fadein`.
(e) Copy: placeholder "Bars, amis, boissons, jeux", aria "Recherche", "Récent", "le zinc", "pintte", "jade", "Résultats pour « {x} »", group labels "Lieux", "Amis", "Boissons", "Jeux", item names above.
(f) Simulated: typo dictionary. Real: fuzzy matching (ADP-05), suggestions before typing (QOL-23), server and on-device sources (chat search stays on the device, MSG-09).
(g) Levels: not shown.

#### Screen 6. "Tentative de triche visible"
(a) IDs: AC-09.
(b) Layout: identity row: avatar 64 px `a3` "M", `h1` "Malik", tag `red` with `flag` icon 14 px "A tenté de tricher, 7 j"; rejection card (`pan`, `#4E2C27`): `h3` `#FFD3CB` + `s` `#F3B9AE`; note `s`; admin card (`pan`): `h3`, `s`, "C'était une erreur" (`btn sm g`); confirmation line (`p fadein`).
(c) States and interactions:
- "C'était une erreur": hides the tag and the admin card, shows the confirmation (no confirmation step, no pending, no undo).
(d) Motion: confirmation `fadein`.
(e) Copy: "Malik", "A tenté de tricher, 7 j", "Check-in refusé à La Capsule", "Samedi 1 h 03. Position simulée, personne du crew à côté. 0 point.", "Le crew a reçu une notif. La ligne apparaît aussi dans le fil et sur la page du bar.", "Tu es admin des Quais", "Si c'est une erreur (GPS de voiture, accessoire), tu peux annuler.", "C'était une erreur", "Annulé par toi. Le check-in est validé et Malik récupère ses points."
(f) Simulated: local flag. Real: server verdict (AC-06), 7-day shame badge, notification, timeline line, venue page line, admin overturn through the server, repeat-offender flag (AC-09, not shown).
(g) Levels: not shown.

### 2.8 ID coverage for the 7 boards

`SCREENS.md` and `FEATURES.md` list exactly the same IDs for each of these boards. Status per ID: **full** (screen shows the ID's core), **partial** (shown, with parts missing listed in § 5), **annotation** (only mentioned in text).

| Board | ID | Screen(s) | Coverage |
|---|---|---|---|
| JeuxCartes | O-50 | 1 | partial (no end of deck) |
| JeuxCartes | O-51 | 2 | partial (one player, no end card) |
| JeuxCartes | O-52 | 3 | full |
| JeuxCartes | O-53 | 4 | partial (rules to research) |
| JeuxCartes | O-56 | 5 | full |
| JeuxCartes | O-57 | 6 | full |
| JeuxCartes | O-58 | 7 | partial (truths not per level) |
| JeuxCartes | O-32 | 1, 2, 5 | partial (3 of 14 games) |
| JeuxCartes | O-47 | 1 (timer) | partial (no result cards, no robustness) |
| JeuxCartes | MOT-06 | 3, 7 (flip), all (pop) | partial (no deal, swipe, tremble) |
| JeuxAction | O-54 | 1 | full |
| JeuxAction | O-55 | 2 | partial (result at tap) |
| JeuxAction | O-59 | 3 | partial (no end, duplicate mines) |
| JeuxAction | O-60 | 4 | partial (clicks, 6 max) |
| JeuxAction | O-61 | 5 | full |
| JeuxAction | O-62 | 5 | partial (role leak, vote rule) |
| JeuxAction | O-63 | 6 | partial (drawer screen only) |
| JeuxAction | O-64 | 7 | partial (reward undefined) |
| JeuxAction | MOT-07 | 1 to 4, 6 | partial (no haptics, no roulette clicks) |
| Bar | O-66 | 1 | partial (8 recipes, no photos) |
| Bar | O-67 | 2 | full |
| Bar | O-68 | 1 | partial (no ingredient search) |
| Bar | O-69 | 3 | full |
| Bar | O-74 | 4 (as N-32) | retired |
| Bar | O-76 | 4 | full |
| Bar | N-32 | 2, 4 | partial (no assignment UI) |
| Argent | O-70 | 1, 2, 3 | partial (no pool creation, no add friends) |
| Argent | N-18 | 1 | partial (no participant choice) |
| Argent | N-19 | 2, 3 | partial (static chips) |
| Argent | N-20 | 4 | partial (alert not shown) |
| Argent | QOL-19 | 2 | partial (tap, not long-press) |
| Profil | PROF-01 | 1, 3 | full |
| Profil | PROF-02 | 1 | partial (6 of 10 sections) |
| Profil | PROF-03 | 3 | partial (un-hide only) |
| Profil | PROF-05 | 2 (note) | annotation |
| Profil | PROF-06 | 1 | partial (plain figures; can be set to Tous) |
| Profil | PROF-07 | 2 | partial (no entry from profile or settings) |
| Profil | PROF-09 | 3 | full |
| Profil | PROF-10 | 3 | partial (no first-time display) |
| Profil | COM-04 | 6 | partial (crew-name consent not shown) |
| Profil | COM-05 | 6 | partial (own switch and request policy missing) |
| Profil | N-13 | 4 | full |
| Profil | N-14 | 4 | partial (heatmap only) |
| Profil | N-15 | 4 | partial (Wrapped entry only) |
| Profil | N-34 | 1, 5 | partial (titles only) |
| Profil | JOY-03 | 5 | partial (no golden icon, no unlock rule) |
| Profil | JOY-11 | 5 | full |
| Profil | O-43 | 7 | partial (dead search) |
| Profil | O-72 | 1, 5 (as N-34) | retired |
| Reglages | PREF-01 | 2 (note) | annotation |
| Reglages | PREF-03 | 2, 3, 5 | partial (missing settings, § 5) |
| Reglages | PREF-05 | 2 | full |
| Reglages | O-06 | 4 | partial (email only) |
| Reglages | O-07 | 4 | partial (no "done" state) |
| Reglages | O-09 | 2 | full |
| Reglages | O-10 | 2 | partial (static row) |
| Reglages | O-12 | 1 | full |
| Reglages | O-13 | 4 | annotation |
| Reglages | O-77 | 1 | partial (dead row) |
| Reglages | N-35 | 3 | full |
| Reglages | N-17 | 4 (and Profil 4) | partial (no selective deletion) |
| Reglages | SEC-07 | 4 | partial (no new-device alert) |
| Reglages | JOY-05 | 5 | full |
| Reglages | JOY-07 | 1 | full |
| Reglages | JOY-10 | 5 | annotation |
| Reglages | QOL-24 | 5 | full |
| Etats | SYNC-01 | 1 | full |
| Etats | SYNC-02 | 1 | full |
| Etats | SYNC-03 | 1 | partial (no Retry) |
| Etats | SYNC-04 | 1, 2 | full |
| Etats | SYNC-05 | 2 (note) | annotation |
| Etats | SYNC-06 | 2 | full |
| Etats | SYNC-07 | 1 | partial (no queue, "OK" button) |
| Etats | O-31 | 1, 2 | full |
| Etats | MOT-10 | 3 | partial (no pull-to-refresh, static empty state) |
| Etats | QOL-07 | 3 | full |
| Etats | QOL-09 | 3 | partial (no retry, no placeholder) |
| Etats | QOL-11 | 4 | full |
| Etats | QOL-12 | 4 | full |
| Etats | QOL-13 | 4 | full |
| Etats | QOL-23 | 5 | partial (no suggestions, no empty result) |
| Etats | AC-09 | 6 | full |

### 2.9 Game rules as prototyped

Units: "gorgée" (sip) is the penalty unit in every game. No game in these boards records penalties per player except L'Autoroute (single counter) and the static Roulette line.

#### Le Grand Paquet (O-50)
- Deck: 6 demo cards cycled (`p1 % 6`): 2 Défi, 1 Règle, 2 Vote, 1 Mini-jeu (texts in § 2.1). Type colours: Défi `#F4B33D`, Règle `#8CCBEA`, Vote `#9BD8A8`, Mini-jeu `#D6C8F2`.
- Announced deck size: 52 (`left = 52 - drawn`). No end.
- Turn order: Hugo, Jade, Malik, Léon (`drawn % 4`).
- Rules text: Défi = do it or drink 2 sips; Règle = stays until the next Règle card; Vote = everyone points at the same time; game stops at the last card.
- Round timer: 20 s visual countdown (5% per second), restarts, no consequence.

#### L'Autoroute (O-51)
- 5 checkpoints `P1, Douane, P3, P4, P5`; customs at index 1 (checkpoint 2).
- Start card: 7 ♥.
- Draw: value 1 to 13 uniform, suit uniform among ♥ ♠ ♦ ♣ (with replacement).
- Road checkpoints: guess higher or lower than the current card; strict comparison, equal = miss.
- Customs: guess red (♥ ♦) or black (♠ ♣).
- Hit: advance one checkpoint; the drawn card becomes the current card.
- Miss: 1 sip, penalty + 1, back to checkpoint 1.
- After checkpoint 5: "done" message, silent restart at checkpoint 1, penalties kept.
- Face labels: A (1), V (11), D (12), R (13).

#### Face-à-face (O-52)
- 2 players (demo Jade top, rotated 180°, and Malik bottom), one value each, 1 to 13 uniform (start 9 vs 4).
- Both cards flip together. Lower value drinks `|a - b|` sips; tie = both toast ("trinquez").

#### Qui a ? (O-53)
- 4 demo questions, "Qui a déjà ..." prefix.
- Select everyone who did it (6 tiles), validate: each selected person drinks 1 sip. Zero selected = teasing message.

#### Je n'ai jamais (O-56)
- 3 levels: Gentil (3 cards, one "Carte du crew"), Piquant (2), Sans filtre (2).
- Read aloud; whoever did it drinks 1 sip. Crew cards are mixed into the deck.

#### Qui de nous deux ? (O-57)
- 2 named players, 3 demo questions.
- Group votes by tapping a name (unlimited taps in the demo). Most votes drinks at the end of the vote (end not modelled). Split bar = share of player A.

#### Action ou vérité (O-58)
- 3 levels Gentil / Piquant / Extrême, default Piquant.
- 3 actions per level; 3 truths shared by all levels. One counter for both lists.
- Refusing costs 2 sips.

#### La Bombe (O-54)
- One category for the round ("Une marque de bière"); one word each, no repetition.
- Hidden fuse 8 to 20 s (uniform), 200 ms ticks.
- Holder passes the phone after saying a word; rotation over 4 players.
- Visual warnings: colour white `#F1EEE6` below 33% of the fuse, amber `#F4B33D` from 33%, coral `#FF9C8A` from 66%; shake from 50%.
- Holder at the explosion drinks 2 sips.

#### La Roulette (O-55)
- 6 equal segments of 60° (6 names); spin = 1800° + 0 to 359°; 4 s `easeSpin`.
- Winner (= drinker) = segment under the top pointer: `floor(((360 - rot % 360) % 360) / 60)`.
- Round counter increments from the second spin.

#### Les Mines (O-59)
- 5 × 5 grid, 4 mines (initial cells 4, 10, 17, 23 counting from 1; random after "Nouvelle grille", duplicates possible).
- Players take turns (4-name rotation) to reveal one cell; a mine = 2 sips; a safe cell = nothing.
- No end condition.

#### Le Doigt (O-60)
- 2 to 6 fingers placed; "Choisir" enabled from 2.
- 1600 ms suspense with ripples, then one finger chosen uniformly at random; chosen grows to 1.35, others fade to 15%.
- No penalty rule written on screen (the catalogue says the phone "en garde un").

#### L'Imposteur (O-61)
- 6 players, 1 impostor (demo: player 5, Théo). Crew word "Pinte"; the impostor has no word and is told to blend in.
- Pass the phone: each player peeks, hides, passes.
- Discuss, then one group accusation. Right: the impostor drinks. Wrong: "Les espions gagnent" (no penalty stated).

#### Agent double (O-62)
- 6 players, 2 agents (demo: players 3 and 5, Malik and Théo). Crew word "Pinte", agents' word "Demi".
- Same pass-the-phone and single accusation. Hitting either agent counts as a win and that agent drinks.
- Catalogue: "5 joueurs minimum", "5 à 12" players, locked until "4 amis" (Jeux board).

#### Dessine vite (O-63)
- Drawer gets a word ("une capsule"), 60 s countdown that only starts after the first stroke.
- Others guess on their own phones (simulated: one guess every 4 s, third guess correct).
- "Effacer" clears and resets the timer to 60.
- Tag "3 téléphones"; catalogue "3 à 8" players, "Plusieurs téléphones".

#### Ça grimpe (O-64)
- Multiplier starts at × 1,00 and is multiplied by 1.035 every 120 ms (rounded to 2 decimals each tick).
- Crash point uniform between × 1.6 and × 6.6, drawn at the start.
- Players tap their own tile to get out; their exit multiplier is shown.
- At the crash, every player still in drinks (no sip count given). Exit multipliers have no effect.
- Shake above × 3.

### 2.10 Icon inventory (`design/icons.json`)

Format: viewBox 0 0 24 24, stroke width 2, round caps and joins, no fill. 53 icons:

| Name | Depicts |
|---|---|
| plus | plus sign |
| glass | tapered drinking glass with a fill line (pint) |
| drop | water drop |
| home | house |
| alert | warning triangle with exclamation mark |
| users | two people |
| pin | map pin |
| dice | die face showing five |
| user | one person |
| chat | speech bubble |
| crown | three-point crown |
| camera | camera |
| mic | microphone |
| clock | clock face |
| chev | chevron right |
| back | chevron left |
| check | check mark |
| x | cross |
| lock | padlock |
| shield | shield |
| bell | bell |
| cal | calendar |
| share | arrow up out of a tray (share) |
| car | car front |
| search | magnifier |
| undo | curved arrow back |
| battery | battery with low charge |
| star | five-point star |
| flame | flame |
| euro | euro sign |
| qr | QR code |
| filter | three decreasing lines (filter) |
| eye | eye |
| gear | gear / cog |
| more | three horizontal dots |
| send | paper plane |
| trophy | trophy cup |
| moon | crescent moon |
| phone | telephone handset |
| offline | crossed-out Wi-Fi |
| image | picture frame with mountains |
| edit | pencil |
| trash | bin |
| link | chain link |
| key | key |
| flag | flag |
| arrowup | arrow up |
| arrowdn | arrow down |
| sparkdot | single dot |
| wine | wine glass |
| shot | shot glass |
| bus | bus |
| hold | circle with a short line (hold / SOS ring) |

Icons these 7 boards use: back, glass, dice, arrowup, arrowdn, search, filter, chev, plus, check, euro, gear, users, user, crown, eye, share, link, x, more, bell, shield, lock, flag, key, camera, offline, clock, undo, edit, cal, trash.

Places where the boards use text glyphs or a wrong icon, i.e. icons the set lacks:
- Help / rules: "?" typed as text in the rules button (all card games).
- Minus: "−" typed as text in the split steppers (Argent). The set has `plus` but no `minus`.
- Reload / refresh: `undo` used for "Recharger" (Etats).
- Language / globe: `user` used for "Langue, région et unités" (Reglages).
- App update / download: `arrowdn` used for "Nouvelle version disponible".
- Mine result: "✓" / "✗" text glyphs (Les Mines). `check` and `x` exist but are not used there.
- Copy: no copy icon (IBAN uses a text tag "Copier").
- Device / session: no phone-device or laptop icon (`phone` is a call handset).
- Cheat flag reuses `flag`, which also means "report" in Reglages (one icon, two meanings).

Icons the boards would need in the app and the set lacks (no screen shows them yet): game identity icons (bomb, wheel, grid / mine, finger / touch, mask / spy, brush, rising curve, card deck), recipe / cocktail shaker, shopping list or cart, receipt, wallet / bank transfer, sun (light theme), speaker (sounds), sticker, export / download, sign out, timer / hourglass, golden icon variant (JOY-07 reward), minus, help.

### 2.11 Copy that is a designer annotation, not UI

These strings describe the prototype to a reviewer. They must not ship as written:
- "Touchez l'écran pour poser vos doigts (ici, un clic par doigt)." (Le Doigt)
- "Clavier numérique avec virgule. Monnaie : euro." (Nouvelle dépense)
- "Réponse simulée du serveur" + the 4 mode notes (Etats 1)
- "Les points, couronnes et dépassements attendent la réponse du serveur avant de s'animer." (Etats 1)
- "Même couleur partout", "Les noms longs passent à la ligne" (Etats 4)
- "Simuler : une pinte à 6,50 €" (Budget)
- "Généré depuis les cocktails choisis. Touche pour cocher, chacun voit qui ramène quoi." (Courses: the first half may stay as a fact, the second half is an explanation)
- "Le crew a reçu une notif. La ligne apparaît aussi dans le fil et sur la page du bar." (Triche)
- "[Nom de l'app] 1.0.0" (placeholder)
- "Touche l'étiquette d'une section pour choisir qui la voit." (Mon profil: acceptable only as the one-time first-use sentence allowed by PROMPT ui_copy)

---

## 3. Decisions proposed

1. The FAB (O-32) and the "?" rules button (O-46) go on all 14 games, including the 7 action games, because both IDs say "every game" / "mid-game". Exception to discuss: Le Doigt is full-bleed multi-touch, a FAB there would catch fingers; put it in the bottom bar instead.
2. One level naming set for every game, taken from O-45 (Normal, Hard, Extreme) mapped to one French set chosen in `VOICE.md`. Per-game flavour names ("Sans filtre") may be the label of the third level only if the catalogue uses the same three slots.
3. Treat these prototype behaviours as bugs, not rules: Roulette result at tap (reveal on stop), Autoroute duplicate card display (show previous and drawn), duplicate mines (draw without replacement), Agent double coral card (same card colour for everyone in Agent double; keep coral only for the Imposteur who has no word, if the game designer keeps that), Face-à-face values changing during the flip back, Action ou vérité 350 ms re-flip overlapping a 550 ms flip.
4. Le Doigt identifies the chosen finger visually, never by name, because touches carry no identity.
5. Ça grimpe needs a rule that makes the exit multiplier matter, or the idle copy changes. Proposed rule for the game subagent to evaluate: the player who stays in longest without crashing hands out sips equal to their rounded multiplier. Decision owner: O-64 subagent.
6. Profile audiences: keep the nested model of the prototype (Moi < Crews < Amis < Tous) only if `PROMPT.md` owner agrees, and record it in `GLOSSARY.md` / an ADR, because PROF-08 tests "every audience for every section" depend on it.
7. Identity becomes a PROF-02 section with its own audience; the stranger preview and "Ce qu'un inconnu voit" must stop assuming first name and photo are always visible.
8. Error toasts use an action verb ("Réessayer" when a retry makes sense, otherwise a dismiss gesture or "Fermer"), never "OK".
9. Recipe units follow the user's unit system by default (PREF-04), the cl / oz switch stays as a local override.
10. Gender: every game result and profile string with a gendered word ("Il boit", "est choisi", "Ami depuis", "Ouverte", "bars à lui", "qu'elle accepte", "innocent") gets a neutral phrasing or a declared-pronoun mechanism. Decision for Recon-Voice / VOICE.md.

---

## 4. Assumptions

- A-DESIGNC-1: The 52-card count in Le Grand Paquet is a placeholder, not a deck size requirement. Based on: the deck has 6 cards and the counter is `52 - drawn`. Verify: O-50 game subagent decides deck size from content (O-65).
- A-DESIGNC-2: The Grand Paquet round timer (20 s) is a visual demo of O-47 round timers, not the intended duration. Based on: no consequence at 0 and no setting on this board (the Jeux board has a round timer setting). Verify: Jeux board game sheet.
- A-DESIGNC-3: "Ça grimpe" is the team's interpretation of S2M's "La Courbe". Based on: FEATURES.md maps O-64 to this screen, PROMPT says S2M's rules are not public. Verify: O-64 subagent research.
- A-DESIGNC-4: Plural "vous" in pass-the-phone games ("Touchez", "Discutez, puis votez") addresses the group, not one user, and is intended. Based on: these lines are spoken to several players. Verify: Recon-Voice rule in `VOICE.md` (PROMPT bans "vous creeping into a tu app").
- A-DESIGNC-5: "Il boit" after a vote is a demo shortcut, not a voice choice. Based on: it is also used for Jade in "Qui de nous deux ?". Verify: VOICE.md.
- A-DESIGNC-6: The Argent board lives under the "Moi" tab (active tab, euro button on Mon profil). The Bar screen shows "Soirée" active by mistake. Based on: tab bars in the files. Verify: Main.dc.html / navigation spec.
- A-DESIGNC-7: The budget alert at 90% is a notification; the 80% message tier and the 70% colour tier are only on-screen. Based on: copy "On te prévient à 90 %." Verify: N-20 spec.
- A-DESIGNC-8: Demo audiences on Mon profil (Bars, Avis, Soirées at "Tous") are Hugo's own choices, not new-account defaults. Based on: PROMPT profiles defaults say nothing public until the user turns it on. Verify: PROF-02 spec.
- A-DESIGNC-9: "Position pendant les soirées" on by default is demo state. Based on: N-07 says location is shared only when the person turns it on. Verify: N-07 spec.
- A-DESIGNC-10: Colours used in these boards but missing from `tokens.json` are intentional tint text shades and should be added as tokens rather than replaced: `#E8D3A4` (amber muted text), `#F3B9AE` (danger muted text), `#D4F2DB` (ok strong text), `#D6EEF8` (water strong text), `#3A3010` (text on amber, muted), `#5A4632` (text on `#F2C6A0`), `#1E3A48` (text on water), `#3A4440` (muted on light), `#C2412E` (red card suit), `#9A7A33` and `#4A5246` (heatmap steps), `#E3E7E4` (neutral tag text), `#3D4A46` / `#232D2A` (input border / fill), `#36433F` (skeleton highlight). Verify: DESIGN.md owner.

---

## 5. Scope changes and gaps

### 5.1 IDs whose screen is missing or partial (detail)

- O-32: FAB missing on Face-à-face, Qui a ?, Qui de nous deux ?, Action ou vérité and on all 7 action games. The confirmation toast exists only on Le Grand Paquet. Note: the toast "Pinte ajoutée, la partie continue" is a success toast; SYNC-07 allows it only when it carries new information (here: the game was not left).
- O-46: no "?" rules button on any action game.
- O-47: no shareable result card in these boards (the Jeux board has one for the last game); no "someone leaves" state; round timer only on Grand Paquet and Dessine vite.
- O-49: penalty counter only on L'Autoroute; Roulette penalties are a static line.
- O-63: guesser screen, lobby, word choice, scoring, round end missing.
- O-66 / O-68: ingredient search missing although the placeholder and empty state invite it.
- N-32: assignment ("who brings what") UI missing; "Ajouter à la liste de courses" has no target.
- O-70: create a pool, add friends, add an expense from the pool (`plus` button dead) missing.
- N-18: choosing who is in the round and which drink is missing; the round adds drinks to other people's BAC without their confirmation (open question for AC-07 verification and consent).
- N-20: the alert itself is not shown.
- QOL-19: the prototype copies on tap; the ID and SCREENS.md say long-press with haptic.
- PROF-02: missing sections identity, crews, titles and badges, member card.
- PROF-03: no way to hide one item.
- PROF-07: no entry point from Mon profil; Settings links to the Profil board root.
- PROF-10: first-time automatic display not shown.
- COM-05: own "open to meeting people" switch and the "who can send requests" setting (nobody / friends of friends / everyone) not shown; block / report sheet not shown (`more` button dead).
- O-43: search dead; duplicate-request rule not shown.
- N-15: monthly recap not shown.
- N-34: badges for organising, hydration, designated driving, getting home safe, game wins not shown.
- JOY-03: golden icon promised by the easter egg is not in the icon list.
- O-06: no change-password row.
- O-07: no "account deleted" confirmation.
- O-10: time format row static.
- PREF-03: missing on the settings screens: drink presets, novice driver mode, country picker (row dead), currency picker (static), first day of week, emergency numbers.
- N-17: selective deletion missing.
- SEC-07: new-device sign-in alert missing.
- SYNC-03: no "Retry" action anywhere.
- SYNC-05: re-sync on foreground only implied by a note.
- SYNC-07: toast queue not shown; error toasts do not auto-dismiss.
- MOT-10: pull-to-refresh, launch screen, badge unlock, in-app notification not shown; empty state is a static icon, not "illustrated and animated".
- QOL-09: retry and blurred placeholders not shown.
- QOL-23: suggestions before typing and the no-result state missing.
- AC-09: repeat-offender flag not shown.
- Adaptive levels (operating principle 5, ADP-04, ADP-07): none of these 7 boards shows level 1 to 3 behaviour. Spec writers have only `DESIGN.md` § 6 and `PROMPT.md` drunk_mode to go on for games, money, profile and settings. Relevant explicit rules: ADP-06 vault (large pool expense, delete account, delete history, change weight), DESIGN.md § 6 (no shake, no long sequences at levels 2 and 3, which affects La Bombe and Ça grimpe), SYNC-07 (bigger toasts at 2 and 3), MSG-10 (big record button at 2 and 3).

### 5.2 Conflicts between the prototype and PROMPT.md or DESIGN.md

1. Game levels: O-45 "Normal, Hard, Extreme" vs prototype "Gentil / Piquant / Sans filtre" and "Gentil / Piquant / Extrême" (and "Normal / Difficile / Extrême" on the Jeux board).
2. Player counts: Le Doigt max 6 vs catalogue "2 à 8"; Les Mines 4-name rotation vs "2 à 8"; La Bombe 4-name rotation vs "3 à 12"; Roulette 6 fixed vs "2 à 12".
3. O-62 "5 players minimum" vs Jeux board unlock "4 amis".
4. SCREENS.md says Action ou vérité "card flips to a level-based prompt": only actions depend on the level.
5. SCREENS.md says "Every game has a '?' rules sheet, the floating add-drink button": not true on screens 3, 4, 6, 7 (FAB) of JeuxCartes and on all of JeuxAction.
6. SCREENS.md and QOL-19 say IBAN long-press; prototype uses tap.
7. MOT-07 asks for roulette haptic clicks and real deceleration with clicks; none in the prototype (expected: web). MOT-06 asks for dealing, swipe and a card that trembles before a penalty; not shown.
8. DESIGN.md § 1 "amber is a scarce resource, never two competing amber elements except BAC + primary button" vs: pool detail with 3 amber "Marquer payé" buttons; Etats screen 3 with amber draft icon, amber empty-state icon, amber progress bar and an amber button; Mes stats with amber heatmap cells and an amber Wrapped card; Mon profil amber title tag; Réglages amber logo + amber travel banner (screen 2); Qui de nous deux with two amber vote counts + amber bar.
9. DESIGN.md § 4 touch targets ≥ 44 vs: split steppers 34 × 34 (Argent), refuse button 40 × 40 (Amis), audience chips min-height 32 (Mon profil), segmented items 38 (token `segmentedItem: 38`), guess rows 40 (Dessine vite). The token itself is below the 44 rule.
10. DESIGN.md § 7 "No emoji as icons": ✓ / ✗ glyphs in Les Mines.
11. DESIGN.md voice sample "Check-in refusé : position simulée. Aucun point." vs Etats "... Position simulée, personne du crew à côté. 0 point."
12. SYNC-03 ("Retry when retrying makes sense") and DESIGN.md button rule (verb that names the action) vs error toasts with "OK".
13. Offline wording: Etats 1 "en attente du réseau" vs Etats 2 "en attente" for the same state.
14. PROF-02 identity audience vs "Ton prénom, ta photo" always visible to strangers (Voir comme, Qui voit quoi); stranger profile shows a handle, own preview shows a first name.
15. PROF-06 / RANK-09: the Public preset caps Records at Amis, but cycling the Records chip manually reaches "Tous".
16. COM-06 / PROF-05 ("strangers never see where a specific person is right now") vs Nora's public open party "Quiz au Quai 12, 21 h" shown to a stranger. COM-05 allows hosts to publish open parties; the rule that reconciles both is not written.
17. AC-09 "a line on the venue page" vs COM-01 public venue pages: a named cheat line must stay crew-only.
18. SEC-06 / N-07 (location deleted once the recap is built) vs settings copy "jamais gardée".
19. Quiet hours default "De 2 h à 11 h" overlaps live party hours (2 am); with QOL-02's 6 am day boundary, crew notifications of a party in progress would be muted. Not a contradiction of the letter, but of the night-out priority.
20. PREF-02 lists mg/100 ml for the UK; the BAC unit segmented control offers g/L, mg/L, ‰, % only.
21. PREF-01 / SYNC-01: settings, audiences, friend requests, transfers and sessions change instantly with no pending or rollback state in the prototype.
22. Catalogue (Jeux board) says Ça grimpe "Descends avant le crash"; the game screen says "Sors avant le crash".
23. Anti-slop ui_copy "Made-up numbers": demo amounts do not add up (pool expenses 116,30 € vs total 142,80 €; round "26 €" vs expense "Tournée de Malik 28,00 €"). Demo data is placeholder, but the app must compute these.
24. QOL-12 formats: "1 240 €" uses a plain space (French needs a narrow no-break space); "24 €" vs "24,00 €" across boards; missing singulars ("1 gorgées", "1 doigts", "1 sections cachées").

### 5.3 Proposed new IDs

- None proposed as new features. Two items may deserve an ID if the orchestrator wants them tracked separately:
  - GAME-RULES-SHEET (P0): shared "?" rules sheet component for all 14 games (today implicit in O-46).
  - GAME-FAB (P0): shared in-game add-drink button with its toast rule (today O-32), since the prototype only shows it on 3 games.

---

## 6. Glossary additions

| Concept | Code / EN UI | FR UI | Note |
|---|---|---|---|
| Penalty unit in games | `Sip` / sip | gorgée | every game result |
| Game session | `GameSession` / game | partie | "la partie continue"; must not be confused with `Party` (soirée) |
| Round of a game | `GameRound` / round | manche | collides with glossary `Round` (tournée): needs a distinct code term |
| Penalty count | `PenaltyCount` / penalties | pénalités | L'Autoroute, Roulette |
| Checkpoint (Autoroute) | `Checkpoint` / checkpoint | péage | |
| Customs (Autoroute) | `CustomsCheckpoint` / customs | douane | |
| Card type | `CardType` (dare, rule, vote, minigame) | Défi, Règle, Vote, Mini-jeu | Grand Paquet |
| Crew card | `CrewCard` / crew card | carte du crew | N-33 |
| Game level | `GameLevel` (normal, hard, extreme) | to set in VOICE.md | not `UiLevel` |
| Fuse | `Fuse` / fuse | mèche | La Bombe |
| Cash out (crash game) | `CashOut` / get out | sortir | Ça grimpe |
| Crash point | `CrashPoint` / crash | crash | Ça grimpe |
| Hidden role | `HiddenRole` (impostor, double_agent) | imposteur, agent double | |
| Secret word | `SecretWord` / word | mot | |
| Recipe | `Recipe` / recipe | recette | |
| Mixer | `Mixer` / mixer | mixeur | O-69 |
| Shopping list item | `ShoppingItem` / list item | courses | N-32 |
| Alibi | `Alibi` / alibi | alibi | O-76 |
| Transfer to settle | `Settlement` / transfer | virement | O-70 |
| Expense | `Expense` / expense | dépense | |
| Split mode | `SplitMode` (equal, shares, amounts, percent) | Égal, Parts, Montants, % | N-19 |
| Party budget | `PartyBudget` / budget | budget | N-20 |
| Audience preset | `AudiencePreset` (private, friends, public) | Privé, Amis, Public | PROF-01 |
| Findability | `Findability` (search, exact_username, nobody) | Recherche, Pseudo exact, Personne | PROF-09 |
| View as | `ViewAs` / view as | voir comme | PROF-07 |
| Hidden item | `HiddenItem` / hidden | caché | PROF-03 |
| Member card | `MemberCard` / member card | carte de membre | JOY-11 |
| App icon variant | `AppIconVariant` / app icon | icône de l'app | JOY-03 |
| Quiet hours | `QuietHours` / quiet hours | heures calmes | N-35 |
| Crew digest | `CrewDigest` / digest | résumé du crew | N-31 |
| Session (signed-in device) | `DeviceSession` / session | connecté sur | SEC-07 |
| Passkey | `Passkey` / passkey | clé d'accès | |
| Travel suggestion | `TravelSuggestion` / travel prompt | (banner, no noun) | PREF-05 |
| Draft | `Draft` / draft | brouillon | QOL-07 |
| Cheat attempt | `CheatAttempt` / cheat attempt | tentative de triche | AC-09 |
| Shame badge | `ShameBadge` / flag | "A tenté de tricher, 7 j" | AC-09 |

---

## 7. Blockers

None. This audit needs no account, key or paid service.

---

## 8. Sources

All local files, read 2026-10-26. No web source was used; every fact above comes from these files.
- `C:\Users\aubin\Documents\soiree-crew\PROMPT.md` (mission, operating_principles, glossary, design_reference, scope, drunk_mode, motion, anti_slop, sync_and_feedback, security_privacy, localization, guardrails)
- `C:\Users\aubin\Documents\soiree-crew\design\DESIGN.md`
- `C:\Users\aubin\Documents\soiree-crew\design\SCREENS.md`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\README.md`
- `C:\Users\aubin\Documents\soiree-crew\design\tokens.json`
- `C:\Users\aubin\Documents\soiree-crew\design\base.css`
- `C:\Users\aubin\Documents\soiree-crew\design\icons.json`
- `C:\Users\aubin\Documents\soiree-crew\research\README.md`
- `C:\Users\aubin\Documents\soiree-crew\FEATURES.md`
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\JeuxCartes.dc.html`, `JeuxAction.dc.html`, `Bar.dc.html`, `Argent.dc.html`, `Profil.dc.html`, `Reglages.dc.html`, `Etats.dc.html` (read in full)
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Jeux.dc.html` (catalogue data and level names only, for cross-checks)
- `C:\Users\aubin\Documents\soiree-crew\design\prototype\Main.dc.html` (O-62 and O-64 entries only)

---

## 9. Design tells to watch (anti-slop rules of PROMPT.md applied to these boards)

From `<design_patterns>`:
- One dominant colour, one accent, one neutral; amber is scarce. Watch the amber overuse listed in § 5.2 item 8. Member card and Wrapped entry are full amber surfaces: acceptable as signature moments only if the screen has no other amber.
- No cards inside cards: Voir comme preview (`pan` with rows) and the payment card inside the pool screen are panels with rows, fine; do not nest `pan` in `pan`.
- No grids of identical cards (icon + title + text): watch Mon profil's 6 identical section cards and Mes stats' 2 × 2 label / value tiles.
- No "big number + small label" landing layout: watch "On te doit / Tu dois" tiles and the member card stat row; they carry real figures, so keep them but vary hierarchy.
- No rounded icon tile above every heading, no pill above headings: the app icon picker uses icon tiles legitimately; do not spread the pattern.
- No emojis as icons or bullets: replace ✓ / ✗ in Les Mines with `check` / `x`. Emoji in names ("Inès 🌙 ...") is user content, allowed.
- Status dots pulsing with no state change: none here; keep the live dot off these boards.
- No elastic bounce on routine actions: pop (overshoot 1.08) is used for every card draw, mine reveal, egg; MOT-01 reserves overshoot for signature moments. The pop keyframe is a mild overshoot: the motion review should decide whether routine draws keep it.
- Gradients only functional: the roulette conic gradient is allowed (DESIGN.md § 1); the skeleton gradient is functional.
- Generic illustrations: recipe photos are flat colour blocks until real photos (DESIGN.md § 7). The empty state uses an icon, not a mascot: keep it that way when animating it (MOT-10).

From `<ui_copy>`:
- No description under a setting that repeats its name: every Notifications and Confidentialité row has a subtitle. Most add facts ("Le lendemain à 11 h", "Coupés en mode silencieux"); watch "Rappels d'eau / Pendant tes soirées" and "Statistiques d'usage / Anonymes" for redundancy.
- No explanation text everywhere: remove the annotations of § 2.11.
- No confirmation toast for every action: "Pinte ajoutée, la partie continue" is the only success toast here; it must earn its place (it says the game continues) or go.
- Errors always surface with their reason and an action: error toasts have reasons, but "OK" is not an action.
- Fake numbers and ranges: catalogue durations "10 à 20 min", "5 à 15 min" (Jeux board, O-50 itself says "10 to 20 min") are round ranges; PROMPT says a displayed number is computed or not displayed. Decide in the O-44 spec whether durations become measured averages.
- One tone everywhere: jokes in games and alibis are fine; Sécurité, deletion sheet and cheat rejection are plain, as required. The delete-account sheet text is a good model.
- French: sentence case is respected everywhere. "vous" appears in group instructions (A-DESIGNC-4) and in a user review ("venez tôt", user content). Mixed tu / vous on one screen in Ça grimpe ("Plus tu restes" vs "Touchez votre nom") must be resolved.
- Slang: "notif", "taf", "T'as quoi ?", "T'es en Belgique ?" are light and in voice; keep them out of SOS, errors and legal text.

From `<writing_patterns>`:
- No em or en dashes in any string of these 7 boards (checked by reading every string). Keep it that way (SLOP-04).
- Three-item lists: "Pinte blonde, spritz, ti-punch.", "Versé, tchin, couronne." are content lists, fine; watch for automatic triplets when real copy is written.
- Ellipses: "Ne bougez plus...", "Qui a déjà...", "Je n'ai jamais...", "..." (bomb label) use three periods; pick one form (U+2026 or three periods) in VOICE.md.
- Quotes: French guillemets « » are used consistently with inner spaces; keep them (SLOP-04 flags mixed quote styles).
