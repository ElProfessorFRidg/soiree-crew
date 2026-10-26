# Recon-Design, part A: Arrivee, Soiree, ModeBourre, Systeme, Soirees, Securite

Report by Recon-Design (part A of 3), phase 0. Everything below comes from the prototype files, `design/DESIGN.md`, `design/SCREENS.md`, `design/tokens.json`, `design/base.css`, `FEATURES.md` and `PROMPT.md`. No external sources were used. French UI copy is quoted verbatim, including its punctuation (French non-breaking spaces before `?`, `!` and `:` are shown as plain spaces).

## 1. Summary

- All 81 IDs mapped to these six boards in `FEATURES.md` (which matches `SCREENS.md` exactly) are accounted for below. O-79 is `retired` in `FEATURES.md` and is shown only as the invitation web page (N-30).
- Every screen's inline CSS is byte-identical to `design/base.css`. No board adds its own styles, so all motion classes (`pop1/pop2`, `fadein`, `sheet`, `toast`, `drop`, etc.) have the timings of `base.css`.
- The add-drink sequence (MOT-03) is fully specified in `Soiree.dc.html`: amber fill 700 ms, fake server 900 ms, digit roll in 14 steps of 45 ms (630 ms), Undo window 5000 ms from the server answer, double-tap guard while pending. The bubbles that MOT-03 requires are not shown (a `bub` keyframe exists in `base.css` but no board here uses it).
- Biggest conflicts with `PROMPT.md`: (1) SOS needs a 2 s press-and-hold, but ADP-04 and DESIGN §6 say that at levels 2 and 3 nothing important may need a long-press, and SOS is on the level 2 and 3 screens; (2) the BAC notice (O-19, guardrails) is missing on the level 1, 2 and 3 screens and on every lock-screen, widget and watch surface; (3) many "done" states show instantly with no pending state (actionable notifications, add friend, "home safe", SOS "Alerte envoyée", cheers proof, Live Activity "+ Pinte"), which SYNC-02 forbids for the real app; (4) the curve's legal-limit and personal-limit lines are fixed pixels that match neither the 0.5 g/L limit nor the slider value, and the threshold colours are relative to the curve's own bounding box, not to the 0.25 / 0.60 mg/L thresholds.
- The adaptive level thresholds appear in the prototype as "0,5, 1,0 et 1,5 g/L", but `PROMPT.md` says ADP-01 must set them after research. Treat these as placeholders.
- Demo data is inconsistent across boards (Sami is "rentré" on the Party screen but "pas de nouvelles depuis 35 min" on the live dashboard; "batterie 6 %" is on Malik in one board and on "Malik B." in another; the day picker defaults to "dim 14" while the lock screen says "samedi 14 juin"). The spec writers must not copy demo data as rules.

## 2. Findings

### 2.0 Shared conventions (all six boards)

- Phone frame 390 × 844, radius 46, bezel `#0F1413` 9 px. Screen content `.sc`: padding 58 px top, 20 px sides, 22 px bottom, gap 16 (some screens override gap to 14 or 12).
- Tab bar (`.tab`): 5 items Soirée, Crew, Jeux, Bars, Moi; icon 22 px, label 11 px weight 650, inactive `#97A19C`, active amber `#F4B33D`; padding 10 px 6 px 30 px; 1 px top line `#34403C`; each item min 60 × 44. The Crew tab links to `Radar.dc.html`.
- Motion classes from `base.css`, with exact values:
  - `fadein`: keyframe `tin` (translateY 14 px → 0, opacity 0 → 1), 350 ms, `cubic-bezier(.2,.8,.2,1)` (easeOut).
  - `pop1` / `pop2`: scale .7 → 1.08 (at 60%) → 1, 350 ms easeOut. The two identical classes alternate so the animation restarts on each change.
  - `.sheet`: keyframe `sup` (translateY 100% → 0), 320 ms easeOut. Radius 26 top corners, padding 12 px 20 px 34 px, shadow `0 -14px 40px rgba(0,0,0,.4)`.
  - `.toast`: keyframe `tin`, 280 ms easeOut; left/right 14 px, bottom 100 px (overridden to 30 px on the history screen), radius 16, background `#F1EEE6`, text `#1E2624`, 14 px weight 650; error variant `#FF7A66`.
  - `.sw` switch: 52 × 32, knob 24, knob slide 220 ms `cubic-bezier(.3,.7,.3,1)` (easeToggle), track colour transition 200 ms; on = amber.
  - `.btn:active`: scale .97, 120 ms. Disabled: opacity .4.
  - `.dot.live`: opacity 1 → .35 → 1, 1600 ms ease-in-out, infinite.
  - `.bar i` (progress): width transition 600 ms easeOut.
  - Reduce Motion: `@media (prefers-reduced-motion:reduce)` sets every animation and transition to .01 ms and 1 iteration.
- Numerals (`.num`): weight 900, width 62%, line height .86, letter-spacing -1 px, tabular figures.
- French number formatting in logic: `toFixed(2).replace('.',',')` (decimal comma). Times are written "22 h 47" (space, "h", space, two-digit minutes) everywhere in the app UI; the OS lock-screen clock uses "23:41".

### 2.1 Board "Arrivée et inscription" (`Arrivee.dc.html`)

Board IDs: O-01, O-02, O-03, O-04, O-05, O-08, PREF-02, PREF-04, QOL-08, QOL-15, SEC-08 (11). No tab bar on any screen. No adaptive-level behaviour (onboarding happens sober; nothing in the file).

Logic class state: `{age:null, w:72, wp:'pop1', wMsg:false, sex:'h', nov:false, health:false, stats:false, mode:'c', crew:'', draft:true, n:{sort:true, inv:true, crew:true, eau:true, recap:true, bars:false}}`. No timers, no fake server.

#### Screen 1. Âge
- (a) O-02.
- (b) Top to bottom (content pushed apart with `justify-content: space-between`, top block margin-top 48): app-name placeholder "[Nom de l'app]" (small), h1 at 46 px, body text; conditional result panel; two full-width buttons stacked with 10 px gap (primary amber, then outline).
- (c) "Oui…" sets `age='ok'` and shows a panel with a mint check icon (22 px) and "C'est noté.". "Non" sets `age='no'` and shows a panel "Reviens le jour de tes 18 ans." / "L'app ne s'ouvre pas avant.". The two answers can be switched freely; nothing is locked or persisted.
- (d) Both result panels enter with `fadein` (350 ms easeOut).
- (e) Copy: "[Nom de l'app]"; "Tu as 18 ans ou plus ?"; "L'app parle d'alcool, de taux et de soirées. Elle est réservée aux majeurs."; "Reviens le jour de tes 18 ans."; "L'app ne s'ouvre pas avant."; "C'est noté."; buttons "Oui, j'ai 18 ans ou plus", "Non".
- (f) Simulated: the answer lives in component state only. Real: persist the answer on the device (before any account) and on the account; decide what "Non" does on the next launch (the prototype does not say). There is no navigation to screen 2.

#### Screen 2. Bienvenue
- (a) QOL-15 (try before signing up), O-01 entry.
- (b) Top block (margin-top 56, gap 18): 84 × 84 amber tile, radius 26, with the glass icon 44 px; h1 at 44 px; body. Bottom block (gap 10): primary "Créer un compte", secondary "Jouer sans compte", centred small text, outline "J'ai déjà un compte".
- (c) No handlers.
- (d) None.
- (e) "Qui sort ce soir, où, et qui paie la prochaine."; "Ton taux en direct, les jeux, les bars du crew et les comptes entre potes."; "Créer un compte"; "Jouer sans compte"; "Les jeux et le Bar marchent sans compte. Le crew et les soirées en demandent un."; "J'ai déjà un compte".
- (f) Real: guest mode with games and the Bar, then sign-up asked only when a crew, party or sync is needed (QOL-15).

#### Screen 3. Connexion
- (a) O-01, O-08 (policy readable without account), SEC-07 indirectly (passkeys).
- (b) Back icon button 44 × 44 (`aria-label="Retour"`); h1; small subtitle; four full-width buttons (gap 10, margin-top 12): "Continuer avec Apple" (background `#F1EEE6`, i.e. light), "Continuer avec Google" (secondary), "Utiliser une clé d'accès" (secondary, key icon), "Recevoir un lien par e-mail" (outline, link icon); legal small text pinned at the bottom (`margin-top:auto`).
- (c) No handlers.
- (e) "Crée ton compte"; "Pas de mot de passe à retenir."; "Continuer avec Apple"; "Continuer avec Google"; "Utiliser une clé d'accès"; "Recevoir un lien par e-mail"; "En continuant, tu acceptes les conditions d'utilisation. La politique de confidentialité se lit sans compte."
- (f) Real: Sign in with Apple, Google, passkey, magic link. Note O-01 says "email and Google"; the prototype has no email + password path (only magic link). The legal links are plain text, not links.

#### Screen 4. Profil
- (a) O-01 (first name and username separate), O-04, QOL-07 (draft restored), QOL-08 (autofill attributes).
- (b) Draft banner (pan, row): amber pencil icon, small text, 36 × 36 close icon button (`aria-label="Fermer"`). h1. Three fields with labels: "Prénom" (`autocomplete="given-name"`, value "Hugo"), "Pseudo" (`autocomplete="username"`, value "@hugo.dlb", mint tag "Libre" inside the field at right 12 px / top 14 px), "E-mail" (`type="email"`, `inputmode="email"`, `autocomplete="email"`, value "hugo@exemple.fr"). All inputs are `readonly` in the prototype. Section label. Weight row: label "Poids", minus icon button (44 × 44, glyph "−" 26 px), value `num` 38 px min-width 86 "{{w}} kg", plus icon button. Conditional error line. Segmented "Femme / Homme". Small note. Primary "Continuer" pinned at bottom.
- (c) Weight: default 72 kg, step 1 kg per tap (no long-press repeat). `setW(d)`: if the new value is < 35 or > 250, the value does not change and `wMsg=true` shows the error; otherwise the value changes, `wMsg=false`, and the pop class alternates. Bounds are therefore 35 to 250 kg inclusive. Sex: default Homme (`sex:'h'`); tap sets `f` or `h`. Draft banner close sets `draft=false` (shown by default).
- (d) Weight value pops (`pop1/pop2`, 350 ms easeOut) on every accepted change; no pop when the bound is hit. Segmented selection has no animation.
- (e) "Brouillon retrouvé. Tu reprends où tu t'étais arrêté."; "On fait connaissance"; "Prénom"; "Pseudo"; "Libre"; "E-mail"; "Pour estimer ton taux"; "Poids"; "{{w}} kg"; "Entre 35 et 250 kg."; "Femme"; "Homme"; "Sert seulement au calcul du taux. Personne d'autre ne le voit."; "Continuer". Accessibility labels: "Fermer", "Moins", "Plus".
- (f) Real: username availability check against the server (the "Libre" tag is static), draft persistence across app kill (QOL-07), numeric keypad for weight if typed, profile photo (O-04 asks for one; not shown). "Tu reprends où tu t'étais arrêté." is masculine only.

