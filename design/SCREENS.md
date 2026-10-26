# SCREENS.md: the approved prototype, screen by screen

The prototype has 19 boards and 100 phone screens in `design/prototype/`. `Main.dc.html` is the index: every one of the 276 IDs of `PROMPT.md` with the board where it is shown (or "Coulisses" when it has no screen).

Each board below lists its screens, the IDs it covers, and what is interactive or animated. Exact timings and easings are in `design/DESIGN.md` § Motion and in each file's logic class.

## Arrivée et inscription
File: `design/prototype/Arrivee.dc.html`

IDs: O-01, O-02, O-03, O-04, O-05, O-08, QOL-08, QOL-15, PREF-02, PREF-04, SEC-08

Screens:
1. 1. Âge
2. 2. Bienvenue
3. 3. Connexion
4. 4. Profil
5. 5. Réglages détectés
6. 6. Notifications
7. 7. Consentements
8. 8. Ton crew

Interactions and motion: Age gate with yes / no feedback. Draft-restored banner can be dismissed. Weight stepper bounded 35 to 250 kg, pops on change, inline error at the bounds. Sex segmented control. Novice-driver switch. Notification switches. Continue stays disabled until the health-data consent is on. Crew: create / join segmented; the crew name typed live updates the invite card (QR + copy link).

## Soirée en cours
File: `design/prototype/Soiree.dc.html`

IDs: HUB-01, O-15, O-16, O-17, O-18, O-19, O-20, O-21, O-22, O-23, O-24, O-25, O-26, O-27, O-28, O-29, O-30, O-34, O-81, O-83, N-16, QOL-01, QOL-02, QOL-06, JOY-02, JOY-12, AI-01, AC-07, MOT-03, MOT-04, ADP-04, ADP-05

Screens:
1. Écran Soirée (niveau 0)
2. Ajouter un verre
3. Historique de la soirée
4. Courbe
5. Limite, eau et volant
6. Partager ma soirée

Interactions and motion: Tap the BAC to switch g/L blood and mg/L breath. 'Encore une pinte': amber fill inside the button, 'Envoi' tag, server confirms after ~900 ms, BAC digits roll to the new value, 'Enregistré' tag, Undo toast for 5 s (undo rolls the value back). Water button pops and increments. Greeting line changes with the hour. Add-drink sheet: quick-add grid selection, minute stepper capped at now with an explanation, photo switch (makes the drink verified), long-press menu on custom drinks, AI free-text example with parsed chips. History: swipe-revealed Modifier / Supprimer, delete shows Undo. Curve: period segmented swaps data, Compare overlays a friend's curve with an avatar marker, the scrubber follows the finger and shows time + value, legal and personal limit lines. Limit slider, water interval, novice switch changes the 'under the limit at' time. Share: camera front / back toggle, share targets.

## Mode bourré
File: `design/prototype/ModeBourre.dc.html`

IDs: ADP-01, ADP-02, ADP-03, ADP-06, ADP-07, ADP-08

Screens:
1. Niveau 1, pompette
2. Niveau 2, bien entamé
3. Niveau 3, cuit
4. Garde-fous du mode soirée

Interactions and motion: Four levels of the Party screen side by side. Level selector on level 2 shows what each level changes. Next-morning vault items can be cancelled. Drunk-text guard contacts toggle. Eco switch. Note: these settings are read-only during a party.

## Hors de l'app
File: `design/prototype/Systeme.dc.html`

IDs: HUB-02, HUB-03, HUB-04, O-33, QOL-03, QOL-04, QOL-05, MSG-04, MOT-11, N-30, O-79

Screens:
1. Écran verrouillé et Live Activity
2. Notifications où on répond direct
3. Widgets et raccourcis
4. Montre et lien partagé
5. Page d'invitation web

Interactions and motion: Lock screen: Dynamic Island compact BAC, lock widgets, Live Activity with a working '+ Pinte' (counts additions without opening the app), generic encrypted message notification, Android persistent notification note. Actionable notifications: each action collapses the notification into a confirmation chip. Home-screen widgets: small (BAC), medium (quick add buttons with counter), large (curve + buttons); Action Button, Siri phrase, Control Center / Android tile. Watch face. Rich link preview in a chat. Invitation web page (light theme).

