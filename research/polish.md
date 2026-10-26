# Recon-Polish: everyday polish, shortcuts, notifications, sharing, forms

Phase 0 recon report. Author: Recon-Polish subagent. Date: 2026-10-26.
Inputs read: `PROMPT.md` (`<everyday_polish>` in full, `<party_hub>`, `<drunk_mode>` ADP-04, `<sync_and_feedback>` SYNC-07, O-14, O-35, O-38, N-07, N-29, N-30, AC-04), `research/README.md`, `research/motion.md` (format only).

Convention: **[F]** = fact from a cited source (section 8, all read 2026-10-26); **[O]** = opinion or recommendation; **[U]** = prior knowledge or observed product behaviour, not re-verified in an official source during this recon (verify before relying on it).

Research limit: the shared web-search budget for this turn ran out early. Every fact below comes from official pages fetched directly (Apple `.md` docs, Android Developers, Expo docs, npm and pub.dev registries, vendor developer portals). Some app-benchmark claims (Partiful, Strava, Life360 and so on) could not be fetched and are marked [U].

---

## 1. Summary

1. **Every surface outside the app runs without our JavaScript/Dart UI.** iOS widget buttons run their App Intent in the widget extension's process. Live Activity buttons (`LiveActivityIntent`) run in the app's process, but the JS runtime may not be up. Siri and Shortcuts intents must finish their work in Swift `perform()`. Expo's `expo-app-intents` says so directly: an invocation that arrives while JS is not running "stays in the pending queue" [F]. "Same again", water, RSVP from a notification, Siri "add a beer" and the Control Center button therefore need a **small native mutation path**: an App Group / shared-storage queue, a native idempotency key, and a native HTTP send. SYNC-01/06 have to cover it. This is the biggest architecture finding of this report (proposed QOL-25).
2. **Hard platform limits shape the Party screen surfaces.** A Live Activity lives 8 h at most and stays at most 12 h on the Lock Screen. Its data must fit in 4 KB [F]. A night that runs from 21:00 to 06:00 is over 8 h, so a restart through push-to-start (iOS 17.2+) is needed (proposed QOL-26). Push updates have an hourly budget: use priority 5 by default and 10 only for alerts [F]. Widgets get about 40 to 70 reloads a day and at least about 5 min between timeline entries; reloads while the app is in the foreground and taps on widget buttons don't count [F]. Android widgets: `updatePeriodMillis` at most every 30 min, WorkManager every 15 min, immediate updates from FCM/app [F].
3. **Android Live Updates (promoted ongoing notifications) have usage rules that touch HUB-02 and QOL-01.** The activity must be "ongoing, user-initiated, and time-sensitive". No custom `RemoteViews`, not colorized, not a group summary. "Don't allow activities triggered by other parties to generate Live Updates" [F]. So the party Live Update starts only when *this* user starts, joins or checks in, never because a friend started a party. The `live_activities` Flutter plugin renders Android with RemoteViews, which disqualifies it from promotion [F/O].
4. **Voice on Android: App Actions are effectively gone.** Google Assistant was removed from Android phones starting 4 September 2026, and Gemini replaced it [F, press]. App Actions docs still exist but depend on Assistant. AppFunctions (Android 16+) are experimental, and Gemini integration is a private preview [F]. QOL-04 on Android becomes: launcher shortcuts + Quick Settings tile + widget, with AppFunctions as a later P2 (proposed change).
5. **Siri phrases must contain the app name** ("You have to include your app name") and an app has at most 10 App Shortcuts [F]. "Hey Siri, add a beer" is impossible; "Add a beer in <App>" or a creative variant that contains the name works. The Action Button and Control Center/Lock Screen controls (iOS 18) run App Shortcuts / `ControlWidget` App Intents [F].
6. **Notification volume can be engineered, not just hoped for** (section 2.3). Apple: never send several notifications for the same thing. Badges only count unread notifications. Live Activity alerts are only for essential updates [F]. Android: only one notification sound per second (8.1+). Channels can't be changed once created. Max 3 action buttons [F]. Duolingo's research shows repetition desensitises users and fresh templates work better [F]. A proposed per-user night budget is in section 3.
7. **Platform rules that force design changes** (section 2.4, 16 items). The main ones: no in-app "Copied" toast on Android 13+ (the system shows one), and IBANs must be flagged sensitive. iOS haptics do nothing in Low Power Mode, so a haptic can't be the only success signal (SYNC-07, ADP-08). NFC phone-to-phone "cheers" is not available on iPhone for our use case (HCE is limited to payments/keys/tickets in the EEA), so JOY-01 needs BLE + bump detection, with UWB as a bonus. Play policy forbids `READ_MEDIA_IMAGES` for us, so the system photo picker is mandatory. Firebase Dynamic Links is shut down, so deferred deep linking for N-30 invites needs another path. App Store 1.4.3 / 1.4.5 constrain JOY-12 dares and anything that nudges drinking.
8. **Library state (Oct 2026).** Expo has first-party `expo-widgets` (iOS widgets + Live Activities with push tokens, Android widgets opt-in, v58.0.23, 2026-10-23) and `expo-app-intents` (alpha) [F]. Controls, Quick Settings tiles and Android Live Updates still need small native modules. Flutter has `home_widget`, `live_activities`, `flutter_local_notifications`, `quick_actions` and `app_links`, all updated in 2026. Its App Intents plugin is young (0.7.0, Oct 2025) [F]. Hermes has no `Intl.PluralRules` and no `Intl.RelativeTimeFormat`, so QOL-12 needs FormatJS polyfills on RN [F].
9. **Last ride home (QOL-22) is feasible in France and London.** transport.data.gouv.fr lists 216 GTFS-RT datasets. IDFM (75 operators) and Lyon TCL publish GTFS + SIRI Lite. Bordeaux TBM, Toulouse Tisséo and Aix-Marseille publish GTFS-RT. TfL is free with "Powered by TfL Open Data" attribution and 500 calls/min per feed. The Mobility Database lists 6000+ feeds in 100+ countries [F]. Aggregate on the server.
10. **Proposed new IDs: QOL-25 to QOL-31** (section 5). They cover the native fast path, Live Activity renewal, lock-screen privacy, feedback without haptics, invites that survive the install, notification taxonomy and per-party mute, and night-aware delivery. Ten existing IDs get a wording change.

---

## 2. Findings

### 2.1 Cross-cutting platform facts

