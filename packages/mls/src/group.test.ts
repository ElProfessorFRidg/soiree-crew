import { webcrypto } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// Run the whole protocol the way Hermes would: no crypto.subtle, only getRandomValues and the shim.
const random = webcrypto.getRandomValues.bind(webcrypto) as <T extends ArrayBufferView>(a: T) => T;
Object.defineProperty(globalThis, "crypto", { value: { getRandomValues: random }, configurable: true, writable: true });

type Mls = typeof import("./index");
let m: Mls;

beforeAll(async () => {
  const { installCrypto } = await import("./runtime");
  installCrypto(random);
  m = await import("./index");
});

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function device(userId: string, deviceId: string, keys: Map<string, Uint8Array>) {
  const signature = await m.newSignatureKeys();
  keys.set(`${userId}:${deviceId}`, signature.publicKey);
  const ref = { userId, deviceId };
  return { ref, signature, packages: await m.newKeyPackages(ref, signature, 3) };
}

describe("MLS groups without WebCrypto", () => {
  it("runs the shim, not the platform", () => {
    expect((globalThis.crypto as { subtle?: unknown }).subtle).toBeDefined();
    expect((globalThis.crypto as { subtle?: unknown }).subtle).not.toBe(webcrypto.subtle);
  });

  it("adds, talks, names senders, removes and locks the removed device out", async () => {
    const keys = new Map<string, Uint8Array>();
    const directory: import("./group").Directory = async (d) => keys.get(`${d.userId}:${d.deviceId}`);
    const alice1 = await device("alice", "a1", keys);
    const alice2 = await device("alice", "a2", keys);
    const bob = await device("bob", "b1", keys);

    let a1 = await m.ChatGroup.create("conv-1", alice1.packages[0]!, directory);
    expect(a1.epoch).toBe(0);
    const added = await a1.commit({ add: [alice2.packages[0]!.publicData, bob.packages[0]!.publicData] });
    a1 = added.group;
    expect(a1.epoch).toBe(1);
    let a2 = await m.ChatGroup.join(added.welcome!, alice2.packages[0]!, directory);
    let b1 = await m.ChatGroup.join(added.welcome!, bob.packages[0]!, directory);
    expect(b1.members().map((x) => x.deviceId).sort()).toEqual(["a1", "a2", "b1"]);

    const hello = await a1.encrypt(enc("salut"));
    a1 = hello.group;
    const atBob = await b1.process(hello.message);
    expect(atBob.kind).toBe("application");
    if (atBob.kind !== "application") return;
    expect(atBob.sender).toEqual({ userId: "alice", deviceId: "a1" });
    expect(dec(atBob.plaintext)).toBe("salut");
    b1 = atBob.group;
    const atA2 = await a2.process(hello.message);
    a2 = atA2.group;

    // A saved state reloads and keeps working.
    b1 = m.ChatGroup.load(b1.save(), directory);
    const reply = await b1.encrypt(enc("yo"));
    b1 = reply.group;
    const back = await a1.process(reply.message);
    expect(back.kind === "application" && back.sender.userId === "bob" && dec(back.plaintext) === "yo").toBe(true);
    a1 = back.group;

    // Remove Bob: he processes the commit, learns he is out, and cannot read what follows.
    const bobLeaf = a1.members().find((x) => x.deviceId === "b1")!.leaf;
    const removal = await a1.commit({ removeLeaves: [bobLeaf] });
    a1 = removal.group;
    const bobSees = await b1.process(removal.commit);
    expect(bobSees.kind === "commit" && bobSees.removed).toBe(true);
    a2 = (await a2.process(removal.commit)).group;
    const secret = await a1.encrypt(enc("sans bob"));
    await expect(bobSees.group.process(secret.message)).rejects.toThrow();
    const atA2Again = await a2.process(secret.message);
    expect(atA2Again.kind === "application" && dec(atA2Again.plaintext)).toBe("sans bob");
  });

  it("reads a late message from the previous epoch", async () => {
    const keys = new Map<string, Uint8Array>();
    const directory: import("./group").Directory = async (d) => keys.get(`${d.userId}:${d.deviceId}`);
    const a = await device("alice", "a1", keys);
    const b = await device("bob", "b1", keys);
    const c = await device("carol", "c1", keys);
    let ga = await m.ChatGroup.create("conv-2", a.packages[0]!, directory);
    const first = await ga.commit({ add: [b.packages[0]!.publicData] });
    ga = first.group;
    let gb = await m.ChatGroup.join(first.welcome!, b.packages[0]!, directory);
    const late = await gb.encrypt(enc("en retard"));
    gb = late.group;
    const second = await ga.commit({ add: [c.packages[0]!.publicData] });
    ga = second.group;
    const read = await ga.process(late.message);
    expect(read.kind === "application" && dec(read.plaintext)).toBe("en retard");
  });

  it("refuses a device whose key does not match the directory", async () => {
    const keys = new Map<string, Uint8Array>();
    const directory: import("./group").Directory = async (d) => keys.get(`${d.userId}:${d.deviceId}`);
    const a = await device("alice", "a1", keys);
    const mallory = await device("bob", "b1", new Map());
    keys.set("bob:b1", (await m.newSignatureKeys()).publicKey);
    const ga = await m.ChatGroup.create("conv-3", a.packages[0]!, directory);
    await expect(ga.commit({ add: [mallory.packages[0]!.publicData] })).rejects.toThrow();
  });

  it("reads key packages and rejects garbage", async () => {
    const keys = new Map<string, Uint8Array>();
    const a = await device("alice", "a1", keys);
    const read = await m.readKeyPackage(a.packages[1]!.publicData);
    expect(read.device).toEqual({ userId: "alice", deviceId: "a1" });
    expect(m.toBase64(read.signatureKey)).toBe(m.toBase64(keys.get("alice:a1")!));
    await expect(m.readKeyPackage(m.toBase64(enc("nope")))).rejects.toThrow();
  });
});

