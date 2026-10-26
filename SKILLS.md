# SKILLS.md

Agent skills, guides and methods per phase. Built by Recon-Skills on 2026-10-26. Detail, risks and the agent roles are in `research/skills.md`.

Status values:
- **already available**: installed on this machine under `~/.claude/skills/` or as a plugin. Not re-audited here unless noted.
- **staged candidate**: text files copied to `research/skill-candidates/<name>/` at the pinned commit, read in full, waiting for orchestrator review. Nothing is in `.claude/skills/` yet.
- **guide only**: official docs or a skill we cite but do not install (no licence, web-only, scripts required, or stack not chosen yet).

The stack is not chosen (`<stack>`). React Native + Expo is the most likely option, so RN skills are staged first. Widgets, Live Activities, App Intents and Glance need native Swift / Kotlin whatever the stack, so native skills are staged too. Flutter and fully native options are covered by "guide only" rows.

Rule for every staged skill: the project files win on conflict (`PROMPT.md`, `design/DESIGN.md`, `MOTION.md`, `VOICE.md`, `SLOP.md`). Several skills carry defaults that contradict them (SF Symbols, system font, sub-300 ms rule, em dashes allowed); see `research/skills.md` section 2.4.

## 1. Architecture

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| codebase-design, improve-codebase-architecture | `~/.claude/skills/` | installed | n/a | already available | Module boundaries, deep modules, no god files (`<engineering_standards>`) |
| ln-71 / ln-73 / ln-74 / ln-75 / ln-76 (baseline, design proposal, ADR, diagram, migration) | `~/.claude/skills/` | installed | n/a | already available | Architect's ADR set in `docs/adr/`, including the options not picked |
| documentation-and-adrs, api-and-interface-design, spec-driven-development | addyosmani/agent-skills (installed copy) | installed (upstream aeac41d) | MIT | already available | ADRs, API contracts, `specs/<ID>.md` |
| database-schema-designer, database-designer | `~/.claude/skills/` | installed | n/a | already available | Data model named after `<glossary>` |
| expo-overview, expo-project-structure | github.com/expo/skills | d5caf7f | MIT | guide only | Official Expo layout if Expo is picked; stage after the ADR |
| callstack assess-react-native-migration, upgrading-react-native | github.com/callstackincubator/agent-skills | 59e9d17 | MIT | guide only | Upgrade path for a 2-year horizon |
| flutter/agent-plugins | github.com/flutter/agent-plugins | default branch, 2026-10-21 | BSD-3-Clause | guide only | Evidence for the Flutter option in the stack ADR |

## 2. Design system

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| design:design-system, design:design-handoff, design:design-critique | design plugin (installed) | installed | n/a | already available | Port `design/tokens.json` and components with every state |
| figma:* (figma-implement-motion, figma-swiftui, figma-generate-library...) | figma plugin (installed) | installed | n/a | already available | Only if boards move to Figma; the source of truth stays `design/` |
| impeccable (native subset) | github.com/pbakaus/impeccable | v4.7.1, 6743a34 | Apache-2.0 | staged candidate | `audit.native`, `adapt.native`, `ios`, `android`, `polish`, `typeset`, `colorize`, `layout` references for native screens |
| expo-design-system, expo-ui, expo-native-ui | github.com/expo/skills | d5caf7f | MIT | guide only | Native controls from Expo if picked |
| Apple HIG, Material 3 | developer.apple.com/design/human-interface-guidelines, m3.material.io | read 2026-10-26 | n/a | guide only | Platform rules the design deviates from only through an ADR |

