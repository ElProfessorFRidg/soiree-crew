import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireUser, type Context } from "../context";

interface DrinkRow {
  id: string;
  kind: string;
  preset_id: string;
  sealed: string;
  consumed_at: number;
  logged_at: number;
  verified: boolean;
  deleted_at: number | null;
}

interface SealedDrink {
  volumeMl: number;
  abv: number;
  withFood: boolean;
  name: string | null;
}

/** GET /v1/sync?since=: everything of mine that changed since the cursor (SYNC-05 delta sync). */
export function syncRoutes(app: FastifyInstance, ctx: Context): void {
  app.get("/v1/sync", async (request) => {
    const user = requireUser(request);
    const { since } = z.object({ since: z.coerce.number().int().nonnegative().default(0) }).parse(request.query);
    const serverTime = ctx.now();

    const drinks = await ctx.db.query<DrinkRow>(
      "select id, kind, preset_id, sealed, consumed_at, logged_at, verified, deleted_at from drinks where user_id = $1 and updated_at > $2",
      [user.id, since],
    );
    const water = await ctx.db.query<{ id: string; at: number; deleted_at: number | null }>(
      "select id, at, deleted_at from water where user_id = $1 and updated_at > $2",
      [user.id, since],
    );
    const custom = await ctx.db.query<{ id: string; data: string; deleted_at: number | null }>(
      "select id, data, deleted_at from custom_drinks where user_id = $1 and updated_at > $2",
      [user.id, since],
    );
    const preferences = await ctx.db.query<{ data: string }>("select data from user_preferences where user_id = $1 and updated_at > $2", [
      user.id,
      since,
    ]);
    const profile = await ctx.db.query<{ sealed: string }>("select sealed from body_profiles where user_id = $1 and updated_at > $2", [user.id, since]);

    return {
      serverTime,
      drinks: drinks.map((row) => {
        if (row.deleted_at !== null) return { id: row.id, deleted: true };
        const body = ctx.sealer.open<SealedDrink>(row.sealed);
        return {
          id: row.id,
          kind: row.kind,
          presetId: row.preset_id,
          volumeMl: body.volumeMl,
          abv: body.abv,
          withFood: body.withFood,
          ...(body.name ? { name: body.name } : {}),
          consumedAt: row.consumed_at,
          loggedAt: row.logged_at,
          verified: row.verified,
        };
      }),
      water: water.map((row) => (row.deleted_at !== null ? { id: row.id, deleted: true } : { id: row.id, at: row.at })),
      customDrinks: custom.map((row) => (row.deleted_at !== null ? { id: row.id, deleted: true } : JSON.parse(row.data))),
      preferences: preferences[0] ? JSON.parse(preferences[0].data) : null,
      profile: profile[0] ? ctx.sealer.open(profile[0].sealed) : null,
    };
  });
}
