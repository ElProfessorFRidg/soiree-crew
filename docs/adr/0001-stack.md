# ADR 0001: Stack

Status: accepted, 2026-10-26.

## Context

Inputs: `research/stack-inputs.md`, `research/motion.md`, `research/polish.md`, `research/security.md`.
The user develops on Windows, has no Mac, and wants the app for personal use first. iOS builds come from GitHub Actions as an unsigned IPA that the user signs with their own sideloading tool.

## Decision

- **App:** Expo SDK 58 (React Native 0.88, New Architecture, Hermes), TypeScript strict, Expo Router.
- **Motion:** Reanimated 4 with react-native-worklets, Gesture Handler 3, react-native-svg for icons and the curve. Skia only when a screen needs it (particles, curve gradients).
- **Monorepo:** pnpm workspaces. `packages/bac` (BAC engine), `packages/units` (countries, conversions, defaults), `packages/design-tokens` (typed view of `design/tokens.json` and `design/icons.json`). The engine and the units module are plain TypeScript, so the backend and the widgets' JS-free code paths can port or reuse them.
- **Builds:** GitHub Actions. A macOS job runs `expo prebuild`, then `xcodebuild` with signing disabled, and packs `Payload/*.app` into an `.ipa`. An Ubuntu job builds an Android APK. No EAS account needed.
- **Backend:** Supabase in an EU region (Postgres, auth, realtime, storage, edge functions) when crew features start. Until then the app runs local-first: every mutation goes through the sync layer with a local transport, so swapping in the server transport changes no screen.
- **Fonts:** Archivo static instances generated from the variable font by `tools/fonts/make-instances.py`, because React Native cannot set variation axes. One file per style of `design/DESIGN.md` §2.

## Rejected

- **Native SwiftUI + Compose:** best motion fidelity (`research/motion.md`), but two codebases, and no Mac to build or debug iOS.
- **Flutter:** good on modest Android phones, weaker haptics and a less native feel for sheets and navigation; no team experience.
- **EAS Build:** works, but needs an Expo account and paid build minutes past the free tier; GitHub Actions is free for this use.

## Consequences

- Widgets, Live Activities, Siri intents and phone-to-phone Bluetooth need native code (Swift and Kotlin) through Expo modules or config plugins (`research/polish.md` finding 1). The free sideloading certificate limits App Groups and extensions; widgets wait until signing is sorted.
- Local data is stored in AsyncStorage for now. SEC-05 (encrypted local database) lands with the backend work.
- iOS only gets tested on the user's phone after each CI build. Day-to-day checks run on react-native-web and on Android.
