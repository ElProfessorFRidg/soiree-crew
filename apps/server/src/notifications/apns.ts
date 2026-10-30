import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import { connect, constants, type ClientHttp2Session } from "node:http2";
import type { PushMessage, PushResult, PushTransport } from "./push";

export interface ApnsConfig {
  /** The 10-character key id of the .p8 key (APNS_KEY_ID). */
  keyId: string;
  /** The 10-character team id (APNS_TEAM_ID). */
  teamId: string;
  /** The .p8 key, PEM (APNS_KEY). */
  key: string;
  /** The app's bundle id (APNS_TOPIC). */
  topic: string;
  production: boolean;
  /** Tests point this at a local HTTP/2 server. */
  origin?: string;
  now?: () => number;
}

const SANDBOX = "https://api.sandbox.push.apple.com";
const PRODUCTION = "https://api.push.apple.com";
/** Apple refuses a provider token older than an hour and one refreshed more than every 20 minutes. */
const TOKEN_TTL_MS = 50 * 60_000;
/** Reasons that mean the token is dead for good: forget the device. */
const GONE_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic", "ExpiredToken"]);

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/**
 * The provider token: a JWT signed ES256 with the team's .p8 key (Apple, "Establishing a
 * token-based connection to APNs"). node:crypto does the signing; ieee-p1363 gives the raw
 * r||s signature JWS expects instead of DER.
 */
export function apnsJwt(key: KeyObject, keyId: string, teamId: string, nowMs: number): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const claims = base64url(JSON.stringify({ iss: teamId, iat: Math.floor(nowMs / 1000) }));
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `${header}.${claims}.${base64url(signature)}`;
}

/** The APNs body: generic alert text, ids under `body` (expo-notifications reads data from there). */
export function apnsPayload(message: PushMessage): Record<string, unknown> {
  return {
    aps: {
      alert: { title: message.title, body: message.body },
      ...(message.passive ? {} : { sound: "default" }),
      ...(message.badge !== undefined ? { badge: message.badge } : {}),
      ...(message.threadId ? { "thread-id": message.threadId } : {}),
      ...(message.category ? { category: message.category } : {}),
      "interruption-level": message.timeSensitive ? "time-sensitive" : message.passive ? "passive" : "active",
    },
    body: message.data,
  };
}

/** APNs over HTTP/2 with a token key; one connection kept open and reopened when it drops. */
export class ApnsTransport implements PushTransport {
  readonly platform = "ios" as const;
  private readonly key: KeyObject;
  private readonly origin: string;
  private readonly now: () => number;
  private session: ClientHttp2Session | null = null;
  private token: { value: string; at: number } | null = null;

  constructor(private readonly config: ApnsConfig) {
    // Env files often carry the PEM on one line with literal \n.
    this.key = createPrivateKey(config.key.replace(/\\n/g, "\n"));
    this.origin = config.origin ?? (config.production ? PRODUCTION : SANDBOX);
    this.now = config.now ?? Date.now;
  }

  private providerToken(): string {
    const now = this.now();
    if (!this.token || now - this.token.at > TOKEN_TTL_MS) this.token = { value: apnsJwt(this.key, this.config.keyId, this.config.teamId, now), at: now };
    return this.token.value;
  }

  private connection(): ClientHttp2Session {
    if (this.session && !this.session.closed && !this.session.destroyed) return this.session;
    const session = connect(this.origin);
    session.on("error", () => session.destroy());
    session.on("goaway", () => session.close());
    // An idle connection does not keep the process alive.
    session.unref();
    this.session = session;
    return session;
  }

  async send(token: string, message: PushMessage): Promise<PushResult> {
    if (!/^[0-9a-fA-F]{32,200}$/.test(token)) return "gone";
    const headers: Record<string, string> = {
      [constants.HTTP2_HEADER_METHOD]: "POST",
      [constants.HTTP2_HEADER_PATH]: `/3/device/${token}`,
      authorization: `bearer ${this.providerToken()}`,
      "apns-topic": this.config.topic,
      "apns-push-type": "alert",
      "apns-priority": message.passive ? "5" : "10",
      "apns-expiration": String(Math.floor((this.now() + (message.ttlSeconds ?? 3_600) * 1000) / 1000)),
      "content-type": "application/json",
    };
    if (message.collapseId) headers["apns-collapse-id"] = message.collapseId.slice(0, 64);
    const body = JSON.stringify(apnsPayload(message));
    const { status, text } = await new Promise<{ status: number; text: string }>((resolve, reject) => {
      const request = this.connection().request(headers);
      let status = 0;
      let text = "";
      request.setEncoding("utf8");
      request.setTimeout(10_000, () => request.close(constants.NGHTTP2_CANCEL));
      request.on("response", (response) => (status = Number(response[constants.HTTP2_HEADER_STATUS] ?? 0)));
      request.on("data", (chunk: string) => (text += chunk));
      request.on("end", () => resolve({ status, text }));
      request.on("error", reject);
      request.end(body);
    }).catch(() => ({ status: 0, text: "" }));
    if (status === 200) return "ok";
    let reason = "";
    try {
      reason = (JSON.parse(text) as { reason?: string }).reason ?? "";
    } catch {
      // No body: the status says enough.
    }
    if (status === 410 || GONE_REASONS.has(reason)) return "gone";
    // A rejected provider token is made again on the next send.
    if (status === 403) this.token = null;
    return "error";
  }

  close(): void {
    this.session?.close();
    this.session = null;
  }
}
