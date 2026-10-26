# DESIGN.md: approved design for the crew night-out app

This is the approved visual and interaction direction. It was validated by the user on a clickable prototype (100 screens, `design/prototype/`). Port it to the chosen stack with native components. Improve it where a native platform does better, never replace it silently: every deviation goes in `docs/adr/` with the reason.

Machine-readable values: `design/tokens.json` (colors, type, radius, spacing, sizes, motion) and `design/icons.json` (custom icon paths). Reference CSS of the prototype: `design/base.css`. Screen-by-screen spec: `design/SCREENS.md`.

## 1. Art direction: "slate and amber"

- Night first. Ground is a deep slate green (`bg #1E2624`), not neutral black. Surfaces step up in small lightness increments (`surface #28322F`, `surface2 #2C3734`, `surfaceRaised #34403C`).
- One accent: amber, like a pint under bar lights (`#F4B33D`). It marks the primary action, the BAC number and anything that is "yours". It is a scarce resource: never two competing amber elements on one screen except the BAC number plus the primary button.
- Semantic colors only where they mean something: danger and SOS (`#FF7A66`), water and hydration (`#8CCBEA`), OK / safe / confirmed (`#9BD8A8`). They differ in lightness, not only in hue.
- The memorable element is typographic: the BAC and every key figure are set in Archivo at width 62%, weight 900, tabular figures, very large (up to 140 px). Everything around it stays quiet.
- No gradients as decoration, no glow, no glassmorphism, no aurora, no neon. The only gradients in the prototype are functional: the conic progress ring of the SOS button, the roulette and wheel segments, the vertical threshold gradient on the BAC curve stroke.
- Light theme exists for daytime screens (next-morning mode, invitation web page): `light` tokens. Both themes must be polished.

## 2. Typography

One family: **Archivo** (variable, width 62 to 125, weight 300 to 900), fallback system UI. Load it as a bundled font file, not from a CDN.

| Style | Size / line height | Weight | Width | Use |
|---|---|---|---|---|
| numeral | 22 to 140 / 0.86 | 900 | 62% | BAC, timers, counters, prices, scores |
| h1 | 32 / 1.04 | 800 | 76% | screen titles |
| h2 | 22 / 1.12 | 750 | 82% | sheet titles, section heroes |
| h3 | 16 / 1.25 | 700 | 100% | row titles, card titles |
| body | 15 / 1.45 | 400 | 100% | text |
| small | 13 / 1.4 | 400, textMuted | 100% | secondary lines |
| label | 13 | 700, textMuted | 100% | section labels (sentence case, never all caps) |
| button | 16 (small: 14) | 700 | 100% | buttons |
| tag | 12 | 650 | 100% | tags |
| tab | 11 | 650 | 100% | tab bar labels |

Rules: sentence case everywhere, no all-caps labels, no label above a heading, no italic serif, no gradient text. Support Dynamic Type / font scaling: layouts wrap, never truncate key information.

## 3. Layout and anatomy

- Phone first, portrait. Content padding 20 px horizontally; top = safe area + 14; section gap 16; block gap 10; inline gap 8.
- Bottom tab bar, 5 tabs: Soirée, Crew, Jeux, Bars, Moi. Icon 22 + label 11. Active tab in amber. Bar background = `bg`, 1 px top line.
- During a live party the app opens on the Party screen (HUB-01), not on a generic home.
- Bottom sheets for secondary flows (add drink, rules, confirmations, report). Sheet radius 26 on top corners, grab handle 40×5, scrim `rgba(10,14,13,.55)`.
- Cards are used sparingly (`card` radius 18, padding 16). Never a card inside a card. Lists use rows with a 1 px divider, min height 54.
- Touch targets ≥ 44 px everywhere, ≥ 64 px for the main party actions, ≥ 88 px at adaptive level 3.

## 4. Components (all states must exist)

