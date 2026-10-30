import { describe, expect, it } from "vitest";
import { nextVersion, seriesOf } from "./next-version.mjs";

describe("next version", () => {
  it("starts a series at .1 and ignores the old build tags", () => {
    expect(nextVersion("0.1", ["abc\trefs/tags/v0.1.0-build.64", "def\trefs/tags/v0.1.0-build.60"])).toBe("0.1.1");
  });

  it("takes the patch after the highest of the same series, whatever the order", () => {
    const tags = ["refs/tags/v0.1.2+build.70", "refs/tags/v0.1.10+build.80", "refs/tags/v0.1.9+build.79", "refs/tags/v0.2.3+build.90", "refs/tags/v0.1.10+build.80^{}"];
    expect(nextVersion("0.1", tags)).toBe("0.1.11");
    expect(nextVersion("0.2", tags)).toBe("0.2.4");
    expect(nextVersion("1.0", tags)).toBe("1.0.1");
  });

  it("reads the series from app.json's version", () => {
    expect(seriesOf("0.1.0")).toBe("0.1");
    expect(seriesOf("1.0.0")).toBe("1.0");
    expect(() => seriesOf("one")).toThrow();
  });
});
