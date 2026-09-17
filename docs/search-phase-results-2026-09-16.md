# Search-to-brief phase verification

2026-09-16. This record covers the continuation requested through the next phase. The [phase gate](search-phase-gate.md) defines that boundary: complete the local search-to-brief workflow and its checks, then discuss validation/Postman separately. No deployment or Postman implementation is authorized by this milestone.

## Changes

- Separate named-product lookup from capability matching in the existing two-step AI search. A real named API/MCP listing can be a discovery lead even when its capabilities or ownership are not verified. Negative clauses do not cancel a positive request.
- Preserve API/MCP input/output direction, explicit exclusions and unrelated-request abstention. No named-provider allowlist, guessed results or automatically paid documentation reads.
- Neutralize ranking prose that asserts official/verified/safe/reliable status. Keep the candidate as a partial directory lead rather than laundering a registry assertion into a guarantee. This is a conservative wording safeguard, not a semantic verifier; it can also neutralize an otherwise useful explanation containing one of those terms.
- Record only task names, token counts and count/generation durations in the optional evaluation observer. No project text, source content, URLs or credentials are added to telemetry.
- Download the brief already held in the tab using a shared deterministic Markdown formatter. The former server-dependent download could fail after the 15-minute record expiry despite the brief still being visible. Download now requires neither a server record nor another AI request. Existing server exports and privacy expiry remain unchanged.

The broader MCP index and lexical fix remain active. The earlier experimental intent/evidence ranker remains **disabled by default**. No visual redesign, requirement editor or paid shortlist check was introduced.

## Frozen challenge set: before and after

The 28 fictional cases were frozen before this prompt revision: 14 development and 14 held-out outputs. Identical saved public catalogue metadata was replayed. The holdout outputs were first read after the final code/prompt revision had run. References are examples, not a complete set of acceptable products; results are not a general accuracy score or independent human evaluation.

| Measure | Baseline | Final v4.1 |
| --- | ---: | ---: |
| Requests completed | 28/28 | 28/28 |
| Reference leads available in source | 22/23 | 22/23 |
| Available references retrieved into candidate pool | 20/22 | 22/22 |
| Reference lead in first three results | 17/23 | 21/23 |
| Development reference in first three | 7/11 | 10/11 |
| Held-out reference in first three | 10/12 | 11/12 |
| Explicitly forbidden results in first three | 0 | 0 |
| Unrelated/cancelled/fictional requests correctly empty | 5/5 | 5/5 |
| Request errors | 1 | 0 |
| Median / 95th-percentile latency | 7.1 / 20.2 s | 6.7 / 22.5 s |
| Charged or reserved | $0.135531 | $0.141393 |

The intermediate 14-development-case run cost $0.075180, had no request errors and returned references in the first three for 10/11 reference cases. Its outputs exposed unnecessary alternatives and “official” wording; the final revision tightened the prompt and added the assurance safeguard. This is a disclosed development iteration, not a separate holdout success.

### What the numbers do and do not show

- The original GitHub and Context7 false-empty requests now return their named products first, as do differently worded held-out lookups. The Weatherbit lookup that previously failed output validation also returns the product.
- DeepL is missing from the frozen source snapshot. The explicit DeepL-only request appropriately returns no substitute; this remains a source-coverage miss in the denominator.
- The generic MCP-registry request ranks several actual registry-search listings above the frozen reference (reference at position five). Their descriptions support the requested search/discovery action, but the metric remains a miss: references were not retroactively expanded to inflate success.
- Some named-product-plus-feature requests still return additional products, and the model sometimes copies technical directory vocabulary into the short result reason. Do not claim perfect identity exclusivity or plain-language ranking quality.
- The slowest two final requests spent approximately 20–21 seconds in AI generation, versus under one second in token counting. Timing is from one local run, not a service-level guarantee; live source fetches can add latency.
- Quote validity, known IDs and the wording safeguard do not prove full semantic correctness. Directory-based matches can still overstate a capability or rank an adjacent component too highly. On-demand documentation explanations remain important, but are not live integration tests either.

## Reproducibility and cost boundaries

Ignored local run folders: `phase-baseline`, `phase-revised-dev`, `phase-final`. Each has dataset/snapshot/source fingerprints, per-case outputs, usage and completion records. Only the checked-in fictional corpus is accepted by this runner; private user queries are not saved. Each phase run is capped at $0.50 within the existing cumulative $5 ledger; uncertain reservations remain counted. No automatic retries or model escalation.

