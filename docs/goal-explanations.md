# Goal-centred explanations

## Source-resolution correction — 2026-09-15, later update

The earlier Graffeo handling below was incomplete: it improved wording but discarded the registry's MCP connection URL and treated a readable retail homepage as summary input. This correction replaces that behaviour for all selections, without a provider/domain allowlist.

- MCP connection URLs now survive catalogue normalization, selection, summary/brief requests and cache keys. Public Streamable HTTP connections are inspected through `initialize`, `notifications/initialized` and `tools/list` only. This follows the supported [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle) and [Streamable HTTP transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). No tools/resources/prompts are invoked, packages installed, user requirements sent to MCP servers, or provider credentials collected.
- Network protections are shared with the public-document boundary: public HTTPS, pinned public IPv4 DNS, no proxies or pooled sockets, byte/time limits, and no redirected MCP POSTs or session-header forwarding. Sessions stay in the reader's memory, never in evidence, records or logs. Server-initiated requests are ignored. Only tool names/descriptions and bounded input/output field descriptions enter the evidence pipeline; they remain untrusted server declarations, not observed behaviour or ownership proof.
- APIs prefer specifications; MCPs prefer available remote tool descriptions, then repository/documentation links. A free preflight gate checks for safe structured capability evidence or conservative software-documentation prose signals. A readable but irrelevant page now falls through to the next source. HTML can expose up to three explicit same-origin documentation links, followed one hop only. At most seven document candidates and three remote candidates are considered within a 35-second selection deadline. MCP enumeration reads at most three pages/200 tools and selects at most 40 for evidence; pagination/truncation is recorded.
- No usable evidence: HTTP summary returns an unavailable status with empty capabilities/checks and `generation: skipped-no-usable-evidence`, without calling the model. The UI shows “Capabilities couldn’t be verified” and “No AI credits were used.” It does not show the project-use heading, source-evidence claims or research homework. If the model itself finds the usable-looking source insufficient, its empty result is also compact, but does **not** claim generation was free.
- Mixed briefs exclude unreadable/unusable selections from AI input and name them separately in the UI and download. All unusable means no paid brief generation. Model-returned empty explanations cannot retain invented checking tasks. Catalogue links are labelled as links, not verified documentation; ranking instructions explicitly reject a named retailer's catalogue as proof of cross-venue discovery.
- UX-copy skill influenced the failure state: short source-status wording, accurate credit messaging and named unverified brief selections, while retaining the approved visual design.

### Verification of this correction

- 156 automated tests passed and the production build passed. New cases cover metadata propagation, public connection inspection, session/privacy boundaries, pagination, unsupported/authenticated/empty/malformed connections, irrelevant API/README fallback, bounded same-origin link discovery, cancellation, POST allowlisting, redirects/private DNS, kept-open SSE responses, no-AI failure states and mixed briefs.
- Live Graffeo inspection returned HTTP 503. Its retail homepage failed the free gate. The full summary route and real browser showed unavailable capabilities with zero generation, rather than a misleading summary. This does not establish whether the provider will recover or what its tools can do.
- Live Context7 enumeration read two tool descriptions without invoking either. A live summary and mixed Context7/Graffeo brief succeeded; the download returned HTTP 200 and named Graffeo as unverified. Content quality remains directional: the model still used some developer vocabulary for the technical-documentation project, so this is not a broad plain-language quality certification.
- Live TomTom Search OpenAPI passed the shared gate with 19 parsed operations. API/MCP fallback and mixed-type contracts also have fixture-backed regression tests.
- Paid smoke checks: charged/reserved budget moved from $0.850810 to $0.859915 (difference $0.009105); $4.140085 remains under the unchanged $5 cap. No ledger reset or provider-tool execution.

### Limits that remain

This is bounded source resolution, not a universal web crawler or identity/entailment verifier. The free prose gate is a conservative English-language heuristic: it can miss genuine terse/non-English docs or admit misleading software-looking text. The model still checks source fit; passing the gate does not prove the selected integration matches the page. Login-only docs, JavaScript-only pages, unsupported specifications, local/package-only MCP execution, legacy SSE transport and unsupported protocol versions are not bypassed. Those integrations can still use their readable linked docs; otherwise they remain unverified. Supported handshake versions are 2025-11-25, 2025-06-18 and 2025-03-26; the newer stateless protocol is not implemented. No OAuth/account access is attempted. Metadata-only server sessions are not resumed or retried.

## Acceptance checks (defined before implementation)

- A summary receives the original search, not an inferred requirement form. Each useful capability explains both what the source documents and how a builder could apply it to that goal.
- Plain language: no unexplained endpoint names, geometry jargon, schemas or transport details in the main explanation. Technical evidence is available on request.
- Source fidelity: every capability has an exact source quote. Suggested application is explicitly conditional; it must not introduce unproven data, coverage, access, reliability or automation. Quote validation establishes provenance, not semantic truth.
- Missing details remain checks, not claims of absent features. A retail page cannot establish API/MCP capabilities. An unreadable or irrelevant page cannot prove that an integration does not exist.
- API and MCP explanations share the same layout. MCP selections retain identity and prefer public tool descriptions, then linked repository documentation. No installation or tool execution.
- Build briefs use the same capability/application format, retain source dates and outstanding checks, and include only the selected integrations.
- Search and shortlist remain unchanged. One optional model generation per explanation/brief. Reopening the same explanation is free; changing the goal or source invalidates its in-tab cache.

