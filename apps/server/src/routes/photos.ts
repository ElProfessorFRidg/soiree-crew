import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError, requireUser, type Context } from "../context";

const uuid = z.string().uuid();
/** Decoded size cap; the app sends about 300 KB once resized to 1600 px. */
const MAX_BYTES = 4 * 1024 * 1024;
const LINK_TTL_MS = 60 * 60_000;

export function photoDir(ctx: Context): string {
  const dir = ctx.uploadDir ?? "./data/uploads";
  mkdirSync(dir, { recursive: true });
  return dir;
}

export const photoPath = (ctx: Context, id: string) => join(photoDir(ctx), `${id}.jpg`);

function signature(ctx: Context, id: string, exp: number): string {
  return createHmac("sha256", ctx.hashSecret).update(`photo:${id}:${exp}`).digest("base64url");
}

/** Members who may see a party's album: its crew members who said they were going. */
async function assertGoing(ctx: Context, partyId: string, userId: string): Promise<void> {
  const rows = await ctx.db.query(
    `select 1 from parties p join crew_members c on c.crew_id = p.crew_id and c.user_id = $2
     join party_members m on m.party_id = p.id and m.user_id = $2 and m.response = 'going' where p.id = $1`,
    [partyId, userId],
  );
  if (!rows.length) throw new HttpError(404, "not_found");
}

export function photoRoutes(app: FastifyInstance, ctx: Context): void {
  /**
   * QOL-09: the app resizes and re-encodes before sending, which also drops the
   * location in the photo's metadata. The server only accepts JPEG and checks it.
   */
  app.post<{ Params: { id: string } }>("/v1/parties/:id/photos", { bodyLimit: 8 * 1024 * 1024 }, async (request, reply) => {
    const user = requireUser(request);
    await assertGoing(ctx, request.params.id, user.id);
    const input = z
      .object({ id: uuid, data: z.string().min(100).max(7_000_000), width: z.number().int().min(1).max(8000), height: z.number().int().min(1).max(8000) })
      .parse(request.body);
    const existing = await ctx.db.query<{ user_id: string }>("select user_id from photos where id = $1", [input.id]);
    if (existing[0]) {
      if (existing[0].user_id !== user.id) throw new HttpError(409, "conflict");
      return reply.status(200).send({ id: input.id });
    }
    const bytes = Buffer.from(input.data, "base64");
    const jpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (!jpeg) throw new HttpError(400, "not_jpeg");
    if (bytes.length > MAX_BYTES) throw new HttpError(413, "too_large");
    await writeFile(photoPath(ctx, input.id), bytes);
    await ctx.db.query("insert into photos (id, party_id, user_id, width, height, bytes, created_at) values ($1, $2, $3, $4, $5, $6, $7)", [
      input.id,
      request.params.id,
      user.id,
      input.width,
      input.height,
      bytes.length,
      ctx.now(),
    ]);
    const members = await ctx.db.query<{ user_id: string }>("select user_id from party_members where party_id = $1 and response = 'going'", [request.params.id]);
    ctx.live.notify(members.map((m) => m.user_id), { type: "party.changed", partyId: request.params.id });
    return reply.status(201).send({ id: input.id });
  });

  /** O-84: the album, with links that work for an hour and only for this album's members. */
  app.get<{ Params: { id: string } }>("/v1/parties/:id/photos", async (request) => {
    const user = requireUser(request);
    await assertGoing(ctx, request.params.id, user.id);
    const rows = await ctx.db.query<{ id: string; user_id: string; display_name: string; width: number; height: number; created_at: number }>(
      `select p.id, p.user_id, u.display_name, p.width, p.height, p.created_at from photos p join users u on u.id = p.user_id
       where p.party_id = $1 order by p.created_at`,
      [request.params.id],
    );
    const exp = ctx.now() + LINK_TTL_MS;
    return {
      photos: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        name: r.display_name,
        width: r.width,
        height: r.height,
        at: r.created_at,
        url: `${ctx.publicUrl}/v1/photos/${r.id}?exp=${exp}&sig=${signature(ctx, r.id, exp)}`,
      })),
    };
  });

  /** Public route: the signature is the access check, so an <img> tag can load it. */
  app.get<{ Params: { id: string }; Querystring: { exp?: string; sig?: string } }>("/v1/photos/:id", async (request, reply) => {
    const id = uuid.parse(request.params.id);
    const exp = Number(request.query.exp);
    const sig = request.query.sig ?? "";
    const expected = signature(ctx, id, exp);
    const valid = Number.isFinite(exp) && exp > ctx.now() && sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    if (!valid) throw new HttpError(404, "not_found");
    const exists = await ctx.db.query("select 1 from photos where id = $1", [id]);
    if (!exists.length) throw new HttpError(404, "not_found");
    const file = await readFile(photoPath(ctx, id)).catch(() => null);
    if (!file) throw new HttpError(404, "not_found");
    return reply.header("content-type", "image/jpeg").header("cache-control", "private, max-age=3600").send(file);
  });

  app.delete<{ Params: { id: string } }>("/v1/photos/:id", async (request, reply) => {
    const user = requireUser(request);
    const rows = await ctx.db.query<{ party_id: string }>("delete from photos where id = $1 and user_id = $2 returning party_id", [uuid.parse(request.params.id), user.id]);
    if (!rows[0]) throw new HttpError(404, "not_found");
    await unlink(photoPath(ctx, request.params.id)).catch(() => undefined);
    return reply.status(204).send();
  });
}

/** O-07: files of a deleted account go with it. Called before the rows are removed. */
export async function deletePhotoFiles(ctx: Context, userId: string): Promise<void> {
  const rows = await ctx.db.query<{ id: string }>("select id from photos where user_id = $1", [userId]);
  for (const r of rows) await unlink(photoPath(ctx, r.id)).catch(() => undefined);
}