## 3. Motion

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| swm-react-native-best-practices (animations + gestures subset) | github.com/software-mansion-labs/skills | 58afa0a | MIT | staged candidate | Reanimated 4, Gesture Handler, 120 fps, reduced motion, from the library authors |
| expo-animation | github.com/expo/skills (by Emil Kowalski) | 1.0.0, d5caf7f | MIT | staged candidate | Decision order, spring configs, haptic timing, "never ship" table |
| emil-review-animations | github.com/emilkowalski/skills | 2d22863 | MIT | staged candidate | Base method for the motion reviewer (block / approve, findings table) |
| swm-pulsar-haptics | github.com/software-mansion-labs/skills | 58afa0a | MIT | staged candidate | Haptic vocabulary (MOT-01), realtime haptics for games |
| impeccable `animate.md` | pbakaus/impeccable | 6743a34 | Apache-2.0 | staged candidate | One authored moment, no decorative motion |
| emilkowalski animate-expo, animation-vocabulary, apple-design | github.com/emilkowalski/skills | 2d22863 | MIT | guide only | Overlap with expo-animation; read when writing `MOTION.md` |
| chrisbanes compose-animations, dpearson swiftui-animation | github.com/chrisbanes/skills, github.com/dpearson2699/swift-ios-skills | 183cfc9, 8d90fd1 | Apache-2.0, PolyForm Perimeter | guide only | Only if the stack is native |
| Reanimated, Gesture Handler, Skia docs | docs.swmansion.com, shopify.github.io/react-native-skia | read 2026-10-26 | n/a | guide only | Current APIs |

## 4. Games

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| swm gestures (multi-touch, `onTouchesDown`, track by touch id) | software-mansion-labs/skills | 58afa0a | MIT | staged candidate | Le Doigt (O-60), Gribouille strokes (O-63) |
| swm canvas-animations, gpu-animations, audio | software-mansion-labs/skills | 58afa0a | MIT | guide only | Bomb particles, roulette, sound pack (JOY-05); stage when the games phase starts |
| humaniseur-fr + humanizer (cards) | see section 10 | | | staged / available | 500+ cards per language (O-65) without AI tells |
| openai develop-web-game | officialskills.sh | n/a | n/a | guide only | Web-only; rejected for native games |

No vetted game-design skill exists. Each game agent researches rules itself (`<method>` Recon-Games).

## 5. Real time

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| powersync (SKILL, AGENTS, overview, RN SDK, custom backend) | github.com/powersync-ja/agent-skills | 1.6.4, af04e2e | MIT | staged candidate | Official skill; sync streams, upload queue rules, logout data clearing |
| supabase, supabase-postgres-best-practices | github.com/supabase/agent-skills | c9be0e9 | MIT | guide only | Stage only if Supabase is picked (EU region, RLS) |
| electric-* skills (shapes, proxy-auth, postgres-security) | github.com/electric-sql/electric | 3f9809f | Apache-2.0 | guide only | Alternative sync engine for the ADR |
| Zero (rocicorp/mono) | github.com/rocicorp/mono, zero.rocicorp.dev | 945ce61 | Apache-2.0 | guide only | Alternative; Replicache repo is archived |
| Supabase Realtime, Phoenix channels docs | supabase.com/docs/guides/realtime | read 2026-10-26 | n/a | guide only | Live dashboard, Gribouille, presence |

## 6. Offline

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| powersync (same as above) | powersync-ja/agent-skills | af04e2e | MIT | staged candidate | Persistent mutation queue, never 4xx in upload, `disconnectAndClear()` |
| WatermelonDB docs | github.com/Nozbe/WatermelonDB | 2026-09-16 | MIT | guide only | Offline-first alternative with custom sync |
| expo native-data-fetching | expo/skills | d5caf7f | MIT | guide only | Caching and offline basics |
| Replicache | github.com/rocicorp/replicache | archived 2022 | none in repo | guide only | Rejected: archived |

## 7. Widgets

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| voltra | github.com/callstackincubator/voltra | 2.0.0, 58f0fd4 | MIT | staged candidate | iOS widgets, Live Activities and Android widgets in JSX from RN |
| ios-widgetkit | github.com/dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter 1.0.0 | staged candidate | Interactive widgets (O-33), Lock Screen (HUB-03), Control Center (QOL-04), refresh budget |
| ios-app-intents | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter 1.0.0 | staged candidate | Add-a-drink buttons, Siri, Action Button, controls (QOL-01, QOL-04) |
| android-glance-canonical-layouts | github.com/android/skills | 4ebabf2 | Apache-2.0 | staged candidate (partial) | Official Glance layouts; Kotlin sample files not staged |
| android/skills wear-widgets, wear-compose-m3 | android/skills | 4ebabf2 | Apache-2.0 | guide only | Watch (HUB-04) |
| Expo widgets (expo-widgets), @bacons/apple-targets | docs.expo.dev/versions/latest/sdk/widgets, github.com/EvanBacon/expo-apple-targets | read 2026-10-26 | MIT | guide only | Alternatives to Voltra for the ADR |

