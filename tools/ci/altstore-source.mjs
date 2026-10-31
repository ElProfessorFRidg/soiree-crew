// The AltStore / SideStore / Feather / KSign / ESign source and the Scarlet one (docs/ALTSTORE.md),
// rebuilt from the releases published on GitHub: every version with its notes for people
// (apps/mobile/store/release-notes.json), size, date, own download link, its own screenshots and card
// kept on the `altstore` branch (tools/ci/altstore-images.py), and the permissions read from the app
// config.
//
//   node tools/ci/altstore-source.mjs <altstore branch folder> <releases.json>
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER_REPO = "ElProfessorFRidg/soiree-crew";
const RAW = `https://raw.githubusercontent.com/${OWNER_REPO}/altstore`;
const KEEP_VERSIONS = 40;
const KEEP_NEWS = 20;
/** The screens that show the app best, in this order; the others (settings, an empty crew) stay out. */
export const SHOWCASE = ["party", "add-drink", "curve", "games", "my-stats", "history", "leaderboard", "bars", "me", "limits"];
/** Expo SDK 58 builds for iOS 16.4 and later (ExpoModulesCore.podspec). */
const MIN_IOS = "16.4";
const TINT = "F4B33D";

/** The privacy strings iOS shows, taken from the app config so the source never drifts from them. */
export function privacyFrom(appJson) {
  const plugins = appJson.expo.plugins ?? [];
  const option = (name, key) => {
    const entry = plugins.find((p) => Array.isArray(p) && p[0] === name);
    const value = entry?.[1]?.[key];
    return typeof value === "string" ? value : null;
  };
  const privacy = {
    NSLocationWhenInUseUsageDescription: option("expo-location", "locationWhenInUsePermission"),
    NSPhotoLibraryUsageDescription: option("expo-image-picker", "photosPermission"),
    NSCameraUsageDescription: option("expo-image-picker", "cameraPermission"),
    NSMicrophoneUsageDescription: option("expo-audio", "microphonePermission"),
    NSCalendarsUsageDescription: option("expo-calendar", "calendarPermission"),
  };
  return Object.fromEntries(Object.entries(privacy).filter(([, v]) => v));
}

/** A version's screenshot files ("01-party.png"…) in showcase order, the ones not shown left out. */
export function showcase(files) {
  const byName = new Map(files.filter((f) => f.endsWith(".png")).map((f) => [f.slice(0, -4).replace(/^\d+-/, ""), f]));
  return SHOWCASE.filter((name) => byName.has(name)).map((name) => byName.get(name));
}

/** Newest first by version number (0.1.10 after 0.1.9), whatever order the releases came in. */
function sortVersions(versions) {
  const key = (v) => v.version.split(".").map(Number);
  return [...versions].sort((a, b) => {
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < 3; i++) if ((y[i] ?? 0) !== (x[i] ?? 0)) return (y[i] ?? 0) - (x[i] ?? 0);
    return Number(b.buildVersion) - Number(a.buildVersion);
  });
}

/**
 * The fields of the first AltStore format, on the app itself: older AltStore builds, ESign, Feather
 * and other sideloading apps read the latest version there instead of in `versions`.
 */
function withLegacyFields(app) {
  const latest = app.versions[0];
  if (!latest) return app;
  Object.assign(app, {
    version: latest.version,
    versionDate: latest.date,
    versionDescription: latest.localizedDescription,
    downloadURL: latest.downloadURL,
    size: latest.size,
    screenshotURLs: app.screenshots,
  });
  return app;
}

/** The same releases in the Scarlet repo format, for apps that read that one instead. */
export function scarletOf(source) {
  const app = source.apps[0];
  return {
    META: { repoName: source.name, repoIcon: source.iconURL },
    Other: app.versions.map((v, index) => ({
      name: index === 0 ? app.name : `${app.name} ${v.version}`,
      version: v.version,
      icon: app.iconURL,
      down: v.downloadURL,
      category: "Other",
      description: v.localizedDescription,
      bundleID: app.bundleIdentifier,
      screenshots: v.screenshots ?? (index === 0 ? app.screenshots : []),
    })),
  };
}