#### Screen 5. Réglages détectés
- (a) PREF-02, PREF-04, O-05.
- (b) h1, small subtitle, 8 rows (min height 54, 1 px divider), each with a trailing value and chevron 18 px, except "Jeune permis" which has a switch. Primary "C'est bon" at bottom.
- (c) Only the novice switch is wired (`nov`, default off). Rows: Langue = "Français"; Pays pour la limite légale = "France", sub-line "0,5 g/L de sang"; Jeune permis, sub-line "Limite à 0,2 g/L"; Unités = "cl, kg"; Taux affiché = "g/L de sang"; Verre standard = "10 g d'alcool"; Monnaie et heure = "€, 24 h"; Numéros d'urgence = "112, 15".
- (d) Switch knob 220 ms easeToggle.
- (e) "Réglé pour la France"; "D'après la langue et la région de ton téléphone. Langue, pays et unités se changent séparément."; row labels and values as listed above; "C'est bon".
- (f) Real: defaults computed from device language and region without location permission (PREF-02), each row opens its own picker, values stored on the server (PREF-01). Missing versus PREF-02: first day of the week, drink-size presets, date format (only "24 h" is shown).

#### Screen 6. Notifications
- (a) O-03, N-35 (seed).
- (b) h1, small subtitle, 6 switch rows from `defs`, one row "Heures calmes" with chevron, primary "Continuer".
- (c) Six toggles, defaults: "Qui sort ce soir" on, "Invitations" on, "Le crew en soirée" on, "Rappels d'eau" on, "Récap prêt" on, "Prises de bar" off. Each tap flips its own key.
- (e) "Ce qui peut te réveiller"; "Le reste attend que tu ouvres l'app."; rows (label / sub-line): "Qui sort ce soir" / "Quand un pote lance une sortie"; "Invitations" / "Soirées et demandes d'ami"; "Le crew en soirée" / "Arrivées, départs, dépassements"; "Rappels d'eau" / "Pendant tes soirées"; "Récap prêt" / "Le lendemain, à une heure correcte"; "Prises de bar" / "Quand on te pique un bar"; "Heures calmes" / "Rien entre 2 h et 11 h, sauf un SOS"; "Continuer".
- (f) Real: OS permission prompt (not shown), per-type settings on the server.

#### Screen 7. Consentements
- (a) SEC-08, O-08.
- (b) h1; two pans, each with an h3 + switch on top and a small paragraph; row link "Lire la politique de confidentialité" with chevron; small note; primary "Continuer".
- (c) Health consent default off; stats default off. "Continuer" is `disabled` while health is off (opacity .4). Stats are optional.
- (e) "Tes données, ton accord"; "Verres et taux"; "Ça compte comme des données de santé. On les garde chiffrées, en Europe, seulement si tu dis oui. Sans ça, l'app ne peut pas calculer ton taux."; "Statistiques d'usage"; "Anonymes, pour savoir quels écrans servent. Facultatif."; "Lire la politique de confidentialité"; "Tu peux retirer ton accord quand tu veux dans Réglages."; "Continuer". Switch labels: "Accepter le stockage des verres et du taux", "Statistiques d'usage".
- (f) Real: explicit consent recorded server-side with timestamp and version (SEC-08), revocable in Settings.

#### Screen 8. Ton crew
- (a) N-30 (invite by link or QR), QOL-05 (link opens app or web page).
- (b) h1, segmented "Créer / Rejoindre". Create mode (fadein): field "Nom du crew" (placeholder "Les Quais"), pan with a 92 × 92 light QR tile (QR icon 64 px), crew name h3, small text, chip "Copier le lien" with link icon; small note. Join mode (fadein): secondary "Scanner un QR", field "Ou colle un lien d'invitation" (placeholder "lien.app/c/..."). Primary "Terminer" at bottom.
- (c) Mode default "Créer". Typing the name updates the invite card live (`crewShown = crew || 'Les Quais'`). Copy and scan have no handlers.
- (d) Mode switch content enters with `fadein` 350 ms.
- (e) "Ton crew"; "Créer"; "Rejoindre"; "Nom du crew"; "Les Quais" (placeholder and fallback); "Fais scanner ce QR ou envoie le lien."; "Copier le lien"; "Le lien ouvre l'app si elle est installée, sinon une page d'invitation."; "Scanner un QR"; "Ou colle un lien d'invitation"; "lien.app/c/..."; "Terminer".
- (f) Real: crew created on the server, real QR and universal link, QR scanner, link copy with "Copié" feedback (QOL-19 pattern from Argent). The QR is a static icon.

### 2.2 Board "Soirée en cours" (`Soiree.dc.html`)

Board IDs: HUB-01, O-15, O-16, O-17, O-18, O-19, O-20, O-21, O-22, O-23, O-24, O-25, O-26, O-27, O-28, O-29, O-30, O-34, O-81, O-83, N-16, QOL-01, QOL-02, QOL-06, JOY-02, JOY-12, AI-01, AC-07, MOT-03, MOT-04, ADP-04, ADP-05 (32).

Logic class state (initial): `bac:0.42, shown:0.42, unit:0 (g/L), drinks:6, water:2, pending:false, confirmed:false, undo:false, fill:0, wp:'pop1', roll:'pop1', pick:2 (Pinte), t:22*60+47 (22 h 47), photo:false, hist:[4 items], delToast:false, lastDel:null, period:0 (Jour), cmp:false, scrub:62, lim:8, warn:true, wOpt:1 (45 min), nov:false, cam:0 (front)`. Timers `t1`, `t2`, interval `iv`, all cleared on unmount.

Demo BAC model in the logic (placeholders, Recon-BAC owns the real model):
- Each confirmed pint adds exactly +0.16 g/L.
- Elimination 0.15 g/L per hour: "Retour à 0" = `bac / 0.15` hours; "Volant" = `max(0, (bac - limit) / 0.15)` hours with limit 0.5 g/L, or 0.2 g/L when novice.
- Breath conversion: mg/L of breath = g/L of blood / 2.
- Peak = current + 0.2 g/L, time fixed at "23 h 40".
- Duration format `dur(x)`: `floor(x) + ' h ' + round(frac*60)` padded to 2 digits. Bug: a fraction above 59.5 min prints "60" (e.g. "1 h 60").
- Worked values: initial 0,42 g/L → "Retour à 0" "2 h 48", "Volant" "OK" (mint); novice on → "1 h 28" (red). After one pint 0,58 → "3 h 52", "Volant" "0 h 32" (red). Unit swap shows 0,42 g/L as "0,21" mg/L.

#### Screen 1. Écran Soirée (niveau 0)
- (a) HUB-01, O-15, O-16, O-17, O-18, O-19, O-34, QOL-01, JOY-02, JOY-12, MOT-03, ADP-04 (double-tap guard, Undo), AC-07 (indirect), RANK-02 entry, TER entry, N-28 entry, N-18 entry.
- (b) Top to bottom (gap 14):
  1. Header row: greeting (small), party name h3 "Samedi au Zinc" preceded by the live dot (8 px, mint, pulse 1600 ms); trailing icon button to `Messages.dc.html` (`aria-label="Discussions"`).
  2. BAC hero: a button (`aria-label="Changer d'unité"`) holding the number in amber `num` 124 px, and at its right (bottom-aligned, padding-bottom 14) the unit h3 and the alternate-unit line (small).
  3. Trend line (body).
  4. Grid of 2 pans: "Retour à 0" + `num` 34 px duration; "Volant" + `num` 34 px duration or "OK" (red when over, mint when under).
  5. BAC notice (`.dis`, 12 px).
  6. Action row (gap 10): hero primary "Encore une pinte" (flex 1, min-height 64, 18 px, plus icon) with an inner fill layer; secondary square 64 px "Autre verre" (glass icon, link to `#`); water square 64 px (`btn w2`, drop icon, `aria-label="Verre d'eau"`).
  7. Status row: "{{drinksTxt}}, {{waterTxt}}" (small) + pending tag "Envoi" (clock icon) or mint tag "Enregistré" (check icon).
  8. Label "Le crew ce soir" + horizontal scroller of 5 crew cells (min-width 66): avatar 38, name 13 px bold, BAC 12 px, optional tag 11 px.
  9. Row link to `Bars.dc.html`: amber crown icon, "Au Zinc", sub-line about the boss, trailing chip "Check-in".
  10. Row link to `Classements.dc.html`: trophy icon, "Classement de la soirée", sub-line with the top 3, chevron.
  11. Grid of 4 tiles: Jeux (`Jeux.dc.html`), Tournée (`Argent.dc.html`), Je rentre (`Securite.dc.html`), SOS (`Securite.dc.html`, danger tint background `#4E2C27`, text `#FFB3A6`).
  12. Pan "Défi du soir" with amber dice icon.
  13. Undo toast (conditional), tab bar with Soirée active.
- (c) Interactions:
  - Tap BAC: `unit` flips 0 ↔ 1. Unit 0: number = g/L, unit "g/L", alt line "soit X mg/L d'air". Unit 1: number = g/L / 2, unit "mg/L", alt line "soit X g/L de sang". The second item of each unit triple ("de sang", "d'air expiré") is defined but never rendered.
  - "Encore une pinte" (`add()`): ignored while `pending` (double-tap guard). On tap: `pending=true`, `confirmed=false`, `fill=100`. After 900 ms (fake server): `pending=false`, `confirmed=true`, `bac += 0.16`, `drinks += 1`, `undo=true`, `fill=0`, roll class alternates, then `animateTo(newBac)`. 5000 ms after the confirmation, `undo=false` and `confirmed=false` (the "Enregistré" tag and the toast disappear together).
  - Undo ("Annuler" in the toast): clears the 5 s timer, `undo=false`, `confirmed=false`, `bac -= 0.16`, `drinks -= 1`, and rolls the digits back with the same `animateTo`. No pending state, no server call.
  - Water button: `water += 1`, pop class alternates. No pending, no Undo.
  - Greeting by device hour: h < 5 "Encore debout ?"; h < 11 "Bien dormi ?"; h < 17 "Rien de prévu ce soir ?"; h < 21 "L'apéro commence."; else "Ça commence à chauffer.".
  - Plurals: "1 verre" / "N verres", "1 eau" / "N eaux" (strictly `> 1` for plural, so 0 gives "0 verre", "0 eau").
  - Leaderboard sub-line "1. Malik 7, 2. toi {{drinks}}, 3. Jade 5": only my count changes; the order never changes (after one pint I tie Malik at 7 and stay second).
