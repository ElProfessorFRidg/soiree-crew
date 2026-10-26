# Soirée Crew

Crew night-out app. Expo (React Native) + TypeScript, pnpm monorepo. Decisions in `docs/adr/`, spec in `PROMPT.md`, design in `design/`.

## Layout

- `apps/mobile`: the app (Expo Router, screens in `src/app`).
- `packages/bac`: BAC engine, adaptive UI levels. No UI, fully tested.
- `packages/units`: countries, legal limits, BAC units, volumes, default settings.
- `packages/design-tokens`: typed view of `design/tokens.json` and `design/icons.json`.
- `tools/slop-lint`: SLOP-04 lint on the translation files.

## Run

```bash
pnpm install
pnpm check
pnpm --filter @crew/mobile web
```

`pnpm check` runs the type check, the tests and the SLOP-04 lint.

## Builds

GitHub Actions (`.github/workflows/build.yml`) builds on every push to `main`:

- an unsigned iOS IPA (`soiree-crew-ios-unsigned` artifact), to sign with your sideloading tool;
- an Android APK (`soiree-crew-android` artifact).
