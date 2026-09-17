# Deployment — public, single-instance app

The owner approved a public app with paid AI available and a public MIT source
repository. This is a preparation recipe, not an already deployed service.
Hosting and a domain are still to be chosen. The owner handles the demo; Postman
is out of scope. No additional spending allowance was approved.

## Host requirements

- Supported Node.js, version 22 or newer, or Docker support.
- One long-running process/replica with a writable persistent disk.
- HTTPS ingress preserving the public Host header; no direct public backend port.
- Runtime-secret storage and outbound public HTTPS/DNS access.

Client and API share one origin. Static-only hosting and ephemeral functions
are insufficient. Forwarded headers are not trusted. Configure ingress Host
preservation rather than disabling validation. Review the
[Node support schedule](https://github.com/nodejs/Release) and base image at each
release. The recipe uses Node 22.

## Build

```sh
npm ci --ignore-scripts
npm run repo:check
npm run check
docker build -t apifit:preview .
```

The allowlisted build context excludes secrets, local cost state, Git and private
evaluation output. The runtime image contains the built client, backend, shared
helpers and production dependencies, and runs as a non-root user. Never inject
secrets through build arguments or image layers.

Docker Engine must be running. If unavailable, record the check as unverified.
CI also builds the image; it does not publish or deploy it.

## Runtime setup

Configure the exact HTTPS origin, persistent directory and
`APIFIT_ACCESS_MODE=public` through the host's protected environment. See
[configuration and ledger migration](variables.md). The first infrastructure
smoke should use `APIFIT_AI_ENABLED=false`.

After that smoke, migrate the **existing** ledger under one process owner, add
the replacement Anthropic runtime secret, and set `APIFIT_AI_ENABLED=true`.
The app then offers paid AI after each tab's consent, subject to the remaining
shared allowance. Missing credentials or spending state fail closed. This is not
a budget reset, and a fresh deployment does not grant a fresh US$5.

For an operator-managed host, `compose.yaml` is an optional baseline. After
privately setting the environment:

```sh
docker compose up -d --build
```

Compose explicitly selects public mode, binds 8080 to host loopback, persists
`/data`, drops capabilities, uses a read-only root filesystem and limits resources.
AI remains off unless explicitly enabled. Never print rendered Compose settings
into public logs: they include the runtime credential when configured. See
[Compose service settings](https://docs.docker.com/reference/compose-file/services/).

Configure a host-based HTTPS proxy to forward to `127.0.0.1:8080`, preserving
Host. Redirect HTTP to HTTPS. Block external access to port 8080. Add ingress
connection/rate/body limits and a bounded timeout suitable for multi-source reads,
for example 240 seconds. Do not log authorization, cookies or request bodies.
A containerized proxy needs a separately configured private network; this recipe
assumes a host-based ingress.

For a private review instead, select `APIFIT_ACCESS_MODE=password` and supply a
random 32+ character access password. Username: `apifit`. This is an optional
fallback, not the owner's selected public launch configuration.

The internal health probe supplies the configured Host to `GET /api/health`.
It returns only `{"status":"ok"}`: liveness, not source availability, AI readiness
or recommendation quality.

## Verify the actual HTTPS release

1. Public mode opens without credentials; password mode, if selected, challenges
   on the root, assets and non-health APIs. Wrong Host/Origin must fail.
2. HTTP redirects before use; the backend port is not reachable directly.
   Check security headers and absence of private content in infrastructure logs.
3. The session cookie is Secure, HttpOnly, SameSite=Strict, prefixed `__Host-`,
   and expires after 15 minutes.
4. In two independent browser profiles, create free structural analyses. Foreign
   record reads fail; clearing one session leaves the other intact. Tabs within
   one profile share a backend session.
5. Check free search, shortlist, reading, small screens, keyboard navigation,
   source outages, malformed links, expiry and rate-limit messages.
6. With the runtime key and original ledger migrated, check AI readiness. Only
   perform a paid end-to-end smoke with explicit consent and enough allowance.
7. Restart: private records disappear and the exact cumulative ledger survives.
   Perform a rollback and recheck before declaring the host ready.

No provider operation or MCP tool execution is required. Do not describe an
AI-off smoke as verification of live summary/brief generation.

## Rollback and operating limits

Keep the previous verified image revision. Stop the current process and run
that image against the **same** persistent volume. Never restore an older cost
ledger or delete volumes during rollback: that erases spending history. Plan
data-format compatibility before upgrading.

If spending is uncertain, disable AI and restart. Rotate exposed secrets
privately. Keep credentials, ledger backups and deployment logs out of GitHub.
Public visitors can exhaust the shared allowance or capacity despite quotas.
The ledger bounds app-managed token spend under the pinned pricing and
single-owner assumptions, not hosting fees, taxes or unrelated account activity.

This is a bounded public personal project, not a multi-tenant SLA-backed service.
Accounts, bot challenges, scalable storage and stronger abuse controls can be
considered if usage warrants them. Do not add replicas or raise/reset the budget
without a separate design and funding decision.