| Component | Variants | States | Notes |
|---|---|---|---|
| Button | primary (amber), secondary (surfaceRaised), outline, danger, water; sizes 52 / 40 / 64 hero | default, pressed (scale .97, 120 ms), disabled (40% opacity), loading | Label is a verb that names the action ("Supprimer la soirée", never "OK" for destructive). |
| IconButton | 44×44, radius 12 | default, pressed | Always an accessibility label. |
| Chip | off / on (on = inverted text color) | default, selected, disabled | Filters, choices, quick replies. |
| Tag | neutral, amber, danger, water, ok (tinted bg + light text) | static | Status words: "vérifié", "en attente", "SAM", "batterie 6 %". |
| Segmented control | 2 to 5 items | selected item inverted | Periods, metrics, levels, audiences, server simulator. |
| Switch | 52×32, knob 24 | off, on (amber), disabled | Knob moves with `easeToggle` 220 ms. |
| Row | with leading icon / avatar, trailing value / chevron / switch / button | default, pressed, swipe-revealed actions | Swipe left reveals Modifier / Supprimer on history items. |
| Avatar | 38 default, 28 to 84; initials on a stable color per person | default, selected ring, faded (absent) | Color is stable for a person across the whole app. |
| Card (pan) | surface, tinted amber / danger / ok / water | static or pressable | Tinted cards carry alerts and suggestions. |
| Tile | grid tiles for quick adds, statuses, players | off, on (inverted) | Min height 72 to 76. |
| Bottom sheet | standard, tall | entering (slide up 320 ms `easeOut`) | Scrim behind, grab handle. |
| Toast | light (info / undo), danger (error) | entering 280 ms | One queue, never stacked. Success never gets a toast unless it carries new info. Errors always do. |
| Input | text, search (leading icon), numeric with locale decimal separator, textarea | default, focus, error, disabled | Correct keyboard and autofill per field. |
| Progress bar | 8 px or 14 px | animated width 600 ms | Budget bar colors: ok < 70%, amber 70 to 90%, danger ≥ 90%. |
| FAB | 56 round amber | default, pressed | Floating "add a drink" inside every game. |
| Skeleton | rows and blocks | shimmer 1.4 s linear | Replaced in place, no layout jump. |
| Card 3D flip | game cards | front, back | 550 ms `easeFlip`, backface hidden. |
| Tab bar | 5 items | active, inactive, badge | Badge = real count, danger color. |

## 5. Motion

Signature moments get overshoot; routine actions never bounce. Everything has a Reduce Motion fallback (fades only, same end state).

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Add drink button | tap | amber fill rises inside the button | 700 ms | easeOut |
| BAC number | server confirms the drink | digits roll from old to new value (14 steps) | ~630 ms | linear steps |
| BAC unit | tap on the number | swap g/L ↔ mg/L | instant + pop | pop 350 ms |
| Pending tag | drink sent | "Envoi" tag, then "Enregistré" tag fades in | 900 ms (server) | easeOut |
| Undo toast | after any reversible action | slide up, stays 5 s | 280 ms | easeOut |
| Water button | tap | pop | 350 ms | easeOut |
| Sheet | open | slide up from bottom | 320 ms | easeOut |
| Switch | toggle | knob slide | 220 ms | easeToggle |
| Curve | period change / compare | redraw, friend curve fades in | 350 ms | easeOut |
| Leaderboard rows | rank change | rows slide to new position | 700 ms | easeReorder |
| Leader crown | new leader | crown drops in | 700 ms | easeOvershoot |
| Venue takeover | check-in accepted | crown drop + amber wash expanding + avatar pop | 700 / 1000 / 350 ms | easeOvershoot / easeOut |
| Check-in signals | check-in | signals appear one by one | every 650 ms | easeOut |
| Podium | recap | bars rise, staggered 0 / 200 / 350 ms | 800 ms | easeOut |
| Confetti | podium, badges | 16 pieces fall and rotate | 1800 ms | easeOut |
| Recap counters | slide enters | count up with cubic ease-out | ~900 ms | ease-out cubic |
| Card flip | game | rotateY 180° | 550 ms | easeFlip |
| Roulette | spin | 5 turns + random, long deceleration | 4000 ms | easeSpin |
| Wheel "Où ?" | spin | 4 turns + random | 3200 ms | easeSpin-like |
| Bomb | fuse burning | color steps white → amber → coral; shake after 50% of the fuse | shake 250 ms loop | linear |
| Bomb | explosion | scale burst + particles | 700 ms | easeOut |
| Le Doigt | choose | ripples on every finger, then chosen finger scales 1.35, others fade to 15% | 1600 ms + 400 ms | easeOut |
| Crash curve | running | multiplier ×1.035 every 120 ms, shake above ×3 | 120 ms ticks | linear |
| Cheers | two phones together | both glasses swing in and clink, "Tchin !" pops | 700 ms | easeToggle |
| SOS | press and hold | conic ring fills over 2 s, release cancels | 2000 ms | linear |
| Live dot | only while something is really live | opacity pulse | 1600 ms loop | ease-in-out |
| Skeleton | loading | shimmer | 1400 ms loop | linear |

