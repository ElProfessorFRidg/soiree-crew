import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function summarizeCompatibility(entries) {
  const result = {};
  for (const {release, target} of entries) {
    const m = /^v(\d+\.\d+\.\d+)(?:-preview\.(\d+))?\+build\.(\d+)$/.exec(release);
    if (!m || !["iphone","ipad"].includes(target) || !Number.isSafeInteger(Number(m[3]))) throw new Error("Invalid compatibility entry");
    const channel = m[2] ? `preview.${m[2]}` : "public";
    const key = `${channel}/${target}`;
    (result[key] ??= []).push({version:m[1],build:Number(m[3]),release});
  }
  return Object.fromEntries(Object.entries(result).map(([key, rows]) => {
    const exact = [...new Map(rows.map(r => [r.release,r])).values()].sort((a,b)=>a.build-b.build);
    return [key,{minBuild:exact[0].build,maxBuild:exact.at(-1).build,minVersion:exact[0].version,maxVersion:exact.at(-1).version,exact}];
  }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const report = summarizeCompatibility(JSON.parse(readFileSync(process.argv[2],"utf8")));
  for (const [target, r] of Object.entries(report)) console.log(`${target}: ${r.minVersion}–${r.maxVersion} (build ${r.minBuild}–${r.maxBuild}); exact compatible builds: ${r.exact.map(x=>x.build).join(", ")}`);
}
