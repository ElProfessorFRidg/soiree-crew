// Next version name for a release of main (docs/VERSIONING.md). app.json holds the series as
// "major.minor.0"; each release takes the next patch number after the highest tag of that series.
// Tags look like v0.1.3+build.71; older ones (v0.1.0-build.64) are not part of any patch count.
//
//   git ls-remote --tags origin | node tools/ci/next-version.mjs   ->   version=0.1.4
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** The series of a version string: "0.1.0" -> "0.1". */
export function seriesOf(version) {
  const [major, minor] = version.split(".");
  if (!/^\d+$/.test(major ?? "") || !/^\d+$/.test(minor ?? "")) throw new Error(`app.json version "${version}" is not major.minor.patch`);
  return `${major}.${minor}`;
}

/** Next "major.minor.patch" given the tag names (with or without "refs/tags/"). Patches start at 1. */
export function nextVersion(series, tags) {
  let highest = 0;
  for (const raw of tags) {
    const tag = raw.replace(/^.*refs\/tags\//, "").replace(/\^\{\}$/, "").trim();
    const match = /^v(\d+)\.(\d+)\.(\d+)(?:\+.*)?$/.exec(tag);
    if (match && `${match[1]}.${match[2]}` === series) highest = Math.max(highest, Number(match[3]));
  }
  return `${series}.${highest + 1}`;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}` || process.argv[1]?.endsWith("next-version.mjs")) {
  const appJson = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  const input = readFileSync(0, "utf8");
  console.log(`version=${nextVersion(seriesOf(appJson.expo.version), input.split("\n"))}`);
}
