// AES-256-GCM with a fresh random key per item, for chat media (MSG-03) and the history backup (MSG-08).
// The server only ever stores what comes out of seal().
import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { concat, fromBase64, toBase64, utf8 } from "./bytes";

function random(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

export interface SealedMedia {
  /** Nonce followed by ciphertext and tag: what is uploaded. */
  data: Uint8Array;
  /** Travels inside the end-to-end encrypted message, never next to the file. */
  key: string;
}

/** MSG-03: encrypts one file on the device with its own key. */
export function sealMedia(plain: Uint8Array): SealedMedia {
  const key = random(32);
  const nonce = random(12);
  return { data: concat(nonce, gcm(key, nonce).encrypt(plain)), key: toBase64(key) };
}

export function openMedia(data: Uint8Array, key: string): Uint8Array {
  if (data.length < 28) throw new Error("Truncated media");
  return gcm(fromBase64(key), data.subarray(0, 12)).decrypt(data.subarray(12));
}

// Crockford base32 without the letters people confuse (I, L, O, U).
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * MSG-08: the recovery key, 160 random bits written as 8 groups of 4 characters. Only the user has
 * it: the backup on the server cannot be opened without it, by anyone, the server included.
 */
export function newRecoveryKey(): string {
  const bytes = random(20);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += ALPHABET[(value >> bits) & 31];
    }
  }
  return out.match(/.{4}/g)!.join("-");
}

/** Accepts what people type: any case, spaces or dashes, O for 0 and I or L for 1. */
export function normaliseRecoveryKey(input: string): string | null {
  const clean = input.toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
  if (clean.length !== 32 || [...clean].some((c) => !ALPHABET.includes(c))) return null;
  return clean.match(/.{4}/g)!.join("-");
}

function backupKey(recoveryKey: string): Uint8Array {
  const normal = normaliseRecoveryKey(recoveryKey);
  if (!normal) throw new Error("Invalid recovery key");
  // The recovery key is already 160 random bits: a plain HKDF is enough, no password stretching needed.
  return hkdf(sha256, utf8.encode(normal), utf8.encode("soiree-crew/backup/v1"), utf8.encode("history"), 32);
}

const MAGIC = utf8.encode("SCB1");

export function sealBackup(plain: Uint8Array, recoveryKey: string): Uint8Array {
  const nonce = random(12);
  return concat(MAGIC, nonce, gcm(backupKey(recoveryKey), nonce, MAGIC).encrypt(plain));
}

/** Throws when the key is wrong or the file was changed. */
export function openBackup(data: Uint8Array, recoveryKey: string): Uint8Array {
  if (data.length < 32 || utf8.decode(data.subarray(0, 4)) !== "SCB1") throw new Error("Not a backup");
  return gcm(backupKey(recoveryKey), data.subarray(4, 16), MAGIC).decrypt(data.subarray(16));
}