describe("payloads", () => {
  it("keeps valid payloads and drops anything else", () => {
    const text: import("./payload").ChatPayload = { t: "text", id: "1", body: "hello", mentions: ["u1"] };
    expect(m.readPayload(m.writePayload(text))).toEqual(text);
    expect(m.readPayload(enc('{"t":"text","id":"1","body":"  "}'))).toBeNull();
    expect(m.readPayload(enc('{"t":"timer","id":"1","seconds":-5}'))).toBeNull();
    expect(m.readPayload(enc('{"t":"shell","id":"1"}'))).toBeNull();
    expect(m.readPayload(enc("not json"))).toBeNull();
    expect(m.readPayload(enc('{"t":"react","id":"2","target":"1","emoji":""}'))).toEqual({ t: "react", id: "2", target: "1", emoji: "" });
  });
});

describe("safety numbers", () => {
  it("is the same on both sides and changes with a new device", () => {
    const k1 = random(new Uint8Array(32));
    const k2 = random(new Uint8Array(32));
    const k3 = random(new Uint8Array(32));
    const alice = { userId: "alice", keys: [k1] };
    const bob = { userId: "bob", keys: [k2] };
    const n = m.safetyNumber(alice, bob);
    expect(n).toMatch(/^\d{60}$/);
    expect(m.safetyNumber(bob, alice)).toBe(n);
    expect(m.safetyNumber(alice, { userId: "bob", keys: [k2, k3] })).not.toBe(n);
    expect(m.fingerprint({ userId: "bob", keys: [k3, k2] })).toBe(m.fingerprint({ userId: "bob", keys: [k2, k3] }));
    expect(m.groupDigits(n)).toHaveLength(12);
  });
});

describe("sealed media and backups", () => {
  it("opens with the right key only", () => {
    const plain = random(new Uint8Array(5000));
    const sealed = m.sealMedia(plain);
    expect(Buffer.from(m.openMedia(sealed.data, sealed.key)).equals(Buffer.from(plain))).toBe(true);
    const tampered = sealed.data.slice();
    tampered[40]! ^= 1;
    expect(() => m.openMedia(tampered, sealed.key)).toThrow();
    expect(() => m.openMedia(sealed.data, m.sealMedia(plain).key)).toThrow();
  });

  it("restores a backup with the recovery key, typed loosely", () => {
    const key = m.newRecoveryKey();
    expect(key).toMatch(/^([0-9A-HJKMNP-TV-Z]{4}-){7}[0-9A-HJKMNP-TV-Z]{4}$/);
    const sealed = m.sealBackup(enc("history"), key);
    expect(dec(m.openBackup(sealed, key.toLowerCase().replace(/-/g, " ")))).toBe("history");
    expect(() => m.openBackup(sealed, m.newRecoveryKey())).toThrow();
    expect(m.normaliseRecoveryKey("short")).toBeNull();
  });
});
