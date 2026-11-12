import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

// O-01: "Continue with Apple". The phone only collects what Apple signed; the server checks the
// signature, the audience, the expiry and the nonce before it believes any of it.

export interface AppleResult {
  identityToken: string;
  /** The raw nonce; Apple signed its SHA-256 into the token, the server hashes this one and compares. */
  nonce: string;
  /** Apple gives the name once, the first time; null on later sign-ins or when the person hid it. */
  givenName: string | null;
}

export async function appleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/** Opens Apple's own sheet. Returns null when the person closes it. */
export async function askApple(): Promise<AppleResult | null> {
  const nonce = Crypto.randomUUID();
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME],
      nonce: hashed,
    });
    if (!credential.identityToken) return null;
    return {
      identityToken: credential.identityToken,
      nonce,
      givenName: credential.fullName?.givenName?.trim() || null,
    };
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
}
