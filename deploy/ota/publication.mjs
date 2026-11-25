// Shared-filesystem transaction. No unsafe automatic deletion of orphaned locks.
import { mkdir, readFile, rename, open, unlink, rmdir } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

export async function serialize(key, task, timeout = 5000) {
  await mkdir(dirname(key), { recursive: true });
  const lock = `${key}.lock`;
  const deadline = Date.now() + timeout;
  for (;;) {
    try { await mkdir(lock); break; }
    catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) throw Object.assign(new Error("Publication lock busy; retry or inspect orphaned lock"), { status: 503 });
      await delay(20);
    }
  }
  try { return await task(); }
  finally { await rmdir(lock); }
}

export async function readPublication(path) {
  let stream;
  try { stream = JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
  if (!stream || typeof stream !== "object" || !stream.current || !Array.isArray(stream.history)) throw new Error("Invalid publication state");
  return stream;
}

export async function writePublication(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${randomUUID()}.tmp`;
  try {
    const file = await open(tmp, "wx", 0o600);
    try { await file.writeFile(JSON.stringify(data)); await file.sync(); }
    finally { await file.close(); }
    await rename(tmp, path);
    const dir = await open(dirname(path), "r");
    try { await dir.sync(); } finally { await dir.close(); }
  } finally { await unlink(tmp).catch(error => { if (error.code !== "ENOENT") throw error; }); }
}

export function contentIdentity(manifest) {
  const { id, createdAt, ...content } = manifest;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])])) : value;
  return JSON.stringify(canonical(content));
}
export function sequenceOf(p) {
  if (p.sequence == null) return null;
  if (typeof p.sequence !== "string" || !/^[1-9]\d{0,19}\.[1-9]\d{0,5}$/.test(p.sequence)) throw new Error("Invalid publication sequence");
  return p.sequence;
}
export function older(a,b) {
  const [x,y] = a.split(".").map(BigInt), [u,v] = b.split(".").map(BigInt);
  return x < u || (x === u && y < v);
}

export async function commitPublication(path, record, limit = 30) {
  return serialize(path, async () => {
    const stream = await readPublication(path) ?? { history: [] };
    const prior = stream.current;
    if (prior?.sequence && (!record.sequence || older(record.sequence, prior.sequence))) return { status: 409, body: { error: "Superseded publication" } };
    if (prior?.kind === record.kind && (record.kind === "manifest" ? contentIdentity(JSON.parse(prior.body)) === contentIdentity(JSON.parse(record.body)) : prior.body === record.body)) {
      if (record.sequence && record.sequence !== prior.sequence) {
        stream.current = { ...prior, sequence: record.sequence };
        await writePublication(path, stream);
      }
      return { status: 200, body: { id: prior.id, kind: prior.kind, deduplicated: true } };
    }
    if (record.sequence && prior?.sequence === record.sequence) return { status: 409, body: { error: "Sequence already published with different content" } };
    stream.current = record;
    stream.history = [record, ...stream.history].slice(0, limit);
    await writePublication(path, stream);
    return { status: 201, body: { id: record.id, kind: record.kind } };
  });
}
