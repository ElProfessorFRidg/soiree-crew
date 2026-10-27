#!/usr/bin/env node
// SLOP-04 and SLOP-08: fails the build when a localisation catalogue, a game deck or the UI code contains a machine-checkable AI tell.
// Usage: node tools/slop-lint/index.mjs
// Needs Node 22.18 or later, which runs the .ts catalogues with type stripping.

import { existsSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, resolve } from "node:path";
import { checkDeck, mixedApostrophes } from "./decks.mjs";
import { check, strings } from "./rules.mjs";
import { designFindings } from "./design.mjs";

const CATALOGUES = [
  { locale: "fr", file: "apps/mobile/src/i18n/fr.ts", exportName: "fr" },
  { locale: "en", file: "apps/mobile/src/i18n/en.ts", exportName: "en" },
  { locale: "fr", file: "apps/mobile/src/games/i18n/fr.ts", exportName: "fr", oneApostrophe: true },
  { locale: "en", file: "apps/mobile/src/games/i18n/en.ts", exportName: "en", oneApostrophe: true },
  { locale: "fr", file: "apps/mobile/src/bar/text/fr.ts", exportName: "barFr" },
  { locale: "en", file: "apps/mobile/src/bar/text/en.ts", exportName: "barEn" },
  { locale: "fr", file: "apps/mobile/src/recap/narrationText/fr.ts", exportName: "narrationFr" },
  { locale: "en", file: "apps/mobile/src/recap/narrationText/en.ts", exportName: "narrationEn" },
];

const CONTENT_ROOT = "packages/games/src/content";
/** How each deck file is checked (R-20). Word lists only get the copy rules and a duplicate check. */
const DECKS = {
  bigDeck: { deck: true },
  pointBlank: { deck: true },
  neverEver: { deck: true },
  verdict: { deck: true },
  truthDare: { deck: true },
  forfeits: { deck: true },
  fusePrompts: { deck: true, lengthSpread: false },
  drawWords: { deck: false },
  wordPairs: { deck: false, firstOfTuple: true },
  alibis: { deck: false },
};

let errors = 0;
let warnings = 0;
const report = (where, finding) => {
  if (finding.severity === "warn") {
    warnings += 1;
    console.log(`warn ${where}: ${finding.rule} ${finding.match}`);
  } else {
    errors += 1;
    console.log(`${where}: ${finding.rule} matched "${finding.match}"`);
  }
};

async function load(file) {
  return import(pathToFileURL(resolve(file)).href);
}

for (const { locale, file, exportName, oneApostrophe } of CATALOGUES) {
  if (!existsSync(file)) continue;
  const module = await load(file);
  const entries = [...strings(module[exportName])];
  for (const [key, text] of entries) {
    for (const finding of check(text, locale)) report(`${file}:${key}`, finding);
  }
  if (oneApostrophe && mixedApostrophes(entries.map(([, t]) => t))) report(file, { rule: "FO-09 apostrophes", match: "both ' and ’ used" });
}

for (const locale of ["fr", "en"]) {
  const folder = join(CONTENT_ROOT, locale);
  if (!existsSync(folder)) continue;
  for (const name of readdirSync(folder).filter((f) => f.endsWith(".ts")).sort()) {
    const file = join(folder, name);
    const deckName = name.replace(/\.ts$/, "");
    const module = await load(file);
    const value = module[deckName];
    if (value === undefined) {
      report(file, { rule: "content export", match: `no export named ${deckName}` });
      continue;
    }
    const entries = [...strings(value)];
    for (const [key, text] of entries) {
      for (const finding of check(text, locale)) report(`${file}:${key}`, finding);
    }
    if (mixedApostrophes(entries.map(([, t]) => t))) report(file, { rule: "FO-09 apostrophes", match: "both ' and ’ used" });

    const options = DECKS[deckName];
    if (!options) {
      report(file, { rule: "content config", match: `${deckName} is not listed in tools/slop-lint/index.mjs DECKS` });
      continue;
    }
    if (options.deck) {
      for (const finding of checkDeck(entries.map(([, t]) => t), { lengthSpread: options.lengthSpread !== false })) report(file, finding);
    } else {
      // Word lists: no repeated entry (for word pairs, the crew word; categories repeat on purpose).
      const keys = entries.filter(([key]) => !options.firstOfTuple || key.endsWith(".0")).map(([, t]) => t.toLocaleLowerCase());
      const seen = new Set();
      for (const key of keys) {
        if (seen.has(key)) report(file, { rule: "GC-10 duplicate", match: key });
        seen.add(key);
      }
    }
  }
}

// SLOP-08: the design tells a static read of the UI code can catch.
for (const [file, finding] of designFindings(["apps/mobile/src", "packages/design-tokens/src"])) report(file, finding);

if (warnings > 0) console.log(`\n${warnings} warning(s) to read in review (SLOP-02).`);
if (errors > 0) {
  console.log(`\n${errors} SLOP-04 error(s).`);
  process.exit(1);
}
console.log("SLOP-04, SLOP-08: no machine-checkable tells.");