## Créer et suivre une soirée
File: `design/prototype/Soirees.dc.html`

IDs: O-35, O-36, O-37, O-38, O-39, O-40, O-42, N-07, N-29, QOL-10, QOL-16, QOL-17, JOY-04

Screens:
1. Nouvelle soirée
2. Inviter
3. Invitations reçues
4. En direct
5. Carte live
6. Profil d'un participant

Interactions and motion: New party: mood chips tint the name field and the create button; empty name falls back to an automatic name; Party / Trip switch changes labels; day picker; start / end steppers with constraints; suggestion banner when 3 friends check in at the same venue. Invite: toggle people, count updates; QR + link; add to calendar. Invitations: reply segmented per card updates the Crew tab badge. Live dashboard refreshes every 3.5 s (BAC values, 'no news for N min' alert, feed lines), Squad switch. Live map: share / ghost switches change the explanation. Participant profile: add-friend toggle, block or report.

## Rentrer en sécurité
File: `design/prototype/Securite.dc.html`

IDs: N-25, N-26, N-27, N-28, QOL-18, QOL-22, JOY-01, O-82

Screens:
1. Bien rentré ?
2. Le retour
3. SOS
4. Trinquer

Interactions and motion: Home safe: list with confirmed / not confirmed and call buttons; my button toggles. Ride: designated driver, who goes home with whom, ride choice chips remembered, last night bus. SOS: press and hold 2 s, conic ring fills, release before the end cancels, then 'Alerte envoyée'. Cheers: both glasses swing and clink, 'Tchin !' pops, proximity proof message.

## Le récap
File: `design/prototype/Recap.dc.html`

IDs: O-41, MOT-08, RANK-03, N-21, N-22, N-23, JOY-09, AI-02, QOL-20, O-84

Screens:
1. Récap 1, les chiffres
2. Récap 2, les courbes
3. Récap 3, podium et badges
4. Récap 4, le fil et la phrase
5. Récap 5, album et récap raconté
6. Le lendemain matin

Interactions and motion: Story slides. Counters count up on entry and on 'Rejouer'. Curves of everyone with a time-range slider. Podium rises staggered with confetti, badges. Timeline of the night. Quote of the night: tap to vote (ring + count). Photo booth from the shared album, AI recap with tone switch (Sobre / Épique / Roast) and validation before sharing. Next-morning screen in light theme with balances and a water reminder.

## Radar du crew
File: `design/prototype/Radar.dc.html`

IDs: N-01, N-02, N-03, N-04, N-05, N-06, N-31, JOY-06, JOY-08, QOL-21

Screens:
1. Ce soir
2. Je sors, qui vient ?
3. La semaine
4. Sondage de sortie
5. Fil du crew

Interactions and motion: Status tiles (Je sors / Chaud si ça bouge / Chill maison / Pas dispo), time and place chips when going out. Crew streak. Birthday suggestion. 'Je sors, qui vient ?': after sending, replies arrive one by one (every ~1.1 s) and the create button counts the yes. Week calendar grid by person; recurring nights; calendar sync switch. Poll: tap a slot to vote, bars animate. Crew feed as a digest with reactions.

## Messagerie
File: `design/prototype/Messages.dc.html`

IDs: MSG-01, MSG-03, MSG-05, MSG-06, MSG-07, MSG-08, MSG-09, MSG-10, ADP-10

Screens:
1. Discussions
2. Conversation
3. Infos et clé de sécurité
4. Sauvegarde et messages retenus

Interactions and motion: Chat list with on-device search note and a held message. Conversation: E2EE header, reply quote, mention, reactions, encrypted photo, voice note, typing indicator; sending shows 'envoi' then 'envoyé ✓' after ~900 ms. Info: key-changed notice, safety number + QR with verify toggle, disappearing messages segmented, read receipts / typing switches, report sheet explaining on-device decryption. Backup passphrase reveal, warning, held drunk text with delete / send anyway.

## Les bars
File: `design/prototype/Bars.dc.html`

IDs: TER-01, TER-02, TER-03, TER-04, TER-05, TER-06, TER-07, TER-08, TER-09, N-08, N-09, N-10, N-11, N-12, COM-01, COM-02, COM-03, COM-06, COM-07, COM-08, COM-09, COM-10, COM-11, AC-02, AC-03, AC-04, AC-05, AC-06, MOT-09, PROF-04