- (d) Motion:
  - Fill layer inside the button: colour `#E09A20` (amberPressed), height 0 → 100% with `transition: height .7s cubic-bezier(.2,.8,.2,1)`; it drains back to 0 over 700 ms when the server answers at 900 ms.
  - BAC digits: `animateTo` interpolates linearly in 14 steps every 45 ms (630 ms total); at the same moment the number gets `pop1/pop2` (350 ms easeOut).
  - Unit swap: instant, no pop in the prototype (DESIGN §5 says "instant + pop 350 ms").
  - "Enregistré" tag: `fadein` 350 ms. "Envoi" tag: no animation.
  - Undo toast: `tin` 280 ms easeOut.
  - Water button: pop 350 ms.
  - Live dot: 1600 ms opacity loop.
- (e) Copy: greetings above; "Samedi au Zinc"; units "g/L", "mg/L", "soit {x} mg/L d'air", "soit {x} g/L de sang" (and unused "de sang", "d'air expiré"); trend "Ça monte. Pic estimé à {x} g/L vers 23 h 40."; "Retour à 0"; "Volant"; "OK"; "Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base."; "Encore une pinte"; "Envoi"; "Enregistré"; "{n} verre(s), {n} eau(x)"; "Le crew ce soir"; crew tags "batterie 6 %", "SAM", "rentré"; "Au Zinc"; "Boss du mois : Inès. Tu es à 2 check-ins."; "Check-in"; "Classement de la soirée"; "1. Malik 7, 2. toi {n}, 3. Jade 5"; tiles "Jeux", "Tournée", "Je rentre", "SOS"; "Défi du soir : commander ta prochaine pinte avec l'accent belge."; toast "Pinte ajoutée à {hour}" + "Annuler". Accessibility labels: "Discussions", "Changer d'unité", "Autre verre", "Verre d'eau"; nav "Navigation principale".
  - Demo crew: Malik (a3) 0,81 tag "batterie 6 %" red; Jade (a2) 0,55; Inès (a5) 0,48; Théo (a4) 0,00 tag "SAM" water; Sami (a6) 0,62 tag "rentré" mint.
- (f) Simulated vs real: the 900 ms timeout becomes the server answer through the sync layer (SYNC-01 to 03, idempotency key); the BAC comes from the real model and is replaced by the server value; Undo must be a real reversible mutation; "Same again" (QOL-01) must re-log the last drink with size, price and venue, not a fixed pint; the trend, peak time, crew BACs, boss line and leaderboard must be live data; the greeting must not repeat two nights in a row (JOY-02, not modelled); the dare must come from crew cards when they exist (JOY-12). Toast hour bug: "Pinte ajoutée à {hour}" uses the add-sheet time stepper state (`t`, 22 h 47), not the time the drink was logged.
- (g) This is level 0 only. Levels 1 to 3 are on `ModeBourre.dc.html`.

#### Screen 2. Ajouter un verre
- (a) O-20, O-21, O-22, O-83, AI-01, ADP-05, AC-07 (photo makes it verified).
- (b) Dimmed party screen behind (opacity .35, BAC at 110 px), scrim `.dim`, tall sheet from `top: 70px`, scrollable. Inside: grab handle; title row h2 "Ajouter" + close icon button; dark pan (background `#1E2624`) with amber mic icon and the quoted example sentence; chips row of parsed tags (two amber tags, two neutral tags); 4-column grid of 8 quick-add tiles (min-height 72, centred, label 12 px, sub-line 11 px); label "Mes boissons"; two rows of custom drinks, the first with a trailing hint and an open context menu (pan `#3A4643`, width 170, at right 0 / top 40, shadow `0 10px 30px rgba(0,0,0,.4)`) holding three transparent chips Modifier / Déplacer / Retirer (danger text `#FFB3A6`); time row "Bu à" with ‹ and › icon buttons around `num` 30 px; conditional explanation; photo row with switch; primary full-width "Ajouter {drink}".
- (c) Quick-add: tap selects one tile (`pick`, default index 2 "Pinte"); the button label becomes "Ajouter " + lowercase tile name. Time stepper: starts at 22 h 47, −1 min per tap (no lower bound), +1 min per tap capped at 22 h 50 (the simulated "now"); when `t >= 22 h 50` the explanation line shows. Photo switch toggles (default off). The AI example, parsed chips and long-press menu are static. Close and Add have no handlers.
- (d) Sheet slide-up 320 ms easeOut; context menu `fadein` 350 ms.
- (e) "Ajouter"; "« Deux pintes et un shot au Zinc, c'est moi qui paie »"; tags "2 × Pinte 50 cl", "1 × Shot 3 cl", "Au Zinc", "Tournée payée par toi"; tiles (label / sub-line): "Demi" / "25 cl", "Bière" / "33 cl", "Pinte" / "50 cl", "Vin" / "12 cl", "Shot" / "3 cl", "Cocktail" / "20 cl", "Cidre" / "33 cl", "Soft" / "sans alcool"; "Mes boissons"; "Triple 33 cl" / "8,4 %" / "Appui long"; "Spritz maison" / "11 %, 20 cl"; "Modifier"; "Déplacer"; "Retirer"; "Bu à"; "Pas d'heure dans le futur : un verre pas encore bu ne compte pas."; "Photo du verre"; "Un verre en photo compte au classement"; "Ajouter {pinte}". Accessibility labels: "Fermer", "Une minute plus tôt", "Une minute plus tard", "Photo du verre".
- (f) Real: the AI parse (AI-01) with a local fallback parser offline; voice input; real long-press menu with reorder; "now" = the real clock; camera-only live photo for verification (AC-04 / AC-07); custom-drawn glass icons for quick adds (O-20 requires them; tiles are text only); drink sizes per locale (PREF-02).

#### Screen 3. Historique de la soirée
- (a) O-23, QOL-02, AC-07, ADP-04 (Undo).
- (b) Top row: back icon button + neutral tag "Samedi, jusqu'à 6 h". h1, small explanation. Group header row (no divider): h3 "{n} × Pinte 50 cl", sub-line, down-arrow icon. Indented list (padding-left 12, gap 6) of swipeable items: behind each item, two square buttons "Modifier" (secondary) and "Supprimer" (danger), full height; the item (background `#28322F`, padding 12 × 14) shows `num` 22 px time, venue (small), optional mint tag "vérifié". Then a group row "2 × Shot 3 cl" with times and tag "non vérifié"; a group row "3 × Eau" with a water icon; a hint line. Delete toast at bottom 30 px.
- (c) Demo items: 21 h 04 Au Zinc verified; 21 h 40 Au Zinc verified, shown already swiped (`x:-150`); 22 h 18 Au Zinc not verified (no tag); 22 h 51 La Capsule verified. "Supprimer" removes the item and shows the "Verre retiré" toast; "Annuler" re-inserts it at its old index with `x:0`. The delete toast has no timeout in the logic (it stays until Undo), unlike the 5 s of the party screen. "Modifier" and the group collapse have no handlers.
- (d) Item `transform: translateX(...)` with `transition: transform .3s` (no easing specified, so CSS default `ease`); items enter with `fadein`; toast 280 ms.
- (e) "Samedi, jusqu'à 6 h"; "Ce que t'as bu"; "Une soirée compte jusqu'à 6 h du matin. Ton verre de 2 h est sur samedi."; "{n} × Pinte 50 cl"; "Touche pour replier"; "Modifier"; "Supprimer"; "vérifié"; "2 × Shot 3 cl"; "23 h 12, 23 h 13"; "non vérifié"; "3 × Eau"; "Bien joué"; "Glisse un verre vers la gauche pour le modifier ou le supprimer."; "Verre retiré"; "Annuler".
- (f) Real: swipe gesture (the prototype only renders a pre-swiped item); delete as a server mutation with rollback; 5 s Undo window to be confirmed (ambiguous here); verified status computed by the server (AC-07). Delete history is a vault action at high levels (ADP-06), not reflected here.

#### Screen 4. Courbe
- (a) O-24, O-25, O-28, O-29, O-81, N-16, MOT-04.
- (b) Title row h1 "Ta courbe" + chip "Comparer" (people icon). Segmented with 5 periods. Chart pan (background `#28322F`, radius 18, padding 12 × 8 × 8): SVG viewBox 340 × 210 (`role="img"`, `aria-label="Courbe d'alcoolémie"`) with a dashed coral line at y = 122 ("limite légale", label `#FFB3A6` 11 px), a dotted amber line at y = 88 ("ta limite", label `#F8CE7A` 11 px), the optional friend polyline (water blue, 2 px, opacity .7) with a 9 px-radius avatar dot "J" at x = 300, the main polyline (3.5 px, round joins and caps, stroke = vertical gradient), a 1 px vertical scrub line. Range input 0..100 (`aria-label="Moment de la soirée"`, amber accent). Row with scrub time (small) and value (h3 amber). Filter chips (static): "Tout" (on), "Au Zinc", "Bière", "Avec Jade". Grid of 3 stat pans (`num` 28 px). Small note.
- (c) Period tap swaps the dataset (16 points each, in g/L, y = 200 − v × 200, x = i × 340/15):
  - Jour: 0, 0, .05, .1, .2, .32, .42, .5, .58, .62, .55, .45, .33, .2, .1, 0
  - Semaine: .1, .3, .2, 0, 0, .5, .8, .3, 0, .1, .6, .7, .2, 0, 0, .1
  - Mois: .3, .5, .4, .6, .2, .7, .5, .3, .6, .4, .5, .7, .3, .5, .4, .6
  - Total: .2, .3, .25, .35, .3, .4, .33, .38, .36, .42, .4, .45, .41, .44, .43, .46
  - Moyenne: .32, .33, .31, .34, .36, .35, .37, .36, .38, .37, .39, .38, .4, .39, .41, .4
  - Compare: friend data = `max(0, v × 0.8 + ((i mod 3) − 1) × 0.04)`; the avatar dot sits at the y of point 13 (x fixed at 300).
  - Scrub: index = round(scrub/100 × 15); line x = scrub/100 × 340. Time label: on Jour, 20 h 00 + round(scrub/100 × 480) minutes (20 h to 4 h); on other periods "Point {index+1}". Value label: data[index] in g/L. Default scrub 62 gives index 9, "0 h 58", "0,62 g/L".
  - Threshold gradient (`linearGradient`, bottom to top, default objectBoundingBox units): mint `#9BD8A8` 0 to .35, amber `#F4B33D` .45 to .7, coral `#FF7A66` from .8.
  - Stats (static): "Ce mois" "214 g", "Total" "1 870 g", "Moyenne" "62 g".
