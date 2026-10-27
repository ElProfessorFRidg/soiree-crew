const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = new Map([...B64].map((c, i) => [c, i]));

/** Standard base64, padded. Written out so it does not depend on btoa, Buffer or the engine. */
export function toBase64(data: Uint8Array): string {
  let out = "";
  for (let i = 0; i < data.length; i += 3) {
    const a = data[i]!;
    const b = data[i + 1];
    const c = data[i + 2];
    out += B64[a >> 2]! + B64[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
    out += b === undefined ? "=" : B64[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
    out += c === undefined ? "=" : B64[c & 63]!;
  }
  return out;
}

export function fromBase64(text: string): Uint8Array {
  const clean = text.replace(/=+$/, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let bits = 0;
  let value = 0;
  let index = 0;
  for (const char of clean) {
    const v = LOOKUP.get(char);
    if (v === undefined) throw new Error("Invalid base64");
    value = (value << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[index++] = (value >> bits) & 0xff;
    }
  }
  return out.subarray(0, index);
}

export const toBase64Url = (data: Uint8Array): string => toBase64(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromBase64Url = (text: string): Uint8Array => fromBase64(text.replace(/-/g, "+").replace(/_/g, "/"));

export function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Constant-time comparison. */
export function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export const utf8 = {
  encode: (text: string): Uint8Array => new TextEncoder().encode(text),
  decode: (data: Uint8Array): string => new TextDecoder().decode(data),
};
