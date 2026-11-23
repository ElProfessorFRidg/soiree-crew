import { spawn, spawnSync } from "node:child_process";
import { createHash, createVerify, generateKeyPairSync } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, expect, it } from "vitest";
import { buildManifest, sign } from "./publish-ota.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keyPem = privateKey.export({ type: "pkcs8", format: "pem" });
const token = "test-publish-token";
const port = 39000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${port}`;
const headers = { "expo-platform": "ios", "expo-runtime-version": "crew-preview-iphone-310", "expo-channel-name": "preview-iphone", "expo-protocol-version": "1" };
let server;
let dist;

const verify = (body, signature) => {
  const sig = /^sig="([^"]+)", keyid="main"$/.exec(signature)?.[1];
  return Boolean(sig) && createVerify("RSA-SHA256").update(body, "utf8").verify(publicKey, sig, "base64");
};

// Splits a multipart/mixed answer into { name: { headers, body } }.
const parts = (text, contentType) => {
  const boundary = /boundary=(.+)$/.exec(contentType)[1];
  return Object.fromEntries(text.split(`--${boundary}`).slice(1, -1).map((chunk) => {
    const [head, ...rest] = chunk.replace(/^\r\n/, "").split("\r\n\r\n");
    const lines = head.split("\r\n");
    const name = /name="([^"]+)"/.exec(lines[0])[1];
    const partHeaders = Object.fromEntries(lines.slice(1).map((l) => [l.split(": ")[0].toLowerCase(), l.slice(l.indexOf(": ") + 2)]));
    return [name, { headers: partHeaders, body: rest.join("\r\n\r\n").replace(/\r\n$/, "") }];
  }));
};

const publish = (extra = {}) => spawnSync(process.execPath, ["tools/ci/publish-ota.mjs"], {
  encoding: "utf8",
  env: { ...process.env, CREW_OTA_URL: base, OTA_PUBLISH_TOKEN: token, OTA_SIGNING_KEY: keyPem, OTA_STREAM: "preview-iphone",
    OTA_RUNTIME: "crew-preview-iphone-310", OTA_DIST: dist, GITHUB_SHA: "a".repeat(40), GITHUB_OUTPUT: "", ...extra },
});

beforeAll(async () => {
  const data = mkdtempSync(join(tmpdir(), "crew-ota-data-"));
  dist = mkdtempSync(join(tmpdir(), "crew-ota-dist-"));
  mkdirSync(join(dist, "_expo/static/js/ios"), { recursive: true });
  mkdirSync(join(dist, "assets"));
  writeFileSync(join(dist, "_expo/static/js/ios/entry-1.hbc"), "bundle-bytes");
  writeFileSync(join(dist, "assets/abc"), "png-bytes");
  writeFileSync(join(dist, "metadata.json"), JSON.stringify({ version: 0, bundler: "metro", fileMetadata: { ios: { bundle: "_expo/static/js/ios/entry-1.hbc", assets: [{ path: "assets/abc", ext: "png" }] } } }));
  writeFileSync(join(dist, "expoConfig.json"), JSON.stringify({ name: "Soirée Crew Preview", runtimeVersion: "crew-preview-iphone-310" }));
  server = spawn(process.execPath, ["deploy/ota/server.mjs"], {
    env: { ...process.env, PORT: String(port), OTA_DATA: data, OTA_PUBLISH_TOKEN_SHA256: createHash("sha256").update(token).digest("hex") },
    stdio: ["ignore", "pipe", "inherit"],
  });
  await new Promise((resolve) => server.stdout.once("data", resolve));
});

afterAll(() => server?.kill());

it("builds a protocol 1 manifest whose hashes match the exported files", () => {
  const files = { "b.hbc": Buffer.from("js"), "a.png": Buffer.from("img") };
  const { manifest, uploads } = buildManifest({
    metadata: { fileMetadata: { ios: { bundle: "b.hbc", assets: [{ path: "a.png", ext: "png" }] } } },
    read: (p) => files[p], platform: "ios", runtimeVersion: "rt", expoConfig: { name: "x" }, baseUrl: "https://ota.test",
  });
  expect(manifest.launchAsset).toMatchObject({ contentType: "application/javascript", fileExtension: ".bundle", hash: createHash("sha256").update("js").digest("base64url") });
  expect(manifest.assets[0]).toMatchObject({ contentType: "image/png", url: `https://ota.test/assets/${createHash("sha256").update("img").digest("hex")}` });
  expect(manifest.extra.expoClient).toEqual({ name: "x" });
  expect(uploads.map((u) => u.path)).toEqual(["b.hbc", "a.png"]);
  expect(verify("payload", sign("payload", keyPem))).toBe(true);
});

it("has nothing to offer before the first publish", async () => {
  expect((await fetch(`${base}/manifest`, { headers })).status).toBe(404);
});

it("refuses uploads and publishes without the token", async () => {
  expect((await fetch(`${base}/publish`, { method: "POST", body: "{}" })).status).toBe(401);
  expect(publish({ OTA_PUBLISH_TOKEN: "wrong" }).status).not.toBe(0);
});

it("serves a signed manifest the app can verify, with downloadable assets", async () => {
  const run = publish();
  expect(run.stderr).toBe("");
  expect(run.status).toBe(0);
  const res = await fetch(`${base}/manifest`, { headers: { ...headers, accept: "multipart/mixed" } });
  expect(res.status).toBe(200);
  expect(res.headers.get("expo-protocol-version")).toBe("1");
  const { manifest } = parts(await res.text(), res.headers.get("content-type"));
  expect(verify(manifest.body, manifest.headers["expo-signature"])).toBe(true);
  const body = JSON.parse(manifest.body);
  expect(body.runtimeVersion).toBe("crew-preview-iphone-310");
  const bundle = Buffer.from(await (await fetch(body.launchAsset.url)).arrayBuffer());
  expect(createHash("sha256").update(bundle).digest("base64url")).toBe(body.launchAsset.hash);
  expect((await fetch(`${base}/manifest`, { headers: { ...headers, "expo-runtime-version": "crew-preview-iphone-311" } })).status).toBe(404);
});

it("rejects a tampered upload and can roll back to the embedded bundle", async () => {
  const hex = createHash("sha256").update("real").digest("hex");
  const put = await fetch(`${base}/assets/${hex}`, { method: "PUT", headers: { authorization: `Bearer ${token}` }, body: "fake" });
  expect(put.status).toBe(422);
  expect(publish({ OTA_ROLLBACK: "true" }).status).toBe(0);
  const res = await fetch(`${base}/manifest`, { headers: { ...headers, accept: "multipart/mixed" } });
  const { directive } = parts(await res.text(), res.headers.get("content-type"));
  expect(JSON.parse(directive.body).type).toBe("rollBackToEmbedded");
  expect(verify(directive.body, directive.headers["expo-signature"])).toBe(true);
});
