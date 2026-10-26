# Recon-Security report

Author: Recon-Security (phase 0). Date: 2026-10-26. All sources read on 2026-10-26 unless stated otherwise. Source IDs `[Sn]` point to section 8.

Scope: SEC-01 to SEC-10, MSG-02 to MSG-09, plus the parts of PROF-08 and `<ai_features>` that touch security. No product code.

Research limit: the shared web-search budget for this turn ran out partway through. Some points could not be confirmed with a fresh search. They are marked `[unsourced]` or listed as assumptions with a verification step.

---

## 1. Summary

1. **E2EE choice: MLS (RFC 9420) through OpenMLS (MIT) for every conversation, 1:1 included.** libsignal is AGPL-3.0, its README says "Use outside of Signal is unsupported", and GPL code in the App Store has a documented licence conflict [S1][S4]. Taking it would force the whole client to be AGPL and still leave the App Store question open. OpenMLS is MIT, under active development (0.9.2, October 2026), builds for iOS and Android, ships security advisories, and runs under XMTP, which NCC Group reviewed [S5][S6][S7][S10]. This is a scope change to MSG-02: drop "libsignal for 1:1" and use 2-member MLS groups.
2. **Multi-device follows the MLS model: one MLS client (leaf) per device** [S19]. A per-user identity key signs each device's credential. Safety numbers (MSG-05) are derived from that key. A new device never receives old history, by protocol design [S19]. Only MSG-08 backups bring history back.
3. **Push (MSG-04):** the APNs/FCM payload carries no content and no names. The iOS Notification Service Extension fetches the ciphertext, decrypts it and replaces the generic text. If it times out, the generic text stays [S26]. Silencing pushes for control messages (MLS commits, receipts) needs Apple's filtering entitlement, which requires an application [S27].
4. **Backups (MSG-08):** a generated recovery key (Signal model: 64 characters, generated on the device, unrecoverable if lost [S23]). No passphrase-only mode, because we have no HSM vault with attempt limits like Meta's [S24]. Apple forbids storing personal health information in iCloud [S33], so the backup must not land in iCloud Drive and the local DB must be excluded from iCloud device backup.
5. **GDPR:** drink logs, BAC and the weight + sex combination are health data. WP29 lists "drinking habits" and "excessive alcohol consumption" explicitly [S51], and the CNIL treats data as health data "par croisement" [S52]. Consequences: explicit consent under art. 9(2)(a), a mandatory processing register (the under-250-employee exemption does not apply to art. 9 data), and a mandatory DPIA (special categories, plus the CNIL list item "large-scale location data from a mobile app") [S53][S56].
6. **Export compliance, France:** an E2EE app counts as "fourniture d'un moyen de cryptologie" and needs a prior ANSSI declaration at least one month before distribution in France [S58]. Apple requires the declaration to be uploaded in App Store Connect for apps that bundle standard algorithms not provided by iOS [S31]. This step is on the critical path before the first French public build, and TestFlight probably counts too (A-SEC-9). **US:** mass-market 5D992.c, no CCATS for standard algorithms; whether a self-classification report is owed is still unclear [S61][S62][S63][S28].
7. **Server encryption (SEC-04):** envelope encryption with Tink (Apache-2.0) under an EU KMS key, plus a per-user data key. Destroying that key ("crypto-shredding") is how deletion reaches backups. Email and phone get HMAC blind indexes [S43][S47][S48].
8. **Auth (SEC-07):** passkeys need an associated domain (iOS) and Credential Manager (Android) [S34][S35]. Supabase Auth passkeys are not in its docs yet, and its GitHub has an open bug with iCloud-synced passkeys [S64][S65]. If Supabase is chosen, passkeys may need a separate WebAuthn library. Sign in with Apple is required once Google sign-in exists [S33].
9. **Apple 5.1.1(ix):** apps that "require sensitive user information should be submitted by a legal entity", not an individual developer [S33]. Together with the ANSSI declaration, this makes a legal entity a likely blocker (section 7).

---

## 2. Findings

### 2.1 E2EE options compared (MSG-02)

Crew sizes: 5 to 30 members, about 1 to 3 devices each, so 5 to 90 MLS leaves. Every option below handles that size. The differences are licence, post-compromise security (PCS), multi-device handling and platform bindings.

| Option | Protocol | Licence | Platforms / bindings | Group fit (5 to 30) | Multi-device | FS / PCS | Maturity / audit |
|---|---|---|---|---|---|---|---|
| **libsignal** (Signal) | X3DH/PQXDH + Double Ratchet, SPQR triple ratchet since Oct 2025, Sender Keys for groups | **AGPL-3.0-only** [S1][S2] | Java (Android), Swift, TypeScript [S1]. npm 0.106.0 on 2026-10-23 [S2][S3] | Good. Server fan-out of Sender Keys [S20] | Sesame: per-device sessions, fan-out to every device of the recipient and the sender [S20] | FS + PCS 1:1. PQ ratchet (ML-KEM-768) [S21] | Very mature, but "Use outside of Signal is unsupported", APIs change "without notice" [S1] |
| **OpenMLS** | MLS RFC 9420 | **MIT** [S5][S6] | Rust. Android/iOS targets built in CI (not tested), wasm [S5]. Bindings to write ourselves (UniFFI, MPL-2.0 tool [S49]). Flutter wrapper `openmls_dart` MIT, very young (9 stars) [S49][S67] | Very good. MLS scales "from two to thousands" [S18] | One leaf per device [S19]. `virtual-clients-draft` feature in progress [S7] | FS per message (secret tree), PCS on each commit/update [S18] | 0.9.2 (2026-10-22) [S6]. Advisories published and fixed (GHSA) [S7][S9]. **No public full audit of the library found.** NCC Group reviewed libxmtp, which is built on OpenMLS (2024) [S10] |
| **mls-rs** (AWS Labs) | MLS RFC 9420 | **Apache-2.0 OR MIT** [S11][S12] | Rust. `mls-rs-uniffi` exists but stuck at 0.1.0 (2024-03-26) [S12]. CryptoKit provider marked "Unsupported" for X.509 [S11] | Very good | One leaf per device | Same as MLS | 0.56.0 (2026-08-19) [S12]. "has not yet received a full security audit by a 3rd party" [S11] |
| **vodozemac** (Matrix) | Olm (Double Ratchet) + Megolm (groups) | **Apache-2.0** [S13] | Rust. Mobile bindings via matrix-rust-sdk (Apache-2.0) [S49], tied to the Matrix model | Good | Per-device Olm sessions, Megolm keys shared per device | **Megolm has no backward secrecy (PCS)** and only partial FS; mitigation is session rotation [S15] | 0.11.1. Least Authority audit "no significant findings" [S13]. libolm deprecated since 2024 [S14] |
| **Wire core-crypto** | MLS + Proteus | **GPL-3.0** [S16] | Android, JVM, iOS, WASM [S16] | Very good | Yes | MLS | Product-specific, GPL, Wire trademark restrictions [S16] |
| **libxmtp** | MLS (on OpenMLS [S10]) | MIT [S17] | Swift, Kotlin, React Native SDK [S17][S67] | Good | Yes | MLS | Tied to the XMTP network and identity model. v8 in release candidate [S17] |

