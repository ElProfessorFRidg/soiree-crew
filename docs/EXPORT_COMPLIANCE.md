# Export compliance (SEC-13)

Working memo for the publisher, to be checked by someone qualified before a public release. It says what cryptography the app and its server use, and which declarations that seems to call for.

## What uses cryptography

| Where | What | Why |
|---|---|---|
| App | HTTPS (TLS) through the operating system's own network stack | Talking to the crew's server |
| App | SHA-256 and random identifiers from the OS (`expo-crypto`) | Ids, never secrecy |
| App | MLS (RFC 9420) via ts-mls, with X25519, AES-128-GCM, SHA-256 and Ed25519 from the noble libraries (ADR 0005) | End-to-end encrypted chats (MSG-02) |
| App | AES-256-GCM per file, and for the optional history backup under a 160-bit recovery key | Chat media and backup (MSG-03, MSG-08) |
| Server | AES-256-GCM sealing of health and payment fields, key in `DATA_KEY` | Data at rest (SEC-04) |
| Server | SHA-256 token hashes, HMAC-SHA256 for signed photo links and email lookup, scrypt password hashes | Authentication and integrity |
| Server | TLS, terminated by the host (Coolify / reverse proxy) | Transport |

No custom algorithm. End-to-end encrypted messaging (MSG-02) now ships inside the app as a JavaScript library: encryption is a user-facing feature (private chats), so the app is no longer in the "OS encryption only" case.

## App stores

- iOS: the app now ships its own encryption (MLS, standard algorithms only). Before an App Store release, `ITSAppUsesNonExemptEncryption` must be revisited: standard algorithms in a mass-market messaging app usually fall under the exemption for "standard encryption" with a self-classification report to the US BIS once a year, and the App Store Connect questionnaire must be answered accordingly. It stays `false` in `app.json` for the current private builds, which are not distributed through the store.
- Google Play: the same answer in the Play Console export section.

## United States (EAR)

The app is mass-market software using standard, published encryption (MLS, AES, X25519, Ed25519) for private messaging, authentication and transport; that is the 5D992.c / mass-market case (License Exception ENC, 740.17(b)(1)), which for publicly available mass-market software usually means a self-classification report rather than a classification request. The server is self-hosted by each crew and not distributed by the publisher as a product.

## France (ANSSI)

The French rules on "moyens de cryptologie" exempt cryptology used only for authentication and integrity, and the use of encryption provided by the operating system. End-to-end encrypted chats provide confidentiality with the app's own library: distributing the app in France calls for a declaration to the ANSSI ("déclaration de fourniture d'un moyen de cryptologie"), mass-market messaging being the usual simplified case. The same applies to the server's at-rest sealing if the publisher distributes the server.

## To do before a public release

- Have this memo reviewed, and record the answers given in App Store Connect and the Play Console.
- File the ANSSI declaration and, for the App Store, the yearly BIS self-classification report, then set `ITSAppUsesNonExemptEncryption` to match.