- (d) Friend polyline `fadein` 350 ms. No draw-on animation, no redraw transition on period change, no peak marker, no avatar gliding (MOT-04 asks for all of these). Chip toggle is instant.
- (e) "Ta courbe"; "Comparer"; "Jour", "Semaine", "Mois", "Total", "Moyenne"; "limite légale"; "ta limite"; "J"; "Point {n}"; "{x} g/L"; "Tout"; "Au Zinc"; "Bière"; "Avec Jade"; "Ce mois"; "Total"; "Moyenne"; "214 g"; "1 870 g"; "62 g"; "En grammes d'alcool pur. Moyenne sur 7 jours glissants."
- (f) Real: zoom and pan (O-24, not shown), the trace following the finger (the prototype uses a range slider), hour labels that never overlap (absent), profile reminder under the curve (absent), threshold colours at absolute values, limit lines at the real legal limit and at the user's own limit (O-25), real filters by period, venue, drink type and person (N-16), grams computed from real drinks (O-28).

#### Screen 5. Limite, eau et volant
- (a) O-26, O-27, O-18, O-05, O-19.
- (b) Back icon button; h1 "Avant de sortir". Pan 1: h3 + amber `num` 34 px value, range input, row "Me prévenir quand j'approche" + switch. Pan 2: h3 "Rappel d'eau" + 4-item segmented. Pan 3: h3 "Volant", rows "Pays" / "France" + chevron, "Jeune permis" + switch, "Sous la limite à" + amber h3 time (no divider). BAC notice.
- (c) Limit slider min 2, max 15, step 1 (default), shown as value/10: 0,2 to 1,5 g/L by 0,1; default 8 → "0,8 g/L". Warn switch default on. Water interval options "30 min", "45 min", "1 h", "Off", default "45 min". Novice switch (shared state with screen 1, so it also changes "Volant" there). "Sous la limite à" is hard-coded: "3 h 05" normally, "5 h 20" with novice on.
- (d) Switch 220 ms; no other motion.
- (e) "Avant de sortir"; "Ma limite ce soir"; "{x} g/L"; "Me prévenir quand j'approche"; "Rappel d'eau"; "30 min"; "45 min"; "1 h"; "Off"; "Volant"; "Pays"; "France"; "Jeune permis"; "0,2 g/L au lieu de 0,5"; "Sous la limite à"; "3 h 05" / "5 h 20"; "Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base." Accessibility labels: "Limite", "Alerte", "Jeune permis".
- (f) Real: time under the limit computed from the model and the country table (22+ countries, O-18); alerts near the limit "without spam" (O-26, rules not shown); scheduled water reminders (O-27) that respect quiet hours. Note "Off" is English in a French UI.

#### Screen 6. Partager ma soirée
- (a) O-30, QOL-06.
- (b) Full-bleed camera placeholder (background `#3A4643`, person icon 180 px, colour `#56635F`). Over it: top row close icon button + chip with camera icon and camera label; middle pan (background `rgba(30,38,36,.92)`) with party name, "6 potes", amber `num` 64 px peak, small stats, a 300 × 60 amber sparkline; bottom: 4 tiles (upload icon + label 12 px) and a secondary "Autres apps" button.
- (c) Camera chip toggles "Caméra avant" (default) / "Caméra arrière". Share tiles and close have no handlers.
- (e) "Caméra avant" / "Caméra arrière"; "Samedi au Zinc"; "6 potes"; "0,74"; "pic en g/L, 6 verres, 3 eaux"; "Story Insta"; "Snapchat"; "TikTok"; "WhatsApp"; "Autres apps". Close label "Fermer".
- (f) Real: front and back camera capture, rendered story image in each target's format (Instagram Stories, Snapchat Creative Kit, TikTok, WhatsApp, system share sheet).

### 2.3 Board "Mode bourré" (`ModeBourre.dc.html`)

Board IDs: ADP-01, ADP-02, ADP-03, ADP-06, ADP-07, ADP-08 (6). Logic state: `{lvl:2, vault:['Quitter le crew Les Quais','Dépense de 84 € dans la cagnotte'], guard:{c:true, a:false}, eco:true}`. No timers. No screen on this board has a tab bar.

#### Screen 1. Niveau 1, pompette
- (a) ADP-01 (level 1 variant of HUB-01), ADP-07.
- (b) Header row: h3 "Samedi au Zinc" + amber tag "Niveau 1". BAC amber `num` 140 px "0,62". Body 18 px "g/L. Ça monte encore un peu.". Hero primary "Encore une pinte" min-height 72, 20 px, icon 26 px. Grid of 2: water "Eau" and secondary "Autre", each min-height 64, 18 px, icon 24. Label 15 px "Le crew". Avatars 52 × 52, 18 px initials (M, J, I, T), gap 14. One collapsed row (min-height 56, 17 px) "Jeux, tournée, classement" + chevron 22. Bottom grid of 2: secondary "Je rentre" and danger "SOS", min-height 60, linking to `Securite.dc.html`.
- (c) No handlers (static).
- (e) "Samedi au Zinc"; "Niveau 1"; "0,62"; "g/L. Ça monte encore un peu."; "Encore une pinte"; "Eau"; "Autre"; "Le crew"; "Jeux, tournée, classement"; "Je rentre"; "SOS".
- (g) Matches DESIGN §6 level 1: BAC 140, hero 72, avatars 52, secondary actions collapsed into one row. No BAC notice, no live dot, no crew BAC values, no Undo shown.

#### Screen 2. Niveau 2, bien entamé
- (a) ADP-02, ADP-01 (manual level selector), ADP-05 (voice), ADP-06 (note).
- (b) Header row: amber `num` 72 px "1,08" + amber tag "Niveau {lvl}". Segmented 0 / 1 / 2 / 3 (`aria-label="Niveau d'écran"`). Small note. Grid 2 × 3 filling the remaining height (`flex:1`, `grid-auto-rows:1fr`), each button column layout, icon 34 px, 20 px text: "Verre" (primary amber), "Eau" (water), "Crew" (secondary, link `Radar.dc.html`), "Jeux" (secondary, `Jeux.dc.html`), "Je rentre" (secondary, `Securite.dc.html`), "SOS" (danger, `Securite.dc.html`). Outline full-width "Dis ce que tu bois" with mic icon 24, min-height 60.
- (c) Level selector: default 2; tapping 0..3 changes only the tag and the note text, not the layout. Notes: 0 "Niveau 0 : tout l'écran."; 1 "Niveau 1 : plus gros, moins d'options."; 2 "Niveau 2 : six gros boutons. Les actions sensibles attendent demain."; 3 "Niveau 3 : rentrer, appeler, boire de l'eau."; for levels 0 and 1 the note gets " Les verrous suivent quand même ton taux." appended.
- (e) "1,08"; "Niveau {n}"; "0", "1", "2", "3"; the four notes and suffix above; "Verre"; "Eau"; "Crew"; "Jeux"; "Je rentre"; "SOS"; "Dis ce que tu bois".
- (g) Matches DESIGN §6 level 2. No unit label next to "1,08", no BAC notice.

#### Screen 3. Niveau 3, cuit
- (a) ADP-03.
- (b) Gap 12. Body 20 px bold question. Stacked buttons: primary "Je rentre" min-height 104, 26 px, icon 32 (link `Securite.dc.html`); secondary "Appeler Jade" 104, 24 px (phone icon 30); secondary "Un VTC" 104, 24 px (car icon); water "Un verre d'eau" 88, 24 px; danger "SOS" 88, 24 px (link). Outline small (40 px, 14 px) "Ajouter un verre quand même", centred at the bottom.
- (c) No handlers.
- (e) "Tu rentres comment ?"; "Je rentre"; "Appeler Jade"; "Un VTC"; "Un verre d'eau"; "SOS"; "Ajouter un verre quand même".
- (g) Matches DESIGN §6 level 3 (88 to 104 px). No BAC shown at all. The demoted add button is 40 px, below the "≥ 88 px at level 3" target rule of DESIGN §3 (acceptable only if it counts as non-essential; must be decided). The order differs from DESIGN §6 ("Je rentre, Appeler un pote, VTC, Eau, SOS" matches).

#### Screen 4. Garde-fous du mode soirée
- (a) ADP-06, ADP-08, ADP-10 (settings part), ADP-04 (Undo duration).
- (b) Back icon button to `Reglages.dc.html`; h1 "Mode soirée". Label "Mis de côté jusqu'à demain" + vault rows (amber lock icon 20, label, sub-line, secondary small "Annuler"). Empty text. Label "Messages retenus jusqu'au lendemain" + 2 contact rows (avatar a7, name, sub-line, switch). Label "Réglages" + rows "Seuils des niveaux" (chevron), "Économie de batterie" (switch), "Annuler pendant" (value). Closing small note.
- (c) Vault "Annuler" removes that item; when the list is empty "Rien en attente." shows. Guard switches: Camille on, Alex off. Eco switch default on.
- (d) Vault rows `fadein` 350 ms; switches 220 ms.
- (e) "Mode soirée"; "Mis de côté jusqu'à demain"; "Quitter le crew Les Quais"; "Dépense de 84 € dans la cagnotte"; "À confirmer demain à partir de 11 h"; "Annuler"; "Rien en attente."; "Messages retenus jusqu'au lendemain"; "Camille"; "Alex"; "Au niveau 2 et plus"; "Réglages"; "Seuils des niveaux"; "0,5, 1,0 et 1,5 g/L"; "Économie de batterie"; "Sous 20 % pendant une soirée"; "Annuler pendant"; "Après chaque action"; "5 s"; "Ces réglages se changent à jeun. En soirée, ils sont en lecture seule." Switch label pattern "Retenir les messages à {name}"; "Économie de batterie".
- (f) Real: vault items are queued server-side mutations that need a next-morning confirmation; the 11 h unlock time; read-only enforcement during a party (the prototype switches still toggle); eco mode tied to the real battery level.
- Numbers on this board: level thresholds 0,5 / 1,0 / 1,5 g/L; vault unlock 11 h; eco below 20 % battery; Undo 5 s; message hold "au niveau 2 et plus"; level 1 BAC 140 px, hero 72, secondary 64 and 60, avatars 52; level 2 BAC 72, tiles icon 34 / 20 px, voice 60; level 3 buttons 104 / 104 / 104 / 88 / 88, demoted add 40.