| Topic | Fact | Source |
|---|---|---|
| Live Activity lifetime | Active up to 8 h, then ended and removed from the Dynamic Island; stays on the Lock Screen up to 4 more hours, so 12 h max. | [F] Apple, Displaying live data with Live Activities |
| Live Activity size | Static + dynamic data, updates and pushes: combined max 4 KB. | [F] same |
| Live Activity surfaces | Lock Screen, Dynamic Island, CarPlay, paired Mac, Apple Watch (Smart Stack). Buttons don't act in CarPlay. | [F] same; HIG Live Activities |
| Live Activity staleness | `staleDate` flips `isStale` so the UI can show "outdated" when offline. | [F] same |
| LA push budget | "Certain budget … per hour"; priority 10 counts toward it, priority 5 does not; `NSSupportsLiveActivitiesFrequentUpdates` raises it, users can turn it off (`frequentPushesEnabled`). | [F] Apple, ActivityKit push notifications |
| LA push-to-start | Not possible on iOS ≤ 17.1; push-to-start token from 17.2; on 18+ a start payload can subscribe to a channel (`input-push-channel`). Broadcast channels can update/end but **not start** an activity. Broadcast capability is enabled only on developer.apple.com. | [F] same |
| LA alerts | An `alert` in an update lights the screen and shows the expanded view; HIG: "Alert people only for essential updates". | [F] same; HIG |
| LA content | HIG: avoid sensitive info (Lock Screen, Always-On); no ads; update only when content changes; one LA tracking several things beats several LAs; end immediately when done. Compact/minimal must fit a 28 pt circle in limited-width contexts (Oct 2026 HIG change). | [F] HIG Live Activities (change log 13 Oct 2026) |
| Widget budget | Typically 40 to 70 refreshes per 24 h (≈ every 15 to 60 min); not counted when the app is in the foreground, has an audio/navigation session, is Now Playing, when a widget App Intent runs, on animation, locale or accessibility changes; entries ≥ about 5 min apart. | [F] Apple, Keeping a widget up to date |
| Widget interactivity | iOS 17+: `Button(intent:)` / `Toggle`; a tap "always guarantee[s] a timeline reload"; widget code runs in a separate process; `LiveActivityIntent` runs in the app process. | [F] Apple, Adding interactivity |
| Controls (iOS 18+) | `ControlWidgetButton` / `ControlWidgetToggle` backed by `AppIntent`, `OpenIntent` or `SetValueIntent`; placed in Control Center, on the Lock Screen and on the Action button; reloadable by app, interaction or APNs push. | [F] Apple, Creating controls |
| App Shortcuts | Up to 10 per app; phrases must include the app name; one optional parameter; SiriTipView for discovery; App Shortcuts feed Spotlight, Siri, Action button. | [F] HIG App Shortcuts; Apple AppIntents |
| Action Button | Runs an App Shortcut or system function "on supported iPhone and Apple Watch models"; Settings shows our labels. | [F] HIG Action button |
| Android Live Updates | Requirements listed in Summary §3; status-bar chip max 96 dp; user can demote/disable; `canPostPromotedNotifications()`; don't repost after dismissal; inappropriate uses include "chat messages, alerts … quick access to app features". | [F] Android, Live Updates |
| Android widgets (Glance) | `updatePeriodMillis` at most once per 30 min; WorkManager ~15 min; immediate on interaction, foreground or FCM. | [F] Android, Glance app widget |
| Quick Settings tiles | `TileService`; `requestAddTileService()` on API 33+; label ≤ 18 chars; tiles shouldn't just launch the app; max two tiles per app recommended; on locked device use `unlockAndRun()` for unsafe actions. | [F] Android, Quick Settings tiles |
| Android shortcuts | Static/dynamic/pinned; "most launchers only display four shortcuts"; `pushDynamicShortcut` recommended. | [F] Android, Create shortcuts |
| Android notifications | Max 3 action buttons; direct reply via `RemoteInput` (API 24+); only first sound per second plays (API 27+); auto-grouping at 4+ ungrouped notifications; group summary needed; channel behaviour is user-owned once created. | [F] Android, Create a notification; Group; Channels |
| Android 13+ permission | `POST_NOTIFICATIONS` runtime permission; the prompt only appears once a channel exists (expo-notifications note). | [F] Android; Expo notifications |
| Notification cooldown | Android 16-era feature lowers alert volume when one app sends several in a row; status in stable builds unconfirmed. | [F, press only] Android Authority / 9to5Google; treat as [U] |
| iOS interruption levels | passive (no sound, no light), active, timeSensitive (breaks through Focus and Summary; user can disable), critical (needs Apple entitlement via request form). `relevanceScore` 0 to 1 picks the featured notification in the summary. `threadIdentifier` groups. | [F] Apple UserNotifications |
| iOS provisional | Provisional authorization delivers quietly to Notification Center with Keep / Turn Off buttons. | [F] Apple, Asking permission |
| iOS local notification cap | System keeps the soonest-firing 64 scheduled notifications and discards the rest. | [F] Apple, UILocalNotification (legacy doc, still the stated rule) |
| App Review | 4.5.3 no spam via push or Live Activities; 4.5.4 push must not be required and must not carry sensitive personal info, promos need opt-in; 1.4.3 apps that encourage "excessive amounts of alcohol" are not permitted; 1.4.5 apps should not urge challenges that risk physical harm. | [F] App Store Review Guidelines |
| Music (O-14) | `AVAudioSession.Category.ambient` mixes with other audio and is silenced by the Ring/Silent switch; `mixWithOthers` keeps background music playing. Android: before 12 audio focus wasn't system-managed; from 12 the system fades out the previous focus holder; transient-may-duck lets others duck. | [F] Apple AVFAudio; Android audio focus |
| Low Power | iOS `ProcessInfo.isLowPowerModeEnabled` + `NSProcessInfoPowerStateDidChange`; Android `PowerManager.isPowerSaveMode()` + `ACTION_POWER_SAVE_MODE_CHANGED`. iOS haptics do nothing in Low Power Mode. | [F] Apple; Android; Expo haptics |
| Battery | iOS `batteryLevel` is −1 unless monitoring is enabled; Android battery state is a sticky intent, `BATTERY_LOW`/`OKAY` broadcasts. | [F] Apple UIDevice; Android battery monitoring |
| FGS limits | Android 15+: `dataSync` / `mediaProcessing` foreground services limited to 6 h per 24 h; `location` type needs location permission and `FOREGROUND_SERVICE_LOCATION`. | [F] Android FGS timeout; FGS types |
| Geofences | iOS: one app can monitor at most 20 conditions; Android: 100 geofences per app per user. | [F] Apple Core Location; Android geofencing |
| Exact alarms | Android `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` restricted (Play policy limits `USE_EXACT_ALARM` to some app categories). | [F] Android alarms; Expo notifications note |
| Clipboard | iOS 14+ warns users when an app reads another app's pasteboard without user intent. Android 13+ shows its own copy confirmation; Google "strongly recommend[s]" removing in-app toasts; sensitive content must set `EXTRA_IS_SENSITIVE`. | [F] Apple UIPasteboard; Android copy-paste |
| Calendar | iOS 17+: EventKitUI editor runs out of process and needs **no** calendar permission; write-only access exists; only the old usage key gets auto-denied. | [F] Apple, Accessing the event store |
| Photos | Android photo picker (Android 11+ via Play system updates, backport to 4.4); Play policy: `READ_MEDIA_IMAGES/VIDEO` only for apps whose core function needs broad access, mandatory since 28 May 2025; scoped-storage reads hide photo location unless `ACCESS_MEDIA_LOCATION` + `setRequireOriginal`. | [F] Android photo picker; Play policy; Android media |
| NFC on iPhone | `CardSession` HCE only for payments, car keys, closed-loop transit, badges, hotel keys, loyalty and event tickets in the EEA, with Apple-managed entitlements. | [F] Apple Core NFC CardSession |
| UWB | Nearby Interaction on UWB devices (iPhone 11+, Apple Watch); foreground, or background if BLE-paired, or (iOS 18.4+) with a Live Activity running. | [F] Apple Nearby Interaction |
| Rich previews | Messages uses Open Graph (`og:title`, `og:image`), plus an `apple-touch-icon`; "Avoid text in preview images". | [F] Apple TN3156 |
| App Links | Android App Links verified, Android 6+ with Google services; Dynamic App Links (Android 15) allow server-side URL rule changes. | [F] Android App Links |
| Firebase Dynamic Links | Shut down 25 Aug 2025; links 404; Google points to App Links/Universal Links for installed apps and to Adjust/Branch/AppsFlyer for deferred deep links. | [F] Firebase FAQ |
| Hermes Intl | Supports Collator, NumberFormat, DateTimeFormat, toLocale*; PluralRules / RelativeTimeFormat not listed. | [F] Hermes IntlAPIs.md |

### 2.2 Per-ID platform path (QOL-01 to QOL-24, JOY-01 to JOY-12)

Columns: **APIs** (iOS / Android), **Limits**, **RN/Expo**, **Flutter**, **Native module?** ("Native" means Swift/Kotlin code we write, even inside an Expo config plugin or Flutter plugin).

