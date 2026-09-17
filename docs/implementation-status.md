# APIFit implementation status

> Historical local-build record. Current scope is in [PRODUCT.md](../PRODUCT.md)
> and hosting preparation in [the deployment guide](../documentation/deployment.md).
> Postman was removed on 2026-09-17, superseding “deferred” below.

## Local search-to-brief phase — 2026-09-16, latest

Ready for owner product-validation and a separately agreed next-phase scope discussion, not production launch. Named API/MCP interpretation, negative query handling and relevance ordering are corrected; the failed experimental ranker stays disabled. The frozen 28-case challenge improved reference hits in the first three from 17/23 to 21/23. A later 50-case regression and five-case final check are reported separately, with failures and source gaps retained rather than combined into an inflated accuracy score.

Browser checks cover free saves, API/MCP goal explanations and a Context7 build brief. A false-empty MCP explanation was corrected by making tool-description evidence explicit to the model; no tools were executed. Brief download and cached explanation reopening work with the QA server offline. Some technical wording, own-provider alternatives and a screenshot-related retrieval miss remain known limitations.

189 tests, 60 module syntax checks and production build pass. Ledger: $4.294317 charged/reserved, $0.705683 remaining of $5. See the [full phase report and gate audit](search-phase-results-2026-09-16.md). Postman, deployment and any new spending allowance still require owner decisions. Approved UI remains unchanged.

## Focused MCP retrieval correction — 2026-09-16, earlier

Enabled namespace-aware MCP lexical matching: `io.github` no longer makes every hosted listing a GitHub product match, and generic protocol words no longer crowd out more specific query terms. This does not establish official ownership. No UI, AI prompt, API scoring, summary/brief or Postman changes.

Offline replay: top-24 reference retrieval improved from 15/23 to 21/23 MCP checks, with no previously retrieved references lost; all 44 API product lists remained identical. A 12-case normal-flow paid smoke found references in the top three for 10/12 requests, with no request errors. The remaining two failures are AI decisions: dismissing a GitHub candidate that was retrieved, and rejecting a valid Context7 query before retrieval. This is a measured candidate-retrieval improvement, not complete recommendation validation.

181 tests, syntax checks and build pass. Free GitHub MCP search and instant shortlisting were verified in the browser. US$0.067441 spent this continuation; US$2.179264 remains. The previous experimental evidence ranker stays disabled. [Detailed results, caveats and next focused fix](mcp-retrieval-results-2026-09-16.md).

## Discovery coverage and evaluation — 2026-09-16, earlier

Partially delivered. A bounded, query-independent MCP registry index and conservative API specification alias removal are enabled, with the approved interface and free shortlist unchanged. The live index completed a 324-page traversal with 31,972 normalized records; this describes one registry snapshot, not exhaustive internet coverage or a safety review.

The new strict identity extraction and documentation-assisted ranking were implemented and evaluated but **not promoted**. The last 50-case experiment regressed from 37/46 to 33/46 reference hits in the top three; on the common covered subset, 37/39 became 28/39. Both features are behind a default-off server flag. Default search keeps its existing directory-based AI ranking. A four-case smoke check of that shipped combination had no request errors but only three reference hits; finding GitHub's own MCP remains a known retrieval failure. Do not claim matching work is complete.

175 offline tests and the production build pass. Browser checks cover free API/MCP search, immediate shortlisting and the on-demand explanation consent boundary. The app is running locally, not deployed. The unchanged US$5 ledger shows US$2.753295 charged or conservatively reserved and US$2.246705 remaining after this milestone. [Results, failures, costs and prioritized next work](search-quality-results-2026-09-16.md); [architecture and limits](adr-005-evidence-backed-discovery.md).

Next: isolate candidate-retrieval failures from ranking failures using existing saved results, then test one focused change against a fresh held-out set. Do not add more prompt complexity or run further broad paid iterations without a specific hypothesis. Keep Postman, deployment, new paid services and UI redesign out of this milestone.

## Source-aware explanations — 2026-09-15

