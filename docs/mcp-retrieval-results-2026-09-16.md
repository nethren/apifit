# MCP retrieval correction — results

2026-09-16, continuation after the broader ranking experiment. **The focused lexical correction is enabled.** No UI or AI prompt changes; experimental documentation ranking remains disabled.

## What changed

Search previously counted `io.github` in every hosted MCP identifier as a GitHub relevance signal. It also rewarded generic protocol words such as “MCP server” and “Model Context Protocol.” This crowded the bounded candidate list with unrelated servers and registry tools.

The correction separates the namespace host from the publisher and product for matching, cleans identifier-only fallback titles for scoring, and ignores protocol boilerplate when meaningful words remain. Displayed metadata is unchanged. Deliberate generic searches still work, and “registry” remains searchable because registry management is a real use case. There is no provider allowlist, strict identity filter, ownership certification, added AI call or automatic documentation read.

This changes MCP lexical retrieval only. It does not establish suitability, live reliability or official ownership, and it does not fix all later AI decisions.

## Offline comparison

The [plan](retrieval-fix-plan-2026-09-16.md) and [12 additional fictional MCP fixtures](../tests/mcp-retrieval-cases.json) were written before implementation. Six new fixtures were development cases and six had held-out outputs. Existing cases from the earlier 50-case set are retired evaluation material, not fresh holdouts.

The free runner replayed the same captured public directory snapshot and exactly the same query phrases before/after. No AI or network calls. Cases comprise 50 earlier baseline requests, four shipped-smoke requests, one saved geocoding failure and the 12 new fixtures: **67 checks**, of which 63 have expected reference leads. These are overlapping scenarios, not 67 independent users.

| Measure | Before | After |
| --- | ---: | ---: |
| MCP checks with a reference in the first 24 candidates | 15/23 | 21/23 |
| New MCP fixtures with a reference in the first 24 | 9/12 | 12/12 |
| API checks with a reference in the first 24 | 38/40 | 38/40 |

All **44 API candidate lists**, including four empty/abstention cases, are byte-for-byte identical in product order. Six MCP checks gained a reference; none lost a previously retrieved reference from the top 24. Three gains were in development outputs and three in the held-out-output group. These are **retrieval measures, not final top-three recommendation accuracy**.

Raw ordering is not universally improved: one Playwright reference moved from second to thirteenth and one Tandem reference from first to twelfth, while remaining available to the AI ranker. The fix should not be described as putting every named provider first in keyword search.

The two retained MCP retrieval misses are the saved screenshot/debugging request (`saved-d28`) and a Context7 request whose earlier AI phrases omitted Context7 (`saved-h12`). The geocoding miss and absent DeepL reference also remain; API retrieval was deliberately not changed.

Artifacts: ignored `output/retrieval-quality/lexical-baseline.json`, `lexical-revised-dev.json` and `lexical-revised-holdout.json`. Files retain source fingerprints, fixture/snapshot digests, ordered products and case-level results. The runner is [retrieval-quality.mjs](../scripts/retrieval-quality.mjs); it never imports an AI client and refuses network fallback. Existing outputs are not silently overwritten by a repeated run name.

## One paid end-to-end check

The normal default flow then processed the 12 new fictional requests, generating its own phrases rather than using the hand-authored replay phrases. Same pinned model and unchanged prompts; the experimental ranker stayed off. A US$0.30 sub-cap was enforced inside the existing US$5 ledger. No paid retry or prompt iteration followed.

- Source coverage: 12/12 references present.
- Actual retrieval: 11/12 references reached the candidates.
- Final results: **10/12 references appeared in the top three**.
- Request errors: 0/12. Successful HTTP responses can still be wrong or empty.
- Cost: **US$0.067441**, from 44,251 input and 4,638 output tokens.
- End-to-end median: 10.213 seconds; slowest/p95: 47.855 seconds. This small run does not isolate model/network time from local processing; latency remains a concern, not an accepted performance target.

Two distinct failures remain:

1. `d01`, “Find GitHub's own MCP connection for my coding assistant.” The correct GitHub record was passed to ranking, but the model returned no items and incorrectly said the official product was not identified. This is now a **ranking/interpretation failure, not a catalogue or retrieval failure**. Another GitHub request (`h04`) ranked the reference first, so the problem is inconsistent rather than universal.
2. `h05`, “Use Context7 to look up framework documentation, not a general MCP registry.” Query interpretation returned no search phrases, dismissing the valid request before retrieval. The hand-authored offline phrases retrieved Context7, isolating the failure to the AI interpretation step.

The first new failure was inspected during the live run; no production or prompt changes were made in response. Held-out details were opened after completion. This fixture set is now retired for independent holdout claims. No fresh baseline AI run exists for these 12 requests, so 10/12 is a post-change smoke result, **not a measured end-to-end improvement**. References are incomplete, other results are unjudged, and official-provider wording/capability claims have not received an independent audit.

Saved run: ignored `output/search-quality/mcp-lexical-live/`. Free reporting:

```sh
npm run search:eval -- --v2 --mcp-retrieval --run mcp-lexical-live --split all --report
```

## Verification and budget

- **181/181 offline tests pass**, including six new MCP lexical tests. Backend syntax checks and the production build pass.
- Browser: with AI off, “GitHub” returns the `io.github.github` listing in the first page; it can be saved immediately and appears in the shortlist. No paid summary or brief was generated during the browser check. Existing user tabs were left intact.
- APIFit was started at `http://127.0.0.1:4173/`. Appearance, shortlist behaviour, summary/brief prompts and Postman scope are unchanged.
- Ledger after this continuation: **US$2.820736 charged/reserved; US$2.179264 remaining** of the unchanged US$5 cap. The earlier conservative reservation is retained. This is the local safety ledger, not an invoice reconciliation.
- No deployment, repository publishing, new paid services, credential changes or portfolio-state changes.

The engineering testing-strategy skill kept the unit, retrieval-replay and end-to-end checks separate. That distinction exposed both the measurable retrieval gain and the remaining AI errors instead of counting catalogue presence as success.

## Next focused work

Prevent false-empty responses for clearly named integrations, without fabricating capabilities or silently overriding explicit exclusions. Investigate the two saved failures above before another paid run. A name-based directory lead must remain visibly different from a capability recommendation; “official” must not be inferred from an unreviewed title alone. Preserve a genuine no-integration/abstention path, and test negative and ambiguous requests before enabling any fallback.

Separately, profile the slow AI steps and preserve original product names when generating search phrases. Do not re-enable the earlier strict-identity/documentation ranker, redesign the UI, or broaden this into Postman work.
