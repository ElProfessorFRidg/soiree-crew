// The AltStore / SideStore source of the releases (docs/ALTSTORE.md). The release job runs it after
// publishing a version: it adds that version on top of the source kept on the `altstore` branch,
// with its notes, size, date and download link, refreshes the screenshots and the permissions, and
// keeps the last versions so a person can go back to one.
//
//   node tools/ci/altstore-source.mjs <source.json> <ipa> <notes.md> <version> <build> <tag> <screens dir>
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OWNER_REPO = "ElProfessorFRidg/soiree-crew";
const RAW = `https://raw.githubusercontent.com/${OWNER_REPO}/altstore`;
const KEEP_VERSIONS = 40;
const KEEP_NEWS = 10;
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

/**
 * Releases already on GitHub that the source lacks (the ones before it existed): added from the
 * releases API answer, with their own notes, date, size and download link.
 */
export function backfill(source, appJson, releases) {
  let next = source;
  const known = new Set(next?.apps?.[0]?.versions?.map((v) => v.version) ?? []);
  const named = releases
    .map((r) => ({ release: r, match: /^v(\d+\.\d+\.\d+)\+build\.(\d+)$/.exec(r.tag_name ?? "") }))
    .filter(({ release, match }) => match && !release.draft && !release.prerelease)
    .sort((a, b) => Number(a.match[2]) - Number(b.match[2]));
  for (const { release, match } of named) {
    const ipa = release.assets?.find((a) => a.name === "soiree-crew-unsigned.ipa");
    if (!ipa || known.has(match[1])) continue;
    next = addRelease(next, appJson, {
      version: match[1],
      build: Number(match[2]),
      tag: release.tag_name,
      date: release.published_at ?? release.created_at,
      notes: (release.body ?? "").trim(),
      size: ipa.size,
      screenshots: next?.apps?.[0]?.screenshots?.map((url) => url.split("/").pop()) ?? [],
    });
    known.add(match[1]);
  }
  return next;
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
      screenshots: index === 0 ? app.screenshots : [],
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
    screenshots: release.screenshots.map((name) => `${RAW}/screens/${name}`),
    appPermissions: { entitlements: [], privacy: privacyFrom(appJson) },
    versions: [],
  };
  const previous = source?.apps?.find((a) => a.bundleIdentifier === app.bundleIdentifier);
  const version = {
    version: release.version,
    buildVersion: String(release.build),
    date: release.date,
    localizedDescription: release.notes,
    downloadURL: `https://github.com/${OWNER_REPO}/releases/download/${encodeURIComponent(release.tag)}/soiree-crew-unsigned.ipa`,
    size: release.size,
    minOSVersion: MIN_IOS,
  };
  app.versions = sortVersions([version, ...(previous?.versions ?? []).filter((v) => v.version !== release.version)]).slice(0, KEEP_VERSIONS);
  withLegacyFields(app);
  const news = [
    {
      identifier: `release-${release.version}`,
      title: `Soirée Crew ${release.version}`,
      caption: release.notes.split("\n").find((line) => line.trim()) ?? "",
      date: release.date,
      tintColor: TINT,
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
    website: `https://github.com/${OWNER_REPO}`,
    tintColor: TINT,
    featuredApps: [app.bundleIdentifier],
    apps: [app],
    news,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [sourcePath, ipa, notesPath, version, build, tag, screensDir, releasesPath] = process.argv.slice(2);
  const appJson = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  let source = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, "utf8")) : null;
  // Versions published before the source existed, or missing from it, come back from GitHub.
  if (releasesPath && existsSync(releasesPath)) source = backfill(source, appJson, JSON.parse(readFileSync(releasesPath, "utf8")));
  const screenshots = existsSync(screensDir) ? readdirSync(screensDir).filter((f) => f.endsWith(".png")).sort().map((f) => basename(f)) : [];
  const next = addRelease(source, appJson, {
    version,
    build: Number(build),
    tag,
    date: new Date().toISOString(),
    notes: readFileSync(notesPath, "utf8").trim(),
    size: statSync(ipa).size,
    screenshots,
  });
  writeFileSync(sourcePath, `${JSON.stringify(next, null, 2)}\n`);
  writeFileSync(sourcePath.replace(/source\.json$/, "scarlet.json"), `${JSON.stringify(scarletOf(next), null, 2)}\n`);
  console.log(`AltStore source: ${version} (build ${build}), ${next.apps[0].versions.length} versions, ${screenshots.length} screenshots`);
}