Fixed discarded MCP remote addresses, readable-but-irrelevant first-source acceptance and paid empty-summary homework. APIs and MCPs share bounded fallback retrieval and a free capability-input gate. Remote public MCP tool descriptions can be read without tool execution; unsupported or authenticated connections fall back to linked docs. Unusable sources produce an honest no-generation status. Mixed briefs exclude and name unverified selections. No provider/domain-specific patch was used. See [implementation, safeguards, live checks and remaining limits](goal-explanations.md#source-resolution-correction--2026-09-15-later-update).

156 automated tests and build passed. Graffeo is currently returning a service error; its unavailable-capability UI is verified. Context7 metadata/summary and a mixed brief passed live checks; TomTom's OpenAPI still passes the shared source gate. Broad ranking/plain-language quality remains unvalidated. Paid smoke checks cost $0.009105; $4.140085 remains of the $5 cap at verification time.

## Goal-centred API/MCP explanations — 2026-09-15

Summaries now receive the original search and pair documented capabilities with plain-English possible uses for that project. Build briefs share the same display component and content structure. Evidence and the generic build checklist are collapsed by default; no requirement editor or paid shortlist gate. Explanation caches include the goal, identity/version and source links.

MCP identity is preserved, linked repository READMEs are preferred over generic websites, and public GitHub README resolution uses the existing safe fetch boundary. Markdown and longer HTML selections are supported. Relevant OpenAPI operations are selected before bounded expansion. Retail or unrelated pages result in a source limitation, not a declaration that an MCP does not exist. All source labels remain unverified; no integration operation is executed.

The model selects source IDs and the server supplies exact excerpts, avoiding unreliable model quote copying. This improves source traceability, not proof that every generated application is correct. Broad AI quality remains unvalidated. See [acceptance checks and verification notes](goal-explanations.md). Postman remains paused.

## Search-quality milestone — 2026-09-15

Completed a frozen 30-case baseline/revised evaluation (20 development, 10 held out), plus the first measured fixes: isolated credential-like public metadata, per-candidate invalid-statement withholding, action-focused ranking and loaded MCP revision deduplication. Search errors: 5/30 → 0/30; reference leads in top 3: 21/28 → 26/28. **Claim quality is not validated**: some reasons still go beyond their supporting quotes and explicit-provider matching can return inappropriate substitutes. 131 tests and build pass. UI unchanged, Postman paused. [Full results, costs, limitations and next priorities](search-quality-results-2026-09-15.md).

The next priority recorded on September 15 was bounded documentation-backed ranking, explicit-provider intent and broader MCP coverage. See the September 16 entry for the measured outcome: coverage shipped; the ranker was held back. No return to requirement forms or AI checks on shortlisting, and no deployment is authorized.

## Current owner-requested flow — 2026-09-14

Implemented: search → AI-ranked directory leads → free local shortlist → optional plain explanation/build brief. Requirement splitting, priorities, confirmation and assessment are removed from the active interface. Approved Pearl/near-black styling remains. Known-retired Bing listings are filtered; operational reliability and exhaustive market coverage are not verified. Postman is unchanged/deferred. See [ADR 004](adr-004-search-first.md) and [verification](search-first-verification-2026-09-14.md).

The earlier milestone below is historical; its inline-requirement workflow is superseded.

Updated: 2026-09-14. Milestone: owner-approved frontend, local backend and opt-in Anthropic integration. Keychain storage and live provider access are confirmed. Initial live quality checks are recorded; broad quality validation remains open.

The owner's broader approved direction remains: extensive coverage, two entry points, optional requirement matching, understandable capabilities, evidence and bounded validation handoff. Earlier three-provider/domain limits and pre-build interview/sample-summary gates remain removed.

## Delivered in this milestone

- Independent project directory with tailored AGENTS.md; no application source in the portfolio control repository.
- Live cross-category APIs.guru and MCP metadata adapters, with caching, pagination and explicit source coverage.
- Constrained public documentation reader and bounded worker-based OpenAPI/Swagger extraction.
- Versioned evidence/capability records, input/output summaries and auth declarations, with account permissions always unverified.
- Confirmable requirement records, related-evidence preparation and tested hard-constraint rules.
- In-memory comparison snapshots, Markdown decision-preparation briefs and manual Postman validation guidance.
- Local HTTP protections, session clearing, test suite and backend-only syntax checks.
- A first working frontend following the owner's supplied search-first direction: illustrated query starters, keyword/source search, adjacent capability reader, shortlist, editable requirements, comparison workspace and brief downloads.
- Keyboard search shortcut, accessible native dialogs, focus restoration, mobile adaptation and reduced-motion support.
- Pinned Haiku 4.5 for requirement drafting, quoted plain-language explanations and confirmed-requirement assessment, with a second AI check for non-unknown findings.
- Masked native Keychain setup, visible session opt-in and cumulative US$5 ledger with conservative pre-call reservations. The exposed chat key was never copied or used; live checks began only after replacement-key entry and the owner's spending approval.
- Strict output validation, source-ID/exact-quote checks, explicit selected-evidence coverage, parser omission warnings, bounded requests and safe failure handling.
- A 20-case opt-in paid quality runner using fictional material, separate from the offline test suite. Initial v1: 9/10; expanded v2 and v3: 19/20; final v4: 20/20 after adding a conservative restriction gate. This small suite does not establish real-world accuracy. See [the live evaluation](ai-live-evaluation-2026-09-14.md).
- Requirements-led discovery: opted-in search creates inline editable requirements and phrases, retrieves actual directory matches, and carries reviewed criteria into the shortlist. Free refinements/pagination reuse the draft; expanded MCP retrieval covers up to three pages per batch with partial-failure/cursor safeguards. Documentation failures require an explicit choice before assessing a partial shortlist. See [ADR 003](adr-003-requirements-led-discovery.md).

## What remains before this delivers the full product promise (updated 2026-09-16)

1. **Broader live quality validation:** the replacement Keychain credential and small live suite are working. Add diverse real-document cases, longer compound requirements and repeat runs within the approved spending cap. Retain the failed results; the initial tests do not establish production accuracy or a cross-model quality winner.
2. **Discovery relevance and recommendations:** AI-generated query expansion is connected to real directory retrieval. Broader relevance evaluation, alternative retrieval methods and an evidence-justified recommendation summary remain open. Current comparisons deliberately do not pick an overall winner.
3. **Deeper frontend QA:** the core browser workflow, phone-width layout, keyboard shortcut and reduced-motion behaviour have been checked. Full screen-reader, real-device and broader accessibility testing remain.
4. **Coverage improvements:** bounded MCP indexing now works; exhaustive freshness, better candidate retrieval, accessible provider-doc interpretation, broader formats and explicit product-version selection remain. General web search remains disabled pending provider/access decisions.
5. **Postman — deferred by owner:** discuss scope in the next phase before implementing executable exports. The existing manual checklist remains unchanged.
6. **Local product validation:** run realistic end-to-end examples, assess claim quality and communicate gaps. This is software/product QA, not reinstating the interviews the owner skipped.

No deployment, remote creation, pushing or portfolio-state change. Paid requests require a fresh stored credential, available budget and explicit consent. Read [ADR 002](adr-002-anthropic.md) before changing the AI configuration, credential boundary or spending behavior.
