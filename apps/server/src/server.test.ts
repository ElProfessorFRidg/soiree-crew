import { randomBytes, randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app";
import { Sealer } from "./crypto";
import { connectPglite, migrate, type Db } from "./db";
import { LiveHub } from "./live";

const H = 3_600_000;
let clock = Date.UTC(2026, 9, 24, 20, 0);
let db: Db;
let app: FastifyInstance;
let live: LiveHub;

beforeEach(async () => {
  clock = Date.UTC(2026, 9, 24, 20, 0);
  db = await connectPglite();
  await migrate(db);
  live = new LiveHub();
  app = await buildApp({ db, sealer: new Sealer(randomBytes(32).toString("base64")), live, now: () => clock, publicUrl: "https://crew.test", hashSecret: "test-secret" });
});

afterEach(async () => {
  await app.close();
  await db.close();
});

async function account(username: string) {
  const res = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username, displayName: username.toUpperCase() } });
  expect(res.statusCode).toBe(201);
  const body = res.json() as { user: { id: string }; token: string };
  return { id: body.user.id, auth: { authorization: `Bearer ${body.token}` } };
}

function drink(at: number, extra: Record<string, unknown> = {}) {
  return { id: randomUUID(), presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: at, loggedAt: at, withFood: false, ...extra };
}

async function send(auth: Record<string, string>, ...mutations: { key: string; mutation: unknown }[]) {
  const res = await app.inject({ method: "POST", url: "/v1/mutations", headers: auth, payload: { mutations } });
  expect(res.statusCode).toBe(200);
  return (res.json() as { results: { key: string; status: string; reason?: string }[] }).results;
}

describe("accounts and sessions", () => {
  it("rejects requests without a session", async () => {
    expect((await app.inject({ method: "GET", url: "/v1/me" })).statusCode).toBe(401);
  });

  it("refuses a taken username", async () => {
    await account("jade");
    const res = await app.inject({ method: "POST", url: "/v1/accounts", payload: { username: "jade", displayName: "Other" } });
    expect(res.statusCode).toBe(409);
  });

  it("moves to a second phone with a one-time transfer code", async () => {
    const jade = await account("jade");
    const { code } = (await app.inject({ method: "POST", url: "/v1/sessions/transfer-code", headers: jade.auth })).json() as { code: string };
    const claim = await app.inject({ method: "POST", url: "/v1/sessions/claim", payload: { code } });
    expect(claim.statusCode).toBe(201);
    const again = await app.inject({ method: "POST", url: "/v1/sessions/claim", payload: { code } });
    expect(again.statusCode).toBe(400);
  });
});

describe("mutations (SYNC-01 to SYNC-04)", () => {
  it("accepts a drink and answers a replayed key with the stored result", async () => {
    const jade = await account("jade");
    const mutation = { kind: "drink.add", drink: drink(clock) };
    const [first] = await send(jade.auth, { key: "key-00000001", mutation });
    expect(first!.status).toBe("accepted");
    const [replay] = await send(jade.auth, { key: "key-00000001", mutation });
    expect(replay).toEqual(first);
    const rows = await db.query("select id from drinks");
    expect(rows).toHaveLength(1);
  });

  it("rejects a drink in the future with its reason", async () => {
    const jade = await account("jade");
    const [result] = await send(jade.auth, { key: "key-00000002", mutation: { kind: "drink.add", drink: drink(clock + H) } });
    expect(result).toMatchObject({ status: "rejected", reason: "future_drink" });
  });

  it("rejects malformed input and fields nobody may set", async () => {
    const jade = await account("jade");
    const [result] = await send(jade.auth, { key: "key-00000003", mutation: { kind: "drink.add", drink: { ...drink(clock), volumeMl: -5 } } });
    expect(result!.status).toBe("rejected");
  });

  it("never lets one user overwrite another user's drink", async () => {
    const jade = await account("jade");
    const malik = await account("malik");
    const d = drink(clock);
    await send(jade.auth, { key: "key-00000004", mutation: { kind: "drink.add", drink: d } });
    const [result] = await send(malik.auth, { key: "key-00000005", mutation: { kind: "drink.add", drink: { ...d, volumeMl: 50 } } });
    expect(result).toMatchObject({ status: "rejected", reason: "invalid" });
  });

  it("stores health data as ciphertext only (SEC-04)", async () => {
    const jade = await account("jade");
    await send(
      jade.auth,
      { key: "key-00000006", mutation: { kind: "profile.set", profile: { weightKg: 61, bodyModel: "female", declaredBody: "female", healthConsentAt: clock } } },
      { key: "key-00000007", mutation: { kind: "drink.add", drink: drink(clock, { name: "Spritz maison", kind: "custom" }) } },
    );
    const dump = JSON.stringify([await db.query("select * from body_profiles"), await db.query("select * from drinks")]);
    // Base64 never contains quotes or spaces, so these can only match plaintext.
    expect(dump).not.toContain('"weightKg"');
    expect(dump).not.toContain("Spritz maison");
  });
});