Screens:
1. Carte des bars
2. Page d'un bar
3. Check-in et prise de bar
4. On va où ?
5. Écrire un avis
6. Saison et titres

Interactions and motion: Map: scope segmented (Mon crew / Tout le monde / Crews), filter chips, venue pins in the boss color with crowns, never-visited venues faded; tapping a pin grows it and updates the bottom sheet (busy level, boss). Venue page: boss and season top, prices with a price-change note, popular days bars, verified reviews, event, regulars, door policy tag, owner label, report. Check-in: segmented 'Vrai check-in / Faux GPS'; signals appear one by one; accepted → crown drop, amber wash, avatar pop, 'Le Zinc est à toi'; fake → refusal card with shame tag. Where to: wheel spin with long deceleration, result. Review: stars per criterion, door-policy answer, audience segmented with explanation. Season: titles, crew standings, threat alert, fog-of-war venue, participation and private check-in switches.

## Classements
File: `design/prototype/Classements.dc.html`

IDs: RANK-01, RANK-02, RANK-04, RANK-05, RANK-06, RANK-07, RANK-08, MOT-13

Screens:
1. Classement en direct
2. Palmarès

Interactions and motion: Live leaderboard: rows reorder with a 700 ms slide when Malik logs a verified pint; overtake banner; crown on the leader; period chips and metric segmented (drinks / grams / nights); verified-only and danger-cap notes; leave-the-board switch removes me. Hall of fame: champions, streak, secondary boards, admin switch.

## Jeux, catalogue
File: `design/prototype/Jeux.dc.html`

IDs: O-44, O-45, O-46, O-48, O-49, O-65, N-24, N-33, AI-03

Screens:
1. Catalogue des jeux
2. Fiche du jeu
3. Cartes du crew
4. Panthéon

Interactions and motion: Catalogue: prev / next with dot indicator (active dot widens), filter all / one phone / several phones, locked game badge (Agent double, 4 friends), dare of the night. Game sheet: level segmented, rules cards cycle, ordered players with guest tag and add field, round timer, crew cards switch. Crew cards: submit, AI proposals, admin approve / refuse queue with counter. Hall of fame records and shareable last-game card.

## Jeux de cartes
File: `design/prototype/JeuxCartes.dc.html`

IDs: O-50, O-51, O-52, O-53, O-56, O-57, O-58, O-32, O-47, MOT-06

Screens:
1. Le Grand Paquet
2. L'Autoroute
3. Face-à-face
4. Qui a ?
5. Je n'ai jamais
6. Qui de nous deux ?
7. Action ou vérité

Interactions and motion: All seven games are playable. Every game has a '?' rules sheet, the floating add-drink button (toast 'la partie continue'), a round timer bar where relevant. Grand Paquet: tap to draw, card pops with type tag. Autoroute: 5 checkpoints, higher / lower, red / black customs at checkpoint 2, a miss resets to checkpoint 1 and adds a penalty. Face-à-face: both cards flip, result computed. Qui a ?: tap who did it, validate. Je n'ai jamais: level segmented, next card pops, crew-card source tag. Qui de nous deux ?: tap to vote, bar shows the split. Action ou vérité: choose, card flips to a level-based prompt.

## Jeux d'action
File: `design/prototype/JeuxAction.dc.html`

IDs: O-54, O-55, O-59, O-60, O-61, O-62, O-63, O-64, MOT-07

Screens:
1. La Bombe
2. La Roulette
3. Les Mines
4. Le Doigt
5. L'Imposteur et Agent double
6. Dessine vite (en ligne)
7. Ça grimpe

Interactions and motion: All games are playable. Bomb: random fuse 8 to 20 s, color escalates, shake after half, explosion with particles, holder passes the phone. Roulette: 6 names, 4 s deceleration, result from the final angle. Mines: 5×5 grid, 4 mines, turn rotation. Le Doigt: place up to 6 fingers (click in the prototype, real multi-touch in the app), ripples then one is chosen. Imposteur / Agent double: segmented mode, pass-the-phone reveal, vote and result. Dessine vite: pointer drawing, clear, simulated online guesses arrive. Ça grimpe: rising multiplier and curve, players tap to get out, random crash, losers listed.

