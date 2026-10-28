import type { Translator } from "@/i18n";
import { showToast } from "@/ui/Toast";
import { ApiError } from "./api";
import { fr } from "@/i18n/fr";

type ServerCode = keyof typeof fr.serverCodes;
const KNOWN = new Set(Object.keys(fr.serverCodes));

/** A server refusal in words: its own sentence when the code is known, a plain fallback otherwise. */
export function serverMessage(code: string, i18n: Translator): string {
  return KNOWN.has(code) ? i18n.t(`serverCodes.${code as ServerCode}`) : i18n.t("crew.serverError");
}

/**
 * SYNC-07: any failed call in words. A refusal says why, a timeout says the server is slow, and only
 * a real network loss says "no network". Unknown errors (no ApiError) keep the network wording.
 */
export function failureMessage(error: unknown, i18n: Translator): string {
  if (!(error instanceof ApiError)) return i18n.t("crew.offline");
  if (error.failure.kind === "http") return serverMessage(error.failure.code, i18n);
  if (error.failure.kind === "timeout") return i18n.t("crew.timeout");
  return i18n.t("crew.offline");
}

/** For `.catch(...)`: shows the failure as a danger toast. */
export function showFailure(i18n: Translator): (error?: unknown) => void {
  return (error) => showToast({ tone: "danger", message: failureMessage(error, i18n) });
}
