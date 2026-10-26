# Recon-Games: O-53, O-54, O-59, O-64

Four separate investigations: "Qui a ?" (O-53), "La Bombe" (O-54), "Les Mines" (O-59), "La Courbe" (O-64, prototyped as "Ça grimpe"). Each game has its own section in part 2 and nothing in one section depends on another. The only shared part is 2.0 (the penalty and UI-level frame that every game plugs into), because O-32, O-45, O-46, O-49 and the "drink or do X" constraint apply to all four the same way.

S2M names are used below only to identify the games. Our names come in branding.

## 1. Summary

- S2M publishes no rules for any of the four. What the stores prove: "Qui a ?" and "La Courbe" were in S2M's first 7-game lineup (the Play Store description still lists it). The current App Store description lists 13 games: "La Courbe" is gone, and "La Bombe" and "Les Mines" are there with no release note announcing them. 7 + 5 announced games - La Courbe + La Bombe + Les Mines = 13, which suggests a silent swap. "La Bombe" got a bug fix in 2.0.6 (21 Oct 2026). S2M's Instagram, TikTok and YouTube could not be read (login wall or consent page), so no video evidence.
- "Les Mines" and "La Courbe" match two well-known casino mini-games (Mines on a 5x5 grid, and "crash" games where a curve climbs until it crashes). The prototype's "Ça grimpe" is a crash game. We keep both mechanics but strip the casino vocabulary and look (no "bet", "cash out", "x multiplier" as the hero number), and stakes are only sips or forfeits, never money or currency.
- The prototype contradicts itself on "Qui a ?": the catalogue says "one question, everyone points at someone", but the game screen and its rules card play a confession game ("tap those who did it"), which is "Je n'ai jamais" (O-56) again. Recommendation: "Qui a ?" is the group designation game (everyone points at the same moment, the most-pointed takes the penalty), so it does not overlap with O-56 (self-confession) or O-57 (vote between two named players).
- The prototype "La Bombe" leaks the hidden fuse: its colour steps at 33 % and 66 % of the real fuse, so players can read when it will explode. The escalation (shake, tick, colour) must follow elapsed time against the longest possible fuse, never the real one.
- The prototype "Les Mines" can place two mines on the same tile, has no decision for the player and no end. The prototype "Ça grimpe" draws the crash point uniformly between x1.6 and x6.6, so exiting at x1.5 is always safe and the game is solved. Both get rule fixes below.
- Every penalty is "N sips or a forfeit". A per-player "no alcohol" switch makes the forfeit the default for that player. A player whose estimated UI level is 3 is offered water or a forfeit, never more sips. Game penalties never log a drink automatically (BAC only comes from drinks the user adds).
- Multi-phone matters for one game only: La Courbe (simultaneous exits on one phone stop working above about 8 players). Qui a ? gets an optional secret vote on several phones. La Bombe and Les Mines are one-phone games by design.

## 2. Findings

### 2.0 Shared frame for the four games (not a game design)

Facts that apply to all four:
- S2M: Hard and Extreme are behind S2M+ ("Débloquez les modes Difficile et Extrême de chaque jeu", App Store description). Each game has "plusieurs niveaux de difficulté. De tranquille à mémorable." (App Store), 3 levels (Play Store). Rules as cards with a "?" button since 2.0.6. A one-phone / several-phones catalogue filter since 2.0.6. Since 1.10.0, "une bulle discrète dans tous les jeux pour enregistrer une consommation en pleine partie". Since 2.0.4, "les parties à plusieurs ne bloquent plus quand quelqu'un quitte". Since 1.5, "3 nouveaux timers de manche".
- Prototype (Jeux.dc.html): game setup has level Normal / Difficile / Extrême, players with guests, round timer Off / 30 s / 60 s, crew cards toggle. JeuxCartes.dc.html shows the FAB (`.fab`, bottom right, 56 px, above the content) and the rules sheet. JeuxAction.dc.html (Bombe, Mines, Ça grimpe) shows neither the FAB nor a "?" button: a gap to fill.
- The catalogue shows durations such as "5 à 15 min". Under <anti_slop> ("a displayed number is computed, or it is not displayed") these must be computed from the chosen settings (rounds x players x measured turn time) or removed. This applies to O-44, flagged here because it touches these four games.

Proposed shared penalty model (used by every section below):
- A penalty is a whole number of sips (FR "gorgées"). On screen it always reads as a choice: N sips, or a forfeit (FR "gage"). Tapping "forfeit" draws a forfeit card sized to N (small / medium / large). Forfeit cards are content for O-65; this report writes none.
- Player management (O-49) gets a per-player switch "no alcohol". For that player the forfeit is the default and sips are not shown.
- Water swap: if a player is in the current party with an account and their estimated UI level (ADP-01) is 3, their penalty is offered as "water or forfeit". The app never asks a player at level 3 to drink alcohol.
- The penalty counter (O-49) counts penalty units, whatever form they took. It never creates a Drink. The FAB (O-32) is the only way to log a drink from a game.
- Sip caps per level (Normal / Hard / Extreme) are per game, listed in each section. They are starting values for playtests, not researched facts (A-GAMES-1).

Proposed shared UI-level behaviour (ADP-01). The level that shapes a phone's UI is the level of that phone's signed-in user (A-GAMES-2):
- Level 0 and 1: full game UI. Level 1 enlarges targets and hides optional settings behind "more".
- Level 2: one main action per screen, giant targets (ADP-04), settings reduced to the defaults, the rules card shrinks to its one key sentence, choices that need several taps fall back to a one-tap form (described per game), and penalties show as one line per player.
- Level 3: per <drunk_mode>, games are no longer offered from the Party screen. A game already running is not taken away: it keeps level-2 layout, adds a persistent "Heading home" shortcut in the game header, and every penalty for the level-3 user becomes water or forfeit.

