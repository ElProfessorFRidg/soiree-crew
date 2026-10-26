// SLOP-04 rules, from SLOP.md §10. Each rule returns the matched excerpt or null.
// JavaScript \b breaks on accented letters, so word boundaries use Unicode lookarounds.

const L = "(?<![\\p{L}\\p{N}_])";
const R = "(?![\\p{L}\\p{N}_])";
const word = (body) => new RegExp(`${L}(?:${body})${R}`, "iu");

const EN_BLACKLIST = [
  "additionally",
  "align(?:s|ed|ing)?\\s+with",
  "boast(?:s|ed|ing)?",
  "bolster(?:s|ed|ing)?",
  "crucial(?:ly)?",
  "deep[\\s-]dives?",
  "delv(?:e|es|ed|ing)",
  "emphasi[sz](?:e|es|ed|ing)",
  "enduring",
  "enhanc(?:e|es|ed|ing|ement|ements)",
  "foster(?:s|ed|ing)?",
  "garner(?:s|ed|ing)?",
  "interplay",
  "intricate|intricac(?:y|ies)",
  "leverag(?:e|es|ed|ing)",
  "meticulous(?:ly)?",
  "multifaceted",
  "pivotal",
  "robust",
  "showcas(?:e|es|ed|ing)",
  "tapestry",
  "testament",
  "underscor(?:e|es|ed|ing)",
  "valuable",
  "vibrant",
  "quietly",
  "dependable",
  "thoughtful",
  "meaningful",
  "seamless(?:ly)?",
  "effortless(?:ly)?",
  "unleash(?:es|ed|ing)?",
  "elevat(?:e|es|ed|ing)",
  "game[\\s-]chang(?:er|ing)",
  "supercharg(?:e|ed|ing)",
  "world[\\s-]class",
  "next[\\s-]generation",
  "cutting[\\s-]edge",
  "in\\s+just\\s+a\\s+few\\s+taps",
  "your\\s+journey",
  "unforgettable",
  "feel\\s+free\\s+to",
  "oops|whoops|uh-oh|yikes",
  "hang\\s+tight|sit\\s+tight",
];

const FR_BLACKLIST = [
  "plong(?:er|eons|ez)\\s+dans",
  "approfondi(?:r|ssez)",
  "il\\s+est\\s+(?:important|crucial|essentiel|fondamental)\\s+de",
  "il\\s+convient\\s+de",
  "en\\s+outre",
  "par\\s+ailleurs",
  "en\\s+somme",
  "en\\s+conclusion",
  "en\\s+définitive",
  "en\\s+résumé",
  "comme\\s+nous\\s+l'avons\\s+vu",
  "divers(?:es)?",
  "nombreu(?:x|ses)",
  "mettre\\s+en\\s+œuvre",
  "faciliter",
  "optimiser",
  "incontournable",
  "holistique",
  "robuste",
  "réinventée?s?",
  "véritable",
  "au\\s+cœur\\s+de",
  "sublimer",
  "booster",
  "révolutionner",
  "propulser",
  "de\\s+manière\\s+fluide",
  "en\\s+toute\\s+(?:simplicité|sérénité)",
  "expérience\\s+(?:unique|inoubliable|immersive)",
  "que\\s+tu\\s+sois",
  "dans\\s+un\\s+monde\\s+où",
  "n'hésite\\s+pas",
  "ton\\s+aventure",
  "découvre",
  "libère",
];

const EMOJI = /\p{Extended_Pictographic}/gu;
const EMOJI_EXCLUDED = new Set(["©", "®", "™"]);

/** @typedef {{ id: string, locale?: "fr" | "en", test: (text: string) => string | null }} Rule */

/** @type {Rule[]} */
export const RULES = [
  {
    id: "R-01 dash",
    test: (text) => text.match(/[‒–—―]|(?<=\p{L}|\p{N}|X)\s+-{1,2}\s+(?=\p{L}|\p{N}|X)|--/u)?.[0] ?? null,
  },
  {
    id: "R-02 successfully",
    locale: "en",
    test: (text) => text.match(word("successful(?:ly)?"))?.[0] ?? null,
  },
  {
    id: "R-02 avec succès",
    locale: "fr",
    test: (text) =>
      text.match(word("avec\\s+succès|a\\s+bien\\s+été|ont\\s+bien\\s+été|est\\s+bien\\s+(?:enregistré|ajouté|envoyé)e?s?"))?.[0] ?? null,
  },
  {
    id: "R-03 emoji count",
    test: (text) => {
      const found = (text.match(EMOJI) ?? []).filter((c) => !EMOJI_EXCLUDED.has(c));
      return found.length > 1 ? found.join("") : null;
    },
  },
  {
    id: "R-06 stacked marks",
    test: (text) => {
      const stacked = text.match(/[!?¡¿][\s  ]*[!?]/u)?.[0];
      if (stacked) return stacked;
      return (text.match(/!/g) ?? []).length > 1 ? "!!" : null;
    },
  },
  {
    id: "R-08 vous",
    locale: "fr",
    test: (text) => text.match(word("vous|votre|vos|veuillez"))?.[0] ?? null,
  },
  {
    id: "R-10 English blacklist",
    locale: "en",
    test: (text) => {
      for (const body of EN_BLACKLIST) {
        const match = text.match(word(body));
        if (match) return match[0];
      }
      return null;
    },
  },
  {
    id: "R-11 French blacklist",
    locale: "fr",
    test: (text) => {
      for (const body of FR_BLACKLIST) {
        const match = text.match(word(body));
        if (match) return match[0];
      }
      return null;
    },
  },
];

/** Placeholders become the neutral token X before matching (SLOP.md §10.1). */
export function normalise(text) {
  return text.normalize("NFC").replace(/\{[^}]+\}/g, "X");
}

export function check(text, locale) {
  const normalised = normalise(text);
  const findings = [];
  for (const rule of RULES) {
    if (rule.locale && rule.locale !== locale) continue;
    const match = rule.test(normalised);
    if (match) findings.push({ rule: rule.id, match });
  }
  return findings;
}

/** Walks a catalogue object and yields [key, string]. */
export function* strings(node, prefix = "") {
  if (typeof node === "string") {
    yield [prefix, node];
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    yield* strings(value, prefix ? `${prefix}.${key}` : key);
  }
}
