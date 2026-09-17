# Backend API contract — search-first revision

Local-only JSON service. All mutations require `Content-Type: application/json` except DELETE. Host must match `127.0.0.1:<actual port>` or `localhost:<actual port>`. Browser origins must match the same local host/port. CORS is not enabled. Bodies are limited to 64 KiB; 90 requests/minute and four concurrent discovery/analysis jobs are allowed.

Errors have the form `{ "error": { "code": "...", "message": "..." } }`. Errors never contain raw source bodies or internal stack traces. All responses use `Cache-Control: no-store`.

## Routes

Primary interface routes:

| Route | Body and behaviour |
| --- | --- |
| POST `/api/discover` | `{query, source?: "api", ai?, aiConsent?}`. Nonempty query ≤1,000 chars. Optional internal interpretation → real directory retrieval → AI ranking; no requirement records. Returns server record ID, options, concise relevance/gaps, source coverage and nextRequest. |
| POST `/api/discover/:id/more` | `{ai?, aiConsent?}`. Uses stored original intent and continuation, not caller-supplied replacement queries. Another ranking call with AI on, no new interpretation call. |
| POST `/api/summaries` | `{query?:string, integration, ai:true, aiConsent}`; legacy `{url}` also accepted. Original goal ≤1,000 characters; one generation after safe documentation retrieval. Up to 40 operations selected by project-word overlap, or bounded HTML/Markdown text. Returns query/title/integrationKind/source/evidence/summary. |
| POST `/api/build-briefs` | `{query, integrations, unlinked?:string[], ai:true, aiConsent}`; legacy `urls` accepted. 1–5 distinct selections, including unlinked entries. Validate every URL before fetching. Read docs, record failures/unlinked names, one goal-centred handover generation. No confirmed/priorities/analysisIds fields. All failed →422 without generation. |
| GET `/api/build-briefs/:id/download` | Markdown handover with source quotes, partial coverage, unreadable selections and proposed steps; expired/evicted ID→404. |

`integration` contains `kind: api|mcp|unknown`, optional name/product/version, public `specificationUrl`, `documentationUrl`, `repositoryUrl` or `url`, and optional MCP `remoteEndpoints: [{type: "streamable-http"|"sse", url}]` (at most three). Labels remain unverified context. Public Streamable HTTP metadata enumeration is supported, then repository/documentation fallback; legacy SSE/local execution is not. GitHub roots resolve through the public README endpoint. Every URL is validated before retrieval. No tools are invoked, packages installed or provider credentials accepted.

Summary responses now include `documentationStatus: {state: "available"|"unavailable", basis?, attempts, reason?}`. Available means usable input was read, not verified capability or identity. A free gate rejects unusable evidence and advances through bounded alternate links. When all fail, the summary route returns HTTP 200 with empty capabilities/checks and `generation: "skipped-no-usable-evidence"`, without AI generation. Mixed briefs exclude those selections from AI input and include them in `unreadable`; all unusable yields HTTP 422 with no paid request. Source `evidenceLevel: "server-declared-tool-metadata"` distinguishes tool descriptions from documentation and from live execution. See [source-resolution safeguards and limits](goal-explanations.md).

Goal explanations return `sourceFit: software-docs|unclear`, `capabilities: [{title, does, helps, citations}]`, `checks`, coverage and provenance. `does` describes the documented action; `helps` is a conditional project application. The model selects bounded known `evidenceIds`; the server attaches the exact excerpts as citations. Models cannot author the quoted text. Unknown IDs fail validation (summary withholds the affected capability; brief rejects the invalid response). `unclear` requires zero capabilities. Reference validation is not semantic entailment or live verification. Legacy `/api/analyses` explanations retain their earlier response format.

Discovery reviews at most 24 retrieved entries per batch and returns at most 12. AI rank is a metadata interpretation, not verified feasibility. Known-retired Bing Search IDs are excluded from the catalog using a source-backed lifecycle rule. Linked documentation helps order equally relevant leads; uptime/reputation are not measured. Shortlisting is frontend state and has **no endpoint**. Summaries are reused in the current tab. Ranking failures do not become invented results or silent paid retries.

Other foundation/compatibility routes follow. `/requirements/draft` and `/assessments` are no longer called by the active frontend; their contracts remain for compatibility.

