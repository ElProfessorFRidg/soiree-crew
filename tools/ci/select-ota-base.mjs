import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const TAG = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-preview\.([1-9]\d*))?\+build\.([1-9]\d*)$/;
const REQUIRED = ["soiree-crew-unsigned.ipa", "soiree-crew-ipad-unsigned.ipa", "ios-build-info-iphone.json", "ios-build-info-ipad.json"];

export function completeIpa(release) {
  return Array.isArray(release.assets) && REQUIRED.every(name => {
    const assets = release.assets.filter(asset => asset?.name === name);
    return assets.length === 1 && assets[0].state === "uploaded" && Number.isSafeInteger(assets[0].size) && assets[0].size > 0;
  });
}

// Each PR owns its preview history. A missing latest IPA is an infrastructure
// failure, not permission to publish to an older runtime or start a rebuild.
export function ipaCandidates(releases, pr) {
  if (!Array.isArray(releases)) throw new Error("Invalid releases response");
  const scope = pr == null || pr === "" ? "" : String(pr);
  if (scope && !/^[1-9]\d*$/.test(scope)) throw new Error("Invalid preview PR number");
  const unique = new Map();
  for (const release of releases) {
    if (!release || typeof release !== "object" || typeof release.tag_name !== "string") throw new Error("Invalid release entry");
    const match = TAG.exec(release.tag_name);
    if (!match || release.draft === true) continue;
    const owner = match[4] ?? "";
    if (release.draft !== false || release.prerelease !== Boolean(owner)) throw new Error(`Invalid release flags: ${release.tag_name}`);
    const build = BigInt(match[5]);
    const item = { tag: release.tag_name, owner, build, complete: completeIpa(release) };
    const previous = unique.get(item.tag);
    if (previous && previous.complete !== item.complete) throw new Error(`Conflicting release entries: ${item.tag}`);
    unique.set(item.tag, item);
  }
  const rows = [...unique.values()].filter(item => item.owner === scope).sort((a, b) => a.build > b.build ? -1 : a.build < b.build ? 1 : 0);
  const builds = new Map();
  for (const item of unique.values()) {
    // Current binary runtimes encode public/preview + target + build, not PR.
    // Detect a duplicated runtime even when the competing Preview belongs to another PR.
    const key = `${item.owner ? "preview" : "public"}:${item.build}`;
    const existing = builds.get(key);
    if (existing && existing.tag !== item.tag && (existing.owner === scope || item.owner === scope)) throw new Error(`Ambiguous IPA runtime: ${existing.tag} and ${item.tag}`);
    builds.set(key, item);
  }
  if (rows.length && !rows[0].complete) throw new Error(`Latest IPA release incomplete: ${rows[0].tag}`);
  return rows.filter(item => item.complete).map(item => item.tag);
}

export function latestIpaTag(releases, pr) {
  return ipaCandidates(releases, pr)[0] ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const releases = JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8"));
    const tags = ipaCandidates(releases, process.env.PR_NUMBER);
    console.log(process.env.ALL_CANDIDATES === "1" ? tags.join("\n") : tags[0] ?? "");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