### 2.4 Board "Hors de l'app" (`Systeme.dc.html`)

Board IDs: HUB-02, HUB-03, HUB-04, O-33, O-79 (retired), QOL-03, QOL-04, QOL-05, MOT-11, N-30, MSG-04 (11). Logic state `{lock:0, lp:'pop1', w:0, wp:'pop1', done:{}}`. No timers, no fake server.

#### Screen 1. Écran verrouillé et Live Activity
- (a) HUB-02, HUB-03, MSG-04, MOT-11.
- (b) Wallpaper `#2B3B40`. Dynamic Island compact: 168 × 36, radius 20, black, top 12 centred, amber glass icon 16 + `num` 20 px "0,58". Content centred from padding-top 74: date "samedi 14 juin" (weight 600), clock `num` 96 px "23:41" (letter-spacing 0). Three lock widgets (translucent pans `rgba(255,255,255,.14)`, padding 10 × 12): amber "0,58" / "g/L"; water "23:55" / "eau"; "4" / "sortent". Live Activity pan (`rgba(20,26,25,.82)`, full width, pinned low): row "Samedi au Zinc" + "Retour à 0 dans 4 h 50"; row amber `num` 52 px "0,58" + small buttons "Pinte" (primary, plus icon) and water (icon only, no label); status line. Message notification pan: lock icon, "Jade" / "Nouveau message", "maintenant". Android note pan (`rgba(20,26,25,.6)`): tag "Android" + text.
- (c) "+ Pinte" increments `lock` and alternates the pop class. Status: 0 → "Ajoute un verre sans déverrouiller"; 1 → "1 pinte ajoutée sans ouvrir l'app"; n > 1 → "{n} pintes ajoutées sans ouvrir l'app". Water button has no handler.
- (d) "Pinte" button pops 350 ms on each tap.
- (e) "0,58"; "samedi 14 juin"; "23:41"; "g/L"; "23:55"; "eau"; "4"; "sortent"; "Samedi au Zinc"; "Retour à 0 dans 4 h 50"; "Pinte"; status strings above; "Jade"; "Nouveau message"; "maintenant"; "Android"; "Notification fixe pendant la soirée, mêmes boutons" (designer annotation, not UI copy).
- (f) Real: ActivityKit Live Activity with Dynamic Island compact and expanded, interactive App Intent buttons, the Android ongoing notification with the same buttons, lock-screen widgets (BAC, next water, who is out), encrypted push decrypted on device or kept generic (MSG-04). No double counting between Live Activity, widget and app (O-33). The water button needs an accessibility label.

#### Screen 2. Notifications où on répond direct
- (a) QOL-03.
- (b) Wallpaper; group header h3 "Samedi au Zinc"; 3 notification pans (`rgba(20,26,25,.88)`, `fadein`): app name + time, body, two small buttons (primary + secondary) or a mint "done" tag; closing note.
- (c) Either button of a notification sets `done[k]=true`: buttons disappear, the done tag appears. Both buttons give the same done text, so "Pas ce soir" shows "Réponse envoyée à Malik" (fine) but "C'est pas moi" shows "Tournée enregistrée" and "Plus tard" shows "Check-in envoyé" (wrong for the second button).
- (d) Pans `fadein` 350 ms; done tag appears without animation.
- (e) "[Nom de l'app]"; (time / text / button 1 / button 2 / done) "il y a 2 min" / "Malik sort ce soir. Tu viens ?" / "J'arrive" / "Pas ce soir" / "Réponse envoyée à Malik"; "il y a 5 min" / "Théo a payé une tournée. 2 pintes pour toi ?" / "Valider" / "C'est pas moi" / "Tournée enregistrée"; "maintenant" / "T'es au Zinc ? Fais ton check-in." / "Check-in" / "Plus tard" / "Check-in envoyé"; note "Pas de notif pour tes propres actions. Chaque notif ouvre l'écran exact." (annotation).
- (f) Real: notification actions (UNNotificationAction / Android actions) going through the sync layer; the done state only after the server confirms (SYNC-02); a check-in from a notification still goes through anti-cheat; deep link to the exact item; grouping per party (thread identifier).

#### Screen 3. Widgets et raccourcis
- (a) O-33, QOL-04, MOT-11.
- (b) Wallpaper `#33474B`. 2-column grid (gap 14) of square widgets (background `#1E2624`, `aspect-ratio:1`): small widget "Retour à 0 : 4 h 50" / amber `num` 54 px "0,58" / "g/L, ça descend"; medium-like square "Ajouter" with 2 × 2 small buttons Pinte (primary), Vin, Shot (secondary), Eau (water), and a counter line. Wide widget: party name + amber `num` 30 px "0,58", 320 × 70 amber polyline, four small buttons Pinte / Vin / Shot / Eau. Shortcuts pan (`rgba(20,26,25,.85)`) with 3 rows.
- (c) In the 2 × 2 widget, Pinte, Vin and Shot all call the same handler: `w += 1`, pop class alternates on all three. Eau and every button of the wide widget have no handler. Counter: 0 → "Sans ouvrir l'app"; 1 → "1 ajout depuis le widget"; n > 1 → "{n} ajouts depuis le widget".
- (d) Pop 350 ms on the three buttons.
- (e) "Retour à 0 : 4 h 50"; "0,58"; "g/L, ça descend"; "Ajouter"; "Pinte"; "Vin"; "Shot"; "Eau"; counter strings; "Samedi au Zinc"; "Bouton Action de l'iPhone" / "Ajoute ta boisson habituelle"; "« Dis Siri, ajoute une bière »" / "Raccourcis et App Actions sur Android"; "Centre de contrôle, tuile Android" / "Un verre en un geste".
- (f) Real: WidgetKit and Android widgets in three sizes, a curve that falls on its own over time (static here), interactive buttons via App Intents, personal presets (O-33, not shown), App Intents / Siri, Action Button, Control Center control, Android quick-settings tile and App Actions. SCREENS.md calls the 2 × 2 widget "medium"; visually it is a square the size of a small widget.

#### Screen 4. Montre et lien partagé
- (a) HUB-04, QOL-05.
- (b) Watch face 210 × 250, radius 52, black, ring `0 0 0 8px #2C3734`: party name, amber `num` 64 px "0,58", 2 small icon-only buttons (add primary, water). Label "Un lien dans WhatsApp". Outgoing chat bubble (`#2F5D50`, radius 18 18 4 18, max-width 300) holding a link preview card: 120 px amber header with glass icon 56, title h3, two small lines; message text below.
- (c) No handlers.
- (e) "Samedi au Zinc"; "0,58"; "Un lien dans WhatsApp"; "Soirée chez Inès, samedi 21 h"; "6 personnes. Ouvre l'invitation dans l'app."; "lien.app"; "ramenez des glaçons".
- (f) Real: watchOS / Wear OS app or complication (HUB-04, P2); Open Graph / rich-link metadata served by the invite page (QOL-05). The watch buttons need accessibility labels.

#### Screen 5. Page d'invitation web
- (a) N-30, O-79 (retired, replaced by this page), QOL-05.
- (b) Light theme (`.ph.lt`, background `#EEF0EA`). Fake browser bar (`#DCE1DA`, white field 40 px, lock icon) "lien.app/c/les-quais". 72 × 72 amber tile radius 22 with glass icon 38; h1 40 px; overlapping avatars H, J, M, I (−10 px) + "et 8 autres"; 18+ line; primary "Ouvrir dans l'app", secondary "Installer sur iPhone", secondary "Installer sur Android".
- (c) No handlers.
- (e) "lien.app/c/les-quais"; "Hugo t'invite dans le crew Les Quais"; "et 8 autres"; "L'app est réservée aux 18 ans et plus."; "Ouvrir dans l'app"; "Installer sur iPhone"; "Installer sur Android".
- (f) Real: web page with universal link / app link handoff, store links, HSTS (SEC-03). Decide what crew data the page may expose to a non-member (SEC-01): the prototype shows the inviter's first name, the crew name, four members' initials and a member count.

### 2.5 Board "Créer et suivre une soirée" (`Soirees.dc.html`)

Board IDs: O-35, O-36, O-37, O-38, O-39, O-40, O-42, N-07, N-29, QOL-10, QOL-16, QOL-17, JOY-04 (13).

Logic state: `mood:2 (Bar), name:'', type:'p', day:5, start:21, end:27, inv:{h:true, j:true, m:true, i:false, t:true}, rep:{0:-1, 1:-1, 2:-1}, squad:true, miss:35, live:[5 items], feed:[2 lines], share:true, ghost:false, friend:false`.

Timer: `componentDidMount` starts an interval every 3500 ms. On each tick k: the BAC of live entry `k mod 3` (Malik, Jade, Inès) goes up by 0.04 (rounded to 2 decimals); `miss` goes up by 1; a line "{now} : {names[k mod 3]} a pris un verre" is prepended to the feed, with `names = ['Jade','Malik','Inès']`, and the feed is capped at 3 lines. Bug: the bumped person and the named person differ (index 0 bumps Malik while the line names Jade). Cleared on unmount.

#### Screen 1. Nouvelle soirée
- (a) O-35, O-40, QOL-16, QOL-17, JOY-04.
- (b) Suggestion pan (amber tint `#4A3E22`, text `#F8E3B4`): amber pin icon, text, small primary "Lancer". Title row h1 + close icon button. Label "Ambiance" + wrap of 10 mood chips. Field "Nom" (placeholder = automatic name, border colour = mood tint). Small hint. Segmented "Soirée" (moon icon) / "Séjour" (calendar icon). Day label + horizontal scroller of 7 day tiles (min 58 × 70, weekday small at opacity .7, `num` 26 px date). Grid of 2 pans "Début" / "Fin", each with 36 × 36 ‹ › buttons around `num` 30 px. Small note. Full-width create button with background = mood tint.
- (c)
  - Moods (index: label, tint): 0 "Apéro" `#F4B33D`; 1 "Anniv" `#FF9C8A`; 2 "Bar" `#F4B33D` (default); 3 "Boîte" `#D6C8F2`; 4 "Appart" `#9BD8A8`; 5 "Déguisé" `#F2C6A0`; 6 "Plage" `#8CCBEA`; 7 "Festival" `#9BD8A8`; 8 "Match" `#8CCBEA`; 9 "Afterwork" `#E8E3D2`.
  - Automatic names by mood: "Apéro de samedi", "Anniv de samedi", "Samedi au Zinc", "Boîte de samedi", "Samedi à l'appart", "Samedi déguisé", "Samedi à la plage", "Festival de samedi", "Match de samedi", "Afterwork de samedi". They always say "samedi", whatever day is picked.
  - Empty name: the placeholder and the hint show the automatic name.
  - Type: "Soirée" → button "Créer la soirée", day label "Quel jour"; "Séjour" → "Créer le séjour", "Premier jour". No end-day picker for a trip.
  - Days: 7 tiles, dates 9 to 15, weekday labels `wd[(i+1) mod 7]` = mar, mer, jeu, ven, sam, dim, lun. Default index 5 = "dim 14".
  - Start / end in whole hours, shown as `(h mod 24) + ' h'`. Start default 21 ("21 h"), end default 27 ("3 h"). Start − : min 12. Start + : max end − 1. End − : min start + 1. End + : max 34 ("10 h" next morning). So a party lasts at least 1 hour and ends by 10 h the next day.
  - "Lancer" and close have no handlers.
