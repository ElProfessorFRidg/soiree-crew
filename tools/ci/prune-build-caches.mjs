import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function staleCacheIds(caches, keep = 2) {
  if (!Number.isInteger(keep) || keep < 1) throw new Error("Invalid cache retention");
  const families = new Map();
  for (const c of caches) {
    if (c.ref !== "refs/heads/main" || !Number.isSafeInteger(c.id) || typeof c.key !== "string" || !Number.isFinite(Date.parse(c.created_at))) continue;
    const native = /^ios-build-v[23]-xcode26\.6-(iphone|ipad)-/.exec(c.key) ??
      /^ios-build-xcode26\.6-[a-f0-9]+-(iphone|ipad)-/.exec(c.key) ??
      (/^ios-build-xcode26\.6-/.test(c.key) ? ["", "legacy"] : null);
    const jsi = /^expo-modules-jsi-v2-xcode26\.6-(iphone|ipad)-/.exec(c.key);
    const pnpm = /^pnpm-store-v2-([^-]+-[^-]+)-/.exec(c.key);
    const family = native ? "native-" + native[1] : jsi ? "jsi-" + jsi[1] :
      pnpm ? "pnpm-" + pnpm[1] : /^expo-modules-jsi-xcode26\.6-/.test(c.key) ? "jsi-legacy" : null;
    if (!family) continue;
    if (!families.has(family)) families.set(family, []);
    families.get(family).push(c);
  }
  return [...families.values()].flatMap(items => items
    .sort((a,b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)
    .slice(keep).map(c => c.id));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (process.env.GITHUB_REF !== "refs/heads/main" || !repo) throw new Error("Cache pruning requires main");
  const endpoint = "repos/" + repo + "/actions/caches";
  const pages = JSON.parse(execFileSync("gh", ["api", "--paginate", "--slurp", endpoint + "?ref=refs%2Fheads%2Fmain&per_page=100"], {encoding:"utf8", maxBuffer: 256 * 1024 * 1024}));
  for (const id of staleCacheIds(pages.flatMap(page => page.actions_caches))) {
    if (!Number.isSafeInteger(id)) throw new Error("Invalid cache id");
    try {
      execFileSync("gh", ["api", "--method", "DELETE", endpoint + "/" + id], {encoding:"utf8", timeout:30000, stdio:["ignore","pipe","pipe"]});
      console.log("Deleted stale main cache " + id);
    } catch (error) {
      if (!/HTTP 404\b/.test(String(error.stderr ?? error.message))) throw error;
      console.log("Cache already evicted: " + id);
    }
  }
}