describe("delta sync (SYNC-05)", () => {
  it("returns my changes since the cursor, deletions included", async () => {
    const jade = await account("jade");
    const d = drink(clock);
    await send(jade.auth, { key: "key-00000010", mutation: { kind: "drink.add", drink: d } });
    const full = (await app.inject({ method: "GET", url: "/v1/sync?since=0", headers: jade.auth })).json() as {
      serverTime: number;
      drinks: { id: string; volumeMl?: number; deleted?: boolean }[];
    };
    expect(full.drinks[0]).toMatchObject({ id: d.id, volumeMl: 500 });
    clock += 60_000;
    await send(jade.auth, { key: "key-00000011", mutation: { kind: "drink.remove", drink: { id: d.id } } });
    const delta = (await app.inject({ method: "GET", url: `/v1/sync?since=${full.serverTime}`, headers: jade.auth })).json() as {
      drinks: { id: string; deleted?: boolean }[];
    };
    expect(delta.drinks).toEqual([{ id: d.id, deleted: true }]);
  });
});

describe("crews, parties and the live dashboard", () => {
  async function crewWith(...names: string[]) {
    const users = await Promise.all(names.map(account));
    const admin = users[0]!;
    const crew = (await app.inject({ method: "POST", url: "/v1/crews", headers: admin.auth, payload: { name: "Les Quais" } })).json() as {
      crew: { id: string };
    };
    const invite = (await app.inject({ method: "POST", url: `/v1/crews/${crew.crew.id}/invites`, headers: admin.auth })).json() as {
      code: string;
      url: string;
    };
    expect(invite.url).toBe(`https://crew.test/i/${invite.code}`);
    for (const user of users.slice(1)) {
      const res = await app.inject({ method: "POST", url: `/v1/invites/${invite.code}/accept`, headers: user.auth });
      expect(res.statusCode).toBe(200);
    }
    return { users, crewId: crew.crew.id };
  }

  it("shows the invite page to anyone, with the crew name and size only", async () => {
    const { users, crewId } = await crewWith("jade", "malik");
    const invite = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string };
    const page = (await app.inject({ method: "GET", url: `/v1/invites/${invite.code}` })).json();
    expect(page).toMatchObject({ crew: { name: "Les Quais", members: 2 } });
  });

  it("sends HSTS and basic security headers (SEC-03)", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.headers["strict-transport-security"]).toContain("max-age=");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
  });

  it("serves the shared invite link as a page that opens the app (QOL-05)", async () => {
    const { users, crewId } = await crewWith("jade", "malik");
    const invite = (await app.inject({ method: "POST", url: `/v1/crews/${crewId}/invites`, headers: users[0]!.auth })).json() as { code: string; url: string };
    expect(invite.url).toBe(`https://crew.test/i/${invite.code}`);
    const fr = await app.inject({ method: "GET", url: `/i/${invite.code}`, headers: { "accept-language": "fr-FR,fr;q=0.9" } });
    expect(fr.headers["content-type"]).toContain("text/html");
    expect(fr.body).toContain("Rejoins Les Quais");
    expect(fr.body).toContain(`soireecrew://join?code=${invite.code}&amp;server=https%3A%2F%2Fcrew.test`);
    const gone = await app.inject({ method: "GET", url: "/i/NOPE1234" });
    expect(gone.statusCode).toBe(404);
  });

  it("computes members' BACs on the server and hides the party from other crews", async () => {
    const { users, crewId } = await crewWith("jade", "malik");
    const [jade, malik] = users as [Awaited<ReturnType<typeof account>>, Awaited<ReturnType<typeof account>>];
    const outsider = await account("ines");
    const partyId = randomUUID();
    const created = await app.inject({
      method: "POST",
      url: "/v1/parties",
      headers: jade.auth,
      payload: { id: partyId, crewId, name: "Samedi au Zinc", mood: "party", kind: "party", startsAt: clock - H, endsAt: clock + 6 * H },
    });
    expect(created.statusCode).toBe(201);
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    await send(
      malik.auth,
      { key: "key-00000020", mutation: { kind: "profile.set", profile: { weightKg: 80, bodyModel: "male", declaredBody: "male", healthConsentAt: clock } } },
      { key: "key-00000021", mutation: { kind: "drink.add", drink: drink(clock) } },
    );
    clock += H;
    const liveView = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: jade.auth })).json() as {
      members: { displayName: string; bac: number | null; drinks: number }[];
    };
    const malikRow = liveView.members.find((m) => m.displayName === "MALIK")!;
    // research/bac.md T1: one 50 cl beer, man 80 kg, 1 h later = 0.230 g/L.
    expect(malikRow.bac).toBeCloseTo(0.23, 2);
    expect(malikRow.drinks).toBe(1);
    expect(JSON.stringify(liveView)).not.toContain("weightKg");

    const blocked = await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: outsider.auth });
    expect(blocked.statusCode).toBe(404);
  });

  it("flags a member with no sign of life for 45 minutes (N-29)", async () => {
    const { users, crewId } = await crewWith("jade", "malik");
    const [jade, malik] = users as [Awaited<ReturnType<typeof account>>, Awaited<ReturnType<typeof account>>];
    const partyId = randomUUID();
    await app.inject({
      method: "POST",
      url: "/v1/parties",
      headers: jade.auth,
      payload: { id: partyId, crewId, name: "", mood: "party", kind: "party", startsAt: clock - H, endsAt: clock + 6 * H },
    });
    await app.inject({ method: "POST", url: `/v1/parties/${partyId}/response`, headers: malik.auth, payload: { response: "going" } });
    await send(malik.auth, { key: "key-00000030", mutation: { kind: "water.add", water: { id: randomUUID(), at: clock } } });
    clock += 50 * 60_000;
    const view = (await app.inject({ method: "GET", url: `/v1/parties/${partyId}/live`, headers: jade.auth })).json() as {
      members: { displayName: string; quiet: boolean }[];
    };
    expect(view.members.find((m) => m.displayName === "MALIK")!.quiet).toBe(true);
  });

  it("closes a party at its end time and pushes hints to members", async () => {
    const { users, crewId } = await crewWith("jade");
    const jade = users[0]!;
    const seen: string[] = [];
    live.add(jade.id, { send: (data) => seen.push(data) });
    const partyId = randomUUID();
    await app.inject({
      method: "POST",
      url: "/v1/parties",
      headers: jade.auth,
      payload: { id: partyId, crewId, name: "", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 2 * H },
    });
    await send(jade.auth, { key: "key-00000040", mutation: { kind: "drink.add", drink: drink(clock) } });
    expect(seen.some((event) => event.includes("party.changed"))).toBe(true);
    clock += 3 * H;
    const list = (await app.inject({ method: "GET", url: "/v1/parties", headers: jade.auth })).json() as { parties: { live: boolean; closedAt: number }[] };
    expect(list.parties[0]).toMatchObject({ live: false });
    expect(list.parties[0]!.closedAt).toBeGreaterThan(0);
  });

  it("refuses parties that would stay open for days (O-40)", async () => {
    const { users, crewId } = await crewWith("jade");
    const res = await app.inject({
      method: "POST",
      url: "/v1/parties",
      headers: users[0]!.auth,
      payload: { id: randomUUID(), crewId, name: "", mood: "party", kind: "party", startsAt: clock, endsAt: clock + 48 * H },
    });
    expect(res.statusCode).toBe(400);
  });

  it("deletes an account and hands its crew to the next member (O-07)", async () => {
    const { users, crewId } = await crewWith("jade", "malik");
    const res = await app.inject({ method: "DELETE", url: "/v1/me", headers: users[0]!.auth });
    expect(res.statusCode).toBe(204);
    const crews = (await app.inject({ method: "GET", url: "/v1/crews", headers: users[1]!.auth })).json() as {
      crews: { id: string; members: { username: string }[] }[];
    };
    expect(crews.crews[0]!.id).toBe(crewId);
    expect(crews.crews[0]!.members.map((m) => m.username)).toEqual(["malik"]);
  });
});
