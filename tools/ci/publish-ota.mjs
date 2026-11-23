// Publishes an `expo export` to the self-hosted Expo Updates server (deploy/ota/server.mjs).
// The manifest is built and signed here, so the server never sees the code signing key.
import { createHash, createSign, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const MIME = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif",
  svg: "image/svg+xml", ttf: "font/ttf", otf: "font/otf", mp3: "audio/mpeg", wav: "audio/wav", mp4: "video/mp4",
  json: "application/json",
};

export function assetEntry(data, ext, baseUrl, launch = false) {
  const sha = createHash("sha256").update(data);
  const hex = sha.copy().digest("hex");
  return {
    hash: sha.digest("base64url"),
    key: createHash("md5").update(data).digest("hex"),
    fileExtension: launch ? ".bundle" : `.${ext}`,
    contentType: launch ? "application/javascript" : MIME[ext.toLowerCase()] ?? "application/octet-stream",
    url: `${baseUrl}/assets/${hex}`,
    hex,
  };
}

// Expo Updates protocol 1 manifest for one platform of an export (dist/metadata.json).
export function buildManifest({ metadata, read, platform, runtimeVersion, expoConfig, baseUrl, id = randomUUID(), createdAt = new Date().toISOString() }) {
  const files = metadata.fileMetadata?.[platform];
  if (!files?.bundle) throw new Error(`The export has no ${platform} bundle`);
  const launch = assetEntry(read(files.bundle), "bundle", baseUrl, true);
  const assets = (files.assets ?? []).map((a) => assetEntry(read(a.path), a.ext, baseUrl));
  const strip = ({ hex, ...entry }) => entry;
  return {
    manifest: { id, createdAt, runtimeVersion, launchAsset: strip(launch), assets: assets.map(strip), metadata: {}, extra: { expoClient: expoConfig } },
    uploads: [{ hex: launch.hex, path: files.bundle }, ...assets.map((a, i) => ({ hex: a.hex, path: files.assets[i].path }))],
  };
}

// expo-signature header value: a structured-field dictionary, as expo-updates expects it.
export function sign(body, privateKey) {
  const sig = createSign("RSA-SHA256").update(body, "utf8").sign(privateKey, "base64");
  return `sig="${sig}", keyid="main"`;
}

async function call(method, url, token, payload, type = "application/json") {
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${token}`, "content-type": type }, body: payload });
  if (!response.ok) throw new Error(`${method} ${url}: ${response.status} ${await response.text()}`);
  return response;
}

async function main() {
  const env = (name) => {
    const value = process.env[name]?.trim();
    if (!value) throw new Error(`${name} is required`);
    return value;
  };
  const baseUrl = env("CREW_OTA_URL").replace(/\/+$/, "");
  const token = env("OTA_PUBLISH_TOKEN");
  const key = env("OTA_SIGNING_KEY");
  const channel = env("OTA_STREAM");
  const runtimeVersion = env("OTA_RUNTIME");
  const platform = process.env.OTA_PLATFORM ?? "ios";
  const common = { platform, channel, runtimeVersion, message: process.env.OTA_MESSAGE ?? "", commit: process.env.GITHUB_SHA ?? "" };

  if (process.env.OTA_ROLLBACK === "true") {
    const body = JSON.stringify({ type: "rollBackToEmbedded", parameters: { commitTime: new Date().toISOString() } });
    await call("POST", `${baseUrl}/publish`, token, JSON.stringify({ ...common, kind: "directive", body, signature: sign(body, key) }));
    console.log(`Rolled ${channel} (${runtimeVersion}) back to the embedded bundle`);
    return;
  }

  const dist = process.env.OTA_DIST ?? "dist";
  const read = (path) => readFileSync(join(dist, path));
  const metadata = JSON.parse(read("metadata.json"));
  const expoConfig = JSON.parse(read("expoConfig.json"));
  const { manifest, uploads } = buildManifest({ metadata, read, platform, runtimeVersion, expoConfig, baseUrl });

  // Ask once which files the server lacks: a HEAD per file means a burst of 404s that CrowdSec bans.
  const asked = await call("POST", `${baseUrl}/assets/missing`, token, JSON.stringify({ hashes: uploads.map((u) => u.hex) }));
  const missing = new Set((await asked.json()).missing);
  // Batches of up to 24 MB: a handful of requests rather than one per file.
  let batch = [];
  let size = 0;
  const flush = async () => {
    if (!batch.length) return;
    await call("POST", `${baseUrl}/assets/batch`, token, JSON.stringify({ files: batch }));
    batch = [];
    size = 0;
  };
  for (const { hex, path } of uploads.filter((u) => missing.has(u.hex))) {
    const data = read(path);
    if (size + data.length > 24 * 1024 * 1024) await flush();
    batch.push({ hex, data: data.toString("base64") });
    size += data.length;
  }
  await flush();
  const body = JSON.stringify(manifest);
  await call("POST", `${baseUrl}/publish`, token, JSON.stringify({ ...common, kind: "manifest", body, signature: sign(body, key), assets: uploads.map((u) => u.hex) }));
  console.log(`Published update ${manifest.id} to ${channel} (${runtimeVersion}), ${uploads.length} files`);
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import("node:fs");
    appendFileSync(process.env.GITHUB_OUTPUT, `update_id=${manifest.id}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
