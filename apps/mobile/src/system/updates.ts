import { Linking, Platform } from "react-native";
import { useAppStore } from "@/state/store";
import { extraNumber, extraString } from "./extra";

const DAY_MS = 86_400_000;

const extra = {
  buildNumber: extraNumber("buildNumber"),
  appVersion: extraString("appVersion"),
  releasesApi: extraString("releasesApi"),
  /** Set on APKs built by a crew's own server (deploy/android): updates come from there, not GitHub. */
  updateServer: extraString("updateServer"),
};

/** The build running now, as numbered by CI; 0 for a local or web build, which never asks. */
export const currentBuild = typeof extra.buildNumber === "number" ? extra.buildNumber : 0;

/** "0.1.3" for a release built by CI (docs/VERSIONING.md); the series from app.json elsewhere. */
export const currentVersion = extra.appVersion ?? "dev";

/** "v0.1.3+build.71" -> "0.1.3"; tags from before version names give null. */
export function versionOfTag(tag: string): string | null {
  return /^v(\d+\.\d+\.\d+)\+/.exec(tag)?.[1] ?? null;
}

/**
 * O-12: once a day, if allowed, ask GitHub for the latest release. Only the request itself leaves
 * the phone: nothing about the user is sent.
 */
export type UpdateCheck = "newer" | "latest" | "skipped" | "unavailable";

/** At launch: unless just done (a relaunch a minute later asks nothing). */
export const AT_LAUNCH_MS = 10 * 60_000;
/** Back to the app from the background: a few times a day at most. */
export const ON_RETURN_MS = 6 * 60 * 60_000;

/**
 * `minGapMs` skips the request when the last answer is fresher than that; a manual check passes 0.
 * Automatic checks also respect the setting.
 */
export async function checkForUpdate(force = false, minGapMs = DAY_MS): Promise<UpdateCheck> {
  const state = useAppStore.getState();
  // A local or web build has no release to compare with.
  if (Platform.OS === "web" || !extra.releasesApi || currentBuild <= 1) return "unavailable";
  if (!force && (!state.checkUpdates || (state.updateCheckedAt !== null && Date.now() - state.updateCheckedAt < minGapMs))) return "skipped";
  if (extra.updateServer && Platform.OS === "android") {
    const res = await fetch(`${extra.updateServer}/download/android.json`);
    if (!res.ok) return "unavailable";
    const info = (await res.json()) as { build?: number; version?: string };
    const build = Number(info.build ?? 0);
    const url = `${extra.updateServer}/download/soiree-crew.apk`;
    const version = typeof info.version === "string" ? info.version : null;
    const newer = build > currentBuild && url.startsWith("https://");
    useAppStore.setState({ updateCheckedAt: Date.now(), latestRelease: newer ? { build, version, url } : null });
    return newer ? "newer" : "latest";
  }
  const res = await fetch(extra.releasesApi, { headers: { accept: "application/vnd.github+json" } });
  if (!res.ok) return "unavailable";
  const release = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
  const build = Number(/build\.(\d+)/.exec(release.tag_name ?? "")?.[1] ?? 0);
  const asset = release.assets?.find((a) => (Platform.OS === "android" ? a.name.endsWith(".apk") : a.name.endsWith(".ipa")));
  const url = asset?.browser_download_url ?? release.html_url ?? "";
  const version = versionOfTag(release.tag_name ?? "");
  const newer = build > currentBuild && url.startsWith("https://");
  useAppStore.setState({ updateCheckedAt: Date.now(), latestRelease: newer ? { build, version, url } : null });
  return newer ? "newer" : "latest";
}

/** The AltStore source of the releases, when the build knows one (docs/ALTSTORE.md). */
export const altstoreSource = extraString("altstoreSource");

/**
 * iOS: hands the update to AltStore (or SideStore), which re-signs and installs it in place. Adds
 * the source the first time; false when neither app is installed.
 */
export async function openInAltStore(): Promise<boolean> {
  if (Platform.OS !== "ios" || !altstoreSource) return false;
  for (const scheme of ["altstore", "sidestore"]) {
    const url = `${scheme}://source?url=${encodeURIComponent(altstoreSource)}`;
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Not installed: try the next one.
    }
  }
  return false;
}

/**
 * O-12, at launch and on return: checks on its own and, the first time a version is seen, says so
 * with a toast that installs it. The banner in Me and Settings stays until it is installed.
 */
export async function checkAndAnnounce(minGapMs: number, announce: (version: string) => void): Promise<void> {
  const result = await checkForUpdate(false, minGapMs);
  const { latestRelease, updateAnnounced } = useAppStore.getState();
  if (result !== "newer" || !latestRelease || updateAnnounced === latestRelease.build) return;
  useAppStore.setState({ updateAnnounced: latestRelease.build });
  announce(latestRelease.version ?? String(latestRelease.build));
}

/** Installs the newer release: through AltStore or SideStore on iOS when present, else the file itself. */
export async function installLatest(): Promise<void> {
  const latest = useAppStore.getState().latestRelease;
  if (!latest) return;
  if (await openInAltStore()) return;
  await Linking.openURL(latest.url).catch(() => undefined);
}
