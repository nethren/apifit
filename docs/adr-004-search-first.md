# ADR 004 — Search-first recommendations and optional explanations

Date: 2026-09-14. Status: implemented; owner UX acceptance pending. Supersedes ADR 003's active interaction flow, not its network protections.

## Context

The owner rejected the requirement editor, priorities, confirmation and comparison gates as clutter. The product should do interpretation and sorting itself. Users search, save promising APIs, request simple explanations if useful, and optionally produce a build handover. Postman stays deferred; the approved visual identity remains.

## Decision

1. Interpret the project internally into up to three directory phrases. Retrieve real candidates, rank up to 24 for relevance and return at most 12 useful leads. Show one concise reason and only important gaps. No API facts from model memory.
2. Return only server-owned candidate IDs. Validate output shape and exact metadata quotes. Preserve the model's relevance order; an identity-only evidence label or stronger documentation link must not reorder a named lead below alternatives. Identity-only citations produce neutral leads, not capability assertions. Never translate source links into an uptime, reputation or reliability claim. API listings are not API keys or verified account entitlements.
3. Saving/removing is local and free, up to five selections. No requirement confirmation or AI assessment.
4. “Explain simply” makes one optional task after a free usable-source check: up to three documented capabilities, each paired with how it could help the original project. No generic introductory paragraph. API and MCP explanations use the same plain-language format, with evidence collapsed. Cache by goal, integration identity/version and source links in this tab. See [goal-centred explanations](goal-explanations.md) for the superseding source/validation design.
5. A build brief reads selected public docs through the safe reader and makes one bounded generation of roles and unresolved checks. Failed/unlinked docs are recorded without invented roles. Build steps are a deterministic APIFit checklist, not model-generated endpoint/field instructions: an initial live draft incorrectly implied unconfirmed coffee attributes could be retrieved. Download Markdown, no executable integration/Postman pack.
6. Keep pinned Haiku 4.5, explicit tab consent, Keychain-only credential access, cumulative $5 ledger, reservations, no retries and no escalation. AI search normally needs two calls; more results need one ranking call. Summary and brief each need one generation. Cancellation may still incur charges; ambiguous calls retain reservations.
7. Exclude narrowly identified, known-retired Bing Search products based on [Microsoft's retirement notice](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement), checked 2026-09-14. This is not a complete lifecycle-monitoring system. Other listings remain unverified.

## Options and tradeoffs

| Option | Decision |
| --- | --- |
| Inline requirements and assessment | Rejected by owner: too much work before value |
| Keyword-only retrieval | Free fallback; limited context and synonym understanding |
| Provider suggestions from AI memory | Rejected: no dependable provenance/current evidence |
| Fully read/assess every candidate before ranking | Deferred: excess latency, credits and source-failure overhead |
| Directory retrieval plus bounded ranking | Chosen: better filtering, but cannot recover absent candidates or certify fit |

## Consequences

- Search → ranked list → shortlist → optional brief replaces the form-heavy flow. No extra frontend concept or decorative animation.
- Emil guidance informed immediate local saves and focus preservation. Apple guidance informed progressive disclosure and single-purpose rows. Existing palette, typography and artwork remain.
- Valid quotes are provenance, not semantic proof. Operational reliability, provider account access and live behaviour are unmeasured.
- Coverage is preferred-version APIs.guru products and a bounded latest-version MCP registry index, not the entire web. “Find more” reviews more entries and can use credits.
- Briefs use partial parsed evidence. Pricing, regions, freshness and actual functionality may still need engineering checks.
- Legacy analysis/assessment routes and tests are retained but unused by the new frontend. No Postman code was added.
- Server records remain memory-only and expire after 15 minutes. The browser formats and downloads its already-generated brief with the same deterministic Markdown formatter used by the server. Downloading therefore still works after server expiry or a restart, without a network/AI request. It does not extend server retention or persist the tab's private content; reload still clears that content. No deployment, account system or persistent project history was added.

## Verification and next actions

Offline tests cover consent, query/ranking schemas, IDs/quotes, free saves, cache keys, continuation without redrafting, missing docs, unsafe URLs, export escaping and the connected HTTP flow. See [live/browser verification](search-first-verification-2026-09-14.md) for observed results and gaps.

Next: owner UX feedback, diverse relevance cases, broader source coverage, then a separately agreed Postman phase. Do not expand paid services or deploy implicitly.
