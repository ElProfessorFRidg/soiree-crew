import { describe, expect, it } from "vitest";
import { addRelease, backfill, privacyFrom, scarletOf } from "./altstore-source.mjs";

const appJson = {
  expo: {
    ios: { bundleIdentifier: "app.soireecrew.mobile" },
    plugins: ["expo-router", ["expo-location", { locationWhenInUsePermission: "To check in." }], ["expo-image-picker", { photosPermission: "Album.", cameraPermission: "Camera." }]],
  },
};
const release = (version, build) => ({ version, build, tag: `v${version}+build.${build}`, date: "2026-10-31T00:00:00.000Z", notes: `Version ${version}\n\nDetails`, size: 1234, screenshots: ["01-party.png"] });

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
    expect(source.apps[0].screenshots[0]).toMatch(/\/altstore\/screens\/01-party\.png$/);
    expect(source.news[0]).toMatchObject({ title: "Soirée Crew 0.1.2", caption: "Version 0.1.2" });
  });
});

describe("old versions and other sideloading apps", () => {
  const asset = { name: "soiree-crew-unsigned.ipa", size: 999 };
  const releases = [
    { tag_name: "v0.1.2+build.68", published_at: "2026-10-30T02:00:00Z", body: "two", assets: [asset] },
    { tag_name: "v0.1.0-build.64", published_at: "2026-10-29T00:00:00Z", body: "old scheme", assets: [asset] },
    { tag_name: "v0.1.1+build.67", published_at: "2026-10-30T01:00:00Z", body: "one", assets: [asset] },
  ];

  it("lists every release published before the source, newest first, once", () => {
    let source = backfill(null, appJson, releases);
    source = backfill(source, appJson, releases);
    expect(source.apps[0].versions.map((v) => v.version)).toEqual(["0.1.2", "0.1.1"]);
  });

  it("keeps the first format's fields on the app and writes the Scarlet format", () => {
    const source = addRelease(backfill(null, appJson, releases), appJson, release("0.1.10", 80));
    expect(source.apps[0]).toMatchObject({ version: "0.1.10", downloadURL: expect.stringContaining("v0.1.10%2Bbuild.80") });
    expect(source.apps[0].versions.map((v) => v.version)).toEqual(["0.1.10", "0.1.2", "0.1.1"]);
    const scarlet = scarletOf(source);
    expect(scarlet.META.repoName).toBe("Soirée Crew");
    expect(scarlet.Other.map((a) => a.version)).toEqual(["0.1.10", "0.1.2", "0.1.1"]);
  });
});
