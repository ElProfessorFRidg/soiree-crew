# Native iPhone, native iPad and re-signed installs

Public and Preview are separate app identities (`app.soireecrew.mobile` and `app.soireecrew.mobile.preview`). The same ID is retained between iPhone/iPad variants within each channel. AltStore has device-specific sources, each with its own immutable public/Preview release downloads; see `ALTSTORE.md`.

`CREW_IOS_TARGET` selects the native target at prebuild and JavaScript bundling. CI builds each target independently. The default development configuration is universal. The iPad target enables tablet support, portrait and landscape, and allows multitasking rather than requiring full screen.

CI supplies two independently compiled downloads:

- `soiree-crew-unsigned.ipa`: the regular iPhone download.
- `soiree-crew-ipad-unsigned.ipa`: the native iPad download, `UIDeviceFamily = [2]`. This replaces the old `ipad-compat` artifact. It has its own tablet interface rather than the system's enlarged phone window.

Both retain the same bundle ID so an iPad installation can replace the previous compatibility build while retaining its local data. `ios-build-info-iphone.json` and `ios-build-info-ipad.json` record the bundle ID, actual minimum OS, device family and orientations. CI rejects incorrect families, iPad builds without landscape, and missing/empty executable or JavaScript payloads. Each simulator downloads its matching target. Simulator execution re-marks the device binaries and is a smoke test, not a physical-device or TrollStore certification.

Layout follows the current window width, including rotation and Split View. At 768 points the bottom tabs become a compact navigation rail; at 1180 they expand into a labelled sidebar. Narrow iPad windows retain the same JavaScript navigator with bottom tabs, preserving navigation state while resizing. iPhone retains its native tabs.

The party dashboard uses two columns when space permits. The map and selected bar/details occupy separate panes; map fitting uses the actual map pane width after subtracting navigation and gutters. The games catalogue uses two or three columns instead of stretching the phone carousel. Reading and form screens remain centred at a readable width. Content is capped on very large windows, with no phone compatibility frame or system zoom control.

The native splash has a JavaScript watchdog independent of fonts, persisted state, Keychain promises and animation completion. A ready root or crash boundary also hides it. The launch curtain has its own timeout, so a missing Reanimated completion callback cannot leave the logo covering the app. Existing font, hydration and Keychain deadlines remain in place. These changes cover stalled JavaScript/native promises after JavaScript starts; they cannot repair an OS rejecting the executable before JavaScript runs.

## Startup diagnostics, including before JavaScript

`withStartupDiagnostics` applies the diagnostic to the generated native project at every prebuild. No generated Xcode files are maintained by hand. UIKit gets the concrete `SceneDelegate.self` type in the app delegate's scene configuration. The manifest uses `SceneDelegate`, matching the generated `@objc(SceneDelegate)` runtime name, rather than relying on a module-qualified class name being resolved by each OS version.

An independent UIKit window draws the startup status before React starts. React's scene connection is deferred by 150 ms to allow that first native frame; the superclass still receives the original scene connection options, including cold-start links and quick actions. The diagnostic does not become the key window. It disappears only after the first React layout and the launch curtain's completion (including its deadline fallback). A mounted crash boundary also removes it so the boundary's recovery controls remain accessible.

After eight seconds, the native screen exposes **Copy diagnostic**, even when JavaScript has never started. It shows native scene/React milestones and the JavaScript entry, router, root, fonts, local data, Keychain/account, first layout and launch curtain states. Failed and timed-out Keychain reads appear as a fallback. This screen uses system fonts and UIKit, with no dependency on Reanimated, persisted app state, the Keychain or a server response. It supports narrow windows, rotation, scrolling, Dynamic Type and VoiceOver. Native copy is French on a French system and English otherwise.

The copied report contains only a fixed milestone/status vocabulary, elapsed times, app version/build, bundle identifier, hardware model, OS and minimum OS. It excludes exception messages, URLs, credentials and account/history contents. Only the current report and the previous incomplete launch are kept, bounded to 8,000 characters each, in app-local preferences; copying is an explicit user action. The diagnostic never resets app data or sends a report to a server.

The static launch storyboard includes `SC00`. If the OS continues to show only that snapshot, the native diagnostic has not managed to draw: an OS/device console log is still needed. A main-thread stall or rejection before the app can draw cannot be diagnosed by a JavaScript timeout. `SC01` confirms native app launch, `SC02` a connected window, `SC03` the request to start React, and `SC04` onward the JavaScript stages. `SC13` confirms that the first interface is visible.

CI validates the scene manifest and diagnostic version in the actual packed IPA. Both native targets additionally launch with the **process-only** argument `-crewStartupTestNoJS`: React is deliberately not started, the native diagnostic and its copy control must become visible, and a screenshot/log are retained. A subsequent normal launch with `-crewStartupTestRecovery` must reach the interface again. Neither argument comes from a URL or persists into the next process. There are 18 captures per target, including these two cases, and publication remains gated on both targets passing.

For an iPad 9 / iPadOS 17.4.1 / TrollStore Lite report, install the matching **iPad Preview** IPA alongside the public app, without removing the original installation. If startup still stalls, wait for the diagnostic and copy its report. This distinguishes a scene/engine/import problem from font, storage or Keychain delays. Simulator checks do not reproduce that physical device's installer, jailbreak, injected tweaks or entitlements; a successful simulator run alone does not identify the cause on that iPad.

The published public iPad build 117 (0.2.5) was inspected during this investigation: its executable and embedded native libraries contain arm64 slices, and their recorded minimum OS versions do not exceed 16.4. This rules out a simple newer-minimum-OS or arm64e-only payload in that archive, but does not prove that every runtime interaction on iPadOS 17.4.1 works.

For a TrollStore-only failure, compare the device's OS to the actual `minimumOSVersion` in the build-info file, and retain its crash/console log, model and installed build number. TrollStore's supported OS range and the Expo/React Native minimum OS are independent. Do not lower `MinimumOSVersion` in a finished IPA to pretend unsupported native APIs are available. The IPA remains unsigned; use a compatible installer/signing method. CI cannot emulate TrollStore's entitlements or a particular physical device.
