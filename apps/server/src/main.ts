import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { aiProvider } from "./ai";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, connectPostgres, migrate } from "./db";
import { LiveHub } from "./live";

// Configuration comes from the environment only.
//   DATABASE_URL  postgres://... (falls back to an on-disk PGlite database in ./data for local use)
//   DATA_KEY      32 random bytes, base64: encrypts health data (openssl rand -base64 32)
//   PUBLIC_URL    https address phones use, for invite links
//   PORT          default 8787
//   UPLOAD_DIR    album photos, chat files and backups (default ./data/uploads; /data/uploads in the image)
//   TRUST_PROXY   "1" (one proxy hop, e.g. Coolify's Traefik) or "true"; unset when exposed directly
//   AI_PROVIDER, ANTHROPIC_API_KEY, AI_MODEL   optional, ADR 0004
//   SERVER_NAME, SERVER_DESCRIPTION, PUBLIC_SERVER=true   how the server presents itself (GET /v1/info)
//   DOWNLOADS_DIR   where deploy/android drops the APK it builds, served at /download/soiree-crew.apk
//   OPERATOR_USERNAMES   comma-separated usernames who review venue claims (COM-11)
//   SEASON_VARIANTS   optional JSON, {"2026-12": "games"} (TER-12)

const dataKey = process.env.DATA_KEY;
if (!dataKey) {
  console.error("DATA_KEY is missing. Generate one with: openssl rand -base64 32");
  process.exit(1);
}

const db = process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : await connectPglite("./data");
await migrate(db);

const port = Number(process.env.PORT ?? 8787);

function trustProxy(value: string | undefined): boolean | number {
  if (!value || value === "false" || value === "0") return false;
  if (value === "true") return true;
  const hops = Number.parseInt(value, 10);
  return Number.isFinite(hops) && hops > 0 ? hops : false;
}
const app = await buildApp(
  {
    db,
    sealer: new Sealer(dataKey),
    live: new LiveHub(),
    now: () => Date.now(),
    publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
    hashSecret: createHash("sha256").update(`fix-hash:${dataKey}`).digest("hex"),
    uploadDir: process.env.UPLOAD_DIR ?? "./data/uploads",
    ai: aiProvider(),
    ...(process.env.DOWNLOADS_DIR ? { downloadsDir: process.env.DOWNLOADS_DIR } : {}),
    serverInfo: { name: process.env.SERVER_NAME ?? "", description: process.env.SERVER_DESCRIPTION ?? "", public: process.env.PUBLIC_SERVER === "true" },
    operators: (process.env.OPERATOR_USERNAMES ?? "").split(",").map((u) => u.trim().toLowerCase()).filter(Boolean),
  },
  { logger: true, trustProxy: trustProxy(process.env.TRUST_PROXY) },
);

await app.listen({ port, host: "0.0.0.0" });

let closing = false;
const shutdown = () => {
  if (closing) return;
  closing = true;
  // Open sockets (the live channel) can hold app.close() forever: give it 3 s, then close the database anyway.
  const grace = new Promise((resolve) => setTimeout(resolve, 3_000).unref());
  void Promise.race([app.close(), grace])
    .then(() => db.close())
    .finally(() => process.exit(0));
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, shutdown);

// Windows kills processes without a signal, which leaves the local PGlite files dirty.
// For local use only: creating data/.shutdown stops the server cleanly.
if (!process.env.DATABASE_URL) {
  setInterval(() => {
    if (!existsSync("./data/.shutdown")) return;
    rmSync("./data/.shutdown", { force: true });
    shutdown();
  }, 1_000).unref();
}
