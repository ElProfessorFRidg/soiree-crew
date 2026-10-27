import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readFeatures, render } from "./status.mjs";

describe("STATUS.md", () => {
  it("matches FEATURES.md (run pnpm status after changing a status)", () => {
    const rows = readFeatures(readFileSync("FEATURES.md", "utf8"));
    const strip = (text) => text.replace(/on \d{4}-\d{2}-\d{2}/, "on DATE").replace(/\r\n/g, "\n");
    expect(strip(readFileSync("STATUS.md", "utf8"))).toBe(strip(render(rows, "DATE")));
  });
});
