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
- The previous production key had expired on 2026-10-14. The owner placed a
  replacement key directly in the Production runtime secret
  `ANTHROPIC_API_KEY`; it was never shown to or handled by the agent. Production
  was redeployed as https://apifit-dn7y6ttvk-nethrens-projects.vercel.app.

## Live AI check after the key replacement

- One AI search ("Text farmers when a storm is coming") succeeded. Concepts
  Weather, Alerts and SMS were extracted and shown in the headline, and six
  ranked matches were returned.
- Finding: the ranker quoted only the `Name:` line for every match, so the
  existing identity-only rule downgraded all six to "Listed under this name"
  with no reason and no concept coverage. The rule worked as designed; the
  rank prompt does not tell feature matches to quote the description line.
- One explanation (Visual Crossing Weather API) read the public docs, returned
  cited capabilities, and advanced the evidence steps to Quotes checked.
- Phone width (375 px) showed no horizontal overflow.
- Shared ledger moved from US$4.326423 to US$4.341103 (about US$0.015) for
  these three provider calls. Not verified live: brief generation.

## Ranking quote fix

- Commit `e4020ba` tells feature matches to quote the `Description:` text
  that establishes the action (prompt version
  `apifit-lookup-and-capabilities-v4.8-feature-quotes`), with a regression
  test. 253 tests passed, 5 skipped; build and hygiene checks passed.
- Deployed as https://apifit-gxzdxa671-nethrens-projects.vercel.app.
- The same live search returned seven matches with result-specific reasons
  and gaps. Weather APIs covered Weather, Amazon Pinpoint covered SMS, and no
  listing established Alerts, which stayed uncovered.
- Shared ledger: US$4.35003 charged/reserved (about US$0.009 for this check).
