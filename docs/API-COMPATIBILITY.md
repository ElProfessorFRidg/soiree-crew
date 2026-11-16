# API compatibility and older IPA builds

Historical Public and Preview IPA downloads stay available in the AltStore source. Installing an older binary does not promise that every future server function has the same contract. The API can explain a change for one endpoint without locking the whole app.

By default `API_COMPATIBILITY` is unset: existing endpoints keep accepting historical clients. Add a rule only when that endpoint actually changes. Deploy this server code before configuring rules. Docker Compose forwards both variables below; restart/redeploy the server after a configuration change.

```env
API_COMPATIBILITY={"GET /v1/places":{"minimumBuild":120,"webFallback":true},"GET /v1/retired-feature/:id":{"state":"retired"}}
WEB_APP_URL=https://crew.example.com
```

`120` is an illustrative minimum build, not an enabled policy. Do not copy a minimum for a change that is still backward compatible. Rule keys use the HTTP method and canonical `/v1/…/:id` route. At most 100 rules are allowed. Invalid rules fail startup rather than silently disabling protection.

| Rule | Response | Meaning |
|---|---|---|
| `minimumBuild` | 426 `client_update_required` | This native feature requires a newer build. No build information counts as an older build. |
| `minimumApiVersion` | 426 `client_update_required` | This feature needs a newer API contract on native and web clients. |
| `state: "unavailable"` | 503 `feature_unavailable`, `Retry-After: 30` | Temporary outage. |
| `state: "retired"` | 410 `feature_removed` | Removed feature, including an endpoint no longer registered in the server. |

Responses carry a fixed human-readable `message` and structured `compatibility` metadata (`reason`, `apiVersion`, applicable minimums, optional `webUrl`). An unknown authenticated `/v1/` endpoint returns 404 `api_endpoint_unavailable` with metadata. A missing venue or inaccessible private resource still returns the normal `not_found`; authentication refusals remain 401. Authentication and rate limits run before compatibility checks. Client version claims never grant access.

The app sends `Accept: application/json; crew-api=1; crew-build=…; crew-client=ios|android|web`. These non-secret media parameters remain CORS-safelisted, including when the app talks to an older server. Web clients do not use native build numbers; they still obey API contract rules. `/v1/info` advertises the server API version and support for compatibility messages. Authentication, server discovery, health and emergency endpoints cannot be disabled through compatibility rules.

## Messages and web alternatives

The app translates known compatibility reasons, with an Install action for update-required failures. A web build offers Reload. Missing or retired server functions explain the server limitation without pretending that an app update necessarily fixes it. Malformed/HTML API responses and older Fastify missing-route responses also get a compatibility message. Ordinary missing resources keep their normal message.

A web action requires both `webFallback: true` and an explicit `WEB_APP_URL` HTTPS origin. It is allowed only for `GET /v1/places`, `GET /v1/places/:id` (both open `/discover`), and `GET /v1/crews/open` (opens `/crew`). The client validates this again. The action opens the public website only when tapped. It carries no token, query parameters, coordinates, resource IDs, body, encryption keys or local health data. An API hostname alone does not imply a web app exists. Writes, chat, authentication, SOS and local core components never use a web fallback. No executable component or replacement JavaScript is downloaded.

Compatibility notices are deduplicated for five minutes and do not block navigation or local screens. The failing endpoint is cooled down for five minutes (temporary outages respect `Retry-After`, with a 30-second minimum). Unrelated API functions stay available. Safety actions can be retried immediately after a malformed proxy response; they do not enter the feature compatibility cooldown. Their server-side safety quotas still apply. Ordinary 429 responses retain their actual `Retry-After` delay in the translated message.

## Local data and queued writes

Profile, drinks, history and local calculations stay bundled and usable offline. Continuing without an account keeps using `LocalTransport`, without posting these entries to an unassociated server identity. A signed-in write refused for compatibility remains in the outbox with its original idempotency key; it is not rolled back or discarded as invalid. Background sync retries with a delay and can resume when the app/server becomes compatible. Opening a public website does not replay the write or upload pending data there.

An IPA released before this mechanism cannot retroactively gain the new translated messages or actions. It may show its existing generic error, even though the new server sends an explanatory response. This mechanism is for builds containing the new client handling and is separate from the single downgrade switch documented in [AltStore distribution](ALTSTORE.md).
