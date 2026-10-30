import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { seasonOf, unlockedIcons } from "./appIcons";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

describe("app icon unlocks (JOY-03)", () => {
  it("maps nights to seasons and titles to icons", () => {
    expect(["2026-12-05", "2027-02-27", "2026-03-01", "2026-07-14", "2026-10-31"].map(seasonOf)).toEqual(["winter", "winter", "spring", "summer", "autumn"]);
    expect(unlockedIcons(["mayor", "conqueror"], ["2026-07-14", "2026-08-01"])).toEqual(["boss", "summer"]);
    expect(unlockedIcons([], [])).toEqual([]);
  });

  describe("endpoint", () => {
    let db: Db;
    let app: FastifyInstance;
    const clock = Date.UTC(2026, 6, 11, 21, 0);
    beforeEach(async () => {
      db = await connectPglite();
      await migrate(db);
      app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live: new LiveHub(), now: () => clock, publicUrl: "https://crew.test", hashSecret: "s" });
    });
    afterEach(async () => {
      await app.close();
      await db.close();
    });

    async function account(username: string) {
      const body = (await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username } })).json() as { user: { id: string }; token: string };
      return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
    }

    it("unlocks a season only after a night out together", async () => {
      const jade = await account("jade");
      const malik = await account("malik");
      const icons = async () => ((await app.inject({ method: "GET", url: "/v1/me/app-icons", headers: jade.auth })).json() as { unlocked: string[] }).unlocked;
      expect(await icons()).toEqual([]);

      const crewId = ((await app.inject({ method: "POST", url: "/v1/crews", headers: jade.auth, payload: { name: "Crew" } })).json() as { crew: { id: string } }).crew.id;
      const partyId = randomUUID();
      await app.inject({ method: "POST", url: "/v1/parties", headers: jade.auth, payload: { id: partyId, crewId, name: "Samedi", mood: "party", kind: "party", startsAt: clock - 3_600_000, endsAt: clock + 3_600_000 } });
      // Alone, it is not a night out together.
      expect(await icons()).toEqual([]);

      const { code } = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: jade.auth })).json() as { code: string };
      await app.inject({ method: "POST", url: `/v1/invites/${code}/accept`, headers: malik.auth });
      await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
      expect(await icons()).toEqual(["summer"]);
    });
  });
});