- (d) None beyond button press. The mood tint changes instantly (no transition).
- (e) "Hugo, Jade et Malik viennent de faire leur check-in au Zinc."; "Lancer"; "Nouvelle soirée"; "Ambiance"; mood labels; "Nom"; "Laisse vide : elle s'appellera « {auto} »."; "Soirée"; "Séjour"; "Quel jour" / "Premier jour"; weekday labels "lun"…"dim"; "Début"; "Fin"; "{h} h"; "Fin habituelle du crew : 3 h. La soirée se ferme seule si plus personne n'est actif."; "Créer la soirée" / "Créer le séjour". Accessibility: "Fermer", "Plus tôt", "Plus tard".
- (f) Real: suggestion triggered by 3+ verified crew check-ins at one venue (QOL-17); usual end time learned (QOL-16); auto-close rule (O-40); automatic name from the real day and venue. Copy bug: "elle s'appellera" stays feminine when the type is "Séjour" (masculine). O-35 asks for about ten mood icons; the chips are text only.

#### Screen 2. Inviter
- (a) O-36, N-06 (calendar row), QOL-21 (calendar).
- (b) Top row: back icon, centred h3 party name, 44 px spacer. h1. Five tappable rows (avatar, name, trailing check icon in amber when invited, muted when not). Pan with 96 × 96 QR tile (icon 70), "Ou par lien", small line, chip "Copier le lien". Row "Ajouter à mon calendrier" (calendar icon, chevron). Primary "Inviter {n} personne(s)" at bottom.
- (c) Rows toggle `inv[k]`. People: Hugo (a1) on, Jade (a2) on, Malik (a3) on, Inès (a5) off, Théo (a4) on. Count = number on; "1 personne" / "{n} personnes". Default "Inviter 4 personnes". Hugo, the user from the onboarding board, is in his own invite list (ambiguous).
- (e) "Samedi au Zinc"; "Qui vient ?"; names; "Ou par lien"; "Pour ceux qui ne sont pas dans le crew."; "Copier le lien"; "Ajouter à mon calendrier"; "Inviter {n} personne(s)".
- (f) Real: invitations sent through the server, working end-to-end links and QR, calendar event creation.

#### Screen 3. Invitations reçues
- (a) O-36 (reply from the list, real badge count).
- (b) h1; three pans: top row tag (kind) + "de {name}", h2 title, small when-line, 3-item segmented. Tab bar with Crew active and a badge (min 18 × 18, radius 9, danger `#FF7A66`, text `#1E2624` 11 px weight 800, at top 2 / right 12).
- (c) Each card's segmented sets `rep[ci]` to 0, 1 or 2 ("Je viens", "Peut-être", "Non"). Badge = number of cards with no reply yet (default 3). Any answer, including "Peut-être", removes the card from the count. The badge renders "0" when every card is answered (it is never hidden).
- (e) Cards: tag "Soirée" (amber) / "de Jade" / "Anniv de Jade" / "Jeudi 19, 20 h, chez elle"; tag "Séjour" (water) / "de Malik" / "Week-end en Ardèche" / "Du 4 au 6 juillet, 3 jours"; tag "Soirée ouverte" (mint) / "de Nora" / "Quiz au Quai 12" / "Ce soir, 21 h". Options "Je viens", "Peut-être", "Non". Badge "{n}".
- (f) Real: RSVP as optimistic mutation (SYNC-01), badge from the server count, cleared once seen (QOL-03).

#### Screen 4. En direct
- (a) O-37, O-38, O-39 (rows link to the participant), O-42 (Squad), N-29, QOL-10, QOL-11.
- (b) Header: live dot + h3 party name, small line; trailing chip "Squad". Danger pan (`#4E2C27`): coral warning icon, h3 (text `#FFD3CB`), small line (text `#F3B9AE`), small danger call button (icon only, no accessibility label). Five live rows (link `#participant`): avatar, h3 name, status line, arrow glyph, `num` 26 px BAC (min-width 54, right-aligned). Label "Fil" + feed lines (`fadein`). Small note. Tab bar with Soirée active.
- (c) Squad chip toggles its own "on" style only (default on). Live rows: Malik (a3) 0,81 "accélère, 3 verres en 1 h"; Jade (a2) 0,55 "ralentit"; Inès (a5) 0,48 "arrivée à 22 h 40"; Théo (a4) 0,00 "SAM ce soir"; Malik B. (a6) 0,30 "batterie 6 %". Arrow: "↑" in coral when the status starts with "accél", "↓" in mint when it starts with "ralent", nothing otherwise. Missing alert: "Sami : pas de nouvelles depuis {miss} min", starting at 35 and +1 every 3.5 s tick. Feed starts with "22 h 40 : Inès est arrivée", "22 h 12 : Sami est parti du Zinc".
- (d) Live dot 1600 ms loop; new feed lines `fadein` 350 ms; BAC values change without animation (no digit roll here).
- (e) "Samedi au Zinc"; "6 présents. Se ferme seule à 6 h."; "Squad"; "Sami : pas de nouvelles depuis {n} min"; "Dernier signe au Zinc"; status strings above; "Fil"; feed strings; "{h} h {mm} : {name} a pris un verre"; "Notifs : arrivées, départs et alertes seulement. Le reste reste ici." (reads as an annotation of O-38).
- (f) Real: live updates from the server (push or socket), refresh after backgrounding, real "no sign of life" timer that takes a dead battery and "home" status into account (N-29, QOL-10), Squad sharing curves continuously (O-42: what the switch changes is not shown), notification volume rules (O-38). "Malik B." shows the two-Lucas rule (QOL-11).

#### Screen 5. Carte live
- (a) N-07, QOL-10 (last known position).
- (b) Full-bleed static map (background `#26302D`, roads `#34403C` 16 px strokes, blocks `#2C3734`). Avatars J (left 182, top 300) and M (206, 330) with a 4 px `#1E2624` ring; S at (90, 560), opacity .6, tag "il y a 35 min". Bottom sheet with animation disabled: grab, h3 "Ma position", two switch rows, explanation line.
- (c) Share default on, ghost default off; both can be on at once. Explanation: ghost on → "Fantôme : ta position n'est envoyée à personne."; else share on → "Le crew de la soirée voit ta position. Personne d'autre."; else "Ta position n'est pas partagée.".
- (e) "il y a 35 min"; "Ma position"; "Partager avec le crew"; "Jusqu'à la fin de la soirée, puis effacée"; "Mode fantôme"; "Tu vois les autres, eux ne te voient pas"; the three explanation lines. Switch labels "Partager ma position", "Mode fantôme".
- (f) Real map SDK, real location only during a party and only when turned on, auto-expiry, deletion once the recap is built (N-07, SEC-06). Ghost and share should be mutually consistent (decide whether ghost forces share off).

#### Screen 6. Profil d'un participant
- (a) O-39, O-77 / COM-08 entry (block or report).
- (b) Back icon; avatar 72 (a7, 26 px) + h1 name + small relationship line; grid of 3 stat pans (`num` 28 px with small label above and unit below); small explanation; full-width add-friend button; outline "Écrire" (chat icon); small secondary "Bloquer ou signaler" (flag icon), left-aligned.
- (c) Add friend toggles: off → primary "Ajouter en ami"; on → secondary "Demande envoyée". Tapping again reverts (no cancel confirmation). Instant, no pending.
- (e) "N"; "Nora"; "Amie de Jade. Pas dans ton crew."; "Ce soir" / "4" / "verres"; "Taux" / "0,51" / "g/L"; "Bars" / "2" / "dominés"; "Tu vois ce que Nora partage avec les participants d'une soirée. Le reste de son profil dépend de ses réglages."; "Ajouter en ami" / "Demande envoyée"; "Écrire"; "Bloquer ou signaler".
- (f) Real: friend request through the server without duplicates and never "sent" when it failed (O-43); field-level visibility (PROF-08). "Écrire" to a non-friend conflicts with COM-05 (no messages from strangers until a request is accepted) unless party participants count as allowed; to decide.

### 2.6 Board "Rentrer en sécurité" (`Securite.dc.html`)

Board IDs: O-82, N-25, N-26, N-27, N-28, QOL-18, QOL-22, JOY-01 (8). Logic state `{me:false, ride:1, sos:0, sent:false, clink:false, k:0}`; interval `iv` and timeout `to` cleared on unmount. No tab bar on any screen.

#### Screen 1. Bien rentré ?
- (a) N-25, O-82.
- (b) Back icon (to `Soiree.dc.html`); h1; five rows: avatar, h3 name, status line, trailing mint check (confirmed) or small secondary "Appeler" with phone icon (not confirmed, others only); primary full-width button min-height 64, 18 px at the bottom.
- (c) Rows: Jade (a2) "Rentrée à 2 h 10" ✓; Théo (a4) "Rentré à 2 h 35" ✓; Inès (a5) "Rentrée à 2 h 40" ✓; Sami (a6) "Pas encore confirmé" + "Appeler"; Toi (a1, initial H) "Pas encore confirmé" or "Rentré à l'instant". My button toggles `me`: off → primary "Je suis bien rentré"; on → secondary "C'est noté, bonne nuit" and a check on my row. Tapping again un-confirms. My own row never gets a call button.
- (e) "Tout le monde est rentré ?"; status strings above; "Appeler"; "Toi"; "Je suis bien rentré"; "C'est noté, bonne nuit"; "Rentré à l'instant".
- (f) Real: status stored on the server and pushed to the crew; end-of-night check-in prompt (N-25); call via the phone dialer. Gender: the user's own strings are masculine only ("Je suis bien rentré", "Rentré à l'instant"), while other people's statuses agree with their gender.

