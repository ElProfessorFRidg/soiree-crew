# Recon-Skills report

Author: Recon-Skills (phase 0). Date: 2026-10-26. Companion file: `SKILLS.md` (tables per phase).

## 1. Summary

- Every phase in `<skills>` has at least one vetted skill or official guide. 21 candidates are staged in `research/skill-candidates/` (text only, 103 Markdown files, about 650 KB of text), all read in full at a pinned commit. Nothing was placed in `.claude/skills/` and no script was downloaded or run.
- Three gaps have no usable skill: game design, i18n library usage (ICU / FormatJS / i18next), and location anti-spoofing. Official docs cover them; the agents for those IDs work from docs, not skills.
- No prompt injection was found. Six skills carry agent instructions that conflict with project rules or leak data and must be edited before install: Expo's `npx --yes @expo/agent-cli@latest feedback` telemetry call (expo-module, expo-animation), PowerSync's `@latest` installs, its `node scripts/trim.mjs` step and its offer to write into `CLAUDE.md` / `AGENTS.md`, Impeccable's launcher that downloads a binary on first run, Detox's vendor-cloud upload section, and the PowerSync custom-backend sample whose token endpoint mints a JWT for any `user_id` without authentication.
- Licences: everything staged is MIT, Apache-2.0 or CC-BY-4.0, except the four dpearson2699 iOS skills (PolyForm Perimeter 1.0.0: free for our use, no competing product, keep the `Required Notice` line).
- Several skills give defaults that contradict the approved design (SF Symbols and the system font, "UI animation under 300 ms", "no animation for 100+/day actions", em dashes allowed in moderation). The project files must win; the orchestrator should add one line to each installed skill or to `CLAUDE.md` saying so.
- PowerSync's write model (generic CRUD upload of table rows) clashes with AC-01 (client sends raw events, server computes). If PowerSync is picked, uploads must go to command endpoints with per-object authorisation, not a generic table writer.

## 2. Findings

### 2.1 Where skills come from (October 2026)

- Agent Skills (`SKILL.md` + references) is now the common format across Claude Code, Codex, Gemini, Cursor. Vendors publish official repos: anthropics/skills, expo/skills, android/skills, callstackincubator, software-mansion-labs, powersync-ja, supabase, maplibre, mapbox, getsentry, OWASP/secure-agent-playbook, Trail of Bits.
- Curated lists: VoltAgent/awesome-agent-skills (36k stars, 2026-10-25) is the most useful index; it lists official skills per vendor. Registries (skills.sh, tessl.io, skillselion, agentskills.so) mirror repos and add security scores; their star counts disagree, so every number in `SKILLS.md` comes from the GitHub API on 2026-10-26.
- skills.sh flagged one Maestro skill (builderio) as high risk because its install step pipes a remote script to `bash`. That pattern exists across testing skills; we staged none of them.

### 2.2 Staged candidates

Commit SHAs are the repo HEAD on 2026-10-26. "Not staged" lists the referenced files we left upstream.

