import { expect, it } from "vitest";
import { versionForBuild } from "./next-version.mjs";

it("uses distinct version names for concurrent Build runs within the same series", () => {
  expect(versionForBuild("0.2.0", "310")).toBe("0.2.310");
  expect(versionForBuild("0.2.0", "311")).toBe("0.2.311");
  expect(versionForBuild("1.0.0", "311")).toBe("1.0.311");
  expect(() => versionForBuild("0.2.0", "")).toThrow();
});
