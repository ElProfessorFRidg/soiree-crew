import { sha256 } from "@noble/hashes/sha2.js";
import { utf8 } from "./bytes";

/** SHA-256 of a string, as lowercase hex (the AC-12 event chain uses it on both sides). */
export function sha256Hex(text: string): string {
  return Array.from(sha256(utf8.encode(text)), (b) => b.toString(16).padStart(2, "0")).join("");
}