**What AGPL-3.0 means for us (libsignal).**
- Shipping libsignal inside the app makes the client a combined work. The full client source would have to be published under AGPL-3.0 to every user [unsourced: AGPL §6 and §13, page unreachable (HTTP 429)].
- The FSF holds that the App Store terms add restrictions the GPL forbids. Apple removed GNU Go in 2010 rather than change its terms [S4]. Signal can ship its own AGPL code because it holds the copyright. A third party cannot rely on that.
- libsignal only covers the cryptography. Signal's server semantics (prekeys, sealed sender, group credentials [S22]) would have to be rebuilt, on an API that "is subject to change without notice" [S1].
- Verdict: not suitable unless the project goes fully open source under AGPL and accepts the App Store risk. That is a user decision, not a technical default.

**Why MLS for 1:1 too.**
- One protocol, one state machine, one test surface. A DM is a 2-member group.
- PCS comes from commits/updates. The client must therefore update regularly: a self-update commit on every app foreground if more than 24 hours have passed, and after N sent messages (value to set in the ADR).
- The 1:1 → group transition (a DM that grows into a party chat) becomes natural.
- Cost: MLS needs an ordered Delivery Service that serialises commits per group (RFC 9750 architecture [S19]). Our server provides this and stays blind to content.

**Recommendation (to put in the ADR).** OpenMLS + one internal Rust crate (`crew-crypto`) that wraps OpenMLS, local storage and media/push primitives. The crate exposes a small API through UniFFI (Swift/Kotlin) or `uniffi-bindgen-react-native` (MPL-2.0, version 0.31 pre-1.0 [S67]) depending on the Architect's stack.
- Ciphersuite: `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` (MTI) or the ChaCha20 variant [S8].
- Crypto provider: `openmls_rust_crypto` or `libcrux` [S8]. The choice and pinned version go in the ADR.
- Fallback if OpenMLS hits a blocker: mls-rs (same protocol, so the server design does not change).
- Condition: budget an external audit of `crew-crypto` (our integration, not just the library) before a public release (A-SEC-2).

### 2.2 Multi-device and key verification (MSG-02, MSG-05)

- **Devices:** each device generates its own MLS signature key and KeyPackages. RFC 9750 §6.1: each device is a separate client and leaf. §6.7: a new device does not get the history [S19].
- **User identity:** an Ed25519 "account identity key" is created on the first device and saved in the MSG-08 backup. It signs each device credential (`user_id`, `device_id`, MLS public key, expiry). This is the "per-user identity key" model that Sesame also describes [S20]. Checking that a device is signed by its user's account key is a composition of standard signatures, not a new primitive, but the security reviewer must check it (A-SEC-3).
- **Linking a new device:** QR scan from an existing device (proof of possession, then signature of the new device credential). The server then publishes "device X added for user U" and any online member commits the Add to every group the user belongs to. The server cannot add a device itself, because every client rejects a credential that is not signed by the account key.
- **Safety number / QR (MSG-05):** fingerprint = hash of the two account identity public keys (Signal model), shown as 60 digits and as a QR code. Change notice: when a contact's account key changes (all devices lost, no backup), a system message in every shared conversation, and a "verified" mark that resets. Adding a device under the same account key triggers no warning. Instead, a "new device linked" notice goes to the owner's other devices (also SEC-07).
- **Limit:** without key transparency, a malicious server could publish a fake account key for a user who has never been verified. MSG-05 makes this detectable. Key transparency is out of scope for v1 [unsourced: general design knowledge].

### 2.3 Push, media, disappearing messages, reporting, search, backup

**Push (MSG-04).**
- iOS: payload `aps.alert` holds a generic localised text ("New message"), `mutable-content: 1`, and an opaque identifier. The NSE is launched only for an alert with `mutable-content` = 1. It can "decrypt an encrypted data block" and, if time runs out, the system shows the original text [S26].
- Inside the NSE, `crew-crypto` fetches the ciphertext (or reads it from the payload if small), decrypts it, and writes the advanced MLS state to the shared App Group container under a cross-process lock. The app and the NSE can both advance the state, so the lock is mandatory [unsourced: implementation risk known from other messengers; validate in a spike].
- Pushes for commits, receipts and typing must not be shown. Suppressing them needs the `com.apple.developer.usernotifications.filtering` entitlement (on application) and `apns-push-type: alert` [S27]. Without the entitlement, send those events only over the open socket, never by push.
- Android: FCM data-only message, high priority. `FirebaseMessagingService` decrypts and posts a local notification. Google deprioritises high-priority messages that show no notification [unsourced: the FCM page returned 404; verify]. So every high-priority push must end in a visible notification, and silent events use normal priority.
- Never put the crew name or sender name in clear in the payload. APNs and FCM are US processors.

**Media (MSG-03).**
- On the device: random 256-bit key per file, AEAD (Tink AES-GCM / Streaming AEAD for video [S41][S48]), SHA-256 of the ciphertext.
- Key + hash + metadata travel inside the MLS message. Object storage only holds an opaque blob with a random name.
- Thumbnails and blurhash generated on the device and encrypted the same way. EXIF/GPS stripped before encryption (ties to SEC-06).
- Voice notes: same scheme.
- Server-side moderation of images (COM-08) cannot touch chat media. Only MSG-07 reports reach it.

**Disappearing messages (MSG-06).**
- The timer is part of the conversation state (MLS extension or encrypted control message). Each client deletes locally, including FTS indexes and media.
- The Delivery Service deletes queued ciphertext after every device has fetched it, or after a maximum TTL (proposal: 30 days).
- Tell users it does not protect against screenshots.

**Reporting (MSG-07).**
- The reporter's client sends the selected message plus K messages around it (proposal: K=5 before / 2 after), in plaintext, with the sender's signed MLS content, so moderation can check that the reported message was really signed by the sender's device credential [unsourced: RFC 9420 FramedContent signature, check §6 during the ADR].
- Explicit action and a preview of what will be sent. Never automatic.

**Search (MSG-09).**
- SQLite FTS5 in the encrypted local DB, on the device only.
- No chat content to AI features. AI-01 voice input works on the drink-entry field, not on chats.
- Any on-device AI processing stays opt-in and gets its own entry in the register.

