import { pluralCategory, type UiLanguage } from "@crew/units";
// The server writes no user-facing copy of its own: push text comes from the app's catalogues,
// the one place every language lives (the Dockerfile copies them next to the server).
import { de } from "../../../mobile/src/i18n/de";
import { en } from "../../../mobile/src/i18n/en";
import { es } from "../../../mobile/src/i18n/es";
import { fr } from "../../../mobile/src/i18n/fr";
import { it } from "../../../mobile/src/i18n/it";
import { pt } from "../../../mobile/src/i18n/pt";
import { ru } from "../../../mobile/src/i18n/ru";
import type { NotificationKind } from "./kinds";

const catalogues = { fr, en, es, it, de, pt, ru };

export function pushLanguage(value: unknown): UiLanguage {
  return typeof value === "string" && Object.hasOwn(catalogues, value) ? (value as UiLanguage) : "en";
}

/** Generic title and body for a kind: no name, no figure, no message (QOL-27, MSG-04). */
export function pushCopy(language: UiLanguage, kind: NotificationKind, params: Record<string, unknown> = {}): { title: string; body: string } {
  const copy = catalogues[language].notify.push[kind];
  const v = `v${typeof params.v === "number" ? params.v : 1}`;
  // A written variant, without any name or place: someone's night is not for the lock screen (QOL-27).
  if (kind === "crewNearby") {
    const lines = catalogues[language].notify.crewNearby[params.live ? "pushLive" : "gathered"] as Record<string, string>;
    return { title: copy.title, body: lines[v] ?? copy.body };
  }
  if (kind === "gathering" || kind === "partyStarted" || kind === "closingSoon") {
    const lines = catalogues[language].notify[kind].push as Record<string, string>;
    return { title: copy.title, body: lines[v] ?? copy.body };
  }
  return copy;
}

/** The one push sent after quiet hours for everything that waited. */
export function summaryCopy(language: UiLanguage, count: number): { title: string; body: string } {
  const copy = catalogues[language].notify.push.summary;
  const forms = copy.body as Record<string, string | undefined> & { other: string };
  const template = forms[pluralCategory(language, count)] ?? forms.other;
  return { title: copy.title, body: template.replace("{count}", String(count)) };
}
