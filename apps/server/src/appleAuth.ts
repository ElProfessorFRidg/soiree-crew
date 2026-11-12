import { createHash, createPublicKey, createVerify } from "node:crypto";
import { HttpError } from "./context";

// O-01: "Continue with Apple". The phone sends the identity token Apple signed; nothing in it is
// believed until the signature, the issuer, the audience, the expiry and the nonce check out.

const ISSUER = "https://appleid.apple.com";
const KEYS_URL = "https://appleid.apple.com/auth/keys";
const KEYS_TTL_MS = 60 * 60_000;

export interface AppleJwk {
  kty?: string;
  n?: string;
  e?: string;
  kid?: string;
  alg?: string;
}

export interface AppleAuth {
  /** Accepted audiences: the app's bundle id (and a Services id for the web, when there is one). */
  clientIds: string[];
  /** Apple's public signing keys. */
  keys: () => Promise<AppleJwk[]>;
}

/** Apple's keys fetched from Apple, kept for an hour. */
export function appleAuthFromEnv(env: NodeJS.ProcessEnv): AppleAuth {
  const clientIds = (env.APPLE_CLIENT_ID ?? "app.soireecrew.mobile")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  let cached: { at: number; keys: AppleJwk[] } | null = null;
  return {
    clientIds,
    keys: async () => {
      if (cached && Date.now() - cached.at < KEYS_TTL_MS) return cached.keys;
      const res = await fetch(KEYS_URL, { signal: AbortSignal.timeout(5_000) });
      if (!res.ok) throw new HttpError(503, "apple_unavailable");
      const body = (await res.json()) as { keys?: AppleJwk[] };
      cached = { at: Date.now(), keys: body.keys ?? [] };
      return cached.keys;
    },
  };
}

export interface AppleIdentity {
  sub: string;
  email: string | null;
}

const part = (text: string): Record<string, unknown> => {
  try {
    return JSON.parse(Buffer.from(text, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    throw new HttpError(401, "apple_token_invalid");
  }
};

/** The raw nonce the phone made; Apple signs its SHA-256 (hex) into the token. */
export const nonceHash = (nonce: string): string => createHash("sha256").update(nonce).digest("hex");

export async function verifyAppleToken(auth: AppleAuth, token: string, nonce: string, nowMs: number): Promise<AppleIdentity> {
  const pieces = token.split(".");
  if (pieces.length !== 3) throw new HttpError(401, "apple_token_invalid");
  const [head, body, signature] = pieces as [string, string, string];
  const header = part(head);
  if (header.alg !== "RS256" || typeof header.kid !== "string") throw new HttpError(401, "apple_token_invalid");
  const jwk = (await auth.keys()).find((key) => key.kid === header.kid);
  if (!jwk) throw new HttpError(401, "apple_token_invalid");
  const valid = createVerify("RSA-SHA256").update(`${head}.${body}`).verify(createPublicKey({ key: jwk, format: "jwk" }), Buffer.from(signature, "base64url"));
  if (!valid) throw new HttpError(401, "apple_token_invalid");
  const claims = part(body);
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  const audience = typeof claims.aud === "string" ? claims.aud : "";
  if (claims.iss !== ISSUER || !auth.clientIds.includes(audience) || exp * 1000 <= nowMs) throw new HttpError(401, "apple_token_invalid");
  if (claims.nonce !== nonceHash(nonce)) throw new HttpError(401, "apple_token_invalid");
  if (typeof claims.sub !== "string" || !claims.sub) throw new HttpError(401, "apple_token_invalid");
  return { sub: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
