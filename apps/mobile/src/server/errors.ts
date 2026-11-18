import type { Translator } from "@/i18n";
import { showToast } from "@/ui/Toast";
import { ApiError } from "./api";
import { fr } from "@/i18n/fr";
import { compatibilityCode } from "@/ui/pure/apiCompatibility";

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
  if (!(error instanceof ApiError)) return `${i18n.t("diagnostics.unexpected")} (SC_UNKNOWN)`;
  let message: string;
  if (error.failure.kind === "configuration") message = i18n.t("diagnostics.noServer");
  else if (error.failure.kind === "http" && error.failure.status === 429 && error.failure.retryAfterMs) message = i18n.t("serverCodes.rate_limited_wait", { seconds: Math.max(1, Math.ceil(error.failure.retryAfterMs / 1000)) });
  else if (error.failure.kind === "http" && error.failure.status >= 500 && !error.failure.compatibility && ["internal", "unknown"].includes(error.failure.code)) message = i18n.t("diagnostics.serverFailure");
  else if (error.failure.kind === "http") message = error.failure.code === "database_unavailable" ? i18n.t("diagnostics.database") : serverMessage(error.failure.compatibility ? compatibilityCode(error.failure.compatibility.reason) : error.failure.code, i18n);
  else if (error.failure.kind === "timeout") message = i18n.t("crew.timeout");
  else message = i18n.t("diagnostics.transport");
  return `${message} (${error.diagnostic.code})`;
}

/** For `.catch(...)`: shows the failure as a danger toast. */
export function showFailure(i18n: Translator): (error?: unknown) => void {
  return (error) => {
    // api() already reports these centrally, including failures from background calls.
    if (error instanceof ApiError && error.failure.kind === "http" && error.failure.compatibility) return;
    showToast({ tone: "danger", message: failureMessage(error, i18n) });
  };
}
