import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";

export const IPA_ASSETS = ["soiree-crew-unsigned.ipa", "soiree-crew-ipad-unsigned.ipa", "ios-build-info-iphone.json", "ios-build-info-ipad.json"];

export function verifyRelease(release, { tag, preview, draft = false, names = IPA_ASSETS }) {
  if (!release || release.tag_name !== tag || release.draft !== draft || release.prerelease !== preview || !Array.isArray(release.assets)) throw new Error("Unexpected release identity or visibility");
  for (const name of names) {
    const matches = release.assets.filter(a => a?.name === name);
    const a = matches[0];
    if (matches.length !== 1 || a.state !== "uploaded" || !Number.isSafeInteger(a.size) || a.size <= 0 || !/^sha256:[a-f0-9]{64}$/.test(a.digest ?? "")) throw new Error("Missing or invalid uploaded asset: " + name);
  }
}

export async function verifyAsset(release, path) {
  const name = basename(path);
  const matches = release.assets.filter(a => a?.name === name);
  const asset = matches[0];
  if (matches.length !== 1 || asset.state !== "uploaded" || !/^sha256:[a-f0-9]{64}$/.test(asset.digest ?? "")) throw new Error("Invalid asset identity: " + name);
  const info = await stat(path);
  if (!info.isFile() || info.size <= 0 || info.size !== asset.size) throw new Error("Asset size mismatch: " + name);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  if ("sha256:" + hash.digest("hex") !== asset.digest) throw new Error("Asset digest mismatch: " + name);
}

export function verifyGate({ route, checks, version, ota, ios, launch, release, publicationRequired, android, androidRequired }) {
  if (checks !== "success" || version !== "success") throw new Error("Required checks or version failed");
  if (route === "checks") {
    if ([ota, ios, launch, release].some(x => x !== "skipped")) throw new Error("Unexpected delivery job for checks route");
  } else if (route === "ota") {
    if (ota !== "success" || [ios, launch, release].some(x => x !== "skipped")) throw new Error("OTA delivery incomplete or unexpected native job");
  } else if (route === "ipa") {
    if (ota !== "skipped" || ios !== "success" || launch !== "success") throw new Error("IPA build or launch incomplete");
    if (release !== (publicationRequired ? "success" : "skipped")) throw new Error("IPA release publication incomplete or unexpected");
  } else throw new Error("Unknown delivery route: " + route);
  if (android !== (androidRequired ? "success" : "skipped")) throw new Error("Android delivery incomplete or unexpected");
  if (androidRequired && route !== "ipa") throw new Error("Android requires native route");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [command, file, tag, ...paths] = process.argv.slice(2);
    if (command === "gate") {
      const e = process.env;
      verifyGate({ route:e.ROUTE, checks:e.CHECKS, version:e.VERSION, ota:e.OTA, ios:e.IOS, launch:e.LAUNCH, release:e.RELEASE, publicationRequired:e.PUBLICATION_REQUIRED === "true", android:e.ANDROID, androidRequired:e.ANDROID_REQUIRED === "true" });
    } else if (command === "assets") {
      const release = JSON.parse(readFileSync(file,"utf8"));
      verifyRelease(release, { tag, preview: tag.includes("-preview."), draft: process.env.RELEASE_DRAFT === "true" });
      for (const path of paths) await verifyAsset(release,path);
    } else throw new Error("Unknown integrity command");
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
