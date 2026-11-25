// Serialize each stream inside the single supported OTA server process.
const tails = new Map();
export async function serialize(key, task) {
  const previous = tails.get(key) ?? Promise.resolve();
  let release;
  const next = new Promise(resolve => { release = resolve; });
  tails.set(key, next);
  await previous;
  try { return await task(); }
  finally { release(); if (tails.get(key) === next) tails.delete(key); }
}
export function contentIdentity(manifest) {
  const {id,createdAt,...content}=manifest;
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  return JSON.stringify(canonical(content));
}
export function sequenceOf(p) {
  if (p.sequence == null) return null;
  if (!/^\d{1,15}\.\d{1,6}$/.test(p.sequence)) throw new Error("Invalid publication sequence");
  return p.sequence;
}
export function older(a,b) {
  const [x,y]=a.split(".").map(BigInt),[u,v]=b.split(".").map(BigInt);
  return x<u || (x===u && y<v);
}
