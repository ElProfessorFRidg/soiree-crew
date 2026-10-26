# Recon-Motion: motion, haptics and frame pacing

Phase 0 recon report. Author: Recon-Motion subagent. Date: 2026-10-26.
Inputs read: `PROMPT.md` (`<motion>`, `<drunk_mode>`, `<stack>`, `<anti_slop>` design_patterns), `design/DESIGN.md` §5 and §6, `design/tokens.json` (motion), `design/base.css` (prototype keyframes).

Convention used below: **[F]** = fact taken from a cited source; **[D]** = derived by computation from cited facts (method given); **[O]** = opinion or recommendation; **[U]** = from prior knowledge, not re-verified in a 2025-2026 source during this recon (verify before relying on it).

---

## 1. Summary

1. **Use springs for anything that moves in space or follows a gesture; keep curves for anything with a fixed meaning in time.** Apple, Material 3 Expressive, Compose and Flutter all describe springs with the same two numbers. Apple's `duration` + `bounce` maps exactly to `stiffness = (2π / duration)²`, `dampingRatio = 1 − bounce`, `mass = 1` [F: Flutter source, which states it matches SwiftUI]. One token table can therefore drive SwiftUI, Compose, Reanimated and Flutter with identical physics.
2. **Our cubic-bezier tokens are very front-loaded.** `easeOut (.2,.8,.2,1)` is 50 % done at 13 % of its duration and 90 % done at 40 % [D]. The equivalent critically damped spring is about half the nominal CSS duration, so the CSS durations mostly describe the tail. Five spring tokens cover all spatial motion (§3.1).
3. **Material 3 Expressive bounces by default** (expressive default spatial spring: damping 0.8, stiffness 380, which is bounce 0.2; fast spatial: bounce 0.4) [F/D]. That contradicts MOT-01 ("no elastic bounce on routine actions"). On Android, do not adopt `MotionScheme.expressive()` as is. Use a custom `MotionScheme` built from our tokens.
4. **Every row of the DESIGN.md motion table has a feasible path in at least two stacks** (§3.2.2). Native (SwiftUI + Compose) is the only stack where every row maps to a stable, first-party API. Two capabilities are weaker elsewhere: shared-element transitions (Reanimated: experimental flag; Expo Router zoom: alpha, iOS only) and rich haptics (Flutter: third-party plugins only).
5. **Living background (MOT-02): an event-driven "bubble field", slate on slate.** Few rising micro-bubbles that echo the crew's real drinks, plus a time-of-night lightness shift. No halo, aurora, glow or hue gradient. It costs nothing when idle because it renders on demand at 30 Hz or less, and it switches off in eco mode, with Reduce Motion and at levels 2 and 3 (§3.4).
6. **Haptics are a first-class channel at levels 2 and 3**, where vision is unreliable. The proposed vocabulary has 12 meanings and maps each one to UIKit / SwiftUI / Core Haptics and to Android `HapticFeedbackConstants` / `VibrationEffect` with API-level fallbacks (§3.3).
7. **Testing motion frame by frame needs a global motion time scale in our own motion layer** (proposed MOT-14). Android's animator duration scale and Flutter's `timeDilation` exist, but Reanimated, Skia, Rive and custom clocks do not follow one shared switch (§3.6).
8. **Motion favours native SwiftUI + Compose.** If the Architect picks cross-platform for other reasons, React Native (Reanimated 4 + Gesture Handler 3 + Skia + Pulsar) is the stronger motion choice for an app that must feel first-party on iOS, because sheets, navigation and controls stay native with system springs. Flutter wins on frame pacing and consistency on a modest Android phone and on deterministic golden-frame tests, but it has to rebuild iOS system motion. [O]

---

## 2. Findings

### 2.1 What the platforms recommend (facts)

**Apple, HIG Motion** (change log: last entry 2025-09-09) [F]
- Add motion only when it supports the experience. Make motion optional; do not use motion as the only carrier of information, and add haptics and audio.
- Let people cancel animations. Do not make them wait for an animation, especially a repeated one.
- Keep feedback animations brief and precise. In apps, avoid custom motion on frequent interactions, because system elements already animate.
- Games: aim for a consistent 30 to 60 fps, and let people trade visuals for battery.

**Apple, HIG Accessibility, motion part** (change log 2025-06-09) [F]
- With Reduce Motion on, cut back automatic and repetitive animation, including zooming, scaling and peripheral motion.
- Use tighter springs to reduce bounce, and have animations track the gesture directly.
- Do not animate depth (z-axis) between layers. Replace x/y/z transitions with fades. Do not animate into or out of blurs.

**Apple, WWDC23 "Animate with springs"** [F]
- Springs take two parameters, duration and bounce. Bounce 0 is the default and described as the most versatile general-purpose spring. About 0.15 gives a brisk tail, about 0.3 a noticeable bounce, and values above about 0.4 should be used with caution in UI.
- Tuning order: choose the duration for pacing first, then bounce for character.
- A spring keeps the gesture's velocity at release and on retargeting, which makes interruptions smooth. Ease-in-out and linear curves cannot carry an initial velocity.
- Completion handlers fire at the perceptual duration, not at the settling duration. Do not wait for the settling duration before a user-facing change.
- Core Animation equivalent: `CASpringAnimation(perceptualDuration:bounce:)`.
- Presets `.smooth`, `.snappy`, `.bouncy` are "based on spring values used in iOS". [U: values of about 0 / 0.15 / 0.3 bounce at 0.5 s; verify]

**Apple, HIG Playing haptics** (change log 2024-05-07) [F]
- Use each system pattern only for its documented meaning. Keep a haptic tied to one meaning. Match intensity and sharpness to the visual and the sound. Do not overuse haptics. Prefer short haptics for discrete events. Make haptics optional. Haptics must not disrupt the camera, gyroscope or microphone.
- Three categories: notification (outcome of a task), impact (physical metaphor), selection (value changing). Standard controls such as toggles, sliders and pickers already play system haptics.
- Custom haptics (Core Haptics) are built from transient and continuous events with intensity and sharpness, optionally synced with audio.

**SwiftUI `SensoryFeedback`** (iOS 17+) [F]: `selection`, `success`, `warning`, `error`, `impact`, `impact(weight:intensity:)`, `impact(flexibility:intensity:)`, `start`, `stop`, `increase`, `decrease`, `alignment`, `levelChange`, `pathComplete`, plus `press(_:)`, `release(_:)` and `selection(_:)`. Caveat: Apple's page says `levelChange` plays only on macOS, and third-party sources disagree on whether `increase` / `decrease` play on iPhone [F/U]. Use only `selection`, `success`, `warning`, `error` and `impact` for cross-device certainty.

**Material 3 motion physics** (M3 Expressive, May 2025) [F]
- Springs replace the easing-and-duration system. Spatial springs (position, rotation, size, corner radius) may overshoot. Effects springs (colour, opacity) never overshoot.
- Two schemes: *expressive* (overshoots; Google presents it as the default for most products) and *standard* (minimal bounce; utilitarian products). Three speeds: fast (small components such as switches and buttons), default (sheets, navigation), slow (full-screen transitions).
- Compose tokens, from `androidx` source [F], with the Apple-style equivalent [D] (`duration = 2π/√stiffness`, `bounce = 1 − damping`):

| Token | Standard (damping / stiffness) | Apple-style | Expressive (damping / stiffness) | Apple-style |
|---|---|---|---|---|
| fastSpatial | 0.9 / 1400 | 0.17 s, bounce 0.1 | 0.6 / 800 | 0.22 s, bounce 0.4 |
| defaultSpatial | 0.9 / 700 | 0.24 s, bounce 0.1 | 0.8 / 380 | 0.32 s, bounce 0.2 |
| slowSpatial | 0.9 / 300 | 0.36 s, bounce 0.1 | 0.8 / 200 | 0.44 s, bounce 0.2 |
| fast / default / slow Effects | 1.0 / 3800, 1600, 800 | 0.10 / 0.16 / 0.22 s, bounce 0 | same as standard | same |