| Method and route | Input | Output |
| --- | --- | --- |
| GET `/api/health` | — | Running capabilities, disabled integrations and retention limits |
| GET `/api/ai/status` | — | Credential presence (never the key), model, readiness, consent version and remaining/reserved budget |
| POST `/api/search` | `{query, queries?, source?, offset?, limit?, mcpCursor?, mcpPages?}` | Metadata results, matched words/phrases, source failures and continuation information; no AI calls |
| POST `/api/analyses` | `{url, offset?, limit?, ai?, aiConsent?}` | 201: analysis, structural capabilities and optional separate `aiExplanation` |
| GET `/api/analyses/:id` | — | Stored analysis or 404 after expiry/eviction |
| POST `/api/requirements/draft` | `{text, ai?, aiConsent?}` | Unconfirmed line-preserving requirements, or AI decomposition with original quotes and clarification questions; priorities always `unsure` |
| POST `/api/assessments` | `{analysisIds, requirements, confirmed: true, ai?, aiConsent?}` | 201: manual evidence preparation or bounded AI comparison with deterministic verdicts |
| GET `/api/assessments/:id` | — | Stored comparison and evidence snapshots |
| GET `/api/assessments/:id/brief` | — | Downloadable Markdown decision-preparation brief |
| DELETE `/api/records/:id` | — | 204: idempotent deletion of this record only |
| DELETE `/api/session` | — | 204: clear all private analyses and assessments |

## Foundation `/api/search` pagination and limits (keyword/legacy contract)

`source` is `api`, `mcp` or `all` (default). `query` is at most 1,000 characters. `limit` is 1–100 (default 20). `offset` is a nonnegative integer. Blank queries browse metadata.

For requirements-led discovery, first request an opted-in AI draft, then pass its `queries` to `/api/search`. `queries` accepts 1–3 nonempty, meaningful phrases of at most 150 characters. Empty arrays/stopword-only phrases fail before network retrieval. When supplied, these phrases—not the original `query` label—drive ranking; `mode` is `expanded-directory-search`. Results are deduplicated by ID and include `matchedQueries`, `matchedTerms` and relevance reasons. Broad technical modifiers are suppressed when more specific words exist; `ignoredModifiers` discloses them. This is weighted word retrieval, not embeddings or a feasibility score. The draft can be edited/reused without paying again.

API results search all preferred-version records in the fetched APIs.guru list. The list can be at most 32 MiB. `availableVersions` records additional version names; searching those versions or fetching them requires a future version-selection interface or supplying their public spec URL directly.

MCP discovery deliberately fetches public pages without transmitting the user's search. `mcpPages` accepts 1–3 pages per batch (default 1; inline AI discovery requests 3), with up to 100 raw entries per page. `pagesLoaded` reports the actual count. `nextMcpCursor` is an opaque source cursor. To continue, send `source: "mcp"`, that cursor, the same `queries`/`query`, `mcpPages`, and `offset: 0`. This searches the **next batch**, not all registry entries. `nextOffset` paginates matches within the current batch, while `nextMcpCursor` advances the source. Partial failures retain loaded entries and expose `partial`, a safe `warning` and a retry cursor where possible. Repeated or invalid cursors stop with an incomplete-coverage warning; a null cursor is not then proof of completeness. Cancellation stops new page loads; an already shared public metadata fetch may finish into the cache.

Source outages yield `status: "unavailable"` with a safe error and no fake replacements; another source can still succeed. HTTP 200 does not mean every source worked. `loadedRecords` and `matchesInLoadedMetadata` describe different quantities. There is no semantic relevance percentage or fit score.

## Analysis records

Analysis fetches at most 8 MiB with a 15-second deadline and at most three redirects. Parsing runs in an isolated worker with a five-second deadline and 128 MiB old-generation heap limit. Public IPv4 HTTPS only; external schema references, custom YAML tags and YAML aliases are not supported.

Supported forms: OpenAPI 3.0/3.1 JSON or YAML, Swagger 2.0, HTML excerpts. OpenAPI 3.2, Postman source imports, GraphQL schemas and PDFs are not implemented. Optional AI interpretation is separate from structural parsing. This is not a full specification validator. Malformed structures or resource limits may produce a safe parse failure.

