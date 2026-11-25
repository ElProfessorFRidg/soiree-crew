import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Each PR owns its preview runtime. Public targets the latest public IPA.
export function ipaCandidates(releases, pr, openPrs = []) {
  const allowed = new Set([pr].filter(Boolean).map(String));
  return releases.flatMap((release) => {
    const match = /^v\d+\.\d+\.\d+(?:-preview\.(\d+))?\+build\.(\d+)$/.exec(release.tag_name);
    if (!match || release.draft || release.prerelease !== Boolean(pr)) return [];
    if (pr ? !allowed.has(match[1]) : match[1] !== undefined) return [];
    const names = (release.assets ?? []).map((asset) => asset.name);
    return ["iphone", "ipad"].every((target) => names.includes(`ios-build-info-${target}.json`))
      ? [{ tag: release.tag_name, build: Number(match[2]), own: Boolean(pr) && match[1] === String(pr) }] : [];
  }).sort((a, b) => Number(b.own) - Number(a.own) || b.build - a.build).map(x => x.tag);
}

export function latestIpaTag(releases, pr, openPrs = []) {
  return ipaCandidates(releases, pr, openPrs)[0] ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const open = (process.env.OPEN_PRS ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  // The releases JSON comes as a file path (build workflow) or on stdin.
  const releases = JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8"));
  console.log(process.env.ALL_CANDIDATES === "1" ? ipaCandidates(releases, process.env.PR_NUMBER, open).join("\n") : latestIpaTag(releases, process.env.PR_NUMBER, open));
}
