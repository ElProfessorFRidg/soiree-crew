import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function versionForBuild(version, run) {
  const series = /^(\d+\.\d+)\.\d+$/.exec(version)?.[1];
  if (!series || !/^[1-9]\d*$/.test(String(run))) throw new Error("Invalid version series or Build run number");
  return `${series}.${run}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  console.log(`version=${versionForBuild(app.expo.version, process.env.GITHUB_RUN_NUMBER)}`);
}