O-32 FAB in these games: one tap logs the user's last-used drink with the MOT-03 animation and a big Undo (ADP-04), and never pauses a game timer. A long press is not required for anything. On a shared phone it logs for the phone's owner only. Its position is set per game below so it never sits in a main tap zone.

O-46 rules cards: 3 cards per game at launch, re-openable with "?". The "?" sheet pauses timers only between rounds or in the paused state; opening it during a live fuse or a live curve is not possible (the "?" is hidden during live phases), to prevent stalling.

---

### 2.1 O-53 "Qui a ?"

#### What is known about S2M's version
- Listed in S2M's first lineup of 7 games, each with 3 levels: "Action ou Vérité, Je n'ai jamais, La Roulette, Qui a ?, L'Autoroute, Le S2M, La Courbe" (Play Store description, read 2026-10-26). Current App Store name: "Le Qui A ?".
- No rules published anywhere I could reach. S2M also ships "Je n'ai jamais" (confession) and "Qui de nous ?" (1.7: "qui de vous deux est le plus capable de... tout"), so "Qui a ?" is very likely the open group version of "who is the most likely / who has". Unverified (A-GAMES-4).

#### Classic variants found
- "Most likely to" (EN): someone asks a "who is most likely to" question, everyone counts to three together and points at once, each player takes one sip per finger pointed at them, the asker role passes to the left (gamerules.com).
- "Qui pourrait..." (FR): same mechanic, questions start "Selon toi, qui pourrait...", pointing after about three seconds, the pointed person drinks once per designation (Elle Belgique).
- "Paranoia" (EN): the question is whispered to one player, who names someone out loud; the named player can drink to hear the question, otherwise it stays secret (bargames101, officialgamerules.org).
- App market: "Qui est le plus ?" (App Store, group vote to designate the best match), Dual Cat's "Qui Pourrait" (App Store listing). Neither publishes more than that.

#### What the prototype shows (JeuxCartes.dc.html, `p4`, catalogue in Jeux.dc.html)
- Catalogue: "Une question, tout le monde désigne quelqu'un.", 10 min, 3 to 12 players, one phone, tags Groupe / Vote.
- Game screen: a card "Qui a déjà..." + question, 6 avatar tiles that toggle on/off ("Touchez ceux qui l'ont fait"), "Valider" gives "N personnes boivent une gorgée", "Question suivante". Rules card: "Le téléphone tourne, chacun avoue en se touchant. Ceux qui l'ont fait boivent une gorgée."
- So the screen plays a confession game while the catalogue promises designation.

#### Recommended rules
Setup
- 3 to 16 players (2 is meaningless: you can only point at the other one).
- Mode: "Fingers" (one phone, real pointing, default) or "Secret vote" (several phones, each player votes on their own phone). Secret vote needs at least 3 phones joined; players without a phone cannot vote in that mode, so the setup screen says who is missing.
- Level Normal / Hard / Extreme. Deck length: 20 cards by default, or "until we stop". Optional round timer (O-47) only limits reading + pointing time.

Turn (Fingers mode)
1. The reader is the player whose turn it is (rotates in player order). The app shows the card to the reader, who reads it aloud.
2. The reader taps "3, 2, 1". The app counts down with sound-free haptic beats and a big number; at zero it shows "Point!".
3. Everyone points at one person at the same moment. Pointing at yourself is allowed (classic rule).
4. The reader records the result: each tap on an avatar adds one finger to that player (a counter badge on the tile); a tap on the badge's minus removes one. "Done" when finished.
5. Penalty (see below), then the phone goes to the next reader.

Turn (Secret vote mode)
1. Same card on every phone, read aloud by the reader. A shared vote timer (10 s default) starts.
2. Each player taps one avatar on their own phone. Votes are anonymous. Self-vote allowed. No vote = abstains.
3. Reveal: bars grow per player on every phone. Penalty as below.

End: last card of the deck, or "Stop" at any time. End screen: who was designated most, penalty totals.

