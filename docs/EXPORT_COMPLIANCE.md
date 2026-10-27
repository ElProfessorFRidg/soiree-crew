# Export compliance (SEC-13)

Working memo for the publisher, to be checked by someone qualified before a public release. It says what cryptography the app and its server use, and which declarations that seems to call for.

## What uses cryptography

| Where | What | Why |
|---|---|---|
| App | HTTPS (TLS) through the operating system's own network stack | Talking to the crew's server |
| App | SHA-256 and random identifiers from the OS (`expo-crypto`) | Ids, never secrecy |
| Server | AES-256-GCM sealing of health and payment fields, key in `DATA_KEY` | Data at rest (SEC-04) |
| Server | SHA-256 token hashes, HMAC-SHA256 for signed photo links and email lookup, scrypt password hashes | Authentication and integrity |
| Server | TLS, terminated by the host (Coolify / reverse proxy) | Transport |

No custom algorithm, no cryptography exposed as a feature to users. End-to-end encrypted messaging (MSG-02) is not built; when it is, this memo must be redone (a messaging library is a different case).

## App stores

- iOS: `ITSAppUsesNonExemptEncryption` is `false` in `app.json`. The app only uses encryption provided by iOS (HTTPS), which Apple's export questionnaire treats as exempt. Answer the questionnaire again if a crypto library ships in the app.
- Google Play: the same answer in the Play Console export section.

## United States (EAR)

The app is mass-market software using standard encryption for authentication and transport; that is the 5D992.c / mass-market case, with no classification request expected. The server is self-hosted by each crew and not distributed by the publisher as a product.

## France (ANSSI)

The French rules on "moyens de cryptologie" exempt cryptology used only for authentication and integrity, and the use of encryption provided by the operating system. The server's at-rest sealing is confidentiality: if the publisher distributes the server, check whether a declaration to the ANSSI applies (it usually does for providing, not for using, a means of cryptology).

## To do before a public release

- Have this memo reviewed, and record the answers given in App Store Connect and the Play Console.
- Redo it when MSG-02 ships.