| Candidate | Repo @ commit | Files staged | Not staged / depends on | Notes |
|---|---|---|---|---|
| impeccable | pbakaus/impeccable @ 6743a347 (v4.7.1, 88.7k stars) | SKILL.md + 18 references (native audit/adapt, ios, android, animate, polish, craft-floor, layout, typeset, colorize, quieter, distill, delight, bolder, clarify, shape, routing, craft) | `scripts/` (launcher, Node detector, 1.1 MB font index, live-browser JS), new-work.md, critique.md, harden.md, live/generate/hooks/document | Setup step 1 runs `scripts/impeccable context`, a launcher that "downloads a self-contained binary on first run". The skill documents a fallback ("Launcher unavailable") that reads PRODUCT.md and DESIGN.md directly: use only that path. The detector (`impeccable detect`) is HTML/CSS only, so SLOP-08 needs our own lint for native code. |
| humaniseur-fr | samber/cc-skills @ 123cb155 (v1.1.3) | SKILL.md | evals.json | 38 patterns, quantified study cited (Labbé, Labbé & Savoy). Its "80 % rule", "keep an em dash that earns its place" and argot palette conflict with SLOP-04 (zero dashes) and the forced-slang ban. |
| humanizer-en-asd-ste100 | samber/cc-skills @ 123cb155 (v1.0.2) | SKILL.md | evals.json; fetches the official ASD-STE100 PDF from asd-ste100.org when needed | Fits `<writing_patterns>` "functional text uses STE". Not for voiced text. |
| voltra | callstackincubator/voltra @ 58f0fd4f (v2.0.0) | SKILL.md + 18 references | none | "Never generate Swift/Kotlin" rule: scope it to Voltra surfaces only; App Intents and native modules still need native code. Interactive widget buttons (O-33 add a drink) are not documented in the skill: verify in Voltra docs before choosing it. |
| ios-widgetkit, ios-activitykit, ios-app-intents, ios-device-integrity | dpearson2699/swift-ios-skills @ 8d90fd12 | 4 SKILL.md + device-integrity-patterns.md + system-surfaces.md + LICENSE each | widgetkit-advanced.md, activitykit-patterns.md, appintents-advanced.md, evals | Doc links point to sosumi.ai, a third-party mirror of Apple docs; prefer developer.apple.com. device-integrity's `handleRejectedKey` deletes key `app-attest-key-id` without the account suffix used when saving (sample bug). ActivityKit: active lifetime 8 h, then up to 4 h on the Lock Screen: a party longer than 8 h needs a restart strategy. |
| android-glance-canonical-layouts | android/skills @ 4ebabf2b | SKILL.md + LICENSE | about 80 Kotlin/XML sample files in `references/` | Its workflow copies Google's sample files, including `Fake*Repository.kt` mock data, into the app: that conflicts with "no mock data in production" and with our own design. Use as layout guidance only. |
| powersync | powersync-ja/agent-skills @ af04e2e9 (v1.6.4) | SKILL.md, AGENTS.md, powersync-overview, powersync-js-react-native, custom-backend | 25 other references, `scripts/trim.mjs` | See 2.3. Useful rules: never return 4xx from the upload endpoint (it blocks the queue), `transaction.complete()`, `disconnectAndClear()` on account switch (O-13). |
| swm-react-native-best-practices | software-mansion-labs/skills @ 58afa0a0 | router SKILL.md, animations (SKILL, animations, animations-performance), gestures (SKILL, gestures, tap-handling) | svg, audio, jsi, multithreading, on-device-ai, canvas, gpu, layout, scroll refs | Internal inconsistency: says `runOnJS` is "removed" in one file and "deprecated" in another. Verify against the installed Reanimated version. |
| swm-pulsar-haptics | software-mansion-labs/skills @ 58afa0a0 | SKILL.md + expo-haptics migration | none | Contains its own anti-injection rule for fetched pages. Good. |
| callstack-react-native-best-practices | callstackincubator/agent-skills @ 59e9d174 | SKILL.md + js-measure-fps, js-profile-react, native-measure-tti, js-lists, js-animations-reanimated | 24 references, 12 PNG images | Profiling relies on `agent-device` (callstack/agent-device, MIT), a CLI we did not download. |
| expo-module | expo/skills @ d5caf7fd (v1.0.0) | SKILL.md + 6 references | none | Config-plugin sample stores an API key in Info.plist: conflicts with "no secret on the client". Ends with the telemetry `npx` call (2.3). |
| expo-animation | expo/skills @ d5caf7fd (v1.0.0, by Emil Kowalski) | SKILL.md + LICENSE | RECIPES.md | Strong method. Conflicts: "100+ times/day: no animation" vs MOT-03 (adding a drink is the most repeated gesture and must be animated); "stay under 300 ms" vs our motion table. Ends with the telemetry `npx` call. |
| emil-review-animations | emilkowalski/skills @ 2d228630 | SKILL.md + STANDARDS.md | none | Web-oriented (CSS, Framer Motion); the method (10 standards, block / approve) transfers to RN. |
| emil-mobile-native | emilkowalski/skills @ 2d228630 | SKILL.md | none | Web only. Use for the invitation page (N-30) only. |
| mobile-accessibility | Community-Access/accessibility-agents @ decf6bac | SKILL.md + phase-1 reference | `a11y-core` schema and sibling agents it hands off to | Output contract is JSON for a schema we do not have: rewrite the output section. Its examples use core `TouchableOpacity`, which conflicts with the Gesture Handler advice. |
| owasp-mobile-code-review, owasp-api-security-review | OWASP/secure-agent-playbook @ 65d4efd2 | 2 SKILL.md + LICENSE | `plays/*.md`, `data/masvs`, `data/mastg`, `templates/finding.md` (not in the bundle; a Tessl reviewer reported the same) | Thin pointers. Pair with the MASVS / MASTG repos (CC-BY-SA-4.0) or fetch the plays. |
| detox | LambdaTest/agent-skills @ 992638bc | SKILL.md + 2 references | none | "Cloud Execution on TestMu AI" uploads app binaries with account credentials to a US vendor: do not use. Advice is inconsistent ("trust auto-sync" vs "use waitFor"). `device.setLocation` serves AC-10 red-team tests. |