Penalties by level (sips, or the same size of forfeit)
- Normal: only the most-pointed player(s) take sips = number of fingers on them, capped at 3. Ties: every tied player takes the penalty.
- Hard: every player with at least one finger takes 1 sip per finger, capped at 5.
- Extreme: Hard penalties, plus "secret cards" mixed into the deck (Paranoia style, about 1 in 5): only the reader sees the card (hold to view), the reader names one person out loud, that person takes 2 sips or forfeit to have the question read to the group, or keeps it secret for free. In Secret vote mode, Extreme can also reveal who voted for whom (switch, off by default).
- Content intensity also rises by level (card author's job, O-65). Card types should vary their sentence shape ("qui a...", "qui pourrait...", "montrez la personne qui...") with a cap per structure, per <content_patterns>.

UI levels
- 0 and 1: full flow above.
- 2: recording becomes one tap: "Who got the most fingers?" with one avatar tap (or two for a tie via a second tap), fixed penalty of 2 sips. Secret vote unchanged (it already is one tap).
- 3: per 2.0. The water swap applies to designated players at level 3.

Edge cases
- Player leaves: removed from the avatar grid at the next card; if they were the reader, the next player reads. In Secret vote, a phone that drops mid-vote counts as an abstention.
- Player joins mid-game: added at the end of the reading order.
- The reader records wrong counts: honour system; the avatar grid is visible to all, and the reader can edit counts until "Done".
- Nobody designated (everyone pointed at the ceiling): no penalty, next card.
- More than 12 players: avatar grid scrolls at level 0 and 1 only; at level 2 the grid shows initials in a denser layout without scrolling (DESIGN.md to size).

Where we diverge from the prototype, and why
- Designation instead of confession: confession already exists as O-56 and two near-identical games in a 15-game catalogue is the "same structure repeated" tell. The catalogue line and the "Vote" tag already describe designation.
- Finger counting instead of on/off toggles: the classic penalty is per finger; toggles lose that.
- The prototype rules card says "le téléphone tourne"; in our version only the reader holds the phone, which is faster at 16 players.

Motion and haptics (MOT-06)
- Card dealt onto the table, 3D flip to reveal for the reader.
- Countdown: one firm haptic per beat, a stronger one on "Point!"; the number scales in on each beat (no bounce, MOT-01).
- Recording: each finger tap pops the counter on the tile with a light haptic.
- Penalty: the most-pointed tile trembles briefly before the penalty line appears (MOT-06 "trembles before a penalty").
- Secret vote reveal: bars grow in order of votes, the top bar lands last with a heavier haptic.
- Reduce Motion: fades only, haptics kept.

Multiplayer needs
- One phone: fully playable, no network.
- Several phones (Secret vote): a shared session with a common card index, vote collection with a deadline, and an anonymous tally from the server. No points are awarded, so no anti-cheat beyond one vote per player per card.

Rules cards (O-46), intent only (copy goes through VOICE.md)
1. The reader reads, everyone points on zero, yourself included.
2. What a finger costs at this level, and that forfeit is always allowed.
3. (Extreme) what a secret card is.

FAB position: bottom corner opposite the "Done" button; hidden during the 3-2-1 countdown only.

---

### 2.2 O-54 "La Bombe"

#### What is known about S2M's version
- In the current list of 13 games (App Store). Not in the original 7. No release note announces it. 2.0.6 (21 Oct 2026): "Et des corrections : La Bombe, achats plus fiables...". Nothing describes its rules (A-GAMES-5).

#### Classic variants found
- Tic Tac Boum (Rodriguez and Barc, 1994; Asmodée, Piatnik editions): the holder must say a word with the sound on the card (a die sets where in the word) before passing a bomb with a random hidden timer; whoever holds it at the bang keeps the card; 13 rounds, fewest cards wins (regles-du-jeu.net summary via search, everybodywiki).
- Piatnik "Tic Tac Boom" rulebook (2025 edition): the electronic bomb ticks for a random interval between 10 and 60 seconds; each word can be used only once per game; an invalid word must be replaced, "if the next player has already continued with their own word before someone challenges your invalid word, then you get away with it" (Piatnik PDF).
- Categories / "Drink while you think" (EN): pick a category, go around naming items, the one who repeats or blanks drinks; some versions cap hesitation at a few seconds (gamerules.com).
- Hot potato / outdoor "la bombe": players pass a ball while a caller counts down blind; the holder at "boum" is out (regles-du-jeu.net, anniversaire-en-or, unjourunjeu).
- Online: BombParty (JKLM) and its Discord clones, word prompts with lives (top.gg listing).

#### What the prototype shows (JeuxAction.dc.html, `b`)
- A category card ("Un mot chacun, sans répéter" + category), a round bomb that changes colour, a "Allumer la mèche" button, then a full-width "Mot dit, je passe à {next}" button.
- Fuse: uniform random 8 to 20 s total for the round, ticked every 200 ms.
- Colour steps at 33 % and 66 % of the real fuse, shake after 50 % of the real fuse.
- On explosion: particles, "Boum", the holder "boit 2 gorgées". Holder rotates through 4 names. No rules card, no FAB, no round count.

#### Recommended rules
Setup
- 2 to 16 players (3 or more recommended; at 2 it becomes a back-and-forth).
- Passing style: "Pass the phone" (default, the holder hands the phone to the next person) or "Phone on the table" (the phone stays in the middle, the current holder's name is shown big, the holder taps it). The table style is suggested automatically when the phone owner is at UI level 2 or 3, to avoid dropped phones.
- Level. Rounds: 10 by default, or "until we stop".

Round
1. A card shows the constraint: a category at Normal (as in the prototype), a sound or letter group that must appear in the word at Hard (Tic Tac Boum style), a category plus an extra constraint at Extreme. The holder cannot skip the card.
2. The first holder taps "Light it". The fuse is hidden: random duration, drawn when lit, never shown.
3. The holder says a valid word, then taps the pass button. The bomb moves to the next player in order (or, at Extreme, to the player the holder taps).
4. A word that repeats or does not fit can be called out by anyone; the holder must say another before passing. Once the next holder has said their word, the challenge is too late (Piatnik rule). The app does not judge words.
5. At the bang, the player shown as holder in the app takes the penalty. The app is the only referee: if you said your word but had not tapped yet, you are still the holder.
6. The exploded player starts the next round.

Fuse by level (starting values for playtests, A-GAMES-6)
- Normal: 15 to 40 s, steady tick.
- Hard: 10 to 30 s, tick a bit faster.
- Extreme: 6 to 25 s, irregular tick, and "free pass" (holder chooses the next holder).
- No fuse shorter than 5 s at any level, so the first holder always gets to play.

Penalty
- Normal: holder takes 2 sips.
- Hard: holder takes 3.
- Extreme: holder takes 3, and the player who passed it to them takes 1 (none if the first holder explodes).

End: after the set number of rounds, or "Stop". End screen: explosions per player, longest survival streak (the catalogue "records" line already shows "Survit 9 manches").

Escalation without leaking the fuse
- Shake strength, tick rate and colour follow elapsed time divided by the longest possible fuse for the level, not by the real fuse. Players feel the danger grow but cannot compute the bang.

UI levels
- 0 and 1: as above.
- 2: table style suggested; the pass zone becomes most of the lower half of the screen; the card text is shown bigger and alone; free pass (Extreme) falls back to "next in order".
- 3: per 2.0.

Edge cases
- Double tap on pass: the second tap must not skip a player (ADP-04). After a pass, the pass zone is locked for a short time while the new holder's name lands (exact duration in MOTION.md).
- App backgrounded, phone call, screen lock: the fuse pauses; on return, "Resume" then a 3-2-1 before the fuse runs again. The holder stays the holder, so stalling gains nothing. The screen stays awake during a round.
- Player leaves: removed from the order at once; if they held the bomb, it moves to the next player without penalty. A round never stops because of a departure (O-47).
- Phone dropped during a pass: nothing special; the fuse keeps running (that is the game). This is the reason for the table style.
- Group runs out of words: no skip. Someone explodes; that is the point.

Where we diverge from the prototype, and why
- Escalation based on elapsed time against the max fuse, because the prototype's colour and shake reveal the real fuse.
- Longer fuse ranges per level (prototype 8 to 20 s, Piatnik 10 to 60 s): a category word takes a few seconds, and 8 s can end before the second holder speaks.
- A challenge rule and "the app is the referee", taken from the Piatnik rulebook, because drunk arguments about who held it are the main failure of hot potato games.
- Table style, for phone safety.
- Level differences, penalty sizes, rounds and an end screen, which the prototype does not have.

Motion and haptics (MOT-07)
- Lighting: a short spark along the fuse, medium haptic.
- Live fuse: a tick haptic on every tick; the bomb shakes harder and harder and warms in colour, both driven by the elapsed-time ratio above.
- Pass: the bomb slides toward the next holder's name, light haptic; the name lands with a firm one.
- Bang: the bomb bursts into particles, the heaviest haptic in the game, then the penalty line. No full-screen white flash and nothing that flashes more than 3 times per second (WCAG 2.3.1, ADP-07).
- Sound (optional, MOT-01): tick and bang, mixed with music already playing, never stopping it (O-14).
- Reduce Motion: no shake, the colour change and haptics carry the tension.

Multiplayer needs
- One phone only. Passing one object is the game. A several-phones version (the bomb jumps between phones) adds network risk for no gain in a room where everyone sits together. Not recommended.

Rules cards (O-46), intent only
1. Say a word that fits, then pass. No repeats.
2. Anyone can call a bad word, until the next player has spoken.
3. Whoever the app shows at the bang takes the penalty (sips or forfeit).

FAB position: top corner, away from the pass zone, visible during the fuse (one-tap log, no pause).

---

### 2.3 O-59 "Les Mines"

#### What is known about S2M's version
- In the current list of 13 games (App Store), not in the original 7, never mentioned in a release note. No rules anywhere (A-GAMES-7).

#### Classic variants found
- Casino "Mines" (Stake-style, many clones): a 5x5 grid, the player picks 1 to 24 mines before the round, reveals tiles one by one, each safe tile raises the potential payout, the player can stop at any time; a mine ends the round and loses the stake; mine positions are fixed at the start (PariPulse guide, adventuremagazine.co.nz, intercom help article). Sources are gambling-industry pages: mechanics only, quality low.
- Minesweeper: revealed safe tiles show how many mines touch them (regles2jeux.fr page found via search, App Store minesweeper listings).
- No drinking-game version with a published rule set was found (searches in FR and EN). The closest physical party game is shot-glass roulette, pure luck.
- Gambling-likeness: Google Play forbids simulated gambling content only for apps that show gambling ads, and bans simulated casinos that point to real-money casinos (Google Play policy page). Apple rates frequent simulated gambling 18+ according to third-party guides; our app is already 18+ (O-02). Keep the game far from casino codes anyway (no stakes in money, no coins, no "cash out").

#### What the prototype shows (JeuxAction.dc.html, `mi`)
- A 5x5 grid, a "4 pièges" tag, "Au tour de {name}. Choisis une case." Each player taps one tile per turn, in a 4-name rotation. A mine shows a cross and "{name} boit 2 gorgées"; safe shows a tick. Message "Une case sur six est piégée." "Nouvelle grille" draws new mines.
- Bugs: new mines are drawn with independent `Math.random` calls, so two mines can share a tile (fewer real mines than the tag says). No end of grid, no decision for the player, no numbers.

#### Recommended rules
Setup
- 2 to 16 players. One shared 5x5 grid per round. Mines are placed at distinct positions when the grid is created and do not move.
- Level. Grids per game: 3 by default, or "until we stop".

Turn
1. The active player must reveal one tile.
2. Safe tile: at Normal it shows the number of mines touching it (minesweeper help). The player then chooses "Stop" (phone goes to the next player) or "One more".
3. Each extra safe tile revealed in the same turn earns the player 1 sip to give. When they stop, they give those sips to other players (one tap on an avatar per sip; at UI level 2 and above, one tap gives them all to one player).
4. Mine: the player takes the penalty, the mine stays visible, the turn ends.
5. A live line shows what is left: mines left and hidden tiles left (both computed, for example "3 mines, 9 tiles"). Risk visibly grows as the grid empties, which is the tension of a shared board.

End of a grid: when the last mine has exploded or no safe tile is left. End of the game: after the set number of grids, or "Stop". End screen: mines hit per player, best streak in one turn (the catalogue "records" line already shows "0 piège en 12 cases").

Penalty
- Mine: 2 sips, plus 1 per tile the player had already revealed this turn (greed costs). Cap: Normal 3, Hard 5, Extreme 7.
- Given sips: the receiver takes them or a forfeit of the same size, like any penalty.

Levels
- Normal: 4 mines, numbers shown, mine count shown.
- Hard: 6 mines, no numbers.
- Extreme: 7 mines, one of them a big mine (double penalty, same cap rule), no numbers, mine count hidden ("?"), and at least 2 tiles per turn.

UI levels
- 0 and 1: as above.
- 2: "One more" and "Stop" are two giant buttons under the grid; giving sips is a single tap; numbers stay but bigger. If DESIGN.md finds 5x5 tiles too small for level 2, the grid drops to 4x4 with mine counts scaled down (A-GAMES-8).
- 3: per 2.0.

Edge cases
- Double tap: a tap on an already revealed tile does nothing; a second tap on a hidden tile during the reveal animation is ignored (ADP-04).
- Player leaves: skipped in the order from the next turn; if it was their turn, the turn ends without penalty.
- Player joins: enters the order at the end.
- 2 players: allowed; the grid lasts longer, which is fine.
- 9 or more players: still one 5x5 grid; each grid is shorter per player, so the default grids per game rises with the player count (computed, shown in setup).
- Phone passed to the wrong player: the screen always shows whose turn it is in large type; a mistaken reveal counts for the shown player (the app is the referee).

Where we diverge from the prototype, and why
- Distinct mine positions: fixes the duplicate bug.
- "One more / Stop" with sips to give: the prototype has no choice, so it is a slow roulette. The push-your-luck choice is what makes casino Mines work, transplanted without money.
- Minesweeper numbers at Normal: gives sober players a reason to think, removed at Hard and Extreme so luck takes over as the night goes on.
- End of grid and of game, level differences, live risk line.
- The prototype message "Une case sur six est piégée" is a fixed claim; ours is computed from the board.

Motion and haptics (MOT-07 "Mines tiles")
- Tile press: the tile sinks slightly under the finger, light haptic.
- Safe reveal: quick flip, soft tick haptic, the number fades in.
- Mine: the tile trembles briefly before it opens (MOT-06 "trembles before a penalty"), then bursts; heavy haptic; neighbouring tiles shiver once.
- "Mines left / tiles left" numbers roll to the new value.
- End of grid: remaining mines reveal in sequence with a light haptic each.
- Reduce Motion: no tremble or burst, colour change and haptics only.

Multiplayer needs
- One phone, passed around or on the table. Several phones would only mirror the grid: no gain, not recommended for v1.

Rules cards (O-46), intent only
1. Reveal at least one tile per turn; stop or push your luck.
2. Every extra safe tile is a sip you give; a mine costs more the more you pushed.
3. (Normal) the numbers count touching mines.

FAB position: top corner, never over the grid or the two buttons.

---

### 2.4 O-64 "La Courbe" (prototyped as "Ça grimpe")

#### What is known about S2M's version
- Listed in the Play Store description's 7-game lineup: "Action ou Vérité, Je n'ai jamais, La Roulette, Qui a ?, L'Autoroute, Le S2M, La Courbe : 7 jeux à boire d'ambiance avec chacun 3 niveaux de difficulté" (read 2026-10-26). A search engine snippet of an older App Store page shows the same 7.
- Absent from the current App Store list of 13 games, and never named in the App Store version history (1.1 to 2.0.6). The word "courbe" in the release notes only ever refers to the BAC curve.
- So: rules not public, and the game was probably removed or replaced (A-GAMES-9). Three readings of the name:
  1. A crash game (a curve climbs, get out before it crashes). Fits the name and the prototype.
  2. A higher/lower card game. Already covered by L'Autoroute (O-51), so unlikely.
  3. A game played on real BAC curves (for example, guess your level or race the curves). Rejected for us whatever S2M did: it rewards drinking faster, against our driving and safety stance.

#### Classic variants found
- Crash games (Aviator by SPRIBE and clones): a short betting window, a multiplier rises from 1.00x, the crash point is random and unknown, a cash-out settles at the shown multiplier, a crash before cash-out loses the stake; optional auto cash-out (gembetcasino, thesource.com and similar pages). Gambling-industry sources: mechanics only.
- Real crash games use a heavy-tailed crash point (most rounds crash early, a few go very high), not a uniform one (thesource.com, "mathematics behind multiplier-based crash games").
- No drinking-game version with published rules found.

#### What the prototype shows (JeuxAction.dc.html, `cg`)
- A climbing line with "x {multiplier}" in big type, "Lancer la courbe", three player tiles; tap your tile to get out, it then shows your exit multiplier.
- Growth: x1.035 every 120 ms. Crash point: 1.6 + random x 5, so uniform between x1.6 and x6.6. Shake above x3. At the crash, everyone still in "boit" (amount unspecified); if all got out, no penalty.
- Catalogue: "La courbe monte. Descends avant le crash.", 5 min, 2 to 10 players, one phone, tag Nerfs. The game screen subtitle says "Sors avant le crash" while the catalogue says "Descends".
- Flaws: (a) the crash never happens before x1.6, so exiting at x1.5 is always free; (b) exiting at x1.0 costs nothing either; (c) 10 players on one phone means 10 hands on one screen.

#### Recommended rules
Setup
- 2 to 16 players.
- Mode: "One phone" (2 to 8 players, one tile per player, real multi-touch so several exits can land at the same moment) or "Several phones" (2 to 16, each player exits from their own phone; several players can share one phone, each with a tile).
- Level. Rounds: 10 by default, or "until we stop".

Round
1. 3-2-1 countdown, then the curve climbs. The big number is the stake in sips: it starts at 1 and steps up by whole numbers as the curve rises (see the display decision below).
2. Any player still in can get out at any moment by tapping their tile (or their own phone's exit button). Getting out cannot be undone.
3. The curve crashes at a hidden point.
4. Everyone still in at the crash takes sips equal to the stake at the crash, capped by level.
5. Among players who got out, the first one out takes 1 sip, unless they are the only one who got out. This removes the free "leave at once" strategy.
6. The best exit of the round (the highest stake among those who got out) is recorded for the end screen.

Crash point and speed (starting values, A-GAMES-10)
- Heavy tail: the chance that the curve passes a value x is about 1/x (half of rounds crash before 2, one in five passes 5, one in ten passes 10). Drawn on the host (one phone) or the server (several phones) when the round starts, never sent to clients before the crash.
- Speed: the curve doubles in about 3 to 4 seconds, so most rounds last under 10 s.
- Normal: no crash below 1.2 (no instant bust), slower climb, stake cap 3.
- Hard: no floor, faster climb, cap 5; the best exit gives 1 sip to a player of their choice.
- Extreme: about 1 round in 25 busts at the start (everyone still in takes 1), cap 8; the best exit gives sips equal to their exit stake (cap 3).

End: after the set rounds, or "Stop". End screen: best exit per player, crashes per player, penalty totals.

Display decision
- Show the stake as whole sips ("3") rising with the curve, not a decimal "x 2,47" multiplier. Reasons: the number then means exactly what you will take; drunk players read an integer at a glance; and the decimal multiplier is the signature of casino crash games. A finer decimal can stay hidden for tie-breaks (who exited first, best exit). Alternative if DESIGN wants the decimal: keep it small under the integer. The catalogue record "Sorti à x 7,4" becomes an integer record.

UI levels
- 0 and 1: as above.
- 2: one phone: maximum 6 tiles, the rest of the players must use their own phones or play as pairs sharing a tile; several phones: one giant exit button that fills the lower half. "Gives sips" at Hard and Extreme falls back to one tap on one avatar.
- 3: per 2.0.

Edge cases
- One phone, someone taps another player's tile: that player is out. No undo during a live round (an undo would let people cheat). Mitigation is layout: tiles in player colours with names, large gaps, ideally arranged so each tile is near the side its player sits on (DESIGN to decide).
- Several phones, a phone loses network before exiting: that player is out of this round with no penalty and no record. A disconnect cannot be punished fairly; with sips at stake the exploit is acceptable, and the round is excluded from records.
- Late exit taps after the crash: rejected. On several phones the server decides: an exit counts if its client time, corrected for measured latency within a small bound, is before the crash time. The exact bound is for the real-time ADR.
- App backgrounded on the one-phone host: the round is cancelled (no penalties) and restarts; pausing a live curve is not possible.
- Player leaves between rounds: removed. Joins: added for the next round.
- Everyone gets out before the crash: only the "first out" rule applies.
- Nobody gets out: everyone takes the stake.

Where we diverge from the prototype, and why
- Heavy-tailed crash point instead of uniform x1.6 to x6.6: the uniform draw makes x1.5 a guaranteed safe exit and caps the drama at x6.6.
- "First out takes 1": the prototype rewards leaving at once.
- Penalty sized by the stake at the crash, capped per level: the prototype says "boivent" without a number.
- Integer stake instead of the decimal multiplier (display decision above).
- Several phones above 8 players: the prototype puts everyone on one phone.
- Naming: catalogue "Descends avant le crash" and screen "Sors avant le crash" disagree; one verb everywhere (glossary below proposes "get out" / FR "sortir").

Motion and haptics (MOT-07)
- The trace draws in real time at the display rate (60 or 120 fps, MOT-12), ahead of the stake number.
- Each time the stake steps up, a selection haptic; the steps come faster as the curve accelerates, which builds tension without sound.
- Exit: the player's tile flips to show their exit stake, light success haptic on that player's phone (several phones) or on the host.
- Crash: the line snaps, turns to the danger colour and falls; heaviest haptic; tiles of players still in tremble before their penalty appears (MOT-06 rule).
- Shake only above high stakes and never on the text the players must read (ADP-07).
- Reduce Motion: the curve appears as steps without the falling line; haptics kept.
- Sound (optional): a rising tone mixed with music, never stopping it (O-14).

Multiplayer needs
- One phone: no network, the host draws the crash point.
- Several phones: a real-time session. The server draws the crash point and keeps it secret (it can publish a hash of it at round start and the value after the crash, so players can check nothing was changed), sends a shared start time, receives exits with timestamps, decides penalties. Clients draw the curve locally from the shared clock. If the game ever feeds leaderboards (RANK), it falls under the red team (AC-10); recommendation: game records stay inside games and award no leaderboard points (A-GAMES-11).

Rules cards (O-46), intent only
1. The number is what the crash costs if you are still in.
2. Get out whenever you want; the first one out pays 1 if others got out too.
3. (Hard and Extreme) the best exit hands out sips.

FAB position: top corner; hidden during the live curve on the one-phone host (hands are on the tiles), visible between rounds and on player phones in several-phones mode.

## 3. Decisions proposed

1. "Qui a ?" is a group designation game (point on zero, penalty per finger), not a confession game. Reason: confession is O-56; the catalogue already promises designation.
2. Shared penalty model "sips or forfeit" with a per-player "no alcohol" switch and a water swap for players at UI level 3. Reason: brief constraint (non-drinkers can play) and the app must never push a wasted player to drink.
3. Game penalties never create drinks; only the FAB logs a drink. Reason: sips are not standard drinks and BAC must stay based on what users declare.
4. La Bombe escalation follows elapsed time over the longest possible fuse. Reason: the prototype leaks the fuse.
5. La Bombe "app is the referee" and the Piatnik late-challenge rule. Reason: fewer arguments, faster rounds.
6. La Bombe table style, suggested at UI level 2 and 3. Reason: phone safety.
7. Les Mines push-your-luck turn (reveal at least one, stop or one more, extra tiles give sips), distinct mine placement, numbers at Normal only. Reason: gives the player a decision and fixes the prototype bug.
8. La Courbe as a crash game with a heavy-tailed crash point, "first out takes 1", stake-sized penalties. Reason: fixes the solved prototype and matches the only reading of the name that fits our values.
9. La Courbe shows an integer stake in sips, not a decimal multiplier. Reason: legibility when drunk, meaning, and no casino look.
10. Several phones only where it adds something: required for La Courbe above 8 players (6 at UI level 2), optional secret vote for Qui a ?, none for La Bombe and Les Mines in v1.
11. No casino codes in Les Mines and La Courbe (no coins, no money stakes, no "bet" or "cash out", no gambling ads anywhere in the app). Reason: keeps clear of Play's simulated-gambling rules for ads and of the casino visual cliché.
12. Every catalogue duration for these games is computed from settings or removed. Reason: <anti_slop>.

## 4. Assumptions

- A-GAMES-1: Sip caps, fuse ranges, mine counts, curve speed and deck lengths in this report are starting values, not researched values. Verify: crew playtest (SLOP-06 panel) at each level, adjust before the spec freezes.
- A-GAMES-2: The UI level that shapes a game screen is the level of the signed-in user of that phone; other players' levels only change their own penalty (water swap). Based on ADP-01 being per user. Verify: with the drunk_mode spec owner.
- A-GAMES-3: The penalty unit "sip" and forfeit sizes (small / medium / large mapped to sip counts) are a cross-game convention we introduce; our prototype copy already uses "gorgées". Verify: VOICE.md author and the O-49 spec.
- A-GAMES-4: S2M's "Qui a ?" is a designation game. Based on the name, S2M also having separate confession (Je n'ai jamais) and two-player vote (Qui de nous ?) games, and our own catalogue line. Verify: install S2M 2.0.6 (Normal is free) and read its "Qui a ?" rules cards.
- A-GAMES-5: S2M's "La Bombe" is a pass-the-phone timer game. Based only on the name, the 2.0.6 fix, and the classic Tic Tac Boum lineage. Verify: S2M rules cards in 2.0.6.
- A-GAMES-6: A category word takes a few seconds for a tipsy player, so fuses under about 10 s end before the second holder. Based on the Piatnik 10 to 60 s range and Categories timing (a few seconds per answer). Verify: timed playtest.
- A-GAMES-7: S2M's "Les Mines" is a turn-based mine grid. Based on the name and the casino Mines format. Verify: S2M rules cards.
- A-GAMES-8: A 5x5 grid fits at UI level 2 on a 390-pt-wide phone with ADP-04 target sizes. Verify: DESIGN.md target tokens and the ADP-09 test bench.
- A-GAMES-9: S2M removed or replaced "La Courbe" between its first 7-game release and the current 13-game description. Based on the Play Store and App Store descriptions and the game count arithmetic. Verify: S2M 2.0.6 catalogue on a device; an archived 1.0 listing (Wayback Machine) if needed.
- A-GAMES-10: A heavy-tailed crash point (chance to pass x is about 1/x) feels fair and tense at party pace. Based on how commercial crash games distribute crashes. Verify: playtest with the round-length and penalty distribution logged.
- A-GAMES-11: Game records (best exit, survival streak, mines-free streak) stay inside the games and award no leaderboard points, so these four games need no anti-cheat beyond server authority in La Courbe several-phones mode. Verify: with the RANK owner; if records feed leaderboards, add the four games to AC-10.
- A-GAMES-12: Passing a phone between drunk people risks drops; a table style reduces it. Common sense, no source. Verify: crew playtest preference.
- A-GAMES-13: Players in a several-phones game are physically together, so network latency mostly matters for La Courbe exits. Based on the product being for crews in one place. Verify: real-time ADR.

## 5. Scope changes

- New ID proposed (N-xx, number set by the orchestrator) [P0]: "Penalty model for games": sips or forfeit on every penalty, per-player "no alcohol" switch, water swap at UI level 3, penalty counter never logs drinks. Reason: required by the brief for every game and not covered by O-49 as written.
- New ID proposed [P0]: "Forfeit deck": forfeit cards in three sizes, FR and EN, part of the O-65 content budget. Reason: the penalty model needs content that no game ID owns.
- New ID proposed [P1]: "Table style" for passing games (La Bombe now, any future pass-the-phone game). Reason: phone safety at UI level 2 and 3.
- O-44 change: catalogue durations must be computed from settings, or not shown. Reason: <anti_slop>.
- O-46 change: the "?" is hidden during live timed phases (La Bombe fuse, La Courbe curve). Reason: no stalling.
- Prototype gap to record for the specs: JeuxAction.dc.html has no FAB (O-32) and no "?" rules button (O-46) on La Bombe, Les Mines and Ça grimpe.
- Content budget note for O-65: Qui a ? and La Bombe need cards; Les Mines and La Courbe need none (except forfeits), which makes them the cheapest games to localise.

## 6. Glossary additions

| Concept | Code / EN UI | FR UI |
|---|---|---|
| Unit of game penalty | `sip` / sip | gorgée |
| Penalty in a game (sips or forfeit) | `Penalty` / penalty | pénalité |
| Non-drinking alternative to a penalty | `Forfeit` / forfeit | gage |
| Player who does not drink alcohol in games | `Player.noAlcohol` / no alcohol | sans alcool |
| One cycle of a game (card, fuse, grid, curve) | `GameRound` / round (games only) | manche |
| Player reading the card in Qui a ? | `Reader` / reader | lecteur |
| Hidden timer in La Bombe | `Fuse` / fuse | mèche |
| Player holding the bomb | `BombHolder` / holder | porteur |
| Passing mode with the phone left in the middle | `TableStyle` / phone on the table | téléphone posé |
| Sips the crash would cost in La Courbe | `Stake` / stake | en jeu |
| Leaving the curve before the crash | `exit` / get out | sortir |

Conflict to settle: the glossary already uses `Round` / round / tournée for a round of drinks paid by one person. A game round needs another code name (`GameRound` proposed) and the EN UI word "round" would then mean two things. Proposal: keep "round" for games in EN UI and call the paid round "a round of drinks" or rename it; the orchestrator decides.

## 7. Blockers

None that stop the specs. One useful action for the user, optional: install S2M 2.0.6 and screenshot the rules cards of "Le Qui A ?", "La Bombe" and "Les Mines" (Normal mode is free), and check whether "La Courbe" still exists. That would confirm or kill A-GAMES-4, 5, 7 and 9. S2M's Instagram, TikTok and YouTube could not be read without logging in or accepting a consent page, which I did not do.

## 8. Sources

All read on 2026-10-26. No page contained instructions aimed at an AI.

- S2M landing: https://soiree2malade.vercel.app and https://soiree2malade.vercel.app/en (names only 3 games, "+11", "14 games. 3 levels.")
- S2M brand site: https://soiree2malade.com (social links: Instagram, TikTok, YouTube, Snapchat; no game rules)
- App Store, current listing and full version history 1.1 to 2.0.6: https://apps.apple.com/fr/app/soir%C3%A9e2malade-jeux-de-soir%C3%A9e/id6761731203
- App Store, older indexed snapshot (search snippet listing the 7 original games): https://apps.apple.com/fr/app/soir%C3%A9e2malade/id6761731203
- Google Play listing and reviews: https://play.google.com/store/apps/details?id=com.soiree2malade.app&hl=fr&gl=FR
- Instagram (unreadable, login wall): https://www.instagram.com/soirees2malades/
- TikTok (unreadable): https://www.tiktok.com/@soirees2malades
- YouTube (consent page, not accepted): https://www.youtube.com/@soiree2malade/videos
- Most likely to: https://gamerules.com/rules/most-likely/
- Qui pourrait (Elle Belgique): https://www.elle.be/fr/229946-4-jeux-a-boire-originaux-pour-une-soiree-de-folie.html
- Paranoia: https://bargames101.com/paranoia-drinking-game/ and https://officialgamerules.org/game-rules/paranoia-drinking-game/ (via search summary)
- Qui est le plus ? (App Store): https://apps.apple.com/app/id6742323514 (via search summary)
- Categories / Drink while you think: https://gamerules.com/rules/categories-game-rules/ and https://gamerules.com/rules/drink-while-you-think/ (via search summary)
- Tic Tac Boum: https://www.regles-du-jeu.net/regles-du-tic-tac-boum/ (fetched page turned out to describe the outdoor ball variant), https://everybodywiki.com/Tic_Tac_Boum (via search summary)
- Piatnik Tic Tac Boom rulebook (PDF, 2025): https://www.piatnik.com/uploads/media/default/0001/08/1e733ebd5abe0478b8316aa94a92c36088ee3241.pdf
- BombParty clone: https://top.gg/bot/830160553484746772 (via search summary)
- Casino Mines mechanics: https://paripulse.it.com/en-bd/guides/how-to-play-mines-paripulse/, https://adventuremagazine.co.nz/mines-games-explained-how-each-safe-pick-changes-the-next-cash-out-value/, https://intercom.help/support-help-center/en/articles/11550438-mines (via search summary, low-quality sources, mechanics only)
- Minesweeper rules: https://regles2jeux.fr/regle-du-demineur/ (via search summary; direct fetch failed on a TLS error)
- Crash games: https://gembetcasino.it.com/aviator-game, https://thesource.com/2025/09/06/the-mathematics-behind-multiplier-based-crash-games-like-aviator/ (via search summary, gambling-industry sources, mechanics only)
- Google Play gambling policy: https://support.google.com/googleplay/android-developer/answer/9877032?hl=en
- App Store age ratings (third-party summaries): https://trysonar.app/blog/app-store-age-rating, https://capgo.app/blog/app-store-age-ratings-guide/ (via search summary; Apple's own page not read)
- WCAG 2.3.1 (three flashes): known standard, not re-read for this report.
- Local: PROMPT.md, design/prototype/JeuxAction.dc.html, design/prototype/JeuxCartes.dc.html, design/prototype/Jeux.dc.html, design/prototype/README.md, research/README.md.
