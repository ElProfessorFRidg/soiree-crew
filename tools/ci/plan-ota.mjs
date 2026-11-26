import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { classify, changedPaths } from "./change-impact.mjs";
import { newNativeRequirements } from "./native-imports.mjs";

export class IncompatibleUpdate extends Error {}
const tagPattern = /^v(\d+\.\d+\.\d+)(?:-preview\.\d+)?\+build\.(\d+)$/;

// Attribution is diagnostic only: compatibility always uses the actual IPA-to-HEAD diff.
export function formatNativeOrigins(nativePaths, changePaths) {
  const current = new Set(changePaths);
  const local = nativePaths.filter(path => current.has(path));
  const inherited = nativePaths.filter(path => !current.has(path));
  const section = (label, paths) => paths.length
    ? "\n" + label + ":\n" + paths.slice(0, 15).map(path => "- " + path).join("\n") +
      (paths.length > 15 ? "\n- … " + (paths.length - 15) + " more" : "")
    : "\n" + label + ": none";
  return "\n\nNative differences by origin (relative to the event base):" +
    section("Changed by this PR/push", local) +
    section("Already present in the event base, different from the IPA", inherited);
}

export function planUpdate({ tag, target, info, otaUrl, serverUrl = "", publicServers = "", paths, changePaths }) {
  const match = tagPattern.exec(tag);
  if (!match || !["iphone", "ipad"].includes(target)) throw new Error("Invalid IPA release tag or device target");
  const [, version, build] = match;
  const channel = tag.includes("-preview.") ? "preview" : "public";
  const stream = `${channel}-${target}`;
  const runtime = `crew-${stream}-${build}`;
  const serverConfig = createHash("sha256").update(`${serverUrl}\0${publicServers}`).digest("hex");
  if (!otaUrl || info.target !== target || info.channel !== channel ||
      info.updates?.otaUrl !== otaUrl || info.updates.runtime !== runtime ||
      info.updates.stream !== stream || info.updates.version !== version ||
      info.updates.build !== build || info.updates.serverConfig !== serverConfig) {
    throw new IncompatibleUpdate("Expo Updates and the current configuration must match the selected IPA");
  }
  // CI orchestration and server deployment files do not ship in the app: the checks above already compare the update
  // configuration with the IPA, so workflow and CI tool changes alone do not need a new binary.
  const native = paths.filter(path => classify(path) === "ipa");
  if (native.length) {
    const list = native.slice(0, 15).map((path) => `\n- ${path}`).join("") + (native.length > 15 ? `\n- … ${native.length - 15} more` : "");
    const origin = changePaths === undefined ? "" : formatNativeOrigins(native, changePaths);
    throw new IncompatibleUpdate(`Changes outside the mobile JS and assets require a new IPA:${list}${origin}`);
  }
  return { version, build, stream, runtime };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [tag, target, metadata] = process.argv.slice(2);
    if (!tagPattern.test(tag)) throw new Error("Use the exact GitHub release tag");
    const baseline = execFileSync("git", ["rev-parse", "--verify", `refs/tags/${tag}^{commit}`], { encoding: "utf8" }).trim();
    const paths = changedPaths(baseline);
    // Compare the checked-out merge result with the event base, not with the
    // PR head alone. On manual runs no reliable event base may be available.
    const eventBase = process.env.CHANGE_BASE;
    const changePaths = /^[a-f0-9]{40}$/.test(eventBase ?? "")
      ? changedPaths(eventBase)
      : undefined;
    const plan = planUpdate({
      tag, target, paths, changePaths, info: JSON.parse(readFileSync(metadata, "utf8")),
      otaUrl: process.env.CREW_OTA_URL?.trim().replace(/\/+$/, ""), serverUrl: process.env.CREW_SERVER_URL,
      publicServers: process.env.CREW_PUBLIC_SERVERS,
    });
    const requirements = newNativeRequirements(baseline);
    if (requirements.length) {
      throw new IncompatibleUpdate(`Native imports absent from the IPA baseline: ${requirements.join(", ")}`);
    }
    for (const [key, value] of Object.entries(plan)) console.log(`${key}=${value}`);
  } catch (error) {
    // The build workflow shows this reason on the PR (tools/ci/report-route.mjs).
    console.error(error.message);
    process.exit(error instanceof IncompatibleUpdate ? 2 : 1);
  }
}
