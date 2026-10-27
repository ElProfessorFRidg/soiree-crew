# GLOSSARY.md

One word per concept, everywhere: code, database, API, docs, UI. Code and every developer-facing file use the English term. The French term is only for French UI copy. Nobody invents a synonym: a new concept gets a new row here first.

## Base terms (from `PROMPT.md`)

| Concept | Code / EN UI | FR UI |
|---|---|---|
| Group of friends | `Crew` / crew | crew |
| One night out | `Party` / party | soirée |
| Multi-day outing | `Trip` / trip | séjour |
| Logged alcoholic drink | `Drink` / drink | verre |
| Blood alcohol estimate | `BacEstimate` / BAC | taux |
| Round paid by one person | `Round` / round | tournée |
| Bar, club, flat, spot | `Venue` / place | lieu, bar |
| Presence at a venue | `CheckIn` / check-in | check-in |
| Member ruling a venue this season | `VenueBoss` / boss | boss |
| Leaderboard | `Leaderboard` / leaderboard | classement |
| Shared expenses (S2M's "Kwitt") | `ExpensePool` / pool | cagnotte (final name set in branding) |
| Adaptive drunk UI level | `UiLevel` (0 to 3) | niveau |
| Evening status | `NightStatus` / status | statut |
| User settings | `UserPreferences` / settings | réglages |
| Unit system | `UnitSystem` (metric, us_customary, uk_imperial) / units | unités |
| Public profile | `PublicProfile` / public profile | profil public |
| Who can see an item | `Audience` (only_me, crews, friends, everyone) / visibility | visibilité |
| Review of a venue | `VenueReview` / review | avis |
| Frequent visitor of a venue | `VenueRegular` / regular | habitué |
| Age checks at a venue's door | `DoorPolicy` / door policy | contrôle à l'entrée |
| Party open to strangers | `OpenParty` / open party | soirée ouverte |
| Chat (crew, party or direct) | `Conversation` / chat | discussion |
| Action waiting for the server | `PendingMutation` / (never shown as a word) | (jamais affiché) |

## Added during the project

| Concept | Code / EN UI | FR UI | Added by | Reason |
|---|---|---|---|---|
| Summary of a night | `Recap` / recap | récap | voice.md §6 | Used in many IDs and DESIGN.md §9, missing from the base table. |
| Party mood | `PartyMood` / mood | ambiance | design-a.md §6 | O-35, JOY-04. |
| Day boundary of a night | `NightDayBoundary` / (shown as a time, "until 6 am") | (« jusqu'à 6 h ») | design-a.md §6, territories.md §6 | QOL-02. See conflict C-04. |
| Night (period between two day boundaries) | `Night` / night | nuit | territories.md §6 | One counted check-in per venue per night (TER-03). |
| Undo window | `UndoWindow` / undo | annuler, « Annuler pendant » | design-a.md §6 | ADP-04, QOL-13. |
| Next-morning vault | `MorningVault` / next-morning vault | « Mis de côté jusqu'à demain » | design-a.md §6, bac.md §6 | ADP-06. See conflict C-05. |
| Contact whose messages are held at high levels | `HeldContact` / held contact | « Messages retenus jusqu'au lendemain » | design-a.md §6 | ADP-10. |
| Message held by the drunk-text guard | `HeldMessage` / held message | message retenu | design-b.md §6 | ADP-10. |
| Designated driver | `DesignatedDriver` / designated driver | SAM | design-a.md §6 | N-26. |
| Home-safe confirmation | `HomeSafeConfirmation` / home safe | « Je suis bien rentré », rentré | design-a.md §6 | N-25, O-82. |
| Feeling-unwell status | `NightStatus.unwell` / not feeling well | pas bien | app.md §6 | Proposed N-36. |
| Ghost mode for live location | `GhostMode` / ghost mode | mode fantôme | design-a.md §6 | N-07. |
| Shared live curves within a party | `SquadMode` / Squad | Squad | design-a.md §6 | O-42. See conflict C-12. |
| Dare of the night | `NightDare` / dare of the night | défi du soir | design-a.md §6, design-b.md §6 | JOY-12. See conflict C-11. |
| Proximity clink between two phones | `Cheers` / cheers | trinquer, « Tchin » | design-a.md §6 | JOY-01. See conflict C-13. |
| BLE token exchange used as an anti-cheat signal | `ProximityHandshake` / (not shown) | (jamais affiché) | anticheat.md §6 | AC-04. See conflict C-13. |
| Low-battery reduced-effects mode | `EcoMode` / battery saver | économie de batterie | design-a.md §6, motion.md §6 | ADP-08, QOL-24. See conflict C-06. |
| Body model used by the BAC formula | `BodyModel` (male, female) / body model | morphologie pour le calcul | bac.md §6 | O-04. |
| Breath alcohol concentration | `BreathAlcohol` / breath (mg/L) | taux dans l'air expiré (mg/L) | bac.md §6 | O-15. Display only; storage is g/L of blood (PREF-06). |
| Distribution factor (Widmark r) | `DistributionFactor` / (internal) | (interne) | bac.md §6 | BAC engine. bac.md FR "coefficient de diffusion" is never shown. |
| Elimination rate | `EliminationRate` / (internal) | (interne) | bac.md §6 | BAC engine. FR « vitesse d'élimination » only in the long notice (O-86). |
| Absorption phase | `AbsorptionPhase` / (internal) | (interne) | bac.md §6 | BAC engine. FR « phase d'absorption » only in O-86. |
| Food state for the BAC model | `MealState` (fasting, light, full) / food | estomac (à jeun, léger, plein) | app.md §6, bac.md §5 | Proposed O-85. |
| Estimated peak | `BacPeak` / peak | pic | bac.md §6 | O-16. |
| Back to zero | `BackToZero` / back to zero | Retour à 0 | bac.md §6 | O-17. bac.md wrote « Retour à zéro »; the approved prototype writes « Retour à 0 ». |
| Under the limit at | `UnderLimitAt` / under the limit at | sous la limite à | bac.md §6 | O-18, proposed O-87. |
| Too close to call | `TooCloseToCall` / too close to call | trop juste pour conclure | bac.md §6 | Proposed O-87. |
| Standard drink | `StandardDrink` / standard drink | verre standard | bac.md §6 | PREF-02. bac.md offers « unité d'alcool » as an alternative; the prototype uses « verre standard ». |
| Novice / probationary driver mode | `NoviceDriverMode` / novice driver | jeune permis | bac.md §6 | O-05. See conflict C-08. |
| Danger cap | `DangerCap` / danger cap | plafond de sécurité | bac.md §6, anticheat.md §6 | RANK-07. |
| Blood/breath ratio | `BreathRatio` / (internal) | (interne) | bac.md §6 | Per country, PREF-06. |
| Alcohol-poisoning signs card | `PoisoningSignsCard` / (card, no noun) | (carte, pas de nom) | bac.md §2.5 | Proposed O-88. |
| Monthly territory period | `Season` / season | saison | design-b.md §6, territories.md §6 | TER-04. |
| Change of venue boss | `VenueTakeover` / takeover | prise | design-b.md §6, territories.md §6, voice.md §6 | TER-04, MOT-09. See conflict C-09. |
| Points toward ruling a venue | `RulePoints` / points | points | design-b.md §6 | TER-02. |
| Earned name tied to venues or seasons | `Title` / title | titre | design-b.md §6 | TER-06, N-34. |
| Crown held at season close | `VenueMayor` / Mayor | maire | territories.md §6 | TER-06 change (boss is the live crown). |
| Interval during which a member is boss | `Reign` / reign | règne | territories.md §6 | TER-04. |
| Last season's Mayor shown until someone reaches 15 points | `GhostCrown` / ghost crown | couronne fantôme | territories.md §6 | TER-04. |
| Monthly rule modifier | `SeasonVariant` / rule of the month | règle du mois | territories.md §6 | Proposed TER-12. |
| Check-in that earns points | `CountedCheckIn` / (internal) | (interne) | territories.md §6 | TER-03. See conflict C-10. |
| 15-minute wait before a check-in earns points | `Vesting` / (internal) | (interne) | territories.md §6 | TER-03. See conflict C-10. |
| Check-in backed by another member | `Corroboration` / (internal) | (interne) | territories.md §6 | TER-02. See conflict C-10. |
| Check-in accepted without corroboration | `SoloCheckIn` / solo check-in | check-in solo | territories.md §6 | TER-03. |
| Credited minutes at a venue | `TimeAtVenue` / time there | temps sur place | territories.md §6 | TER-02. |
| Discrete event proving presence | `ProofOfPresence` / (internal) | (interne) | territories.md §6 | TER-02. |
| First check-in of the crew at a venue | `FirstDiscovery` / discovery | découverte | territories.md §6 | TER-02. Holder title: Discoverer / découvreur. |
| Venue that can be played | `TerritoryVenue` / (internal) | bar en jeu | territories.md §6 | TER-01, TER-11. |
| Days as boss summed over venues | `VenueDays` / reign days | jours de règne | territories.md §6 | Conqueror title. |
| Titles Conqueror, Explorer, Nomad | `Title.conqueror`, `Title.explorer`, `Title.nomad` | conquérant, explorateur, nomade | territories.md §6 | TER-06. |
| Lifetime loyalty tier at a venue | `LoyaltyTier` (bronze, silver, gold) / tier | (to set in VOICE.md, not « habitué ») | territories.md §6 | Proposed TER-10. See conflict C-14. |
| Top public regular at a venue | `Title.legend` / Legend of X | légende de X | territories.md §6 | COM-03. |
| Crew score at a venue for crew vs crew | `CrewPresenceScore` / (internal) | (interne) | territories.md §6 | TER-07. |
| Venue never visited | `FogOfWar` / to conquer | à conquérir | design-b.md §6, territories.md §6 | TER-08. territories.md FR « brouillard » is the map layer name, design-b « à conquérir » the venue state. |
| Workplace exclusion | `WorkplaceExclusion` / I work here | mon lieu de travail | territories.md §6 | Proposed TER-11. |
| Aggregated crowd level for strangers | `BusynessLevel` / how busy | affluence | design-b.md §6, community.md §6 | COM-06. See conflict C-15. |
| Rejected event recorded as cheating | `CheatAttempt` / cheat attempt | tentative de triche | design-b.md §6, design-c.md §6, anticheat.md §6 | AC-09. The 7-day badge is `ShameBadge`, shown as « A tenté de tricher, 7 j »; drop « Tricheur du week-end » (design-b.md G-13). |
| Verdict of an event | `EventVerdict` (accepted, unverified, rejected) | validé, à confirmer, tentative de triche | anticheat.md §6 | AC-06. |
| Per-event risk sum | `RiskScore` / (never shown) | (jamais affiché) | anticheat.md §6 | AC-06. See conflict C-16. |
| Per-account trust for aggregates | `TrustScore` / (never shown) | (jamais affiché) | community.md §6 | Proposed COM-16. See conflict C-16. |
| One-tap "I'm with them" | `PeerConfirmation` / confirm | confirmation d'un pote | anticheat.md §6 | AC-04. |
| Host code rotating every 30 s | `RotatingQr` / party QR | QR de la soirée | anticheat.md §6 | AC-04. |
| Camera-only photo for verification | `LivePhoto` / live photo | photo en direct | anticheat.md §6 | AC-04, AC-07. |
| Signal category, nonce book, attestation | `SignalCategory`, `NonceBook`, `Attestation` | (jamais affiché) | anticheat.md §6 | AC-06, AC-08, AC-05. |
| Game session | `GameSession` / game | partie | design-c.md §6 | Must not be confused with `Party` (soirée). |
| One cycle of a game | `GameRound` / round | manche | design-c.md §6, games.md §6 | See conflict C-01. |
| Penalty in a game (sips or forfeit) | `Penalty` / penalty | pénalité | games.md §6, design-c.md §6, app.md §6 | Proposed O-89. See conflict C-02. |
| Unit of game penalty | `Sip` / sip | gorgée | design-c.md §6, games.md §6 | Every game result. |
| Non-drinking alternative to a penalty | `Forfeit` / forfeit | gage | games.md §6 | Proposed O-90. See conflict C-02. |
| Dare (game card) | `Dare` / dare | défi | voice.md §6 | Card type. |
| Game card | `Card` / card | carte | voice.md §6 | O-65. |
| Card type | `CardType` (dare, rule, vote, minigame) | défi, règle, vote, mini-jeu | design-c.md §6 | O-50. |
| Crew-written card | `CrewCard` / crew card | carte du crew | design-b.md §6, design-c.md §6 | N-33. |
| Game difficulty | `GameLevel` (normal, hard, extreme) | (labels in VOICE.md; never « niveau ») | design-b.md §6, design-c.md §6, app.md §6 | O-45. See conflict C-03. |
| Game played on one or several phones | `PlayMode` (single_device, multi_device) | un téléphone, plusieurs téléphones | app.md §6 | O-44. |
| Per-round countdown | `RoundTimer` / round timer | minuteur par manche | design-b.md §6 | O-47. |
| Player without an account | `GuestPlayer` / guest | sans compte | design-b.md §6 | O-49. |
| Player who does not drink alcohol in games | `Player.noAlcohol` / no alcohol | sans alcool | games.md §6 | Proposed O-89. |
| Penalty count | `PenaltyCount` / penalties | pénalités | design-c.md §6 | O-49. |
| Checkpoint and customs (L'Autoroute) | `Checkpoint`, `CustomsCheckpoint` | péage, douane | design-c.md §6 | O-51. |
| Player reading the card (Qui a ?) | `Reader` / reader | lecteur | games.md §6 | O-53. |
| Hidden timer and its holder (La Bombe) | `Fuse`, `BombHolder` / fuse, holder | mèche, porteur | design-c.md §6, games.md §6 | O-54. |
| Passing mode with the phone left on the table | `TableStyle` / phone on the table | téléphone posé | games.md §6 | Proposed O-91. |
| Sips the crash would cost (La Courbe) | `Stake` / stake | en jeu | games.md §6 | O-64. |
| Leaving the curve before the crash | `CurveExit` / get out | sortir | games.md §6, design-c.md §6 | O-64. design-c.md named it `CashOut`; games.md bans casino vocabulary, so `CurveExit`. Crash point: `CrashPoint` / crash. |
| Hidden role and secret word | `HiddenRole` (impostor, double_agent), `SecretWord` | imposteur, agent double, mot | design-c.md §6 | O-61, O-62. |
| Game records board | `HallOfFame` / hall of fame | Panthéon | design-b.md §6 | N-24. |
| Game difficulty labels | `GameLevel` normal, hard, extreme / Normal, Hard, Extreme | Normal, Difficile, Extrême | games builder | O-45. One set for every game, from the Jeux board; settles C-03 for the labels. |
| O-50 mixed deck game | `bigDeck` / The Big Deck | Le Grand Paquet | games builder | Our name, not S2M's. |
| O-51 checkpoint card game | `tollRoad` / Toll Road | Le Péage | games builder | Checkpoint = booth / péage, customs = customs / douane. |
| O-52 two-player card duel | `faceOff` / Face-off | Face-à-face | games builder | |
| O-53 pointing game | `pointBlank` / Point Blank | À bout portant | games builder | Designation game (games.md §2.1). |
| O-54 bomb game | `fuse` / Short Fuse | La Mèche | games builder | |
| O-55 roulette | `wheel` / The Wheel | La Roue | games builder | |
| O-56 never have I ever | `neverEver` / Not Once | Jamais de la vie | games builder | Extreme is the unfiltered deck. |
| O-57 which of us two | `verdict` / The Verdict | Le Verdict | games builder | Card prompt: "Which of these two..." / « Qui des deux... ». |
| O-58 truth or dare | `truthDare` / Spill or Dare | Vérité ou cap | games builder | Truth = spill / vérité, dare = dare / cap. |
| O-59 mines game | `minefield` / Minefield | Terrain miné | games builder | |
| O-60 finger chooser | `fingerPick` / Short Straw | Qui s'y colle | games builder | |
| O-61 impostor game | `impostor` / Odd One Out | L'Intrus | games builder | Hidden role `impostor`: odd one out / intrus. |
| O-62 double agent game | `doubleAgent` / Moles | Les Taupes | games builder | Hidden role `agent`: mole / taupe. |
| O-63 drawing game | `quickDraw` / Quick Draw | Dessine vite | games builder | |
| O-64 crash game | `crash` / Bail Out | Ça grimpe | games builder | `CurveExit` stays get out / sortir. |
| Players around one phone for games | `TablePlayer` / players | joueurs | games builder | Includes guests; not a crew. |
| Remote drawing link | `DrawingTransport` (local, remote) | (interne) | games builder | Seam for online Quick Draw. |
| Recipe and "what can I make" tool | `Recipe`, `Mixer` / recipe, mixer | recette, mixeur (final name in branding) | design-c.md §6, app.md §6 | O-66, O-69. |
| Shopping list item | `ShoppingItem` / list item | courses | design-c.md §6 | N-32. |
| Next-morning alibi | `Alibi` / alibi | alibi | design-c.md §6 | O-76. |
| Transfer to settle a pool | `Settlement` / transfer | virement | design-c.md §6 | O-70. |
| Expense in a pool | `Expense` / expense | dépense | design-c.md §6 | O-70. |
| Split mode | `SplitMode` (equal, shares, amounts, percent) | égal, parts, montants, % | design-c.md §6 | N-19. |
| Personal party budget | `PartyBudget` / budget | budget | design-c.md §6 | N-20. |
| Voted line of a party | `NightQuote` / quote of the night | phrase de la nuit | design-b.md §6 | N-23. |
| Chronological party events | `PartyTimeline` / timeline | fil de la soirée | design-b.md §6 | N-22. See conflict C-07. |
| Crew activity digest | `CrewFeed` / crew feed | activité du crew | design-b.md §6, design-c.md §6 | N-31. design-c's « résumé du crew » (`CrewDigest`) is the grouped digest inside the feed. See conflict C-07. |
| Photo strip from the album | `PhotoStrip` / photo booth | photomaton | design-b.md §6 | JOY-09. |
| AI-written recap and its tone | `NarratedRecap`, `RecapTone` (plain, epic, roast) | récap raconté; sobre, épique, (roast: to set) | design-b.md §6, voice.md §6 | AI-02. See conflict C-17. |
| Morning-after screen state | `MorningMode` / morning mode | mode lendemain | design-b.md §6 | QOL-20. |
| Consecutive weeks out together | `CrewStreak` / streak | série | design-b.md §6 | JOY-06. |
| Count-based celebration of nights | `Milestone` / milestone | (no noun; « 50e soirée ensemble ») | design-b.md §6 | JOY-08. |
| "I'm going out, who's in?" broadcast | `GoingOutCall` / who's in | « Je sors, qui vient ? » | design-b.md §6 | N-03. |
| Outing poll | `OutingPoll` / poll | sondage | design-b.md §6 | N-04. See conflict C-18. |
| Usual nights out | `RecurringAvailability` / usual nights | soirs habituels | design-b.md §6 | N-05. |
| Key fingerprint shown for verification | `SafetyNumber` / safety number | code de sécurité | design-b.md §6, security.md §6 | MSG-05. See conflict C-19. |
| Per-conversation expiry | `DisappearingMessages` / disappearing messages | messages éphémères | design-b.md §6, security.md §6 | MSG-06. |
| Backup secret | `RecoveryKey` / recovery key | clé de récupération | security.md §6, design-b.md §6 | MSG-08. See conflict C-20. |
| A user's extra device with its own keys | `LinkedDevice` / linked device | appareil associé | security.md §6 | Proposed MSG-11. |
| System message when a contact's key changes | `KeyChangeNotice` / key change notice | avertissement de changement de clé | security.md §6 | MSG-05. |
| End-to-end encryption | `E2ee` / end-to-end encryption | chiffrement de bout en bout | security.md §6 | MSG-02. |
| Consent given by a positive act for health data | `ExplicitConsent` / explicit consent | consentement explicite | security.md §6 | SEC-08. |
| BAC and drinks stay on the phone | `LocalOnlyMode` / local only | mode local uniquement | security.md §6 | Proposed SEC-11. |
| Crypto-shredding, blind index, Delivery Service | `CryptoShredding`, `BlindIndex`, `DeliveryService` | (interne) | security.md §6 | SEC-04, SEC-08, MSG-02. |
| Audience preset | `AudiencePreset` (private, friends, public) | privé, amis, public | design-c.md §6 | PROF-01. See conflict C-21. |
| Who can find you | `Findability` (search, exact_username, nobody) | recherche, pseudo exact, personne | design-c.md §6 | PROF-09. |
| Preview of one's own profile | `ViewAs` / view as | voir comme | design-c.md §6 | PROF-07. |
| Item hidden from one's profile | `HiddenItem` / hidden | caché | design-c.md §6 | PROF-03. |
| Shareable member card | `MemberCard` / member card | carte de membre | design-c.md §6 | JOY-11. |
| Alternate app icon | `AppIconVariant` / app icon | icône de l'app | design-c.md §6 | JOY-03. |
| Quiet hours | `QuietHours` / quiet hours | heures calmes | design-c.md §6 | N-35. |
| Signed-in device | `DeviceSession` / session | « Connecté sur » | design-c.md §6 | SEC-07. |
| Passkey | `Passkey` / passkey | clé d'accès | design-c.md §6 | SEC-07. |
| Travel suggestion banner | `TravelSuggestion` / (banner, no noun) | (bannière, pas de nom) | design-c.md §6 | PREF-05. |
| Draft | `Draft` / draft | brouillon | design-c.md §6 | QOL-07. |
| Moderation decision | `ModerationDecision` / decision | décision | community.md §6 | COM-08. |
| Notice explaining a decision | `StatementOfReasons` / reason for this decision | motif de la décision | community.md §6 | Proposed COM-13. |
| Report on an item or person | `Report` / report | signalement | community.md §6 | COM-08, O-77. |
| User contesting a decision | `Appeal` / contest | contestation | community.md §6 | Proposed COM-13. |
| Strike on an account | `Strike` / warning | avertissement | community.md §6 | COM-08. |
| Door report after a check-in | `DoorReport` / door check | contrôle à l'entrée | community.md §6 | COM-07. The aggregate stays `DoorPolicy`. See conflict C-22. |
| Owner of a claimed venue page | `VenueOwner` / owner | gérant | community.md §6 | COM-11. |
| iOS Live Activity | `LiveActivity` / Live Activity | activité en direct | polish.md §6 | HUB-02. Apple's FR name. |
| Android promoted ongoing notification | `LiveUpdate` / Live Update | mise à jour en direct | polish.md §6 | HUB-02. FR system name UNVERIFIED. |
| iOS Control, Quick Settings tile, App Shortcut | `Control`, `QuickSettingsTile`, `AppShortcut` | commande, vignette Réglages rapides, raccourci d'app | polish.md §6 | QOL-04. FR names UNVERIFIED except « raccourci ». |
| Lock screen without BAC figures | `DiscreetLockScreen` / discreet lock screen | écran verrouillé discret | polish.md §6 | Proposed QOL-27. |
| Passive notifications for people not at the party | `NightAwareDelivery` / (setting) | notifications nocturnes silencieuses | polish.md §6 | Proposed QOL-31. |
| Native fast path, deferred deep link, notification budget | `NativeFastPath`, `DeferredDeepLink`, `NotificationBudget` | (interne) | polish.md §6 | Proposed QOL-25, QOL-29, QOL-30. |
| Spring, bounce, perceptual duration, signature moment, effects spring, hitch, hitch ratio, motion scale | `Spring`, `Bounce`, `PerceptualDuration`, `SignatureMoment`, `EffectsSpring`, `Hitch`, `HitchRatio`, `MotionScale` | (interne) | motion.md §6 | MOT-01, MOT-12, proposed MOT-14. |
| Haptic vocabulary | `HapticVocabulary` (H1 to H12) / haptics | vibrations | motion.md §6 | MOT-01, proposed MOT-15. |
| OS reduce-motion settings | `ReduceMotion` / Reduce Motion | « Réduire les animations » (iOS), « Supprimer les animations » (Android, UNVERIFIED) | motion.md §6 | MOT-12. System labels, only quoted. |
| State-driven Party screen background | `LivingBackground` / (no noun) | fond animé | motion.md §6 | MOT-02. |
| Agent skill and staged candidate | `AgentSkill`, `SkillCandidate` | (dev only) | skills.md §6 | SKILLS.md. |

## Conflicts to resolve

Found while merging the reports. Each row proposes one resolution; the orchestrator decides (listed in `research/open-decisions.md` part c unless the user must answer).

| # | Conflict | Sources | Proposed resolution |
|---|---|---|---|
| C-01 | "round" means a paid round of drinks (`Round`, tournée) and a game cycle (`GameRound`, manche) in EN UI. | Base glossary; design-c.md §6; games.md §6 | Code keeps `Round` and `GameRound`. EN UI: "round" inside games only; the paid round reads "round of drinks" wherever both could appear (Party screen, notifications). FR has no clash (tournée, manche). |
| C-02 | « gage »: app.md uses it for the penalty; games.md uses it for the forfeit and « pénalité » for the penalty; voice.md says « gage » is the penalty, not the dare. | app.md §6; games.md §6; voice.md §6 | `Penalty` = pénalité (sips or forfeit), `Forfeit` = gage (the non-drinking form), `Dare` = défi (a card type). |
| C-03 | « niveau » is the FR UI word for `UiLevel` and the prototype also uses levels for game difficulty; three FR naming sets exist (Normal / Difficile / Extrême, Gentil / Piquant / Sans filtre, Gentil / Piquant / Extrême). | Base glossary; design-c.md §1 item 3; app.md §6 | `GameLevel` never shows « niveau » in FR; one set of three labels chosen in VOICE.md for every game. |
| C-04 | Night boundary: QOL-02 makes it a per-user setting (default 6 am); territories.md fixes it at 06:00 in the crew's time zone for scoring and seasons. | design-a.md §6; territories.md §3.1; PROMPT QOL-02 | One `NightDayBoundary` concept: the user setting drives personal stats and "tonight"; crew-shared scoring (territories, leaderboards, seasons) uses the crew's boundary and time zone so every member is scored on the same night. |
| C-05 | Next-morning vault FR: prototype « Mis de côté jusqu'à demain » vs bac.md « Coffre du lendemain ». | design-a.md §6; bac.md §6 | Keep the approved prototype label; « coffre » not used in UI. |
| C-06 | Eco mode FR: « Économie de batterie » (ModeBourre), « Économie d'énergie » (Réglages), « Mode éco » (motion.md). | design-a.md §6; design-c.md §2.6 screen 5; motion.md §6 | One concept `EcoMode`, FR « économie de batterie » on both screens. |
| C-07 | « fil » used for the party timeline (N-22) and the crew feed (N-31). | design-b.md G-13 | « fil de la soirée » for N-22 only; N-31 becomes « activité du crew ». |
| C-08 | Novice driver FR: prototype « Jeune permis » vs bac.md « Permis probatoire ». | design-a.md §2.1; bac.md §6 | « jeune permis » in UI; « permis probatoire » only in the long legal notice. |
| C-09 | Takeover FR: « prise de bar » (design-b), « prise » (territories), « prise du lieu » (voice). | design-b.md §6; territories.md §6; voice.md §6 | « prise » as the noun, the UI line « {venue} est à toi. »; « bar » is avoided because flats can be venues for parties. |
| C-10 | Check-in states overlap: territories « Check-in compté », « Validation sur place », « Check-in confirmé » vs anticheat verdicts « Validé » and « À confirmer ». | territories.md §6; anticheat.md §6 | Only the three `EventVerdict` words are shown; counted, vesting and corroborated are internal states (vesting may show as a pending state without a noun). |
| C-11 | Dare of the night code name: `NightlyDare` (design-a) vs `NightDare` (design-b). | design-a.md §6; design-b.md §6 | `NightDare`. |
| C-12 | "Squad" is the O-42 feature name, but SLOP.md R-19 rejects "squad" as a synonym of crew in EN and FR. | design-a.md §6; SLOP.md R-19 | Keep "Squad" only as the feature name (`SquadMode`), never as a noun for the group; R-19 allowlists the `squad_mode.*` keys. |
| C-13 | « Tchin » names both the fun clink (JOY-01) and the anti-cheat BLE signal (AC-04). | design-a.md §6; anticheat.md §6 | `Cheers` (« trinquer », « Tchin ») is the user-facing moment; `ProximityHandshake` is the internal signal and is never named in UI. |
| C-14 | « habitué » is the base glossary word for `VenueRegular` (COM-03 public regulars) and territories.md reuses it for TER-10 loyalty tiers. | Base glossary; territories.md §6 | « habitué » stays for COM-03; TER-10 tiers get another FR label in VOICE.md. |
| C-15 | Busyness: code `BusyLevel` (design-b) vs `BusynessLevel` (community); labels « Blindé / Animé / Calme » (prototype) vs « Calme / Ça se remplit / Plein » (community). | design-b.md §6; community.md §2.2.2, §6 | `BusynessLevel`, FR noun « affluence », one set of three labels in VOICE.md, plus the "not enough data" state. |
| C-16 | anticheat.md gives the per-event risk score the FR « score de confiance », which reads as the per-account `TrustScore` of community.md. | anticheat.md §6; community.md §6 | Two internal concepts, `RiskScore` (event) and `TrustScore` (account); neither has a FR UI term. |
| C-17 | Recap tone "roast": prototype « Roast », voice.md proposes « chambrage ». | design-b.md §2.1 screen 5; voice.md §6 | Settle in VOICE.md with the branding pass. |
| C-18 | « sondage de sortie » uses « sortie », which SLOP.md R-19 rejects as a synonym of soirée. | design-b.md §6; SLOP.md R-19 | FR « sondage » alone. |
| C-19 | Safety number FR: « clé de sécurité » (prototype) vs « code de sécurité » (security). | design-b.md §6; security.md §6 | « code de sécurité » (what is compared is a code; the key is what it proves). |
| C-20 | Backup secret: prototype shows a 6-word passphrase (`RecoveryPassphrase`, « phrase »); security.md recommends a generated recovery key only. | design-b.md §2.3 screen 4; security.md §2.3 | `RecoveryKey`, « clé de récupération », per the MSG-08 change. |
| C-21 | FR for `Audience.everyone`: « Tous » (profile chips), « Public » (review audience and preset). | design-b.md G-13; design-c.md §2.5 | One word for the audience (proposal « Tout le monde »); « Public » stays only as the preset name. |
| C-22 | Door policy label: prototype « La carte d'identité à l'entrée » vs base glossary « contrôle à l'entrée ». | design-b.md G-13; community.md §2.6 | Concept label « contrôle à l'entrée »; the question text may mention « pièce d'identité ». |
| C-23 | `PendingMutation` is "never shown as a word", but DESIGN.md §9 shows « 3 actions partiront ». | Base glossary; voice.md §6 | « actions » allowed only as a count in sync messages; update the base row note. |
| C-24 | BAC FR: base glossary « taux »; bac.md uses « Alcoolémie »; SLOP.md R-19 allows « alcoolémie » only in `bac.notice.*` and `legal.*`. | Base glossary; bac.md §6; SLOP.md R-19 | « taux » in UI; « alcoolémie » only in the notice and legal texts. |
| C-25 | SLOP.md R-19 rejects « boisson(s) » for verre, but the prototype uses « Mes boissons » for presets that include soft drinks, and « Boissons préférées » on the profile. | SLOP.md R-19; design-a.md §2.2 screen 2; design-c.md §2.5 | Add a concept for the drink catalogue item that can be non-alcoholic (`DrinkPreset`, « boisson ») and allowlist it in R-19; a logged alcoholic `Drink` stays « verre ». |
| C-26 | SLOP.md R-19 rejects « événement » for soirée, but COM-09 venue events are a separate concept. | SLOP.md R-19; PROMPT COM-09 | Add `VenueEvent` (« événement ») and allowlist it in `venue.event.*` keys. |
