import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate } from "./db";
import { LiveHub } from "./live";

describe("APK built on the server", () => {
  it("is served to anyone with its build info", async () => {
    const dir = mkdtempSync(join(tmpdir(), "apk-"));
    writeFileSync(join(dir, "soiree-crew.apk"), Buffer.from("PK fake apk"));
    writeFileSync(join(dir, "android.json"), '{ "build": 41, "commit": "abc1234" }');
    const db = await connectPglite();
    await migrate(db);
    const app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => Date.now(), publicUrl: "https://crew.test", hashSecret: "s", downloadsDir: dir });
    const apk = await app.inject({ method: "GET", url: "/download/soiree-crew.apk" });
    expect(apk.statusCode).toBe(200);
    expect(apk.headers["content-type"]).toBe("application/vnd.android.package-archive");
    expect(apk.body).toBe("PK fake apk");
    expect(((await app.inject({ method: "GET", url: "/download/android.json" })).json() as { build: number }).build).toBe(41);
    await app.close();
    await db.close();
  });
});
