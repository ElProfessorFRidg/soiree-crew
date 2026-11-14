# Public access, caches and request budgets

Guests keep their drinks, water and health profile on their device. Browsing public places does not create an account, upload these records or attach a guest to another identity. Anonymous mutations remain unauthorized. Signing in uses the existing ordered, idempotent sync flow.

On a server configured with `PUBLIC_SERVER=true`, `GET /v1/places` and `GET /v1/places/:id` also work without authentication. Private servers keep these routes closed. Invalid credentials return 401 rather than silently selecting an anonymous representation. Homes are excluded by the existing place lookup. Public/anonymous reviews, their review photos, hours and aggregated statistics remain visible independently of the current account. Friends-only reviews, personal flags, private albums and exact personal visit history do not become public.

Anonymous place pages use a bounded 200-entry in-process cache for 15 seconds. Concurrent reads share the same work. Successful writes clear the cache, including moderation and review-audience changes; an older in-flight read cannot repopulate it. Authenticated pages bypass this cache. HTTP responses use `no-store` to avoid a shared proxy mixing anonymous and personalized responses. The client additionally coalesces explicitly anonymous public reads for 10 seconds, with at most 100 server/path keys. It stores neither tokens nor personalized pages in that cache. Pull-to-refresh can bypass it. Public content remains in the database when the viewer signs out or changes account.

Request budgets use bounded in-memory token buckets, scoped to this server process:

| Budget | Initial burst | Refill per minute |
| --- | ---: | ---: |
| Network ceiling, before authentication | 2400 | 12000 |
| Guest per IP | 180 | 600 |
| Invalid token per IP | 60 | 120 |
| Signed media per network | 600 | 1800 |
| Verified account reads | 180 | 600 |
| Verified account writes | 120 | 240 |
| Safety writes per verified account | 20 | 20 |
| Mutation events per account, counting batch items | 200 | 600 |
| Account creation per network | 30 | 3 |
| Password requests per network | 60 | 6 |

Existing stricter checks for passwords, transfers, photos, reviews and other costly actions still apply. A valid account never spends the guest/invalid-token budgets. Changing a session token does not reset the account quota. Read, write and safety budgets are separate, so a normal backlog of writes does not consume the SOS allowance. The network ceiling accommodates many devices on a shared Wi-Fi. Forwarded addresses are trusted only according to the existing `TRUST_PROXY` configuration; do not expose a proxy-trusting API port directly to the Internet.

A discovery search costs ten read tokens and a detailed place page costs three; ordinary reads cost one. Batch mutation requests additionally spend one event token per item, so combining a hundred writes into one HTTP request does not bypass the event quota.

429 responses include `Retry-After` and expose it through CORS. The app backs off within the affected read/write/safety scope. Sync keeps the pending mutation and its idempotency key, and schedules retries no earlier than the server's deadline. It does not replay writes automatically inside the HTTP client.

These quotas and caches are process-local. Multiple replicas each have their own budgets; a deployment requiring fleet-wide quotas needs a shared store at the proxy or application layer. These limits complement the existing anticheat checks rather than defining whether a logged drink is valid.