#### Screen 2. Le retour
- (a) N-26, N-27, QOL-18, QOL-22.
- (b) h1. Pan: h3 "SAM de la soirée" + water tag with car icon "Théo", small line. Label "Qui rentre avec qui" + 3 rows (overlapping avatars at −10 px; text; optional button). Label "Rentrer avec" + 4 ride chips. Small line. Pan with amber bus icon, h3 and small line.
- (c) Ride chips "Uber", "Bolt", "Taxi", "À pied", default "Bolt"; the line below always reads "Choix gardé pour la prochaine fois : {ride}.". "Proposer" has no handler.
- (e) "Le retour"; "SAM de la soirée"; "Théo"; "0 verre. S'il en ajoute un, il reçoit un rappel et le crew aussi."; "Qui rentre avec qui"; "Hugo et Jade" / "À pied, 12 min"; "Avec Théo" / "En voiture" (avatars M, I, T); "Sami, seul" / "Proposer de le raccompagner" / "Proposer"; "Rentrer avec"; ride labels; "Choix gardé pour la prochaine fois : {ride}."; "Dernier bus de nuit à 1 h 12"; "Arrêt à 4 min à pied".
- (f) Real: designated driver per party with reminder if they log a drink (N-26); pairing who goes with whom; deep links into Uber, Bolt, local taxi apps and Apple Maps / Google Maps / Waze, choice saved (QOL-18; the map-app choice is not shown); GTFS night-bus departures after midnight (QOL-22).

#### Screen 3. SOS
- (a) N-28.
- (b) Back icon (to `Soiree.dc.html`, left-aligned); centred h1 (margin-top 20); small text max-width 280. Hold button 220 × 220 round, margin 30 px vertical, background `conic-gradient(#FF7A66 {deg}deg, #4E2C27 0deg)`, inner disc 180 × 180 `#1E2624` with coral `num` 52 px "SOS" and a small hint (`aria-label="Maintenir pour alerter"`). Three secondary full-width call buttons (gap 8). Small closing line.
- (c) Pointer down: if already sent, resets to not sent and 0 (a second press silently un-sends). Otherwise an interval every 100 ms adds 5 (percent) until 100: 20 ticks = 2000 ms, then `sent=true`. Pointer up or leave before 100: interval cleared, progress snaps back to 0. Ring angle = percent × 3.6 degrees.
- (d) Conic ring fills in 5% steps every 100 ms (stepwise linear, 2 s). Release snaps to 0 (no reverse animation). Title and text swap instantly.
- (e) Before: "Besoin d'aide ?"; "Maintiens le bouton 2 secondes. Ça évite les appuis dans la poche."; hint "maintenir". After: "Alerte envoyée"; "Jade, Malik et Théo ont ta position. Jade a vu l'alerte."; hint "envoyé". Always: "SOS"; "Appeler le 112"; "Appeler le 15 (Samu)"; "Appeler Maman"; "L'alerte envoie ta position au crew, si tu l'as autorisée."
- (f) Real: alert delivered by the server to the crew with location if allowed, delivery and read receipts ("Jade a vu l'alerte"), emergency numbers per country (PREF-02), emergency contact from settings, rising haptic during the hold (DESIGN §5), an explicit cancel flow after sending (missing).

#### Screen 4. Trinquer
- (a) JOY-01, AC-04 (proximity proof).
- (b) Centred h1 (margin-top 24), small line. Two phone shapes 96 × 170, radius 20, `#34403C`, 40 px apart (margin 70 px top, 30 px bottom), each with a 48 px glass icon (left amber, right mint). "Tchin !" in amber `num` 44 px, absolutely placed above (top −40). Primary full-width "Trinquer". Conditional small line.
- (c) "Trinquer": clears the timer, sets `clink=false`, then after 30 ms `clink=true` (restarts the animation). The proof line appears with the clink.
- (d) Left phone `clinkL` and right phone `clinkR`, 700 ms `cubic-bezier(.3,.7,.3,1)` (easeToggle): translate 0 → ±52 px with ±12° rotation at 45%, ±46 px / ±8° at 55%, back to 0 at 100%. "Tchin !" `pop1` 350 ms. Proof line `fadein` 350 ms.
- (e) "Tchin"; "Approche ton téléphone de celui de Jade."; "Tchin !"; "Trinquer"; "Vous êtes bien ensemble : ça compte pour vos check-ins et vos verres."
- (f) Real: triggered by BLE / NFC proximity between two phones (JOY-01), not a button; sound (JOY-05, off by default) and haptic; the proof is a server-verified signal (AC-04), so the proof line must wait for the server.

### 2.7 Gaps

IDs whose screen is missing, partial or ambiguous on these six boards:

| ID | State | What is missing or unclear |
|---|---|---|
| O-01 | partial | No email + password path (only Apple, Google, passkey, magic link). Fields are read-only. |
| O-02 | partial | "Non" path has no persistence or relaunch behaviour. |
| O-04 | partial | No profile photo. Weight is only a ±1 stepper (no typing). |
| O-18 | partial | Only France shown; "Sous la limite à" is hard-coded ("3 h 05" / "5 h 20") and disagrees with the computed "Volant" on screen 1. |
| O-19 | partial | Notice present on Party level 0 and the limit screen only; absent from levels 1 to 3, Live Activity, lock widgets, home widgets, watch, share card, participant profile. |
| O-20 | partial | No custom glass icons on quick-add tiles. |
| O-21 | partial | Long-press menu shown statically; reorder, create and sync not shown. |
| O-23 | partial | Swipe shown as a pre-swiped item; group collapse and "Modifier" not wired; delete toast has no timeout. |
| O-24 | partial | No zoom, pan, hour labels, peak marker or profile reminder; legal-limit and personal-limit lines at fixed pixels (y 122 = 0.39 g/L and y 88 = 0.56 g/L on the chart scale) instead of 0.5 g/L and the slider value; threshold gradient relative to the curve's bounding box. |
| O-25 | partial | "ta limite" line not linked to the limit slider (default 0,8 g/L). |
| O-26 | partial | Alert rules ("without spam") not shown. |
| O-29 | partial | Only one friend ("J"), avatar fixed at x 300 and point 13. |
| O-33 | partial | Wide widget and water buttons not wired; no presets; curve static; "No double counting" not shown. |
| O-35 | partial | Moods are text chips, not icons; Trip has no end day; automatic name ignores the picked day. |
| O-36 | partial | Badge shows "0" instead of hiding; QR scan to join not on this board (it is on Arrivée screen 8). |
| O-37 | partial | BAC changes have no animation; "speeding up / slowing down" is text-driven. |
| O-40 | ambiguous | "Se ferme seule à 6 h" (live) vs "La soirée se ferme seule si plus personne n'est actif" (new party) vs end time "3 h": three closing rules, none specified. |
| O-42 | ambiguous | Squad chip toggles only its own style; what it shares is not shown. |
| O-43 / O-39 | partial | "Demande envoyée" is instant; no failure state. |
| HUB-01 | partial | Live leaderboard row never reorders; "Autre verre" links to `#` instead of opening the add sheet; round entry is only a tile. |
| HUB-02 | partial | Water button in the Live Activity not wired; no expanded Dynamic Island. |
| QOL-01 | partial | "Encore une pinte" is a fixed pint, not "same as last" (size, price, venue). |
| QOL-03 | partial | Second action buttons show the wrong confirmation text; done state instant. |
| QOL-17 | partial | Only the "3 friends checked in" suggestion; check-out geofence and "closes in 30 min" not shown. |
| QOL-18 | partial | Ride app choice remembered; map / directions app choice not shown. |
| PREF-02 | partial | First day of week, drink-size presets and date format not listed. |
| ADP-01 | partial | No hysteresis or level-transition motion shown; manual selector changes only the tag and note, not the layout. |
| ADP-04 | conflict | SOS needs a 2 s hold, and swipe-to-delete is the only shown way to edit history; ADP-04 forbids essential actions behind a long-press or precise swipe at levels 2 and 3. |
| ADP-06 | partial | Only 2 of the 6 listed vault actions appear; the moment of being blocked (what the user sees when trying a vaulted action) is not shown. |
| ADP-07 | partial | No explicit max-contrast or strobe-legibility treatment; levels reuse normal colours. |
| ADP-08 | partial | Eco switch only; no visual of what eco mode changes. |
| N-07 | ambiguous | Share and ghost can both be on. |
| N-28 | partial | No cancel-after-send flow (a second press silently resets). |
| N-29 | conflict in data | Sami is "rentré" on the Party screen but missing for 35 min on the live dashboard; the rule that home status suppresses the alert is not shown. |
| MOT-03 | partial | No glass or bubbles (only the fill inside the button); `bub` keyframe unused. |
| MOT-04 | partial | No self-drawing trace, no smooth threshold colour change, no peak point, no gliding avatars. |
| MOT-11 | partial | Only button pops; no animated widget or Live Activity content. |
| JOY-01 | partial | Button-triggered, no proximity, no sound. |
| JOY-02 | partial | Five hour-based lines; "never the same line two nights in a row" not modelled. |
| JOY-04 | partial | Mood tints only the name-field border and the create button; Party screen, widget and recap tint not shown. |

