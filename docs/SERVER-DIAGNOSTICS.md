# Server status and support codes

Open **Settings → Server status** in the app. A failed manual server-address check also links here, including before onboarding or sign-in. The page shows the selected host and the build/channel in its copied report, so Public and Preview can be compared without assuming that they use different backends. Both published builds 117 and 120 were configured for the same server when this work was investigated.

The public checks send no account token or cookies:

- `/v1/health`: process liveness only;
- `/v1/info`: the public discovery contract, including the database-backed crew count;
- `/v1/ready`: database/schema readiness, available on updated servers.

A 200 from `health` does not mean the APIs work. In the reported deployment, DNS and TLS succeeded from the test environment and `health` returned 200, while `info`, open crews and username availability returned 500. That establishes a server-side failure for those requests; it does not rule out an additional DNS or network issue on a particular device. No production data was created, modified or deleted to perform these checks.

On iOS the optional local `CrewNetworkDiagnostics` module uses an ephemeral URLSession, normal TLS validation and a fixed allowlist of three public GET endpoints. It never accepts a credential, follows a redirect, or requests a private endpoint. It caps response bodies at 64 KiB, bounds requests to eight seconds, and reports the system's DNS/TLS/connectivity error codes and available DNS/TCP/TLS/first-byte timings. HTTP 4xx/5xx remain HTTP findings. Other platforms use a credential-free fetch fallback and explicitly state that its generic transport failures do not prove a DNS, TLS or internet outage.

## Authorize the one operator account

The detailed API inventory and read probes require server authorization. Being a crew admin, changing a local flag or supplying a username does not grant access.

1. Sign in to the intended account on the intended server.
2. On Server status, use **Copy my account ID**. This copies the account UUID, not its session token.
3. Set `OPERATOR_IDS=<that UUID>` in the backend's environment, with just that UUID if only this account should have access. `deploy/docker-compose.yml` already passes the variable to the server.
4. Redeploy the updated backend using the existing database, volumes and data key, then run the app's checks again. Installing a new IPA alone does not deploy backend routes.

The backend rechecks the authenticated account UUID on every `/v1/operator/diagnostics` request. Legacy `OPERATOR_USERNAMES` moderation access is insufficient for this feature. The lightweight `/v1/me/capabilities` permission check needs only the authentication tables, so a broken profile/photo endpoint does not prevent an authorized operator from inspecting other features. Complete database/authentication failure still prevents operator authentication; the public readiness and transport checks remain usable.

The operator catalog lists the actual registered methods and path templates, access level and configured compatibility state. It does not claim that registration proves correct execution. The app runs a fixed, audited set of GET checks against the current account: account details, own profile, crews, personal statistics, notification settings and sessions. It validates minimum response shapes and discards their personal contents. It does not turn URLs or arbitrary instructions returned by the catalog into authenticated requests. Write endpoints and resource-specific routes outside this set remain **Not tested**. Optional Apple/AI/APNs/FCM indicators mean configured, not tested end-to-end.

The inbox GET is deliberately excluded because it prunes old notifications. The diagnostic invokes no mutation, check-in, message, photo upload, push delivery or deletion endpoint. The usual session last-seen bookkeeping still applies to authenticated reads.

The operator endpoint has its own two-request burst/two-per-minute budget, in addition to normal account and network quotas. The app waits at least 30 seconds between runs and observes Retry-After. The readiness probe is globally coalesced and cached for five seconds, with a two-second response deadline. A hung underlying database query remains shared rather than accumulating new probes.

## Read a report

API errors display a stable support code. Updated servers attach a unique `x-crew-request-id` and `x-crew-diagnostic-code`; both are exposed through CORS. The request ID is also Fastify's log correlation ID. Database infrastructure/schema errors are classified at the database boundary; ordinary bad-input and constraint errors retain their existing behavior.

| Code | Observed category |
| --- | --- |
| `SC_CFG_01` / `SC_CFG_02` | No selected server / invalid or unsafe address |
| `SC_DNS_01` | iOS could not resolve/find the host (`-1003` / `-1006`) |
| `SC_TLS_01` / `SC_TLS_02` | TLS/certificate rejection / App Transport Security policy |
| `SC_NET_01` | iOS reports no available connection for this request; this does not prove a device-wide internet outage |
| `SC_NET_02` / `SC_NET_03` | Connection to host failed / connection lost |
| `SC_NET_04` | Transport failure whose cause is not exposed; DNS/TLS/CORS remain possibilities |
| `SC_NET_05` / `SC_NET_06` | OS data-access policy / cancelled request |
| `SC_TIMEOUT_01` | Request or body deadline exceeded |
| `SC_HTTP_<status>` | An HTTP response, including 401 session, 403 permission, 429 quota, or 5xx server/proxy failure |
| `SC_HTTP_REDIRECT` | Public probe redirected; the diagnostic did not follow it |
| `SC_DB_01` | Database connection, availability or connection-capacity failure |
| `SC_DB_02` | Missing schema/migrations or required database object |
| `SC_DB_03` | Database authentication/configuration failure |
| `SC_DB_04` / `SC_DB_05` / `SC_DB_99` | Database deadline / invalid database query / unclassified readiness failure |
| `SC_API_01` / `SC_API_02` | Unexpected response contract / API absent on this server |
| `SC_API_03` / `SC_API_04` / `SC_API_05` | Client update required / feature removed / temporarily unavailable |
| `SC_API_06` | Public response exceeds the diagnostic's body limit |
| `SC_NOT_RUN` / `SC_UNKNOWN` | Not executed / unclassified non-API failure |

Copy is available before the first check and during a run. If clipboard access fails, the page displays the same report as selectable text. The report contains selected origins, fixed feature/route identifiers, status/codes, timings and request references. It excludes session tokens, account IDs/names, request bodies, response contents and URL query strings. The server report includes up to 12 failures from the current process for the selected origin and account. Switching accounts, server or session hides the old operator view immediately and invalidates outstanding UI updates. Choosing another server never forwards the stored account token there by default.

**Settings → Version and updates → Diagnostic log** opens the device-local journal. A compatibility toast identifies the feature or route and, when it has no update or web action, opens the journal for that origin. The journal retains up to 60 API failures and 60 public probe results across app restarts. It filters API entries by origin and account and includes the observed response format, such as HTML, when available. On iOS it also shows the current and previous incomplete startup reports when available. Development builds print API failures and public probes to the console under `[SC_NETWORK]`.

CI checks native error classification and endpoint restrictions, typechecks the helpers for iOS 16.4, and launches the actual iPhone/iPad IPA against a loopback fixture with green liveness, HTTP 500 discovery and HTTP 503 readiness. Native logs and the server-status screenshot verify those distinct results. This complements the pre-JavaScript startup diagnostic and does not certify a physical jailbreak/installer configuration.
