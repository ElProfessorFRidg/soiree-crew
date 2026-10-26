# Stack inputs from phase 0

Every constraint and finding from the recon reports that the Architect must weigh in the stack ADR (`<stack>` in `PROMPT.md`). Facts only; each line names its source. "UNVERIFIED" and "[U]" flags are kept from the reports. No recon report covered maps and places on its own; the inputs below on that topic are scattered, and the gap is itself an input.

## 1. What the reports already say about the choice

- Motion favours native SwiftUI + Compose: it is the only stack where every DESIGN.md motion row maps to a stable first-party API. If cross-platform is chosen, React Native (Reanimated 4 + Gesture Handler 3 + Skia + Pulsar) keeps native sheets, navigation and system springs on iOS; Flutter wins frame pacing on a modest Android and deterministic golden tests, but rebuilds iOS system motion. All 27 DESIGN.md §5 motion rows are feasible in all three stacks. (motion.md §1 item 8, §3.2.2)
- Widgets, Live Activities, Controls, App Intents, Quick Settings tiles and Android Live Updates are native code whatever the stack. Expo now ships `expo-widgets` (iOS widgets + Live Activities with push tokens, Android widgets opt-in, 58.0.23, 2026-10-23) and `expo-app-intents` (alpha), which removes "widgets" as an argument against RN/Expo. (polish.md §1 item 8, §3 decision 10)
- React Native + Expo is the likely stack (S2M's own stack, RN skill ecosystem); assumption, not a decision. (skills.md A-SKILLS-1; SKILLS.md intro)
- Phone-to-phone BLE needs a native module whatever the stack: no maintained RN library supports the peripheral role. (anticheat.md §1 item 3, §3 decision 5)
- Score Voltra vs `expo-widgets` vs hand-written WidgetKit / Glance with two pass/fail criteria: interactive add-a-drink button without opening the app, and no double counting. (skills.md §3 decision 4)
- Flutter specifics: `live_activities` renders Android with RemoteViews, which disqualifies it from Android Live Update promotion; `flutter_app_intents` 0.7.0 is young; core haptics API is basic; `flutter_animate` is stale (about 23 months); Material 3 Expressive motion is unavailable for Flutter. (polish.md §1 item 3, §1 item 8; motion.md §2.2)

## 2. Motion and rendering

- One spring table drives every stack: `stiffness = (2π / duration)²`, `dampingRatio = 1 − bounce`, `mass = 1`; Reanimated must use physics mode, not its `duration` mode (A-MOTION-1). (motion.md §3.1)
- Android: never `MotionScheme.expressive()` as is (bounce 0.2 to 0.4 by default); use a custom MotionScheme. (motion.md §1 item 3)
- Shared-element transitions (MOT-05): stable in SwiftUI (iOS 18 zoom) and Compose (1.10+); experimental in Reanimated 4.2 (flag, native-stack only); Expo Router `Link.AppleZoom` alpha, iOS only; Flutter `Hero` mature. (motion.md §2.2, §3.2.1)
- React Native: about 100 simultaneously animated components on low-end Android; particles must use Skia `Atlas`; New Architecture regressions need flags and RN 0.80 to 0.82+, Reanimated 4.2+. (motion.md §2.2)
- 120 Hz: `CADisableMinimumFrameDurationOnPhone` (default in the RN 0.82 template); Android adaptive refresh rate (15 QPR1+) with Compose `preferredFrameRate`. (motion.md §2.1)
- Real multi-touch for Le Doigt (O-60): SwiftUI needs a UIKit wrapper (A-MOTION-10); Compose, Gesture Handler 3 and Flutter expose every pointer. (motion.md §3.2.1)
- Haptics: full on native; Pulsar on RN (dev builds, not Expo Go; Android composition API 30+, envelopes API 36+); plugins or own channel on Flutter. iOS haptics are silent in Low Power Mode and suppressed during microphone recording unless allowed (A-MOTION-5). (motion.md §2.2, §3.3; polish.md §2.4 R7)
- Living background: on demand, 30 Hz or less, at most 40 sprites in one draw call; budget under 2 % CPU on the modest Android (A-MOTION-6). (motion.md §3.4)
- Testing needs a global motion time scale in our own motion layer (proposed MOT-14), because Reanimated, Skia, Rive and custom clocks do not follow one OS switch; Compose and Flutter offer deterministic clocks, SwiftUI does not. (motion.md §3.2.1, §3.6)
- Rive RN runtime is Nitro-based (RN 0.78+, iOS 15.1+, SDK 24+). (motion.md §2.2)

## 3. Out-of-app surfaces

- Widget, Control and Siri code runs outside the JS/Dart runtime; actions that arrive while JS is down wait in a queue. A native shared queue, native idempotency keys and a native HTTPS send are needed (proposed QOL-25), and SYNC-01/06 must cover them (A-POLISH-1). (polish.md §1 item 1, §2.4 R1)
- Live Activity: 8 h active, 12 h on the Lock Screen, 4 KB of data; renewal through push-to-start (iOS 17.2+) for nights over 8 h (proposed QOL-26, A-POLISH-2); hourly push budget, priority 5 for routine updates; broadcast channels cannot start activities and need a developer-portal capability. (polish.md §2.1; skills.md §2.2)
- Widgets: about 40 to 70 reloads a day, entries at least about 5 min apart; button taps do not count; `Text(timerInterval:)` renders countdowns without reloads. Android: `updatePeriodMillis` at most every 30 min, WorkManager 15 min, FCM immediate. (polish.md §2.1, §2.2 QOL-12)
- Android Live Updates: ongoing, user-initiated, time-sensitive, not RemoteViews, not triggered by other people; OEMs may add criteria (A-POLISH-3). (polish.md §1 item 3)
- Android voice: Assistant App Actions are gone from phones since September 2026; AppFunctions experimental (Android 16+). Siri: at most 10 App Shortcuts, app name in every phrase. (polish.md §1 items 4 and 5)
- Quick Settings tile (`TileService`), launcher shortcuts (4 visible), iOS 18 `ControlWidget`: native modules. (polish.md §2.2 QOL-04)
- Watch (HUB-04, P2): watchOS / Wear OS app or complication. (design-a.md §2.4 screen 4; SKILLS.md §7)

## 4. Native modules needed whatever the stack

- "ProximityHandshake": BLE peripheral + GATT server (iOS `CBPeripheralManager`, Android `BluetoothLeAdvertiser` + `BluetoothGattServer`). (anticheat.md §2.3, proposed AC-13)
- "LocationIntegrity": `isProducedByAccessory` and raw source flags; `expo-location` exposes only `mocked`. (anticheat.md §2.1, proposed AC-13)
- UWB (Nearby Interaction) for JOY-01 proximity on capable iPhones. (polish.md §2.2 JOY-01)
- Native fast path for out-of-app actions (QOL-25), Controls, Quick Settings tile, Android Live Update builder. (polish.md §2.2)
- iOS Notification Service Extension that runs MLS decryption with a cross-process lock on the App Group state (A-SEC-4). (security.md §2.3)
- iMessage sticker extension and WhatsApp content provider (JOY-10). (polish.md §2.2 JOY-10)
- Snapchat Creative Kit and TikTok Share Kit integrations (the RN Snap binding dates from 2022). (polish.md §2.2 QOL-06)
- Android group summaries for FCM data messages (Notifee last released 2024-12, A-POLISH-12). (polish.md §2.2 QOL-03)

## 5. End-to-end encryption library and bindings

- MLS (RFC 9420) via OpenMLS (MIT, 0.9.2, 2026-10-22) for every conversation, 1:1 included; mls-rs (Apache-2.0 OR MIT) as fallback; libsignal rejected (AGPL-3.0, "use outside of Signal is unsupported", App Store GPL conflict) unless the user picks AGPL (open-decisions D-08). (security.md §2.1)
- OpenMLS is Rust: mobile targets built in CI but not tested (A-SEC-1). Bindings are ours to write: one internal crate `crew-crypto` exposed through UniFFI (Swift, Kotlin) or `uniffi-bindgen-react-native` (MPL-2.0, 0.31 pre-1.0); Flutter `openmls_dart` is very young. (security.md §2.1)
- No public full audit of OpenMLS; budget an external audit of our integration (A-SEC-2, proposed SEC-14). (security.md §2.1)
- Server: an ordered Delivery Service that serialises commits per group, blind to content. (security.md §2.1)
- Push: generic payload, NSE decryption, filtering entitlement for silent control messages; FCM data-only messages must end in a visible notification (A-SEC-5). (security.md §2.3)
- Licence policy for the client: no GPL or AGPL (cargo-deny + JS licence checker). (security.md §2.11)

## 6. Location, anti-cheat and attestation

- iOS `isSimulatedBySoftware` flags only Core Location's own simulation (Apple DTS, October 2025); Android `isMock()` is useful but hidden on rooted devices. Neither decides alone. (anticheat.md §1 items 1 and 2)
- `expo-location` `mocked` maps both flags (verified in source); `@expo/app-integrity` wraps App Attest, Play Integrity Standard and Android key attestation; production readiness to check at the chosen SDK (A-AC-1). (anticheat.md §1 item 3)
- Play Integrity: Android 13+ hardware-backed `MEETS_DEVICE_INTEGRITY` since May 2025; never require STRONG; quota 10,000 requests a day by default, so calls are rationed (session start, check-in, sync batch). App Attest is not jailbreak detection. (anticheat.md §1 items 4 and 5, §3 decisions 3 and 4)
- Root / jailbreak heuristics: `jail-monkey` class at low weight; freeRASP pending a GDPR review (open-decisions D-12). (anticheat.md §3 decision 6)
- Offline signing: App Attest assertions and Android Keystore keys sign events locally (A-AC-7, A-AC-8); monotonic clock and boot ID needed on both platforms (A-AC-6). (anticheat.md §2.6)
- IP geolocation at country level only (France: 51 % of IPs within 50 km). (anticheat.md §1 item 6)
- Geofences: iOS 20 monitored conditions, Android 100; a venue geofence during a live party probably needs iOS "Always" location (A-TER-2). (polish.md §2.1; territories.md A-TER-2)
- Android 15+: `dataSync` foreground services limited to 6 h per 24 h; a `location` foreground service needs its own permission. (polish.md §2.1)

## 7. Bluetooth, NFC, UWB

- iOS advertising carries only local name and service UUIDs; in the background, no local name and UUIDs in the overflow area that only iOS can read (A-AC-5). Design: foreground, gesture-driven handshake with a phone-to-phone QR fallback. (anticheat.md §2.3)
- Android permissions: `BLUETOOTH_SCAN` (with `neverForLocation`), `BLUETOOTH_ADVERTISE`, `BLUETOOTH_CONNECT` on API 31+; iOS `NSBluetoothAlwaysUsageDescription`. (anticheat.md §2.3)
- iPhone NFC host card emulation is limited to payments, keys, transit, badges and tickets in the EEA, so no NFC phone-to-phone "cheers" on iPhone. (polish.md §2.4 R9)
- `react-native-ble-plx` is central only; `munim-bluetooth-peripheral` unevaluated; `flutter_blue_plus` exists. (anticheat.md §2.1; polish.md §2.2 JOY-01)

## 8. Offline sync, mutation queue, real time

- Event envelope: UUIDv7 idempotency key, per-install sequence, monotonic timestamps, `prev_hash` chain, nonce book, signature; offline events count for BAC and personal stats at once and score only after server checks. (anticheat.md §2.6; proposed AC-12)
- Scoring engine is server-authoritative and never receives drinks, grams, BAC or spending (territories); rule sets versioned in remote config and replayable. (territories.md §3, §3.2; anticheat.md §2.4)
- PowerSync's generic CRUD upload clashes with AC-01: uploads must go to command endpoints with per-object authorisation; never return 4xx from its upload endpoint (it blocks the queue); `disconnectAndClear()` on account switch (O-13). Alternatives listed: ElectricSQL, Zero, WatermelonDB, Supabase Realtime; Replicache archived. (skills.md §1, §2.2; SKILLS.md §5, §6)
- BAC engine must give the same number in app, widgets and backend from the same inputs (deterministic RK4, pure function), which means one shared implementation or a cross-checked port to widget code. (bac.md §2.1.3)
- Day-boundary logic must also run in widget code (`nightKey`). (polish.md §2.2 QOL-02)
- Real time: live dashboard, multi-phone Gribouille, La Courbe several-phones mode with a server-drawn crash point (hash commit) and a latency bound to set in the real-time ADR (A-GAMES-13). (games.md §2.4; PROMPT `<stack>`)

## 9. Local storage and device encryption

- Keychain (`AfterFirstUnlockThisDeviceOnly` so the NSE can read it), Android Keystore with a runtime security-level check; `androidx.security:security-crypto` is deprecated, do not use. (security.md §2.5)
- Encrypted local DB: SQLCipher; RN `op-sqlite` (SQLCipher support to confirm, A-SEC-12); Flutter Drift + SQLCipher; Realm not recommended. OpenMLS has a `sqlite-provider` feature. (security.md §2.5)
- Local DB and media cache excluded from iCloud and Google device backup (Apple 5.1.3(ii) on health data, proposed SEC-12); one DB and one key per account (O-13). (security.md §2.5)
- Drafts and failed sends persisted on every change (MMKV or SQLite on RN; Drift or shared_preferences on Flutter). (polish.md §2.2 QOL-07)

## 10. Auth

- Passkeys need the `webcredentials` associated domain (iOS) and Credential Manager (Android); `react-native-passkey` 3.6.2 exists. Supabase Auth passkeys are not production-ready (open iCloud bug, A-SEC-11); options: Keycloak, Ory Kratos, better-auth, SimpleWebAuthn, go-webauthn (permissive), Hanko and Zitadel (AGPL); Clerk unconfirmed for native passkeys. (security.md §2.6; polish.md §2.2 QOL-15)
- Sign in with Apple required once Google exists; Argon2id parameters if passwords are kept; short access tokens and device-bound rotating refresh tokens. (security.md §2.6)

## 11. Push and notifications

- `expo-notifications` covers categories, channels and badges; Android grouped rendering from FCM data messages needs native code; Flutter `flutter_local_notifications` 22.3.3 + `firebase_messaging`. (polish.md §2.2 QOL-03)
- Android: at most 3 actions, one sound per second, channels immutable once created (design the taxonomy before v1). iOS: interruption levels, `threadIdentifier`, 64 pending local notifications, critical alerts need an entitlement. (polish.md §2.1, §2.3)
- No readable content and no names in APNs / FCM payloads (US processors). (security.md §2.3)

## 12. i18n on Hermes and formatting

- Hermes lacks `Intl.PluralRules` and `Intl.RelativeTimeFormat` (and `Intl.Segmenter` is not listed): FormatJS polyfills (`@formatjs/intl-pluralrules` 6.3.16, `@formatjs/intl-relativetimeformat` 12.3.16), loaded for FR and EN only; a grapheme library for name truncation. (polish.md §1 item 8, §2.2 QOL-11 and QOL-12, §3 decision 9)
- No vetted skill for FormatJS, i18next, Lingui or MessageFormat 2: the library choice goes in an ADR from official docs. (skills.md §1; SKILLS.md §19)
- The SLOP-04 lint is written for Node 20+ (`\p{RGI_Emoji}` with the `v` flag) and Unicode-aware boundaries; port the patterns if the toolchain differs (A-VOICE-4). (SLOP.md §10.1; voice.md §1)
- French typography (U+202F, U+00A0, « », ’) must be supported by the font (A-VOICE-6). (voice.md §3 decision 5)
- Locale formats: CLDR for currency, week start, 12 / 24 h (Portugal and Algeria week starts, 12 h in US, CA-en, AU, NZ, TN, DZ). (bac.md §2.4.2)

## 13. Maps, places, geospatial

- No Recon-Maps report exists; territories.md (A-TER-6) and anticheat.md (A-AC-4) defer to one. The stack ADR has to cover the map SDK and the places provider.
- Needed: a stable external place ID for venue validation (TER-11); vetted licensed public venues only for public pages (COM-15); per-venue radius overrides (75 m default); takeover overlay animations on the map layer. (territories.md §3.7 case F; community.md §2.2.2; anticheat.md §2.2; motion.md §3.2.2)
- "Nearby" is computed on the device from venue coordinates; the server never computes or filters on the distance between two people. (community.md §2.2.3, decision D5)
- Geospatial queries only on venues; user points are never kept beyond the live session. (security.md §2.4)
- Skill and doc candidates: MapLibre Native / MapLibre React Native, Mapbox (token security), MapKit. (SKILLS.md §9)

## 14. Media, sharing, deep links

- System photo picker only (Play policy since 28 May 2025); HEIC converted on the device; EXIF stripped on the device and on the server (A-POLISH-7). (polish.md §2.2 QOL-09)
- Firebase Dynamic Links is shut down (25 Aug 2025): own Universal Links / App Links, deferred deep linking through Play Install Referrer plus an invite code on iOS, or a paid provider (Adjust, Branch, AppsFlyer). (polish.md §2.1, §3 decision 8)
- Share assets rendered on the server (9:16 1080 x 1920, sticker PNG, 1200 x 630 OG). (polish.md §3 decision 7)
- `expo-video` interrupts other audio by default; sounds in `ambient` mode with `mixWithOthers` (O-14). (polish.md §2.4 R15)

## 15. Backend, EU hosting, KMS, server services

- Data hosted in the EU; envelope encryption with Tink (Apache-2.0) under an EU KMS: the host's own KMS (Scaleway Key Manager, OVHcloud KMS) or AWS eu-west-3 / GCP europe-west9; one KEK per class, per-user DEK, crypto-shredding for deletion (A-SEC-6). (security.md §2.4)
- BAC on the device with server storage only when shared would shrink the GDPR art. 9 scope (A-SEC-7), against the server-authoritative principle (open-decisions D-10). (security.md §2.8)
- Moderation services: rules + Presidio (French config) + Mistral moderation (EU location UNVERIFIED, A-COM-8) or OpenAI `omni-moderation-latest` (EU residency on approval) or self-hosted Qwen3Guard; images via Sightengine or AWS Rekognition EU; PhotoDNA for CSAM. Perspective API shuts down on 31 Dec 2026. Keep a `ModerationProvider` interface. (community.md §2.4.2)
- Aggregation service with seeded Laplace noise, fixed 30 min grid, k ≥ 5 trusted users from ≥ 2 crews. (community.md §2.2.2)
- Search: server-side fuzzy search (Postgres `pg_trgm`, Meilisearch or Typesense) [U]; chat search on the device only (FTS5). (polish.md §2.2 QOL-23; security.md §2.3)
- Transit data ingested on the server (GTFS, GTFS-RT, SIRI Lite) for QOL-22. (polish.md §2.5)
- Retention jobs and per-party DEKs for live location. (security.md §2.8)

## 16. Costs and quotas

- Play Integrity: 10,000 requests a day by default, enough for about 1,500 daily users at about 6 calls per night; increase on request. App Attest `attestKey` under 100 requests per second across installs. (anticheat.md §2.1, §7)
- KMS: about $0.06 to $1 per key per month (OVHcloud $0.06288; AWS bills the first 2 rotations). (security.md §2.4)
- Moderation at 10,000 users: text near free; images about $29 a month (Sightengine Starter) or about $5 (Rekognition). (community.md §2.4.2)
- GitHub secret scanning and CodeQL are paid for private repositories. (security.md §2.11)
- Live Activity push budget per hour; widget reload budget per day. (polish.md §2.1)
- Transit: TfL free with attribution and 500 calls per minute per feed; Licence Mobilités may require fees or reciprocity above some thresholds [U]. (polish.md §2.5)
- External audit of `crew-crypto` before public release. (security.md §7)

## 17. CI, testing, tooling

- Security tooling: gitleaks, TruffleHog, OSV-Scanner / Trivy / Grype, Dependabot, Semgrep CE, CodeQL, cargo-audit / cargo-deny, MobSF; licence policy enforced. (security.md §2.11)
- Native anti-slop lint for UI code is needed because the Impeccable detector reads only HTML and CSS (proposed SLOP-12). (skills.md §1)
- Motion and performance: Instruments hitches (≤ 5 ms/s), Perfetto FrameTimeline, Macrobenchmark on a physical low-end device in CI, goldens at 0 / 25 / 50 / 75 / 100 %. (motion.md §3.6)
- E2E: Detox (gray-box RN, `device.setLocation` for red team; skip the vendor cloud), Maestro docs; `callstack/agent-device` for the drunk-mode tester after review. (skills.md §2.2, §3 decision 5; SKILLS.md §16)
- Physical devices are required: ProMotion iPhone and a modest Android (A-MOTION-7); simulators cannot judge 120 Hz, haptics or battery. (motion.md §7)
