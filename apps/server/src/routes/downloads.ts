import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { HttpError, type Context } from "../context";

/**
 * The APK built on this machine (deploy/android), for people who install from the server rather than
 * GitHub. Public: it is the app itself, nothing about anyone. 404 until a build exists.
 */
export function downloadRoutes(app: FastifyInstance, ctx: Context): void {
  const dir = () => ctx.downloadsDir ?? null;

  app.get("/download/android.json", async (_request, reply) => {
    const folder = dir();
    if (!folder) throw new HttpError(404, "not_found");
    const text = await readFile(join(folder, "android.json"), "utf8").catch(() => null);
    if (!text) throw new HttpError(404, "not_found");
    return reply.header("cache-control", "no-cache").type("application/json").send(text);
  });

  app.get("/download/soiree-crew.apk", async (_request, reply) => {
    const folder = dir();
    if (!folder) throw new HttpError(404, "not_found");
    const file = join(folder, "soiree-crew.apk");
    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) throw new HttpError(404, "not_found");
    return reply
      .header("content-type", "application/vnd.android.package-archive")
      .header("content-disposition", 'attachment; filename="soiree-crew.apk"')
      .header("content-length", info.size)
      .header("cache-control", "no-cache")
      .send(createReadStream(file));
  });
}