Free reports:

```sh
npm run search:eval -- --v2 --phase-gate --run phase-baseline --split all --report
npm run search:eval -- --v2 --phase-gate --run phase-final --split all --report
```

## Broader regression and final corrections

The existing 50-case corpus is a regression set, **not a fresh holdout**. The earlier baseline used the smaller MCP page window; report the common covered subset separately. Do not compare source coverage alone as ranking quality.

| Measure | Earlier v2 baseline | v4.1 broad check | v4.3 broad check |
| --- | ---: | ---: | ---: |
| Requests | 50 | 50 | 50 |
| Reference leads available | 39/46 | 45/46 | 45/46 |
| Reference in first three | 37/46 | 42/46 | 42/46 |
| Common source-covered reference in first three | 37/39 | 36/39 | 37/39 |
| Forbidden result in first three | 0 | 1 | 0 |
| Correct unrelated-request abstention | 4/4 | 4/4 | 4/4 |
| Errors | 0 | 2 | 0 |
| Median / p95 | 5.0 / 9.4 s | 6.5 / 17.4 s | 6.4 / 14.4 s |
| Charged or reserved | $0.291354 | $0.510674 | $0.300004 |

These runs exposed issues worth fixing rather than hiding behind the aggregate improvement:

1. **Provider error:** v4.1 stopped at d28 after `AI_UPSTREAM`. Its $0.215 generation reservation remains charged. A deliberate resume skipped all completed cases, including that failed case; no automatic retry. This accounts for much of the higher v4.1 recorded cost.
2. **Weatherbit quotation:** a focused diagnostic ($0.005635) reproduced a long quote with a silently repaired URL. It was correctly rejected. Named lookup instructions now favour a short identity citation. A deterministic safeguard replaces capability claims supported only by complete Name/Product lines with a neutral, partial identity lead. It does not weaken the exact-quote boundary.
3. **Wrong barcode action:** the initial wording-only correction still admitted image decoding as a partial product-lookup solution. Retained run `phase-correction-check`: three cases, one forbidden result, $0.018812. A concrete fictional requested-output example then passed the focused check ($0.005612) and the full v4.3 run. This is measured prompt improvement, not guaranteed semantic enforcement.
4. **Negation fed into positive keyword matching:** v4.3 d07 generated `messaging API not Twilio`, crowding the candidate pool with the excluded provider. The final deterministic normalization removes negative suffixes from generated phrases, while ranking receives the untouched original request. It preserves words such as Notion, no-code and leading product names such as Not Boring API. This bounded grammar rule is not general natural-language understanding.
5. **Relevance lost after ranking:** v4.3 h11 put GitHub's own named listing first in the model output, but the server demoted its partial/identity tier below three other connectors. Final ordering preserves model relevance order; source-link strength and conservative evidence labels no longer override it. The same ordering marker is used when the UI appends another batch.

### Free replay and targeted final check

`node scripts/search-phase-replay.mjs` replays the frozen v4.3 run without credentials, network fallback or model calls. It reproduces the production omission of credential-like listing excerpts before mapping IDs. It found **only d07's candidate pool changed** after normalization; the other 49 cases were unaffected by that retrieval change. Replaying saved model output through the final ordering changes h11 from a top-three miss to a hit, with no lost reference hits. Thus the free replay reports 43/46, still retaining d07's old miss rather than pretending new retrieval equals successful ranking.

The final five-case **live** check (`phase-release-delta`) then exercised d07, d33, d34, h11 and h13 using both fixes: **5/5 reference hits, 0 errors, 0 forbidden results**, $0.035216. This is targeted verification on retired cases, not a new 50-case accuracy result. The final v4.6 version keeps that search logic and adds explanation/brief readability and MCP source-format instructions, verified separately in the browser.

## Remaining limits

- DeepL is absent from this source snapshot; no substitute is invented for a DeepL-only request.
- The captured-screenshot/console-evidence MCP request still misses its reference. Some returned tools capture new screenshots instead of inspecting the supplied evidence. This remains a retrieval and semantic-ranking weakness, not a solved case.
- A request for a provider's own integration can still list third-party alternatives below the intended first lead. Strict identity-only filtering remains imperfect; do not label all returned rows official or equivalent.
- Result prose can still include unproven details, pricing language or technical wording. Quotes and IDs establish provenance, not complete semantic entailment. Broad quality remains marked unvalidated in configuration.
- Latency observations are from a local development session with other local checks; one attempted browser generation overlapped the evaluation and was correctly refused by the budget lock without a paid generation. These are not controlled load tests or SLAs.
- No real integration operation, account entitlement, uptime, reliability or data quality has been tested. Directory breadth does not equal exhaustive or continuously current market coverage.

