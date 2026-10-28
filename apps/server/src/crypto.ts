import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";

// Vetted primitives from Node's crypto module only (SEC-04, no home-made cryptography).

export function newId(): string {
  return randomUUID();
}

/** 256-bit random token, URL-safe. Only its hash is stored. */
export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Short code typed or scanned on a second device: 10 characters from an unambiguous alphabet. */
export function newCode(length = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  // Rejection sampling: bytes above the last full multiple of the alphabet would bias the code.
  const limit = 256 - (256 % alphabet.length);
  let code = "";
  while (code.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte < limit && code.length < length) code += alphabet[byte % alphabet.length];
    }
  }
  return code;
}

// OWASP's floor for scrypt (2^17, r 8, p 1): about 128 MiB per hash. Older hashes keep their own parameters.
const SCRYPT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

function scryptAsync(password: string, salt: Buffer, length: number, options: typeof SCRYPT): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, length, options, (err, key) => (err ? reject(err) : resolve(key))));
}

/** O-01: scrypt with a random salt; the parameters travel with the hash so they can be raised later. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize("NFKC"), salt, 32, SCRYPT);
  return ["scrypt", SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  const actual = await scryptAsync(password.normalize("NFKC"), Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return timingSafeEqual(actual, expected);
}

/** A hash to compare against when no account matches, so both paths cost the same. */
export const DUMMY_PASSWORD_HASH = "scrypt$131072$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

/** Application-level envelope for health data: AES-256-GCM, key from the environment. */
export class Sealer {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    const key = Buffer.from(base64Key, "base64");
    if (key.length !== 32) throw new Error("DATA_KEY must be 32 bytes, base64-encoded");
    this.key = key;
  }

  seal(value: unknown): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const body = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), body.toString("base64")].join(".");
  }

  /** Keyed hash for looking a value up (an email) without storing it in clear. */
  lookup(value: string): string {
    return createHmac("sha256", createHmac("sha256", this.key).update("lookup").digest()).update(value).digest("hex");
  }

  open<T>(sealed: string): T {
    const [version, iv, tag, body] = sealed.split(".");
    if (version !== "v1" || !iv || !tag || !body) throw new Error("Unknown sealed format");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(body, "base64")), decipher.final()]);
    return JSON.parse(plain.toString("utf8")) as T;
  }
}
