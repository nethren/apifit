# ADR 003 — Requirements-led discovery with inline review

Superseded for the active interface by [ADR 004](adr-004-search-first.md) after owner feedback. Retained as historical rationale; requirement confirmation is no longer in the primary flow.

Date: 2026-09-14. Status: implemented locally; initial exploratory verification completed with remaining relevance gaps documented in [the verification record](discovery-verification-2026-09-14.md).

## Context

The existing AI draft returned search suggestions, but directory retrieval ignored them. Users had to rediscover candidates and re-enter requirements in the shortlist. The owner approved connecting discovery to assessment, keeping search central with editable inline requirements, and explicitly deferred Postman work.

## Decision

Keep two separate, composable requests: paid, consented requirement drafting followed by free local matching against public directory metadata. Reuse `/api/requirements/draft`, extend `/api/search`, and carry reviewed requirements into the existing analysis/assessment boundary. No new provider, package, model, credential flow, persistent project store or orchestration framework.

1. With AI enabled, “Find with AI” drafts up to ten requirements and one to three search phrases. Priorities remain unchosen. Empty/unrelated drafts do not trigger a browse-all fallback.
2. Display “What I understood” above results. Requirements, priorities and search phrases are editable; the original request remains available. Requirement edits invalidate confirmation and prior comparison findings. Search phrases change retrieval; requirements change the later assessment.
3. Match the phrases against real APIs.guru records and up to three official MCP Registry pages per batch. Directory queries remain local. Combine matches by product/version ID, not by provider; expose matched words/phrases and source coverage.
4. Rank expanded results by summed title (5), product/category (3), and description (1) word overlap across distinct phrases. Common technical modifiers such as data, JSON and service are excluded when subject-specific terms exist. Generic-only searches still work. Excluded terms are disclosed; no geography, permission, cost or feature filters are inferred from metadata.
5. Refining phrases, changing sources and paging results reuse the draft without another AI call. A source outage preserves successful sources; a later MCP failure preserves earlier pages and exposes a retry cursor. Repeated/invalid cursors stop pagination with an incomplete-coverage warning. Public metadata caching does not retain private briefs.
6. The user shortlists up to five candidates and confirms requirements before requesting an assessment. Fetch public documentation through the existing safety boundary, parse up to twenty operations per candidate, then assess only server-owned evidence records. If some documents fail, ask whether to proceed with readable options; never silently present the partial set as the entire shortlist.

## Options considered

- **Keep keyword search disconnected:** simplest, but fails the approved requirements-led workflow and duplicates user work.
- **One monolithic paid discovery-and-assessment endpoint:** superficially convenient, but directory retries could repeat paid interpretation and assessment could run before the user confirms criteria.
- **LLM web-search agent or full corpus/vector index:** potentially broader retrieval, but adds data providers, indexing/refresh operations, costs and new security boundaries. Not required for this connected local milestone.
- **Chosen: query expansion over existing adapters:** small, transparent and reviewable; no fabricated API URLs or recommendations from model memory.

## Tradeoffs and consequences

- Expansion improves terminology coverage, not missing catalog coverage. It is not semantic embedding search, exhaustive internet discovery, verified regional support or a best-provider recommendation.
- MCP batches are bounded to three pages, with explicit continuation. Do not describe this as a full MCP search index. A sequence of slow pages can take longer than API-only discovery; cancellation stops additional page loads.
- Ranking is an English-oriented heuristic. Generic-term suppression can reduce recall for mixed technical requirements. The user can run a dedicated phrase or keyword search and inspect the original words; domain-specific regression cases should precede further tuning.
- The UI retains brief/draft/shortlist in tab memory only. Reloading loses them. Backend analyses and assessments retain their existing 15-minute expiry. No persistent history has been introduced.
- Haiku, prompt v4, exact quote checks, conservative unsupported rules, secondary verification, fixed host, explicit consent and the cumulative US$5 ledger are unchanged. Search refinement cannot trigger model escalation or paid retries.
- The assessment is still documentation-based and can be wrong. It neither executes an API/MCP tool nor verifies an account/key. No Postman implementation was changed.

## Actions and verification

- Added offline tests for expansion, real-record deduplication, pagination/cache reuse, generic-word pollution, invalid/empty queries, partial MCP failure, cursor loops, cancellation, requirement carryover and HTTP draft → search → confirmation → assessment.
- Perform real-browser paid draft/assessment checks within the existing budget, free retry checks, theme/layout checks, and public source coverage observations. Retain failures and limitations in `testing.md`.
- Next: broaden real-project/source evaluation, tune retrieval against explicit relevance examples, and discuss the deferred Postman phase with the owner. Do not deploy or expand paid services automatically.
