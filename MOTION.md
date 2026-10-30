# Motion system (MOT-01)

The per-element table lives in `design/DESIGN.md` §5. This file is the system behind it: where the values come from, how things move together, what each vibration means, and what changes when the user should not be shaken around.

## Tokens

- Durations and curves: `design/tokens.json` → `motion`, exposed as `duration.*` (`@crew/design-tokens`) and `easings.*` (`apps/mobile/src/motion/easing.ts`).
- Never a raw number in a screen: if a duration is missing, add a token.

| Curve | Use |
|---|---|
| `out` | anything entering or settling |
| `toggle` | switches, segmented controls, cheers |
| `flip` | card flips |
| `reorder` | rows changing place (leaderboards, live list) |
| `overshoot` | signature moments only: venue takeover, crown, podium, new leader |
| `spin` | roulette and wheels, long deceleration |

## Springs

`design/tokens.json` → `motion.springs`, exposed as `spring.*` (`@crew/design-tokens`) and passed straight to Reanimated's `withSpring`. A spring is for something the finger let go of or that must follow a moving target; anything with a known start and end uses a duration and a curve.

| Spring | Mass, stiffness, damping | Damping ratio | Use |
|---|---|---|---|
| `settle` | 1, 260, 32 | 0.99 | a view finding its place after a layout change, an avatar gliding to a new point |
| `snap` | 1, 420, 41 | 1.0 | a released swipe or drag returning or leaving, pull-to-refresh letting go, a pinch ending out of bounds |
| `signature` | 1, 180, 12 | 0.45 | overshoot moments only: crown landing, podium winner, badge unlocked |
| `swing` | 1, 100, 9 | 0.45 | the two glasses of Cheers settling after the clink |

`settle` and `snap` never overshoot (ratio ≥ 0.98, checked by `packages/design-tokens/src/motion.test.ts`). With Reduce Motion a spring is replaced by its end value, like any other animation.

## Sound (optional)

Off by default, its own switch in Settings, separate from vibrations (JOY-05). `apps/mobile/src/motion/sounds.ts` plays them; each sound rides on a haptic event and never says anything the screen does not.

| Sound | Plays with | Moment |
|---|---|---|
| `pour` | `drinkAdded` | a drink was logged |
| `clink` | `cheers` | a round bought, two phones together |
| `crown` | `heavy` | crown, podium winner, new leader, explosion |

Rules: under 600 ms, volume 0.6, mixed with music already playing (never stops it); on iOS the silent switch wins; no sound loops, no sound on routine taps, scrolling or typing; at UI level 3 and in eco mode the pack stays as chosen, because a sound costs no attention. A new sound needs a row here before it ships.

## Choreography

1. One thing moves at a time per area. A screen entering does not also animate its list.
2. Stagger follows reading order, 70 to 180 ms per item, at most 12 items (later ones appear with the 12th).
3. The thing the user touched answers first (under 120 ms, `duration.press`), the rest follows.
4. Server confirmation is its own beat: pending tag, then the confirmed state, never a fake instant success (SYNC).
5. Overshoot is rare by design. If a routine action bounces, it is a defect.
6. Every animation has the same end state with motion off.

## Haptic vocabulary

Functions in `apps/mobile/src/motion/haptics.ts`. One meaning per vibration, and never information on its own: iOS silences haptics in Low Power Mode, so each event also has a visible change.

| Function | Meaning |
|---|---|
| `select` | a choice changed: chip, segment, stepper, roulette tick |
| `drinkAdded` | a drink was logged |
| `water` | a glass of water was logged |
| `confirmed` | the server accepted something that matters (check-in, repayment, expense) |
| `error` | refused, rolled back, or not possible right now |
| `heavy` | signature moment landing: crown, podium winner, roulette result, explosion |
| `holdTick` | the SOS hold progressing |

## Haptic capabilities (MOT-15)

| Platform | Selection tick | Light, medium, heavy impact | Rigid tap | Success, warning |
|---|---|---|---|---|
| iOS, iPhone 8 and later (Taptic Engine) | yes | yes | yes | yes |
| iOS, Low Power Mode | silenced by the system | silenced | silenced | silenced |
| Android 10+ (API 29+) | yes | yes | yes | yes |
| Android 8 and 9 (API 26 to 28) | falls back to a light impact | yes | falls back to a heavy impact | yes |
| Web preview | none | none | none | none |

Vibrations have their own switch in Settings, on by default and separate from the sound pack. Every haptic event also changes something on screen, so turning them off, Low Power Mode or a phone without a motor loses nothing.

## When motion steps back

| Situation | What changes |
|---|---|
| System Reduce Motion | `useReducedMotion()`: no draw-ins, no confetti, no shakes; counters jump to their value; fades only |
| UI level 2 and 3 (ADP-01) | stable layout: no shake, no long sequences, nothing that needs a precise swipe or long-press |
| Eco mode on a low battery (ADP-08) | `ReducedMotionConfig` forces every animation to its end; clocks and refreshes slow down |
| Background tab or hidden window | layout animations may not start: prefer shared-value animations (`DropIn`) over entering animations for anything that carries content |

## Living background (MOT-02)

`apps/mobile/src/party/BubbleField.tsx`, behind the Party screen. Each drink the crew logs releases 3 to 6 slate bubbles (2 to 6 px, alpha 0.25 to 0.5) that rise and fade; calm moods (wine, sunset, home, champagne) rise slower and straight, the others faster with a slight sway. At most 40 alive, updated at 30 Hz at most by a frame callback that stops once the last bubble is gone. The ground shifts within 2 % lightness with the hour (lighter at 8 pm, deepest at 3 am), once a minute. Off in eco mode, with Reduce Motion and at levels 2 and 3, where only the lightness step stays. The CPU budget (under 2 % over 10 idle minutes, A-MOTION-6) is still to be measured on a modest Android phone.

## Shared elements (MOT-05)

`apps/mobile/src/motion/hero.tsx`: a source registers what it shows (`HeroSource`), `flyHero(key)` runs right before `router.push`, the target reports where it lands (`HeroTarget`) and an overlay above the navigator flies between the two on `duration.enter`. Screens reached this way fade in instead of sliding, so the element lands where it stays. Today: a crew member's or a friend's avatar flies to their profile; the catalogue card grows into the game setup and fades over it. With Reduce Motion nothing flies, the screen fades.

## Time scale (MOT-14)

Every duration goes through one scale, 0.1x to 10x: the tokens (`duration.*`) read it when an animation starts, and a duration written as a number goes through `scaled(ms)`, read on the JS thread (never inside a worklet). Springs (`spring.*`) follow the same scale: stiffness divided by the square of the scale, damping by the scale, so a slowed spring keeps its shape. Timers that pace an animation (stagger, steps, ticks, pulses) go through `scaled` too; timers that count real time (polling, a 5 s undo, a game round) do not. Dev builds show the control in Settings and expose `globalThis.__crewMotion.setScale(x)` to the test harness; release builds stay at 1.

## Review checklist

- Uses tokens, not literals.
- Has a Reduce Motion path with the same end state.
- Stays readable at UI level 2 and 3.
- Haptic matches the table above, or there is none.
- 60 fps on a mid-range phone: animate transforms and opacity, not layout, in long lists.