#### QOL-01 [P0] Same again
- **APIs**: in app, a normal mutation. Widget: iOS `Button(intent:)` (App Intent in the widget extension), Android Glance action/callback. Live Activity: `LiveActivityIntent` (app process). Android Live Update: notification action `PendingIntent` to a `BroadcastReceiver`. Notification: `UNNotificationAction` (iOS), action button (Android). Siri/Control: App Intent.
- **Limits**: the widget reloads after the tap (not counted in the budget) [F]. LA content ≤ 4 KB. The intent must finish and save state before `perform()` returns [F]. Android allows ≤ 3 actions per notification.
- **Native path**: the action must write the "same drink" mutation into a shared store (App Group on iOS, app storage on Android) with a natively generated idempotency key. Then it sends the mutation natively, or wakes the app to do it. The JS queue picks it up on launch (QOL-25). ADP-04 double-tap protection must be native too: debounce on the key, not on the UI.
- **RN/Expo**: `expo-widgets` (interactive buttons whose `onPress` returns new props, plus `addUserInteractionListener`) [F]; `expo-app-intents` (alpha) for Siri; `expo-notifications` categories. **Flutter**: `home_widget` (interactive callbacks), `live_activities`, `flutter_local_notifications` actions.
- **Native module?** Yes, for the native send and shared queue on both platforms.

#### QOL-02 [P0] Day boundary (night belongs to the evening)
- **APIs**: none; pure logic. Use the user's time zone at party start (store IANA zone with the party). DST nights (last Sunday of March/October in the EU) make a night 1 h shorter or longer [U, well-known calendar fact].
- **Limits**: widget timelines must use the same boundary function. Put it in a shared native-readable format (e.g., store `nightKey` = local date of start minus boundary).
- **Libs**: any date library (Temporal polyfill / date-fns-tz; Dart `timezone`). **Native?** No (except a copy of the rule in widget code).

#### QOL-03 [P0] Actionable notifications
- **APIs**: iOS `UNNotificationCategory` + `UNNotificationAction` / `UNTextInputNotificationAction`, `threadIdentifier` per party, `relevanceScore`, `interruptionLevel`. Android: actions (≤ 3), `RemoteInput` direct reply, `setGroup` + summary, channels, `setOnlyAlertOnce`. Badges: iOS app badge (HIG: count unread notifications only, clear on open). Android badges follow notifications [U].
- **Limits**: one sound per second on Android [F]. Without a group summary, Android auto-groups at 4+ [F]. Actions that "merely open your app" are discouraged [F]. Destructive actions get a distinct style [F].
- **"No notification for own actions"**: server rule (exclude actor). Also suppress on the actor's other devices [O].
- **Deep link**: every payload carries a canonical URL (same as QOL-05) so tap routing reuses the link router.
- **RN/Expo**: `expo-notifications` (categories with buttons/text input, channels, channel groups, badge) [F]. For Android grouped rendering from FCM *data* messages, a native `FirebaseMessagingService` or Notifee is needed. Notifee's last npm release is 9.1.8 (2024-12-20), a maintenance risk [F/O]. **Flutter**: `flutter_local_notifications` 22.3.3 (2026-10-25) + `firebase_messaging`.
- **Native module?** Probably, on Android (group summaries, Live Update promotion). On iOS, a Notification Service Extension is useful to attach avatars and to localise.

#### QOL-04 [P0] System shortcuts
- **iOS**: App Intents + `AppShortcutsProvider` (≤ 10, app name in every phrase). Action Button runs an App Shortcut or a Control. iOS 18 `ControlWidget` for Control Center and the Lock Screen. Spotlight gets App Shortcuts for free [F].
- **Android**: launcher shortcuts (4 visible) [F]; Quick Settings tile (`TileService`, `requestAddTileService` API 33+; "Add a drink" as a tile is a valid frequent action, while "open app" is not) [F]; widgets. App Actions via Assistant are not viable since Assistant left Android phones (Sept 2026) [F, press]. AppFunctions: Android 16+, experimental, Gemini in private preview [F].
- **RN/Expo**: `expo-app-intents` (alpha; intents declared in Swift inline modules) [F]; `expo-quick-actions` 6.0.2 (home-screen quick actions + icons) [F]; Controls via `@bacons/apple-targets` 5.0.0 + Swift; QS tile via an Expo native module (Kotlin). **Flutter**: `flutter_app_intents` 0.7.0 (2025-10-02, young), `quick_actions` 1.1.1; tile and controls need native code.
- **Native module?** Yes on both platforms (App Intent `perform()`, `ControlWidget`, `TileService`).

#### QOL-05 [P0] Deep links, universal links, rich previews
- **APIs**: iOS Universal Links (`apple-app-site-association`, Associated Domains entitlement); Android App Links (`assetlinks.json`, `autoVerify`; Dynamic App Links on 15+) [F]. Rich previews via Open Graph on the web page: Messages also uses `apple-touch-icon` and recommends no text in the image [F]. WhatsApp, Snapchat and Instagram DMs read OG tags [U]. Keep `og:image` small (WhatsApp is known to drop large images; the exact limit is unverified) [U].
- **Limits**: in-app browsers (Instagram, Snapchat, TikTok) often don't hand Universal Links to the app [U, widely reported]. The invitation page needs a visible "Open in app" button and a store fallback. Firebase Dynamic Links is gone [F].
- **RN/Expo**: Expo Router / `expo-linking` + the universal links guide [F]. **Flutter**: `app_links` 7.2.2 [F].
- **Native module?** No (config only). The server hosts the AASA/assetlinks files and renders OG per party/recap with a privacy-safe image.

#### QOL-06 [P0] Native sharing to Stories, Snapchat, TikTok, WhatsApp
- **Instagram Stories**: iOS `instagram-stories://share?source_application=<Facebook App ID>` + pasteboard keys (`backgroundImage`, `stickerImage`, top/bottom colours), `LSApplicationQueriesSchemes`. Android intent `com.instagram.share.ADD_TO_STORY` with a content URI. **A Facebook App ID has been required since January 2023.** Images ≥ 720×1280, 9:16 or 9:18; sticker 640×480; video ≤ 20 s, 1080p, < 50 MB recommended [F].
- **Snapchat Creative Kit**: iOS/Android/Web, "does not require the installation of any SDKs"; images PNG/JPEG, video MP4/MOV ≤ 5 min (split into 10 s snaps), ≤ 300 MB, captions ≤ 250 chars, 9:16 suggested, one sticker ≤ 1 MB, animated stickers not on Android; installable SDK deprecated [F]. The RN binding `@snapchat/snap-kit-react-native` was last released in 2022, so a small native module is better [F/O].
- **TikTok Share Kit**: needs a registered app + `client_key`, a universal-link `redirectURI`, and **photo-library access**. Media is passed as `localIdentifiers` (save the recap to Photos first). ≤ 35 images or 12 videos, aspect ratio between 1/2.2 and 2.2 [F].
- **WhatsApp**: text via `https://wa.me/?text=` [U, official FAQ page not readable here]; images and video through the system share sheet [O].
- **System share sheet**: HIG: use the Share button, don't duplicate system activities [F].
- **RN/Expo**: `react-native-share` 12.3.1 (has Instagram Stories / social targets) [F, npm]; `expo-sharing`. **Flutter**: `share_plus` 13.3.1, `appinio_social_share` 0.3.3 (Instagram Story, WhatsApp, TikTok…) [F].
- **Native module?** Likely, for Snapchat and TikTok. **Blocker**: Facebook App ID, Snap Kit app, TikTok developer app (section 7).

#### QOL-07 [P0] Typed content never lost
- **APIs**: persist drafts on every change (debounced) to fast local storage. iOS state restoration is less useful than our own storage [O]. The same store holds failed sends (SYNC-06).
- **Libs**: RN `react-native-mmkv` (in wide use; version lookup failed on encoding) or SQLite; Flutter `shared_preferences`/`drift`. **Native?** No.

#### QOL-08 [P0] Forms done right
- **APIs**: iOS `UITextContentType` (givenName, nickname, emailAddress, newPassword, oneTimeCode, telephoneNumber…) [F]; Android `autofillHints` (`AUTOFILL_HINT_PASSWORD`, `USERNAME`…) [F]. RN `autoComplete` covers both (`one-time-code`, `sms-otp`, …), plus `inputMode` (beats `keyboardType`), `enterKeyHint`, `submitBehavior` [F]. Keyboard avoidance: `react-native-keyboard-controller` 1.22.9, listed in the Expo SDK docs (`KeyboardAwareScrollView`, `KeyboardToolbar`) [F].
- **Decimal separator**: iOS `decimalPad` shows "numbers and a decimal point" [F]. Locale data is available (`expo-localization` `decimalSeparator`) [F]. Some Android keyboards show "." whatever the locale [U]. **Rule: the amount parser accepts both "," and "."** (proposed change to QOL-08).
- **Flutter**: `TextInputType.numberWithOptions(decimal: true)`, `AutofillHints`, `AutofillGroup` (framework) [U]. **Native?** No.

