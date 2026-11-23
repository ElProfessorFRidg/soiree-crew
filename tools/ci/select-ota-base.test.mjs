import { expect, it } from "vitest";
import { latestIpaTag } from "./select-ota-base.mjs";

const ipa = (tag_name, prerelease) => ({
  tag_name, prerelease, assets: ["iphone", "ipad"].map((target) => ({ name: `ios-build-info-${target}.json` })),
});

it("routes Preview to its own PR's last native release and public to public", () => {
  const releases = [
    ipa("v0.2.310-preview.28+build.310", true), ipa("v0.2.311-preview.29+build.311", true),
    ipa("v0.2.309+build.309", false), ipa("v0.2.314+build.314", false),
    ipa("ota-v0.2.310-preview.28+build.310-iphone-123.1", true),
  ];
  expect(latestIpaTag(releases, "28")).toBe("v0.2.310-preview.28+build.310");
  expect(latestIpaTag(releases, "30")).toBe("");
  expect(latestIpaTag(releases)).toBe("v0.2.314+build.314");
});
