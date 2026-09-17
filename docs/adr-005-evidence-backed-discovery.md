# ADR 005 — Broader discovery with bounded documentation evidence

2026-09-16. Local development only; no public deployment or Postman work.

**Status: partial adoption.** MCP indexing and conservative API alias removal are enabled. The combined intent-extraction/documentation-ranking experiment failed the no-regression gate and is disabled by default (`createApp({ evidenceSearch: false })`). The application entry point does not opt in; browser parameters cannot enable it. The following experimental design is retained for evaluation, not presented as shipped search behaviour. [Measured results and release decision](search-quality-results-2026-09-16.md).

## Product decision

Keep the approved interaction: describe an idea → browse ranked options → shortlist freely → request an explanation or build brief. No requirement editor, confirmation gate, automatic paid summary or integration execution has been added.

The default backend retains its original search-phrase expansion and directory-metadata ranking. The experimental path uses those two AI steps differently:

1. Interpret the request into directory phrases and grounded, explicit product/publisher restrictions.
2. Rank actual candidates using their listings plus a bounded selection of public documentation.

Documentation availability must not outrank usefulness. A documentation-backed reason is still an AI interpretation, not proof of full feasibility, provider ownership, live behavior, account access or reliability. Directory-only candidates receive a neutral lead label instead of an accepted model-written capability claim. An explicitly requested product can remain an identity-only lead when its desired capability is unestablished.

## Coverage

- APIs.guru preferred product versions remain the API source. Aliases collapse only when original specification URL, publisher, title and version agree. Dated specifications and different products remain separate; this intentionally does not deduplicate every similarly named listing.
- The MCP adapter builds a local, query-independent index using the registry's `version=latest` cursor pagination. It does not send the user's search text to the registry. In-memory matching is broad across subjects/providers, not restricted to a fixed provider list.
- Refresh is coalesced and bounded to 400 pages, 40,000 records, 15 seconds per fetch and six minutes overall. Cached public metadata is reusable for one hour. A failed refresh does not erase a broader previous index or mark its contents newly fetched. Failure retry backs off for at least one minute.
- Only public registry metadata is persisted, in ignored `.local/mcp-index.json`. Completion, partial coverage, stale state and warnings are returned. During the initial load, users may receive a partial index and should search again after it finishes. This is registry coverage, not an exhaustive internet search or safety review.
- Normal discovery uses the index. The legacy `/api/search` adapter remains available; pagination against a refreshing index is not a transactionally frozen corpus. The frontend deduplicates repeated IDs when loading more.
- A subsequent enabled correction strips namespace-host scaffolding and protocol boilerplate from MCP lexical matching when meaningful query terms remain. It preserves product metadata, actual publisher matching and deliberate registry/generic searches. This is independent of experimental intent extraction and does not certify identity. [Focused evaluation](mcp-retrieval-results-2026-09-16.md).

Registry contracts: [official API reference](https://github.com/modelcontextprotocol/registry/blob/main/docs/reference/api/official-registry-api.md), [aggregator guidance](https://modelcontextprotocol.io/registry/registry-aggregators). The registry does not make a listing a verified recommendation.

## Experimental documentation budget and privacy

- At most 24 retrieved candidates per AI batch, 12 explanations returned by ranking. Up to the first 12 candidates receive documentation enrichment.
- Three concurrent readers, 7.5 seconds total enrichment budget, at most two document retrieval attempts per candidate. Specs, linked READMEs and bounded fallback pages use the existing safe public-network boundary. Search never enumerates or invokes MCP tools; on-demand explanations retain their separate, existing source flow.
- Public source retrievals coalesce by URL. Positive cache lifetime: one hour. Failed reads: one minute. Cache: 48 entries / 48 MiB, in memory. Each read is bounded to 12 MiB and 6.5 seconds.
- Cache values are raw public sources, not queries or query-selected excerpts. Relevant operations and snippets are selected per request. Action descriptions are retained instead of allowing repeated parameter/error text to dominate selection.
- Only bounded source excerpts and the original request go to Anthropic. Credential-pattern checks, fixed provider/model, opt-in, the existing durable US$5 cap, no automatic paid retry and no model tools remain enforced.
- The model selects a candidate-specific evidence ID; the server attaches the exact corresponding excerpt and source. This establishes provenance, not semantic entailment. Model relevance mistakes, narrow examples, ambiguous identity and misleading documentation remain possible.

## Experimental identity boundaries

Names are constrained by the output schema to literal one-to-four-word spans of the original request; the server supplies original wording instead of asking the model to copy another quotation. This prevents invented names and quote-copy failures, but does not prove that every selected phrase is an identity or that its inclusion/exclusion was interpreted correctly. Matching uses product/title or publisher namespace, not brand mentions in descriptions. MCP publisher matching uses the registry namespace rather than a repository URL that a listing could claim. Brand/namespace aliases are normalization aids, not an industry/provider allowlist. Unknown or ambiguous brand aliases can still cause misses; do not loosen a failed explicit restriction into unrelated alternatives.

## Validation and remaining work

The evaluation and testing-strategy skills informed separate coverage, relevance, claim quality, latency, cost and regression checks. See the frozen [evaluation plan](search-quality-v2-plan.md). Synthetic fixtures cover identity filtering, evidence selection, source caching, cancellation, bounds, alias preservation and HTTP behavior. Live evaluation uses fictional requests, an immutable directory snapshot, recorded public documentation and the unchanged budget ledger. No private user requests are written into the evaluation corpus. Passing structural tests did not establish useful AI recommendations: 175 tests pass, but the last experiment lost valid reference leads on the shared source-covered subset (37/39 baseline versus 28/39 experimental). Default-off behaviour is regression-tested. Current default search still has matching weaknesses, including the official GitHub MCP smoke-test miss.

Not claimed: perfect matching, universal claim verification, exhaustive source coverage, official ownership verification, measured uptime or production readiness. Broad live-doc quality, non-English requests, JS-only/authenticated docs, ranking across refreshed pages, and independent human evaluation remain future work. No deployment decision has been made.
