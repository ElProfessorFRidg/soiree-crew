import { expect, it } from "vitest";
import { latestIpaTag } from "./select-ota-base.mjs";

const ipa = (tag_name, prerelease) => ({
  tag_name, prerelease, assets: ["iphone", "ipad"].map((target) => ({ name: `ios-build-info-${target}.json` })),
});

const releases = [
  ipa("v0.2.310-preview.28+build.310", true), ipa("v0.2.311-preview.29+build.311", true),
  ipa("v0.2.315-preview.27+build.315", true),
  ipa("v0.2.309+build.309", false), ipa("v0.2.314+build.314", false),
  ipa("ota-v0.2.310-preview.28+build.310-iphone-123.1", true),
];

it("routes public to the newest public IPA", () => {
  expect(latestIpaTag(releases)).toBe("v0.2.314+build.314");
});

it("isolates preview IPA selection to the current PR", () => {
  expect(latestIpaTag(releases, "28")).toBe("v0.2.310-preview.28+build.310");
  expect(latestIpaTag(releases, "28", ["28", "29"])).toBe("v0.2.310-preview.28+build.310");
  // PR 27 is closed: its IPA is no longer the Preview reference.
  expect(latestIpaTag(releases, "30", ["28", "30"])).toBe("");
  expect(latestIpaTag(releases, "30")).toBe("");
});
