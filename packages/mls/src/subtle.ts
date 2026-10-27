// The subset of WebCrypto's SubtleCrypto that ts-mls and @hpke/core call, over the audited noble
// primitives, for engines that ship crypto.getRandomValues but no crypto.subtle (Hermes).
// Every algorithm here is a published standard implemented by noble; this file only adapts the API.
import { gcm } from "@noble/ciphers/aes.js";
import { ed25519, x25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256, sha384, sha512 } from "@noble/hashes/sha2.js";
import { fromBase64Url, sameBytes, toBase64Url } from "./bytes";

type Hash = typeof sha256 | typeof sha384 | typeof sha512;
type Name = "HMAC" | "HKDF" | "AES-GCM" | "Ed25519" | "X25519";
type CurveName = "Ed25519" | "X25519";

interface ShimKey {
  type: "secret" | "private" | "public";
  algorithm: { name: Name };
  extractable: boolean;
  usages: string[];
  raw: Uint8Array;
  hash?: Hash;
}

interface Jwk {
  kty?: string;
  crv?: string;
  x?: string;
  d?: string;
}

type Algorithm = string | { name: string; hash?: string | { name: string }; salt?: BufferSource; info?: BufferSource; iv?: BufferSource; additionalData?: BufferSource; public?: ShimKey };

const HASHES: Record<string, Hash> = { "SHA-256": sha256, "SHA-384": sha384, "SHA-512": sha512 };
const NAMES: Record<string, Name> = { HMAC: "HMAC", HKDF: "HKDF", "AES-GCM": "AES-GCM", ED25519: "Ed25519", X25519: "X25519" };
const CURVES = { Ed25519: ed25519, X25519: x25519 };
// PKCS#8 prefixes for a 32-byte Ed25519 / X25519 private key (RFC 8410).
const PKCS8: Record<CurveName, Uint8Array> = {
  Ed25519: new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]),
  X25519: new Uint8Array([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]),
};
const PRIVATE_USES: Record<CurveName, string[]> = { Ed25519: ["sign"], X25519: ["deriveBits", "deriveKey"] };

function fail(message: string, kind = "NotSupportedError"): Error {
  const error = new Error(message);
  error.name = kind;
  return error;
}

function bytes(source: BufferSource | undefined): Uint8Array {
  if (source === undefined) return new Uint8Array(0);
  if (source instanceof Uint8Array) return source;
  if (ArrayBuffer.isView(source)) return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  return new Uint8Array(source);
}

const out = (value: Uint8Array): ArrayBuffer => value.slice().buffer as ArrayBuffer;
const isCurve = (name: Name): name is CurveName => name === "Ed25519" || name === "X25519";

function algName(algorithm: Algorithm): Name {
  const raw = typeof algorithm === "string" ? algorithm : algorithm.name;
  const name = NAMES[raw.toUpperCase()];
  if (!name) throw fail(`Unsupported algorithm ${raw}`);
  return name;
}

function hashOf(algorithm: Algorithm): Hash {
  const raw = typeof algorithm === "string" ? undefined : typeof algorithm.hash === "string" ? algorithm.hash : algorithm.hash?.name;
  const hash = raw ? HASHES[raw.toUpperCase()] : undefined;
  if (!hash) throw fail(`Unsupported hash ${String(raw)}`);
  return hash;
}

function need(key: ShimKey | undefined, name: Name, type?: ShimKey["type"]): ShimKey {
  if (!key || key.algorithm.name !== name || (type && key.type !== type)) throw fail("Key does not match the operation", "InvalidAccessError");
  return key;
}

const shimKey = (type: ShimKey["type"], name: Name, raw: Uint8Array, extractable: boolean, usages: string[], hash?: Hash): ShimKey => ({
  type,
  algorithm: { name },
  extractable,
  usages,
  raw,
  ...(hash ? { hash } : {}),
});

function aesGcm(algorithm: Algorithm, key: ShimKey) {
  if (typeof algorithm === "string" || algName(algorithm) !== "AES-GCM") throw fail("AES-GCM needs its parameters");
  return gcm(need(key, "AES-GCM").raw, bytes(algorithm.iv), algorithm.additionalData ? bytes(algorithm.additionalData) : undefined);
}

