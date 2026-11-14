import { describe, expect, it } from "vitest";
import { addRelease, fromReleases, notesOf, privacyFrom, releaseOfTag, scarletOf, showcase } from "./altstore-source.mjs";

const appJson = {
  expo: {
    ios: { bundleIdentifier: "app.soireecrew.mobile" },
    plugins: ["expo-router", ["expo-location", { locationWhenInUsePermission: "To check in." }], ["expo-image-picker", { photosPermission: "Album.", cameraPermission: "Camera." }]],
  },
};
const release = (version, build) => ({
  version,
  build,
  tag: `v${version}+build.${build}`,
  date: "2026-10-31T00:00:00.000Z",
  notes: `• Version ${version}`,
  size: 1234,
  screenshots: ["01-party.png", "06-settings.png"],
  banner: true,
  header: true,
});

describe("AltStore source", () => {
  it("takes the privacy strings from the app config", () => {
    expect(privacyFrom(appJson)).toEqual({ NSLocationWhenInUseUsageDescription: "To check in.", NSPhotoLibraryUsageDescription: "Album.", NSCameraUsageDescription: "Camera." });
  });

  it("keeps each build installable, deduplicates the same build and links each news card to its IPA", () => {
    let source = addRelease(null, appJson, release("0.1.1", 67));
    source = addRelease(source, appJson, release("0.1.2", 68));
    source = addRelease(source, appJson, release("0.1.2", 69));
    source = addRelease(source, appJson, release("0.1.2", 69));
    const versions = source.apps[0].versions;
    expect(versions.map((v) => [v.version, v.buildVersion])).toEqual([["0.1.2", "69"], ["0.1.2", "68"], ["0.1.1", "67"]]);
    expect(versions[0].downloadURL).toBe("https://github.com/ElProfessorFRidg/soiree-crew/releases/download/v0.1.2%2Bbuild.69/soiree-crew-unsigned.ipa");
    expect(source.apps[0].screenshots).toEqual(["https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/screens/0.1.2/01-party.png"]);
    expect(source.headerURL).toMatch(/\/altstore\/header\.png$/);
    expect(source.news[0]).toMatchObject({
      title: "Soirée Crew 0.1.2 (69)",
      caption: "• Version 0.1.2",
      imageURL: expect.stringMatching(/\/screens\/0\.1\.2\/banner\.png$/),
      url: versions[0].downloadURL,
    });
  });
});

describe("old versions and other sideloading apps", () => {
  const asset = { name: "soiree-crew-unsigned.ipa", size: 999 };
  const releases = [
    { tag_name: "v0.1.2+build.68", published_at: "2026-10-30T02:00:00Z", body: "two", assets: [asset] },
    { tag_name: "v0.1.0-build.64", published_at: "2026-10-29T00:00:00Z", body: "old scheme", assets: [asset] },
    { tag_name: "v0.1.1+build.67", published_at: "2026-10-30T01:00:00Z", body: "one", assets: [asset] },
  ];

  it("lists every named release, newest first, each with its notes, screenshots and card", () => {
    const body = ["Version 0.1.3, build 69 of abc1234.", "", "- feat(drinks): brand catalogue", "- fix: calmer caret", "", "- iOS: install it"].join("\n");
    const media = { versions: { "0.1.2": { screenshots: ["02-crew.png", "09-curve.png", "01-party.png"], banner: true } } };
    const source = fromReleases(appJson, [...releases, { tag_name: "v0.1.3+build.69", body, assets: [asset] }], media, { "0.1.1": { fr: ["Première", "Deuxième"] } });
    const [v3, v2, v1, old] = source.apps[0].versions;
    expect([v3.version, v2.version, v1.version]).toEqual(["0.1.3", "0.1.2", "0.1.1"]);
    expect(v3.localizedDescription).toBe("• Brand catalogue\n• Calmer caret");
    expect(v1.localizedDescription).toBe("• Première\n• Deuxième");
    // 0.1.3 has no screenshots of its own: the app keeps showing 0.1.2's, in showcase order.
    expect(source.apps[0].screenshots.map((url) => url.split("/screens/")[1])).toEqual(["0.1.2/01-party.png", "0.1.2/09-curve.png"]);
    expect(old.downloadURL).toContain("v0.1.0-build.64");
    expect(source.news.find((n) => n.identifier === "release-0.1.3-69").imageURL).toBeUndefined();
    expect(source.news.find((n) => n.identifier === "release-0.1.2-68").imageURL).toMatch(/0\.1\.2\/banner\.png$/);
  });

  it("keeps the first format's fields on the app and writes the Scarlet format", () => {
    const source = addRelease(fromReleases(appJson, releases), appJson, release("0.1.10", 80));
    expect(source.apps[0]).toMatchObject({ version: "0.1.10", downloadURL: expect.stringContaining("v0.1.10%2Bbuild.80") });
    expect(source.apps[0].versions.map((v) => v.version)).toEqual(["0.1.10", "0.1.2", "0.1.1", "0.1.0"]);
    const scarlet = scarletOf(source);
    expect(scarlet.META.repoName).toBe("Soirée Crew");
    expect(scarlet.Other.map((a) => a.version)).toEqual(["0.1.10", "0.1.2", "0.1.1", "0.1.0"]);
    expect(scarlet.Other[0].screenshots).toEqual([expect.stringMatching(/screens\/0\.1\.10\/01-party\.png$/)]);
  });
});

