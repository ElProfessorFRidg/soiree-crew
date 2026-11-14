# iPhone, iPad compatibility and re-signed installs

`ios.supportsTablet` remains false. The device build must have `UIDeviceFamily = [1]`: this is the iPhone interface running in iPadOS compatibility mode, with the system's enlargement control where provided by iPadOS. A universal `[1, 2]` build would opt into native tablet layout and would not provide that iPhone compatibility mode.

CI supplies two separately named downloads from the same validated binary:

- `soiree-crew-unsigned.ipa`: the regular iPhone download.
- `soiree-crew-ipad-compat-unsigned.ipa`: the separately named iPad compatibility download. It intentionally has the same bundle ID and payload, so installing one replaces the other.

`ios-build-info.json` records the bundle ID, actual minimum iOS version and device family from the built app. CI rejects a missing/empty executable or JavaScript bundle before packaging. Both iPhone and iPad simulators run the launch/screen checks. Simulator execution re-marks the device binaries and is a smoke test, not a physical-device or TrollStore certification.

The native splash has a JavaScript watchdog independent of fonts, persisted state, Keychain promises and animation completion. A ready root or crash boundary also hides it. The launch curtain has its own timeout, so a missing Reanimated completion callback cannot leave the logo covering the app. Existing font, hydration and Keychain deadlines remain in place. These changes cover stalled JavaScript/native promises after JavaScript starts; they cannot repair an OS rejecting the executable before JavaScript runs.

For a TrollStore-only failure, compare the device's OS to the actual `minimumOSVersion` in the build-info file, and retain its crash/console log, model and installed build number. TrollStore's supported OS range and the Expo/React Native minimum OS are independent. Do not lower `MinimumOSVersion` in a finished IPA to pretend unsupported native APIs are available. The IPA remains unsigned; use a compatible installer/signing method. CI cannot emulate TrollStore's entitlements or a particular physical device.
