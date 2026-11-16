export type ReleaseChannel = "public" | "preview";
export interface DownloadVersion { version: string; build: number; url: string; notes: string; date: string; size: number; minOS: string }
export interface ChangelogEntry { version: string; build: number; notes: string; date: string }
const REPOSITORY = "https://github.com/ElProfessorFRidg/soiree-crew/releases/download/";
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
const download = (value: unknown): value is string => typeof value === "string" && value.startsWith(REPOSITORY) && !value.includes("/latest/");

export function allowsDowngrades(raw: unknown, enabled: boolean): boolean {
  return enabled && record(raw).allowDowngrades !== false;
}

/** Notes have no dependency on IPA URLs or the availability of older installers. */
export function changelogFromSource(raw: unknown, channel: ReleaseChannel): ChangelogEntry[] {
  const source = record(raw);
  const bundle = `app.soireecrew.mobile${channel === "preview" ? ".preview" : ""}`;
  const app = record((Array.isArray(source.apps) ? source.apps : []).find((a) => record(a).bundleIdentifier === bundle));
  const rows = Array.isArray(source.changelog)
    ? source.changelog.filter((v) => record(v).bundleIdentifier === bundle)
    : Array.isArray(app.versions) ? app.versions : [];
  return rows.flatMap((value) => {
    const v = record(value);
    const build = Number(v.buildVersion);
    if (typeof v.version !== "string" || !Number.isSafeInteger(build) || build < 1) return [];
    return [{ version: v.version, build, notes: typeof v.localizedDescription === "string" ? v.localizedDescription : "", date: typeof v.date === "string" ? v.date : "" }];
  });
}

export function versionsFromSource(raw: unknown, channel: ReleaseChannel): DownloadVersion[] {
  const source = record(raw);
  const apps = Array.isArray(source.apps) ? source.apps : [];
  const app = record(apps.find((a) => record(a).bundleIdentifier === `app.soireecrew.mobile${channel === "preview" ? ".preview" : ""}`));
  return (Array.isArray(app.versions) ? app.versions : []).flatMap((value) => {
    const v = record(value);
    const build = Number(v.buildVersion);
    if (typeof v.version !== "string" || !/^\d+\.\d+\.\d+$/.test(v.version) || !Number.isSafeInteger(build) || build < 1 || !download(v.downloadURL)) return [];
    return [{ version: v.version, build, url: v.downloadURL, notes: typeof v.localizedDescription === "string" ? v.localizedDescription : "", date: typeof v.date === "string" ? v.date : "", size: typeof v.size === "number" ? v.size : 0, minOS: typeof v.minOSVersion === "string" ? v.minOSVersion : "" }];
  });
}

/** A preview update must never replace the public app; each device takes its own native IPA. */
export function updateFromReleases(raw: unknown, channel: ReleaseChannel, target: "iphone" | "ipad" | "android"): { build: number; version: string; url: string } | null {
  const releases = Array.isArray(raw) ? raw : [raw];
  const file = target === "android" ? "soiree-crew.apk" : target === "ipad" ? "soiree-crew-ipad-unsigned.ipa" : "soiree-crew-unsigned.ipa";
  return releases.flatMap((value) => {
    const r = record(value);
    const match = /^v(\d+\.\d+\.\d+)(-preview\.\d+)?(?:\+build\.|-build\.)(\d+)$/.exec(typeof r.tag_name === "string" ? r.tag_name : "");
    if (!match || r.draft || (match[2] ? "preview" : "public") !== channel || Boolean(r.prerelease) !== (channel === "preview")) return [];
    const asset = record((Array.isArray(r.assets) ? r.assets : []).find((a) => record(a).name === file));
    return download(asset.browser_download_url) ? [{ build: Number(match[3]), version: match[1]!, url: asset.browser_download_url }] : [];
  }).sort((a, b) => b.build - a.build)[0] ?? null;
}