- `MotionScheme.standard()` / `.expressive()` appear in Compose Material3 1.5.0 docs, still annotated `@ExperimentalMaterial3ExpressiveApi` in the pages seen [F]. A custom `MotionScheme` is allowed [F: m3 "create a custom scheme"].

**Android haptics** (developer.android.com, pages last updated October 2026) [F]
- Prefer `View.performHapticFeedback(HapticFeedbackConstants.X)`: it needs no `VIBRATE` permission, respects the user's touch-feedback setting and falls back on its own. Choose constants by meaning.
- "Clear" haptics (crisp) are good; "buzzy" haptics are worse than none. Avoid `createOneShot` / `vibrate(long)` for feedback, because the actuator rings for 20 to 50 ms after a 10 to 20 ms click.
- Strength should match importance and frequency. Effects may build up as an interaction approaches its target.
- `VibrationEffect.Composition` primitives (Android 11, API 30; `LOW_TICK` API 31 [U]): `CLICK`, `TICK`, `LOW_TICK`, `THUD`, `SPIN`, `QUICK_RISE`, `SLOW_RISE`, `QUICK_FALL`. A composition with one unsupported primitive fails as a whole, so check `areAllPrimitivesSupported()` first.
- Android 16 / API 36: envelope effects (`BasicEnvelopeBuilder`: intensity + sharpness control points, hardware-agnostic; `WaveformEnvelopeBuilder`: amplitude + frequency, hardware-specific, no fallback). The page presents a newer `VibrationEffect.Builder` with presets as preferred "starting in Android 16 (26Q4)", with framework-level fallback.
- `HapticFeedbackConstants` API levels [F]: `CLOCK_TICK` 21, `CONTEXT_CLICK` 23, `KEYBOARD_PRESS` / `VIRTUAL_KEY_RELEASE` / `TEXT_HANDLE_MOVE` 27, `CONFIRM` / `REJECT` / `GESTURE_START` / `GESTURE_END` 30, `TOGGLE_ON` / `TOGGLE_OFF` / `DRAG_START` / `SEGMENT_TICK` / `SEGMENT_FREQUENT_TICK` / `GESTURE_THRESHOLD_ACTIVATE` / `GESTURE_THRESHOLD_DEACTIVATE` / `NO_HAPTICS` 34.

**Refresh rate** [F]
- iPhone: Core Animation stays at or below 60 Hz unless `CADisableMinimumFrameDurationOnPhone` is `true` in `Info.plist`. The React Native template sets it by default since RN 0.82 (Reanimated docs). Low Power Mode and the accessibility "Limit Frame Rate" setting cap at 60 Hz [U].
- Android 15 QPR1+: adaptive refresh rate (ARR), with per-view votes (`View.setRequestedFrameRate`, categories NORMAL ≈ 60 Hz and HIGH). Compose 1.9 adds `Modifier.preferredFrameRate(...)`. Google's advice: most apps need no change; use HIGH only where an animation looks unsmooth; request lower rates for slow animations to save power; do not disable ARR or touch boost.

### 2.2 Candidate stacks: state of the animation tooling (late 2026)

**React Native** [F unless marked]
- **Reanimated 4** went stable on 2025-07-23 and is New-Architecture only. It adds CSS-style animations and transitions ("fire and forget") and keeps worklets and shared values for gestures. Reanimated 3 is no longer maintained. Current 4.x: 4.7.1 seen on unpkg.
- Spring config has two exclusive modes: physics (`mass`, `stiffness`, `damping`) or `duration` + `dampingRatio`. In 4.x, `duration` is documented as *perceptual*, with an actual run of about 1.5 × that value. The default spring is mass 4, stiffness 900, damping 120, which is critically damped, ω = 15 rad/s, about an Apple 0.42 s / bounce 0 spring [D].
- Performance guide: animate non-layout props (`transform`, `opacity`, `backgroundColor`). About 100 simultaneously animated components at most on low-end Android, about 500 on iOS; beyond that use Skia. Known New Architecture regressions: scroll flicker, low FPS while scrolling, low FPS with many animations, FlashList blink. Mitigations go through flags (`ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`, `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS`, `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS`, among others) and need RN 0.80 to 0.82+ and Reanimated 4.2+.
- **Shared element transitions**: back in Reanimated 4.2 (December 2025) for the New Architecture, but still *experimental* behind `ENABLE_SHARED_ELEMENT_TRANSITIONS`, "not recommended for production". Native-stack only (no tabs); custom animation functions are not supported (springs and duration only); iOS issues with `transparentModal` and header offsets.
- **Expo Router `Link.AppleZoom`**: wraps iOS 18's native zoom transition. Alpha, iOS only, Expo SDK 55+.
- **Gesture Handler 3**: stable, rebuilt for the New Architecture, with a hook-based API and deeper Reanimated integration. 3.2.x in 2026.
- **React Native Skia** (Shopify): accepts Reanimated shared and derived values directly as props on the UI thread. `Atlas` draws many sprites from one texture in one call, with worklet-animated transforms "at near-zero cost". Graphite / WebGPU backend was still experimental in mid-2025.
- **Pulsar** (`react-native-pulsar` 1.7.0, Software Mansion): 150+ presets, iOS and Android system presets, a pattern composer (discrete + continuous amplitude/frequency curves, optional synced audio), a realtime composer for gesture-driven haptics, worklet-callable, capability levels (none / limited / standard / advanced). Android composition needs API 30+, envelopes API 36+. Works with Expo dev builds, not Expo Go. Alternative: `react-native-haptic-feedback` (Core Haptics, AHAP, Android Composition on API 31+).
- **Rive**: `@rive-app/react-native` is the recommended runtime (Nitro-based; RN 0.78+, iOS 15.1+, Android SDK 24+), with data binding through view models. A Margelo rewrite post (July 2026) claims up to 94× faster multi-view loads.

**Flutter** [F unless marked]
- **Impeller** (docs for Flutter 3.47, updated 2026-08-21): the only renderer on iOS. Default on Android API 29+ (Vulkan), automatic OpenGL fallback on older devices or devices without Vulkan. Shaders compile ahead of time, which removes first-run shader jank.
- `SpringDescription.withDurationAndBounce` exists and "produces the same result as SwiftUI's spring(duration:bounce:)": mass 1, stiffness 4π²/d², dampingRatio 1 − bounce for bounce > 0, else 1/(1 + bounce). This is the source of the exact conversion in §3.1.
- Material 3 Expressive motion is "unavailable" for Flutter according to m3.material.io. Third-party packages exist.
- **flutter_animate** (gskinner) 4.5.2 was last published about 23 months ago, around late 2024. It is a maintenance risk, so do not build the motion system on it. [F/O]
- `Hero` and route transitions are framework-level and mature [U]. Predictive back needs Android API 33+ targeting and `PopScope` [F].
- Haptics: the core `HapticFeedback` class only offers light / medium / heavy / selection / vibrate [U]. Rich patterns need plugins (`haptic_kit`, `pulsar_haptics`, `core_haptics` iOS-only) or our own platform channel.

