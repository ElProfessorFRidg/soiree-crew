import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function latestIpaTag(releases, pr) {
  const prefix = pr ? `-preview.${pr}+` : "+";
  return releases.flatMap((release) => {
    const match = /^v\d+\.\d+\.\d+(-preview\.\d+)?\+build\.(\d+)$/.exec(release.tag_name);
    const separator = match ? (match[1] ?? "") + "+" : "";
    if (!match || separator !== prefix || release.draft || release.prerelease !== Boolean(pr)) return [];
    const names = (release.assets ?? []).map((asset) => asset.name);
    return ["iphone", "ipad"].every((target) => names.includes(`ios-build-info-${target}.json`))
      ? [{ tag: release.tag_name, build: Number(match[2]) }] : [];
  }).sort((a, b) => b.build - a.build)[0]?.tag ?? "";
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(latestIpaTag(JSON.parse(readFileSync(0, "utf8")), process.env.PR_NUMBER));
}
