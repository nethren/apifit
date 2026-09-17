# APIFit search quality — first measured improvement

## Decision

Keep the backend improvements for local use. **Do not call recommendation quality validated or deploy on the strength of this pilot.** Search failures were removed in this run and reference leads were found more consistently, but the claim audit still found overstatements and an explicit-provider mismatch. `liveQualityValidated` remains false.

No frontend layout, theme, shortlist flow, Postman integration, deployment or external service was added. The product is running locally at http://127.0.0.1:4173/.

## Method

30 synthetic requests, 20 development and 10 held out from failure inspection until the revised implementation was frozen. Same public-source snapshot and pinned Haiku 4.5 for both runs. [Protocol and fixed rubric](search-quality-protocol.md); [frozen cases](../tests/search-quality-cases.json).

Snapshot: 2,529 API records (10 known-retired records excluded) and 297 active MCP revision records representing 171 distinct MCP products. MCP coverage is only the first three registry pages. Snapshot SHA-256: `26964a5fcf048613404eb9261ef658c48c71178d728fada0df91fc3a2413c814`.

Reference lists are non-exhaustive potential core components, not certified full solutions. An unmatched alternative is unjudged, not automatically wrong. This is a model-assisted, author-created pilot, not independent human validation. Coffee and weather were already known regression cases. One run per version cannot isolate model variability or causally attribute every change to one fix.

## Results

| Measure | Before | After |
|---|---:|---:|
| Capability searches with a reference in top 3 | 21/28 | 26/28 |
| Same, when a reference was present in loaded sources | 21/26 | 26/26 |
| Development: reference in top 3, source-covered | 14/18 | 18/18 |
| Holdout: reference in top 3, source-covered | 7/8 | 8/8 |
| Reference retrieved into candidate pool, source-covered | 26/26 | 26/26 |
| Search errors | 5/30 | 0/30 |
| Explicitly excluded product in top 3 | 1 | 0 |
| Unrelated requests correctly returning nothing | 2/2 | 2/2 |
| Mean reciprocal rank, all 28 capability cases | 0.708 | 0.911 |
| Unjudged top-3 results | 18 | 23 |
| Exact-product duplicates in top 3 | 0 | 0 |
| Median search latency, all 30 cases | 7.65s | 7.39s |
| 95th-percentile latency, all 30 cases | 16.48s | 19.40s |
| Input / output tokens | 132,719 / 7,066 | 142,973 / 8,150 |
| Run cost | US$0.168049 | US$0.183723 |

The five restored reference hits were previously failed responses, not missing candidate retrieval. Do not describe this as an improvement from 75% to 93% **accuracy**. A correct API can still have an incorrect explanation, and some additional alternatives are weak. Unjudged counts rose partly because previously failed searches now return results; they are not a precision measure.

Latency is not uniformly improved. Among the 25 cases successful in both runs, median latency changed from 7.65s to 6.87s, but p95 increased from 13.27s to 17.02s. Timings use a warmed, local source snapshot and include AI/token-count calls and local processing; they exclude a cold live-directory download. No streaming or extra paid judge was added.

All 26 covered reference cases succeeding is encouraging but a tiny, non-random sample. Even an illustrative independent-binomial Wilson interval would extend down to approximately 87%; the sampling/design limitations mean it is not a population accuracy estimate.

## What changed

1. **Public listing contamination is isolated.** A listing with credential-like example text previously blocked email and payment searches. The entire affected candidate is now omitted before AI transmission; user-input credential rejection remains unchanged. Two contaminated candidate occurrences were omitted in the revised run.
2. **Bad statements no longer erase good candidates.** Previously, one invalid quote or overlong statement rejected the whole batch. Independently valid candidates survive; failed statements are never displayed. Unknown IDs, duplicate IDs and malformed envelopes still fail closed; a wholly invalid response still fails. Three candidates were withheld in the revised run. The original failed raw model outputs were not saved, so their exact quote-versus-length failure is not known.
3. **Ranking is more action-focused.** The revised prompt narrows partial matches to direct components and discourages invented add-on features, unsupported provider-wide capabilities and promotional claims. The barcode-generator false positive and cafe-related NYT article suggestion disappeared. The prompt does not fully enforce these requirements—see the audit below.
4. **MCP revision deduplication.** One loaded record per MCP product, preferring the registry's explicit latest marker and otherwise its update date. Tandem previously contributed versions 0.3.0, 0.3.1 and 0.3.2 to the candidate pool and returned 0.3.0; it now contributes and returns 0.3.2. This does not certify safety or guarantee the globally latest version outside loaded pages. Distinct GitHub API directory aliases are not collapsed by this change.
5. **Repeatable measurement.** Added dataset/snapshot/code fingerprints, exact-product scoring, conditional coverage denominators, usage-only instrumentation, separate split reporting and bounded paid runs. No private user requests are saved. Local benchmark output is ignored by Git.

## Claim audit — release gate not met

Reviewer: Codex; manual inspection of generated text and supplied metadata, not an independent human or paid LLM judge. Sample reviewed: development d01–d18 and all ten revised holdout cases, with targeted baseline comparisons. Findings are examples, not an exhaustive claim-accuracy rate.