### 2.3 Suspicious or unsafe content

No text tried to override instructions, claim authority or exfiltrate secrets. These items are within each skill's purpose but conflict with our rules or the safety policy:

1. **Expo telemetry call** (expo-module/SKILL.md line 148, expo-animation/SKILL.md line 271): "report it so Expo can improve: `npx --yes @expo/agent-cli@latest feedback ...` Include as much relevant context as possible." It runs an unpinned package without a prompt and sends task context to a third party. Strip the section before install.
2. **PowerSync self-propagation** (AGENTS.md step 9): offers to append a line to the project's `AGENTS.md` or `CLAUDE.md`. It asks the operator first, but persistent config changes are the orchestrator's call. Strip it.
3. **PowerSync script and versions** (SKILL.md "First Use", AGENTS.md): run `node scripts/trim.mjs` (not downloaded) and "Never omit `@latest`". Both conflict with "no script runs before it has been read" and "dependencies pinned".
4. **PowerSync insecure sample** (custom-backend.md): `GET /api/auth/token?user_id=...` returns a signed JWT for any user id, and the upload handler interpolates `op.table` into SQL (the file warns about the table name, not about the missing authentication). An agent copying it creates BOLA (SEC-02).
5. **Impeccable binary download** (SKILL.md Setup 1): the launcher "is downloaded once on first run". Scripts were not staged.
6. **Detox vendor cloud** (detox/SKILL.md): `curl -u "$LT_USERNAME:$LT_ACCESS_KEY"` uploads of builds. Strip.
7. Minor: dpearson skills link to sosumi.ai instead of developer.apple.com; Glance skill copies mock repositories; expo-module puts an API key in Info.plist.

### 2.4 Conflicts with project rules (the project wins)

| Skill says | Project rule | Resolution |
|---|---|---|
| Impeccable ios.md: SF Pro carries the UI, SF Symbols for icons | `design/DESIGN.md`: Archivo, custom icon set `design/icons.json` | Brief wins (Impeccable itself says "The brief wins") |
| expo-animation, emil-review-animations: no animation for 100+/day actions, UI under 300 ms | MOT-03 drink animation, motion table in `design/DESIGN.md` | `MOTION.md` timings win; keep the rest of the method |
| humaniseur-fr: keep an em dash that earns its place, 80 % compliance, argot palette | SLOP-04 zero dashes, no forced slang | Lint and `VOICE.md` win |
| PowerSync generic CRUD upload | AC-01 server-authoritative events | Command endpoints; per-object authorisation |
| PowerSync and Expo: `@latest` | Pinned dependencies | Pin |
| Glance sample copy-in, Fake repositories | No mock data, own design | Guidance only |

### 2.5 Already available, worth noting

- Installed `humanizer` is an older 24-pattern adaptation without a version. Upstream blader/humanizer is v3.1.0 (8c307f3, MIT, 60.9k stars). Not staged because the installed one works; worth a separate review.
- Three RN skills overlap: installed `vercel-react-native-skills`, installed `react-native`, staged swm and callstack. Pick swm (authors of Reanimated / Gesture Handler) for APIs and callstack for profiling; keep the others out of builder briefs to avoid conflicting advice.
- `skill-security-auditor` (installed) can re-scan candidates before install.

## 3. Decisions proposed

1. Install after edits (in this order): humaniseur-fr, humanizer-en-asd-ste100, impeccable (native subset, launcher-free), swm-react-native-best-practices, swm-pulsar-haptics, expo-animation, emil-review-animations, callstack-react-native-best-practices, mobile-accessibility. Reason: they serve the quality gates every ID passes (anti-slop, motion, drunk-mode, accessibility), whatever the stack.
2. Install only once the stack ADR is merged: voltra or the dpearson iOS set (widgets, Live Activities, App Intents, device integrity), android-glance, powersync, expo-module, detox, owasp-*. Reason: they are stack-specific.
3. Before installing any skill: remove the sections listed in 2.3, add a header line "Project files (`PROMPT.md`, `design/DESIGN.md`, `MOTION.md`, `VOICE.md`, `SLOP.md`) override this skill", and keep the LICENSE (plus the PolyForm `Required Notice`).
4. Ask the Architect to score Voltra against expo-widgets and hand-written WidgetKit / Glance, with "interactive add-a-drink button without opening the app" and "no double counting" as pass/fail criteria.
5. Use `callstack/agent-device` (MIT) for the drunk-mode tester and QA, after the Architect reviews it as a dev dependency. It lets an agent tap with offsets, read the accessibility tree and profile.

### 3.1 Reusable agent roles for `.claude/agents/`