Prototype bugs a spec writer could copy by mistake:
- `dur()` can print "60" minutes.
- Undo toast hour comes from the add-sheet stepper, not the logging time.
- Trend line always says "g/L" even when the BAC is shown in mg/L.
- The live feed names a different person from the one whose BAC rose.
- Default selected day "dim 14" vs automatic name "samedi" vs lock screen "samedi 14 juin".
- "elle s'appellera" for a Séjour.
- Demo numbers are not consistent with the demo model: lock screen "0,58" with "Retour à 0 dans 4 h 50" (the Party screen's 0.15 g/L/h rate gives 3 h 52).
- "batterie 6 %" is on Malik (Party screen) and on "Malik B." (live dashboard).

Conflicts between the prototype and `PROMPT.md` / `DESIGN.md`:
1. SOS 2 s hold vs ADP-04 and DESIGN §6 ("nothing important needs a long-press" at levels 2 and 3). SOS is on both level screens and links to this hold screen.
2. BAC notice missing on levels 1 to 3 and all system surfaces vs O-19 and the guardrail "always visible next to the BAC and the driving status".
3. Instant success states vs SYNC-02 ("Pending is not success"): notification actions, add friend, home-safe confirmation, SOS "Alerte envoyée" / "Jade a vu l'alerte", cheers proof line, Live Activity and widget counters, RSVP, water button. Only the add-pint flow has a pending state.
4. Level thresholds "0,5, 1,0 et 1,5 g/L" fixed in the prototype vs ADP-01 ("exact thresholds are set by ADP-01 after research").
5. BAC unit swap: DESIGN §5 says "instant + pop 350 ms"; the prototype swap has no pop (the pop only plays on server confirmation).
6. Curve threshold colours: tokens say < 0.25 / 0.25 to 0.60 / > 0.60 mg/L of breath (0.5 / 1.2 g/L of blood); the prototype gradient is relative to each curve's height.
7. Tap target at level 3: "Ajouter un verre quand même" is 40 px vs DESIGN §3 "≥ 88 px at adaptive level 3" (DESIGN §6 does call it "a small outline button", so DESIGN contradicts itself).
8. Read-only party settings: the note says "En soirée, ils sont en lecture seule" but every switch on that screen toggles (fine if the screen is meant to be shown sober; ambiguous).
9. Quiet hours "Rien entre 2 h et 11 h, sauf un SOS" (onboarding default) would silence water reminders, crew arrivals, "no sign of life" alerts (N-29) and takeover notices during the second half of a night out. PROMPT does not set quiet-hour defaults; this needs a decision.
10. Health consent is asked on screen 7, after weight and sex were entered on screen 4. Weight and sex are sensitive fields (SEC-04); consent order should be checked by Recon-Security.
11. "Écrire" on a non-friend participant's profile vs COM-05 (no messages from strangers until a request is accepted).
12. Participant profile shows a non-friend's live BAC ("Taux 0,51"); PROF-05 forbids live BAC to strangers. The copy says this is what Nora shares "avec les participants d'une soirée", so the rule for co-participants who are not friends must be written down.
13. Undo duration: Party screen toast 5 s (matches DESIGN and the ModeBourre "5 s" setting), history delete toast has no timeout.
14. Eco mode threshold "Sous 20 %" (ADP-08) and the crew low-battery tag under 10 % (QOL-10) are two different thresholds; fine, but both must be named in the spec.

### 2.8 Design tells to watch

Items in the prototype that could trip the `<anti_slop>` design and copy rules if ported literally:

- Amber scarcity (DESIGN §1: never two competing amber elements except the BAC and the primary button): Party screen level 0 has the amber BAC, the amber primary button, an amber crown icon in the venue row, an amber dice icon in the dare pan and the amber active tab. New party screen has two amber buttons at once ("Lancer" in the suggestion and "Créer la soirée" with the default "Bar" tint). The limit screen has three amber values plus an amber slider and switch. The lock screen has amber in the Island, the BAC widget, the Live Activity number and the "Pinte" button.
- Rounded icon tile above a heading (listed tell): the 84 px amber tile on "Bienvenue" and the 72 px tile on the invitation page. If it is the app icon, say so and use the real icon.
- Grids of identical stat cards with a big number and a small label (listed tell "big number + small label"): "Ce mois / Total / Moyenne", "Ce soir / Taux / Bars", "Retour à 0 / Volant". Consider rows or inline figures.
- Translucent panels on the lock screen (`rgba(255,255,255,.14)`) and the share card (`rgba(30,38,36,.92)`): acceptable as OS mimicry, but must not leak into the app as glassmorphism.
- Lavender `#D6C8F2` (avatar a5 and the "Boîte" mood tint) is the only violet-family colour; keep it off large surfaces so it never reads as the AI violet palette. Coral `#FF9C8A` as the "Anniv" create-button fill is close to danger coral `#FF7A66` and could read as a destructive button.
- Live dot pulsing on the party name (Party screen and live dashboard): allowed only while the party is really live (DESIGN §5); must stop when it closes.
- Unicode arrows "↑" / "↓" as status glyphs on the live dashboard: replace with icons from `icons.json`.
- Subtitle under almost every onboarding title ("Pas de mot de passe à retenir.", "D'après la langue et la région…", "Le reste attend que tu ouvres l'app."): `<ui_copy>` bans a subtitle under every title. Keep only the ones that tell something new.
- Gesture help lines ("Glisse un verre vers la gauche…", "Touche pour replier", "Appui long", "Une soirée compte jusqu'à 6 h du matin…"): allowed once on first use, then never again.
- Designer annotations rendered as UI text: "Pas de notif pour tes propres actions. Chaque notif ouvre l'écran exact.", "Notification fixe pendant la soirée, mêmes boutons", "Notifs : arrivées, départs et alertes seulement. Le reste reste ici.", "Raccourcis et App Actions sur Android", "Un verre en un geste". These explain features; they are not shipping copy.
- Copy patterns: the welcome h1 "Qui sort ce soir, où, et qui paie la prochaine." is a three-part list (watch "always three"); "Tes données, ton accord" is a glued pair; "Bien joué" under the water row is mild praise; "OK" (Volant) and "Off" (water reminder) are English words in the French UI.
- "Vous êtes bien ensemble…" on the cheers screen addresses two people, but the SLOP-04 lint bans "vous" in French; it will fail CI unless reworded or whitelisted.
- No em or en dashes and no emoji were found in the copy of these six boards.

## 3. Decisions proposed

1. Treat every number in the logic classes as the intended UX timing (fill 700 ms, server stand-in 900 ms, roll 14 × 45 ms, Undo 5 s, SOS 2 s in 5% steps, live refresh 3.5 s, clink 700 ms), and every demo value (BAC, rates, names, times, prices) as placeholder data. Reason: `prototype/README.md` says the rules are the intended behaviour; the demo data is inconsistent across boards.
2. Resolve the SOS hold conflict explicitly in an ADR: keep the 2 s hold at levels 0 and 1, and at levels 2 and 3 replace it with a large tap followed by a cancellable countdown, or keep the hold but count it as the one documented exception. Reason: ADP-04 and DESIGN §6 forbid essential long-presses there, and the hold exists to stop pocket presses.
3. Add the BAC notice, in a short form, to every BAC surface (levels 1 to 3, Live Activity, widgets, watch, share card). Reason: O-19 and the guardrails say "always".
4. Every action that the prototype completes instantly gets the same pending / confirmed / rolled-back treatment as the add-pint flow. Reason: SYNC-02.
5. Draw the curve thresholds and limit lines in data units (absolute values converted per locale), not relative to the bounding box. Reason: O-24, O-25 and `tokens.json` `bacThreshold`.
6. Do not ship the designer annotations listed in 2.8 as UI copy; the copy writer decides what, if anything, replaces them. Reason: `<ui_copy>`.
7. Fix the prototype bugs listed in 2.7 in the specs, not by copying them.

## 4. Assumptions

- A-DESIGNA-1: The 900 ms timeout stands for "server answer" and not for a minimum delay to show. Based on `prototype/README.md` ("fake server delays used to show optimistic updates"). Verify with the user if a minimum "Envoi" visibility time is wanted.
- A-DESIGNA-2: The 5 s Undo window starts at the server confirmation, as in the logic (the timer is set inside the 900 ms callback). Based on `Soiree.dc.html` `add()`. Verify in the MOT-03 / ADP-04 spec review.
- A-DESIGNA-3: The level thresholds "0,5, 1,0 et 1,5 g/L" are placeholders, to be replaced by ADP-01 research. Based on PROMPT `<drunk_mode>`. Verify when Recon-BAC reports.
- A-DESIGNA-4: The "Mode soirée" settings screen is meant to be seen sober, which is why its switches work; during a party the same screen is read-only. Based on its closing note. Verify with the user.
- A-DESIGNA-5: Strings that describe platform behaviour on the system board (Android note, notification rules, shortcut sub-lines) are annotations, not UI copy. Based on their content and placement on OS mock-ups. Verify with the copy writer.
- A-DESIGNA-6: Party co-participants who are not friends may see what the participant chose to share with "participants d'une soirée" (including live BAC), as the participant profile copy says. Based on `Soirees.dc.html` screen 6. This must be reconciled with PROF-05 by the profiles spec.
- A-DESIGNA-7: "Hugo" is the current user across Arrivée, Soirées and Sécurité (he appears as "Toi" with initial H and colour a1). Based on demo data. No product impact beyond the invite list containing the user.

## 5. Scope changes

No new IDs are strictly needed. Proposed clarifications to existing IDs (for the orchestrator to record in `FEATURES.md` or `ASSUMPTIONS.md`):
- N-28: add "cancel a sent alert" (state and copy) to the spec; the prototype has no cancel flow.
- O-40: one written closing rule that reconciles "end time", "6 h day boundary" and "no one active".
- ADP-06: specify the blocked-action interstitial (what appears when a vaulted action is attempted at level 2 or 3).
- N-03 / O-03: quiet-hours default must not silence safety and party-live notifications (see conflict 9).

## 6. Glossary additions

| Concept | Code / EN term | FR UI term (from the prototype) |
|---|---|---|
| Queue of sensitive actions held until the next morning | `MorningVault` / next-morning vault | "Mis de côté jusqu'à demain" |
| Contact whose messages are held at high levels | `HeldContact` (drunk-text guard) | "Messages retenus jusqu'au lendemain" |
| Designated driver | `DesignatedDriver` / designated driver | "SAM" |
| Home-safe confirmation | `HomeSafeConfirmation` / home safe | "Je suis bien rentré" / "rentré" |
| Ghost mode for live location | `GhostMode` / ghost mode | "Mode fantôme" |
| Shared live curves within a party | `Squad` / Squad | "Squad" |
| Dare of the night | `NightlyDare` / dare of the night | "Défi du soir" |
| Party mood | `PartyMood` / mood | "Ambiance" |
| Day boundary for a night | `NightDayBoundary` / day boundary | (shown as "jusqu'à 6 h") |
| Proximity clink | `Cheers` / cheers | "Trinquer", "Tchin" |
| Low-battery eco mode during a party | `PartyEcoMode` / battery saver | "Économie de batterie" |
| Undo window | `UndoWindow` / undo | "Annuler", "Annuler pendant" |

## 7. Blockers

None. Everything in this report comes from files in the repository.

## 8. Sources

All read on 2026-10-26, local files only (no URLs used):
- `design/prototype/Arrivee.dc.html`, `Soiree.dc.html`, `ModeBourre.dc.html`, `Systeme.dc.html`, `Soirees.dc.html`, `Securite.dc.html` (read in full, markup and logic class).
- `design/prototype/README.md`, `design/DESIGN.md`, `design/SCREENS.md`, `design/tokens.json`, `design/base.css`.
- `FEATURES.md` (ID to board map for the six boards).
- `PROMPT.md` (`<mission>`, `<operating_principles>`, `<glossary>`, `<design_reference>`, `<scope>`, `<drunk_mode>`, `<motion>`, `<anti_slop>`, `<sync_and_feedback>`, `<security_privacy>`, `<guardrails>`).
