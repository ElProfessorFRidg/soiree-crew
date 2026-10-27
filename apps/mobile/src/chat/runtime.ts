import * as Crypto from "expo-crypto";
import { installCrypto } from "@crew/mls";

// Imported first by the root layout: Hermes has no WebCrypto, so the MLS library gets the noble
// shim and the operating system's random source before anything uses it (ADR 0005).
installCrypto(<T extends ArrayBufferView>(array: T): T => {
  Crypto.getRandomValues(array as unknown as Uint8Array);
  return array;
});