## 8. Live Activities

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| ios-activitykit | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter 1.0.0 | staged candidate | Lifecycle, push-to-update, push-to-start, 8 h active limit, stale date |
| voltra (ios-live-activities, push-flow, android-ongoing-notifications) | callstackincubator/voltra | 58f0fd4 | MIT | staged candidate | Same surfaces from RN; Android persistent notification (HUB-02) |
| ActivityKit docs | developer.apple.com/documentation/activitykit | read 2026-10-26 | n/a | guide only | Source of truth for limits and budgets |
| Android progress-centric notifications (Live Updates, Android 16) | developer.android.com/develop/ui/views/notifications | read 2026-10-26 | n/a | guide only | Android side of HUB-02 |

## 9. Maps

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| maplibre-agent-skills (cartography, tile-sources, pmtiles, sprites-icons) | github.com/maplibre/maplibre-agent-skills | 61ae80f | MIT | guide only | Official, but written for MapLibre GL JS; styles and tiles apply to MapLibre Native |
| mapbox-agent-skills (ios-patterns, android-patterns, token-security, cartography) | github.com/mapbox/mapbox-agent-skills | f71cd72 | MIT | guide only | If Mapbox is picked; token-security applies either way |
| MapLibre React Native | github.com/maplibre/maplibre-react-native | 2026-10-21 | MIT | guide only | Library docs for the territory map (TER-01) |
| dpearson mapkit | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | guide only | Native iOS option |

## 10. Location anti-spoofing

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| expo-module | github.com/expo/skills | 1.0.0, d5caf7f | MIT | staged candidate | Native module to read `CLLocation.sourceInformation` and `Location.isMock()` (AC-02), BLE handshake (AC-04) |
| CLLocationSourceInformation, Location.isMock() | developer.apple.com/documentation/corelocation/cllocationsourceinformation, developer.android.com/reference/android/location/Location#isMock() | read 2026-10-26 | n/a | guide only | Official flag semantics |
| OWASP MASTG, MASVS-RESILIENCE | mas.owasp.org | MASVS v2.1.0 | CC-BY-SA-4.0 | guide only | Detection and bypass techniques to design around |
| dpearson core-bluetooth, core-nfc | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | guide only | Cheers handshake (JOY-01, AC-04) |
| dweinstein resilience-assessment | github.com/dweinstein/mobile-security-skills | cb7ce51 | no licence | guide only | Useful checklist; cannot be copied |

## 11. App integrity

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| ios-device-integrity | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter 1.0.0 | staged candidate | App Attest and DeviceCheck client and server checks, gradual rollout (AC-05) |
| owasp-mobile-code-review | github.com/OWASP/secure-agent-playbook | 65d4efd | CC-BY-4.0 | staged candidate (thin) | MASVS v2.1.0 review procedure; needs MASVS/MASTG data it points to |
| Play Integrity API | developer.android.com/google/play/integrity | read 2026-10-26 | n/a | guide only | Android side of AC-05 |
| security-review, security-and-hardening, security-guardian, skill-security-auditor | `~/.claude/skills/` | installed | n/a | already available | General hardening, secrets, skill audits |

## 12. Notifications

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| voltra android-ongoing-notifications, push-flow | callstackincubator/voltra | 58f0fd4 | MIT | staged candidate | Persistent party notification, APNs flow |
| ios-app-intents (actionable surfaces) | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | staged candidate | Actions from the notification (QOL-03) |
| dpearson push-notifications | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | guide only | Notification Service Extension for encrypted payloads (MSG-04) |
| Expo Notifications, FCM, APNs docs | docs.expo.dev/versions/latest/sdk/notifications, firebase.google.com/docs/cloud-messaging | read 2026-10-26 | n/a | guide only | Delivery, channels, grouping |

