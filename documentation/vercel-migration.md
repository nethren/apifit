# Free-tier Vercel migration

Status: deployed to Vercel and preview-verified on 2026-09-17. Custom-domain
DNS, production AI smoke verification and automatic catalogue refresh remain
pending; see the deployment record below.

The product flow and local Node server remain unchanged. Hosted Vercel uses
Node functions, a Free Upstash Redis database for atomic spending/rate-limit
metadata, and a build-time public MCP registry snapshot. No private project
text, documentation excerpts, generated summaries or briefs go into Redis.

Private records are authenticated/encrypted, returned to the browser, and kept
only in JavaScript memory. Subsequent requests return the sealed record with
the original owner cookie. A short-lived server-side metadata entry enforces
ownership, expiry and deletion across function instances. This is transport,
not browser localStorage or a new database of user projects.

## Acceptance gates

- Existing tests and production frontend build pass.
- Two independent backend instances share session quotas and spending limits.
- Missing/unreachable/corrupt spending state stops AI; never initializes $5.
- Concurrent reservations cannot exceed the existing allowance. Ambiguous
  failures retain reservations; settlement is idempotent.
- Private record transport rejects tampering, different owners and expiration.
- Search pagination, API/MCP explanations, shortlist, brief generation/export,
  and Understand an API are exercised without changing the UI flow.
- MCP coverage is retained using a complete build-time registry snapshot;
  failed refreshes must not silently publish a smaller index.
- Preview verified before custom-domain cutover. AI stays off until the existing
  ledger is migrated with the local ledger owner disabled.

## Rollback

Keep the previous deployment available. Disable hosted AI before a rollback
that changes spending-store ownership. Never restart the previous local/file
ledger after migration: its total is stale. Do not reset or recreate a missing
Redis budget. Revert traffic only after reviewing the active budget owner.

## Free account setup

1. Use Vercel **Hobby**, not a Pro trial. Create/import the `apifit` project
   from its independent repository; use Node 22 or 24. Keep Fluid Compute on.
2. Create an owned Upstash Redis **Free** database, not an unclaimed temporary
   database. Use Singapore (`ap-southeast-1`), alongside Vercel's configured
   Singapore function region (`sin1`), as requested by the owner. Keep eviction and auto-upgrade disabled; do not add a
   paid read region or attach a payment method to upgrade it.
3. Add the three runtime secrets listed in [variables](variables.md). Add
   `APIFIT_MODE=hosted`, `APIFIT_ACCESS_MODE=public`,
   `APIFIT_AI_ENABLED=false`, and the exact HTTPS `APIFIT_PUBLIC_ORIGIN`.
   Production requires the explicit custom-domain origin. Preview can omit it
   and uses Vercel's deployment-owned `VERCEL_URL` as its exact origin; preview
   AI is always disabled. Never derive allowed origins from request headers.
4. `npm run build:vercel` builds the UI and retrieves a complete public MCP
   snapshot. The function includes the parser worker and snapshot explicitly.
   No private local files, ledger, source credentials or test data are deployed.
5. Verify free keyword search/pagination and public documentation parsing on
   a preview. Use deterministic AI fixtures locally, not a free production
   allowance, to exercise explanation and brief UI without paying for tests.
6. Stop existing local AI and keep hosted AI disabled. Privately provide the
   Upstash environment values and run
   `node scripts/migrate-vercel-budget.mjs --local-ai-stopped`.
   This halts the local ledger first and copies the original nonzero cumulative
   total with `SET NX`. Any ambiguous error requires manual review; do not retry
   by clearing records, reinitializing a ledger or unhalting the old owner.
7. Configure the replacement Anthropic runtime secret directly in Vercel, then
   enable AI only after confirming the ledger handover. Never paste secrets
   into chat or terminal command arguments. Verify status before a paid call.
8. Only after the preview gates pass, point the `apifit` CNAME in Cloudflare to
   the project's Vercel-provided target. Leave root-domain/portfolio DNS alone.

## Operational limits

- Vercel Hobby is for personal, non-commercial use and has monthly quotas.
  Function duration is capped at 300 seconds; APIFit cancels work at 280 seconds.
- Redis has finite free storage/commands. Upstash may archive inactive Free
  databases. Missing/unreachable state **fails closed**, never grants new AI
  allowance. Restore the original budget; do not initialize a fresh one.
- Private sealed-record transport is bounded to 4 MiB requests, including at
  most five records. User-authored input retains the original 64 KiB ceiling.
- Refresh the public MCP catalogue by rebuilding at least daily. Stale snapshots
  are explicitly marked. A failed catalogue build does not replace the last
  working deployment. The daily redeploy hook below does this;
  if GitHub disables scheduled jobs for inactivity, re-enable the job.
- There is no paid hosting subscription in this configuration. Claude usage
  still consumes the existing cumulative allowance.

The `.github/workflows/refresh-catalog.yml` workflow uses a Vercel Deploy
Hook for this project's production branch, stored only in GitHub Actions secret
`VERCEL_CATALOG_DEPLOY_HOOK`. The hook triggers a normal build, so failed registry
fetches keep the preceding deployment intact. It is a credential: never put its
URL in an issue, repository file or log. The owner configured it on 2026-11-22.
A green workflow only means Vercel accepted the request: confirm the build in
Vercel. The repository is also linked for deploy on push, so a push to `main`
deploys to Production without waiting for CI.