**Native: SwiftUI + Jetpack Compose** [F unless marked]
- **Compose Animation** stable 1.12.1 (2026-09-09). Shared transition APIs (`SharedTransitionLayout`, `Modifier.sharedElement`, `Modifier.sharedBounds`) stable since 1.10 (2025-12-03); 1.11 added visual debugging of lookahead animations. Limits: no interop with Views (including `Dialog` and `ModalBottomSheet` wrappers); `ContentScale` snaps; no automatic shape morph.
- Compose honours the system animator duration scale through `MotionDurationScale` [F: secondary sources; U for the exact version].
- **SwiftUI**: `matchedTransitionSource` + `.navigationTransition(.zoom)` (iOS 18) for the system zoom shared-element transition; `matchedGeometryEffect` inside a screen. Known friction: combining `matchedGeometryEffect` on subviews with the zoom transition is not seamless (Apple forums) [F]. `Spring(duration:bounce:)`, `withAnimation(.spring(...))`, `PhaseAnimator` / `KeyframeAnimator` (iOS 17), Metal shaders via `.colorEffect` / `.distortionEffect` / `.layerEffect` (iOS 17), `CAEmitterLayer` for particles, `sensoryFeedback` and Core Haptics [U for the iOS 17 APIs other than sensoryFeedback].

### 2.3 Reference apps (observations, all opinion)

The public case studies found are mostly vendor marketing. Rive lists Duolingo, Notion and FigJam as customers [F]. The rest is the author's reading of shipped apps [O/U]:
- **Apple Weather**: the background *is* data (condition, time of day). This is the precedent for MOT-02: a living background must encode state, not decorate.
- **Flighty**: motion explains progress (a flight moves along a line, the Live Activity mirrors it). It matches our curve (MOT-04) and the HUB-02 Live Activity.
- **Things**: almost no motion. One satisfying moment (the checkbox) on the most repeated gesture. That is the model for MOT-03, adding a drink.
- **Cash App / Revolut**: rolling digits plus a crisp haptic on each keypad press and on success. That is the model for the BAC roll and the money screens.
- **Duolingo**: celebrations are rare, short and tied to an achievement (Rive characters, burst, success haptic). That is the model for podium, badges and confetti.
- **Apple Fitness rings**: a closed ring is an overshoot moment with a matching haptic, and routine updates do not bounce. It is the same rule as MOT-01.

---

## 3. Decisions proposed

### 3.1 From cubic-bezier tokens to springs (deliverable 1)

**Rule.** Use a spring when the motion (a) moves, scales or rotates something in space, (b) can be interrupted or retargeted (sheets, reorder, toggles, drags), or (c) starts from a gesture (velocity hand-off). Keep a timing curve when (d) the duration itself means something (SOS hold = 2 s, toast stay = 5 s, fuse), (e) the motion must sync frame-exactly with sound, haptic ticks or a video export (roulette clicks, recap export), (f) it is a loop (shimmer, live dot), or (g) it is a stepped value (BAC digit roll). Colour and opacity changes use effects springs with no overshoot, or short curves. [O, aligned with Apple WWDC23 and M3 spatial/effects split]

**Exact conversion** (one table drives every stack) [F: Flutter source; D: identity checked, bounce 0 gives critical damping c = 2√k]:

```
mass = 1
stiffness k = (2π / duration)²
dampingRatio ζ = 1 − bounce        (bounce ≥ 0)
               = 1 / (1 + bounce)  (bounce < 0)
damping c = 2 ζ √k
```

- SwiftUI: `.spring(duration: d, bounce: b)`. Core Animation: `CASpringAnimation(perceptualDuration: d, bounce: b)`.
- Compose: `spring(dampingRatio = ζ, stiffness = k)` (mass is implicitly 1).
- Flutter: `SpringDescription.withDurationAndBounce(duration:, bounce:)`.
- Reanimated: use the **physics mode** `{ mass: 1, stiffness: k, damping: c }`, not its `duration` mode, because Reanimated's "perceptual duration" definition is not proven identical to Apple's [O; A-MOTION-1].

**Fitting the current tokens** [D]. Method: for each bezier over a normalised duration T, a least-squares search over Apple-parametrised springs (bounce fixed at 0, except easeOvershoot) on 201 samples. Script kept in the session scratchpad, reproducible from this description.

| Token | Bezier milestones | Best spring (critically damped) | RMSE |
|---|---|---|---|
| easeOut (.2,.8,.2,1) | 50 % at 0.13 T, 90 % at 0.40 T | d = 0.53 T | 0.035 |
| easeToggle (.3,.7,.3,1) | 50 % at 0.21 T, 90 % at 0.50 T | d = 0.77 T | 0.019 |
| easeFlip (.3,.7,.2,1) | 50 % at 0.19 T, 90 % at 0.46 T | d = 0.71 T | 0.015 |
| easeReorder (.3,.8,.2,1) | 50 % at 0.17 T, 90 % at 0.42 T | d = 0.65 T | 0.016 |
| easeOvershoot (.2,.9,.25,1.2) | peaks at +5.9 % at 0.63 T | d = 0.60 T, **bounce 0.32** (peak +5.4 %) | 0.056 |
| easeSpin (.1,.7,.15,1) | 50 % at 0.09 T, 90 % at 0.39 T | keep as a curve (see below) | n/a |

**Proposed spring tokens** for MOTION.md [O, derived from the fit and rounded to a small set]:

| Token | duration / bounce | k / ζ / c (mass 1) | Replaces | Use |
|---|---|---|---|---|
| `spring.snap` | 0.20 s / 0 | 987 / 1.00 / 62.8 | press 120, toggle 220, toastIn 280 (fit 0.15 to 0.17 s) | button press and release, switch knob, chip, toast in, BAC unit pop return |
| `spring.standard` | 0.35 s / 0 | 322 / 1.00 / 35.9 | sheetIn 320, enter 350, progress 600, fill 700 (fit 0.17 to 0.37 s) | custom sheets, curve redraw, progress, glass fill, screen-level enter |
| `spring.move` | 0.45 s / 0 | 195 / 1.00 / 27.9 | flip 550, reorder 700, rise 800 (fit 0.39 to 0.46 s) | leaderboard reorder, card flip, podium bars, shared-element flights |
| `spring.gesture` | 0.35 s / 0.15 | 322 / 0.85 / 30.5 | none (new) | release after a drag or swipe: card swipe, sheet dismiss, row swipe-back. Carries the finger's velocity; overshoot about 0.6 %, barely visible |
| `spring.signature` | 0.45 s / 0.30 | 195 / 0.70 / 19.5 | easeOvershoot 700 (fit 0.42 s / 0.32) | **only** crown drop, takeover avatar pop, new leader, podium winner, badge unlock |

Effects (opacity, colour): `effects.fast` 0.10 s / 0, `effects.default` 0.16 s / 0 (equal to M3 fast and default effects) [D].

Keep as timing curves: BAC digit roll (14 linear steps, about 630 ms), roulette and wheel (`easeSpin` with a pre-computed end angle; see §3.2.2), SOS ring (linear 2000 ms, bound to the hold), skeleton shimmer and live dot (loops), bomb fuse colour steps, crash ticks (120 ms), recap counters (cubic ease-out, deterministic for video export), check-in signal stagger, confetti (per-particle physics: gravity + drag + spin, not a curve).

Notes:
- With a spring, "duration" is the perceptual time. The 1 % settle time is about 1.05 × d for bounce 0 [D]. Completion callbacks (haptic "settled", next step of a sequence) fire at d, not at settle (WWDC23).
- Native system components (UIKit and SwiftUI sheets, navigation push, `UISwitch`, Compose `ModalBottomSheet`) keep their own system springs. Do not override them with our tokens. This deviation from DESIGN.md (sheet 320 ms easeOut) goes in an ADR [O].
- On Android, do not use `MaterialExpressiveTheme(motionScheme = MotionScheme.expressive())`. Its default spatial bounce of 0.2 to 0.4 breaks MOT-01. Supply a custom `MotionScheme` whose spatial specs are `spring.snap/standard/move` and whose effects specs are ours [O].

### 3.2 Per-stack capability (deliverable 2)

#### 3.2.1 Capability table

