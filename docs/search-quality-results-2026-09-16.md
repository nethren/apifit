# APIFit discovery evaluation and release decision

2026-09-16. Local development, not a public release. Postman remains deferred.

## Outcome

**Ship the broader MCP catalogue and conservative duplicate removal; do not enable the experimental ranker.** The additional evidence and stricter request interpretation increased complexity without consistently producing better recommendations. Existing search, free shortlisting and on-demand explanations/build briefs remain in place. The milestone is partially delivered, not a completed recommendation-quality upgrade.

Active changes:

- MCP discovery searches a query-independent latest-version registry index, with bounded refresh, cached public metadata, and explicit incomplete/stale status. The live snapshot completed 324 pages and contained 31,972 normalized entries. This is a registry traversal, not exhaustive internet coverage, verified ownership or a safety review.
- API aliases are merged only when publisher, title, version and original specification URL agree. Different dated specifications and enterprise products remain separate. This reduces exact aliases, not all visually similar results.
- The approved interface is unchanged. Saving/removing shortlist items makes no AI call. Documentation explanations and build briefs are still requested explicitly.

Held back:

- Strict AI extraction of named-product/publisher restrictions.
- Automatic bounded documentation enrichment for search ranking and its new ranking prompt.

Both are implemented behind `createApp({ evidenceSearch: true })`, **false by default**. Ordinary startup does not opt in, and browser request fields cannot switch it on. The evaluation runner now requires `--experimental` to test this path. Existing summary/source-resolution safeguards are independent and remain active.

## Method and limits

The [plan](search-quality-v2-plan.md) and [50 fictional requests](../tests/search-quality-v2-cases.json) were frozen before the baseline: 35 development and 15 held-out cases, including 46 requests with reference leads and four intended abstentions. Development outputs informed iteration; held-out response details were not used to tune the changes. This holdout is now retired and must not be called fresh in another iteration.

The same immutable directory snapshot contains the original three MCP pages and a broader latest-only traversal bounded at 300 pages / 30,000 raw records. The larger evaluation snapshot is incomplete by design; the separate live application traversal completed within its 400-page bound. Snapshot SHA-256: `1d571f49906e769231df129e0f6281c0814741d2d70b05aaa049aac1ce30a8ec`.

Public documents were read through the safe fetch boundary and recorded/replayed with integrity checks. No MCP tools or API operations were executed. Only fictional requests are persisted in evaluation results; private user requests remain in memory. All paid calls used the existing credential adapter and unchanged US$5 ledger, with no automatic paid retry.

“Reference in top three” means that at least one agent-authored expected product appeared among the first three results. It is **not recommendation accuracy**: reference sets are incomplete, most other results are unjudged, and there is no independent human relevance/claim audit. Directory presence, successful retrieval, good ranking, useful explanation and operational reliability are separate measures. No reliability/uptime assessment was performed.

## Before/after results

| Saved run | Cases | Source coverage¹ | Reference in top 3 | Hits among covered cases | Request errors | p50 / p95 | Charged/reserved |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `v2-baseline` | 50 | 39/46 | 37/46 | 37/39 | 0 | 5.04s / 9.44s | $0.291354 |
| `v2-revised-dev` | 35 | 33/33 | 27/33 | 27/33 | 2 | 6.28s / 13.15s | $0.445297 |
| `v2-final` — intermediate | 50 | 45/46 | 40/46 | 40/45 | 1 | 5.61s / 10.43s | $0.330910 |
| `v2-release` — intermediate | 50 | 45/46 | 38/46 | 38/45 | 3 | 6.41s / 11.00s | $0.373149 |
| `v2-grounded-final` — last experiment | 50 | 45/46 | 33/46 | 33/45 | 0 | 7.03s / 12.77s | $0.351493 |

¹ Presence of at least one reference in the selected source corpus, not retrieval success. One DeepL-only reference request was still outside the broader frozen source coverage. Names such as “final” and “release” are historical run IDs, not acceptance decisions. Runs preceded introduction of the explicit default-off experiment flag; manifests retain the source fingerprints used at the time.

The common covered subset is the clearest regression check: **baseline 37/39 versus last experiment 28/39**. Broader MCP coverage improved overall reach but cannot compensate for losing useful results already present in both corpora. On the 15 held-out cases, both runs found nine of 13 reference leads in the top three, but available reference coverage changed from nine to twelve; this is not evidence of improvement.

| Request type | Baseline top-3 reference | Last experiment |
| --- | ---: | ---: |
| Simple | 6/6 | 5/6 |
| Medium | 10/11 | 9/11 |
| Complex | 6/6 | 5/6 |
| Named product/provider | 13/17 | 8/17 |
| Official-provider MCP | 0/4 | 4/4 |
| Explicit negative constraint | 2/2 | 2/2 |

All four full 50-case runs correctly returned no results for the four abstention cases. The intermediate `v2-final` returned one explicitly forbidden top-three item; baseline and the final experiment returned none of the small predefined forbidden set. **That does not mean they had no irrelevant results.** Baseline had 31 unjudged top-three entries and the last experiment 23. Neither set has been comprehensively labelled.

Latency includes request processing but excludes initial index construction because the runner prewarms the frozen index. Documentation timings mix cache hits, recorded replay and source retrieval. These are not clean production cold/warm latency estimates. The last experiment used 313,393 input and 7,620 output tokens across 50 cases versus baseline 237,109 and 10,849. Small, single-run synthetic samples do not establish statistical significance or typical user cost.

