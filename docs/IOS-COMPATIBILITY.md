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

For a TrollStore-only failure, compare the device's OS to the actual `minimumOSVersion` in the build-info file, and retain its crash/console log, model and installed build number. TrollStore's supported OS range and the Expo/React Native minimum OS are independent. Do not lower `MinimumOSVersion` in a finished IPA to pretend unsupported native APIs are available. The IPA remains unsigned; use a compatible installer/signing method. CI cannot emulate TrollStore's entitlements or a particular physical device.
