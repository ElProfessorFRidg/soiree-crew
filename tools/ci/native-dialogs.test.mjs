import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "apps/mobile/src");
function sourceFiles(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const file = join(folder, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts") ? [file] : [];
  });
}

describe("cross-platform action dialogs", () => {
  it("never relies on a browser confirm/alert or the unsupported React Native web Alert.alert", () => {
    const forbidden = /\b(?:window|globalThis)\s*\.\s*(?:confirm|alert)\s*\(|\bAlert\s*\.\s*alert\s*\(/g;
    const offenders = [];
    for (const path of sourceFiles(root)) {
      const text = readFileSync(path, "utf8");
      for (const match of text.matchAll(forbidden)) {
        const line = text.slice(0, match.index).split("\n").length;
        offenders.push(`${relative(process.cwd(), path)}:${line}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
