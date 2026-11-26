import { classify } from "./change-impact.mjs";
import {execFileSync} from "node:child_process";
// Inventory is deliberately conservative: new native imports trigger a rebuild unless
// the exact import was present at the baseline. This does not attempt to infer JS semantics.
const native = /^(?:expo(?:-|$)|react-native(?:-|$)|@react-native|@expo\/ui|@\/.*native)/;
export function imports(source) {
 const names=new Set();
 for(const m of source.matchAll(/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']/g)) if(native.test(m[1])) names.add(m[1]);
 return [...names].sort();
}
export function addedNativeImports(before,after) {
 const old=new Set(imports(before));return imports(after).filter(x=>!old.has(x));
}

// Only compare shipped JS files. Resolve changes against the IPA's release
// commit, including renamed and newly created files.
export function newNativeRequirements(base, head = "HEAD") {
  const git = (...args) => execFileSync("git", args, {
    encoding: "utf8", maxBuffer: 64 * 1024 * 1024,
  });
  const paths = git("diff", "--name-only", "--no-renames", "--diff-filter=AMT", "-z", base, head)
    .split("\0").filter(path => /^(?:apps\/mobile|packages\/[^/]+)\/src\/.+\.[cm]?[jt]sx?$/.test(path) && classify(path) === "ota");
  if (!paths.length) return [];

  // An import already shipped elsewhere at the IPA commit can move files or be
  // reused without requiring another binary. Read Git objects, not working files.
  const roots = ["apps/mobile/src", ":(glob)packages/*/src/**"];
  const known = new Set();
  try {
    const matches = git("grep", "-I", "-l", "-z", "-E", "expo|react-native|@/.*native", base, "--", ...roots);
    for (const match of matches.split("\0").filter(Boolean)) {
      const path = match.slice(base.length + 1);
      if (!/\.[cm]?[jt]sx?$/.test(path) || classify(path) !== "ota") continue;
      for (const name of imports(git("show", match))) known.add(name);
    }
  } catch (error) {
    if (error.status !== 1) throw error;
  }
  const required = new Set();
  for (const path of paths) {
    for (const name of imports(git("show", `${head}:${path}`))) {
      if (!known.has(name)) required.add(name);
    }
  }
  return [...required].sort();
}
