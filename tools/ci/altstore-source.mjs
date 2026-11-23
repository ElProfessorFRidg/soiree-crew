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
    screenshotURLs: app.screenshots.map((s) => typeof s === "string" ? s : s.imageURL),
  });
  return app;
}

/** The same releases in the Scarlet repo format, for apps that read that one instead. */
export function scarletOf(source) {
  return {
    META: { repoName: source.name, repoIcon: source.iconURL },
    Other: source.apps.flatMap((app) => app.versions.map((v, index) => ({
      name: index === 0 ? app.name : `${app.name} ${v.version}`,
      version: v.version,
      icon: app.iconURL,
      down: v.downloadURL,
      category: "Other",
      description: v.localizedDescription,
      bundleID: app.bundleIdentifier,
      screenshots: (v.screenshots ?? (index === 0 ? app.screenshots : [])).map((s) => typeof s === "string" ? s : s.imageURL),
    }))),
  };
}

/** Adds or replaces one exact version/build in its channel, retaining all published builds. */
export function addRelease(source, appJson, release) {
  const preview = release.channel === "preview";
  const target = release.target ?? "iphone";
  const app = {
    name: preview ? "Soirée Crew Preview" : "Soirée Crew",
    bundleIdentifier: appJson.expo.ios.bundleIdentifier + (preview ? ".preview" : ""),
    developerName: "Soirée Crew",
    subtitle: preview ? "Les nouveautés en cours de test." : "Ta soirée, ton crew, ton taux.",
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
  const mediaPath = release.mediaPath ?? release.version;
  const own = showcase(release.screenshots ?? []).flatMap((name) => {
    const imageURL = `${RAW}/screens/${mediaPath}/${name}`;
    if (target !== "ipad") return [imageURL];
    const size = release.dimensions?.[name];
    // AltStore requires explicit dimensions for iPad screenshots.
    return size ? [{ imageURL, width: size.width, height: size.height }] : [];
  });
  // A version whose screenshots are gone (its build's artifact expired) keeps showing the last ones.
  app.screenshots = own.length > 0 ? own : (previous?.screenshots ?? []);
  const version = {
    version: release.version,
    buildVersion: String(release.build),
    marketingVersion: `${release.version}${preview ? " Preview" : ""} (${release.build})`,
    date: release.date,
    localizedDescription: release.notes,
    downloadURL: release.downloadURL ?? `https://github.com/${OWNER_REPO}/releases/download/${encodeURIComponent(release.tag)}/${target === "ipad" ? "soiree-crew-ipad-unsigned.ipa" : "soiree-crew-unsigned.ipa"}`,
    size: release.size,
    minOSVersion: MIN_IOS,
    // Not in the AltStore format (readers skip it): what the Scarlet source shows for this version.
    ...(own.length > 0 ? { screenshots: own } : {}),
  };
  app.versions = sortVersions([version, ...(previous?.versions ?? []).filter((v) => v.version !== release.version || v.buildVersion !== String(release.build))]);
  withLegacyFields(app);
  // The cards at the top of the source: the version's own picture, everything it brings, and its
  // release page behind "Open".
  const image = release.banner ? `${RAW}/screens/${mediaPath}/banner.png` : release.header ? `${RAW}/header.png` : null;
  const newsId = `${preview ? "preview" : "release"}-${release.version}-${release.build}`;
  const news = [
    {
      identifier: newsId,
      title: `${app.name} ${release.version} (${release.build})`,
      caption: release.notes,
      date: release.date,
      tintColor: TINT,
      ...(image ? { imageURL: image } : {}),
      // Readers that only expose News can still install the exact older build.
      url: version.downloadURL,
      appID: app.bundleIdentifier,
      notify: false,
    },
    ...(source?.news ?? []).filter((n) => n.identifier !== newsId),
  ].slice(0, KEEP_NEWS);
  const apps = [app, ...(source?.apps ?? []).filter((a) => a.bundleIdentifier !== app.bundleIdentifier)].sort((a, b) => Number(a.bundleIdentifier.endsWith(".preview")) - Number(b.bundleIdentifier.endsWith(".preview")));
  return {
    name: target === "ipad" ? "Soirée Crew · iPad" : "Soirée Crew",
    identifier: `app.soireecrew.source${target === "ipad" ? ".ipad" : ""}`,
    subtitle: "Version publique et Preview",
    description: "Version publique et Preview, leurs IPA et leurs changelogs disponibles directement dans cette source.",
    iconURL: `${RAW}/icon.png`,
    ...(release.header ? { headerURL: `${RAW}/header.png` } : {}),
    website: `https://github.com/${OWNER_REPO}`,
    tintColor: TINT,
    featuredApps: apps.map((a) => a.bundleIdentifier),
    apps,
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
        .filter((line) => line.startsWith("- ") && !/^- (iOS|iPad|Android|AltStore)/.test(line))
        .map((line) => line.slice(2).replace(/^[a-z]+(\([^)]*\))?!?:\s*/, ""))
        .map((line) => line.charAt(0).toUpperCase() + line.slice(1));
  return lines.map((line) => `• ${line}`).join("\n");
}

/**
 * The whole source from the releases published on GitHub, the only record that counts: every
 * build, newest first within each channel. Media may use legacy version directories or
 * immutable tag/device directories; `notes` is release-notes.json.
 */
export function releaseOfTag(tag) {
  const match = /^v(\d+\.\d+\.\d+)(?:-preview\.(\d+))?\+build\.(\d+)$/.exec(tag ?? "");
  if (match) return { version: match[1], channel: match[2] ? "preview" : "public", build: Number(match[3]) };
  const old = /^v(\d+\.\d+\.\d+)-build\.(\d+)$/.exec(tag ?? "");
  return old ? { version: old[1], channel: "public", build: Number(old[2]) } : null;
}

/** One shared switch removes older install actions while retaining the complete changelog. */
export function applyDistributionPolicy(source, { allowDowngrades = true } = {}) {
  if (typeof allowDowngrades !== "boolean") throw new Error("distribution.allowDowngrades must be a boolean");
  if (!source) return null;
  const changelog = source.apps.flatMap((app) => app.versions.map((version) => ({
    bundleIdentifier: app.bundleIdentifier,
    version: version.version,
    buildVersion: version.buildVersion,
    date: version.date,
    localizedDescription: version.localizedDescription,
  })));
  const latestURLs = new Set(source.apps.map((app) => app.versions[0]?.downloadURL));
  return {
    ...source,
    allowDowngrades,
    changelog,
    apps: source.apps.map((app) => ({ ...app, versions: allowDowngrades ? app.versions : app.versions.slice(0, 1) })),
    news: source.news.map((news) => {
      if (allowDowngrades || latestURLs.has(news.url)) return news;
      const { url: _oldDownload, ...changes } = news;
      return changes;
    }),
  };
}

export function fromReleases(appJson, releases, media = {}, notes = {}, target = "iphone", policy = {}) {
  let source = null;
  const named = releases
    .map((release) => ({ release, parsed: releaseOfTag(release.tag_name) }))
    .filter(({ release, parsed }) => parsed && !release.draft && (parsed.channel === "preview" ? release.prerelease : !release.prerelease))
    .sort((a, b) => a.parsed.build - b.parsed.build);
  for (const { release, parsed } of named) {
    const file = target === "ipad" ? "soiree-crew-ipad-unsigned.ipa" : "soiree-crew-unsigned.ipa";
    const ipa = release.assets?.find((a) => a.name === file);
    if (!ipa) continue;
    const exact = media.versions?.[release.tag_name]?.[target];
    const pictures = exact ?? (target === "iphone" ? media.versions?.[parsed.version] : null);
    source = addRelease(source, appJson, {
      ...parsed,
      target,
      tag: release.tag_name,
      date: release.published_at ?? release.created_at,
      notes: notesOf(release.body, parsed.channel === "public" ? notes[parsed.version]?.fr : null),
      size: ipa.size,
      screenshots: pictures?.screenshots ?? [],
      dimensions: pictures?.dimensions,
      mediaPath: exact ? `${encodeURIComponent(release.tag_name)}/${target}` : parsed.version,
      banner: !!pictures?.banner,
      header: !!media.header,
    });
  }
  if (source) {
    const tags = new Map(named.map(({ release, parsed }) => [release.tag_name, parsed]));
    source.otaChangelog = releases.flatMap((release) => {
      const match = /^ota-(v\d+\.\d+\.\d+(?:-preview\.\d+)?\+build\.\d+)-(iphone|ipad)-(\d+\.\d+)$/.exec(release.tag_name ?? "");
      const ipa = match ? tags.get(match[1]) : null;
      if (!ipa || match[2] !== target || release.draft || !release.prerelease) return [];
      return [{
        id: release.tag_name, channel: ipa.channel, version: ipa.version, build: ipa.build,
        date: release.published_at ?? release.created_at ?? "", notes: notesOf(release.body),
      }];
    }).sort((a, b) => b.date.localeCompare(a.date));
    const otaNews = source.otaChangelog.map((update) => ({
      identifier: update.id,
      title: `Soirée Crew${update.channel === "preview" ? " Preview" : ""} ${update.version} · OTA`,
      caption: update.notes,
      date: update.date,
      appID: appJson.expo.ios.bundleIdentifier + (update.channel === "preview" ? ".preview" : ""),
      tintColor: TINT,
      notify: false,
    }));
    source.news = [...source.news, ...otaNews].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).slice(0, KEEP_NEWS);
  }
  return applyDistributionPolicy(source, policy);
}

