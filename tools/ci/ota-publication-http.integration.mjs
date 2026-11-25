import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile, writeFile, rm, mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const token = "local-test-token";
const channel = "public-iphone", runtime = "crew-public-iphone-123";
const signature = 'sig="AAAA", keyid="main"'; // Fixture: server stores signatures; the native client verifies them.
const server = new URL("../../deploy/ota/server.mjs", import.meta.url);
const manifestHeaders = { "expo-platform": "ios", "expo-runtime-version": runtime, "expo-channel-name": channel, "expo-protocol-version": "1" };

async function start(data) {
  const child = spawn(process.execPath, [server.pathname], { env: { ...process.env, PORT: "0", OTA_DATA: data, OTA_PUBLISH_TOKEN_SHA256: createHash("sha256").update(token).digest("hex") }, stdio: ["ignore", "pipe", "pipe"] });
  const exited = once(child, "exit");
  let output = "";
  child.stdout.on("data", d => { output += d; });
  child.stderr.on("data", d => { output += d; });
  for (let i = 0; i < 200; i++) {
    const match = /server on :(\d+),/.exec(output);
    if (match) return { url: `http://127.0.0.1:${match[1]}`, stop: async () => { child.kill(); await exited; } };
    if (child.exitCode !== null) break;
    await delay(25);
  }
  child.kill();
  await exited;
  throw new Error(`Server did not start: ${output}`);
}
function request(url, path, payload, auth = token) {
  return fetch(url + path, { method: "POST", headers: { authorization: `Bearer ${auth}`, "content-type": "application/json" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
}
function payload(sequence, value, overrides = {}) {
  const body = { id: randomUUID(), createdAt: new Date().toISOString(), runtimeVersion: runtime, launchAsset: { hash: value }, assets: [], extra: { expoClient: { name: value } } };
  return { platform: "ios", channel, runtimeVersion: runtime, kind: "manifest", body: JSON.stringify(body), signature, assets: [], sequence, ...overrides };
}
async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), "crew-ota-http-"));
  const processes = [];
  t.after(async () => { await Promise.all(processes.map(s => s.stop())); await rm(dir, { recursive: true, force: true }); });
  const launch = async () => { const s = await start(dir); processes.push(s); return s; };
  const a = await launch();
  return { a, launch, path: join(dir, "updates", "ios", channel, `${runtime}.json`) };
}
async function current(url) { const r = await fetch(url + "/manifest", { headers: manifestHeaders }); assert.equal(r.status, 200); return r.json(); }
async function publish(url, seq, value) { const r = await request(url, "/publish", payload(seq, value)); return { status: r.status, ...(r.headers.get("content-type")?.includes("application/json") ? await r.json() : { error: await r.text() }) }; }

test("identical content keeps the original ID and history; newer sequence fences off stale jobs", async t => {
  const { a, path } = await fixture(t);
  const first = await publish(a.url, "100.1", "same");
  assert.equal(first.status, 201);
  const duplicate = await publish(a.url, "102.1", "same");
  assert.equal(duplicate.status, 200); assert.equal(duplicate.id, first.id); assert.equal(duplicate.deduplicated, true);
  assert.equal((await publish(a.url, "101.9", "stale")).status, 409);
  assert.equal((await publish(a.url, "102.1", "different")).status, 409);
  assert.equal((await current(a.url)).id, first.id);
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.equal(saved.history.length, 1); assert.equal(saved.current.sequence, "102.1");
});

test("32 concurrent requests across two real server processes leave the newest sequence intact", async t => {
  const { a, launch, path } = await fixture(t);
  const b = await launch();
  const results = await Promise.all(Array.from({ length: 32 }, (_, i) => publish(i % 2 ? a.url : b.url, `${200 + i}.1`, `v${i}`)));
  assert.ok(results.every(x => [201, 409].includes(x.status)));
  assert.equal(results[31].status, 201);
  const saved = JSON.parse(await readFile(path, "utf8"));
  assert.equal(saved.current.sequence, "231.1");
  assert.equal((await current(a.url)).id, results[31].id);
  assert.equal((await current(b.url)).id, results[31].id);
  await a.stop(); await b.stop();
  const c = await launch();
  assert.equal((await publish(c.url, "230.99", "stale after process restart")).status, 409);
  assert.equal((await current(c.url)).id, results[31].id);
});

test("parallel identical publications produce exactly one new update", async t => {
  const { a, launch, path } = await fixture(t);
  const b = await launch();
  const r = await Promise.all(Array.from({ length: 20 }, (_, i) => publish(i % 2 ? a.url : b.url, "500.1", "identical")));
  assert.equal(r.filter(x => x.status === 201).length, 1);
  assert.equal(r.filter(x => x.status === 200).length, 19);
  assert.equal(new Set(r.map(x => x.id)).size, 1);
  assert.equal(JSON.parse(await readFile(path, "utf8")).history.length, 1);
});

test("corrupt persisted state is not overwritten", async t => {
  const { a, path } = await fixture(t);
  await publish(a.url, "1.1", "first");
  await writeFile(path, "{broken");
  assert.equal((await publish(a.url, "2.1", "second")).status, 500);
  assert.equal(await readFile(path, "utf8"), "{broken");
});

test("unauthenticated, invalid and unsequenced stale requests cannot mutate state", async t => {
  const { a } = await fixture(t);
  const first = await publish(a.url, "1.1", "first");
  assert.equal((await request(a.url, "/publish", payload("2.1", "second"), "bad")).status, 401);
  assert.equal((await publish(a.url, "02.1", "second")).status, 400);
  assert.equal((await publish(a.url, "0.1", "second")).status, 400);
  assert.equal((await publish(a.url, undefined, "second")).status, 409);
  assert.equal((await current(a.url)).id, first.id);
});

test("an orphaned lock fails closed rather than allowing a concurrent writer", async t => {
  const { a, path } = await fixture(t);
  const first = await publish(a.url, "1.1", "first");
  await mkdir(`${path}.lock`);
  assert.equal((await publish(a.url, "2.1", "second")).status, 503);
  assert.equal((await current(a.url)).id, first.id);
  await rmdir(`${path}.lock`);
  assert.equal((await publish(a.url, "2.1", "second")).status, 201);
});