describe("public and preview channels", () => {
  const assets = [{ name: "soiree-crew-unsigned.ipa", size: 100 }, { name: "soiree-crew-ipad-unsigned.ipa", size: 200 }];
  const row = (tag_name, prerelease = false) => ({ tag_name, prerelease, assets, published_at: "2026-11-14T00:00:00Z" });
  it("publishes two real bundle IDs without moving the public latest to a preview", () => {
    const source = fromReleases(appJson, [row("v0.2.4+build.93"), row("v0.2.5-preview.4+build.115", true), row("v0.2.5-preview.4+build.116", true)]);
    expect(source.apps.map((a) => a.bundleIdentifier)).toEqual(["app.soireecrew.mobile", "app.soireecrew.mobile.preview"]);
    expect(source.apps[0].version).toBe("0.2.4");
    expect(source.apps[1].versions.map((v) => v.buildVersion)).toEqual(["116", "115"]);
    expect(source.apps[1].versions[0].marketingVersion).toBe("0.2.5 Preview (116)");
    expect(scarletOf(source).Other.map((a) => a.bundleID)).toContain("app.soireecrew.mobile.preview");
    expect(source.news[0].url).toContain("v0.2.5-preview.4%2Bbuild.116/soiree-crew-unsigned.ipa");
  });
  it("uses each build's own media and keeps native iPad downloads separate", () => {
    const tag = "v0.2.5-preview.4+build.115";
    const source = fromReleases(appJson, [row(tag, true)], { versions: { [tag]: { ipad: { screenshots: ["03-games.png"], dimensions: { "03-games.png": { width: 2064, height: 2752 } }, banner: true } } } }, {}, "ipad");
    expect(source.apps[0].downloadURL).toContain("soiree-crew-ipad-unsigned.ipa");
    expect(source.apps[0].screenshots).toEqual([{ imageURL: expect.stringContaining("v0.2.5-preview.4%2Bbuild.115/ipad/03-games.png"), width: 2064, height: 2752 }]);
    expect(source.apps[0].screenshotURLs[0]).toContain("/ipad/03-games.png");
    expect(fromReleases(appJson, [{ ...row(tag, true), assets: assets.slice(0, 1) }], {}, {}, "ipad")).toBeNull();
  });
  it("ignores draft and unclassified prereleases and does not invent preview builds", () => {
    const source = fromReleases(appJson, [row("v0.2.4+build.93"), { ...row("v0.2.5-preview.4+build.116", true), draft: true }, row("v0.2.5+build.117", true)]);
    expect(source.apps).toHaveLength(1);
    expect(source.featuredApps).toEqual(["app.soireecrew.mobile"]);
  });
  it("retains the full archive even beyond the old 40-version limit", () => {
    const source = fromReleases(appJson, Array.from({ length: 120 }, (_, i) => row(`v0.1.0-build.${i + 1}`)));
    expect(source.apps[0].versions).toHaveLength(120);
    expect(source.apps[0].versions.at(-1).downloadURL).toContain("v0.1.0-build.1/");
    expect(source.news).toHaveLength(20);
  });
  it("parses historical and preview tags without counting previews as public patches", () => {
    expect(releaseOfTag("v0.1.0-build.64")).toEqual({ version: "0.1.0", build: 64, channel: "public" });
    expect(releaseOfTag("v0.2.5-preview.4+build.115")).toEqual({ version: "0.2.5", build: 115, channel: "preview" });
    expect(releaseOfTag("preview-latest")).toBeNull();
  });
});

describe("what each version shows", () => {
  it("orders the screens by showcase and leaves out settings, the empty crew and the card", () => {
    expect(showcase(["06-settings.png", "09-curve.png", "02-crew.png", "01-party.png", "banner.png", "08-add-drink.png"])).toEqual(["01-party.png", "08-add-drink.png", "09-curve.png"]);
  });

  it("prefers the written notes and cleans the commit list otherwise", () => {
    expect(notesOf("- docs: x", ["Une ligne"])).toBe("• Une ligne");
    expect(notesOf(["Version 1.0.0, build 3 of abc.", "", "- feat(a,b): z", "- AltStore source: link"].join("\n"))).toBe("• Z");
  });
});
