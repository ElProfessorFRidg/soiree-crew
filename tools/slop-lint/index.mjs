#!/usr/bin/env node
// SLOP-04: fails the build when a localisation catalogue contains a machine-checkable AI tell.
// Usage: node tools/slop-lint/index.mjs
// Needs Node 22.18 or later, which runs the .ts catalogues with type stripping.

import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { check, strings } from "./rules.mjs";

const CATALOGUES = [
  { locale: "fr", file: "apps/mobile/src/i18n/fr.ts", exportName: "fr" },
  { locale: "en", file: "apps/mobile/src/i18n/en.ts", exportName: "en" },
];

let errors = 0;
for (const { locale, file, exportName } of CATALOGUES) {
  const module = await import(pathToFileURL(resolve(file)).href);
  for (const [key, text] of strings(module[exportName])) {
    for (const finding of check(text, locale)) {
      errors += 1;
      console.log(`${file}:${key}: ${finding.rule} matched "${finding.match}"`);
    }
  }
}

if (errors > 0) {
  console.log(`\n${errors} SLOP-04 error(s).`);
  process.exit(1);
}
console.log("SLOP-04: no machine-checkable tells.");
