import type { Translator } from "@/i18n";
import { fr } from "@/i18n/fr";

type ServerCode = keyof typeof fr.serverCodes;
const KNOWN = new Set(Object.keys(fr.serverCodes));

/** A server refusal in words: its own sentence when the code is known, a plain fallback otherwise. */
export function serverMessage(code: string, i18n: Translator): string {
  return KNOWN.has(code) ? i18n.t(`serverCodes.${code as ServerCode}`) : i18n.t("crew.serverError");
}