The registry snapshot is bounded at 2,000 pages, 200,000 entries and 200 MiB
(`INDEX_LIMITS` in `server/catalog-index.mjs`). The build reads the file back
through the runtime loader and fails, keeping the preceding deployment, if it
would not load. Do not simply raise these again: the function bundle limit is
250 MB and Hobby memory is 2 GB, so further growth needs a smaller snapshot
format or different storage.

## Local verification — 2026-09-17

- All 239 tests passed with a real Redis 7.4.6 test server; no skipped cases,
  including preview-origin validation and forced AI-off in preview.
- Existing 226 tests still passed after adapting asynchronous record/budget access.
- Production Vite build passed; backend syntax and repository hygiene passed.
- Complete public registry snapshot fetched: 32,286 entries over 327 pages.
- Local `vercel build` passed. Function file tracing required explicit
  exclusions for `.local` and environment files. Run
  `node scripts/check-vercel-package.mjs` after each local Vercel build;
  it checks physical files and external file references before upload.
- Upstash Free database recreated in Singapore after owner approval; the empty
  Virginia database was removed before any ledger or data was connected.
- Upstash URL/token and the record-encryption secret are stored in Vercel runtime
  settings for Preview and Production. Public hosted mode is configured. AI
  was kept disabled until the replacement provider key and original budget
  were migrated. Both are now transferred after explicit owner approval.
- The original local ledger is halted with `migratedTo=shared-vercel-ledger`.
  The hosted ledger was created with `SET NX` and read back in the authenticated
  Upstash console: US$4.294317 charged/reserved, US$0.705683 remaining, cap US$5.
  The replacement Anthropic key was transferred directly from Keychain to
  encrypted Production settings without writing or printing the key.
  Production AI is configured on; Preview remains off. No paid call was made.
- Owner requested AI on by default. The interface now selects AI by default
  when server readiness permits it, preserves a visitor's opt-out during status
  refreshes, and discloses Anthropic processing beside search. Preview remains
  AI-disabled regardless of the interface preference.
- An initial package rebuild stalled on a redundant full catalogue refresh;
  it was stopped before upload and the build-time refresh was corrected.
- Follow-up fix: reuse complete snapshots for 24 hours (matching hosted freshness),
  allow up to 14 minutes for initial full refresh with page-count progress, and
  enforce a 15-minute build deadline. Failed refreshes block deployment even if
  an older complete snapshot remains. Three additional regression tests pass.
  Updated local Vercel build and package-exclusion check passed.

## Deployment record — 2026-09-17

- Vercel project: `apifit`, in `nethrens-projects` (Hobby). Functions run in
  Singapore (`sin1`) on Node 24. Build and package checks passed.
- Explicit preview: <https://apifit-ggg6fbqqa-nethrens-projects.vercel.app>.
  Browser checks passed: API keyword search (12 weather results), MCP search
  (24 results, then 48 after pagination), and shortlisting. AI status correctly
  reported disabled in preview. A public Weatherbit OpenAPI document parsed
  successfully through the hosted parser worker. These requests also exercised
  the actual Upstash REST session/record boundary. No paid AI call was made.
- Vercel automatically promoted the first deployment to Production. Its runtime
  is restricted to the configured `https://apifit.nethren.com` origin; default
  Vercel aliases are not substitutes for production API verification.
- `apifit.nethren.com` is attached and ownership-verified in Vercel. Its assigned
  DNS target is `6a9a0d779ccbe1e3.vercel-dns-017.com`. Cloudflare allowed DNS
  reads but rejected record creation with an authentication error. A subsequent
  read confirmed no `apifit` record was created. Root/portfolio DNS was untouched.
- Remaining gates: create the DNS-only CNAME, verify HTTPS and production AI
  readiness, then complete a controlled live AI smoke check if needed. Do not
  infer live provider success from the preview or mocked tests.
- Automatic GitHub-to-Vercel integration and the daily catalogue deploy hook
  await explicit owner approval for the ongoing repository/deployment access.
  Manual deployments remain available. No recurring refresh is claimed yet.
  Superseded on 2026-11-22: the owner approved both; see
  [that deployment record](deployment-2026-11-22.md).

## Verification commands

`npm test` runs ordinary tests; the Redis-dependent cases explicitly skip when
the test adapter is not configured. CI starts isolated Redis and runs all cases.
Locally, set `APIFIT_TEST_REDIS_CLI` to a local `redis-cli` executable and
`APIFIT_TEST_REDIS_PORT` to an isolated loopback test server, then run `npm test`.
Never point this adapter at a real database. It uses random test namespaces.

Sources: [Vercel Hobby](https://vercel.com/docs/plans/hobby),
[Node functions](https://vercel.com/docs/functions/runtimes/node-js),
[Upstash Free pricing](https://upstash.com/pricing/redis),
[durability](https://upstash.com/docs/redis/features/durability),
[inactivity handling](https://upstash.com/docs/redis/help/faq).
