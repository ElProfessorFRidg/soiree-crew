import { buildApp } from "./app";
import { createHash } from "node:crypto";
import { Sealer } from "./crypto";
import { connectPglite, connectPostgres, migrate } from "./db";
import { LiveHub } from "./live";

// Configuration comes from the environment only.
//   DATABASE_URL  postgres://... (falls back to an on-disk PGlite database in ./data for local use)
//   DATA_KEY      32 random bytes, base64: encrypts health data (openssl rand -base64 32)
//   PUBLIC_URL    https address phones use, for invite links
//   PORT          default 8787

const dataKey = process.env.DATA_KEY;
if (!dataKey) {
  console.error("DATA_KEY is missing. Generate one with: openssl rand -base64 32");
  process.exit(1);
}

const db = process.env.DATABASE_URL ? await connectPostgres(process.env.DATABASE_URL) : await connectPglite("./data");
await migrate(db);

const port = Number(process.env.PORT ?? 8787);
const app = await buildApp(
  {
    db,
    sealer: new Sealer(dataKey),
    live: new LiveHub(),
    now: () => Date.now(),
    publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${port}`,
    hashSecret: createHash("sha256").update(`fix-hash:${dataKey}`).digest("hex"),
  },
  { logger: true },
);

await app.listen({ port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void app.close().then(() => db.close()).then(() => process.exit(0));
  });
}
