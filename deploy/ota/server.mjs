// Self-hosted Expo Updates server (protocol 1): no Expo account, no EAS.
//
// CI exports the bundle, uploads its assets, then publishes a manifest that it has already
// signed with the code signing key. This server never holds that key: it stores and serves
// what CI signed, and the app rejects anything whose signature does not match the certificate
// embedded in the IPA. See docs/OTA.md.
//
// Environment:
//   OTA_PUBLISH_TOKEN_SHA256  hex SHA-256 of the CI publish token (the token itself stays in GitHub)
//   OTA_DATA                  data directory (default /data)
//   PORT                      default 3000
import { createHash, timingSafeEqual } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const DATA = process.env.OTA_DATA ?? "/data";
const PORT = Number(process.env.PORT ?? 3000);
const TOKEN_HASH = Buffer.from(process.env.OTA_PUBLISH_TOKEN_SHA256 ?? "", "hex");
const MAX_ASSET = 64 * 1024 * 1024;
const MAX_JSON = 4 * 1024 * 1024;
const MAX_BATCH = 48 * 1024 * 1024;
const HISTORY = 30;

const NAME = /^[a-z0-9][a-z0-9._-]{0,99}$/i;
const SHA256 = /^[a-f0-9]{64}$/;
const PLATFORMS = new Set(["ios", "android"]);

const assetPath = (hex) => join(DATA, "assets", hex.slice(0, 2), hex);
const streamPath = (platform, channel, runtime) => join(DATA, "updates", platform, channel, `${runtime}.json`);

function authorized(req) {
  const header = req.headers.authorization ?? "";
  if (TOKEN_HASH.length !== 32 || !header.startsWith("Bearer ")) return false;
  const given = createHash("sha256").update(header.slice(7)).digest();
  return timingSafeEqual(given, TOKEN_HASH);
}

async function body(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error("Payload too large"), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function writeAtomic(path, data) {
  await mkdir(join(path, ".."), { recursive: true });
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

async function readStream(platform, channel, runtime) {
  try {
    return JSON.parse(await readFile(streamPath(platform, channel, runtime), "utf8"));
  } catch {
    return null;
  }
}

function send(res, status, payload, headers = {}) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, { "content-type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json", ...headers });
  res.end(text);
}