Haptics: light tap for selections, medium for adding a drink, success notification haptic when the server confirms, warning haptic on rollback / error, heavy for takeover, crown and explosion, a rising pattern during SOS hold.

## 6. Adaptive drunk UI (visual rules)

| Level | Visual changes |
|---|---|
| 0 Frais | full Party screen as in `Soiree.dc.html` |
| 1 Pompette | BAC 140 px, hero buttons 72 px, avatars 52 px, secondary actions collapsed into one row |
| 2 Bien entamé | 2×3 grid of giant buttons (Verre, Eau, Crew, Jeux, Je rentre, SOS) + voice input, level selector visible |
| 3 Cuit | stacked buttons 88 to 104 px: Je rentre, Appeler un pote, VTC, Eau, SOS; "add a drink anyway" demoted to a small outline button |

At levels 2 and 3, motion becomes stable (no shake, no long sequences), contrast is maximal, nothing important needs a long-press or a precise swipe.

## 7. Iconography and imagery

- Custom stroke icons, 24 grid, stroke 2, round caps and joins, no fill (`design/icons.json`). Extend the set in the same style; do not mix in a stock library as-is.
- No emoji as icons, bullets or navigation. Emoji are fine as user content (reactions in recap and chat).
- Recipes and venues use real photos later; until then, flat color blocks, never generated images with artifacts.

## 8. Accessibility

- Contrast ≥ 4.5:1 for text, including small muted text (`textMuted` on `surface` passes).
- Every icon-only button has a label. Real buttons, links and inputs; no tap handlers on plain views without accessibility roles.
- Screen reader order follows visual order: on the Party screen, BAC first, then trend, then actions.
- Toasts and live changes (overtake, takeover, SOS sent) are announced.
- Dynamic Type: test at the largest sizes; layouts wrap.

## 9. Voice samples (French, already reviewed against the anti-slop rules)

Reuse them as the starting point for `VOICE.md`. They are tutoiement, plain, specific.

- Error: "Pinte refusée : la soirée est fermée depuis 6 h."
- Error, slow server: "Le serveur ne répond pas. On réessaie tout seuls."
- Offline: "Pas de réseau. 3 actions partiront dès que tu captes."
- Grouped failure: "2 actions n'ont pas pu être enregistrées."
- Conflict: "Jade a modifié la dépense entre-temps. Sa version est gardée."
- Empty state: "Pas encore de soirée. Lance la première, le crew sera prévenu."
- BAC notice: "Estimation, pas un éthylotest. Ne prends jamais le volant sur cette base."
- Cheat rejection: "Check-in refusé : position simulée. Aucun point."
- Takeover: "Le Zinc est à toi."
- Next morning: "Doucement. Le récap est prêt."
- Greetings by hour: "Encore debout ?", "Bien dormi ?", "Ça commence à chauffer."
- Destructive confirm: title "Supprimer « Samedi au Zinc » ?", buttons "Garder" / "Supprimer la soirée".

The app name, the game names and all demo data in the prototype (people, venues, prices) are placeholders.
