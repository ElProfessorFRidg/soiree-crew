import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const tagPattern = /^v(\d+\.\d+\.\d+)(?:-preview\.\d+)?\+build\.(\d+)$/;
const sourcePattern = /^(?:apps\/mobile|packages\/(?:bac|design-tokens|fuzzy|games|money|territory|units))\/src\/.+\.(?:[jt]sx?|json|png|jpe?g|webp|svg|gif|avif|ttf|otf|mp3|wav)$/i;

export function planUpdate({ tag, target, info, projectId, serverUrl = "", publicServers = "", paths }) {
  const match = tagPattern.exec(tag);
  if (!match || !["iphone", "ipad"].includes(target)) throw new Error("Invalid IPA release tag or device target");
  const [, version, build] = match;
  const channel = tag.includes("-preview.") ? "preview" : "public";
  const stream = `${channel}-${target}`;
  const runtime = `crew-${stream}-${build}`;
  const serverConfig = createHash("sha256").update(`${serverUrl}\0${publicServers}`).digest("hex");
  if (!projectId || info.target !== target || info.channel !== channel ||
      info.updates?.projectId !== projectId || info.updates.runtime !== runtime ||
      info.updates.stream !== stream || info.updates.version !== version ||
      info.updates.build !== build || info.updates.serverConfig !== serverConfig) {
    throw new Error("Expo Updates and the current configuration must match the selected IPA");
  }
  const changed = paths.filter((path) => !path.startsWith("docs/") && !path.startsWith("apps/server/") && !/^[\w-]+\.md$/i.test(path));
  if (changed.some((path) => !sourcePattern.test(path))) {
    throw new Error("Changes outside the mobile JS and assets require a new IPA");
  }
  return { version, build, stream, runtime };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, target, metadata] = process.argv.slice(2);
  if (!tagPattern.test(tag)) throw new Error("Use the exact GitHub release tag");
  const baseline = execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], { encoding: "utf8" }).trim();
  const paths = execFileSync("git", ["diff", "--name-only", "--no-renames", "-z", baseline, "HEAD"], { encoding: "utf8" }).split("\0").filter(Boolean);
  const plan = planUpdate({
    tag, target, paths, info: JSON.parse(readFileSync(metadata, "utf8")),
    projectId: process.env.CREW_EXPO_PROJECT_ID?.trim(), serverUrl: process.env.CREW_SERVER_URL,
    publicServers: process.env.CREW_PUBLIC_SERVERS,
  });
  for (const [key, value] of Object.entries(plan)) console.log(`${key}=${value}`);
}
