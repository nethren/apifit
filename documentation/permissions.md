# Permissions and data handling

## Access and session boundaries

Local mode trusts a user on the same machine, not hostile local processes. It
binds to loopback, checks Host and rejects cross-origin browser requests.

Hosted mode requires HTTPS ingress and exact public Host/Origin matching.
Forwarded headers are not trusted. JSON writes and same-origin mutation checks
limit browser cross-site requests. The owner selected explicit public access;
there is no login or identity claim in that mode. An optional password mode
uses native Basic Auth, username `apifit`, on every non-health request.

A Secure, HttpOnly, SameSite=Strict cookie identifies each 15-minute session.
Records are owner-scoped: knowing another visitor's record ID does not grant
access. Tabs sharing a cookie share the backend session. Clearing one session
cancels its own work, not another visitor's work. Closing a tab does not erase
server memory immediately; expiry or shutdown does.

In password mode, the password is shared rather than individual authentication.
Browsers may cache Basic Auth until closed; there is no app logout. Rotate the
secret and restart to revoke access. In public mode the cookie is an anonymous
record-isolation boundary, not proof of a unique person.

## What is stored or sent

| Data | Boundary |
| --- | --- |
| Requests, analyses and briefs | Bounded process memory; 15-minute expiry; no application text logging |
| Shortlist and displayed summaries | Tab memory until cleared/reloaded |
| Appearance preference | Browser local storage; no project text or credentials |
| Public directory index | Data directory/persistent volume; public metadata only |
| Cost ledger | Durable private directory; cumulative cost units, not prompts or keys |
| Operator credential | Keychain locally; backend runtime secret when hosted |
| AI input | Request and selected public evidence sent to Anthropic after opt-in |

APIFit's memory policy does not control Anthropic retention or infrastructure
logs. Consult the provider's current policy before entering sensitive material.
Keep private/signed URLs, personal information and credentials out of inputs.
Do not log authorization, cookies or request bodies at the ingress. Do not add
session replay or request-body telemetry by default.

## Public AI and resource limits

Public visitors share one operator-funded allowance. They can consume the
remaining approved budget; a new cookie does not create a new cost allowance.
Session-level quotas improve fairness but can be bypassed by resetting cookies.
The durable global ledger, actual socket-peer quota, global API limit and bounded
concurrency remain the stronger limits. A motivated visitor can still exhaust
the allowance or capacity: cost controls do not promise availability.

Behind a reverse proxy, the socket-peer quota is shared. Add ingress controls
rather than trusting arbitrary `X-Forwarded-For`. Hosting traffic and provider
account activity outside this application are not covered by the app's ledger.
There is no production load-test or high-availability claim.

Public source retrieval remains an outbound network capability. Preserve the
safe-fetch boundary and block direct internet access to the backend port.
Directory metadata and source citations do not verify provider identity, uptime,
operational behaviour or account permissions.