Legend: ✅ first-party or stable library, production-ready · 🟡 feasible with caveats (experimental, hand-built or third-party) · ❌ not available.

| Capability | Native SwiftUI + Compose | React Native (Reanimated 4, GH 3, Skia) | Flutter (Impeller) |
|---|---|---|---|
| Animation off the JS / business thread | ✅ Core Animation render server (iOS); Compose `graphicsLayer` updates skip recomposition. SwiftUI and Compose still compute on the main thread, so a blocked main thread hitches [U] | ✅ worklets and CSS animations run on the UI thread; do not read shared values from JS (docs) | ✅ UI and raster threads separate from platform main; Dart isolates for heavy work [U] |
| Shared-element transition (MOT-05) | ✅ iOS 18 `matchedTransitionSource` + `.navigationTransition(.zoom)`; `matchedGeometryEffect` in-screen. ✅ Compose `SharedTransitionLayout` stable since 1.10 | 🟡 Reanimated SET experimental behind a flag, native-stack only; 🟡 Expo Router `Link.AppleZoom` alpha, iOS 18+ only; 🟡 hand-built overlay hero (measure, portal, animate) is the dependable path | ✅ `Hero` (mature) + `animations` package container transform [U] |
| 3D card flip (MOT-06) | ✅ `rotation3DEffect` + perspective; Compose `graphicsLayer { rotationY; cameraDistance }` | ✅ `transform: [{perspective}, {rotateY}]` + `backfaceVisibility: 'hidden'` | ✅ `Transform` with `Matrix4..setEntry(3,2,0.001)..rotateY` |
| Particles / confetti | ✅ `CAEmitterLayer`, SwiftUI `Canvas` + `TimelineView`; Compose `Canvas` + `withFrameNanos` | ✅ Skia `Atlas` (one draw call, worklet transforms); about 100 animated *views* cap on low-end Android, so never use views for particles | ✅ `CustomPainter` + `Canvas.drawAtlas` / `drawVertices`; Rive for authored bursts |
| Curve draw-on + vertical gradient stroke + finger scrub (MOT-04) | ✅ SwiftUI `Path.trim(from:to:)` + `.stroke(LinearGradient)`; Swift Charts `chartXSelection` (iOS 17) for scrubbing [U]. ✅ Compose `PathMeasure.getSegment` + `Brush.verticalGradient` + `pointerInput` | ✅ Skia `Path` with animatable `start`/`end` trim + `LinearGradient` shader on the stroke; GH 3 Pan on the UI thread; avatars along the path via contour measurement | ✅ `PathMetric.extractPath` + `ui.Gradient.linear` shader; `GestureDetector` / `Listener` |
| Real multi-touch, up to 10 fingers (Le Doigt) | 🟡 iOS: SwiftUI has no multi-pointer API, so wrap a UIKit view (`isMultipleTouchEnabled`, `touchesBegan`) [U]. ✅ Compose `awaitPointerEventScope` gives every pointer id | ✅ GH 3 Manual / Pan gestures expose all touches on the UI thread; fallback raw `onTouch*` `nativeEvent.touches` (JS thread) | ✅ `Listener` / raw pointer events with pointer ids |
| Reduce Motion API | ✅ `@Environment(\.accessibilityReduceMotion)`, `UIAccessibility.isReduceMotionEnabled` + notification, `prefersCrossFadeTransitions` [U]. Android: `Settings.Global.ANIMATOR_DURATION_SCALE == 0` ("Remove animations"); Compose honours the scale [F, secondary] | ✅ Reanimated `ReduceMotion.System` (default: animations jump to end state), `useReducedMotion()` (read **at launch only**) + `AccessibilityInfo.isReduceMotionEnabled()` and the `reduceMotionChanged` event [U] for live changes | ✅ `MediaQuery.disableAnimationsOf(context)` [U: Android mapping to animator scale to verify] |
| 120 Hz ProMotion / high refresh | ✅ `CADisableMinimumFrameDurationOnPhone`; `CADisplayLink.preferredFrameRateRange`. Android ARR + `Modifier.preferredFrameRate` (Compose 1.9) | ✅ the same `Info.plist` key, default in the RN 0.82+ template; Android follows the display mode | ✅ iOS: the same key [U: confirm the Flutter template sets it]; Android: some OEMs need a display-mode request (`flutter_displaymode`) [U] |
| Haptics access | ✅ full: UIKit generators, `sensoryFeedback`, Core Haptics + AHAP; `performHapticFeedback`, `VibrationEffect` Composition, envelopes (API 36) | ✅ Pulsar (presets, pattern composer, realtime, worklets); `react-native-haptic-feedback` | 🟡 core API is basic; plugins (`haptic_kit`, `pulsar_haptics`) or our own platform channel |
| Modest Android phone (API 29 to 33, 60/90 Hz, 4 GB) | ✅ Compose release + R8 + Baseline Profiles [U]; best control | 🟡 good in release builds; known New Architecture regressions under many simultaneous animations; enable Reanimated fast-path flags; move complex scenes to Skia | ✅ Impeller Vulkan API 29+, AOT shaders, consistent frame pacing; OpenGL fallback below |
| Illustrations (Rive / Lottie) | ✅ Rive iOS and Android runtimes; lottie-ios, lottie-android [U] | ✅ `@rive-app/react-native` (Nitro); lottie-react-native [U] | ✅ `rive`, `lottie` packages [U] |
| Deterministic animation clock for tests | ✅ Compose `mainClock.autoAdvance = false` + `advanceTimeBy` [U]; SwiftUI: none built in | 🟡 Reanimated Jest timers (`advanceAnimationByTime`) [U]; no on-device clock | ✅ `tester.pump(Duration)` + golden files; `timeDilation` [U] |

#### 3.2.2 Every DESIGN.md §5 row, with an implementation path in at least two stacks (done_when)

N = native (SwiftUI / Compose), R = React Native, F = Flutter. "✓" means a feasible path with the named tools.