Every agent gets Read, Grep, Glob. "Writes" means Edit/Write limited to the paths named. Reviewers never get Edit on product code.

| Role | Purpose | Skills | Tools |
|---|---|---|---|
| spec-writer | Writes `specs/<ID>.md` with the 4 UI levels, motion, all states, mutations | spec-driven-development, impeccable shape, design:ux-copy, documentation-and-adrs | Read/Grep/Glob; writes `specs/` only; WebFetch for official docs |
| builder | Implements one ID with tests | swm-react-native-best-practices, expo-animation, swm-pulsar-haptics, test-driven-development, incremental-implementation, source-driven-development, stack skills (voltra / dpearson / powersync / expo-module) once chosen | Read/Edit/Write in app code and tests; Bash (build, test, lint); no network installs without a pinned version |
| design-reviewer ("Apple" review) | Line-by-line check against spec, `DESIGN.md`, prototype, screenshots | impeccable (audit.native, polish, layout, typeset, colorize, craft-floor), design:design-critique, design-review, frontend-design | Read; Bash for simulator and emulator screenshots (`xcrun simctl`, `adb`); browser preview for prototype boards; no Edit |
| code-reviewer | Engineering standards, security, performance | code-review-and-quality, security-review, owasp-api-security-review, callstack-react-native-best-practices, doubt-driven-development | Read/Grep; Bash for lint, typecheck, tests; no Edit |
| anti-slop-reviewer | SLOP-02 / SLOP-05 on copy, screenshots, code | humaniseur-fr, humanizer (or blader v3.1.0), humanizer-en-asd-ste100, impeccable craft-floor and quieter | Read; fresh context with `VOICE.md` + `SLOP.md`; Bash to run the SLOP-04 lint; no Edit |
| motion-reviewer | Frame-by-frame check against `MOTION.md`, haptics | emil-review-animations, expo-animation, swm animations-performance, swm-pulsar-haptics | Read; Bash for screen recordings (`xcrun simctl io recordVideo`, `adb shell screenrecord`) and frame extraction; no Edit |
| drunk-mode-tester | ADP-09 bench: one thumb, offset taps, blur, low brightness, 3 s attention | mobile-accessibility, impeccable audit.native, detox (gestures, `setLocation`), agent-device (if approved) | Bash to drive simulators / emulators and inject offsets; screenshots; writes defect lists only |
| red-teamer | AC-10 and data-exposure attacks on our own test accounts | owasp-mobile-code-review + MASTG, owasp-api-security-review, ios-device-integrity (to know what attestation proves), Trail of Bits skills (guide), OWASP prompt-injection-test for AI-01 | Bash with an intercepting proxy and mock-location tools against local or staging hosts only; never production; writes findings only |
| card-author | Writes game cards (O-65) and crew-line copy per language | humaniseur-fr (FR), humanizer (EN), design:ux-copy | Fresh context with `VOICE.md` + `SLOP.md`; writes content files only |
| critical-friend | Cuts cards and copy ruthlessly; challenges specs and plans | doubt-driven-development, idea-refine, ln-11-plan-reviewer, humaniseur-fr | Read; writes cut lists and comments only |
| qa | Unit, integration, e2e, SYNC-08 chaos, "real night" | ln-41-test-strategy-planner, ln-42-acceptance-test-builder, detox, webapp-testing, systematic-debugging, verification-before-completion, powersync debug guidance | Bash for test runners, simulators, network shaping; writes tests and reports |
| i18n-reviewer | FR and EN native, plurals, formats, units, long German strings | humaniseur-fr, humanizer-en-asd-ste100, impeccable clarify, CLDR / FormatJS docs (guide) | Read; Bash for pseudo-localisation and string lint; no Edit on code |
| accessibility-reviewer | VoiceOver / TalkBack, Dynamic Type, contrast, Reduce Motion | mobile-accessibility, design:accessibility-review, impeccable audit.native, swm animations-performance (reduced motion) | Read; Bash for Accessibility Inspector / Accessibility Scanner runs and large-font screenshots; no Edit |

Two extra roles the method implies: **architect** (ln-71/73/74/75, codebase-design, api-and-interface-design; writes `docs/adr/`) and **security-reviewer** (security-review, security-and-hardening, owasp-*; SEC-09 calls for one).

## 4. Assumptions

