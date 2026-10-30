import { ApnsTransport } from "./apns";
import { FcmTransport, fcmConfigFromEnv } from "./fcm";

export type Platform = "ios" | "android";

/**
 * What a push may say: generic text from the app's catalogues and ids the app resolves once
 * opened. Never a BAC figure, a drink count or a message (QOL-27, MSG-04).
 */
export interface PushMessage {
  title: string;
  body: string;
  /** Ids only: inbox item, kind, party, crew, ref. */
  data: Record<string, string>;
  category?: string;
  /** QOL-30: one thread per party on iOS, one group on Android. */
  threadId?: string;
  collapseId?: string;
  /** Android notification channel. */
  channel: string;
  /** Unread count for the app icon. */
  badge?: number;
  /** Quiet hours: no sound, low priority. */
  passive?: boolean;
  /** Safety: breaks through Focus where the app has the entitlement. */
  timeSensitive?: boolean;
  ttlSeconds?: number;
}

export type PushResult = "ok" | "gone" | "error";

export interface PushTransport {
  readonly platform: Platform;
  send(token: string, message: PushMessage): Promise<PushResult>;
  close(): void;
}

/** The configured senders. Absent ones mean that platform gets the inbox and the live socket only. */
export class PushService {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(private readonly transports: Partial<Record<Platform, PushTransport>>) {}

  enabled(platform: Platform): boolean {
    return Boolean(this.transports[platform]);
  }

  send(platform: Platform, token: string, message: PushMessage): Promise<PushResult> {
    const transport = this.transports[platform];
    if (!transport) return Promise.resolve("error");
    const sending = transport.send(token, message);
    this.pending.add(sending);
    void sending.finally(() => this.pending.delete(sending)).catch(() => undefined);
    return sending;
  }

  /** Tests and shutdown: wait for pushes in flight. */
  async idle(): Promise<void> {
    while (this.pending.size) await Promise.allSettled([...this.pending]);
  }

  close(): void {
    for (const transport of Object.values(this.transports)) transport?.close();
  }
}

/**
 * Push senders from the environment. iOS: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY (the .p8 PEM),
 * APNS_TOPIC (bundle id), APNS_PRODUCTION=true for TestFlight and App Store builds.
 * Android: FCM_SERVICE_ACCOUNT, or FCM_PROJECT_ID, FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY.
 */
export function pushFromEnv(env: NodeJS.ProcessEnv, log: (message: string) => void = () => undefined): PushService | null {
  const transports: Partial<Record<Platform, PushTransport>> = {};
  if (env.APNS_KEY_ID && env.APNS_TEAM_ID && env.APNS_KEY && env.APNS_TOPIC) {
    try {
      transports.ios = new ApnsTransport({
        keyId: env.APNS_KEY_ID,
        teamId: env.APNS_TEAM_ID,
        key: env.APNS_KEY,
        topic: env.APNS_TOPIC,
        production: env.APNS_PRODUCTION === "true" || env.APNS_PRODUCTION === "1",
      });
    } catch {
      log("APNS_KEY is not a readable PEM key: iOS push is off.");
    }
  }
  const fcm = fcmConfigFromEnv(env);
  if (fcm) {
    try {
      transports.android = new FcmTransport(fcm);
    } catch {
      log("The FCM private key is not a readable PEM key: Android push is off.");
    }
  }
  return transports.ios || transports.android ? new PushService(transports) : null;
}
