import { createPrivateKey, sign, type KeyObject } from "node:crypto";
import type { PushMessage, PushResult, PushTransport } from "./push";

export interface FcmConfig {
  projectId: string;
  clientEmail: string;
  /** The service account's private key, PEM. */
  privateKey: string;
  fetch?: typeof fetch;
  now?: () => number;
}

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/firebase.messaging";

const base64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** Reads FCM_SERVICE_ACCOUNT (the JSON Google hands out) or FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY. */
export function fcmConfigFromEnv(env: NodeJS.ProcessEnv): FcmConfig | null {
  if (env.FCM_SERVICE_ACCOUNT) {
    try {
      const account = JSON.parse(env.FCM_SERVICE_ACCOUNT) as { project_id?: string; client_email?: string; private_key?: string };
      if (account.project_id && account.client_email && account.private_key) {
        return { projectId: account.project_id, clientEmail: account.client_email, privateKey: account.private_key };
      }
    } catch {
      return null;
    }
  }
  if (env.FCM_PROJECT_ID && env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY) {
    return { projectId: env.FCM_PROJECT_ID, clientEmail: env.FCM_CLIENT_EMAIL, privateKey: env.FCM_PRIVATE_KEY };
  }
  return null;
}

/**
 * FCM HTTP v1 for Android. The OAuth access token comes from a service-account JWT (RS256,
 * node:crypto) exchanged at Google's token endpoint. Messages are data-only: expo-notifications
 * shows them itself, with the action buttons of their category.
 */
export class FcmTransport implements PushTransport {
  readonly platform = "android" as const;
  private readonly key: KeyObject;
  private readonly fetch: typeof fetch;
  private readonly now: () => number;
  private access: { token: string; expiresAt: number } | null = null;

  constructor(private readonly config: FcmConfig) {
    this.key = createPrivateKey(config.privateKey.replace(/\\n/g, "\n"));
    this.fetch = config.fetch ?? fetch;
    this.now = config.now ?? Date.now;
  }

  private async accessToken(): Promise<string> {
    const now = this.now();
    if (this.access && this.access.expiresAt - 60_000 > now) return this.access.token;
    const iat = Math.floor(now / 1000);
    const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const claims = base64url(JSON.stringify({ iss: this.config.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
    const signature = base64url(sign("sha256", Buffer.from(`${header}.${claims}`), this.key));
    const response = await this.fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${header}.${claims}.${signature}` }).toString(),
    });
    if (!response.ok) throw new Error(`fcm_oauth_${response.status}`);
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.access = { token: data.access_token, expiresAt: now + data.expires_in * 1000 };
    return data.access_token;
  }

  async send(token: string, message: PushMessage): Promise<PushResult> {
    try {
      const access = await this.accessToken();
      const response = await this.fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(this.config.projectId)}/messages:send`, {
        method: "POST",
        headers: { authorization: `Bearer ${access}`, "content-type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            data: {
              title: message.title,
              message: message.body,
              body: JSON.stringify(message.data),
              ...(message.category ? { categoryId: message.category } : {}),
              ...(message.threadId ? { threadIdentifier: message.threadId } : {}),
              channelId: message.channel,
              ...(message.badge !== undefined ? { badge: String(message.badge) } : {}),
            },
            android: { priority: message.passive ? "normal" : "high", ttl: `${message.ttlSeconds ?? 3_600}s`, ...(message.collapseId ? { collapse_key: message.collapseId } : {}) },
          },
        }),
      });
      if (response.ok) return "ok";
      if (response.status === 404) return "gone";
      const text = await response.text();
      if (/UNREGISTERED|registration-token-not-registered/i.test(text)) return "gone";
      if (response.status === 401) this.access = null;
      return "error";
    } catch {
      return "error";
    }
  }

  close(): void {
    this.access = null;
  }
}
