import type { Translator } from "@/i18n";
import { ApiError } from "@/server/api";
import { serverMessage } from "@/server/errors";

export function crewErrorMessage(error: unknown, i18n: Translator): string {
  if (error instanceof ApiError && error.failure.kind === "http") {
    if (error.failure.status === 404) return i18n.t("crew.inviteInvalid");
    return serverMessage(error.failure.code, i18n);
  }
  return i18n.t("crew.offline");
}

/**
 * O-36: what a crew invite QR holds: the share link (https://server/i/CODE) or the app link
 * (soireecrew://join?code=...&server=...). The server is null for a bare code: this server, then.
 */
export function parseInviteQr(data: string): { code: string; server: string | null } | null {
  const text = data.trim();
  const app = /^soireecrew:\/\/join\?(.+)$/.exec(text);
  if (app) {
    const params = new URLSearchParams(app[1]);
    const code = params.get("code");
    return code && /^[A-Za-z0-9]{8}$/.test(code) ? { code: code.toUpperCase(), server: params.get("server") } : null;
  }
  const link = /^(https?:\/\/[^\s]+?)\/i\/([A-Za-z0-9]{8})\/?$/.exec(text);
  if (link) return { code: link[2]!.toUpperCase(), server: link[1]! };
  const alone = /^([A-Za-z0-9]{8})$/.exec(text);
  return alone ? { code: alone[1]!.toUpperCase(), server: null } : null;
}

/** An invite code from what was copied: a link ending in /i/CODE, or the 8 characters alone. */
export function inviteCodeFrom(text: string): string | null {
  const fromLink = /\/i\/([A-Za-z0-9]{8})\b/.exec(text)?.[1];
  const alone = /^\s*([A-Za-z0-9]{8})\s*$/.exec(text)?.[1];
  return (fromLink ?? alone)?.toUpperCase() ?? null;
}
