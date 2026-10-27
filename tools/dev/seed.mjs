#!/usr/bin/env node
// Fills a LOCAL dev server with a test crew, venues, a live party, check-ins and drinks.
// Usage: node tools/dev/seed.mjs [http://localhost:8787]
// Never point it at a real server: it creates throwaway accounts.

import { randomUUID } from "node:crypto";

const base = process.argv[2] ?? "http://localhost:8787";
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(base)) {
  console.error("Refusing to seed anything but a local dev server.");
  process.exit(1);
}

async function call(path, { token, method = "GET", body } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const suffix = Math.random().toString(36).slice(2, 6);
const people = [
  ["jade", "Jade", "female", 61],
  ["malik", "Malik", "male", 78],
  ["ines", "Inès", "female", 58],
  ["theo", "Théo", "male", 72],
];
const now = Date.now();
const users = [];
for (const [username, displayName, body, weight] of people) {
  const { user, token } = await call("/v1/accounts", { method: "POST", body: { username: `${username}${suffix}`, displayName } });
  await call("/v1/mutations", {
    token,
    method: "POST",
    body: { mutations: [{ key: randomUUID(), mutation: { kind: "profile.set", profile: { weightKg: weight, bodyModel: body, declaredBody: body, healthConsentAt: now } } }] },
  });
  users.push({ ...user, token });
}
const [jade, malik, ines, theo] = users;

const { crew } = await call("/v1/crews", { token: jade.token, method: "POST", body: { name: "Les Quais" } });
const { code } = await call(`/v1/crews/${crew.id}/invites`, { token: jade.token, method: "POST" });
for (const u of [malik, ines, theo]) await call(`/v1/invites/${code}/accept`, { token: u.token, method: "POST" });

const venues = [
  ["Le Zinc", "bar", 48.8638, 2.3797],
  ["La Capsule", "bar", 48.8667, 2.3806],
  ["Quai 12", "club", 48.8469, 2.3653],
  ["Chez Odette", "bar", 48.8584, 2.3863],
];
const venueIds = [];
for (const [name, kind, lat, lng] of venues) {
  const id = randomUUID();
  await call(`/v1/crews/${crew.id}/venues`, { token: jade.token, method: "POST", body: { id, name, kind, lat, lng } });
  venueIds.push({ id, lat, lng });
}

const partyId = randomUUID();
await call("/v1/parties", {
  token: jade.token,
  method: "POST",
  body: { id: partyId, crewId: crew.id, name: "Samedi au Zinc", mood: "party", kind: "party", startsAt: now - 2 * 3_600_000, endsAt: now + 5 * 3_600_000 },
});
for (const u of [malik, ines, theo]) await call(`/v1/parties/${partyId}/response`, { token: u.token, method: "POST", body: { response: "going" } });

const zinc = venueIds[0];
for (const u of [jade, malik, ines]) {
  await call("/v1/checkins", {
    token: u.token,
    method: "POST",
    body: { id: randomUUID(), venueId: zinc.id, lat: zinc.lat + 0.0001, lng: zinc.lng + 0.00005, accuracy: 12, mocked: false, deviceNow: Date.now(), private: false },
  });
}

const drinkIds = [];
for (const [user, minutesAgo] of [
  [malik, 70],
  [malik, 35],
  [ines, 50],
  [jade, 40],
  [theo, 20],
]) {
  const id = randomUUID();
  const at = now - minutesAgo * 60_000;
  await call("/v1/mutations", {
    token: user.token,
    method: "POST",
    body: { mutations: [{ key: randomUUID(), mutation: { kind: "drink.add", drink: { id, presetId: "m-pint", kind: "pint", volumeMl: 500, abv: 0.05, consumedAt: at, loggedAt: at, withFood: false } } }] },
  });
  drinkIds.push({ id, user });
}
// Friends confirm two of Malik's drinks and Ines's.
await call(`/v1/drinks/${drinkIds[0].id}/confirm`, { token: jade.token, method: "POST" });
await call(`/v1/drinks/${drinkIds[1].id}/confirm`, { token: ines.token, method: "POST" });
await call(`/v1/drinks/${drinkIds[2].id}/confirm`, { token: malik.token, method: "POST" });

console.log(
  JSON.stringify(
    {
      session: { url: base, userId: jade.id, username: jade.username, displayName: jade.displayName },
      token: jade.token,
      crewId: crew.id,
      partyId,
    },
    null,
    2,
  ),
);
