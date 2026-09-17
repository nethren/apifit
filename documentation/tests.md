# Tests and evidence

```sh
npm ci --ignore-scripts
npm run check
npm run repo:check
```

The default suite uses fixtures, simulated providers and local test listeners;
it does not call Anthropic or spend AI credits. Tests cover parsing, output
validation, safe URLs/DNS/redirects, MCP metadata-only behaviour, consent,
budget reservations, session expiry, exports and search regressions.

Hosted boundary tests add password and origin rejection, secure cookies,
anonymous minimal health, cross-session isolation, record/cancellation scope
and resource limits. Public-mode tests cover anonymous access, the same isolation
rules, session creation quotas and ten AI route attempts per session (not per
person or per generation). Mixed-case API routes cannot bypass classification.
Runtime tests cover invalid configuration, hosted AI-off
defaults, local Keychain preservation and secret-safe errors.

`npm run build` syntax-checks server/shared/scripts/tests and builds the current
React entry point. `npm run repo:check` examines tracked and non-ignored candidate
files for likely secrets, private machine paths, forbidden artifacts and broken
relative Markdown links. It is a hygiene check, not exhaustive secret detection.

## Quality evaluation is separate

`npm run search:eval` and `npm run ai:eval` are explicit evaluation tools, not CI
steps. Paid modes require opt-in and the existing cost ledger; do not run them
just to get a green deployment check. Generated outputs stay ignored. Some replay
commands need local snapshots that are intentionally not published.

The [September 16 report](../docs/search-phase-results-2026-09-16.md) records
frozen-corpus metrics, failures, browser observations and budget at that time.
It is not an uptime benchmark, an independent study or proof of live API support.

## Before an actual release

Use the deployment guide to test real HTTPS, proxy Host handling, password
challenge, cookie behaviour, two independent browser sessions, expiry, restart
and rollback. Run free search and structural reading before considering a paid
smoke. A full screen-reader/device audit and hosting load test remain unclaimed.