**Backup and new phone (MSG-08).**
- Model: archive encrypted on the device with a key derived from a **generated recovery key** (displayed once, about 64 characters, unrecoverable if lost). This is Signal's 2025 design [S23].
- Storage: our server (blob) or a file the user exports. **Not iCloud Drive**, because of guideline 5.1.3(ii) on health information [S33], and not Google Drive by default.
- Passphrase alternative: only acceptable with server-side attempt limits in HSMs (Meta Backup Key Vault, a geo-distributed HSM fleet with keys verified by the client [S24]) or in enclaves (Signal SVR3 [S25]). Too heavy and costly for us. A free-form passphrase without that protection can be brute-forced offline. **Recommendation: recovery key only in v1.** Option to wrap it with a passkey PRF later (Meta mentions passkeys for backups [S24]).
- Contents: plaintext history + media + account identity key. No MLS state: the new device joins as a new client.
- In-app copy, before it matters: at chat onboarding and when the first chat opens, say that without a backup, history does not follow to a new phone.

### 2.4 Server-side encryption (SEC-04)

**Layers.**
1. Disk and database encryption from the host (managed by the provider).
2. Application-level envelope encryption for sensitive fields: KEK in the KMS, DEK per user, AEAD with associated data (`table|column|row_id|user_id`) against row swapping (CipherSweet recommends the primary key as AAD [S47]).
3. Optional extra keys for the most sensitive fields.

OWASP: KEK stored apart from the DEK, encrypted DEK next to the data, key ID stored with each item for rotation, old keys kept as long as backups need them [S43].

**Fields concerned (SEC-04 + this report).**

| Field | Class | Encryption | Searchable? |
|---|---|---|---|
| Email, phone number | Contact identifier | AEAD (user DEK) | Exact match through **blind index** HMAC-SHA-256 (or keyed BLAKE2b), on normalised value, key derived with HKDF per field [S47]. Full length, because the index is also a uniqueness constraint |
| Weight, sex, novice-driver flag | Health (art. 9) | AEAD (user DEK) | No |
| Drinks, BAC history, records | Health (art. 9) | AEAD (user DEK). Server aggregates (leaderboards) computed from minimal derived values with a short lifetime | No, except event time (clear, needed for scoring AC-01) |
| Precise locations, check-in GPS | Location | AEAD (party DEK or user DEK). Deleted after recap / verification (SEC-06) | No. Geospatial queries only on venues (public data), never on user points kept beyond the live session |
| Emergency contacts | Third-party data | AEAD | No |
| IBAN, payment details | Financial | AEAD with a dedicated "finance" KEK | No |
| Push tokens, device keys | Technical | AEAD | Lookup by opaque device ID |
| Chat messages, media | E2EE | Never readable by the server | No |

**Equality versus deterministic encryption.** For exact lookup, a blind index (HMAC) is preferable to deterministic encryption (AES-SIV) because it is one-way. Tink notes that deterministic AEAD "can lead to loss of secrecy" by revealing repeats [S48]. Keep the number and length of indexes per field low [S47].

**Libraries.** Google Tink, Apache-2.0 [S49] (Java/Go/C++/Python, and Rust through community ports, to check against the backend language), or AWS Encryption SDK if AWS [unsourced]. Libsodium (ISC [unsourced: SPDX "NOASSERTION" on GitHub]) as an alternative. No home-made primitive.

**KMS (EU).**

| Provider | EU / Paris region | Rotation | Notes |
|---|---|---|---|
| AWS KMS | eu-west-3 Paris available [S39] | Automatic, 365 days by default, configurable period, on-demand rotation (25 max per key), old key material kept for decryption [S38] | Billed for the first 2 rotations only [S38]. US company (CLOUD Act) [unsourced] |
| Google Cloud KMS | europe-west9 Paris, Cloud HSM available [S40] | Automatic [unsourced: not re-read] | US company |
| Scaleway Key Manager | French provider [S41] | Rotation documented (CLI/API), data encryption keys, ML-KEM added in September 2026 [S41] | Region list and price not confirmed [S41] |
| OVHcloud KMS | "Available in all regions", HSM option FIPS 140-3 L3 (progressive rollout) [S42] | Rotation not listed as a feature [S42] | $0.06288 per key per month, unlimited API calls [S42]. French company |

Recommendation: use the KMS of the chosen backend host. If the backend is a European host (Scaleway/OVH), use its KMS, which avoids a US provider for keys. Otherwise AWS eu-west-3 or GCP europe-west9. One KEK per class (general, health, finance, blind-index), automatic annual rotation, lazy DEK re-encryption job.

**Crypto-shredding for deletion (SEC-08).** On account deletion:
- delete rows immediately;
- destroy the user's DEK, which makes copies in DB backups unreadable;
- keep the DEK store itself in backups for no more than 35 days.

Regulators have not explicitly confirmed that crypto-shredding counts as erasure (A-SEC-6). The CNIL noted in February 2026 that controllers struggle to erase data in backups [S54], so a documented approach is worth having.

### 2.5 Storage on the device (SEC-05)

- **Secrets:**
  - iOS Keychain with an accessibility class such as `AfterFirstUnlockThisDeviceOnly`. This is needed so the NSE can read the key while the screen is locked, and keeps it out of backup migration [unsourced: check the Apple doc during phase 1].
  - Android Keystore: non-exportable keys, TEE/StrongBox, check `KeyInfo.getSecurityLevel()` at runtime instead of assuming hardware [S36].
  - `androidx.security:security-crypto` (EncryptedSharedPreferences/EncryptedFile) **is deprecated** (1.1.0, July 2025) in favour of the Keystore directly [S37]. Do not use it.
- **Local DB:**
  - SQLCipher (BSD-3-Clause) [S49], key random and wrapped by Keychain/Keystore. For RN: op-sqlite (MIT, 18.2.5) [S49][S67], with SQLCipher option to confirm [unsourced]. For Flutter: Drift (MIT) + SQLCipher [S49].
  - Realm (Apache-2.0) not recommended. Its sync story changed at MongoDB [unsourced].
  - OpenMLS has a `sqlite-provider` feature [S8]; MLS state can go in the same encrypted DB or a dedicated file.
- **Backups:**
  - exclude the DB and media cache from iCloud/Google device backup (iOS `isExcludedFromBackup`, Android `dataExtractionRules`) [unsourced: platform APIs to check];
  - this is required anyway by 5.1.3(ii) for health data [S33].
