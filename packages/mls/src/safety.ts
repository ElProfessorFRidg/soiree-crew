import { sha512 } from "@noble/hashes/sha2.js";
import { concat, toBase64, utf8 } from "./bytes";

const ITERATIONS = 5200;
const VERSION = new Uint8Array([0, 0]);

export interface Party {
  userId: string;
  /** Signature public keys of every device of this person. */
  keys: Uint8Array[];
}

/** Keys in a fixed order, so the same set of devices always gives the same number. */
function keyBlock(keys: Uint8Array[]): Uint8Array {
  return concat(...[...keys].sort((a, b) => (toBase64(a) < toBase64(b) ? -1 : 1)));
}

/** 30 digits for one person: Signal's numeric fingerprint (iterated SHA-512), over all their devices. */
export function fingerprint(party: Party): string {
  const block = keyBlock(party.keys);
  let hash = sha512(concat(VERSION, block, utf8.encode(party.userId)));
  for (let i = 1; i < ITERATIONS; i++) hash = sha512(concat(hash, block));
  let digits = "";
  for (let chunk = 0; chunk < 6; chunk++) {
    let value = 0;
    // Five bytes as a big-endian 40-bit number, then its last five decimal digits.
    for (let i = 0; i < 5; i++) value = value * 256 + hash[chunk * 5 + i]!;
    digits += String(value % 100_000).padStart(5, "0");
  }
  return digits;
}

/**
 * MSG-05: the number two people compare. The same on both phones: the two halves are ordered,
 * so neither side has to know who is "first".
 */
export function safetyNumber(a: Party, b: Party): string {
  return [fingerprint(a), fingerprint(b)].sort().join("");
}

/** 60 digits in 12 groups of five, the way they are shown and read out. */
export function groupDigits(number: string): string[] {
  return number.match(/.{1,5}/g) ?? [];
}

/** A short tag for a set of keys: lets the app notice that someone's devices changed. */
export function keySetTag(keys: Uint8Array[]): string {
  return toBase64(sha512(keyBlock(keys)).subarray(0, 12));
}
