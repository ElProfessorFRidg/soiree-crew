import { Platform } from "react-native";
import { useAppStore } from "@/state/store";
import { extraNumber, extraString } from "./extra";

const DAY_MS = 86_400_000;

const extra = {
  buildNumber: extraNumber("buildNumber"),
  releasesApi: extraString("releasesApi"),
  /** Set on APKs built by a crew's own server (deploy/android): updates come from there, not GitHub. */
  updateServer: extraString("updateServer"),
};

/** The build running now, as numbered by CI; 0 for a local or web build, which never asks. */
export const currentBuild = typeof extra.buildNumber === "number" ? extra.buildNumber : 0;

/**
 * O-12: once a day, if allowed, ask GitHub for the latest release. Only the request itself leaves
 * the phone: nothing about the user is sent.
 */
export async function checkForUpdate(force = false): Promise<void> {
  const state = useAppStore.getState();
  if (Platform.OS === "web" || !extra.releasesApi || currentBuild <= 1) return;
  if (!force && (!state.checkUpdates || (state.updateCheckedAt !== null && Date.now() - state.updateCheckedAt < DAY_MS))) return;
  if (extra.updateServer && Platform.OS === "android") {
    const res = await fetch(`${extra.updateServer}/download/android.json`);
    if (!res.ok) return;
    const info = (await res.json()) as { build?: number };
    const build = Number(info.build ?? 0);
    const url = `${extra.updateServer}/download/soiree-crew.apk`;
    useAppStore.setState({ updateCheckedAt: Date.now(), latestRelease: build > currentBuild && url.startsWith("https://") ? { build, url } : null });
    return;
  }
  const res = await fetch(extra.releasesApi, { headers: { accept: "application/vnd.github+json" } });
  if (!res.ok) return;
  const release = (await res.json()) as { tag_name?: string; html_url?: string; assets?: { name: string; browser_download_url: string }[] };
  const build = Number(/build\.(\d+)/.exec(release.tag_name ?? "")?.[1] ?? 0);
  const asset = release.assets?.find((a) => (Platform.OS === "android" ? a.name.endsWith(".apk") : a.name.endsWith(".ipa")));
  const url = asset?.browser_download_url ?? release.html_url ?? "";
  useAppStore.setState({ updateCheckedAt: Date.now(), latestRelease: build > currentBuild && url.startsWith("https://") ? { build, url } : null });
}