## Le Bar
File: `design/prototype/Bar.dc.html`

IDs: O-66, O-67, O-68, O-69, N-32, O-76, O-74

Screens:
1. Le Bar
2. Fiche recette
3. Mixeur
4. Courses et alibi

Interactions and motion: Live search and category chips filter recipes. Recipe: cl / oz switch converts measures. Mixer: ingredient chips compute makeable recipes and what is missing. Shopping list: check items (strike-through), assignee avatars. Alibi generator cycles.

## Argent et tournées
File: `design/prototype/Argent.dc.html`

IDs: O-70, N-18, N-19, N-20, QOL-19

Screens:
1. Cagnottes et tournées
2. Une cagnotte
3. Nouvelle dépense
4. Budget du soir

Interactions and motion: Pools overview with owed / owing; next round with rotation, recording a round explains what was added. Pool detail: minimal transfers, mark as paid updates the total, IBAN long-press copy shows an inline 'Copié' for 1.8 s, payment link, reminder. New expense: split segmented (Égal / Parts with steppers / Montants / %) recomputes every share. Budget slider and simulated spending with colored thresholds.

## Profil et visibilité
File: `design/prototype/Profil.dc.html`

IDs: PROF-01, PROF-02, PROF-03, PROF-05, PROF-06, PROF-07, PROF-09, PROF-10, COM-04, COM-05, N-13, N-14, N-15, N-34, JOY-03, JOY-11, O-43, O-72

Screens:
1. Mon profil
2. Voir mon profil comme...
3. Confidentialité du profil
4. Mes stats
5. Carte de membre
6. Profil d'une inconnue
7. Amis

Interactions and motion: My profile: each section has an audience chip that cycles Moi → Crews → Amis → Tous. View as: stranger / friend / crew recomputes what is visible, with the never-public note. Privacy: presets, un-hide items, findability segmented, live 'what a stranger sees' summary. Stats with heatmap and Wrapped entry. Member card and alternate icons (one locked). Stranger profile: join open party and friend request toggles. Friends: accept moves a request into the list, refuse removes it.

## Réglages
File: `design/prototype/Reglages.dc.html`

IDs: PREF-01, PREF-03, PREF-05, O-06, O-07, O-09, O-10, O-12, O-13, O-77, N-35, N-17, SEC-07, JOY-05, JOY-07, JOY-10, QOL-24

Screens:
1. Réglages
2. Langue, région et unités
3. Notifications
4. Sécurité et données
5. Confidentialité et apparence

Interactions and motion: Root list with update banner; tapping the logo 10 times reveals the easter egg. Language, region, units: travel banner accept / dismiss (changes the country), 7 languages, unit system switch updates the examples (pint, standard drink, weight), BAC unit switch updates the example, synced note. Notifications per type, quiet hours. Security and data: passkeys, 2FA, sessions with sign-out, accounts on device, export, consent withdrawal, delete-account sheet listing exactly what gets erased. Privacy and appearance: participation switches, theme segmented, sound / eco / data switches, app icon, stickers.

## États et serveur
File: `design/prototype/Etats.dc.html`

IDs: SYNC-01, SYNC-02, SYNC-03, SYNC-04, SYNC-05, SYNC-06, SYNC-07, O-31, MOT-10, QOL-07, QOL-09, QOL-11, QOL-12, QOL-13, QOL-23, AC-09

Screens:
1. Affiché direct, confirmé par le serveur
2. Hors ligne et conflits
3. Chargements et écrans vides
4. Confirmations, noms, formats
5. Recherche
6. Tentative de triche visible

Interactions and motion: Server simulator: OK → 'envoi' then 'enregistrée'; Refus → the row slides out and an error toast explains; Lent → retry state then a 'server not answering' toast; Hors ligne → 'en attente du réseau'. Offline queue, grouped failures and conflict messages. Skeleton then content, reload. Draft restored. Background photo upload progress. Empty state with action. Destructive confirm sheet. Two people with the same name. Long names wrap. Plural agreement with +1. Relative / absolute time toggle. Typo-tolerant search with recents and grouped results. Cheat flag on a profile with admin 'C'était une erreur'.
