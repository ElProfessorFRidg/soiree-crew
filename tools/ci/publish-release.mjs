// Publish immutable, tested build assets. PR previews never move GitHub's public /latest link.
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseOfTag } from "./altstore-source.mjs";

export function releasePlan({ version, build, channel, pr, sha }) {
  if (!/^\d+\.\d+\.\d+$/.test(version) || !/^[1-9]\d*$/.test(String(build)) || !/^[a-f0-9]{40}$/.test(sha)) throw new Error("Invalid release identity");
  if (!["public", "preview"].includes(channel) || (channel === "preview" && !/^[1-9]\d*$/.test(String(pr)))) throw new Error("Invalid release channel");
  const tag = `v${version}${channel === "preview" ? `-preview.${pr}` : ""}+build.${build}`;
  return { tag, title: `Soirée Crew ${version}${channel === "preview" ? ` Preview · PR #${pr}` : ""} (build ${build})`, flags: channel === "preview" ? ["--prerelease", "--latest=false"] : ["--latest=true"] };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const env = process.env;
  const plan = releasePlan({ version: env.APP_VERSION, build: env.GITHUB_RUN_NUMBER, channel: env.CREW_RELEASE_CHANNEL, pr: env.PR_NUMBER, sha: env.GITHUB_SHA });
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).trim().split("\n");
  const previous = tags.filter((tag) => releaseOfTag(tag)?.channel === "public").sort((a, b) => releaseOfTag(b).build - releaseOfTag(a).build)[0];
  const changes = execFileSync("git", ["log", previous ? `${previous}..HEAD` : "HEAD", "--no-merges", "--pretty=format:- %s", "-40"], { encoding: "utf8" });
  const notes = [plan.title, "", changes, "", "- iOS: `soiree-crew-unsigned.ipa`, unsigned.", "- iPad: `soiree-crew-ipad-unsigned.ipa`, native tablet interface.", `- AltStore / SideStore: https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/altstore/source.json`, `- iPad source: https://raw.githubusercontent.com/${env.GITHUB_REPOSITORY}/altstore/source-ipad.json`];
  if (env.CREW_RELEASE_CHANNEL === "preview") notes.push("", "Preview is a separate app and keeps its own local data. The public release stays unchanged.");
  writeFileSync("release-notes.md", `${notes.join("\n")}\n`);
  const files = ["soiree-crew-unsigned.ipa", "soiree-crew-ipad-unsigned.ipa", "ios-build-info-iphone.json", "ios-build-info-ipad.json"].map((name) => `dist/${name}`);
  for (const file of files) if (!existsSync(file)) throw new Error(`Missing release payload: ${file}`);
  if (existsSync("dist/soiree-crew.apk")) files.push("dist/soiree-crew.apk");
  execFileSync("gh", ["release", "create", plan.tag, ...files, "--title", plan.title, "--notes-file", "release-notes.md", "--target", env.GITHUB_SHA, ...plan.flags], { stdio: "inherit" });
  appendFileSync(env.GITHUB_OUTPUT, `tag=${plan.tag}\n`);
}
