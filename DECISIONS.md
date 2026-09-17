# Product and engineering decisions

## 2026-09-17 — repository and deployment preparation

- Keep APIFit in its own repository, following the portfolio's Token Economist
  pattern: a problem-first README, product scope, decisions, current engineering
  guides, tests and dated evaluation evidence. PROJECTS holds only the portfolio
  record; machine-specific paths stay in its ignored local map.
- **Remove Postman from scope.** Earlier documents that say “deferred” or
  “next phase” are historical, superseded by this owner decision. Preserve them
  as evidence of iteration, not as the current roadmap.
- Prepare explicit public and password-protected single-process HTTPS modes. Local mode
  remains loopback-only. Hosted sessions own their private records and clearing
  one session must not delete or cancel another session's work.
- Hosted AI defaults off. Runtime secrets support non-macOS hosting without
  embedding a credential in source, a build argument or the browser. Local
  macOS Keychain setup remains available.
- Preserve the existing cumulative US$5 spending boundary. Do not create a new
  empty ledger on restart, deploy or rollback. A missing ledger stops paid AI.
- A deployment recipe is not a deployed service. No infrastructure, domain,
  production credential, new spending approval or public AI access is implied.
- The owner handles the demo and approved MIT, public `nethren/apifit`, and a
  public app with paid AI available. Public access is explicit rather than a
  default change to local mode. Visitors share the existing allowance; no budget
  increase, hosting purchase or actual deployment was requested.

## Earlier decisions and evidence

- [Backend foundation](docs/adr-001-backend-foundation.md)
- [Bounded Anthropic integration](docs/adr-002-anthropic.md)
- [Requirements-led discovery](docs/adr-003-requirements-led-discovery.md),
  subsequently replaced by [search-first interaction](docs/adr-004-search-first.md)
- [Evidence-backed discovery experiment](docs/adr-005-evidence-backed-discovery.md)
- [Search-to-brief verification and retained failures](docs/search-phase-results-2026-09-16.md)

Current scope is in [PRODUCT.md](PRODUCT.md). Current operating instructions are
in [documentation](documentation/README.md); dated reports are not deployment
instructions.