| Motion row | Approach (all stacks) | N | R | F |
|---|---|---|---|---|
| Add drink: amber fill rises (700 ms) | mask or clip height on `spring.standard`; bubbles = 6 to 10 sprites; one haptic at commit | ✓ `clipShape` / `drawWithContent` | ✓ Skia rect + Atlas bubbles | ✓ `ClipRect` + `CustomPainter` |
| BAC digits roll (14 steps, about 630 ms) | per-digit vertical strip with tabular figures, stepped linear timing; in RN, use an animated `TextInput` or Skia text, not `Text` re-renders (Reanimated docs) | ✓ `contentTransition(.numericText())` iOS 17 [U] or a custom strip; Compose `AnimatedContent` per digit | ✓ Reanimated strip | ✓ `AnimatedSwitcher` / custom strip |
| BAC unit swap + pop (350 ms) | instant text swap + scale 0.92 → 1 on `spring.snap` (no overshoot; pop = quick return) | ✓ | ✓ | ✓ |
| Pending tag Envoi → Enregistré (900 ms server) | cross-fade on `effects.default`; timing driven by the server ack, not a timer | ✓ | ✓ | ✓ |
| Undo toast (280 ms, stays 5 s) | translateY on `spring.snap` + 5 s timer; swipe dismiss on `spring.gesture` | ✓ | ✓ | ✓ |
| Water button pop (350 ms) | same as the unit pop | ✓ | ✓ | ✓ |
| Sheet open (320 ms) | native sheet with system spring (ADR); custom sheets on `spring.standard` | ✓ system sheets | ✓ react-native-screens form sheet [U] | ✓ `showModalBottomSheet` (not native) |
| Switch knob (220 ms) | native switch; custom knob on `spring.snap` | ✓ | ✓ | ✓ |
| Curve redraw, friend fades in (350 ms) | path trim 0 → 1, friend opacity on effects; colour change at threshold = vertical gradient stops at threshold y (exact, no animation needed) | ✓ | ✓ Skia | ✓ |
| Leaderboard rows reorder (700 ms) | layout animation on `spring.move` | ✓ `.animation` on ids; Compose `Modifier.animateItem()` [U] | ✓ Reanimated `LinearTransition.springify()` layout animation [U] | ✓ `AnimatedList` / implicit `AnimatedPositioned` |
| Leader crown drop (700 ms, overshoot) | translateY + scale on `spring.signature`; heavy impact at first contact | ✓ | ✓ | ✓ |
| Venue takeover (crown + amber wash + avatar pop) | crown on `spring.signature`; wash = scaled circle or mask on the map overlay layer, opacity out (`effects`); avatar pop on `spring.signature`. Map layer depends on the maps SDK (separate recon) | ✓ MapKit / Maps Compose overlay | ✓ overlay view above the map | ✓ overlay widget |
| Check-in signals (every 650 ms) | staggered fade + 8 px rise on `effects.default` | ✓ | ✓ | ✓ |
| Podium (bars 0 / 200 / 350 ms stagger, 800 ms) | scaleY from bottom on `spring.move`; winner bar `spring.signature` | ✓ | ✓ | ✓ |
| Confetti (16 pieces, 1800 ms) | particle sim (gravity, drag, spin, flip via scaleX cos); stop and free when done | ✓ `CAEmitterLayer` / Canvas | ✓ Skia Atlas | ✓ `drawAtlas` |
| Recap counters (about 900 ms, cubic ease-out) | timing curve, deterministic for export | ✓ | ✓ | ✓ |
| Card flip (550 ms) | rotateY 0 → 180 on `spring.move`, swap face at 90°, perspective ≈ 1/1000 | ✓ | ✓ | ✓ |
| Roulette (5 turns + random, 4000 ms) | outcome picked first (server or seeded RNG), end angle computed, then `easeSpin` timing (or decay with a target); haptic tick when the pointer crosses a segment boundary, computed from the angle each frame | ✓ | ✓ worklet emits ticks via Pulsar (worklet-callable) | ✓ |
| Wheel "Où ?" (4 turns, 3200 ms) | same engine as the roulette | ✓ | ✓ | ✓ |
| Bomb fuse colour + shake after 50 % | colour steps (discrete); shake = translate ±3 px / rotate ±2° loop at 250 ms, amplitude ramping with fuse progress | ✓ | ✓ | ✓ |
| Bomb explosion (scale burst + particles, 700 ms) | scale + opacity burst + Atlas particles + heavy haptic | ✓ | ✓ | ✓ |
| Le Doigt (ripples per finger, chosen ×1.35, others 15 %) | multi-pointer tracking; ripple per pointer id (scale 0.5 → 2.2, opacity out); selection after a stable 1.6 s | ✓ Compose pointers / UIKit wrap | ✓ GH 3 | ✓ `Listener` |
| Crash curve (×1.035 every 120 ms, shake above ×3) | 120 ms tick clock; path append; shake as for the bomb | ✓ | ✓ Skia | ✓ |
| Cheers (two phones, glasses swing and clink, 700 ms) | keyframes (swing in, contact at 45 %, settle); rigid impact at contact; the trigger (BLE / NFC proximity) is another recon's scope | ✓ `KeyframeAnimator` [U] / Compose `keyframes` | ✓ `withSequence` | ✓ `TweenSequence` |
| SOS ring (press-and-hold 2 s, release cancels) | conic sweep bound linearly to hold time; Reduce Motion keeps the ring (it carries information) | ✓ `AngularGradient` + trim / Compose `drawArc` | ✓ Skia `SweepGradient` + trim | ✓ `SweepGradient` |
| Live dot (1600 ms loop, only when live) | opacity loop; mounted only while live; Reduce Motion = static dot | ✓ | ✓ | ✓ |
| Skeleton shimmer (1400 ms loop) | gradient translate loop; Reduce Motion = static block | ✓ | ✓ | ✓ |

Result: 27 of 27 rows are feasible in all three stacks. The only rows where a stack is weaker are the shared-element transitions (MOT-05) on React Native and multi-touch in SwiftUI (UIKit wrapper needed).

### 3.3 Haptic vocabulary (deliverable 3)

Principles [O, from the HIG and Android guidance]: one meaning per pattern; strength follows importance; never haptics on scroll or on decorative motion; a haptic fires on the frame where the visual event happens (contact, commit), not at animation start; everything is off when the user disables system haptics or our in-app switch; at most one haptic per 80 ms except deliberate tick trains (roulette).