#### QOL-09 [P0] Photos
- **APIs**: iOS PHPicker (no permission for picking). Android photo picker (no broad permission; a Play policy requirement for us) [F]. Compression/resize before upload. Background upload: iOS background `URLSession`, Android WorkManager [U].
- **HEIC**: `expo-image-picker` returns HEIC originals when not compressing, and iOS then shows a permission dialog to access the original file. With compression on, it converts to JPEG [F]. Ask for compressed JPEG/WebP output so HEIC never reaches the server [O]. The server still accepts HEIC as a fallback.
- **Location metadata**: Android hides photo location by default for scoped-storage reads [F]. On iOS, the picked file may keep GPS EXIF [U]. **Strip EXIF on the device before upload AND again on the server before anything is shared** [O]. Re-encoding through `expo-image-manipulator` or `flutter_image_compress` normally drops EXIF [U, verify with a test fixture].
- **Libs**: `expo-image-picker`, `expo-image-manipulator` 58.0.15, `expo-image` (blurhash/thumbhash placeholders) [F]; Flutter `image_picker`, `flutter_image_compress` 2.5.1, `native_exif` 0.8.0 [F]. **Native?** Only for true background upload (`expo-file-system` background session or a native module) [U].

#### QOL-10 [P0] Dying battery
- **APIs**: iOS `UIDevice.batteryLevel` with monitoring on. Android sticky battery intent / `BATTERY_LOW` [F]. `expo-battery` / `battery_plus` [F].
- **Limits**: the value is only reported while our code runs: app in foreground, background location session (N-07 opt-in), Android foreground service of type `location` (`dataSync` is capped at 6 h/24 h on Android 15+) [F], or when a push wakes the app [U]. **Show the reading's age** ("8 % · 23:41"), never a live-looking value. N-29 must treat "last seen battery < 10 %" as the likely cause of silence [O].
- **Native?** No for reading. Yes if we add a location foreground service on Android.