// node tools/ci/altstore-source.mjs <altstore branch folder> <releases.json from the GitHub API>
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [dir, releasesPath] = process.argv.slice(2);
  const appJson = JSON.parse(readFileSync(new URL("../../apps/mobile/app.json", import.meta.url), "utf8"));
  const notes = JSON.parse(readFileSync(new URL("../../apps/mobile/store/release-notes.json", import.meta.url), "utf8"));
  const policy = JSON.parse(readFileSync(new URL("../../apps/mobile/store/distribution.json", import.meta.url), "utf8"));
  const screensDir = join(dir, "screens");
  const versions = {};
  for (const version of existsSync(screensDir) ? readdirSync(screensDir) : []) {
    if (releaseOfTag(version)) {
      versions[version] = {};
      for (const target of ["iphone", "ipad"]) {
        const folder = join(screensDir, version, target);
        if (!existsSync(folder)) continue;
        const files = readdirSync(folder);
        const screenshots = files.filter((f) => f.endsWith(".png") && f !== "banner.png");
        const dimensions = Object.fromEntries(screenshots.flatMap((name) => {
          const png = readFileSync(join(folder, name));
          return png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? [[name, { width: png.readUInt32BE(16), height: png.readUInt32BE(20) }]] : [];
        }));
        versions[version][target] = { screenshots, dimensions, banner: files.includes("banner.png") };
      }
      continue;
    }
    if (!/^\d+\.\d+\.\d+$/.test(version)) continue;
    const files = readdirSync(join(screensDir, version));
    versions[version] = { screenshots: files.filter((f) => f !== "banner.png"), banner: files.includes("banner.png") };
  }
  const media = { versions, header: existsSync(join(dir, "header.png")) };
  const source = fromReleases(appJson, JSON.parse(readFileSync(releasesPath, "utf8")), media, notes, "iphone", policy);
  if (!source) {
    console.log("No release with an IPA yet: nothing to publish.");
    process.exit(0);
  }
  writeFileSync(join(dir, "source.json"), `${JSON.stringify(source, null, 2)}\n`);
  writeFileSync(join(dir, "scarlet.json"), `${JSON.stringify(scarletOf(source), null, 2)}\n`);
  const ipad = fromReleases(appJson, JSON.parse(readFileSync(releasesPath, "utf8")), media, notes, "ipad", policy);
  if (ipad) {
    writeFileSync(join(dir, "source-ipad.json"), `${JSON.stringify(ipad, null, 2)}\n`);
    writeFileSync(join(dir, "scarlet-ipad.json"), `${JSON.stringify(scarletOf(ipad), null, 2)}\n`);
  }
  const latest = source.apps[0].versions[0];
  const shown = Object.keys(versions).filter((v) => versions[v].banner);
  console.log(`AltStore source: ${latest.version} (build ${latest.buildVersion}) first, ${source.apps[0].versions.length} versions, cards for ${shown.join(", ") || "none"}`);
}
