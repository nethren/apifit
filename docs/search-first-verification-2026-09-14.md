# Search-first workflow verification — 2026-09-14

## Scope

Implements the owner's replacement interaction: search → ranked API leads → free shortlist → optional explanation/build brief. No requirement editor, priorities, confirmation or shortlist assessment. Postman remains unchanged. Pearl light, near-black dark, typography, artwork and search placement are retained.

## Offline checks

- `npm run check`: **122 passed, 0 failed, 0 skipped**; **38** backend/script/test modules syntax-checked; production frontend build passed.
- New coverage: internal query bounds, known candidate IDs, exact quotes, no reliability scores, consent for all new tasks, search→summary→brief without requirement records, free keyword mode, server-held continuation, unrelated requests, missing/unlinked docs, unsafe-link rejection before retrieval/storage, Markdown escaping, cache keys and no network call in the save handler.
- Source-backed retirement exclusions only match specific Bing Search products. Unrelated Microsoft products remain eligible; absence from the exclusion list does not establish current availability.
- Retrieval no longer silently ignores words beyond the first 40 unique description terms. Expanded-query ranking weights rarer domain words above common directory vocabulary. This remains lexical retrieval, not embeddings.

## Exploratory checks and failures retained

Used a separate local browser tab and a synthetic specialty-coffee finder request. Existing user tabs were not reloaded.

1. Initial ranking returned Bing Local/Entity Search, TomTom Search and Amazon Location. Bing listings were stale. [Microsoft's lifecycle notice](https://learn.microsoft.com/en-us/lifecycle/announcements/bing-search-api-retirement) confirms retirement on 2025-08-11. Narrow exact-product exclusions were added; this is not a general provider-lifecycle service.
2. Initial missing-data caveats were too long/repetitive. Output was constrained to one shared short gap and candidate-specific caveats only. A shared gap about bean origin/roast is an evidence limitation, not proof that no suitable product exists.
3. Repeated coffee searches exposed variability: some batches returned no leads; another returned profile-management alongside TomTom and a generic search tool. Query guidance, complete-description matching and rare-word weighting were improved. The rank prompt now explicitly distinguishes public discovery from administration and allows useful broad building blocks without pretending niche attributes are supported. These failures demonstrate why broad accuracy remains open.
4. TomTom's on-demand explanation produced a short paragraph and one capability, with exact source quotes behind disclosure. No full capability matrix appeared.
5. Removing/adding that API and reopening its cached summary left cumulative spend unchanged at **$0.282843**. Saving is local; reopening that URL reused the summary in the tab.
6. The first handover speculated that geometry identifiers could be used to obtain coffee menu/bean attributes. That instruction was not justified. Model-generated build steps were removed from the output schema. The final brief generates only source-cited roles and unresolved checks; its build checklist is deterministic and directs the builder to verify unknown data first.
7. Phone-width checks at 390 and 320 pixels showed no page overflow, including the populated shortlist. Desktop at 1280 pixels and near-black dark appearance were visually checked. Full screen-reader/real-device accessibility certification was not performed.

## Final smoke outcomes

- Final coffee discovery returned two leads: TomTom Search first, then a general web-search API. Profile-management and known-retired Bing Search products were not returned. Cafe/bean details remained caveated, not presented as verified coverage.
- Independent hourly-weather request put Weatherbit first, then Storm Glass and Visual Crossing, followed by broader/partial leads. Some broader leads and an unrequested trip-feature caveat were still produced: precision beyond the leading options needs more testing. The main results view avoids a second global caveat paragraph when results exist; per-result relevance and important gaps remain visible.
- Final handover generated a documented category/location-search role, explicit checks and the deterministic four-step build checklist. The download control was exercised. HTTP tests separately verify Markdown response, escaping, no-store and unavailable-source handling.
- Live checks began at **$0.248073** cumulative charged/reserved and ended at **$0.316004**, leaving **$4.683996** of the $5 cap. This turn's recorded verification cost: **$0.067931**, with no cap increase or model escalation.
- Direct provider-document links are available from result titles without requesting an AI summary. A shortlist with no linked docs explains why a build brief cannot yet be generated.
- The final compiled frontend was reloaded and checked with free weather search: result-title HTTPS links appeared, no requirement editor rendered, no horizontal page overflow at 1280 or 320 pixels, and browser logs contained no errors or warnings. Temporary viewport overrides were reset. This free fallback still returns lexical false positives; AI ranking is a separate opt-in path.

## Important limits

- A valid quoted substring does not prove that the AI's paraphrase is entailed. Human verification remains necessary; no reliability/feasibility score is produced.
- Directory-backed retrieval is not full market search. The first batch reviews at most 24 candidates and returns at most 12. No provider-domain cap is imposed, but missing or stale source metadata limits useful recommendations.
- No uptime/reputation monitoring, provider key entitlement check or API/MCP operation was run. Known-retirement exclusions are incomplete by design.
- Build briefs read bounded documentation. Missing/unlinked sources are flagged; all-unreadable selections stop before paid generation. General checklist steps are not executable instructions.
- Summary reuse is per URL in the current tab; refresh clears it. Server records expire after 15 minutes; downloaded briefs can outlive the source view and need rechecking.
- Legacy comparison modules/routes remain unused by the active entry point, with their earlier tests retained. No deployment, Git commit/push, remote creation, portfolio-state change or Postman implementation occurred.