#### QOL-11 [P0] Names that work
- No platform API. Grapheme-aware truncation (`Intl.Segmenter` is not in Hermes's list → use a grapheme library) [F/U]. Stable colour = hash(userId) into a palette checked for contrast in both themes [O]. Disambiguation: "Lucas B." then "Lucas (Lyon)", from server-side crew context [O]. **Native?** No.

#### QOL-12 [P0] Plurals, formats, relative time
- RN: Hermes lacks `Intl.PluralRules` / `RelativeTimeFormat` [F], so use `@formatjs/intl-pluralrules` 6.3.16 + `@formatjs/intl-relativetimeformat` 12.3.16 (both 2026-10-19) [F], or ICU messages in the i18n library. Flutter: `intl` (`Intl.plural`, `DateFormat`) [U]. Widgets/Live Activities: SwiftUI `Text(date, style: .relative)` and `Text(timerInterval:)` render relative times and countdowns **without reloads**. The widget doc points to "Displaying dynamic dates" for countdowns without reloading [F]; the exact SwiftUI API names are [U]. That is ideal for "back to zero in 2 h 10".
- **Native?** No (beyond widget SwiftUI).

#### QOL-13 [P0] Confirm only destructive actions, otherwise Undo
- HIG: prefer non-destructive notification actions, and destructive ones get a distinct look [F]. Undo windows and SYNC: the undo sends a compensating mutation, or the original is held for N s before sending [O]. **Native?** No.

#### QOL-14 [P0] Navigation without traps
- Android 16: apps targeting 16 get predictive back system animations; migrate or opt out [F]. Edge-to-edge enforced since targeting Android 15, with no opt-out on 16 [F]. iOS: native stack keeps swipe-back; sheets need `presentationDetents`/swipe-to-dismiss [U].
- RN: native-stack (react-native-screens) [U]; Flutter: `PopScope` for predictive back [U]. **Native?** No.

#### QOL-15 [P1] Try before signing up; passkeys / magic links
- iOS passkeys (AuthenticationServices public-private key auth) [F]; Android Credential Manager (passkeys, passwords, Sign in with Google, digital credentials) [F]. Magic links ride on Universal/App Links (QOL-05).
- RN: `react-native-passkey` 3.6.2 (2026-09-08) [F]; Flutter: `credential_manager` / `passkeys` packages [U]. **Native?** Covered by libraries; the AASA/assetlinks files need the `webcredentials` entries [U].

#### QOL-16 [P1] Learned defaults
- No platform API. iOS can **donate** intents so Siri Suggestions surface "Same again" at the usual time [F, expo-app-intents donation docs]. Android `pushDynamicShortcut` reorders launcher shortcuts by use [F]. **Native?** Small (donations).

#### QOL-17 [P1] Suggestions (3+ check-ins, leaving venue, closing time)
- Geofences: iOS max 20 conditions per app, Android max 100 [F]. Monitor only the current party's venue(s) [O]. Closing-time heads-up: send from the **server** as a push (exact alarms are restricted on Android, and the iOS local queue is capped at 64) [F/O].
- Libs: `expo-location` (geofencing tasks) [F]; Flutter `geofence_service` / native [U]. **Native?** No, if expo-location is used.

#### QOL-18 [P1] The user's own apps (maps, rides)
- Apple Maps URLs, Google Maps URLs, Waze deep links, Uber/Bolt universal links [U, not re-fetched]. iOS: `canOpenURL` needs `LSApplicationQueriesSchemes` (Instagram docs show the pattern) [F]. Android 11+ package visibility needs `<queries>` [U]. Remember the choice server-side (PREF-01). **Native?** No (config only).

#### QOL-19 [P1] Long-press to copy
- Android 13+: system confirmation, so **no in-app "Copied"**; IBANs and codes flagged sensitive (`EXTRA_IS_SENSITIVE`; `expo-clipboard` `android.isSensitive`) [F]. iOS: write freely; reading another app's content triggers the paste alert, so use the system Paste button (`UIPasteControl`) for "paste invite code" [F/U]. A haptic + inline label on iOS and Android ≤ 12 only [O]. ADP-04: long-press is never the only path, so also offer a visible "Copy" button at levels 2 and 3 [O].
- **Native?** No.

#### QOL-20 [P1] Next-morning mode
- Detect "first open after the night ended" in app logic. Recap notification: server push at a "decent hour" relative to the user's last activity, or a local scheduled notification (≤ 64 pending on iOS) [F]. Interruption level `active` or `passive`, never time-sensitive [O]. Calm dark screen = theme override [O]. **Native?** No.

#### QOL-21 [P1] Calendar and birthdays
- iOS 17+: present `EKEventEditViewController` (out of process, **no permission prompt**) [F]; `expo-calendar` supports system UI and write-only access [F]; Flutter `add_2_calendar` 3.1.1 [F]. Android: `Intent.ACTION_INSERT` on `CalendarContract` (no permission) [U]. Birthdays: crew-entered dates, not Contacts (avoids a contacts permission) [O]. **Native?** No.

#### QOL-22 [P2] Last ride home
- Data: section 2.5. Server ingests GTFS + GTFS-RT/SIRI Lite per city and exposes "next N departures near venue after now". The client never calls the transit APIs (keys, quotas, attribution) [O]. **Native?** No.

#### QOL-23 [P1] Search that helps
- No platform API needed. Server-side fuzzy search (Postgres `pg_trgm` / Meilisearch / Typesense) [U]. Recent searches stored locally and synced. Spotlight can index venues and crews via App Intents entities (bonus) [F, expo-app-intents mentions Spotlight]. **Native?** No.

#### QOL-24 [P1] Respect the phone
- Low Power: `expo-battery` `useLowPowerMode()` (Android + iOS) [F], `battery_plus` [F]. Haptics silent in iOS Low Power Mode [F]. Data saver: Android `ConnectivityManager.getRestrictBackgroundStatus()`, iOS `NWPath.isConstrained` (Low Data Mode) [U]. Widgets: budget already forces frugality [F]. **Native?** No (Low Data Mode may need a tiny native call) [U].

#### JOY-01 [P1] Cheers
- iPhone NFC phone-to-phone is **not available** for this use (HCE limited to payments/keys/transit/badges/tickets in the EEA, entitlement-gated) [F]. Android NFC HCE/reader works, but not with iPhone [U].
- **Path**: BLE advertising of a short-lived rotating token + RSSI proximity (cross-platform), plus "bump" detection (accelerometer spike in both phones within ~300 ms, matched by the server) [O]. On iPhone 11+ pairs: Nearby Interaction UWB distance as a strong proximity proof for AC-04 [F]. Background ranging works if a Live Activity is running, on iOS 18.4+ [F].
- Libs: `react-native-ble-plx` 3.5.1 [F], `flutter_blue_plus` 2.3.14 [F]; UWB needs a native module. iOS needs `NSBluetoothAlwaysUsageDescription` (a permission prompt) [U]. **Native?** Yes for UWB, optional for BLE.

#### JOY-02 [P1] Lines that know the time
- No API. Duolingo evidence: fresh templates outperform repeated ones, and repetition desensitises users [F]. Store the last N lines shown per user server-side to guarantee "never the same two nights in a row" [O]. **Native?** No.

#### JOY-03 [P1] Alternate app icons
- iOS `setAlternateIconName` with `CFBundleAlternateIcons` declared in Info.plist (icons ship in the binary; new icons need an app update) [F]. iOS shows a system alert on change [U]. Android: `activity-alias` toggling. Some launchers drop pinned shortcuts or restart the app on change [U]. Change only on a user tap, never automatically on unlock [O].
- Libs: `expo-alternate-app-icons` 8.0.0, `expo-quick-actions` (icons too) [F]; Flutter `flutter_dynamic_icon` 2.1.0 (2022, stale) [F]. **Native?** Covered by plugins.

#### JOY-04 [P1] Mood themes
- Live Activity: custom background allowed only on the Lock Screen presentation; Dynamic Island background is always black, so tint text/key line instead [F]. Must stay legible in Night Mode (red tint in StandBy) and on Always-On [F]. Widgets: iOS tinted/clear Home Screen modes desaturate custom colours [U]. **Native?** Widget/LA SwiftUI code.

#### JOY-05 [P2] Sound pack
- iOS: `ambient` category, silenced by the switch and mixing with music [F]. Android: no silent switch, so respect `AudioManager.getRingerMode()` and use `USAGE_ASSISTANCE_SONIFICATION` without requesting audio focus [U]. `expo-audio` `interruptionMode: 'mixWithOthers'` (default) and `playsInSilentMode: false` [F]. Never `doNotMix` [O]. Same rule for O-14: `expo-video` defaults to `'auto'`, which interrupts other apps unless the video is muted, so autoplay recaps stay muted or set `mixWithOthers` [F].
- **Native?** No.

#### JOY-06 [P1] Crew streak
- Server logic (week boundary follows QOL-02 and PREF first-day-of-week). Widget shows streak via timeline [O]. Duolingo-style streak widgets are a known pattern [U]. **Native?** Widget only.

#### JOY-07 [P1] Easter eggs
- Shake: iOS `motionEnded`, Android accelerometer (`expo-sensors`) [U]. Must never trigger at level 2/3 where shaking is accidental [O]. **Native?** No.

#### JOY-08 [P1] Milestones
- Server-confirmed (SYNC-02). Counting nights, never drinks, aligns with App Review 1.4.3 [F]. **Native?** No.

#### JOY-09 [P1] Photo booth
- Built server-side from the shared album (no client photo-library permission needed). Export as 9:16 ≥ 720×1280 for Stories, sticker layer for Instagram [F]. TikTok needs the strip saved to Photos (`PHPhotoLibrary` add-only permission) [F/U]. **Native?** No beyond QOL-06.

#### JOY-10 [P2] Sticker packs
- WhatsApp: 3 to 30 stickers per pack, exactly 512×512, WebP (iOS also PNG), static ≤ 100 KB, animated ≤ 500 KB and ≤ 10 s, no mixing static/animated, 96×96 tray icon; added through WhatsApp's integration (sample apps) [F]. iMessage: a static sticker pack is fixed at build time, so per-crew stickers need a Messages app extension with `MSStickerBrowserViewController` [F]. **Native?** Yes (iMessage extension; WhatsApp content provider on Android).

#### JOY-11 [P1] Member card
- Rendered server-side as an image + OG page (QOL-05) and shareable via QOL-06. Respect PROF visibility on the public card [O]. Apple Wallet pass is a possible bonus (PassKit, needs a Pass Type ID) [U]. **Native?** No.

#### JOY-12 [P1] Dare of the night
- **App Review 1.4.5** ("should not urge customers to participate in activities (like bets, challenges, etc.) … that risks physical harm") and **1.4.3** (no encouraging excessive alcohol) [F]. Dares must never involve drinking, quantities, speed or physical risk. Crew-written cards (N-33) need the COM-08 filter and a "no drinking dares" rule [O]. **Native?** No.

### 2.3 Notification volume (O-38, QOL-03): rules from platforms and apps that do it well

Sourced rules:
1. **One event, one notification.** "Avoid sending multiple notifications for the same thing, even if someone hasn't responded" [F, HIG]. Update in place instead: same Android notification ID / `setOnlyAlertOnce`, APNs `apns-collapse-id` [U for collapse-id].
2. **Badges = unread notifications only**, cleared as soon as they are seen; never a score or a BAC [F, HIG].
3. **No sensitive content in the notification body** (HIG; App Review 4.5.4) [F]. BAC values and drink counts are health-like data (SEC-08), so default copy says "Léa is heading home", not "Léa 1.2 g/L".
4. **Live Activity / Live Update = the quiet channel.** Update it instead of notifying. Alert only for essential updates [F]. Use priority 5 for routine LA pushes and 10 only for what needs attention [F].
5. **Android audio rate**: only the first notification per second plays a sound [F]. Android 16-era "notification cooldown" may lower the volume of bursts even more [F, press]. A burst of "X joined" pings is wasted noise.
6. **Channels are a promise**: once created, the user owns importance and sound [F]. Design the channel list before the first release (QOL-30).
7. **Interruption levels**: `passive` for FYI (photo added, recap ready if the user is asleep), `active` for crew asks, `timeSensitive` only for safety (N-29, SOS, "your friend is heading home alone"). Critical alerts need an Apple entitlement and are unlikely to be granted for a party app [F/O].
8. **Provisional authorization** lets a new user see our notifications quietly before deciding [F]. This suits a P0 app that must not lose opt-in on day 1 [O].
9. **No spam via push or Live Activities; promos need explicit opt-in** [F, App Review 4.5.3/4.5.4].
10. **Freshness beats repetition**: Duolingo's bandit work showed fresh templates have more impact and that repeating the same template "will get repetitive, desensitize users". It counted a reminder as successful only when the user acted within 2 hours [F]. Apply this to "who's in?" and next-morning copy.
11. **Actions over prompts**: "Avoid sending a notification that tells people to perform specific tasks within your app"; offer actions instead [F, HIG].
12. **Android Live Update etiquette**: don't repost a dismissed Live Update; give an "Unpin" action for background monitoring [F].

Observed in apps [U, not re-verified]: WhatsApp mutes a group for 8 h / 1 week / always. Telegram can send a message "without sound". Strava folds kudos into "X and N others". Partiful sends reminders before the event and lets hosts "text blast" guests with limits. Life360 and Zenly show friends' battery level. BeReal sends one daily prompt. Duolingo stops reminding after long inactivity.

### 2.4 Platform rules that force a design change

| # | Rule | Affected IDs | Change |
|---|---|---|---|
| R1 | Widget/LA/Siri code runs outside the JS/Dart runtime [F] | QOL-01, QOL-03, QOL-04, HUB-02/03, SYNC-01/06 | Native shared mutation queue + native sender (QOL-25). |
| R2 | Live Activity max 8 h active / 12 h visible, 4 KB [F] | HUB-02 | Auto-renew via push-to-start before 8 h; show a stale state (QOL-26). |
| R3 | LA / Live Update / notification HIG: avoid sensitive info on the Lock Screen [F] | HUB-02, HUB-03, QOL-03 | Discreet mode by default for BAC numbers (QOL-27). |
| R4 | Android Live Updates must be user-initiated, not triggered by others, no RemoteViews [F] | HUB-02, N-03 | Start the Live Update only on the user's own join/check-in; native builder, not RemoteViews. |
| R5 | Siri phrases must include the app name; ≤ 10 App Shortcuts [F] | QOL-04 | Rewrite examples; pick the 10 shortcuts; the app name must be easy to say in FR and EN (naming input for the brand). |
| R6 | Assistant removed from Android phones (Sept 2026); AppFunctions experimental [F] | QOL-04 | Drop Android App Actions from P0; use launcher shortcuts + QS tile + widget; AppFunctions → P2. |
| R7 | iOS haptics silent in Low Power Mode [F] | SYNC-07, ADP-08, QOL-24, MOT | Visual confirmation must stand alone (QOL-28). |
| R8 | Android 13+ shows its own copy confirmation; sensitive flag required [F] | QOL-19 | No in-app "Copied" on Android 13+; flag IBAN/codes. |
| R9 | iPhone NFC HCE limited to payments, keys, tickets (EEA) [F] | JOY-01, AC-04 | BLE + bump, UWB bonus; no NFC "tap phones" promise on iPhone. |
| R10 | Play photo/video permission policy (since 28 May 2025) [F] | QOL-09, JOY-09 | System photo picker only; no "scan my camera roll" feature. |
| R11 | Firebase Dynamic Links shut down [F]; iOS paste alert on programmatic read [F] | N-30, QOL-05 | Deferred deep link via Play Install Referrer + invite code + system Paste button, or a paid provider (QOL-29). |
| R12 | Android channels immutable to the app; ≤ 3 actions [F] | QOL-03, O-38 | Channel taxonomy designed up front (QOL-30); at most 3 actions per notification. |
| R13 | Geofence caps 20 (iOS) / 100 (Android); exact alarms restricted; 64 pending local notifications (iOS) [F] | QOL-17, QOL-20, QOL-21 | Server-scheduled pushes; monitor only the current venue. |
| R14 | App Review 1.4.3 / 1.4.5 [F] | JOY-12, QOL-01, RANK | No drinking dares or risky challenges; "Same again" stays a logging tool, never a nudge ("Another one?" style copy is banned). |
| R15 | `expo-video` default `'auto'` interrupts other audio unless muted; `ambient` honours the silent switch [F] | O-14, JOY-05, recap | Autoplay muted / `mixWithOthers`; sounds only in ambient. |
| R16 | Android 16 predictive back; edge-to-edge enforced [F] | QOL-14 | Test back gestures on every sheet; no custom back interception without `OnBackPressedCallback`/`PopScope`. |

### 2.5 Transit open data for QOL-22 (cities)

| City / scope | Static | Real time | Licence / terms | Source |
|---|---|---|---|---|
| Île-de-France (IDFM, 75 operators: train, RER, metro, tram, bus incl. night) | GTFS (PRIM "GTFS Datahub"), NeTEx | SIRI Lite (PRIM real-time API; PRIM pages are behind a bot check, quotas not read) | "mobility-licence" (Licence Mobilités) on transport.data.gouv.fr | [F] PRIM GTFS page; transport.data.gouv.fr API |
| Lyon (TCL) | GTFS, NeTEx | SIRI Lite | mobility-licence; a second TCL entry is ODbL | [F] transport.data.gouv.fr API |
| Bordeaux (TBM) | GTFS, NeTEx | GTFS-RT + SIRI Lite | Licence Ouverte (fr-lo) | [F] same |
| Toulouse (Tisséo) | GTFS, NeTEx | GTFS-RT | ODbL | [F] same |
| Aix-Marseille-Provence | GTFS | GTFS-RT + SIRI | Licence Ouverte v2 | [F] same |
| Lille (ilévia) | GTFS | GTFS-RT | listed | [F] transport.data.gouv.fr GTFS-RT listing |
| France total | 808 datasets in the national catalogue | 216 with GTFS-RT | 158 Licence Ouverte, 58 ODbL among GTFS-RT | [F] same |
| London (TfL) | Unified API (stops, timetables) | Arrivals (bus/rail "out of date within 30s"), websockets | Free; "Powered by TfL Open Data" attribution; max 500 calls/min per feed | [F] TfL unified API; TfL transport data terms |
| Worldwide | Mobility Database: 6000+ GTFS / GTFS-RT / GBFS feeds, 100+ countries, REST API | | per feed | [F] mobilitydatabase.org |

Licence Mobilités may require reciprocity or fees above some usage thresholds [U]. Recon-Security or legal should read it before launch.

---

## 3. Decisions proposed

1. **Build a "native fast path" module once, used by every out-of-app surface** (QOL-25): shared storage (App Group / app files), native UUIDv7 idempotency keys, native HTTPS send with the user's short-lived token in the Keychain/Keystore, and hand-over to the JS queue on launch. Reason: R1; otherwise "Same again" from the Lock Screen silently waits until the app opens.
2. **On iOS, one Live Activity per user per night, fed by our server**, using per-activity push tokens (ADP needs per-user BAC). A broadcast channel is optional for crew-wide data, but broadcast can't start activities and needs a developer-portal capability [F]. Routine BAC refreshes go as priority 5, crew events as 10 with no alert, and only safety events alert. Use `Text(timerInterval:)` for "back to zero" so no pushes are needed for the countdown [O].
3. **Android HUB-02 = a native Live Update** (`setRequestPromotedOngoing`, `ProgressStyle` or standard style, `setShortCriticalText` e.g. "0.4"), with a fallback to a normal ongoing notification when promotion is denied. Max 3 actions: Same again, Water, Heading home [O].
4. **QOL-04 list for the 10 App Shortcuts** (proposal): Same again, Add water, Add a drink (with a drink parameter), Who's out tonight, I'm heading home, Start a party, Check in here, Call a friend, SOS, Open the party. Two Controls: Same again, Water. Android: four launcher shortcuts (Same again, Water, Heading home, Party) + one QS tile ("Add a drink"; a second tile "Water" is optional) [O].
5. **Notification budget per user per night** (proposal for O-38, numbers to validate in beta, A-POLISH-6):
   - at most 3 *alerting* (sound/vibration) notifications per hour and 8 per night, safety exempt;
   - everything else goes into the Live Activity / Live Update or a passive notification;
   - events within 5 min about the same party are merged ("Léa, Tom and 2 others arrived") by editing one notification;
   - no push to the actor or to anyone with the app in the foreground on that party;
   - a "mute this party until 6 am" action on every party notification (QOL-30);
   - members not at the party get passive delivery after midnight (QOL-31).
6. **Channel / category taxonomy (draft)**: Safety (high), Crew asks (who's in? / rounds; default), Live party (low, ongoing), Social (photos, reactions; low), Recap & next morning (default, scheduled), Messages (MSG, default). Six channels max, names in FR and EN [O].
7. **Sharing stack**: generate share assets on the server (9:16 1080×1920 PNG + separate sticker PNG + 1200×630 OG). The client chooses the target: Instagram Stories (pasteboard/intent), Snapchat Creative Kit (code-only), TikTok (save to Photos then Share Kit), system sheet otherwise [O].
8. **Invites**: own the deep links (Universal/App Links on our domain). Deferred deep linking through the Play Install Referrer on Android plus an invite code typed or pasted via the system Paste button on iOS. A paid provider only if conversion data says so [O].
9. **i18n on RN**: FormatJS polyfills for PluralRules / RelativeTimeFormat, loaded only for FR/EN locales to save size [O].
10. **Stack note for the Architect**: widgets, Live Activities, Controls, App Intents, tiles and Live Updates are native code whatever the stack. Expo now covers widgets + Live Activities (`expo-widgets`) and App Intents (alpha). Flutter has equivalents with less maturity on App Intents. This does not decide the stack, but it removes "widgets" as an argument against RN/Expo [O].

---

## 4. Assumptions

- **A-POLISH-1**: The JS runtime is not reliably available when an iOS widget, Control or Siri intent runs. Basis: Apple widget doc (separate process), expo-app-intents pending-queue note. Verify: build a spike where a widget button logs a drink with the app killed, check the server receives it within 5 s.
- **A-POLISH-2**: Push-to-start can restart a Live Activity after the 8 h cap without user action. Basis: Apple push-to-start doc. Verify: on-device test ending at 8 h and restarting via push; check whether the user must have interacted.
- **A-POLISH-3**: Android Live Update eligibility holds for "party in progress" on Pixel and Samsung (OEMs "can enforce additional criteria") [F]. Verify on a Pixel (Android 16) and a Samsung One UI build.
- **A-POLISH-4**: Google Assistant App Actions are not reachable through Gemini on Android phones in late 2026. Basis: 9to5Google 2026-09-28 + no Gemini mention on the App Actions page. Verify: Android release notes / test on a Pixel.
- **A-POLISH-5**: In-app browsers of Instagram/Snapchat/TikTok don't open Universal Links in our app. Basis: common reports [U]. Verify: manual matrix test with our domain.
- **A-POLISH-6**: The budget of 3 alerting notifications per hour / 8 per night keeps opt-out low. Basis: none (proposal). Verify: beta analytics on notification disable rate per channel.
- **A-POLISH-7**: Re-encoding images through expo-image-manipulator / flutter_image_compress drops GPS EXIF. Verify with a geotagged HEIC fixture in CI, plus a server-side EXIF strip regardless.
- **A-POLISH-8**: Some Android keyboards show "." on the decimal pad in French locale. Verify on Gboard and Samsung Keyboard; the parser accepts both separators anyway.
- **A-POLISH-9**: BLE RSSI + bump timing is enough for a fun "cheers" and a weak proximity signal. True proximity proof needs UWB or server-matched co-location. Verify with the AC-04 owner.
- **A-POLISH-10**: Changing the app icon shows a system alert on iOS. Verify on device.
- **A-POLISH-11**: The WhatsApp text share URL `https://wa.me/?text=` still works. Verify on device (the official FAQ page was not readable).
- **A-POLISH-12**: Notifee (last release 2024-12) is not maintained. Verify the GitHub repo status before choosing it.

## 5. Scope changes

New IDs (only the ones that matter on a night out):

| ID | Priority | Proposal | Reason |
|---|---|---|---|
| QOL-25 | P0 | **Native fast path**: every action available outside the app (widget, Live Activity / Live Update, notification action, Siri / Shortcut, Control, QS tile, launcher shortcut) is written natively to a shared queue with an idempotency key and sent natively within seconds, even with the app killed; the app reconciles on launch (SYNC-03/06). | R1: otherwise QOL-01/03/04 silently fail or wait. |
| QOL-26 | P0 | **The Live Activity outlives the night**: renewed through push-to-start before the 8 h cap; a stale state ("updated 23:41") when no update arrives; ended immediately when the party ends; Android equivalent re-posted only if the user didn't dismiss it. | R2: a 21:00 to 06:00 night is over 8 h. |
| QOL-27 | P0 | **Discreet lock screen**: by default Lock Screen / Live Activity / widget / notification show no BAC figure or drink count (level icon and time to zero only); the user can opt into numbers; also hidden during screen sharing (Android `setPublicVersion`). | R3, App Review 4.5.4, SEC-08 health-like data. Phones lie face-up on bar tables. |
| QOL-28 | P0 | **Feedback without haptics or sound**: every confirmation (SYNC-07) is visible on its own, because haptics are off in iOS Low Power Mode, which is common at the end of a night. | R7. |
| QOL-29 | P0 | **Invite survives the install**: a friend who installs from an invite link lands in the right crew/party after install (Play Install Referrer; invite code + system Paste button on iOS), with a rich preview that never leaks private data. | R11; N-30 loses people at the store step otherwise. |
| QOL-30 | P0 | **Notification taxonomy and per-party mute**: fixed channel/category list designed before v1, a thread per party, max 3 actions, "Mute this party until morning" on every party notification, merge-in-place of bursts. | R12, O-38. |
| QOL-31 | P1 | **Night-aware delivery**: after midnight, crew members not at the party get non-safety notifications passively (no sound), with a morning digest; safety is never muted. | People at home asleep are the ones who uninstall. Telegram-style silent send, applied automatically. |

Changes to existing IDs:
- **QOL-04**: replace "Android App Actions" with "Android launcher shortcuts + Quick Settings tile; AppFunctions later (P2)". Replace the "Hey Siri, add a beer" example with "Add a beer in <App name>".
- **QOL-08**: add "amount fields accept both ',' and '.' as decimal separator whatever the keyboard shows".
- **QOL-09**: add "system photo picker only (Play policy); EXIF stripped on the device and again on the server".
- **QOL-10**: add "battery shown with the time of the reading; reported only while the app or its party session runs".
- **QOL-19**: add "on Android 13+ the system shows the copy confirmation; no in-app 'Copied'; sensitive values flagged".
- **QOL-21**: add "via the system event editor, no calendar permission".
- **QOL-06**: add formats: Stories ≥ 720×1280 at 9:16, sticker 640×480, video ≤ 20 s; TikTok needs the asset saved to Photos.
- **JOY-01**: "Bluetooth LE + bump; UWB on capable iPhones; NFC only where the platform allows (not iPhone-to-iPhone)".
- **JOY-12**: add "never a drinking dare or a physically risky challenge (App Store 1.4.3, 1.4.5)".
- **HUB-02**: Android "persistent notification" becomes "Live Update (promoted ongoing notification), started only by the user's own action".

## 6. Glossary additions

| English term | French UI term | Meaning |
|---|---|---|
| Live Activity | Activité en direct | iOS Lock Screen / Dynamic Island live card (Apple's FR name). |
| Live Update | Mise à jour en direct | Android 16 promoted ongoing notification. Unverified FR system name, [U]. |
| Control | Commande | iOS 18 Control Center / Lock Screen / Action button control. Apple FR: "commandes", [U]. |
| Quick Settings tile | Vignette Réglages rapides | Android tile in the notification shade. [U] |
| App Shortcut | Raccourci d'app | iOS phrase + action exposed to Siri/Spotlight/Action button. |
| Native fast path | (internal, no UI) | QOL-25 native send path for out-of-app actions. |
| Discreet lock screen | Écran verrouillé discret | QOL-27 setting. |
| Deferred deep link | (internal) | A link that still routes to its target after the app is installed. |
| Notification budget | (internal) | Max alerting notifications per user per hour/night (decision 5). |
| Night-aware delivery | Notifications nocturnes silencieuses | QOL-31. |

## 7. Blockers (need the user)

1. **Facebook (Meta) App ID** for Instagram Stories sharing (required since Jan 2023) [F]. Needs a Meta developer account.
2. **Snap Kit app registration** (Creative Kit) and **TikTok for Developers app** (`client_key`, Share Kit enabled, universal-link redirect) [F].
3. **Apple Developer account**: broadcast push capability for Live Activities is enabled only on developer.apple.com [F]. App Groups and Associated Domains too.
4. **Domain** for Universal/App Links, invitation pages and OG images (also needed by N-30).
5. **Transit data accounts**: IDFM PRIM account/API key (free, terms to accept), TfL API key (free). Licence Mobilités terms to read (legal).

## 8. Sources (all read 2026-10-26)

Apple (developer.apple.com, Markdown endpoints)
- https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- https://developer.apple.com/documentation/activitykit/pushtype
- https://developer.apple.com/videos/play/wwdc2024/10069/
- https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date
- https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities
- https://developer.apple.com/documentation/widgetkit/creating-controls-to-perform-actions-across-the-system
- https://developer.apple.com/documentation/appintents/app-shortcuts
- https://developer.apple.com/documentation/appintents/appshortcutsprovider
- https://developer.apple.com/design/human-interface-guidelines/app-shortcuts
- https://developer.apple.com/design/human-interface-guidelines/action-button
- https://developer.apple.com/design/human-interface-guidelines/live-activities
- https://developer.apple.com/design/human-interface-guidelines/notifications
- https://developer.apple.com/design/human-interface-guidelines/playing-haptics
- https://developer.apple.com/design/human-interface-guidelines/activity-views
- https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel
- https://developer.apple.com/documentation/usernotifications/unnotificationinterruptionlevel/timesensitive
- https://developer.apple.com/documentation/usernotifications/unmutablenotificationcontent/threadidentifier
- https://developer.apple.com/documentation/usernotifications/unmutablenotificationcontent/relevancescore
- https://developer.apple.com/documentation/usernotifications/declaring-your-actionable-notification-types
- https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications
- https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts
- https://developer.apple.com/documentation/uikit/uilocalnotification
- https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient
- https://developer.apple.com/documentation/avfaudio/avaudiosession/categoryoptions-swift.struct/mixwithothers
- https://developer.apple.com/documentation/foundation/processinfo/islowpowermodeenabled
- https://developer.apple.com/documentation/uikit/uidevice/batterylevel
- https://developer.apple.com/documentation/uikit/uitextcontenttype
- https://developer.apple.com/documentation/uikit/uikeyboardtype/decimalpad
- https://developer.apple.com/documentation/uikit/uipasteboard
- https://developer.apple.com/documentation/uikit/uiapplication/setalternateiconname(_:completionhandler:)
- https://developer.apple.com/documentation/xcode/supporting-universal-links-in-your-app
- https://developer.apple.com/documentation/technotes/tn3156-create-rich-previews-for-messages
- https://developer.apple.com/documentation/nearbyinteraction
- https://developer.apple.com/documentation/corenfc/cardsession
- https://developer.apple.com/documentation/eventkit/accessing-the-event-store
- https://developer.apple.com/documentation/corelocation/monitoring-the-user-s-proximity-to-geographic-regions
- https://developer.apple.com/documentation/messages
- https://developer.apple.com/documentation/authenticationservices/public-private-key-authentication
- https://developer.apple.com/app-store/review/guidelines/ (1.4.3, 1.4.5, 4.5.3, 4.5.4)

Android / Google
- https://developer.android.com/develop/ui/views/notifications/live-update (last updated 2026-10-23)
- https://developer.android.com/develop/ui/compose/glance/glance-app-widget
- https://developer.android.com/develop/ui/views/quicksettings-tiles
- https://developer.android.com/develop/ui/views/notifications/group
- https://developer.android.com/develop/ui/views/notifications/build-notification
- https://developer.android.com/develop/ui/views/notifications/channels
- https://developer.android.com/develop/ui/views/notifications/notification-permission
- https://developer.android.com/develop/ui/views/touch-and-input/copy-paste
- https://developer.android.com/develop/ui/views/launch/shortcuts/creating-shortcuts
- https://developer.android.com/develop/devices/assistant/overview (last updated 2026-07-16)
- https://developer.android.com/ai/appfunctions (last updated 2026-10-22)
- https://developer.android.com/training/app-links
- https://developer.android.com/training/data-storage/shared/photo-picker
- https://developer.android.com/training/data-storage/shared/media
- https://support.google.com/googleplay/android-developer/answer/14115180
- https://developer.android.com/reference/android/os/PowerManager
- https://developer.android.com/training/monitoring-device-state/battery-monitoring
- https://developer.android.com/develop/background-work/services/fgs/service-types
- https://developer.android.com/develop/background-work/services/fgs/timeout
- https://developer.android.com/media/optimize/audio-focus
- https://developer.android.com/guide/topics/text/autofill-optimize
- https://developer.android.com/identity/sign-in/credential-manager
- https://developer.android.com/develop/sensors-and-location/location/geofencing
- https://developer.android.com/develop/background-work/services/alarms/schedule
- https://developer.android.com/about/versions/15/behavior-changes-all
- https://developer.android.com/about/versions/16/behavior-changes-16
- https://developer.android.com/about/versions/16/behavior-changes-all
- https://firebase.google.com/support/dynamic-links-faq
- https://www.9to5google.com/2026/09/28/google-assistant-gemini-android/ (press, 2026-09-28)
- https://androidauthority.com/android-16-notification-cooldown-3501276 and https://9to5google.com/2024/11/19/notification-cooldown-android-16-dp1/ (press, preview builds)

Sharing platforms
- https://developers.facebook.com/docs/instagram-platform/sharing-to-stories
- https://developers.snap.com/snap-kit/creative-kit/overview
- https://developers.tiktok.com/doc/share-kit-ios-quickstart-v2
- https://github.com/WhatsApp/stickers (Android/README.md, iOS/README.md)
- https://faq.whatsapp.com/5913398998672934 (not readable; claim marked [U])

Libraries
- https://docs.expo.dev/versions/latest/sdk/widgets (expo-widgets 58.0.23, npm 2026-10-23)
- https://docs.expo.dev/versions/latest/sdk/app-intents (alpha)
- https://docs.expo.dev/versions/latest/sdk/notifications
- https://docs.expo.dev/versions/latest/sdk/battery
- https://docs.expo.dev/versions/latest/sdk/audio
- https://docs.expo.dev/versions/latest/sdk/video
- https://docs.expo.dev/versions/latest/sdk/haptics
- https://docs.expo.dev/versions/latest/sdk/imagepicker
- https://docs.expo.dev/versions/latest/sdk/imagemanipulator
- https://docs.expo.dev/versions/latest/sdk/calendar
- https://docs.expo.dev/versions/latest/sdk/clipboard
- https://docs.expo.dev/versions/latest/sdk/localization
- https://docs.expo.dev/versions/latest/sdk/keyboard-controller
- https://docs.expo.dev/linking/ios-universal-links
- https://github.com/facebook/react-native-website/blob/main/docs/textinput.md
- https://github.com/facebook/hermes/blob/main/doc/IntlAPIs.md
- npm registry (https://registry.npmjs.org/<pkg>): react-native-android-widget 0.24.0, expo-quick-actions 6.0.2, expo-alternate-app-icons 8.0.0, react-native-share 12.3.1, @bacons/apple-targets 5.0.0, expo-live-activity 0.4.2 (deprecated), voltra 2.4.0, react-native-ble-plx 3.5.1, react-native-nfc-manager 4.1.0, react-native-passkey 3.6.2, @notifee/react-native 9.1.8 (2024-12-20), @formatjs/intl-pluralrules 6.3.16, @formatjs/intl-relativetimeformat 12.3.16, @snapchat/snap-kit-react-native 0.4.0 (2022), react-native-keyboard-controller 1.22.9, expo-background-task 58.0.11
- pub.dev API (https://pub.dev/api/packages/<pkg>): home_widget 0.10.0, live_activities 2.6.0, flutter_local_notifications 22.3.3, quick_actions 1.1.1, app_links 7.2.2, share_plus 13.3.1, appinio_social_share 0.3.3, battery_plus 7.1.2, flutter_app_intents 0.7.0, flutter_image_compress 2.5.1, native_exif 0.8.0, add_2_calendar 3.1.1, flutter_dynamic_icon 2.1.0, flutter_blue_plus 2.3.14

Notifications research
- https://research.duolingo.com/papers/yancey.kdd20.pdf (Yancey & Settles, KDD 2020)

Transit data
- https://prim.iledefrance-mobilites.fr/fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm
- https://transport.data.gouv.fr/datasets?type=public-transit&format=gtfs-rt and https://transport.data.gouv.fr/api/datasets
- https://tfl.gov.uk/info-for/open-data-users/unified-api
- https://tfl.gov.uk/corporate/terms-and-conditions/transport-data-service
- https://api-portal.tfl.gov.uk/
- https://mobilitydatabase.org/

Unsourced facts are marked [U] inline.