- **App switcher:** blur/cover on `sceneWillResignActive` (iOS), `FLAG_SECURE` or `setRecentsScreenshotEnabled(false)` on BAC, chat and pool screens (Android) [unsourced: check API].
- **O-13 (several accounts):** one DB and one key per account, separate Keychain/Keystore namespaces.
- **Checklist:** MASVS v2.1.0 (Jan 2024) [S46]. Groups STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, PRIVACY. The old L1/L2/R levels are now "MAS Profiles", reworked in 2026 [S46]. SEC-09 should say "MAS-L2 + MAS-R + MAS-P profiles", not "MASVS L2".

### 2.6 Accounts and sessions (SEC-07, O-01)

- **Passkeys first:**
  - iOS: `webcredentials` associated domain mandatory, otherwise the request fails [S34].
  - Android: Credential Manager is the recommended API and replaces older FIDO2/Smart Lock APIs [S35].
  - Server: an RP on the app's own domain.
- **Auth provider:**
  - Supabase Auth: MFA docs only list TOTP and phone [S64]. Passkey endpoints are in progress in `supabase/auth` (PRs September 2026) with an **open bug on iCloud-synced passkeys** [S65]. Do not count on it without a spike.
  - Self-hosted, licence-friendly: Keycloak (Apache-2.0), Ory Kratos (Apache-2.0), better-auth (MIT), SimpleWebAuthn (MIT), go-webauthn (BSD-3) [S49].
  - Hanko and Zitadel are AGPL-3.0 [S49]: fine to run unmodified, source to publish if modified and exposed over the network [unsourced: AGPL §13].
  - Clerk: native/Expo passkey support not confirmed [S66b].
- **Other methods:**
  - Email via **magic link / one-time code** (single use, about 10 min, bound to the requesting device).
  - Google + **Sign in with Apple** (guideline 4.8: a third-party login requires an equivalent option that limits data to name + email and lets users hide their email [S33]).
- **Passwords (if kept):** Argon2id, at least m=19 MiB, t=2, p=1 (or m=46 MiB, t=1, p=1), optional pepper in KMS/vault [S44].
- **Sessions:**
  - short access token (≤ 15 min) + refresh token rotated on each use and bound to the device key (proof of possession through the device key or App Attest/Play Integrity, AC-05);
  - session list with remote sign-out;
  - "new device" alert by push and email;
  - rate limits on sign-in, OTP and recovery (API2/API4 [S45]).
- **2FA:** optional TOTP for email accounts. A passkey is already phishing-resistant.
- **Deletion:** in-app deletion is mandatory as soon as accounts can be created [S33].

### 2.7 API and transport (SEC-01, SEC-02, SEC-03, PROF-08)

- **OWASP API Top 10 2023** (no newer edition found [S45]):
  - API1 (BOLA) and API3 (property-level authorisation) cover SEC-02 and PROF-08;
  - API4 covers rate limits and costs (AI calls, uploads);
  - API6 covers sensitive flows (invitations, points, check-ins);
  - API9 covers inventory (no debug endpoints).
- **Design:** one DTO per use case, built by a serialiser that takes `(viewer, subject, audience rules)` and returns only the allowed fields (PROF-08). Mass-assignment protection by explicit allowlist. Opaque IDs (UUIDv7 or random 128-bit) never sequential. Errors return a generic code and a correlation ID.
- **Tests:** one test per audience (me, crew, friend, stranger, blocked) per profile section, generated from a matrix.
- **TLS:** 1.3 preferred, 1.2 minimum, HSTS on the web. Pin the SPKI with 2 backup keys and a documented escape procedure (unpinning by forced update) [unsourced: MASTG NETWORK, to cite in phase 1].

### 2.8 GDPR (SEC-06, SEC-08)

**Classification.**
- Health data per WP29 (2015): "information about smoking and drinking habits", and "disease risk" includes "excessive alcohol consumption" [S51]. A BAC is "the actual physiological or biomedical state" [S51].
- CNIL: data become health data "par croisement", for example weight combined with other data [S52].
- The CJEU reads art. 9 broadly (C-184/20, 1 August 2022): data that indirectly reveal a special category are covered [S57].
- Conclusion: drinks, BAC, records, weight + sex = art. 9 data. Precise location = high-risk data, consent required (WP185 cited in [S51]).

**Domestic exception.** If the processing stays on the device and nothing leaves it, GDPR does not apply to that processing [S51]. **Recommended design:** BAC computed on the device, server-side storage of drinks only when the user shares with their crew, and a "local only" mode. This shrinks what falls under art. 9 on the server.

**Concrete deliverables.**

| Deliverable | Basis | Content / when |
|---|---|---|
| Processing register | Art. 30. The under-250 exemption does not apply to art. 9 data [S56] | Phase 1, before the first piece of personal data. One line per purpose (account, BAC, drinks shared with crew, leaderboards, location/radar, check-ins/anti-cheat, SOS, chats, media/albums, pools/IBAN, community/reviews, moderation, AI-01/02/03, push, technical logs, analytics) |
| DPIA | Art. 35(3)(b) large-scale special categories, art. 35(4) CNIL list: "large-scale location data", e.g. a "mobile app collecting users' geolocation" [S53][S56] | Before the first public build. Minimum contents per art. 35(7): description, necessity/proportionality, risks, measures [S56]. Living document in `docs/privacy/DPIA.md` |
| Consents | Art. 9(2)(a) explicit consent "for one or more specified purposes" [S56]. CNIL mobile recommendations 2024/2025: information at the right moment, refusal as easy as acceptance [S55] | Separate screens, no pre-ticked boxes, withdrawable in Settings: (1) server storage of health data, (2) sharing drinks/BAC with the crew, (3) drinking leaderboard, (4) live location per party, (5) analytics, (6) AI features per crew, (7) optional photo check-in |
| DPO | Art. 37(1)(c): mandatory if the core activity is large-scale special-category data [S56] | Not "large scale" for one crew. Re-assess before the public release (10k users). Name a privacy contact now |
| Data subject rights | Art. 12(3): one month, extendable by 2 months with notice [S56] | Export N-17 and deletion O-07 automated and immediate. Public promise: "erased now, backups within 35 days" |
| Processor contracts | Art. 28 [unsourced: article not re-read] | Host, KMS, object storage, email, APNs/FCM, AI provider, crash reporting. Transfers outside the EU: APNs/FCM receive only tokens and opaque payloads |
| Breach procedure | Art. 33/34 [unsourced] | 72 h to the CNIL. Runbook in `SECURITY.md` |
| Apple health rules | 5.1.3(i) no ad or data-mining use. 5.1.3(ii) no personal health information in iCloud [S33] | No ad SDK touching these data. iCloud backup exclusions |

**Proposed retention table (to put in `SECURITY.md`).**

