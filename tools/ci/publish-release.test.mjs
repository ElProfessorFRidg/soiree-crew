import { expect, it } from "vitest";
import { releasePlan } from "./publish-release.mjs";
import { nextVersion } from "./next-version.mjs";

const base = { version: "0.2.5", build: 115, sha: "a".repeat(40) };
it("publishes previews under immutable tags without moving public latest or consuming a public patch", () => {
  const plan = releasePlan({ ...base, channel: "preview", pr: 4 });
  expect(plan.tag).toBe("v0.2.5-preview.4+build.115");
  expect(plan.flags).toEqual(["--prerelease", "--latest=false"]);
  expect(nextVersion("0.2", ["v0.2.4+build.93", plan.tag])).toBe("0.2.5");
});
it("keeps the public tag scheme and latest link", () => {
  expect(releasePlan({ ...base, channel: "public" })).toMatchObject({ tag: "v0.2.5+build.115", flags: ["--latest=true"] });
});
it("refuses missing PR identity, unknown channels and non-version strings before publishing", () => {
  expect(() => releasePlan({ ...base, channel: "preview" })).toThrow();
  expect(() => releasePlan({ ...base, channel: "beta" })).toThrow();
  expect(() => releasePlan({ ...base, version: "latest", channel: "public" })).toThrow();
});
