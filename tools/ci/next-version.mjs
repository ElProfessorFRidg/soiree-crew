import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const prefix = "crew-version/v";
const git = (args, options = {}) => execFileSync("git", args, { encoding: "utf8", ...options }).trim();

export function versionAllocation(version, run, tags, reservations) {
  const series = /^(\d+\.\d+)\.\d+$/.exec(version)?.[1];
  if (!series || !/^[1-9]\d*$/.test(run)) throw new Error("Invalid version series or Build run number");
  const versionPattern = /^(\d+\.\d+)\.(\d+)$/;
  const assigned = reservations.find(({ tag, owner }) =>
    owner === `build-${run}` && versionPattern.exec(tag.slice(prefix.length))?.[1] === series);
  if (assigned) return { version: assigned.tag.slice(prefix.length), reserved: true };

  let highest = 0;
  for (const tag of tags) {
    const match = /^(?:crew-version\/)?v(\d+\.\d+)\.(\d+)(?:-preview\.\d+)?(?:\+build\.\d+)?$/.exec(tag);
    if (match?.[1] === series) highest = Math.max(highest, Number(match[2]));
  }
  return { version: `${series}.${highest + 1}`, reserved: false };
}

function versionForRun(version, run, reserve) {
  for (let attempt = 0; attempt < 10; attempt++) {
    git(["fetch", "--no-tags", "origin", "refs/tags/crew-version/*:refs/tags/crew-version/*"], { stdio: ["ignore", "pipe", "inherit"] });
    const tags = git(["ls-remote", "--tags", "--refs", "origin"]).split("\n").map((line) => line.split("\trefs/tags/")[1]);
    const reservations = git(["for-each-ref", "--format=%(refname:short)%09%(contents:subject)", "refs/tags/crew-version"]).split("\n")
      .filter(Boolean).map((line) => {
        const [tag, owner] = line.split("\t");
        return { tag, owner };
      });
    const next = versionAllocation(version, run, tags, reservations);
    if (!reserve || next.reserved) return next.version;

    const tag = `${prefix}${next.version}`;
    if (reservations.some((entry) => entry.tag === tag)) continue;
    // Reservation tags are counters, not release provenance. Anchor them to an
    // existing main commit rather than a synthetic PR merge containing workflow edits.
    git(["fetch", "--no-tags", "origin", "refs/heads/main"]);
    const anchor = git(["rev-parse", "--verify", "FETCH_HEAD^{commit}"]);
    git(["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com",
      "tag", "--annotate", tag, "--message", `build-${run}`, anchor]);
    try {
      git(["push", "origin", `refs/tags/${tag}:refs/tags/${tag}`]);
      return next.version;
    } catch (error) {
      git(["tag", "--delete", tag]);
      // A competing run may have claimed this number. Re-read its reservation before retrying.
      if (!git(["ls-remote", "--tags", "--refs", "origin", `refs/tags/${tag}`])) throw error;
    }
  }
  throw new Error("Could not reserve a unique IPA version");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const app = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  console.log(`version=${versionForRun(app.expo.version, process.env.GITHUB_RUN_NUMBER ?? "", process.env.RESERVE_VERSION === "true")}`);
}