| Data | Retention | Mechanism |
|---|---|---|
| Live location points (N-07) | Until the recap is generated, at most 24 h after the party ends | Purge job + per-party DEK destroyed |
| Raw GPS of a check-in | Until the verdict (AC-06), at most 7 days if peer review is pending | Only venue + verdict + risk score kept |
| Drinks / BAC (server, if shared) | As long as the account exists, user can delete per night or all | Per-user DEK |
| Chat ciphertext on the server | Until fetched by every device, at most 30 days | DS purge |
| Encrypted chat media | Until deleted by sender/conversation, at most 30 days after the last device fetched it, except albums the user chose to keep | Object lifecycle |
| Server backup of the user's MSG-08 archive | Until replaced or deleted; deleted with the account | Blob delete |
| Technical logs (no personal data) | 14 days | Log rotation, IP truncated |
| Security logs (sign-ins, sessions) | 6 months | Proposal aligned with CNIL practice [unsourced] |
| Moderation reports (MSG-07) | 12 months after the case closes | Dedicated table |
| Deleted account | Immediate in production; DB backups ≤ 35 days; per-user DEK destroyed immediately | Crypto-shredding |
| Leftover anti-cheat data (cheat attempts AC-09) | 12 months | Purge |

### 2.9 Export compliance (SEC-10)

**United States (EAR).**
- Every App Store build goes up to US servers, so the app is subject to US export rules wherever the developer is based [S28].
- An app that bundles standard algorithms (MLS: X25519, AES-GCM, Ed25519) for confidentiality = mass-market item **5D992.c** under §740.17(b)(1), self-classified [S62][S63].
- Since 29 March 2021, the self-classification report is no longer required for most mass-market items. It stays for some components/executable software [S61][S63].
- Apple still writes that the developer "might" have to file a year-end self-classification report [S28]. To settle with counsel (A-SEC-8). Cheap defensive option: file the report before 1 February of each year.
- No CCATS, because proprietary algorithms are not used [S31].

**App Store Connect.**
- `ITSAppUsesNonExemptEncryption = YES`, because a library performs encryption beyond the OS [S29][S28].
- Row "industry standard algorithm not provided within the Apple operating system": **upload the French encryption declaration**, required only if distributed in France [S31].
- Apple reviews in about 2 business days, then provides a key to put in `ITSEncryptionExportComplianceCode` [S32][S29].

**France (LCEN art. 30, décret 2007-663).**
- The supply of a cryptology means that does not provide only authentication or integrity is subject to **prior declaration** [S58 art. 3 1°]. Our case (confidentiality) is not in the exemptions of Annex 1 [S58].
- File it **at least one month before** the operation. After one month of silence the supply is allowed. ANSSI may issue an attestation [S58 art. 4-5].
- ANSSI may ask for technical characteristics and **source code** within one year [S58 art. 7].
- The supplier's declaration also covers distributing intermediaries (stores) [S58 art. 6].
- Procedure: online form "Déclaration relative à un moyen de cryptologie" on demarche.numerique.gouv.fr (FranceConnect for individuals). Documents: Kbis or equivalent, company presentation, commercial and technical brochures, user manual if any. Contact controle@ssi.gouv.fr [S59].
- Observed timeline: about 2 months for Cryptomator in 2016 [S60]. Debian received an ANSSI attestation in 2011 [S66].
- Export outside the EU of "grand public" means: classification requested at the time of declaration (Annex 2, cat. 3 [S58]).

**Google Play:** no upload, but the same legal obligations [unsourced].

**Sequence before the first public build:**
1. Write the technical classification memo (algorithms, libraries, versions, key lengths).
2. File the ANSSI declaration (D-30 minimum, plan D-60).
3. Upload the attestation to App Store Connect and get the key.
4. Set the Info.plist keys.
5. Record the US decision (5D992.c + report or not).

### 2.10 STRIDE threat model outline (SEC-09)

One table per feature in `SECURITY.md`. The key threats to cover first:

| Feature | S (spoofing) | T (tampering) | R (repudiation) | I (disclosure) | D (denial of service) | E (elevation) |
|---|---|---|---|---|---|---|
| Auth / sessions | Phishing, stolen session | Replayed refresh token | Contested sign-in | Account enumeration through sign-in/recovery | OTP bombing | Takeover through weak recovery |
| Profiles / visibility (PROF-08) | Fake profile | Mass-assignment `role`, `verified` | n/a | Field returned to an unauthorised audience, blocked user sees content | Scraping | BOLA on another user's profile |
| BAC / drinks | Drinks logged for someone else | Forged events (AC-07) | "That wasn't me" | Health data leak (art. 9) | Bursts | Leaderboard write |
| Location / radar / check-ins | Mock location (AC-02) | Replay (AC-08) | n/a | Live location leaked to a stranger, routine readable from history | n/a | Access to another party's points |
| Safety (SOS, home safe) | Fake SOS | n/a | Disputed alert | SOS location exposed outside the crew | SOS blocked by rate limits (must never be throttled) | n/a |
| Messaging (MLS) | Device added by the server (MSG-05) | Reordered/forked commits | Message authenticity (MLS signatures) | Metadata (who talks to whom, when), push content | Group with conflicting commits | Unauthorised member (Add without rights) |
| Media / albums | n/a | Swapped blob (hash in message) | n/a | Guessable URL, EXIF GPS | Mass upload | n/a |
| Pools / IBAN | Fake creditor | Amount changed | Disputed payment | IBAN visible outside the pool | n/a | Self-promotion to treasurer |
| AI features | n/a | Prompt injection via free text | n/a | Data sent to the provider beyond the minimum | Cost explosion (API4) | Model triggering an action without confirmation |
| Community / reviews | Fake reviews | n/a | n/a | Presence inferred by aggregation (COM-06) | Spam | n/a |
| Push | n/a | n/a | n/a | Content/names in clear at Apple/Google | Push flood | n/a |
| Moderation (MSG-07) | Fabricated report (counter: MLS signature) | n/a | n/a | Moderator abuse | n/a | Moderator access beyond the case |

### 2.11 CI security tooling (SEC-09)

