import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The IPA an OTA update targets. The Preview app holds whichever preview IPA was installed last,
// so a PR targets the newest preview IPA among the PRs still open (its own included). Public
// targets the newest public IPA. docs/OTA.md.
export function latestIpaTag(releases, pr, openPrs = []) {
  const allowed = new Set([pr, ...openPrs].filter(Boolean).map(String));
  return releases.flatMap((release) => {
    const match = /^v\d+\.\d+\.\d+(?:-preview\.(\d+))?\+build\.(\d+)$/.exec(release.tag_name);
    if (!match || release.draft || release.prerelease !== Boolean(pr)) return [];
    if (pr ? !allowed.has(match[1]) : match[1] !== undefined) return [];
    const names = (release.assets ?? []).map((asset) => asset.name);
    return ["iphone", "ipad"].every((target) => names.includes(`ios-build-info-${target}.json`))
      ? [{ tag: release.tag_name, build: Number(match[2]) }] : [];
  }).sort((a, b) => b.build - a.build)[0]?.tag ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const open = (process.env.OPEN_PRS ?? "").split(",").map((n) => n.trim()).filter(Boolean);
  // The releases JSON comes as a file path (build workflow) or on stdin.
  console.log(latestIpaTag(JSON.parse(readFileSync(process.argv[2] ?? 0, "utf8")), process.env.PR_NUMBER, open));
}