An analysis page contains at most 100 operations, 50 inputs per operation, 20 responses per operation and 30 fields expanded to depth four per schema. Only the first media type is expanded. Skipped operations, references, callbacks, webhooks and composed schemas are flagged where encountered. More operation pages can be requested with `offset`, refetching the same URL; compare `revision` before combining pages because the source may have changed.

Evidence has a stable ID, JSON-pointer location or excerpt marker, retrieved date, content hash and source URL. Evidence locations identify source text; they do not verify claims. The source's provider ownership is not independently verified. API authentication declarations do not establish a user's actual key permissions. No request is executed from an analysed specification.

## Legacy comparison example (not the active interface)

Send each body to its corresponding POST route. These are examples, not a prepopulated fixture mode.

```json
{ "query": "weather forecast", "source": "api", "limit": 10 }
```

Take a returned public `specificationUrl`:

```json
{ "url": "<returned specificationUrl>", "limit": 20 }
```

After reading the resulting capabilities, confirm requirements:

```json
{
  "analysisIds": ["<returned analysis id>"],
  "confirmed": true,
  "requirements": [
    { "id": "r1", "text": "Hourly forecasts for Singapore", "priority": "must" },
    { "id": "r2", "text": "Historical observations", "priority": "nice" }
  ]
}
```

Use 1–30 unique requirements, with `must`, `nice` or `unsure` priorities and text up to 1,000 characters. Up to five distinct analysis records can be compared. An API key is never required or accepted as an analysis input.

Download `/api/assessments/<id>/brief`. Until AI interpretation is enabled, the comparison is an evidence workspace: related terms may be attached, but all semantic findings remain unknown and no recommendation is produced. This is intentional, not an unsupported verdict.

## Optional interpretation contract

AI calls require `ai: true` and `aiConsent: "anthropic-project-text-v1"`, a fresh credential in the fixed Keychain item and available budget. This is an explicit consent boundary, not authentication against same-user native processes. Invalid/missing consent produces 403 without model calls. Missing service/credential/budget produces a safe failure. Do not send credentials in request bodies.

Analysis explanations contain separate `summary`, `capabilities` and `limitations` arrays with exact source quotes, plus model/prompt/review provenance. A statement failing quotation checks is omitted in full; `withheldStatements` exposes the count, never the rejected text. The remaining statements still require strict IDs and exact substrings. Source records remain server-owned. Operation details are citable derived excerpts, not a new fetch or proof of runtime behavior. HTML text is split into citable 1,500-character blocks.

AI comparisons support up to 10 requirements and 5 analyses. Each candidate receives a bounded selection of up to 40 / 28KB evidence excerpts with parser warnings. `aiCoverage` reports selected and available excerpts; coverage is also exported. An initial model assessment is validated before a second model call checks non-unknown findings. Failed checks downgrade to unknown. No arbitrary client evidence, client-selected model/host or executable instructions are accepted.

An unsupported finding also needs recognised restrictive wording in its exact source quotes before it can reach secondary review. Otherwise `restrictionGate: "no-explicit-boundary"` records its conservative downgrade to unknown. This English-oriented lexical gate is not semantic proof and does not cover every form of valid contradiction; human review remains necessary.

Calls use fixed Haiku 4.5, bounded structured output and no tools/retries. The cumulative US$5 ledger reserves the full 200K context cost plus maximum output before paid generation, then reconciles known usage. Cancelled/ambiguous calls retain reservations. Session clearing aborts pending jobs but does not clear the ledger. Details: [ADR 002](adr-002-anthropic.md).

The deterministic decision engine has four results: `does-not-meet-must-haves`, `insufficient-evidence`, `conditional-fit`, and `meets-documented-must-haves`. An unsupported must-have dominates all optional positives. Unknown is not unsupported. Unconfirmed priorities or unknown must-haves prevent approval.

The finding validators check requirement completeness, exact output schema, allowed statuses, source evidence IDs, exact quotation substrings and explicit conditions. These checks and a second AI pass do not prove semantic correctness. No HTTP route accepts arbitrary model verdicts or permits caller-supplied evidence to bypass analysis. Outputs explicitly remain AI-interpreted, not human-reviewed or live-tested. Initial live observations and failures are recorded in [the evaluation report](ai-live-evaluation-2026-09-14.md); broad quality remains unvalidated.