export const subtle = {
  async generateKey(algorithm: Algorithm, extractable: boolean, usages: string[]) {
    const name = algName(algorithm);
    if (!isCurve(name)) throw fail(`generateKey ${name}`);
    const curve = CURVES[name];
    const secret = curve.utils.randomSecretKey();
    return {
      privateKey: shimKey("private", name, secret, extractable, usages.filter((u) => PRIVATE_USES[name].includes(u))),
      publicKey: shimKey("public", name, curve.getPublicKey(secret), true, usages.filter((u) => u === "verify")),
    };
  },

  async importKey(format: string, keyData: BufferSource | Jwk, algorithm: Algorithm, extractable: boolean, usages: string[]): Promise<ShimKey> {
    const name = algName(algorithm);
    if (isCurve(name)) {
      const curve = CURVES[name];
      if (format === "raw") {
        const raw = bytes(keyData as BufferSource);
        if (raw.length !== 32) throw fail("Bad public key", "DataError");
        return shimKey("public", name, raw.slice(), extractable, usages);
      }
      if (format === "pkcs8") {
        const der = bytes(keyData as BufferSource);
        if (der.length !== 48 || !sameBytes(der.subarray(0, 16), PKCS8[name])) throw fail("Bad private key", "DataError");
        return shimKey("private", name, der.slice(16), extractable, usages);
      }
      if (format === "jwk") {
        const jwk = keyData as Jwk;
        if (jwk.kty !== "OKP" || jwk.crv !== name) throw fail("Bad JWK", "DataError");
        if (jwk.d !== undefined) {
          const secret = fromBase64Url(jwk.d);
          if (secret.length !== 32) throw fail("Bad JWK", "DataError");
          if (jwk.x !== undefined && !sameBytes(fromBase64Url(jwk.x), curve.getPublicKey(secret))) throw fail("JWK x does not match d", "DataError");
          return shimKey("private", name, secret, extractable, usages);
        }
        const publicKey = fromBase64Url(jwk.x ?? "");
        if (publicKey.length !== 32) throw fail("Bad JWK", "DataError");
        return shimKey("public", name, publicKey, extractable, usages);
      }
      throw fail(`importKey ${format} ${name}`);
    }
    if (format !== "raw") throw fail(`importKey ${format} ${name}`);
    return shimKey("secret", name, bytes(keyData as BufferSource).slice(), extractable, usages, name === "HMAC" ? hashOf(algorithm) : undefined);
  },

  async exportKey(format: string, key: ShimKey): Promise<ArrayBuffer | Jwk> {
    if (!key.extractable) throw fail("Key is not extractable", "InvalidAccessError");
    const name = key.algorithm.name;
    if (format === "raw" && key.type !== "private") return out(key.raw);
    if (isCurve(name) && format === "pkcs8" && key.type === "private") {
      const der = new Uint8Array(48);
      der.set(PKCS8[name]);
      der.set(key.raw, 16);
      return out(der);
    }
    if (isCurve(name) && format === "jwk") {
      const publicKey = key.type === "private" ? CURVES[name].getPublicKey(key.raw) : key.raw;
      const jwk: Jwk & { ext: boolean; key_ops: string[] } = { kty: "OKP", crv: name, x: toBase64Url(publicKey), ext: true, key_ops: [...key.usages] };
      if (key.type === "private") jwk.d = toBase64Url(key.raw);
      return jwk;
    }
    throw fail(`exportKey ${format} ${name}`);
  },

  async sign(algorithm: Algorithm, key: ShimKey, data: BufferSource): Promise<ArrayBuffer> {
    const name = algName(algorithm);
    if (name === "Ed25519") return out(ed25519.sign(bytes(data), need(key, name, "private").raw));
    if (name === "HMAC") return out(hmac(need(key, name).hash as Hash, key.raw, bytes(data)));
    throw fail(`sign ${name}`);
  },

  async verify(algorithm: Algorithm, key: ShimKey, signature: BufferSource, data: BufferSource): Promise<boolean> {
    const name = algName(algorithm);
    if (name === "Ed25519") {
      try {
        return ed25519.verify(bytes(signature), bytes(data), need(key, name, "public").raw);
      } catch {
        return false;
      }
    }
    if (name === "HMAC") return sameBytes(hmac(need(key, name).hash as Hash, key.raw, bytes(data)), bytes(signature));
    throw fail(`verify ${name}`);
  },

  async deriveBits(algorithm: Algorithm, key: ShimKey, length?: number | null): Promise<ArrayBuffer> {
    const name = algName(algorithm);
    if (typeof algorithm === "string") throw fail(`deriveBits ${name} needs its parameters`);
    if (name === "HKDF") return out(hkdf(hashOf(algorithm), need(key, name).raw, bytes(algorithm.salt), bytes(algorithm.info), (length ?? 0) / 8));
    if (name === "X25519") {
      const shared = x25519.getSharedSecret(need(key, name, "private").raw, need(algorithm.public, name, "public").raw);
      // WebCrypto refuses an all-zero result (a low-order public key); so does this.
      if (shared.every((b) => b === 0)) throw fail("X25519 produced an all-zero secret", "OperationError");
      return out(length == null ? shared : shared.subarray(0, length / 8));
    }
    throw fail(`deriveBits ${name}`);
  },

  async encrypt(algorithm: Algorithm, key: ShimKey, data: BufferSource): Promise<ArrayBuffer> {
    return out(aesGcm(algorithm, key).encrypt(bytes(data)));
  },

  async decrypt(algorithm: Algorithm, key: ShimKey, data: BufferSource): Promise<ArrayBuffer> {
    const cipher = aesGcm(algorithm, key);
    try {
      return out(cipher.decrypt(bytes(data)));
    } catch {
      throw fail("The operation failed for an operation-specific reason", "OperationError");
    }
  },
};
