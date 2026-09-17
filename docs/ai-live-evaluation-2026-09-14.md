# Initial live AI evaluation — 2026-09-14

Model: `claude-haiku-4-5-20251001`. The replacement credential was entered by the owner in the masked native window, confirmed present through Keychain attributes, and successfully used by the guarded backend adapter. The key was never displayed or copied into a project file.

## Measured results

| Run | Scope | Correct expected statuses | Median complete assessment latency | Recorded token charge |
| --- | --- | --- | --- | --- |
| Prompt v1 baseline | 10 fictional single-requirement cases | 9 / 10 | 4.846 seconds | US$0.022095 |
| Prompt v2 | Original 10 plus 10 new cross-domain variations | 19 / 20 | 3.895 seconds | US$0.044582 |
| Prompt v3 | Same 20 cases, stricter citation instructions | 19 / 20 | 5.440 seconds | US$0.050237 |
| Prompt/pipeline v4 | Same 20 cases with the conservative restriction gate | 20 / 20 | 4.116 seconds | US$0.048661 |

Latency includes the free token count and, when a finding is non-unknown, a second AI evidence check. It is not a model-only generation speed or a production SLA. Dataset and runner: `tests/ai-eval-cases.mjs`, `scripts/ai-eval.mjs`.

The baseline incorrectly treated documentation of one geographic area as proof that other regions are unsupported. The prompt now explicitly distinguishes a positive example/list from an exhaustive boundary. The original case and new messaging-channel / SDK-language variations passed in v2. The system prompt does not contain the evaluation examples.

The v2 miss was conservative: an explicit commercial-use prohibition became unknown. A separate diagnostic run of the same evidence/requirement, with different synthetic record/evidence identifiers, correctly returned unsupported and passed its second check. That diagnostic cost US$0.002858; it does **not** replace the original miss or turn the 19/20 run into 20/20. This variation is a reason to keep human review and uncertainty visible, not a reason to claim deterministic model correctness.

The geographic false exclusion returned in v3, despite the prompt rule and second AI check. This confirmed that instructions alone were insufficient. The v4 pipeline adds a one-way, deterministic restriction gate: an unsupported finding without recognised restrictive wording in its exact source quotes becomes unknown before the second check. It never promotes unknown to supported or unsupported. This intentionally conservative English-language cue check is not a full entailment classifier; some legitimate implicit or non-English contradictions will remain unknown. An unrelated quote containing a restriction still needs semantic review. Offline tests cover inclusion-only place, SDK and channel examples plus explicit prohibitions and limits.

All accepted outputs passed runtime schema, requirement-ID, source-ID and exact-quote validation. Source support, explicit contradictions, documented conditions, missing refresh/access/pricing evidence, compound requirements, MCP capability assumptions and one injected instruction were exercised. Neither APIs nor MCP tools were executed.

## Real public-document check

The Visual Crossing Weather API specification in the public APIs.guru directory exposed a gap the short fictional examples did not: Haiku repaired a source typo inside a quote, rewrote JSON fields into a non-verbatim quote, and attached APIFit metadata to a source citation. The original all-or-nothing explanation was correctly rejected, so no invalid claim appeared in the interface.

Prompt v3 adds exact spelling/punctuation copying rules, separates parser warnings from citable source evidence and asks for a shorter explanation. A diagnostic explanation took 24.398 seconds under v2 and 17.114 seconds under v3, excluding the preceding public fetch/parse. These are two observations on one document, not a latency guarantee or controlled statistical comparison. The v3 diagnostic still contained two invalid-quotation statements: instruction changes alone did not solve copying reliability.

The service now applies the unchanged strict validator to each explanation statement, withholds an entire statement if any of its quotes fails, and reports the number withheld. It never repairs a quote through fuzzy matching, shows the rejected text, or makes an automatic paid retry. Bad top-level schemas and over-limit arrays still fail closed. In the v3 diagnostic, four statements had valid quotations and two were withheld. This is partial delivery, not a claim that the model's raw response was wholly correct or that quotation matching proves entailment.

The reusable opt-in diagnostic is `node scripts/ai-public-smoke.mjs --confirm-paid`. It is fixed to that public specification and reports quote-copying failures; it is separate from app logs and accepts no private project input. Its strict raw-output result intentionally remains a failure when any model quotation is invalid, even when the app can safely display a labelled partial explanation.

## Final browser workflow and cumulative spending

The v4 service was exercised in the actual local interface with the same public weather specification. The reader displayed one overview and three capabilities, with a visible notice that two statements were withheld for invalid source quotations. The valid portions remained readable and labelled as unreviewed AI interpretation.

For the fictional brief “I need hourly forecasts for Singapore and JSON responses,” Organise with AI produced two editable requirements with exact quotes from the brief, left priorities unsure, and offered clarification questions. After explicitly choosing both as must-haves and confirming them, Assess with AI reported documented support for JSON and unknown for the compound Singapore/hourly requirement following the second evidence check. The comparison remained “Needs checking,” showed 12/12 selected evidence excerpts and an expandable source quotation, and made no account-access or live-test claim. This checks workflow integration, not whether the provider actually meets either requirement in practice.

The normal desktop comparison was visually reviewed. No browser errors or warnings were reported in the final check. AI was switched off after testing; the example reader/shortlist remains available in the tab. The final offline run passed 95 tests with no failures/skips; syntax checks passed for 33 modules and the production build passed.

After all baseline, diagnostic, regression and browser calls, the durable ledger reported **US$0.213533 charged or reserved**, leaving **US$4.786467 of the US$5 cap**. This is the app's ledger at handoff, not an independently reconciled Anthropic invoice or a limit on other apps. No ledger reset, budget increase, paid automatic retry, deployment or publication occurred.

## Interpretation and remaining gaps

The evaluation skill informed the use of a measured baseline, new variations, separate cost/latency/quality reporting and preserving failed outcomes. These are small smoke tests, not a statistically reliable real-world accuracy claim. The final 20/20 result is an observed regression-suite outcome, not 100% product accuracy. There is only one observation per case in each full run, and the 10 new cases are no longer held out after this evaluation.

`liveQualityValidated` remains false deliberately: initial provider compatibility and constrained behavior have been checked, but broad quality is not established. Next validation should use at least 50 diverse, independently reviewed cases, larger real-world documents, multiple requirements, multilingual requests and repeated runs. Do not expand paid evaluation automatically; keep it explicitly invoked within the existing owner-approved ledger.

Haiku remains the low-cost default. There is no evidence here to justify automatic premium-model escalation, and no cross-model quality comparison was performed. The second check uses the same model family and can share its errors. Exact quotations establish traceability, not truth or semantic entailment.