- A-SKILLS-1: React Native + Expo is the likely stack. Based on S2M's own stack and the RN skill ecosystem. Verify: Architect ADR.
- A-SKILLS-2: PolyForm Perimeter allows our use of the dpearson skills because we do not ship a competing skill collection. Based on the licence text ("any purpose except providing to others any product that competes"). Verify: orchestrator or user reading of the licence.
- A-SKILLS-3: Voltra supports tappable widget actions (add a drink) on iOS and Android. Not stated in the skill. Verify: use-voltra.dev docs and a spike.
- A-SKILLS-4: Removing the telemetry and script sections from a skill keeps the rest working. Based on reading the files: those sections are self-contained. Verify: run the edited skill once.
- A-SKILLS-5: `runOnJS` is deprecated (not removed) in Reanimated 4. Two staged files disagree. Verify: Reanimated changelog for the installed version.

## 5. Scope changes

- Proposed SLOP-09 [P0]: native anti-slop lint. Impeccable's detector only reads HTML/CSS, so SLOP-08 needs a custom rule set for our UI code (gradient text, glow, nested cards, raw hex, emoji icons, pulsing dots without state). Reason: no existing detector covers RN / SwiftUI / Compose.
- Proposed change to HUB-02: state the iOS 8-hour Live Activity limit and the restart strategy for long nights and trips (O-40). Reason: ActivityKit lifetime.
- No missing IDs otherwise.

## 6. Glossary additions

- `AgentSkill` / skill (dev-only, no FR UI term): a `SKILL.md` package an agent loads.
- `SkillCandidate` / staged candidate (dev-only): a vetted copy waiting in `research/skill-candidates/`.

## 7. Blockers

None. Installing candidates waits on the orchestrator's review, not on the user.

## 8. Sources

All read on 2026-10-26. Repo metadata (licence, stars, HEAD commit) from the GitHub API the same day.

- https://github.com/pbakaus/impeccable and https://impeccable.style/slop
- https://github.com/samber/cc-skills (humaniseur-fr, humanizer-en-asd-ste100, frontend-design-deslop)
- https://github.com/blader/humanizer
- https://github.com/conorbronsdon/avoid-ai-writing
- https://github.com/anthropics/skills
- https://github.com/addyosmani/agent-skills, https://github.com/obra/superpowers, https://github.com/vercel-labs/agent-skills
- https://github.com/expo/skills and https://docs.expo.dev/skills/
- https://github.com/callstackincubator/agent-skills, https://www.callstack.com/blog/announcing-react-native-best-practices-for-ai-agents
- https://github.com/callstackincubator/voltra, https://www.use-voltra.dev, https://callstack.com/blog/live-activities-and-widgets-with-react-say-hello-to-voltra
- https://github.com/callstack/agent-device
- https://github.com/software-mansion-labs/skills
- https://github.com/dpearson2699/swift-ios-skills
- https://github.com/AvdLee/SwiftUI-Agent-Skill, https://github.com/twostraws/SwiftUI-Agent-Skill (not staged)
- https://github.com/android/skills, https://github.com/chrisbanes/skills, https://github.com/new-silvermoon/awesome-android-agent-skills
- https://github.com/flutter/agent-plugins
- https://github.com/powersync-ja/agent-skills, https://docs.powersync.com/tools/ai-tools
- https://github.com/supabase/agent-skills
- https://github.com/electric-sql/electric, https://github.com/rocicorp/mono, https://github.com/rocicorp/replicache (archived), https://github.com/Nozbe/WatermelonDB
- https://github.com/maplibre/maplibre-agent-skills, https://github.com/maplibre/maplibre-react-native, https://github.com/mapbox/mapbox-agent-skills
- https://github.com/OWASP/secure-agent-playbook, https://github.com/OWASP/mastg, https://github.com/OWASP/masvs, https://mas.owasp.org
- https://github.com/dweinstein/mobile-security-skills (no licence)
- https://github.com/trailofbits/skills
- https://github.com/Community-Access/accessibility-agents
- https://github.com/LambdaTest/agent-skills
- https://github.com/mobile-dev-inc/Maestro, https://github.com/wix/Detox
- https://github.com/tovimx/maestro-mobile-testing-skill (no licence), https://www.skills.sh/builderio/builder-agent-skills/mobile-testing/security/agent-trust-hub (risk report)
- https://github.com/emilkowalski/skills
- https://github.com/getsentry/sentry-for-ai, https://github.com/getsentry/skills
- https://github.com/VoltAgent/awesome-agent-skills
- https://www.asd-ste100.org (referenced by humanizer-en-asd-ste100)
- Official docs listed in `SKILLS.md` (Apple HIG, ActivityKit, WidgetKit, CLLocationSourceInformation, Material 3, Glance, Location.isMock, Play Integrity, FormatJS, i18next, Lingui, MessageFormat 2, CLDR, WCAG 2.2, React Native accessibility): cited as guides, URLs recorded, content not re-verified in this report.
