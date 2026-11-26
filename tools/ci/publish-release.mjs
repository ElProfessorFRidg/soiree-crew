// Publish immutable, tested build assets. PR previews never move GitHub's public /latest link.
import { appendFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { releaseOfTag } from "./altstore-source.mjs";

/** Runs `step` until it works. GitHub answers 5xx now and then (a run of PR #42 died on one), and the build behind it takes half an hour. */
export function retrying(step, { attempts = 4, shouldRetry = () => true, delayMs = (attempt) => 5000 * 3 ** attempt, sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms) } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      return step(attempt);
    } catch (error) {
      if (attempt + 1 >= attempts || !shouldRetry(error)) throw error;
      sleep(delayMs(attempt));
    }
  }
}

export function releasePlan({ version, build, channel, pr, sha }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[1-9]\d*$/.test(String(build)) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid release identity");
  if (!["public", "preview"].includes(channel) || (channel === "preview" && !/^[1-9]\d*$/.test(String(pr)))) throw new Error("Invalid release channel");
  const tag = `v${version}${channel === "preview" ? `-preview.${pr}` : ""}+build.${build}`;
  return { tag, title: `Soirée Crew ${version}${channel === "preview" ? ` Preview · PR #${pr}` : ""} (build ${build})`, flags: channel === "preview" ? ["--prerelease", "--latest=false"] : ["--latest=true"] };
}

// Never overwrite a valid release asset.
export function reconcileRelease(api, plan, expected) {
  let release = api.find();
  if (!release) release = api.createDraft();
  if (release.tag_name !== plan.tag || release.target_commitish !== plan.sha ||
      release.prerelease !== plan.preview) throw new Error("Release identity mismatch");
  api.verifyTag(release);
  const verify = assets => {
    const byName = new Map();
    for (const asset of assets) {
      if (byName.has(asset.name) || !expected.some(file => file.name === asset.name))
        throw new Error("Unexpected or duplicate release asset: " + asset.name);
      byName.set(asset.name, asset);
    }
    const incomplete = [];
    const missing = expected.filter(file => {
      const asset = byName.get(file.name);
      if (!asset) return true;
      if (asset.state === "starter" && release.draft && !asset.digest && asset.size === 0) {
        incomplete.push(asset.id);
        return true;
      }
      if (asset.state !== "uploaded" || asset.size !== file.size || asset.digest !== file.digest)
        throw new Error("Release asset mismatch: " + file.name + " is already on " + plan.tag + " with different content (state " + asset.state + ", size " + asset.size + " vs " + file.size + "). A release is never rewritten: push a new commit to get a new build number.");
      return false;
    });
    for (const id of incomplete) api.removeIncomplete(id);
    return missing;
  };
  const missing = verify(api.assets(release.id));
  if (!release.draft) {
    if (missing.length) throw new Error("Published release is incomplete; refusing mutation");
    return release;
  }
  for (const file of missing) api.upload(release.id, file);
  if (verify(api.assets(release.id)).length) throw new Error("Release verification incomplete");
  release = api.publish(release.id);
  if (release.draft || release.tag_name !== plan.tag || release.prerelease !== plan.preview ||
      release.target_commitish !== plan.sha) throw new Error("Release publication not confirmed");
  api.verifyTag(release);
  return release;
}

export function retryableReleaseError(error) {
  const detail = [error.stderr, error.message].filter(Boolean).join("\n");
  return /HTTP (?:408|409|429|5\d\d)\b|HTTP 422:.*(?:already_exists|already exists)|(?:ECONNRESET|ETIMEDOUT|unexpected EOF|connection reset|TLS handshake timeout|temporary failure)/i.test(detail) || error.code === "ETIMEDOUT";
}

export function githubReleaseApi(repo, plan, notesFile) {
  const endpoint = "repos/" + repo + "/releases";
  const gh = (...args) => execFileSync("gh", args, { encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  const json = (...args) => JSON.parse(gh("api", ...args));
  const pages = path => json("--paginate", "--slurp", path + "?per_page=100").flat();
  const checkTag = () => {
    const ref = "refs/tags/" + plan.tag;
    const output = execFileSync("git", ["ls-remote", "origin", ref, ref + "^{}"], { encoding: "utf8", timeout: 30000 }).trim();
    const refs = output.split("\n").filter(Boolean).map(line => line.split(/\s+/));
    return refs.find(pair => pair[1] === ref + "^{}")?.[0] ?? refs.find(pair => pair[1] === ref)?.[0];
  };
  return {
    find() {
      const matches = pages(endpoint).filter(release => release.tag_name === plan.tag);
      if (matches.length > 1) throw new Error("Duplicate release tag");
      return matches[0];
    },
    verifyTag(release) {
      const sha = checkTag();
      if ((sha && sha !== plan.sha) || (!sha && !release.draft)) throw new Error("Release tag SHA mismatch");
    },
    createDraft() {
      const sha = checkTag();
      if (sha && sha !== plan.sha) throw new Error("Existing tag SHA mismatch");
      try {
        return json("--method", "POST", endpoint, "-f", "tag_name=" + plan.tag, "-f", "target_commitish=" + plan.sha,
        "-f", "name=" + plan.title, "-F", "body=@" + notesFile, "-F", "draft=true", "-F", "prerelease=" + plan.preview, "-f", "make_latest=false");
      } catch (error) {
        // GitHub answers 403 when the target commit touches workflow files and is no longer the tip of a branch or of the PR's merge ref:
        // the run was superseded by a newer push. Say so instead of leaving a bare permission error.
        if (/Resource not accessible by integration/.test(String(error.stderr ?? error.message))) {
          throw new Error("GitHub refused to create the release at " + plan.sha + " (403). This run was probably superseded by a newer commit, or the PR's merge ref moved: re-run on the latest commit. Nothing was published.", { cause: error });
        }
        throw error;
      }
    },
    assets(id) { return pages(endpoint + "/" + id + "/assets"); },
    removeIncomplete(id) { gh("api", "--method", "DELETE", endpoint + "/assets/" + id); },
    // Uploads go to the release id, not the tag: a draft has no tag lookup. The name is fixed by us, never by the file system.
    upload(id, file) {
      execFileSync("gh", ["api", "--method", "POST", "https://uploads.github.com/repos/" + repo + "/releases/" + id + "/assets?name=" + encodeURIComponent(file.name),
        "-H", "Content-Type: application/octet-stream", "--input", file.path], { encoding: "utf8", timeout: 900000, maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
    },
    publish(id) {
      return json("--method", "PATCH", endpoint + "/" + id, "-F", "draft=false", "-f", "make_latest=" + !plan.preview);
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const env = process.env;
  // A pull_request run builds GitHub's synthetic merge commit, which GitHub will not use as a release target for a
  // token without workflow permission; the release is anchored to the pull request's own head commit instead.
  const releaseSha = env.RELEASE_SHA || env.GITHUB_SHA;
  const plan = releasePlan({ version: env.APP_VERSION, build: env.GITHUB_RUN_NUMBER, channel: env.CREW_RELEASE_CHANNEL, pr: env.PR_NUMBER, sha: releaseSha });
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).trim().split("\n");
  const previous = tags.filter((tag) => releaseOfTag(tag)?.channel === "public").sort((a, b) => releaseOfTag(b).build - releaseOfTag(a).build)[0];
  const changes = execFileSync("git", ["log", previous ? `${previous}..HEAD` : "HEAD", "--no-merges", "--pretty=format:- %s", "-40"], { encoding: "utf8" });
  const notes = [plan.title, "", changes, "", "- iOS: `soiree-crew-unsigned.ipa`, unsigned.", "- iPad: `soiree-crew-ipad-unsigned.ipa`, native tablet interface.", `- AltStore / SideStore: https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/altstore/source.json`, `- iPad source: https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/altstore/source-ipad.json`];
  if (env.CREW_RELEASE_CHANNEL === "preview") notes.push("", "Preview is a separate app and keeps its own local data. The public release stays unchanged.");
  writeFileSync("release-notes.md", `${notes.join("\n")}\n`);
  const files = ["soiree-crew-unsigned.ipa", "soiree-crew-ipad-unsigned.ipa", "ios-build-info-iphone.json", "ios-build-info-ipad.json"].map((name) => `dist/${name}`);
  for (const file of files) if (!existsSync(file)) throw new Error(`Missing release payload: ${file}`);
  if (existsSync("dist/soiree-crew.apk")) files.push("dist/soiree-crew.apk");
  const identity = { ...plan, sha: releaseSha, preview: env.CREW_RELEASE_CHANNEL === "preview" };
  const expected = files.map(path => {
    const data = readFileSync(path);
    return { path, name: basename(path), size: data.length, digest: "sha256:" + createHash("sha256").update(data).digest("hex") };
  });
  retrying(attempt => {
    if (attempt) console.log("Retrying release reconciliation (attempt " + (attempt + 1) + ")");
    return reconcileRelease(githubReleaseApi(env.GITHUB_REPOSITORY, identity, "release-notes.md"), identity, expected);
  }, { shouldRetry: retryableReleaseError });
  appendFileSync(env.GITHUB_OUTPUT, "tag=" + plan.tag + "\n");
}
