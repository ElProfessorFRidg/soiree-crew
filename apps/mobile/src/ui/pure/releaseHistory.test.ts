import { expect, it } from "vitest";
import { updateFromReleases, versionsFromSource } from "./releaseHistory";

const url = (name: string) => `https://github.com/ElProfessorFRidg/soiree-crew/releases/download/v0.2.5%2Bbuild.120/${name}`;
const assets = ["soiree-crew-ipad-unsigned.ipa", "soiree-crew-unsigned.ipa"].map((name) => ({ name, browser_download_url: url(name) }));
it("selects the exact native device asset even when iPad appears first", () => {
  const release = { tag_name: "v0.2.5+build.120", assets };
  expect(updateFromReleases(release, "public", "iphone")?.url).toBe(url("soiree-crew-unsigned.ipa"));
  expect(updateFromReleases(release, "public", "ipad")?.url).toBe(url("soiree-crew-ipad-unsigned.ipa"));
  expect(updateFromReleases({ ...release, assets: assets.slice(1) }, "public", "ipad")).toBeNull();
});
it("separates preview and public updates and skips draft or unrelated prereleases", () => {
  const rows = [{ tag_name: "v0.2.5+build.120", assets }, { tag_name: "v0.2.6-preview.4+build.125", prerelease: true, assets }, { tag_name: "v0.2.6-preview.4+build.126", prerelease: true, draft: true, assets }];
  expect(updateFromReleases(rows, "public", "iphone")?.build).toBe(120);
  expect(updateFromReleases(rows, "preview", "iphone")?.build).toBe(125);
});
it("keeps individual same-version builds and ignores malformed or mutable download links", () => {
  const version = { version: "0.2.5", buildVersion: "120", downloadURL: url("soiree-crew-unsigned.ipa"), minOSVersion: "16.4" };
  const source = { apps: [{ bundleIdentifier: "app.soireecrew.mobile", versions: [version, { ...version, buildVersion: "119" }, { ...version, downloadURL: "https://github.com/ElProfessorFRidg/soiree-crew/releases/latest/download/app.ipa" }] }, { bundleIdentifier: "app.soireecrew.mobile.preview", versions: [{ ...version, buildVersion: "125" }] }] };
  expect(versionsFromSource(source, "public").map((v) => v.build)).toEqual([120, 119]);
  expect(versionsFromSource(source, "preview").map((v) => v.build)).toEqual([125]);
  expect(versionsFromSource(null, "public")).toEqual([]);
});
