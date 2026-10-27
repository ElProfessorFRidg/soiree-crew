# Privacy: processing register and impact assessment (SEC-08)

Draft for the private build. A public release needs this reviewed by someone qualified, and the legal entity filled in.

## Controller

Not set yet: the private build runs on a server the crew hosts itself. Before any public release: legal entity, contact address, data protection officer if required.

## What is processed

| Data | Why | Where | Kept until |
| --- | --- | --- | --- |
| Username, display name | Sign in, show who is who in a crew | `users` | Account deletion |
| Weight, body model, height | BAC estimate | `body_profiles`, AES-256-GCM sealed | Account deletion |
| Drinks (volume, strength, time, with food), water | BAC estimate, history, leaderboards | `drinks`, `water`, sealed except kind and times | Account deletion, or deleting the drink |
| Preferences | Settings on every device | `user_preferences` | Account deletion |
| Crews, parties, responses, home-safe confirmations | Crew features | `crew_members`, `party_members` | Leaving the crew or account deletion |
| Check-ins | Territories, venue page | `check_ins`: verdict, signal names, a keyed hash of the fix; raw coordinates are never stored (SEC-06) | Account deletion |
| SOS alerts | Crew safety | `sos_alerts`, location sealed | Account deletion |
| Pools, expenses, repayments, IBAN | Splitting costs | `expenses`, `repayments`, `payment_details` (sealed) | Account deletion (expenses paid by others stay for them) |
| Session tokens | Staying signed in | `sessions`, SHA-256 hashes only | Sign-out or account deletion |
| Chat messages, photos, voice notes | Crew, party and friend chats (MSG-01) | `chat_messages`, `chat_blobs`: ciphertext only, the server cannot open it (ADR 0005) | The conversation's disappearing timer, else 30 days for messages and files, 90 days for group changes |
| Chat devices and keys | Adding each phone to its groups | `chat_devices` (public signature key), `chat_key_packages` (public, single use) | Public keys kept for checking old groups; packages until used |
| Chat membership metadata | Routing ciphertext | `conversations`, `conversation_devices`: who is in which chat, timer, order of messages | Leaving the crew, party or friendship; account deletion |
| Chat history backup (optional) | A new phone gets its history back (MSG-08) | `chat_backups` and a file, sealed with the user's recovery key only | Turning the backup off or account deletion |
| Reported chat messages | Moderation (MSG-07) | `reports.evidence`, sealed: the message and up to 3 around it, sent by the reporter's phone | Handled reports, then account deletion |

Alcohol consumption and BAC are treated as health data (GDPR article 9).

## Legal basis

Explicit consent (article 9(2)(a)), asked before any body or drink data is typed (onboarding, `app/onboarding.tsx`). The consent time is stored with the profile.

## Rights

- Access and portability: Me, Account, "Export my data" (`GET /v1/me/export`), JSON with everything decrypted.
- Erasure: Me, Account, "Delete my account" (`DELETE /v1/me`). Single drinks are removed from the history.
- Rectification: the profile and every setting can be edited.
- Objection to leaderboards and territories: per crew, in Settings.

## Backups

Database backups are the host's job. The stated delay for a deleted account to leave the backups: 30 days (assumption A-ORCH-8, to confirm with the host).

## Security measures

TLS in transit (the server sits behind HTTPS), health data sealed with AES-256-GCM under `DATA_KEY`, token hashes only, rate-limited sign-up and sign-in, sessions listed and revocable, the next-morning vault for irreversible actions.

## Third parties

- GitHub: once a day, when "Look for new versions" is on (default), the app fetches the latest release of the public repository to compare build numbers (O-12). The request carries no account, token or identifier; GitHub sees the phone's IP address like any web request. Off in Settings.

## Impact assessment, short form

- Risk: a crew member learns someone's drinking. Mitigation: BACs are shared only inside the crew and only during a party; leaving the leaderboard keeps everything else.
- Risk: server compromise exposes health data. Mitigation: sealed columns; the key is outside the database.
- Risk: location tracking. Mitigation: no continuous location; check-ins keep no coordinates; the radar shares a status, never a position.
- Residual risk: the crew admin who hosts the server holds `DATA_KEY`. Acceptable for a private build between friends; not for a public one.