| Need | Tool | Licence | Notes |
|---|---|---|---|
| Secrets (pre-commit + CI) | gitleaks | MIT [S49] | Also on git history |
| Verified secrets | TruffleHog | AGPL-3.0 [S49] | Fine as a tool, unmodified |
| Native GitHub secrets | Secret scanning + push protection | Free for public repos, **paid (Secret Protection) for private repos** [S50] | Requires a Team/Enterprise plan to buy [S50] |
| Dependency SCA | OSV-Scanner (Apache-2.0), Trivy (Apache-2.0), Grype (Apache-2.0) [S49] | | npm, Cargo, Gradle, pub, SwiftPM |
| Dependency alerts | Dependabot | Alerts in every plan [S50] | Renovate as alternative (AGPL-3.0 [S49]) |
| SAST | Semgrep CE (LGPL-2.1 engine [S49]), CodeQL (free public, paid private [S50]) | Registry rule licences to check [unsourced] | Custom rules: no raw SQL, no `fetch` without auth, no plain logging of health fields |
| Rust (crypto core) | cargo-audit / cargo-deny (licences + advisories) | [unsourced: licences to check] | Blocks un-allowlisted licences (AGPL/GPL in the client) |
| Mobile binary | MobSF | GPL-3.0 [S49] | CI scan of IPA/APK, run as a tool |
| Licences | cargo-deny + a JS licence checker | | Policy: no GPL/AGPL in the client |

---

## 3. Decisions proposed

Traceability: each SEC and MSG ID has a recommendation.

