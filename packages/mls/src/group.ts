// MSG-02: every conversation is an MLS group (RFC 9420) run by ts-mls (ADR 0005). This file is the
// only place that touches the library: the app sees devices, groups and bytes, never MLS internals.
import {
  createApplicationMessage,
  createCommit,
  createGroup,
  decodeGroupState,
  decodeMlsMessage,
  defaultCapabilities,
  defaultLifetime,
  emptyPskIndex,
  encodeGroupState,
  encodeMlsMessage,
  generateKeyPackageWithKey,
  getCiphersuiteFromName,
  getCiphersuiteImpl,
  joinGroup,
  nobleCryptoProvider,
  processPrivateMessage,
  type CiphersuiteImpl,
  type ClientConfig,
  type ClientState,
  type KeyPackage,
  type PrivateKeyPackage,
  type Proposal,
  type RatchetTree,
} from "ts-mls";
import { defaultClientConfig } from "ts-mls/clientConfig.js";
import { makeKeyPackageRef } from "ts-mls/keyPackage.js";
import { unprotectPrivateMessage } from "ts-mls/messageProtection.js";
import { getSenderLeafNodeIndex } from "ts-mls/sender.js";
import { fromBase64, toBase64, toBase64Url, utf8 } from "./bytes";

export const CIPHERSUITE = "MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519" as const;

let suitePromise: Promise<CiphersuiteImpl> | null = null;
/** The one ciphersuite every device uses: X25519, AES-128-GCM, SHA-256, Ed25519. */
export function suite(): Promise<CiphersuiteImpl> {
  suitePromise ??= getCiphersuiteImpl(getCiphersuiteFromName(CIPHERSUITE), nobleCryptoProvider);
  return suitePromise;
}

export interface DeviceRef {
  userId: string;
  deviceId: string;
}

/** The leaf credential: who a device belongs to. Signature keys are checked against the directory. */
export const identityOf = (device: DeviceRef): Uint8Array => utf8.encode(`${device.userId}:${device.deviceId}`);

export function parseIdentity(identity: Uint8Array): DeviceRef | null {
  const [userId, deviceId, ...rest] = utf8.decode(identity).split(":");
  return userId && deviceId && rest.length === 0 ? { userId, deviceId } : null;
}

/**
 * Where the signature key of each device comes from (the server's device list). A leaf whose key
 * does not match is refused, so a member cannot pose as another device of the group.
 */
export type Directory = (device: DeviceRef) => Promise<Uint8Array | undefined>;

function clientConfig(directory: Directory): ClientConfig {
  return {
    ...defaultClientConfig,
    authService: {
      async validateCredential(credential, signaturePublicKey) {
        if (credential.credentialType !== "basic") return false;
        const device = parseIdentity(credential.identity);
        if (!device) return false;
        const known = await directory(device);
        return known !== undefined && toBase64(known) === toBase64(signaturePublicKey);
      },
    },
  };
}

export interface SignatureKeys {
  signKey: Uint8Array;
  publicKey: Uint8Array;
}

/** One signature key pair per device, kept for its whole life: it is what safety numbers show. */
export async function newSignatureKeys(): Promise<SignatureKeys> {
  return (await suite()).signature.keygen();
}

export interface KeyPackageBundle {
  /** KeyPackageRef, base64url: how a welcome names the package it was made for. */
  ref: string;
  /** The public half, an encoded MLSMessage, sent to the server. */
  publicData: string;
  /** The private half, kept on this device until the package is used. */
  privateData: string;
}

function encodePrivate(p: PrivateKeyPackage): string {
  return JSON.stringify({ init: toBase64(p.initPrivateKey), hpke: toBase64(p.hpkePrivateKey), sig: toBase64(p.signaturePrivateKey) });
}

function decodePrivate(text: string): PrivateKeyPackage {
  const p = JSON.parse(text) as { init: string; hpke: string; sig: string };
  return { initPrivateKey: fromBase64(p.init), hpkePrivateKey: fromBase64(p.hpke), signaturePrivateKey: fromBase64(p.sig) };
}

function decodeKeyPackage(data: string): KeyPackage {
  const decoded = decodeMlsMessage(fromBase64(data), 0)?.[0];
  if (!decoded || decoded.wireformat !== "mls_key_package") throw new Error("Not a key package");
  return decoded.keyPackage;
}

/** Fresh one-time key packages for this device, ready to upload. */
export async function newKeyPackages(device: DeviceRef, keys: SignatureKeys, count: number): Promise<KeyPackageBundle[]> {
  const cs = await suite();
  const out: KeyPackageBundle[] = [];
  for (let i = 0; i < count; i++) {
    const { publicPackage, privatePackage } = await generateKeyPackageWithKey(
      { credentialType: "basic", identity: identityOf(device) },
      defaultCapabilities(),
      defaultLifetime,
      [],
      keys,
      cs,
    );
    out.push({
      ref: toBase64Url(await makeKeyPackageRef(publicPackage, cs.hash)),
      publicData: toBase64(encodeMlsMessage({ version: "mls10", wireformat: "mls_key_package", keyPackage: publicPackage })),
      privateData: encodePrivate(privatePackage),
    });
  }
  return out;
}

/** Checks a key package from the server before it is added: right ciphersuite, signed by its leaf, right owner. */
export async function readKeyPackage(data: string): Promise<{ device: DeviceRef; signatureKey: Uint8Array }> {
  const keyPackage = decodeKeyPackage(data);
  if (keyPackage.cipherSuite !== CIPHERSUITE) throw new Error("Wrong ciphersuite");
  const credential = keyPackage.leafNode.credential;
  const device = credential.credentialType === "basic" ? parseIdentity(credential.identity) : null;
  if (!device) throw new Error("Unknown credential");
  return { device, signatureKey: keyPackage.leafNode.signaturePublicKey };
}