/** Adds this release to the source (replacing a same version), newest first, the oldest dropped. */
export function addRelease(source, appJson, release) {
  const app = {
    name: "Soirée Crew",
    bundleIdentifier: appJson.expo.ios.bundleIdentifier,
    developerName: "Soirée Crew",
    subtitle: "Ta soirée, ton crew, ton taux.",
    localizedDescription:
      "Note tes verres et vois ton taux estimé, sa courbe et l'heure du retour à zéro. Sors avec ton crew : soirées, bars, jeux, chat, cagnottes et récap du lendemain. Estimation, pas un éthylotest : ne prends jamais le volant sur cette base.",
    iconURL: `${RAW}/icon.png`,
    tintColor: TINT,
    category: "lifestyle",
    screenshots: [],
    appPermissions: { entitlements: [], privacy: privacyFrom(appJson) },
    versions: [],
  };
  const previous = source?.apps?.find((a) => a.bundleIdentifier === app.bundleIdentifier);
  const own = showcase(release.screenshots ?? []).map((name) => `${RAW}/screens/${release.version}/${name}`);
  // A version whose screenshots are gone (its build's artifact expired) keeps showing the last ones.
  app.screenshots = own.length > 0 ? own : (previous?.screenshots ?? []);
  const version = {
    version: release.version,
    buildVersion: String(release.build),
    date: release.date,
    localizedDescription: release.notes,
    downloadURL: `https://github.com/${OWNER_REPO}/releases/download/${encodeURIComponent(release.tag)}/soiree-crew-unsigned.ipa`,
    size: release.size,
    minOSVersion: MIN_IOS,
    // Not in the AltStore format (readers skip it): what the Scarlet source shows for this version.
    ...(own.length > 0 ? { screenshots: own } : {}),
  };
  app.versions = sortVersions([version, ...(previous?.versions ?? []).filter((v) => v.version !== release.version)]).slice(0, KEEP_VERSIONS);
  withLegacyFields(app);
  // The cards at the top of the source: the version's own picture, everything it brings, and its
  // release page behind "Open".
  const image = release.banner ? `${RAW}/screens/${release.version}/banner.png` : release.header ? `${RAW}/header.png` : null;
  const news = [
    {
      identifier: `release-${release.version}`,
      title: `Soirée Crew ${release.version}`,
      caption: release.notes,
      date: release.date,
      tintColor: TINT,
      ...(image ? { imageURL: image } : {}),
      url: `https://github.com/${OWNER_REPO}/releases/tag/${encodeURIComponent(release.tag)}`,
      appID: app.bundleIdentifier,
      notify: false,
    },
    ...(source?.news ?? []).filter((n) => n.identifier !== `release-${release.version}`),
  ].slice(0, KEEP_NEWS);
  return {
    name: "Soirée Crew",
    identifier: "app.soireecrew.source",
    subtitle: "Les versions de Soirée Crew",
    description: "Chaque version publiée de Soirée Crew, installable et mise à jour depuis AltStore ou SideStore.",
    iconURL: `${RAW}/icon.png`,
    ...(release.header ? { headerURL: `${RAW}/header.png` } : {}),
    website: `https://github.com/${OWNER_REPO}`,
    tintColor: TINT,
    featuredApps: [app.bundleIdentifier],
    apps: [app],
    news,
  };
}

/**
 * What a version brings, for people: the lines written for it in release-notes.json, or failing
 * that the release's own list of changes, without the build line, the install lines meant for
 * GitHub and the commit prefixes.
 */
export function notesOf(body, written) {
  const lines = written?.length
    ? written
    : (body ?? "")
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("- ") && !/^- (iOS|Android|AltStore)/.test(line))
        .map((line) => line.slice(2).replace(/^[a-z]+(\([^)]*\))?!?:\s*/, ""))
        .map((line) => line.charAt(0).toUpperCase() + line.slice(1));
  return lines.map((line) => `• ${line}`).join("\n");
}

/**
 * The whole source from the releases published on GitHub, the only record that counts: every
 * version, newest first. `media` is what the branch holds: `{ versions: { "0.1.5": { screenshots,
 * banner } }, header }`; `notes` is release-notes.json.
 */
export function fromReleases(appJson, releases, media = {}, notes = {}) {
  let source = null;
  const named = releases
    .map((r) => ({ release: r, match: /^v(\d+\.\d+\.\d+)\+build\.(\d+)$/.exec(r.tag_name ?? "") }))
    .filter(({ release, match }) => match && !release.draft && !release.prerelease)
    .sort((a, b) => Number(a.match[2]) - Number(b.match[2]));
  for (const { release, match } of named) {
    const ipa = release.assets?.find((a) => a.name === "soiree-crew-unsigned.ipa");
    if (!ipa) continue;
    source = addRelease(source, appJson, {
      version: match[1],
      build: Number(match[2]),
      tag: release.tag_name,
      date: release.published_at ?? release.created_at,
      notes: notesOf(release.body, notes[match[1]]?.fr),
      size: ipa.size,
      screenshots: media.versions?.[match[1]]?.screenshots ?? [],
      banner: !!media.versions?.[match[1]]?.banner,
      header: !!media.header,
    });
  }
  return source;
}

// node tools/ci/altstore-source.mjs <altstore branch folder> <releases.json from the GitHub API>
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [dir, releasesPath] = process.argv.slice(2);
  const appJson = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  const notes = JSON.parse(readFileSync(new URL("../../apps/mobile/store/release-notes.json", import.meta.url), "utf8"));
  const screensDir = join(dir, "screens");
  const versions = {};
  for (const version of existsSync(screensDir) ? readdirSync(screensDir) : []) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
    const files = readdirSync(join(screensDir, version));
    versions[version] = { screenshots: files.filter((f) => f !== "banner.png"), banner: files.includes("banner.png") };
  }
  const media = { versions, header: existsSync(join(dir, "header.png")) };
  const source = fromReleases(appJson, JSON.parse(readFileSync(releasesPath, "utf8")), media, notes);
  if (!source) {
    console.log("No release with an IPA yet: nothing to publish.");
    process.exit(0);
  }
  writeFileSync(join(dir, "source.json"), `${JSON.stringify(source, null, 2)}\n`);
  writeFileSync(join(dir, "scarlet.json"), `${JSON.stringify(scarletOf(source), null, 2)}\n`);
  const latest = source.apps[0].versions[0];
  const shown = Object.keys(versions).filter((v) => versions[v].banner);
  console.log(`AltStore source: ${latest.version} (build ${latest.buildVersion}) first, ${source.apps[0].versions.length} versions, cards for ${shown.join(", ") || "none"}`);
}
