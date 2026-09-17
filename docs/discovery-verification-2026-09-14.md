# Requirements-led discovery verification

Date: 2026-09-14. Local exploratory checks, not production-quality certification.

## Automated checks

- `npm run check`: 105 passed, zero failures/skips; 34 backend/script/test modules pass syntax checks; production frontend build succeeds.
- New coverage: expansion/deduplication, generic-word pollution, input bounds, empty-query fail-closed behavior, bounded MCP batches, partial outages/retries, cursor loops, cancellation, free refinement request construction, copied shortlist criteria and HTTP draft → discovery → confirmed assessment.
- Existing exact-quote, second-pass verification, prompt-injection fixtures, secret-pattern rejection, public-network safety, cancellation/budget accounting and theme-contrast regressions still pass. No guard was loosened and no prompt/model was changed.

## Live product flow

Synthetic request: “I am building a cycling planner. I need hourly weather forecasts for Singapore and JSON responses.” No private user project brief was sent.

1. With tab consent enabled, Haiku returned two editable requirements, three clarification questions, and three phrases: `hourly weather forecast API`, `weather data Singapore API`, `JSON weather service`.
2. Initial expansion was too broad: 960 matches, including unrelated services matched on data/JSON/service. This failure prompted a deterministic ranking correction, not a model upgrade or relaxation of evidence rules.
3. The corrected search returned 16 leads, with Visual Crossing, Storm Glass and two Interzoid weather products at the top. Some results still do not meet the actual geographic/forecast requirements; these are relevance leads, not recommendations. A repeated real AI draft returned the same two requirements and the same 16-match search result in this run.
4. Inline priorities were set to must-have (Singapore/hourly) and nice-to-have (JSON), then confirmed. Shortlisting Visual Crossing carried text, priorities and confirmation into the comparison without re-entry.
5. The public specification yielded five operations and twelve evidence excerpts. AI reported JSON support with source evidence; the secondary check left the combined Singapore/hourly requirement unknown. Final verdict: needs checking. No provider operation or MCP tool was executed.
6. Editing a requirement after closing the assessment reset confirmation and removed the old findings from the next shortlist view. Edited text carried over correctly.
7. Search-phrase refinement worked without redrafting. The existing budget remained unchanged during free directory searches/refinements. Normal keyboard selection/deletion cleared phrases; the browser automation's `fill('')` action was a no-op in one check and was replaced with ordinary keyboard deletion. This was an automation limitation, not evidence that the app preserved an intended empty value.
8. AI-off partial-source test: shortlist a real public specification plus a deliberately blocked `https://127.0.0.1/` documentation URL. The public-network boundary rejected the latter without fetching it. The UI named the failure, waited for “Assess only the 1 readable option”, then returned a manual unknown-fit comparison with an exclusion notice. Partial-state warnings are retained in the tab's comparison draft for reopening; reload still clears tab state.

## Coverage observations and retained weaknesses

Read-only directory checks (no additional AI calls):

| Search | Observed result | Interpretation |
| --- | --- | --- |
| Weather, three model-generated phrases | 16 matches; weather products lead; first retrieval about 733ms | Relevance improved, not proof of Singapore/hourly support |
| Transactional email + SMS messaging | 116 matches; Pinpoint/SES and email/SMS products lead; about 66ms with cached API directory | Verification and email-validation products also appear; intent/action disambiguation needs more work |
| Singapore parking availability + parking spaces | 14 loose matches, including unrelated cloud services and a rail-station listing; about 63ms cached | **Poor relevance case retained.** Geographic/shared descriptive words can still produce noise. This is not adequate parking-provider recommendation quality |
| Weather, first three MCP pages | 297 usable listings, zero matches, continuation available | This batch does not represent the full Registry; absence of matches is not absence of suitable servers |

These timings are single-run observations, not an SLA or benchmark. There is no full MCP index, general web search, global provider comparison, measured recall/precision, multilingual-quality claim or overall winner.

## Interface verification

- Reviewed the desktop interface in Pearl light and near-black dark. New controls use existing typography/colour roles; no palette or homepage redesign.
- Corrected a clipped priority selector by using a grid and explicit control width. Clarification questions are now expandable to keep the editor compact.
- Populated inline form: no horizontal overflow at 390px (375px client) or 320px (305px client); the priority selector measured 249px and 179px respectively. Temporary viewport overrides were reset.
- Requirement carryover, confirmation invalidation, free refinement, source-error state and explicit partial-comparison approval were checked in the real browser.
- Expandable refinement details responded to Enter. A pointer automation attempt after viewport reset did not expand them; inspected the collapsed state before using the keyboard. Broader pointer/assistive-technology verification remains advisable.
- No new motion was introduced for typing/editing. Full screen-reader, real-device and complete rendered-state accessibility testing were not performed.

## Cost and boundaries

- Starting ledger: US$0.213533 charged/reserved.
- Final ledger after two draft requests and one real AI assessment flow: **US$0.227446 charged/reserved; US$4.772554 remaining**.
- Increment for this milestone's live checks: **US$0.013913**. No cap change, reset, automatic premium-model escalation or paid retry.
- AI returned to off after paid checks. The replacement credential stayed behind the Keychain adapter; no secret was printed or copied. Filename-only source/build secret-pattern scan found no live-looking Anthropic key.
- Postman implementation/manual checklist unchanged. No remote, commit, deployment, publishing, portfolio-state change or new dependency. Initial application files remain untracked as before.

## Next validation priorities

1. Build a labelled set of real project intents, including parking, messaging versus verification, geographic constraints and compound requirements. Measure top-result relevance and missing-provider cases before calling this a reliable recommender.
2. Improve intent-specific retrieval and directory coverage, while keeping metadata relevance separate from documented feasibility. Discuss any new search provider/indexing service before adding it.
3. Test more public documentation formats and partial-source combinations; add reusable browser regression coverage and accessibility checks.
4. Discuss the deferred Postman phase with the owner before implementation.
