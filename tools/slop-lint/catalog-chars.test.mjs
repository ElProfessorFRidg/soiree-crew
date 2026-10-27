import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// A broken script once turned "!" into U+0001 in the French catalogue: it showed as a box.
const DIR = "apps/mobile/src/i18n";

describe("catalogues", () => {
  for (const file of readdirSync(DIR).filter((f) => /^[a-z]{2}\.ts$/.test(f))) {
    it(`${file} has no control characters, raw or escaped`, () => {
      const text = readFileSync(`${DIR}/${file}`, "utf8");
      const bad = text.split("\n").filter((line) => /\\u00[01][0-9a-fA-F]/.test(line) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(line));
      expect(bad).toEqual([]);
    });
  }
});