| Case | Finding after changes | Assessment |
|---|---|---|
| Hourly forecast / marine weather | Weatherbit and StormGlass lead with relevant quoted forecast/weather descriptions; land/marine gaps are noted. | Useful leads; full feasibility still unverified. |
| Barcode product lookup | Go-UPC is the sole result, but the reason says it “scans” barcodes. The quote establishes barcode-number lookup, not image/camera scanning. | Material unsupported specificity remains. |
| GitHub issue creation | Correct provider returned, but the reason claims issue creation from a generic GitHub REST API description. Multiple directory aliases still occupy slots. | Severe evidence-support failure despite a successful reference hit. |
| Google Drive upload | Correct first result. A secondary unified-storage API is described as including Google Drive although its supplied quote only names file-storage endpoints. | Specific connector coverage is not established by that quote. |
| SMS reminders | Correct delivery lead; another result repeats advertised low cost/refunds and adds tracking language. | Promotional/extra claims remain despite prompt instructions. |
| Card payments | Relevant Adyen lead restored. One secondary caveat refers to internal candidate ID `c6`. | Copy leakage/jargon to remove in a later text-quality pass. |
| Recipes | Spoonacular has a useful action-specific excerpt; BigOven's shorter quote is less conclusive for search/ingredient retrieval. | Metadata evidence strength is uneven. |
| Official GitHub MCP | Requested official server is outside loaded pages; an unrelated vendor's GitHub-fix integration is still returned as partial. | Explicit provider/official-status intent not sufficiently respected. |
| Tandem docs MCP | Correct current loaded revision first; a generic product-docs connector also appears. | Primary match good, secondary usefulness questionable. |

The fixed reference-hit, exclusion-list and abstention targets were met. **The no-severe-unsupported-claim target was not.** Exact quote matching proves that quoted text exists, not that the explanation follows from it. More prompt wording alone is not enough to claim this problem solved. Repeated generic caveats also remain more verbose than the owner's intended UX.

## Reference erratum and coverage gaps

The frozen d19 fixture used `io.github.microsoft/playwright`; Microsoft's [official server manifest](https://github.com/microsoft/playwright-mcp/blob/main/server.json) identifies `io.github.microsoft/playwright-mcp`. This was caught during the final reference audit, not silently patched into the frozen dataset. Neither identifier is in the snapshot, so the corrected reference yields the same source-gap and result scores. Fix this identifier in the **next dataset version** before reuse; retain v1 to reproduce these runs. Excluding d19 entirely would give 21/27 → 26/27 overall reference hits; the 26-case source-covered denominator is unchanged.

The [official GitHub MCP manifest](https://github.com/github/github-mcp-server/blob/main/server.json) confirms h09's reference identifier. Both official tools fall outside this snapshot's loaded MCP pages. No claim is made that they are absent from the whole registry or market.

## Cost and verification

- Two 30-case benchmark runs: **US$0.351772** total.
- One additional live browser search: **US$0.005357**.
- Total this iteration: **US$0.357129**. Cumulative ledger: **US$0.694055 used/reserved; US$4.305945 remaining**.
- Baseline stopped after d04's sensitive-metadata failure, then explicitly resumed at the remaining cases. Already completed cases—including failures—were not rerun. There were no automatic paid retries, budget resets, premium-model switches or new services.
- **131 offline tests passed; production build passed; 42 backend/script/test modules syntax-checked.** Tests use synthetic provider responses and no real key.
- Real-browser checks: keyword search, AI opt-in, AI-ranked barcode lookup, free add/remove with AI enabled, and optional-summary consent gate. No confirmation form or assessment appeared when saving. No browser console errors observed. The budget was unchanged across shortlist add/remove. No fresh paid summary/build-brief generation was done this iteration; existing synthetic route tests cover those unchanged paths.
- Source remains untracked in this independent repository; no commit, push, remote, portfolio-state change or public deployment was made.

## Next implementation priorities

1. **Document-backed search evidence, still behind the simple UI.** Extract bounded operation descriptions from relevant public specifications and cache public capability records. Cite those operations when describing a specific action; if evidence is insufficient, qualify or omit the claim. Never infer camera scanning from lookup input, or a connector's supported products from its provider name. Keep summaries on demand and shortlisting free. Evaluate with new cases rather than treating this holdout as fresh again.
2. **Respect explicit provider and exclusion intent.** Distinguish “find the official X connector” from “find anything that integrates with X”; avoid generic substitute results when the requested provider is not found.
3. **Broaden MCP source coverage and collapse API aliases.** Current three-page prefix is a larger limitation than initial candidate retrieval in this pilot. Keep separate source/freshness/version provenance; do not label a registry entry as operationally reliable.
4. **Repeat quality and tail-latency measurements.** Add independently reviewed references, ambiguity/negative cases and realistic longer requirements. Remove redundant caveats/internal IDs. Measure cost of any evidence-enrichment design before expanding it.

Postman remains paused. These are follow-on priorities, not changes silently added to this iteration.

## Reproduce / inspect

Raw public snapshot and synthetic results are in ignored `output/search-quality/`: `catalog-2026-09-15.json`, `baseline-v1/`, `revised-v1/`. Manifests retain dataset, snapshot and code hashes. The following reports are free and offline:

```sh
npm run search:eval -- --run baseline-v1 --split development --report
npm run search:eval -- --run revised-v1 --split all --report
```

Paid execution requires an explicit `--confirm-paid`, a new unique run name, the existing Keychain credential and durable US$5 ledger. Each run has an additional US$1.25 reservation-aware cap. `--resume` skips every recorded case and refuses a different dataset, snapshot, split or production-code fingerprint. Run-history files are exclusive rather than overwritten. Retire this holdout and fix the d19 erratum before a new validation round.
