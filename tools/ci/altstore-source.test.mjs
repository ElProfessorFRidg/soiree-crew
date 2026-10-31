import { describe, expect, it } from "vitest";
import { addRelease, fromReleases, notesOf, privacyFrom, scarletOf, showcase } from "./altstore-source.mjs";

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

  it("puts the newest version first, replaces a re-released one and keeps a download link per tag", () => {
    let source = addRelease(null, appJson, release("0.1.1", 67));
    source = addRelease(source, appJson, release("0.1.2", 68));
    source = addRelease(source, appJson, release("0.1.2", 69));
    const versions = source.apps[0].versions;
    expect(versions.map((v) => [v.version, v.buildVersion])).toEqual([["0.1.2", "69"], ["0.1.1", "67"]]);
    expect(versions[0].downloadURL).toBe("https://github.com/ElProfessorFRidg/soiree-crew/releases/download/v0.1.2%2Bbuild.69/soiree-crew-unsigned.ipa");
    expect(source.apps[0].screenshots).toEqual(["https://raw.githubusercontent.com/ElProfessorFRidg/soiree-crew/altstore/screens/0.1.2/01-party.png"]);
    expect(source.headerURL).toMatch(/\/altstore\/header\.png$/);
    expect(source.news[0]).toMatchObject({
      title: "Soirée Crew 0.1.2",
      caption: "• Version 0.1.2",
      imageURL: expect.stringMatching(/\/screens\/0\.1\.2\/banner\.png$/),
      url: "https://github.com/ElProfessorFRidg/soiree-crew/releases/tag/v0.1.2%2Bbuild.69",
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
    const [v3, v2, v1] = source.apps[0].versions;
    expect([v3.version, v2.version, v1.version]).toEqual(["0.1.3", "0.1.2", "0.1.1"]);
    expect(v3.localizedDescription).toBe("• Brand catalogue\n• Calmer caret");
    expect(v1.localizedDescription).toBe("• Première\n• Deuxième");
    // 0.1.3 has no screenshots of its own: the app keeps showing 0.1.2's, in showcase order.
    expect(source.apps[0].screenshots.map((url) => url.split("/screens/")[1])).toEqual(["0.1.2/01-party.png", "0.1.2/09-curve.png"]);
    expect(source.news.find((n) => n.identifier === "release-0.1.3").imageURL).toBeUndefined();
    expect(source.news.find((n) => n.identifier === "release-0.1.2").imageURL).toMatch(/0\.1\.2\/banner\.png$/);
  });

  it("keeps the first format's fields on the app and writes the Scarlet format", () => {
    const source = addRelease(fromReleases(appJson, releases), appJson, release("0.1.10", 80));
    expect(source.apps[0]).toMatchObject({ version: "0.1.10", downloadURL: expect.stringContaining("v0.1.10%2Bbuild.80") });
    expect(source.apps[0].versions.map((v) => v.version)).toEqual(["0.1.10", "0.1.2", "0.1.1"]);
    const scarlet = scarletOf(source);
    expect(scarlet.META.repoName).toBe("Soirée Crew");
    expect(scarlet.Other.map((a) => a.version)).toEqual(["0.1.10", "0.1.2", "0.1.1"]);
    expect(scarlet.Other[0].screenshots).toEqual([expect.stringMatching(/screens\/0\.1\.10\/01-party\.png$/)]);
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