| # | Meaning (event) | iOS | Android (preferred → fallback) |
|---|---|---|---|
| H1 `select` | selection changes: chip, segmented control, tile on/off, BAC unit swap, level selector | `UISelectionFeedbackGenerator.selectionChanged()` / `.sensoryFeedback(.selection)` | `SEGMENT_TICK` (34) → `CLOCK_TICK` (21) |
| H2 `tap` | light press on a primary action that does not commit yet (open sheet, water button) | `UIImpactFeedbackGenerator(.light)` | `VIRTUAL_KEY` (5) (+ `VIRTUAL_KEY_RELEASE` 27 on release only for hero buttons) |
| H3 `drinkAdded` | a drink is added (optimistic, at the frame the fill starts) | `.impact(.medium)`, or Core Haptics "pour": transient (intensity 0.7, sharpness 0.4) + short continuous decay 120 ms | Composition `CLICK` scale 0.8 + `LOW_TICK` 0.4 at +60 ms (30/31) → `CONTEXT_CLICK` (23) |
| H4 `confirmed` | server confirmed (Enregistré), check-in accepted, payment settled | `UINotificationFeedbackGenerator(.success)` | `CONFIRM` (30) → composition `TICK`,`CLICK` → none |
| H5 `rejected` | rollback, error, double-tap blocked, cheat rejection | `.warning` for rollback / blocked, `.error` for hard failure | `REJECT` (30) → `LONG_PRESS` (3) |
| H6 `toggle` | custom switch on / off | system `UISwitch` haptic, or `.impact(.light)` on a custom switch | `TOGGLE_ON` / `TOGGLE_OFF` (34) → `CLOCK_TICK` |
| H7 `tick` | roulette / wheel segment crossing, crash multiplier step, scrub crossing a BAC threshold or the peak | `.selection` (rate-limited by the spin's natural slowdown) | `SEGMENT_FREQUENT_TICK` (34) → composition `TICK` scale 0.3 → `CLOCK_TICK` |
| H8 `impactHeavy` | takeover, crown landing, new leader, bomb explosion, Le Doigt chosen finger | `.impact(.heavy)` (or `.rigid` for crown contact) | Composition `THUD` (30) → predefined `EFFECT_HEAVY_CLICK` (29) [U] → `LONG_PRESS` |
| H9 `clink` | Cheers: glasses touch | `.impact(.rigid, intensity: 1)`, Core Haptics transient sharpness 1.0 | Composition `CLICK` 1.0 + `TICK` 0.5 at +40 ms → `CONFIRM` |
| H10 `sosHold` | SOS press-and-hold, rising over 2 s; stops on release | Core Haptics continuous event, intensity curve 0.2 → 1.0 over 2 s + transient ticks at 0.5 / 1 / 1.5 s; `.success`-like strong transient at send | API 36: `BasicEnvelopeBuilder` ramp; API 30: composition chain `SLOW_RISE` ×3 with rising scale + `THUD` at send; < 30: `GESTURE_START` at press and `LONG_PRESS` at send |
| H11 `swipeThreshold` | card swipe or row swipe crosses its commit threshold (and back) | `.impact(.soft)`, once per crossing | `GESTURE_THRESHOLD_ACTIVATE` / `_DEACTIVATE` (34) → `CLOCK_TICK` |
| H12 `celebrate` | podium winner, badge unlocked (once, at the signature moment; confetti itself is silent) | `.success` then `.impact(.light)` at +120 ms | `CONFIRM` + composition `TICK` → `CONFIRM` |

Rules for DESIGN.md events: light tap → H1/H2; medium for adding a drink → H3; success on server confirm → H4; warning on rollback / error → H5; heavy for takeover, crown and explosion → H8; rising pattern during SOS hold → H10.

Platform notes:
- iOS: call `prepare()` on generators just before expected use, for example on touch-down of a hero button [U]. Core Haptics needs iPhone 8 or later; check `CHHapticEngine.capabilitiesForHardware().supportsHaptics` [U]. By default iOS suppresses haptics while the microphone records [U]. That matters for voice input at level 2 (ADP-05): either set `AVAudioSession.setAllowHapticsAndSystemSoundsDuringRecording(true)` or confirm voice actions after recording stops.
- Android: guard every composition with `areAllPrimitivesSupported` or `arePrimitivesSupported`. Never use `createOneShot` or a waveform for UI feedback. Keep `performHapticFeedback` as the default path (no permission). Respect `View.isHapticFeedbackEnabled`.
- Adaptive levels: from level 2, H3 and H4 become the main confirmation channel. Keep them, raise H4's intensity on Android (composition scale 1.0). Drop H7 tick trains, because games are secondary at levels 2 and 3, and never add new haptics.
- Sound is optional (MOT-01) and goes through the same event names: `drinkAdded` may pair with a short pour sound when sound is on. Core Haptics and Pulsar can sync audio with haptics.

### 3.4 Living background (MOT-02) (deliverable 4)

**Concept: the bubble field.** The Party screen ground (`bg #1E2624`) carries a sparse field of micro-bubbles, the same motif as the glass in MOT-03, rendered slate on slate (`surface` / `surface2` lightness, alpha 0.25 to 0.5, 2 to 6 px). [O]

- **It encodes real state** (no purely decorative motion):
  - *Crew energy*: each drink anyone in the crew logs releases 3 to 6 bubbles from the bottom edge, so the background is the echo of the crew's activity. Quiet crew: still background. Busy crew: a steady drift.
  - *Party mood (O-35)*: sets rise speed and wobble (chill: slow, straight; fête: faster, slight sway). Never colour.
  - *Time of night*: a single uniform shifts ground lightness by ΔL ≤ 2 % (early evening a touch warmer and lighter, 3 a.m. deepest, dawn approaching the light theme). It updates once a minute and costs no frames.
  - *Signature moments*: a takeover or a new leader sends one horizontal ripple through the field (displacement only, no glow).
- **What it never does**: radial halo, aurora, blob gradients, glow, hue shifts, amber in the field (amber stays scarce), parallax with device tilt, or motion behind text at levels 2 and 3.
- **Battery** [O; F for the platform APIs]:
  - Render on demand. When no bubble is alive, the field is a static frame with no display link, timeline or shader time uniform running.
  - Cap at 30 Hz: iOS `CADisplayLink.preferredFrameRateRange(min 15, max 30, preferred 30)` or `TimelineView(.animation(minimumInterval: 1/30))` [U]; Android `Modifier.preferredFrameRate(30f)` (Compose 1.9) / `View.requestedFrameRate = 30f` (ARR, Android 15 QPR1+); RN Skia: drive from a frame callback that skips frames; Flutter: a `Ticker` that skips frames.
  - At most 40 live bubbles, drawn in one call (`Atlas` / `drawAtlas` / `CAEmitterLayer` / Compose `Canvas`). No full-screen fragment shader is required. A cheap AGSL / Metal / SkSL grain shader is optional, static, and drawn once.
  - Paused when the screen is not visible, in eco mode (ADP-08: battery ≤ 20 % or OS battery saver / Low Power Mode), with Reduce Motion (static field, mood shown only by the lightness step), and at levels 2 and 3 (static, maximum contrast).
- **Per-stack path**: N: `CAEmitterLayer` or SwiftUI `Canvas`; Compose `Canvas` + `withFrameNanos`. R: Skia `Atlas` + Reanimated frame callback. F: `CustomPainter` + `drawAtlas`.
- **Validation**: the Motion review subagent measures energy impact (Xcode Energy gauge, Android Studio Power Profiler / ODPM on Pixel devices [U]). Budget proposal: the background adds under 2 % CPU on average over a 10-minute idle Party screen on the modest Android device (A-MOTION-6).

### 3.5 Motion rules per adaptive level (deliverable 5)

| Rule | L0 Frais | L1 Pompette | L2 Bien entamé | L3 Cuit |
|---|---|---|---|---|
| Spring tokens | all | all | `snap`, `standard` only; `signature` becomes `standard` (no overshoot anywhere) | fades (`effects.default`) + `snap` for press feedback only |
| Longest single animation | per table | per table | 400 ms (sequences collapse to their end state + one confirmation) | 250 ms |
| Shake, wobble, loops | allowed where tabled | allowed | none (bomb and crash show colour steps + H7 / H8 instead of shake) | none |
| Shared-element flights | yes | yes | yes, bounce 0 (they help orientation) | cross-fade |
| Living background | on | on, half the bubble rate | static | static |
| Digits roll (BAC) | 14 steps | 14 steps | 6 steps, 300 ms | instant + fade |
| Simultaneously moving elements | free | ≤ 3 | 1 | 1 |
| Confetti / celebrations | yes | yes | replaced by a static badge + H12 | none |
| Haptics | full vocabulary | full | H1 to H6, H8, H10 (no tick trains) | H3 to H5, H10 only, maximum strength |
| SOS ring | yes | yes | yes | yes (functional, never reduced) |
| Level change itself | — | cross-fade 300 ms, no layout fly-around (ADP-01 hysteresis prevents flicker) | same | same |

Overrides, in priority order: Reduce Motion (OS) > eco mode (ADP-08) > adaptive level > default. With Reduce Motion: x/y/z movement becomes a fade, springs jump or fade to the end state, loops stop, the background is static, and haptics are unchanged (HIG: haptics carry the information motion drops). Nothing important may depend on seeing an animation (HIG: motion optional).

### 3.6 Testing motion frame by frame (deliverable 6)

1. **Global motion time scale (all stacks)**: every token in our motion module is multiplied by a debug `motionScale` (0.1× to 10×), editable from a hidden dev menu and readable by the test harness. It is required because Reanimated, Skia frame callbacks, Rive and custom clocks do not share one OS switch. Proposed as MOT-14 [O].
2. **Slowed recordings**:
   - iOS: Simulator "Slow Animations" (Debug menu) [U]; on device, the `motionScale` × 5 build. Record via QuickTime over cable or Control Centre screen recording, then extract frames with `ffmpeg -i in.mov -vsync 0 frames/%05d.png` [U].
   - Android: Developer options › Animator duration scale 5× / 10× (affects Compose and Views); `adb shell screenrecord` (variable frame rate, so convert to constant with ffmpeg before stepping) [U].
   - Haptic and visual sync: film the phone with a second phone at 240 fps slow motion and a microphone touching the case. Check that the haptic buzz lines up with the visual contact frame within ±1 frame at 60 Hz [O].
3. **Frame timing tools**:
   - iOS: Instruments Animation Hitches template; hitch ratio target ≤ 5 ms/s, ≥ 10 ms/s is "distracting" (WWDC20) [F]. XCTest `XCTOSSignpostMetric` animation intervals (hitch count, hitch ratio, frame rate) in UI tests [F]. MetricKit and Xcode Organizer hitch rate in the field [F].
   - Android: Perfetto FrameTimeline (expected vs actual frame, jank type) [F]. Profile GPU rendering bars [F]. `adb shell dumpsys gfxinfo <pkg> framestats` [U]. Macrobenchmark `FrameTimingMetric` (`frameDurationCpuMs`, `frameOverrunMs`) on a physical low-end device in CI [U]. JankStats in production [F: listed]. Vitals definitions: slow frame 16 to 700 ms, frozen 700 ms to 5 s [F].
   - React Native: Reanimated in release / `debugOptimized` builds only (debug is not representative) [F]; Flashlight for Android performance scoring [U]; Perf Monitor.
   - Flutter: DevTools Performance (UI vs raster thread per frame) in `--profile` mode; `timeDilation` for slow motion [U].
4. **Deterministic golden frames (CI)**: Compose `mainClock` stepping, Flutter `pump(Duration)` goldens, Reanimated Jest timers. Snapshot each signature animation at 0 / 25 / 50 / 75 / 100 % of its duration and compare. Native SwiftUI has no built-in clock control, so it uses recorded-video review [U/O].
5. **Motion review checklist** (for the subagent): timing vs token (±1 frame), no overshoot outside `signature`, no dropped frames at 120 Hz on iPhone and 60/90 Hz on the modest Android, haptic present / absent per vocabulary, Reduce Motion variant, levels 2 and 3 variant, eco mode variant, interruption (tap during an animation retargets smoothly and never queues).

### 3.7 Proposed outline for MOTION.md (deliverable 7)

1. Purpose and principles: motion explains state; signature vs routine; nothing important only in motion; interruptible; haptics are part of motion.
2. Tokens:
   - 2.1 Spring tokens (Apple d/b + k/ζ/c + per-stack code snippets).
   - 2.2 Effects tokens.
   - 2.3 Timing curves kept, and why.
   - 2.4 Durations for loops and holds.
   - 2.5 Conversion formula and how to add a token.
3. Choreography: order (cause before effect, the primary element first), stagger rules (40 to 80 ms per item, max 5 items, then group), enter/exit asymmetry (exit faster), shared-element rules, one moving focus at a time.
4. The motion table: every DESIGN.md §5 row with token, trigger, haptic id, sound id, Reduce Motion variant, L2/L3 variant, eco variant.
5. Haptic vocabulary: H1 to H12 with per-platform implementation, fallbacks by API level, rate limits, user switch.
6. Sound (optional): event names, mixing, silent-mode behaviour.
7. Living background: spec, data inputs, budgets, off-switches.
8. Adaptive levels: the §3.5 table, plus override order.
9. Accessibility: Reduce Motion, cross-fade preference, Dim Flashing Lights, no flashing over 3 Hz, screen-reader announcements for live motion events.
10. Performance budgets: 120 Hz iPhone / 60 to 90 Hz modest Android, hitch ratio ≤ 5 ms/s, particle and animated-element caps, frame-rate votes, battery budget for the background, eco mode.
11. Implementation per stack (filled after the ADR): libraries, wrappers, the `motion` module API (`motion.spring('move')`, `haptics.play('confirmed')`).
12. Testing: motion scale, recordings, frame tools, goldens, the review checklist.
13. Change log and ADR links (deviations from DESIGN.md, for example native sheets).

---

## 4. Assumptions

- **A-MOTION-1**: Reanimated's `duration` spring mode uses a different "perceptual duration" definition than Apple's (source says actual ≈ 1.5 × duration). Basis: Reanimated 4.x source comments. Verify: animate the same token with physics mode and duration mode on device, and compare the 50 % and 90 % times against SwiftUI.
- **A-MOTION-2**: SwiftUI presets `.smooth` / `.snappy` / `.bouncy` use bounce about 0 / 0.15 / 0.3 at 0.5 s. Basis: memory of WWDC23. Verify: read `Spring.snappy.bounce` at runtime.
- **A-MOTION-3**: Compose animations honour Android's animator duration scale ("Remove animations" = 0) through `MotionDurationScale`. Basis: secondary blogs. Verify: a Compose test app with the scale at 0 and 10.
- **A-MOTION-4**: Flutter's `MediaQuery.disableAnimations` reflects Android "Remove animations" as well as iOS Reduce Motion. Verify: on a device.
- **A-MOTION-5**: iOS suppresses haptics during microphone recording unless `setAllowHapticsAndSystemSoundsDuringRecording(true)` is set. Basis: prior knowledge. Verify: voice input + H4 on a device.
- **A-MOTION-6**: the bubble field costs under 2 % average CPU and has no measurable battery impact over 10 minutes on a modest Android device. Basis: design (≤ 40 sprites, ≤ 30 Hz, on demand). Verify: Android Studio Power Profiler / Perfetto CPU, Xcode Energy gauge.
- **A-MOTION-7**: the "modest Android phone" for MOT-12 is an API 30 to 33 device with a 60 or 90 Hz panel and 4 GB RAM (for example a Samsung Galaxy A-series). Verify: the user confirms the reference device.
- **A-MOTION-8**: the reference-app observations (§2.3) are the author's reading of shipped apps, not documented design rationale.
- **A-MOTION-9**: `EFFECT_HEAVY_CLICK` predefined effect is available from API 29. Verify: `VibrationEffect` reference.
- **A-MOTION-10**: SwiftUI has no first-party multi-pointer API, so Le Doigt on iOS native needs a UIKit wrapper. Verify: the iOS 26 SwiftUI gesture docs.

## 5. Scope changes

- **MOT-14 [P0] (new)**: global motion time scale + deterministic animation clock hooks in the motion module (dev menu + test harness). Reason: the frame-by-frame Motion review required by `<motion>` cannot be done reliably across Reanimated / Skia / Rive / custom clocks without it.
- **MOT-15 [P0] (new)**: haptic capability matrix and fallbacks (per platform, per API level, per device support level), with an in-app haptics switch independent of sound. Reason: Android compositions fail as a whole on unsupported primitives; Flutter and RN depend on libraries.
- **MOT-01 (change)**: name the five spring tokens and the rule "springs for space and gesture, curves for time" in the ID text. Note explicitly that Android must use a custom `MotionScheme`, not M3 Expressive's default (it bounces).
- **MOT-02 (clarify)**: the living background must encode crew activity / mood / time and render on demand (≤ 30 Hz, static when idle). Off in eco mode, with Reduce Motion and at levels 2 and 3.
- **DESIGN.md §5 (deviation to record in an ADR)**: native sheets and native switches keep their system springs instead of 320 ms / 220 ms curves.
- **ADP-05 / voice input (dependency)**: check haptic suppression during recording (A-MOTION-5).

## 6. Glossary additions

| English term | Meaning | French UI term (if user-facing) |
|---|---|---|
| Spring | Physics-based animation defined by duration + bounce (or stiffness + damping) | (internal) |
| Bounce | Overshoot amount of a spring; 0 = none, 1 = undamped | (internal) |
| Perceptual duration | The time a spring takes to feel done; callbacks fire here | (internal) |
| Signature moment | One of the few events allowed overshoot (takeover, crown, podium, badge) | (internal) |
| Effects spring | Spring for colour / opacity, never overshoots | (internal) |
| Hitch | A frame shown later than expected | (internal) |
| Hitch ratio | Hitch time per second of animation, ms/s | (internal) |
| Haptic vocabulary | Fixed mapping of meanings (H1 to H12) to vibration patterns | Vibrations |
| Reduce Motion | OS setting that replaces movement with fades | Réduire les animations (iOS label) |
| Remove animations | Android equivalent setting | Supprimer les animations [U: exact Android FR label] |
| Living background | The Party screen's state-driven bubble field | Fond animé |
| Motion scale | Debug multiplier on all animation durations | (internal) |
| Eco mode | Low-battery reduced-effects mode (ADP-08) | Mode éco |

## 7. Blockers

- **Physical test devices** (needs the user): one ProMotion iPhone (iPhone 13 Pro or later) and the modest Android reference device (A-MOTION-7). Simulators and emulators cannot judge 120 Hz, haptics or battery.
- **Rive editor** (only if Rive is chosen for empty states / badges / launch): a Rive account. The free tier is enough to prototype [U on current plan limits].
- No paid service is required for motion.

## 8. Sources

All read on 2026-10-26 unless stated. Page dates as shown on the page.

- Apple HIG, Motion (change log to 2025-09-09): https://developer.apple.com/design/human-interface-guidelines/motion (read via the r.jina.ai text proxy)
- Apple HIG, Accessibility (change log to 2025-06-09): https://developer.apple.com/design/human-interface-guidelines/accessibility (via r.jina.ai)
- Apple HIG, Playing haptics (change log to 2024-05-07): https://developer.apple.com/design/human-interface-guidelines/playing-haptics (via r.jina.ai)
- Apple, SwiftUI `SensoryFeedback`: https://developer.apple.com/documentation/swiftui/sensoryfeedback (via r.jina.ai); `levelChange`: https://developer.apple.com/documentation/swiftui/sensoryfeedback/levelchange.md
- Apple, WWDC23 "Animate with springs" (session 10158): https://developer.apple.com/videos/play/wwdc2023/10158/ ; notes: https://wwdcnotes.com/documentation/wwdc23-10158-animate-with-springs/
- Apple, WWDC20 "Eliminate animation hitches with XCTest" (10077): https://developer.apple.com/videos/play/wwdc2020/10077/ ; notes: https://wwdcnotes.com/notes/wwdc20/10077
- Apple, Analyzing responsiveness issues in your shipping app: https://developer.apple.com/documentation/xcode/analyzing-responsiveness-issues-in-your-shipping-app.md
- Apple Developer Forums, zoom transition + matchedGeometryEffect: https://developer.apple.com/forums/thread/757710 ; title animation: https://developer.apple.com/forums/thread/774573
- Material 3, Motion physics "How it works" (May 2025): https://m3.material.io/styles/motion/overview/how-it-works (via r.jina.ai)
- androidx source, ExpressiveMotionTokens.kt: https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/ExpressiveMotionTokens.kt
- androidx source, StandardMotionTokens.kt: https://raw.githubusercontent.com/androidx/androidx/androidx-main/compose/material3/material3/src/commonMain/kotlin/androidx/compose/material3/tokens/StandardMotionTokens.kt
- Compose Material3 `MotionScheme` reference: https://developer.android.com/reference/kotlin/androidx/compose/material3/MotionScheme ; https://composables.com/docs/androidx.compose.material3/material3/1.5.0-alpha10/interfaces/MotionScheme
- Compose Animation releases (stable 1.12.1, 2026-09-09): https://developer.android.com/jetpack/androidx/releases/compose-animation
- Compose shared elements (updated 2026-10-22): https://developer.android.com/develop/ui/compose/animation/shared-elements
- Android haptics design principles: https://developer.android.com/develop/ui/views/haptics/haptics-principles
- Android haptic feedback: https://developer.android.com/develop/ui/views/haptics/haptic-feedback
- Android custom haptic effects: https://developer.android.com/develop/ui/views/haptics/custom-haptic-effects
- Android `HapticFeedbackConstants` reference: https://developer.android.com/reference/android/view/HapticFeedbackConstants (via r.jina.ai)
- Android adaptive refresh rate (updated 2026-10-23): https://developer.android.com/develop/ui/views/animations/adaptive-refresh-rate
- Android slow rendering (updated 2026-10-23): https://developer.android.com/topic/performance/vitals/render
- Android "Remove animations" and Compose (secondary): https://buttondown.com/inclusive-android-apps/archive/inclusive-android-apps-8-the-problem-of-animations/ ; https://proandroiddev.com/making-basicmarquee-modifier-more-accessible-8b3737307dee
- Reanimated 4 stable (2025-07-23): https://swmansion.com/blog/reanimated-4-stable-release-the-future-of-react-native-animations-ba68210c3713
- Reanimated 4.2.0 (December 2025): https://swmansion.com/blog/introducing-reanimated-4-2-0-71eea21ca861/
- Reanimated performance guide: https://docs.swmansion.com/react-native-reanimated/docs/guides/performance
- Reanimated accessibility (Reduce Motion): https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility
- Reanimated shared element transitions: https://docs.swmansion.com/react-native-reanimated/docs/shared-element-transitions/overview/ ; React Navigation: https://reactnavigation.org/docs/shared-element-transitions
- Reanimated `withSpring`: https://docs.swmansion.com/react-native-reanimated/docs/animations/withSpring ; spring configs 4.7.1: https://app.unpkg.com/react-native-reanimated@4.7.1/files/src/animation/spring/springConfigs.ts
- Native Weekly, 2025-12-05: https://nativeweekly.beehiiv.com/p/dec-5-2025-issue-8
- Expo Router zoom transition: https://docs.expo.dev/router/advanced/zoom-transition/ ; Link reference SDK 55: https://docs.expo.dev/versions/v55.0.0/sdk/router/link
- React Native Gesture Handler changelog: https://swmansion.com/changelog/react-native-gesture-handler/ ; v3.0.0: https://newreleases.io/project/github/software-mansion/react-native-gesture-handler/release/v3.0.0
- React Native Skia Atlas: https://shopify.github.io/react-native-skia/docs/shapes/atlas/ ; Animations: https://shopify.github.io/react-native-skia/docs/animations/animations/ ; Shopify on WebGPU / Graphite (2025): https://shopify.engineering/webgpu-skia-web-graphics
- Software Mansion skills (RN animations best practices): https://github.com/software-mansion-labs/skills/blob/main/skills/react-native-best-practices/references/animations/SKILL.md
- Pulsar (Software Mansion) RN SDK 1.7.0: https://docs.swmansion.com/pulsar/sdk/react-native/ ; https://docs.swmansion.com/pulsar/getting-started/
- react-native-haptic-feedback: https://docsearch.algolia.com/mcp/docs/repo/mkuczera/react-native-haptic-feedback
- Rive React Native runtime: https://rive.app/docs/runtimes/react-native/react-native ; Margelo Nitro rewrite (July 2026): https://margelo.com/blog/rewriting-rive-react-native-with-nitro-modules ; Rive mobile use cases: https://rive.app/use-cases/mobile-apps
- Flutter Impeller (docs for 3.47, updated 2026-08-21): https://docs.flutter.dev/perf/impeller
- Flutter Impeller Android engine doc: https://flutter.googlesource.com/mirrors/engine/+show/refs/heads/main/impeller/docs/android.md
- Flutter `SpringDescription.withDurationAndBounce`: https://api.flutter.dev/flutter/physics/SpringDescription/SpringDescription.withDurationAndBounce.html ; PR #164411: https://dart.googlesource.com/monorepo//+/28c67afbb634bff93acece51805bdfd8e0dc2ef5
- Flutter predictive back: https://docs.flutter.dev/platform-integration/android/predictive-back
- flutter_animate 4.5.2: https://pub.dev/packages/flutter_animate
- Flutter haptics plugins: https://pub.dev/documentation/haptic_kit/latest/ ; https://pub.dev/documentation/pulsar_haptics/0.1.1/ ; https://pub.dev/documentation/core_haptics/latest/
- Third-party guide on ProMotion and `CADisableMinimumFrameDurationOnPhone` (secondary): https://skills.cat/skills/charleswiltgen/axiom/axiom-display-performance
- Facts with no source above are marked [U] in the text.
- Derived numbers [D] come from a local Python fit, not a source. Method: least squares over 201 samples of each `cubic-bezier` against the analytic damped-oscillator solution with the conversion above.