// Manifest or directive, as the client asked for it (multipart for protocol 1 clients).
function sendUpdate(req, res, record) {
  const part = record.kind === "directive" ? "directive" : "manifest";
  const common = { "expo-protocol-version": "1", "expo-sfv-version": "0", "cache-control": "private, max-age=0" };
  if (!(req.headers.accept ?? "").includes("multipart/mixed")) {
    res.writeHead(200, { ...common, "content-type": "application/json", "expo-signature": record.signature });
    return res.end(record.body);
  }
  const boundary = `crew-${createHash("sha256").update(record.id + Date.now()).digest("hex").slice(0, 24)}`;
  const crlf = "\r\n";
  const out = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="${part}"`,
    "Content-Type: application/json; charset=utf-8",
    `expo-signature: ${record.signature}`,
    "",
    record.body,
    `--${boundary}`,
    'Content-Disposition: form-data; name="extensions"',
    "Content-Type: application/json",
    "",
    JSON.stringify({ assetRequestHeaders: {} }),
    `--${boundary}--`,
    "",
  ].join(crlf);
  res.writeHead(200, { ...common, "content-type": `multipart/mixed; boundary=${boundary}` });
  res.end(out);
}

async function manifest(req, res) {
  const platform = req.headers["expo-platform"];
  const runtime = req.headers["expo-runtime-version"];
  const channel = req.headers["expo-channel-name"];
  const protocol = req.headers["expo-protocol-version"] ?? "0";
  if (!PLATFORMS.has(platform) || !NAME.test(runtime ?? "") || !NAME.test(channel ?? "")) {
    return send(res, 400, "Missing or invalid expo-platform, expo-runtime-version or expo-channel-name");
  }
  if (protocol !== "1") return send(res, 400, "Only Expo Updates protocol 1 is supported");
  const stream = await readStream(platform, channel, runtime);
  if (!stream?.current) {
    // Nothing published for this binary yet: the app keeps its embedded bundle.
    return send(res, 404, "No update for this runtime", { "expo-protocol-version": "1", "cache-control": "private, max-age=0" });
  }
  return sendUpdate(req, res, stream.current);
}

async function asset(req, res, hex) {
  if (!SHA256.test(hex)) return send(res, 400, "Bad asset id");
  const path = assetPath(hex);
  let info;
  try {
    info = await stat(path);
  } catch {
    return send(res, 404, "Unknown asset");
  }
  res.writeHead(200, {
    "content-type": "application/octet-stream",
    "content-length": info.size,
    "cache-control": "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") return res.end();
  createReadStream(path).pipe(res);
}

async function uploadAsset(req, res, hex) {
  if (!SHA256.test(hex)) return send(res, 400, "Bad asset id");
  const data = await body(req, MAX_ASSET);
  if (createHash("sha256").update(data).digest("hex") !== hex) return send(res, 422, "Content does not match its SHA-256");
  if (!existsSync(assetPath(hex))) await writeAtomic(assetPath(hex), data);
  return send(res, 201, { stored: hex });
}

// One question for the whole export instead of a HEAD per file: a burst of 404s looks like a scan to CrowdSec.
async function missingAssets(req, res) {
  const { hashes } = JSON.parse((await body(req, MAX_JSON)).toString("utf8"));
  if (!Array.isArray(hashes) || hashes.length > 10_000 || !hashes.every((hex) => SHA256.test(hex))) return send(res, 400, "Bad hashes");
  return send(res, 200, { missing: [...new Set(hashes)].filter((hex) => !existsSync(assetPath(hex))) });
}

// Several files per request ({ files: [{ hex, data (base64) }] }), each checked against its SHA-256:
// a few requests per publish instead of one per file.
async function uploadBatch(req, res) {
  const { files } = JSON.parse((await body(req, MAX_BATCH)).toString("utf8"));
  if (!Array.isArray(files) || !files.every((f) => SHA256.test(f?.hex ?? "") && typeof f.data === "string")) return send(res, 400, "Bad files");
  const decoded = files.map((f) => ({ hex: f.hex, data: Buffer.from(f.data, "base64") }));
  const wrong = decoded.filter((f) => createHash("sha256").update(f.data).digest("hex") !== f.hex).map((f) => f.hex);
  if (wrong.length) return send(res, 422, { error: "Content does not match its SHA-256", wrong });
  for (const f of decoded) if (!existsSync(assetPath(f.hex))) await writeAtomic(assetPath(f.hex), f.data);
  return send(res, 201, { stored: decoded.length });
}

// CI posts what it signed: { platform, channel, runtimeVersion, kind, body, signature, assets, message, commit }.
async function publish(req, res) {
  const p = JSON.parse((await body(req, MAX_JSON)).toString("utf8"));
  if (!PLATFORMS.has(p.platform) || !NAME.test(p.channel ?? "") || !NAME.test(p.runtimeVersion ?? "")) {
    return send(res, 400, "Bad platform, channel or runtimeVersion");
  }
  if (!["manifest", "directive"].includes(p.kind) || typeof p.body !== "string" || !/^sig="[A-Za-z0-9+/=]+", keyid="[\w-]+"$/.test(p.signature ?? "")) {
    return send(res, 400, "Bad kind, body or signature");
  }
  const parsed = JSON.parse(p.body);
  if (p.kind === "manifest") {
    if (parsed.runtimeVersion !== p.runtimeVersion || !parsed.id || !parsed.launchAsset) return send(res, 400, "Manifest does not match");
    const missing = (p.assets ?? []).filter((hex) => !SHA256.test(hex) || !existsSync(assetPath(hex)));
    if (missing.length) return send(res, 409, { error: "Missing assets", missing });
  } else if (!["rollBackToEmbedded", "noUpdateAvailable"].includes(parsed.type)) {
    return send(res, 400, "Unknown directive");
  }
  const record = {
    kind: p.kind, id: parsed.id ?? `directive-${Date.now()}`, createdAt: parsed.createdAt ?? new Date().toISOString(),
    body: p.body, signature: p.signature, message: String(p.message ?? "").slice(0, 300), commit: String(p.commit ?? "").slice(0, 40),
    publishedAt: new Date().toISOString(),
  };
  const stream = (await readStream(p.platform, p.channel, p.runtimeVersion)) ?? { history: [] };
  stream.current = record;
  stream.history = [record, ...(stream.history ?? [])].slice(0, HISTORY);
  await writeAtomic(streamPath(p.platform, p.channel, p.runtimeVersion), JSON.stringify(stream));
  log(`published ${p.kind} ${record.id} to ${p.platform}/${p.channel}/${p.runtimeVersion} (${record.commit})`);
  return send(res, 201, { id: record.id, kind: record.kind });
}

function log(message) {
  console.log(`${new Date().toISOString()} ${message}`);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  try {
    if (req.method === "GET" && url.pathname === "/health") return send(res, 200, "ok");
    if (req.method === "GET" && url.pathname === "/manifest") return await manifest(req, res);
    if (parts[0] === "assets" && parts.length === 2) {
      if (req.method === "GET" || req.method === "HEAD") return await asset(req, res, parts[1]);
      if (req.method === "PUT") return authorized(req) ? await uploadAsset(req, res, parts[1]) : send(res, 401, "Unauthorized");
    }
    if (req.method === "POST" && url.pathname === "/assets/batch") {
      return authorized(req) ? await uploadBatch(req, res) : send(res, 401, "Unauthorized");
    }
    if (req.method === "POST" && url.pathname === "/assets/missing") {
      return authorized(req) ? await missingAssets(req, res) : send(res, 401, "Unauthorized");
    }
    if (req.method === "POST" && url.pathname === "/publish") {
      return authorized(req) ? await publish(req, res) : send(res, 401, "Unauthorized");
    }
    return send(res, 404, "Not found");
  } catch (error) {
    log(`error ${req.method} ${url.pathname}: ${error.message}`);
    return send(res, error.status ?? 500, error.status ? error.message : "Server error");
  }
});

if (TOKEN_HASH.length !== 32) log("warning: OTA_PUBLISH_TOKEN_SHA256 is missing, publishing is disabled");
server.listen(PORT, () => log(`Expo Updates server on :${PORT}, data in ${DATA}`));
