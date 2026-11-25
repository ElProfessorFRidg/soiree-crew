import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export function classify(path) {
  if (path === "@impact:dependency-ota") return "ota";
  if (/^apps\/mobile\/(?:native|modules|plugins|certs)\//.test(path) && !/\.md$/i.test(path)) return "ipa";
  if (/\.md$/i.test(path) || /^(docs|research|apps\/server|deploy)\//.test(path) ||
      /^\.github\/(?!actions\/|workflows\/(?:build|ota)\.yml$)/.test(path) ||
      /^tools\/ci\/(?:plan-ota|select-ota-base|report-route|change-impact|publish-ota)(?:\.test)?\.mjs$/.test(path) ||
      /(?:^|\/)(?:__tests__|tests)\//.test(path) || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
      /^apps\/mobile\/store\/release-notes\.json$/.test(path)) return "checks";
  if (/^(?:apps\/mobile|packages\/(?:bac|design-tokens|fuzzy|games|mls|money|territory|units))\/src\/.+\.(?:[jt]sx?|json|png|jpe?g|webp|svg|gif|avif|ttf|otf|mp3|wav|m4a|aac|ogg)$/i.test(path)) return "ota";
  if (/^tools\/(?!ci\/).*\.py$/.test(path) || /^tools\/ci\/(?:altstore-images|dependency-impact|dependency-impact-test|ota-smoke-check)\.py$/.test(path)) return "checks";
  return "ipa";
}
const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
export function changedPaths(base, head = "HEAD") {
  const paths = git("diff", "--name-only", "--no-renames", "-z", base, head).split("\0").filter(Boolean);
  return paths.flatMap(path => {
    if (!/^(?:pnpm-lock\.yaml|package\.json|apps\/mobile\/package\.json|packages\/[^/]+\/package\.json)$/.test(path)) return [path];
    try {
      const route = execFileSync("python3", ["tools/ci/dependency-impact.py", base, head, path], { encoding: "utf8" }).trim();
      if (route === "checks") return [];
      if (route === "ota") return ["@impact:dependency-ota"];
    } catch { /* Never assume compatibility if the analyzer fails. */ }
    return [path];
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(changedPaths(process.argv[2]).every(p => classify(p) === "checks") ? "checks" : "mobile");
}
