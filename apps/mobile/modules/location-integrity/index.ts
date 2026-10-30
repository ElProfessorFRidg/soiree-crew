import { requireOptionalNativeModule } from "expo";

export interface LocationIntegrity {
  available: boolean;
  /** iOS 15+: the fix came from a simulator or a spoofing tool. */
  simulatedBySoftware?: boolean;
  /** iOS 15+: the fix came from an external accessory (car, GPS dongle). */
  producedByAccessory?: boolean;
}

const native = requireOptionalNativeModule<{ checkAsync(): Promise<LocationIntegrity> }>("LocationIntegrity");

/** AC-02: null where the native module does not exist (Android, web, an old build). */
export function checkLocationIntegrity(): Promise<LocationIntegrity> | null {
  return native ? native.checkAsync() : null;
}