## Directional quality cases

1. Cafe finder: documented general place search and location filters can support finding nearby candidates. Specialty status, bean origin, roast and inventory remain unconfirmed unless directly documented.
2. Same source, different goal: a delivery-address workflow must not receive the cached cafe explanation.
3. Coffee MCP: documented coffee search/read tools are explained as abilities available to an AI assistant, not a conventional REST API or a complete recommendation engine.
4. Retail landing page: no software capability evidence means an honest source limitation, never a categorical “this is not an API/MCP” verdict.
5. Mixed API/MCP shortlist: each selected tool has a distinct, conditional project role; no invented glue code or access guarantees.
6. Large source: relevant operations after the first 20 and later README sections remain eligible within explicit parsing limits.

Unit/integration tests cover structure, provenance, bounds, consent, cancellation and caching. A small live smoke test is a directional content check, not an overall quality certification or a fresh search holdout.

## Source resolution reference

GitHub's [repository README endpoint](https://docs.github.com/en/rest/repos/contents#get-a-repository-readme) reads the preferred README of a public repository without authentication. All reads still pass through APIFit's public-HTTPS/DNS/size/time boundary. Repository ownership, installed version and actual exposed tools are not verified.

## Implementation notes

- The active summary/brief model schema asks for source IDs rather than model-authored quotes. The server checks IDs against the source-specific evidence selection and attaches exact excerpts. This avoids citation-copy errors; it does not establish that every claim is entailed.
- Summaries: ≤3 capability/application pairs, ≤2 checks, ≤180 words excluding source excerpts. Briefs: ≤2 pairs and ≤2 checks per selected integration, ≤140 words per integration. Prompts aim below those limits. Valid excess prose is omitted as complete blocks, never cut mid-sentence. All source references are checked before presentation trimming. Invalid model output is never silently retried.
- Brief model output is an object with exactly the locally generated candidate-ID keys; the server renders one section per selected integration. This prevents duplicate integration entries. Array-length guidance alone was not reliable in live tests. Anthropic's [structured-output limitations](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) mean array maximums are enforced locally rather than added as unsupported schema keywords.
- Bounded reading: 40 project-selected OpenAPI operations; up to 96,000 readable HTML/Markdown characters. Selection uses word overlap, not comprehensive semantic search. Summary evidence ≤22 KB/28 excerpts; each brief source ≤5 KB/8 excerpts. Relevant details can still be omitted.
- No server-persisted private summaries. The tab caches by goal, kind, product/version and source links; backend records retain the existing 15-minute expiry. Reopening is free; a changed goal needs a new on-demand generation.

### UX rationale

| Before | After | Why |
| --- | --- | --- |
| Generic introductory paragraph and technical capability bullets | Named action, one factual sentence, one “For your idea” application | Explains the mechanism and product value together |
| API wording for every source | API/MCP identity and appropriate app/assistant language | Avoids conflating MCP server tools with an underlying API |
| Full checklist and unstructured handover | Shared explanation layout; generic checklist behind disclosure | Applies Emil/Apple progressive disclosure without changing the approved visual identity |
| Source title could replace the selected integration | Selected name remains; unrelated source yields a limitation | A retail page cannot disprove the selected integration |

## Verification — 2026-09-15

- **143 automated tests passed**, including context-specific caching, source-ID validation, safe URLs, cancellation, MCP repository preference/fallback, later-document relevance, mixed briefs, export safety, consent and budget protection. Build passed; 45 backend/test-script modules syntax-checked.
- **Live API:** TomTom Search for a cafe/bean-preference idea produced location/category capabilities, possible uses for the cafe finder, and checks for bean data rather than asserting it exists.
- **Live MCP:** Anki MCP Server was read through its public GitHub README. The browser explanation connected documented review, card creation and filtering to an AI tutoring idea. No MCP operations were executed.
- **Earlier incomplete irrelevant-source check:** Graffeo's registry entry has no repository link and points at a retail website, but also supplies a separate MCP connection. That connection was missed in this earlier implementation; see the source-resolution correction above.
- **Live brief:** A shortlisted Anki server generated and displayed successfully. A separate mixed TomTom API + Anki MCP handover returned two named sections; its Markdown download returned HTTP 200 with both sources and the capability/application wording.
- **Browser:** inspected Pearl light and near-black dark; evidence and generic checklist collapsed initially; shortlist/save/reopen and cached brief view worked; download action raised no UI error. No browser console errors in the final flow. No mobile viewport or broad accessibility audit claimed.
- Initial live testing caught copied-quote failures and extra model-generated brief sections. These prompted server-supplied excerpts, exact per-candidate schema keys and whole-block brevity handling. Earlier failed calls are included in budget usage, not hidden or automatically retried.
- Budget observed at start: $0.729612 charged/reserved. After checks: $0.832686; **$4.167314 remains** of the unchanged $5 cap. Difference during this work: $0.103074. No ledger reset, premium model or new service.

### Remaining limits

These are directional smoke checks, not a quality certification. The model can still repeat related checks or use source-specific terminology (e.g. Anki “notes”, “fields” and “tags”). Exact source references do not guarantee that every suggested use follows from them. A bounded README can omit needed tools; generic repositories, non-GitHub repository pages and missing public docs still need better source links. Documentation coverage, account access, actual data quality, uptime and installed MCP tool availability remain unverified. The existing search-ranking quality limitations are unchanged; this work improves on-demand explanations and handovers, not the ranking evidence pipeline.