| ID | Recommendation | Reason / source |
|---|---|---|
| SEC-01 | DTO per use case, generic errors, opaque IDs, no email/phone of others | API3/API9 [S45] |
| SEC-02 | Object + field checks in one server-side policy layer, allowlist on writes, generated audience-matrix tests | API1/API3/API5 [S45] |
| SEC-03 | TLS 1.3 (1.2 minimum), HSTS, SPKI pinning with 2 backup keys | MASVS-NETWORK [S46] |
| SEC-04 | Tink envelope encryption, EU KMS (host's KMS, else AWS eu-west-3 / GCP europe-west9), KEK per class, annual rotation, per-user DEK, HMAC blind index for email/phone | [S38][S39][S40][S43][S47][S48] |
| SEC-05 | Keychain/Keystore (no security-crypto), SQLCipher, iCloud/Google backup exclusion, app-switcher cover | [S36][S37][S33] |
| SEC-06 | Retention table 2.8. Location and raw GPS purged by job + per-party DEK destroyed | SEC-06, [S54] |
| SEC-07 | Passkeys + magic link + Google + Apple. Argon2id 19 MiB/t2/p1 if passwords. Rotating device-bound tokens, session list, new-device alert, rate limits, optional TOTP | [S33][S34][S35][S44] |
| SEC-08 | Art. 9 explicit consent per purpose, register, DPIA before public build, BAC on the device + "local only" mode, crypto-shredding, promise "backups ≤ 35 days" | [S51][S52][S53][S56] |
| SEC-09 | STRIDE 2.10 in `SECURITY.md`, CI 2.11, MAS-L2 + MAS-R + MAS-P profiles, external audit of `crew-crypto` before public release | [S46][S49][S50] |
| SEC-10 | ANSSI declaration D-60, App Store upload, US 5D992.c memo | [S28][S31][S58][S59][S62] |
| MSG-02 | **OpenMLS (MIT) for every conversation, 1:1 included.** One leaf per device, credentials signed by an account identity key, periodic self-updates for PCS. Fallback mls-rs. libsignal rejected (AGPL + "unsupported" + App Store). vodozemac rejected (no PCS in Megolm). Wire rejected (GPL) | [S1][S4][S5][S11][S13][S15][S16][S18][S19] |
| MSG-03 | AEAD key per file, hash in the MLS message, thumbnails/blurhash on the device, EXIF stripped | MSG-03 |
| MSG-04 | Generic payload + NSE decryption + cross-process lock. Filtering entitlement to request. FCM data message → visible notification | [S26][S27] |
| MSG-05 | 60-digit / QR fingerprint of the account keys. Notice on key change, not on new device | [S20] |
| MSG-06 | Timer in conversation state, local deletion + DS TTL 30 days | MSG-06 |
| MSG-07 | Plaintext report from the reporter's device, K messages of context, sender signature checkable | RFC 9420 [S18] (to confirm) |
| MSG-08 | Generated recovery key only (v1), archive on our server, never iCloud Drive. Warning copy before it matters | [S23][S24][S33] |
| MSG-09 | FTS5 in the encrypted local DB, zero chat content to AI | MSG-09 |

---

## 4. Assumptions

- **A-SEC-1**: OpenMLS 0.9.x builds and runs on iOS (arm64) and Android (arm64, armv7) in production. Basis: targets "built but not tested" in CI [S5]. Verify with a spike: `crew-crypto` crate + UniFFI + 2 devices + NSE, before the ADR is final.
- **A-SEC-2**: no public full audit of OpenMLS exists. Basis: nothing found [S5][S8]. Only an NCC review of libxmtp [S10]. Verify: ask the maintainers (Phoenix R&D / CE Labs) and budget an external audit of our integration.
- **A-SEC-3**: signing device credentials with an account identity key is a standard composition and safe within MLS. Basis: Sesame "per-user identity key" model [S20], RFC 9750 §3.7 [S19]. Verify: security reviewer + external cryptographer.
- **A-SEC-4**: running MLS decryption in the NSE (memory, time) is viable with a cross-process lock. Basis: NSE designed to "decrypt an encrypted data block" [S26]. Verify: phase 1 spike with memory measurements.
- **A-SEC-5**: Google deprioritises high-priority FCM messages that show no notification. Basis: none (page 404). Verify on firebase.google.com.
- **A-SEC-6**: crypto-shredding (destroying the per-user DEK) satisfies erasure in backups. Basis: no explicit EDPB/CNIL position found, and the CNIL points out how hard backup erasure is [S54]. Verify: CNIL guide / counsel.
- **A-SEC-7**: computing BAC on the device and only storing it on the server when shared reduces the scope of art. 9 on the server. Basis: WP29 domestic exception [S51]. Verify in the DPIA.
- **A-SEC-8**: no annual BIS self-classification report is owed for a mass-market 5D992.c app. Basis: 2021 rule [S61], (e)(3) text [S63]. Apple says "might" [S28]. Verify: BIS FAQ / counsel, or file defensively.
- **A-SEC-9**: the ANSSI declaration is needed before TestFlight external testing in France, not only before App Store release. Basis: Apple asks for the documentation "before submitting a build for review on either App Review or TestFlight App Review" [S32]. Verify in App Store Connect when setting up.
- **A-SEC-10**: integrating an E2EE library already declared by someone else does not exempt us. Basis: the decree's declaration applies to each supplier [S58]. No ANSSI FAQ read (anti-bot block). Verify with controle@ssi.gouv.fr.
- **A-SEC-11**: Supabase Auth passkeys are not production-ready in October 2026. Basis: absent from MFA docs [S64], open bug [S65]. Verify at the Architect's stack choice.
- **A-SEC-12**: op-sqlite supports SQLCipher. Basis: none re-read this session. Verify in op-sqlite docs.

---

## 5. Scope changes

- **Change MSG-02**: replace "the Signal protocol (libsignal) for one-to-one chats, MLS (RFC 9420) or the Signal group scheme for group chats" with "MLS (RFC 9420) through a vetted, permissively licensed implementation (OpenMLS by default) for every conversation, 1:1 included". Reason: AGPL-3.0, no support outside Signal, App Store conflict [S1][S4].
- **Change SEC-09**: "OWASP MASVS L2" → "OWASP MASVS v2 with MAS-L2, MAS-R and MAS-P profiles". Reason: levels now live in "MAS Profiles" [S46].
- **New SEC-11 [P0] BAC on the device**: BAC computed on the device. Drinks, weight and sex stored on the server only when the user shares with their crew, with a "local only" mode. Reason: limits art. 9 data on the server [S51].
- **New SEC-12 [P0] No health data in iCloud**: local DB and backups excluded from iCloud. MSG-08 archive never in iCloud Drive. Reason: guideline 5.1.3(ii) [S33].
- **New SEC-13 [P0] Export compliance file**: classification memo, ANSSI declaration, App Store key, annual review. Reason: [S31][S58]. (Can be merged into SEC-10.)
- **New SEC-14 [P1] External audit of `crew-crypto`** before the public release. Reason: A-SEC-2.
- **New MSG-11 [P1] Linking a new device**: QR from an existing device, new-device notice, explanation that history does not follow without a backup. Reason: RFC 9750 §6.7 [S19].
- **Clarify MSG-08**: "recovery key or passphrase" → "generated recovery key; passphrase only once a server-side attempt limit exists". Reason: offline brute force [S24][S25].

---

## 6. Glossary additions

| English term | French UI term | Definition |
|---|---|---|
| End-to-end encryption | Chiffrement de bout en bout | Only the participants' devices can read the messages |
| Safety number | Code de sécurité | Fingerprint compared to check a contact's identity (MSG-05) |
| Recovery key | Clé de récupération | Generated key that unlocks the chat backup (MSG-08) |
| Linked device | Appareil associé | A user's extra phone or tablet, with its own keys |
| Disappearing messages | Messages éphémères | Messages deleted automatically after a delay |
| Key change notice | Avertissement de changement de clé | System message when a contact's key changes |
| Crypto-shredding | (internal) | Erasure by destroying the key that encrypts the data |
| Blind index | (internal) | One-way keyed hash used to search an encrypted field |
| Delivery Service | (internal) | Server that orders and relays MLS messages without reading them |
| Explicit consent | Consentement explicite | Consent given by a specific positive act for health data |
| Local only mode | Mode local uniquement | BAC and drinks stay on the phone |

---

## 7. Blockers (need the user)

1. **Legal entity.** Apple 5.1.1(ix): apps that require sensitive information "should be submitted by a legal entity" [S33]. The ANSSI declaration asks for a Kbis or equivalent (FranceConnect possible for an individual) [S59]. Decide: company (SAS/micro-enterprise) or individual, and whose Apple/Google developer account.
2. **ANSSI declaration** to be filed by the user (signatory = supplier) at least one month before French distribution, and probably before French external TestFlight [S58][S32].
3. **Licence choice.** Confirm the client stays closed or permissive. If the user wants a fully open AGPL app, libsignal becomes possible again (but App Store risk [S4]).
4. **KMS host and budget**: account with the provider chosen by the Architect (EU), cost per key around $0.06 to $1 per month depending on provider [S38][S42].
5. **Apple filtering entitlement** (`usernotifications.filtering`) to request from Apple once the developer account exists [S27].
6. **External audit budget** for `crew-crypto` before the public release (A-SEC-2).
7. **Privacy contact / DPO**: person named in the privacy policy and the register.

---

## 8. Sources (all read 2026-10-26)

- [S1] https://github.com/signalapp/libsignal: AGPLv3, Java/Swift/TypeScript, "Use outside of Signal is unsupported".
- [S2] https://registry.npmjs.org/@signalapp/libsignal-client: 0.106.0, 2026-10-23, AGPL-3.0-only.
- [S3] https://api.github.com/repos/signalapp/libsignal/releases: v0.106.0 2026-10-23.
- [S4] https://www.fsf.org/news/2010-05-app-store-compliance: GPL vs App Store (2010-05-25).
- [S5] https://github.com/openmls/openmls: MIT, CI targets.
- [S6] https://crates.io/api/v1/crates/openmls: 0.9.2, updated 2026-10-22.
- [S7] https://raw.githubusercontent.com/openmls/openmls/main/CHANGELOG.md and https://api.github.com/repos/openmls/openmls/releases: advisories, virtual-clients-draft, v0.9.0 2026-08-25.
- [S8] https://book.openmls.tech/: ciphersuites, crypto providers, sqlite-provider.
- [S9] https://advisories.gitlab.com/pkg/cargo/openmls/GHSA-qr9h-x63w-vqfm/: secret-tree advisory, fixed in 0.7.1 (via search result).
- [S10] https://www.nccgroup.com/research/public-report-xmtp-mls-implementation-review/: NCC review of libxmtp, which is built on OpenMLS (via search result).
- [S11] https://github.com/awslabs/mls-rs: Apache-2.0 OR MIT, no full third-party audit.
- [S12] https://crates.io/api/v1/crates/mls-rs and https://crates.io/api/v1/crates/mls-rs-uniffi: 0.56.0 (2026-08-19), uniffi 0.1.0 (2024-03-26).
- [S13] https://github.com/matrix-org/vodozemac: Apache-2.0, Least Authority audit, 0.11.1.
- [S14] https://matrix.org/blog/2024/08/libolm-deprecation/: libolm deprecated (via search result).
- [S15] https://gitlab.matrix.org/matrix-org/olm/-/raw/master/docs/megolm.md: lack of backward secrecy, partial FS.
- [S16] https://github.com/wireapp/core-crypto: GPL-3.0.
- [S17] https://github.com/xmtp/libxmtp: MIT, Swift/Kotlin SDKs.
- [S18] https://www.rfc-editor.org/info/rfc9420: MLS, Proposed Standard, 2023.
- [S19] https://www.rfc-editor.org/info/rfc9750: MLS Architecture, §3.7, §6.1, §6.7, §8.2.4.
- [S20] https://signal.org/docs/specifications/sesame/: Sesame rev. 2, 2017-04-14.
- [S21] https://signal.org/blog/spqr/: SPQR, 2025-10-02 (via search result).
- [S22] https://signal.org/blog/signal-private-group-system/: 2019-12-09.
- [S23] https://support.signal.org/hc/en-us/articles/9708267671322-Signal-Secure-Backup: 64-character key (via search result, page 403 on direct fetch); https://betanews.com/2025/09/09/secure-messaging-platform-signal-introduces-chat-backup-options/
- [S24] https://engineering.fb.com/2026/05/01/security/meta-strengthening-end-to-end-encrypted-backups/: HSM Backup Key Vault, 2026-05-01.
- [S25] https://usenix.org/conference/osdi24/presentation/connell: SVR3, OSDI 2024 (via search result).
- [S26] https://developer.apple.com/documentation/usernotifications/unnotificationserviceextension (JSON version).
- [S27] https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.filtering
- [S28] https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations
- [S29] https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption
- [S30] https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance: France: Secure Communications controlled.
- [S31] https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption: documentation table.
- [S32] https://developer.apple.com/help/app-store-connect/manage-app-information/determine-and-upload-app-encryption-documentation
- [S33] https://developer.apple.com/app-store/review/guidelines/: 4.8, 5.1.1(v), 5.1.1(ix), 5.1.3.
- [S34] https://developer.apple.com/documentation/authenticationservices/supporting-passkeys (JSON version).
- [S35] https://developer.android.com/identity/sign-in/credential-manager: updated 2026-05-13.
- [S36] https://developer.android.com/privacy-and-security/keystore: updated 2026-10-23.
- [S37] https://developer.android.com/jetpack/androidx/releases/security: security-crypto deprecated, 1.1.0 2025-07-30.
- [S38] https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html
- [S39] https://docs.aws.amazon.com/general/latest/gr/kms.html: eu-west-3 Paris, on-demand rotation quota 25.
- [S40] https://docs.cloud.google.com/kms/docs/locations: europe-west9 Paris, Cloud HSM.
- [S41] https://www.scaleway.com/en/docs/key-manager/: data encryption keys, rotation, ML-KEM 2026.
- [S42] https://www.ovhcloud.com/en/identity-security-operations/key-management-service/: price, FIPS 140-3.
- [S43] https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
- [S44] https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- [S45] https://api-security.owasp.org/editions/2023/en/0x11-t10
- [S46] https://mas.owasp.org/MASVS/, https://api.github.com/repos/OWASP/masvs/releases (v2.1.0, 2024-01-18), https://raw.githubusercontent.com/OWASP/masvs/master/Document/03-Using_the_MASVS.md (MAS Profiles).
- [S47] https://ciphersweet.paragonie.com/security: blind indexes. Licence ISC (https://raw.githubusercontent.com/paragonie/ciphersweet/master/LICENSE).
- [S48] https://developers.google.com/tink/deterministic-aead
- [S49] GitHub REST API `https://api.github.com/repos/<owner>/<repo>` (licence, activity) for: sqlcipher/sqlcipher, OP-Engineering/op-sqlite, simolus3/drift, realm/realm-swift, gitleaks/gitleaks, trufflesecurity/trufflehog, semgrep/semgrep, github/codeql, google/osv-scanner, aquasecurity/trivy, anchore/grype, renovatebot/renovate, MobSF/Mobile-Security-Framework-MobSF, tink-crypto/tink-go, tink-crypto/tink-java, jedisct1/libsodium, matrix-org/matrix-rust-sdk, mozilla/uniffi-rs, djx-y-z/openmls_dart, ory/kratos, keycloak/keycloak, teamhanko/hanko, MasterKale/SimpleWebAuthn, better-auth/better-auth, zitadel/zitadel, go-webauthn/webauthn, supabase/auth.
- [S50] https://docs.github.com/en/get-started/learning-about-github/about-github-advanced-security
- [S51] https://ec.europa.eu/justice/article-29/documentation/other-document/files/2015/20150205_letter_art29wp_ec_health_data_after_plenary_annex_en.pdf: WP29, annex on health data in apps, 2015-02-05.
- [S52] https://www.cnil.fr/fr/quest-ce-ce-quune-donnee-de-sante: 2018-01-08.
- [S53] https://www.cnil.fr/sites/default/files/atoms/files/liste-traitements-avec-aipd-requise-v2.pdf: deliberation 2018-327.
- [S54] https://www.cnil.fr/fr/node/168190: right-to-erasure coordinated action, 2026-02-18.
- [S55] https://www.cnil.fr/fr/applications-mobiles-la-cnil-publie-ses-recommandations-pour-mieux-proteger-la-vie-privee: 2024-09-24, updated 2025-04-08.
- [S56] https://gdpr-info.eu/art-9-gdpr/, https://gdpr-info.eu/art-12-gdpr/, https://gdpr-info.eu/art-30-gdpr/, https://gdpr-info.eu/art-35-gdpr/, https://gdpr-info.eu/art-37-gdpr/ (EUR-Lex unreachable from the tool).
- [S57] https://www.insideprivacy.com/eu-data-protection/special-category-data-by-inference-cjeu-significantly-expands-the-scope-of-article-9-gdpr/: C-184/20, 2022-08-01 (via search result).
- [S58] https://www.arcep.fr/fileadmin/reprise/textes/decrets/d2007-663.pdf: décret 2007-663, JO of 2007-05-04 (original text; consolidated version on Légifrance to check).
- [S59] https://demarche.numerique.gouv.fr/commencer/declaration-relative-a-un-moyen-de-cryptologie
- [S60] https://cryptomator.org/blog/2016/06/16/indepth-french-app-store/
- [S61] https://www.thompsonhine.com/publications/bis-eliminates-most-mass-market-encryption-reporting-obligations: 2021-04-09.
- [S62] https://www.bis.gov/learn-support/encryption-controls/mass-market
- [S63] https://www.law.cornell.edu/cfr/text/15/740.17
- [S64] https://supabase.com/docs/guides/auth/auth-mfa
- [S65] https://github.com/supabase/auth/issues/2732, https://github.com/supabase/auth/pull/2827 (via GitHub search API).
- [S66] https://www.debian.org/legal/anssi.fr.html: ANSSI attestation, 2011-01-20.
- [S66b] https://clerk.com/docs/guides/development/custom-flows/authentication/passkeys
- [S67] npm registry: @op-engineering/op-sqlite 18.2.5 (2026-09-20, MIT), @xmtp/react-native-sdk 5.7.0 (MIT), react-native-quick-crypto 1.1.8 (MIT), react-native-mmkv 4.3.2 (MIT), uniffi-bindgen-react-native 0.31.0-6 (2026-09-25, MPL-2.0), @matrix-org/matrix-sdk-crypto-wasm 18.9.0 (Apache-2.0). pub.dev openmls 3.2.1 (2026-09-29).

Sources tried but not usable: the ANSSI site cyber.gouv.fr (anti-bot block), EUR-Lex (empty page), gnu.org AGPL (HTTP 429), Firebase FCM priority page (404), the BIS encryption FAQ (empty content).
