// What travels inside an MLS application message. The server never sees any of it (MSG-02).
import { utf8 } from "./bytes";

export type ChatPayload =
  | { t: "text"; id: string; body: string; reply?: string; mentions?: string[] }
  | { t: "media"; id: string; kind: "photo" | "voice" | "video"; blob: string; key: string; mime: string; width?: number; height?: number; durationMs?: number; thumb?: string; reply?: string }
  /** An empty emoji takes the reaction back. */
  | { t: "react"; id: string; target: string; emoji: string }
  | { t: "edit"; id: string; target: string; body: string }
  | { t: "delete"; id: string; target: string }
  /** Read receipt (MSG-10): everything up to this message, sent only when the reader allows it. */
  | { t: "read"; id: string; upTo: string }
  /** MSG-06: the disappearing timer changed; 0 turns it off. */
  | { t: "timer"; id: string; seconds: number };

export const MAX_BODY = 4000;
const MAX_ID = 64;

const str = (v: unknown, max: number): v is string => typeof v === "string" && v.length <= max;
const optStr = (v: unknown, max: number) => v === undefined || str(v, max);
const optNum = (v: unknown) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e9);

/** Strict reading of a received payload: anything unexpected is dropped, never shown half-parsed. */
export function readPayload(data: Uint8Array): ChatPayload | null {
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(utf8.decode(data)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!v || typeof v !== "object" || !str(v.id, MAX_ID) || !v.id) return null;
  switch (v.t) {
    case "text":
      if (!str(v.body, MAX_BODY) || !v.body.trim() || !optStr(v.reply, MAX_ID)) return null;
      if (v.mentions !== undefined && !(Array.isArray(v.mentions) && v.mentions.length <= 50 && v.mentions.every((m) => str(m, MAX_ID)))) return null;
      return { t: "text", id: v.id, body: v.body, ...(v.reply ? { reply: v.reply as string } : {}), ...(v.mentions ? { mentions: v.mentions as string[] } : {}) };
    case "media":
      if ((v.kind !== "photo" && v.kind !== "voice" && v.kind !== "video") || !str(v.blob, MAX_ID) || !str(v.key, 64) || !str(v.mime, 40)) return null;
      if (!optNum(v.width) || !optNum(v.height) || !optNum(v.durationMs) || !optStr(v.thumb, 24_000) || !optStr(v.reply, MAX_ID)) return null;
      return {
        t: "media",
        id: v.id,
        kind: v.kind,
        blob: v.blob,
        key: v.key,
        mime: v.mime,
        ...(v.width !== undefined ? { width: v.width as number } : {}),
        ...(v.height !== undefined ? { height: v.height as number } : {}),
        ...(v.durationMs !== undefined ? { durationMs: v.durationMs as number } : {}),
        ...(v.thumb ? { thumb: v.thumb as string } : {}),
        ...(v.reply ? { reply: v.reply as string } : {}),
      };
    case "react":
      return str(v.target, MAX_ID) && str(v.emoji, 16) ? { t: "react", id: v.id, target: v.target, emoji: v.emoji } : null;
    case "edit":
      return str(v.target, MAX_ID) && str(v.body, MAX_BODY) && v.body.trim() ? { t: "edit", id: v.id, target: v.target, body: v.body } : null;
    case "delete":
      return str(v.target, MAX_ID) ? { t: "delete", id: v.id, target: v.target } : null;
    case "read":
      return str(v.upTo, MAX_ID) ? { t: "read", id: v.id, upTo: v.upTo } : null;
    case "timer":
      return typeof v.seconds === "number" && Number.isInteger(v.seconds) && v.seconds >= 0 && v.seconds <= 7 * 86_400 ? { t: "timer", id: v.id, seconds: v.seconds } : null;
    default:
      return null;
  }
}

export const writePayload = (payload: ChatPayload): Uint8Array => utf8.encode(JSON.stringify(payload));
