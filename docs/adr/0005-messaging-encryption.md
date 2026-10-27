# ADR 0005: end-to-end encrypted messaging

Status: accepted, 2026-10-27.

## Context

MSG-02 asks for a vetted protocol and library, no home-made cryptography, forward secrecy, post-compromise security and keys per device. FEATURES.md already chose MLS (RFC 9420) for every conversation, one-to-one included, with OpenMLS as the default implementation and libsignal dropped (AGPL-3.0, unsupported outside Signal).

OpenMLS and mls-rs are Rust: shipping either means a native module cross-compiled for iOS and Android, kept in step with Expo upgrades, with no way to test it on this Windows machine. The app runs on Hermes, which has `crypto.getRandomValues` (through expo-crypto) but no WebCrypto.

A spike ran a full group (create, add, welcome, messages both ways, remove) with ts-mls and `crypto.subtle` removed. It failed only where @hpke/core and ts-mls reach for WebCrypto (HMAC, HKDF, AES-GCM, X25519, Ed25519).

## Decision

- MLS through **ts-mls 1.6.4** (MIT), a TypeScript implementation of RFC 9420, with its noble crypto provider. One ciphersuite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519`. Primitives come from @noble/curves, @noble/hashes and @noble/ciphers (MIT, audited).
- `packages/mls/src/subtle.ts` adapts noble to the subset of `SubtleCrypto` the libraries call, installed only where `crypto.subtle` is missing (`installCrypto`). It implements no algorithm: it maps WebCrypto calls to noble functions. `subtle.test.ts` checks every operation against Node's own WebCrypto, both directions, and `group.test.ts` runs the protocol with no WebCrypto at all.
- Everything MLS lives behind `packages/mls/src/group.ts` (`ChatGroup`, key packages, safety numbers, sealed media and backups). Moving to OpenMLS later means replacing that file's internals, not the app.
- Each signed-in device is its own leaf with its own Ed25519 signature key (multi-device by design). The leaf credential is `userId:deviceId`; the authentication service checks every leaf key against the server's device list, so a member cannot pose as another device. MSG-05 safety numbers are computed over those keys (Signal's numeric fingerprint, iterated SHA-512), so a server that swapped keys would show up.
- The server is only the delivery service (`apps/server/src/routes/chat.ts`): it orders commits per epoch (first wins, others get 409 and retry), routes welcomes and key packages, stores ciphertext with a time to live, and never holds a key that opens content. Membership comes from crews, parties and friendships; the group follows it through commits made by a member's phone.
- Media are encrypted on the phone with a fresh AES-256-GCM key per file; the key travels inside the MLS message. The optional history backup is sealed with AES-256-GCM under a 160-bit recovery key only the user has.
- Local state (group states, private keys, history) is sealed with a key kept in the Keychain / Keystore (expo-secure-store); AsyncStorage holds only ciphertext.

## Consequences

- MSG-02 holds today on iOS, Android and the web preview with no native code.
- ts-mls has not had a formal audit (its README says so). This is the main risk, recorded in SECURITY.md: an independent review of `packages/mls` and of ts-mls is needed before a public release, or a switch to OpenMLS behind the same interface.
- Pure-JS elliptic curves are slower than native ones: a full add-and-welcome takes a few hundred milliseconds in V8, more in Hermes. Fine for crews; to be measured on a low-end phone.
- Forward secrecy and post-compromise security come from MLS epochs: every membership change is a commit with a fresh path, and a device that opens a conversation renews its own leaf keys with an empty commit when the last renewal is older than a day.
- Shipping a crypto library changes the export answers: see docs/EXPORT_COMPLIANCE.md.