## Final workflow verification

189 offline tests pass; 60 modules are syntax-checked. Production build passes. The new shared export and replay helper are syntax-checked. Additional checks cover identity-only citation downgrades, relevance ordering, negation normalization, export escaping, MCP-specific evidence context and an expired server record with a still-downloadable tab copy. Existing HTTP tests cover API/MCP unusable-source no-generation behaviour, mixed brief handling, source safety and free local saves.

### Browser observations and retained failure

An isolated browser tab and loopback QA server were used; the owner's existing tab was not reloaded or cleared. Free search and immediate saves worked. TomTom's API explanation connected documented location lookup to the project; the Understand entry point also read its public specification. Some wording remained technical (for example, location bias), despite the readability instruction. This is a remaining copy-quality limitation, not a perfect plain-language pass.

The Context7-only AI request returned its named listing first, but its first explanation was empty. A read-only diagnosis found three usable excerpts from its public tool descriptions. The evidence context misleadingly used a generic README/version warning, while the source-fit prompt did not clearly include MCP tool metadata as software documentation. The final revision distinguishes advertised tool functionality from tested results or verified ownership, without relaxing source checks or executing tools. A fresh browser explanation then returned two goal-linked capabilities: looking up framework documentation and finding its matching library record. The build brief independently returned both capabilities with source evidence collapsed and two practical checks. Some library-ID terminology remains in the standalone explanation; the brief was clearer. This is a single live MCP smoke, not broad summary-quality certification.

After generating the brief, the QA server was stopped. Download produced the expected Context7 Markdown file in Downloads; its contents were inspected and matched the visible goal/capabilities, source labels and untested-build disclaimer. The browser automation download-event waiter timed out, but the actual newly timestamped file independently confirmed the download. Reopening the explanation from the shortlist also succeeded with the server offline, demonstrating tab-cache reuse rather than another paid request. The QA download is fictional test output, not a saved private user brief.

### Budget

End-of-check ledger: **$4.294317 charged or conservatively reserved; $0.705683 remaining** of the unchanged $5 cap. This continuation used $1.473581 from its $2.820736 starting ledger. Uncertain reservations remain counted; no reset, refund assumption, automatic retry or model escalation. No further paid checks are required for this handover.

### Requirement-by-requirement decision

| Gate | Evidence and decision |
| --- | --- |
| Central search and free shortlist | Browser flow and HTTP tests pass. Real directory leads only; no added requirements form. Ranking and reliability are not certified. |
| Reproduced named/API/MCP failures and exclusions | Frozen 28-case comparison, broad regression, free replay and targeted final live checks support the fixes. Own-provider exclusivity remains imperfect below the intended lead. |
| Broad retrieval preserved | Wider MCP index retained, default-off experimental ranker unchanged, common-covered broad result restored to 37/39. The captured-screenshot case and source gaps remain recorded. |
| On-demand API/MCP explanation, brief and export | API and MCP browser paths pass, including the corrected MCP source-fit case, cached reopening and server-independent download. Readability is improved but still needs human review; no claim of universal source support. |
| Safety, privacy and budget | Existing safeguards and regression tests pass. Metadata only; no API/MCP operations. $5 cap, opt-in, memory-only private state and conservative reservations unchanged. |
| Layered verification | 189 tests, 60 syntax checks, production build, paid output checks and real browser flow complete. Failures and limitations retained above rather than hidden by aggregate scores. |

**Decision: local search-to-brief implementation and bounded verification are ready for the next product-validation/scope discussion.** This is not production readiness, perfect relevance or fully validated prose quality. Next, review realistic requests and wording with the owner; choose whether to prioritize the recorded retrieval/identity/copy gaps or separately scope Postman validation. Postman remains paused. No deployment, public exposure or new budget is included.

Handover: the main server was restarted at `http://127.0.0.1:4173` with the final build and its health check passed. The isolated QA server is stopped. The owner's browser tab was not reloaded. APIFit's existing untracked project state is preserved; no commit, remote or push was made. The sibling portfolio repository was not edited (its pre-existing untracked `docs/research/` remains).
