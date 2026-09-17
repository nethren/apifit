# Focused retrieval correction

Continuation of the discovery milestone, 2026-09-16. No UI or ranking-prompt changes; experimental evidence search remains disabled.

## Hypothesis

MCP namespace scaffolding (`io.github`) and protocol boilerplate receive product-relevance credit, crowding the first 24 candidates. Remove that scaffolding from lexical fields, distinguish publisher/product names, and ignore protocol boilerplate when meaningful search words remain. Preserve explicit searches for registry tools. Do not hard-filter identities using model-extracted phrases or infer official ownership.

## Tests and gates

- Unit: the GitHub namespace is not a GitHub product match; actual GitHub publisher/product tokens still match; fallback titles containing full identifiers are cleaned only for scoring, never changed in returned metadata. Other hosted namespaces receive equivalent treatment.
- Unit: multiword protocol boilerplate cannot drown specific product/capability words; generic-only MCP searches and registry-management searches remain possible. API scoring is unchanged.
- Integration: deterministic pagination, stable ties, public source labels, limits and cancellation remain intact. Free search stays free; no extra AI calls or document fetches.
- Offline replay: use saved phrases from the previous 50-case runs and four-case shipped smoke against the same broader snapshot. Compare old/new retrieval into the top 24; preserve all existing API candidate lists exactly, and report MCP gains/losses. This measures retrieval, not final ranking or feasibility.
- Fresh fixtures: freeze an additional MCP request set before implementing the change; inspect held-out outputs only after the implementation and unit tests are fixed. References are source-listed leads, not independently verified providers.
- Paid gate: only if offline checks pass, run a small targeted default-flow check using the existing model, consent and unchanged ledger. No repeated prompt tuning or model changes. Reserve at most $0.30 additional development budget for this continuation, including uncertain calls; no automatic retry.
- Final: offline suite/build and browser free search/shortlist. Document misses rather than broadening the fix opportunistically.

The engineering testing-strategy skill informs the unit/integration/browser layers and separate retrieval/recommendation measures. The scope is MCP candidate retrieval; the earlier geocoding/API ranking issue remains separate.
