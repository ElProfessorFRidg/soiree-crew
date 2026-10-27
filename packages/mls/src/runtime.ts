import { subtle } from "./subtle";

type RandomFill = <T extends ArrayBufferView>(array: T) => T;

/**
 * Gives the engine what ts-mls expects from a browser: crypto.getRandomValues, crypto.subtle and
 * TextDecoder. Engines that have them (Node, browsers) keep their own; Hermes gets the noble shim
 * and the platform's random source, passed in by the app (expo-crypto).
 */
export function installCrypto(getRandomValues?: RandomFill): void {
  const g = globalThis as { crypto?: { getRandomValues?: RandomFill; subtle?: unknown } };
  const current = g.crypto ?? {};
  const random = current.getRandomValues?.bind(current) ?? getRandomValues;
  if (!random) throw new Error("No secure random source");
  if (!current.getRandomValues || !current.subtle) {
    Object.defineProperty(globalThis, "crypto", {
      value: { ...current, getRandomValues: random, subtle: current.subtle ?? subtle },
      configurable: true,
      writable: true,
    });
  }
  if (typeof (globalThis as { TextDecoder?: unknown }).TextDecoder === "undefined") {
    (globalThis as { TextDecoder?: unknown }).TextDecoder = Utf8Decoder;
  }
}

/** UTF-8 only, with replacement characters for broken input, like the standard decoder. */
class Utf8Decoder {
  readonly encoding = "utf-8";
  decode(input?: BufferSource): string {
    if (!input) return "";
    const b = input instanceof Uint8Array ? input : ArrayBuffer.isView(input) ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength) : new Uint8Array(input);
    let out = "";
    for (let i = 0; i < b.length; ) {
      const c = b[i]!;
      let code = 0xfffd;
      let size = 1;
      if (c < 0x80) code = c;
      else if (c >= 0xc2 && c < 0xe0 && i + 1 < b.length && (b[i + 1]! & 0xc0) === 0x80) {
        code = ((c & 0x1f) << 6) | (b[i + 1]! & 0x3f);
        size = 2;
      } else if (c >= 0xe0 && c < 0xf0 && i + 2 < b.length && (b[i + 1]! & 0xc0) === 0x80 && (b[i + 2]! & 0xc0) === 0x80) {
        const v = ((c & 0x0f) << 12) | ((b[i + 1]! & 0x3f) << 6) | (b[i + 2]! & 0x3f);
        if (v >= 0x800 && (v < 0xd800 || v > 0xdfff)) {
          code = v;
          size = 3;
        }
      } else if (c >= 0xf0 && c < 0xf5 && i + 3 < b.length && (b[i + 1]! & 0xc0) === 0x80 && (b[i + 2]! & 0xc0) === 0x80 && (b[i + 3]! & 0xc0) === 0x80) {
        const v = ((c & 0x07) << 18) | ((b[i + 1]! & 0x3f) << 12) | ((b[i + 2]! & 0x3f) << 6) | (b[i + 3]! & 0x3f);
        if (v >= 0x10000 && v <= 0x10ffff) {
          code = v;
          size = 4;
        }
      }
      out += String.fromCodePoint(code);
      i += size;
    }
    return out;
  }
}
