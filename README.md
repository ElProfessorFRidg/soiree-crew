# Soirée Crew

Crew night-out app: BAC estimate and safety, the crew's live party, bars and territories, rounds and pools, recaps and party games. Expo (React Native) + TypeScript, pnpm monorepo, a small Fastify server. Decisions in `docs/adr/`, spec in `PROMPT.md`, progress per ID in `FEATURES.md`, design in `design/`.

## Install on a phone

Every push to `main` builds both apps and publishes them as the latest GitHub release:

- Android: https://github.com/ElProfessorFRidg/soiree-crew/releases/latest/download/soiree-crew.apk (install it directly; allow unknown sources).
- iOS: https://github.com/ElProfessorFRidg/soiree-crew/releases/latest/download/soiree-crew-unsigned.ipa (unsigned: sign it with a sideloading tool such as AltStore or Sideloadly).

The app works alone on the phone. Crew features need a server (below): the first screen of the Crew tab asks for its address.

## Layout

- `apps/mobile`: the app (Expo Router, screens in `src/app`, catalogues in `src/i18n`).
- `apps/server`: the API (Fastify, PostgreSQL or a local PGlite file). See `apps/server/README.md` to run or deploy it.
- `packages/bac`: BAC engine and adaptive UI levels.
- `packages/units`: countries, legal limits, BAC units, volumes, preferences.
- `packages/territory`: bar territories, seasons and titles.
- `packages/money`: pools, splits and settling up.
- `packages/games`: the 15 party games and their decks.
- `packages/fuzzy`: forgiving text input for drink names.
- `packages/design-tokens`: typed view of `design/tokens.json` and `design/icons.json`.
- `tools/slop-lint`: lint on every user-facing text; `tools/dev/seed.mjs`: fills a local server with a test crew.

## Run locally

```bash
pnpm install
pnpm check
```

`pnpm check` runs the type check, the tests and the copy lint. Then, in two terminals:

```bash
DATA_KEY=$(openssl rand -base64 32) pnpm --filter @crew/server dev
```

```bash
pnpm --filter @crew/mobile web
```

## Rules of the house

- Everything in the repository is in English; user-facing text lives only in the catalogues.
- The server is the source of truth; the app shows changes at once and confirms or rolls them back.
- `VOICE.md` says how the app talks, `SLOP.md` what it never writes, `MOTION.md` how it moves, `SECURITY.md` and `docs/PRIVACY.md` how data is protected.