## 13. AI

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| claude-api | built-in skill | installed | n/a | already available | Swappable provider ADR, caching, cost limits (AI-01 to AI-03) |
| swm on-device-ai (ExecuTorch, speech) | software-mansion-labs/skills | 58afa0a | MIT | guide only | Local fallback parser and voice input without sending data (AI-01, MSG-09) |
| dpearson apple-on-device-ai, android ml-kit-genai-prompt-api | dpearson2699/swift-ios-skills, android/skills | 8d90fd1, 4ebabf2 | PolyForm Perimeter, Apache-2.0 | guide only | On-device options |
| OWASP llm-risk-assess, prompt-injection-test | OWASP/secure-agent-playbook | 65d4efd | CC-BY-4.0 | guide only | Red-team the AI input parser |

## 14. Human-sounding writing

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| humanizer | `~/.claude/skills/synced/.../humanizer` (older 24-pattern copy) | installed, no version | n/a | already available | EN de-slop; upstream blader/humanizer is now v3.1.0 (8c307f3, MIT): worth an update review |
| humaniseur-fr | github.com/samber/cc-skills | 1.1.3, 123cb15 | MIT | staged candidate | French tells: "crucial", "également", anglicisms, guillemets, sentence-length dispersion |
| humanizer-en-asd-ste100 | samber/cc-skills | 1.0.2, 123cb15 | MIT | staged candidate | ASD-STE100 for functional text (errors, SOS, legal), required by `<writing_patterns>` |
| design:ux-copy, writing-guidelines | installed | installed | n/a | already available | Microcopy, errors, empty states |
| avoid-ai-writing | github.com/conorbronsdon/avoid-ai-writing | 209815c | MIT | guide only | Second EN catalogue for Recon-Voice |
| Wikipedia Signs of AI writing (EN and FR pages) | en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing | read via skills, 2026-10-26 | CC BY-SA | guide only | Primary source, read by Recon-Voice |

## 15. Non-template design

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| impeccable (craft-floor, quieter, distill, bolder, delight, clarify, shape) | pbakaus/impeccable | v4.7.1, 6743a34 | Apache-2.0 | staged candidate | Bans the tells listed in `<design_patterns>`; native audit; detector itself is web-only |
| frontend-design | anthropics/skills, claude-plugins-official | installed 1.1.0 | Apache-2.0 | already available | Distinct, non-default choices |
| design-review, design:design-critique, web-design-guidelines | installed | installed | n/a | already available | Second reviewer view |
| mobile-ux-optimizer, ui-designer plugins | installed plugins | installed | n/a | already available | Not re-audited; use only as extra opinion |
| emil-mobile-native | emilkowalski/skills | 2d22863 | MIT | staged candidate | Web only: the invitation page (N-30) and link previews (QOL-05) |
| samber frontend-design-deslop | samber/cc-skills | 123cb15 | MIT | guide only | Web-oriented slop checklist; overlap with Impeccable |

## 16. Testing

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| test-driven-development, systematic-debugging, verification-before-completion | obra/superpowers (installed copy) | installed (upstream 2ce8aa1) | MIT | already available | Unit tests for BAC, scoring, anti-cheat, splitting |
| ln-41-test-strategy-planner, ln-42-acceptance-test-builder, ln-23-test-suite-auditor | installed | installed | n/a | already available | SYNC-08 matrix, e2e per P0 flow |
| webapp-testing, playwright plugin | installed | installed | Apache-2.0 | already available | Invitation web page (N-30), admin tools |
| detox | github.com/LambdaTest/agent-skills | 1.0, 992638b | MIT | staged candidate | Gray-box RN e2e, `device.setLocation` for spoofing tests; skip the vendor-cloud section |
| callstack agent-device | github.com/callstack/agent-device | 840f9c4 | MIT | guide only | CLI that lets agents drive simulators; strong fit for the drunk-mode tester; tool, not staged |
| Maestro docs | docs.maestro.dev, github.com/mobile-dev-inc/Maestro | 0df4cf3 | Apache-2.0 | guide only | No official skill; community ones lack a licence or pipe a remote script to the shell |

