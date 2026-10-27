import { webcrypto } from "node:crypto";
import { x25519 } from "@noble/curves/ed25519.js";
import { describe, expect, it } from "vitest";
import { subtle as shim } from "./subtle";

// Differential check: every operation the shim offers gives what Node's real WebCrypto gives.
const real = webcrypto.subtle;
const rnd = (n: number) => webcrypto.getRandomValues(new Uint8Array(n));
const same = (a: ArrayBuffer | Uint8Array, b: ArrayBuffer | Uint8Array) => Buffer.from(a as ArrayBuffer).equals(Buffer.from(b as ArrayBuffer));

describe("WebCrypto shim", () => {
  it("matches WebCrypto for HMAC, HKDF and AES-GCM", async () => {
    for (let i = 0; i < 20; i++) {
      const key = rnd(32);
      const data = rnd(i * 7);
      for (const hash of ["SHA-256", "SHA-384", "SHA-512"]) {
        const a = await real.sign("HMAC", await real.importKey("raw", key, { name: "HMAC", hash }, false, ["sign"]), data);
        const b = await shim.sign("HMAC", await shim.importKey("raw", key, { name: "HMAC", hash }, false, ["sign"]), data);
        expect(same(a, b)).toBe(true);
      }
      const salt = rnd(i % 33);
      const info = rnd(i % 9);
      const ha = await real.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await real.importKey("raw", key, "HKDF", false, ["deriveBits"]), 336);
      const hb = await shim.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, await shim.importKey("raw", key, "HKDF", false, ["deriveBits"]), 336);
      expect(same(ha, hb)).toBe(true);

      const aes = rnd(i % 2 ? 16 : 32);
      const iv = rnd(12);
      const additionalData = rnd(i % 5);
      const plain = rnd(i * 3);
      const ca = await real.encrypt({ name: "AES-GCM", iv, additionalData }, await real.importKey("raw", aes, "AES-GCM", false, ["encrypt"]), plain);
      const sk = await shim.importKey("raw", aes, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
      expect(same(ca, await shim.encrypt({ name: "AES-GCM", iv, additionalData }, sk, plain))).toBe(true);
      expect(same(await shim.decrypt({ name: "AES-GCM", iv, additionalData }, sk, ca), plain)).toBe(true);
      const bad = new Uint8Array(ca);
      bad[0]! ^= 1;
      await expect(shim.decrypt({ name: "AES-GCM", iv, additionalData }, sk, bad)).rejects.toMatchObject({ name: "OperationError" });
    }
  });

  it("interoperates with WebCrypto for X25519 and Ed25519", async () => {
    for (let i = 0; i < 10; i++) {
      const rk = (await real.generateKey("X25519", true, ["deriveBits"])) as CryptoKeyPair;
      const sx = await shim.generateKey("X25519", true, ["deriveBits"]);
      const rPub = await real.exportKey("raw", rk.publicKey);
      const sPub = (await shim.exportKey("raw", sx.publicKey)) as ArrayBuffer;
      const s1 = await real.deriveBits({ name: "X25519", public: await real.importKey("raw", sPub, "X25519", true, []) }, rk.privateKey, 256);
      const s2 = await shim.deriveBits({ name: "X25519", public: await shim.importKey("raw", rPub, "X25519", true, []) }, sx.privateKey, 256);
      expect(same(s1, s2)).toBe(true);

      const pk8 = (await shim.exportKey("pkcs8", sx.privateKey)) as ArrayBuffer;
      const jwkReal = await real.exportKey("jwk", await real.importKey("pkcs8", pk8, "X25519", true, ["deriveBits"]));
      const jwkShim = (await shim.exportKey("jwk", sx.privateKey)) as { d: string; x: string };
      expect([jwkReal.d, jwkReal.x]).toEqual([jwkShim.d, jwkShim.x]);
      const fromReal = await shim.importKey("pkcs8", await real.exportKey("pkcs8", rk.privateKey), "X25519", true, ["deriveBits"]);
      expect(same(x25519.getPublicKey(fromReal.raw), rPub)).toBe(true);

      const ek = await shim.generateKey("Ed25519", true, ["sign", "verify"]);
      const message = rnd(i * 11);
      const signature = await shim.sign("Ed25519", ek.privateKey, message);
      const realPublic = await real.importKey("raw", (await shim.exportKey("raw", ek.publicKey)) as ArrayBuffer, "Ed25519", false, ["verify"]);
      expect(await real.verify("Ed25519", realPublic, signature, message)).toBe(true);
      const realPrivate = await real.importKey("pkcs8", (await shim.exportKey("pkcs8", ek.privateKey)) as ArrayBuffer, "Ed25519", false, ["sign"]);
      expect(same(await real.sign("Ed25519", realPrivate, message), signature)).toBe(true);
      const tampered = new Uint8Array(signature);
      tampered[5]! ^= 4;
      expect(await shim.verify("Ed25519", ek.publicKey, tampered, message)).toBe(false);
    }
  });

  it("refuses a low-order X25519 point, a private key export as raw, and unknown algorithms", async () => {
    const pair = await shim.generateKey("X25519", true, ["deriveBits"]);
    const zero = await shim.importKey("raw", new Uint8Array(32), "X25519", true, []);
    await expect(shim.deriveBits({ name: "X25519", public: zero }, pair.privateKey, 256)).rejects.toThrow();
    await expect(shim.exportKey("raw", pair.privateKey)).rejects.toThrow();
    await expect(shim.importKey("raw", rnd(16), "RSA-OAEP", false, [])).rejects.toThrow();
  });
});
