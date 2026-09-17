# Search quality and coverage milestone

Frozen before implementation on 2026-09-16. Keep the approved UI, free shortlist and on-demand summaries/briefs. No deployment, Postman, provider credentials or tool execution.

## Test plan and gates

Use 50 fictional requests (35 development / 15 sealed-output holdout) and an immutable public-directory snapshot. Run the current pipeline before implementation, then the revised pipeline against the same requests/metadata. This is agent-authored reference-lead evaluation, not an independent human audit or universal accuracy claim. The previous v1 holdout is retired. The evaluation skill informed the separate metrics and before/after design; the testing-strategy skill informed the network/cache/HTTP regression layers.

- Relevance: reference in top 3; aim not to regress the baseline on source-covered cases. Report end-to-end and source-covered denominators, plus simple/complex/named-provider slices.
- Claims: distinguish documentation-backed selection from directory-only leads. No specific capability should be asserted based on a generic product name. Review development outputs and holdout outputs after code freeze; a matching quote alone is not entailment proof.
- Provider intent: explicit exclusions never returned; unavailable requested publishers should yield no substitute labelled as a match. Registry publisher evidence is not a safety certification.
- Coverage: latest-version MCP pages indexed locally with completion/partial status, bounded refresh and no user query transmitted. Duplicate aliases should not occupy separate slots; distinct products and versions must stay distinct.
- Efficiency: existing two paid search steps only; public evidence retrieval/cache adds no LLM calls. Report per-run cost and warm/cold latency separately. Each paid evaluation run retains the existing $1.25 sub-cap and unchanged cumulative $5 ledger.
- Reliability: unit/HTTP tests for cancellation, pagination, failed source fallback, cache expiry/coalescing, bounds, identity filters and citation provenance. Offline tests never spend money. Browser verifies search → free shortlist → existing explanation entry point, without redesign.

Read-only metadata indexing must not become API/MCP operation execution. Only public source content may be reused across searches; requests, selected evidence keyed by private text and generated explanations are not persisted. Public deployment remains a separate decision.