## What failed and why it matters

1. **Candidate retrieval, not just ordering.** Query expansion can miss a named integration before the ranking model sees it. More catalogue entries can introduce more competing lexical matches. Ranking cannot recover a missing candidate.
2. **Over-strict intent extraction.** Literal-name grounding prevented invented strings but still admitted phrases such as “Only Stripe's own” as product identities, or fragmented a multiword publisher. These malformed restrictions hid valid APIs. Matching a substring does not establish correct interpretation.
3. **Partial solutions were sometimes discarded.** A places API can help find bakeries even if it cannot supply today's gluten-free stock. The experiment sometimes rejected the useful discovery component because it could not fulfil the entire compound goal.
4. **Action mismatch survived source citations.** Barcode decoding is not the same as finding a product's brand/name from a barcode number. Selecting a real excerpt establishes traceability, not that the cited capability solves the user's job. Some barcode services can decode as well as generate images; the failure is product lookup mismatch, not a blanket claim that they only generate images.
5. **More evidence increased delay and noise.** Parameter-heavy specifications displaced useful operation descriptions until selection was adjusted. Even after structural fixes, recommendation quality did not meet the no-regression gate.

These issues remain explicit rather than being hidden behind confident suitability or reliability scores. The existing directory-only ranker also has limitations; holding back the experiment does not certify the old one.

## Check of the shipped combination

After disabling the experimental ranker, a four-case paid smoke run (`v2-shipped-smoke`) tested the actual default configuration with the indexed frozen corpus:

| Request | Result |
| --- | --- |
| GitHub REST API | Reference ranked first; exact aliases collapsed, distinct specification/product versions retained |
| Microsoft's Playwright MCP | Reference ranked first |
| GitHub's official MCP | **Missed during retrieval**; a registry-management lead was returned instead |
| Context7 MCP | Reference ranked first |

No request errors; three of four reference hits; $0.020507 charged. This is a **smoke check, not broad acceptance** of the shipped combination. The official GitHub miss is a next-priority defect. No additional paid iterations were started after this check.

Final verification:

- `npm run check`: **175/175 automated tests pass**, 53 backend modules pass syntax checking, and the production frontend builds.
- Default-off experiment and inability to enable it through browser flags are regression-tested.
- Index pagination, failed-refresh retention, bounds, cache behaviour, alias preservation, cancellation and evidence provenance have offline coverage. Passing these tests establishes specified mechanics, not AI usefulness.
- Browser: free API search, free Context7 MCP search, immediate shortlist updates and the on-demand explanation consent boundary checked. After the final restart, Context7 appeared first among four keyword options and could be shortlisted with AI off. Existing user tabs were not reset.
- The local app was restarted at `http://127.0.0.1:4173/`. No deployment, Postman changes, provider-key collection, new paid services or portfolio-state changes.

## Budget and audit trail

After the final smoke check: **$2.753295 charged or conservatively reserved; $2.246705 remaining of $5**. These are local safety-ledger amounts, not a reconciliation of Anthropic's invoice. An ambiguous upstream failure retained its $0.213 reservation; the ledger was not reset or increased.

The table accounts for $1.792203 in baseline/experimental runs. The two smaller diagnostics cost $0.007159 and $0.021941; the shipped smoke cost $0.020507. Since the baseline's starting ledger of $0.909645, the cumulative increment was $1.843650, including $0.001840 from the separate browser AI smoke. Retained paid failures are included, not silently removed from metrics.

Raw results, source snapshots and public-document replay fixtures remain in ignored `output/search-quality/`, with manifests, dataset/snapshot digests, source fingerprints, per-case outputs, tokens and costs. This report and the fictional corpus are project documentation; actual private requests are not part of the fixtures. Every attempted run was retained, including the misleadingly named intermediate runs.

Free reporting commands:

```sh
npm run search:eval -- --v2 --run v2-baseline --split all --report
npm run search:eval -- --v2 --run v2-grounded-final --split all --report
npm run search:eval -- --v2 --run v2-shipped-smoke --split development --cases d17,d25,d26,d27 --report
```

## Next work, in order

1. **Repair candidate retrieval first.** Use saved failures to test identity-aware retrieval without hard filtering on ambiguous AI-selected phrases. Preserve capability alternatives for compound requests. Start with the official GitHub miss and the address/geocoding misses; keep source coverage separate from the top-24 candidate limit.
2. **Evaluate one change at a time.** Compare the current indexed default to one focused fix, using a fresh held-out set and the remaining budget. Do not combine query planning, corpus expansion, evidence selection and new ranking in one next experiment. Do not spend the remaining cap on repeated broad prompt iterations without a concrete hypothesis.
3. **Audit meaning, not just citations.** Label whether the documented action actually helps the user's goal, which part it helps, and what data or feature is missing. Include partial solutions and explicit-provider requests. Independent review would strengthen the claims; it is not a new prerequisite interview process.
4. **Promote only after a quality gate passes.** Require no material regression on common covered cases, no known wrong-provider substitution in explicit-only cases, readable reasons and an acceptable latency/cost tradeoff. Otherwise leave the experiment disabled.
5. **Keep the scope stable.** No redesign, accounts, public launch or Postman work until separately discussed. Continue reusing the existing on-demand explanation and brief flow.

The context-engineering evaluation and engineering testing-strategy skills shaped the baseline, separate metrics, layered checks and the decision to hold back a failing experiment. The next product milestone remains trustworthy matching—not more interface features.
