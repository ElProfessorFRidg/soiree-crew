import { expect, it } from "vitest";
import { versionAllocation } from "./next-version.mjs";

it("continues after existing public and preview versions, independently of the build number", () => {
  const tags = ["v0.2.10+build.276", "v0.2.11-preview.25+build.286", "v0.1.50+build.200", "v0.2.80-build.250"];
  expect(versionAllocation("0.2.0", "289", tags, [])).toEqual({ version: "0.2.12", reserved: false });
  expect(versionAllocation("1.0.0", "289", tags, [])).toEqual({ version: "1.0.1", reserved: false });
});

it("moves past another run's reservation and reuses its own on retry", () => {
  const tag = "crew-version/v0.2.12";
  const reservations = [{ tag, owner: "build-289" }];
  expect(versionAllocation("0.2.0", "290", [tag], reservations)).toEqual({ version: "0.2.13", reserved: false });
  expect(versionAllocation("0.2.0", "289", [tag, "v0.2.13+build.290"], reservations)).toEqual({ version: "0.2.12", reserved: true });
  expect(() => versionAllocation("0.2.0", "", [], [])).toThrow();
});