export interface Member extends DeviceRef {
  leaf: number;
  signatureKey: Uint8Array;
}

function membersOf(tree: RatchetTree): Member[] {
  const out: Member[] = [];
  tree.forEach((node, index) => {
    if (node?.nodeType !== "leaf" || node.leaf.credential.credentialType !== "basic") return;
    const device = parseIdentity(node.leaf.credential.identity);
    if (device) out.push({ ...device, leaf: index / 2, signatureKey: node.leaf.signaturePublicKey });
  });
  return out;
}

export type Incoming =
  | { kind: "application"; sender: DeviceRef; plaintext: Uint8Array; group: ChatGroup }
  | { kind: "commit"; group: ChatGroup; removed: boolean };

export interface CommitResult {
  commit: string;
  welcome: string | null;
  /** The group after the commit. Keep it only once the server has accepted the commit. */
  group: ChatGroup;
}

/**
 * One conversation's group state. Immutable: every operation returns the next group, so a commit
 * the server refuses is simply dropped and the previous state stays valid.
 */
export class ChatGroup {
  private constructor(private readonly state: ClientState) {}

  static async create(groupId: string, own: KeyPackageBundle, directory: Directory): Promise<ChatGroup> {
    const cs = await suite();
    const state = await createGroup(utf8.encode(groupId), decodeKeyPackage(own.publicData), decodePrivate(own.privateData), [], cs, clientConfig(directory));
    return new ChatGroup(state);
  }

  static async join(welcome: string, own: KeyPackageBundle, directory: Directory): Promise<ChatGroup> {
    const cs = await suite();
    const decoded = decodeMlsMessage(fromBase64(welcome), 0)?.[0];
    if (!decoded || decoded.wireformat !== "mls_welcome") throw new Error("Not a welcome");
    const state = await joinGroup(decoded.welcome, decodeKeyPackage(own.publicData), decodePrivate(own.privateData), emptyPskIndex, cs, undefined, undefined, clientConfig(directory));
    return new ChatGroup(state);
  }

  static load(saved: string, directory: Directory): ChatGroup {
    const decoded = decodeGroupState(fromBase64(saved), 0)?.[0];
    if (!decoded) throw new Error("Unreadable group state");
    return new ChatGroup({ ...decoded, clientConfig: clientConfig(directory) });
  }

  save(): string {
    return toBase64(encodeGroupState(this.state));
  }

  get epoch(): number {
    return Number(this.state.groupContext.epoch);
  }

  get active(): boolean {
    return this.state.groupActiveState.kind === "active";
  }

  members(): Member[] {
    return membersOf(this.state.ratchetTree);
  }

  /** Adds and removes in one commit. Removed leaves get no key for the next epoch (post-compromise security). */
  async commit(change: { add?: string[]; removeLeaves?: number[] } = {}): Promise<CommitResult> {
    const cs = await suite();
    const proposals: Proposal[] = [
      ...(change.removeLeaves ?? []).map((removed): Proposal => ({ proposalType: "remove", remove: { removed } })),
      ...(change.add ?? []).map((data): Proposal => ({ proposalType: "add", add: { keyPackage: decodeKeyPackage(data) } })),
    ];
    const result = await createCommit({ state: this.state, cipherSuite: cs }, { extraProposals: proposals, ratchetTreeExtension: true });
    return {
      commit: toBase64(encodeMlsMessage(result.commit)),
      welcome: result.welcome ? toBase64(encodeMlsMessage({ version: "mls10", wireformat: "mls_welcome", welcome: result.welcome })) : null,
      group: new ChatGroup(result.newState),
    };
  }

  /** Encrypts one application message. Save the returned group before sending, so no key is ever used twice. */
  async encrypt(plaintext: Uint8Array): Promise<{ message: string; group: ChatGroup }> {
    const cs = await suite();
    const result = await createApplicationMessage(this.state, plaintext, cs);
    return {
      message: toBase64(encodeMlsMessage({ version: "mls10", wireformat: "mls_private_message", privateMessage: result.privateMessage })),
      group: new ChatGroup(result.newState),
    };
  }

  async process(data: string): Promise<Incoming> {
    const cs = await suite();
    const decoded = decodeMlsMessage(fromBase64(data), 0)?.[0];
    if (!decoded || decoded.wireformat !== "mls_private_message") throw new Error("Not a group message");
    const message = decoded.privateMessage;
    // ts-mls does not say who sent an application message: read the sender from the same
    // authenticated framing, on the unchanged state (states are immutable, so this costs nothing else).
    const current = message.epoch === this.state.groupContext.epoch;
    const receiver = current
      ? { senderDataSecret: this.state.keySchedule.senderDataSecret, secretTree: this.state.secretTree, ratchetTree: this.state.ratchetTree, groupContext: this.state.groupContext }
      : this.state.historicalReceiverData.get(message.epoch);
    const result = await processPrivateMessage(this.state, message, emptyPskIndex, cs);
    const next = new ChatGroup(result.newState);
    if (result.kind === "newState") return { kind: "commit", group: next, removed: !next.active };
    if (!receiver) throw new Error("Epoch too old");
    const peek = await unprotectPrivateMessage(receiver.senderDataSecret, message, receiver.secretTree, receiver.ratchetTree, receiver.groupContext, this.state.clientConfig.keyRetentionConfig, cs);
    const leaf = getSenderLeafNodeIndex(peek.content.content.sender);
    const sender = leaf === undefined ? undefined : membersOf(receiver.ratchetTree).find((m) => m.leaf === leaf);
    if (!sender) throw new Error("Unknown sender");
    return { kind: "application", sender: { userId: sender.userId, deviceId: sender.deviceId }, plaintext: result.message, group: next };
  }
}
