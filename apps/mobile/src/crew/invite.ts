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

/** An invite code from what was copied: a link ending in /i/CODE, or the 8 characters alone. */
export function inviteCodeFrom(text: string): string | null {
  const fromLink = /\/i\/([A-Za-z0-9]{8})\b/.exec(text)?.[1];
  const alone = /^\s*([A-Za-z0-9]{8})\s*$/.exec(text)?.[1];
  return (fromLink ?? alone)?.toUpperCase() ?? null;
}
