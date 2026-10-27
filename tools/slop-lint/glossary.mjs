// SLOP-10, SLOP.md R-19: one word per concept (GLOSSARY.md). A rejected synonym in the app's
// copy is a warning for the review, not a failure: some keys use the word on purpose.

import { normalise } from "./rules.mjs";

const word = (body) => new RegExp(`(?<![\p{L}\p{N}])(?:${body})(?![\p{L}\p{N}])`, "iu");

/** [locale, rejected synonyms, the glossary word, key prefixes where the word is meant]. */
const SYNONYMS = [
  ["en", "squad|gang|group\s+of\s+friends", "crew", []],
  ["en", "night\s+out|hangout", "party", ["wrapped.", "polls.", "feed."]],
  ["en", "beverage|booze", "drink", []],
  ["en", "blood\s+alcohol\s+level|alcohol\s+level", "BAC", ["estimate.", "privacy."]],
  // « bande photo » is the photo strip, not the crew.
  ["fr", "bande|équipe|squad", "crew", ["strip.", "people.inStoriesHint"]],
  ["fr", "fête", "soirée", ["moods.", "party.mood", "newParty.mood"]],
  ["fr", "boissons?|consos?|consommations?", "verre", ["settings.drinks", "drinks.", "addDrink.", "customDrink", "people.section", "bar.", "myStats.", "search.", "account.deleteBody", "ingredients.", "recipes."]],
  ["fr", "alcoolémie", "taux", ["party.notice", "estimate.", "legal.", "privacy."]],
];

/** @returns {{ rule: string, match: string, severity: "warn" }[]} */
export function glossaryFindings(text, locale, key) {
  const normalised = normalise(text);
  const out = [];
  for (const [lang, body, preferred, allowed] of SYNONYMS) {
    if (lang !== locale || allowed.some((prefix) => key.startsWith(prefix))) continue;
    const match = normalised.match(word(body));
    if (match) out.push({ rule: `R-19 glossary (say "${preferred}")`, match: match[0], severity: "warn" });
  }
  return out;
}