## 17. Performance

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| callstack-react-native-best-practices (SKILL + 5 refs) | callstackincubator/agent-skills | 59e9d17 | MIT | staged candidate | Measure, fix, re-measure; FPS, TTI, lists, Reanimated |
| swm animations-performance | software-mansion-labs/skills | 58afa0a | MIT | staged candidate | 120 fps flag, simultaneous animation limits, release-build profiling |
| performance-optimization, ln-31-performance-optimizer, ln-34-benchmark-comparator | installed | installed | n/a | already available | Generic method |
| android/skills jetpack-compose-performance, android-profiler, anr-audit-and-fix | android/skills | 4ebabf2 | Apache-2.0 | guide only | Native Android profiling |
| dpearson ios-ettrace-performance, metrickit, debugging-instruments | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | guide only | Native iOS profiling, battery |
| Flashlight | github.com/bamlab/flashlight | read 2026-10-26 | MIT | guide only | Android FPS score in CI |

## 18. Accessibility

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| mobile-accessibility | github.com/Community-Access/accessibility-agents | decf6ba | MIT | staged candidate | RN / SwiftUI / Compose props, touch targets, live regions |
| design:accessibility-review, frontend-ui-engineering | installed | installed | n/a | already available | Review checklists |
| impeccable audit.native | pbakaus/impeccable | 6743a34 | Apache-2.0 | staged candidate | Scores VoiceOver, Dynamic Type, Reduce Motion, insets |
| dpearson ios-accessibility, new-silvermoon android-accessibility | dpearson2699/swift-ios-skills, github.com/new-silvermoon/awesome-android-agent-skills | 8d90fd1, 82900ea | PolyForm Perimeter, Apache-2.0 | guide only | Native details |
| WCAG 2.2, RN accessibility docs | w3.org/TR/WCAG22, reactnative.dev/docs/accessibility | read 2026-10-26 | n/a | guide only | Criteria |

## 19. i18n

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| humaniseur-fr, humanizer-en-asd-ste100 | samber/cc-skills | 123cb15 | MIT | staged candidate | Each language gets its own voice check (SLOP-03) |
| impeccable clarify, harden | pbakaus/impeccable | 6743a34 | Apache-2.0 | staged (clarify) / guide (harden) | Complete translatable messages, no concatenation, plural-ready variables |
| FormatJS / ICU MessageFormat, i18next, Lingui, MessageFormat 2 | formatjs.github.io, i18next.com, lingui.dev, messageformat.unicode.org | read 2026-10-26 | MIT / Unicode | guide only | Library choice goes in an ADR; no vetted skill exists for any of them |
| CLDR plural rules, Expo Localization | cldr.unicode.org, docs.expo.dev/guides/localization | read 2026-10-26 | Unicode | guide only | Plurals (QOL-12), device locale (PREF-02) |
| dpearson ios-localization, swift-formatstyle | dpearson2699/swift-ios-skills | 8d90fd1 | PolyForm Perimeter | guide only | Native string catalogs and formatters |

## Also relevant across phases

| Name | Source | Version / commit | Licence | Status | Why |
|---|---|---|---|---|---|
| owasp-api-security-review | OWASP/secure-agent-playbook | 65d4efd | CC-BY-4.0 | staged candidate (thin) | API Top 10 2023: BOLA, BOPA, mass assignment (SEC-01, SEC-02, PROF-08) |
| code-review-and-quality, requesting-code-review, receiving-code-review, doubt-driven-development | installed | installed | MIT | already available | Review loop and critical friend |
| writing-plans, subagent-driven-development, dispatching-parallel-agents | installed | installed | MIT | already available | Orchestration |
| vercel-react-native-skills | installed (vercel-labs/agent-skills) | 1.0.0 | MIT | already available | Overlaps swm and callstack; pick one primary RN skill to avoid conflicting advice |
| react-native (installed) | `~/.claude/skills/react-native` | installed | n/a | already available | Older generic RN guide; superseded by swm + callstack |
| getsentry sentry-react-native-sdk | github.com/getsentry/sentry-for-ai | skills-legacy path, 2026-10-23 | MIT | guide only | Crash reporting without personal data (observability standard) |
