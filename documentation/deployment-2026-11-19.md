# Production deployment — 2026-11-19

Owner authorized committing and deploying the Signal redesign to production.

- Commit: `e1d8fae` (Signal redesign, AI concept coverage, and the previously
  uncommitted Vercel free-tier runtime). Not pushed.
- Live origin: https://apifit.nethren.com/
- Deployment: https://apifit-a4ub8ixua-nethrens-projects.vercel.app
- Build snapshot: 66,082 public MCP entries across 672 pages.
- Verification before deploy: 252 tests passed, 5 Redis integration cases
  skipped, 0 failed. Build, repository hygiene and diff whitespace checks
  passed.
- Production health returned status ok. `/api/ai/status` reported configured
  and ready with the shared ledger at US$4.326423 charged/reserved of US$5.
  The production CSP header is unchanged (`style-src 'self'`).
- Browser check: the Signal home rendered with AI on by default. One AI search
  ("Text farmers when a storm is coming") returned `AI_AUTH`: Anthropic
  rejected the production credential (HTTP 401/403). The app fell back to
  keyword matches as designed, and the shared ledger total did not change.
- Not verified: live AI concepts, coverage, explanations and briefs in
  production. They need a replacement Anthropic key in the Production runtime
  secret `ANTHROPIC_API_KEY`, followed by a redeploy.
