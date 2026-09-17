# ADR 002 — bounded, opt-in Anthropic interpretation

Date: 2026-09-14. Status: implemented; secure credential access and initial live checks confirmed. Broad quality validation remains open; see [the evaluation record](ai-live-evaluation-2026-09-14.md).

## Decision and alternatives

Use pinned `claude-haiku-4-5-20251001` through the backend, with native HTTPS requests and JSON-schema outputs. It is the lowest-priced current direct-API model in Anthropic's current model table and is labelled fastest. Haiku is a starting hypothesis, not a claim that quality is proven for APIFit.

| Option | Standard USD per million input / output tokens | Decision |
| --- | --- | --- |
| Haiku 4.5 | $1 / $5 | Default for bounded extraction, explanations and evidence judgments |
| Sonnet 5 | $2 / $10 | Consider only if a measured Haiku weakness justifies another owner-approved configuration; never automatic escalation |
| Opus/Fable tier | Higher than either above | Unnecessary starting expense for this constrained task |
| Deterministic-only reader | No AI inference cost | Retained whenever AI is off; semantic judgments remain unknown |

Official sources checked on this date: [models](https://platform.claude.com/docs/en/models/overview), [pricing](https://platform.claude.com/docs/en/about-claude/pricing), [Haiku details](https://platform.claude.com/docs/en/models/haiku-4-5/overview), [structured output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs), [token-count contract](https://platform.claude.com/docs/en/api/messages/count_tokens). Recheck pricing, retirement and schema support before changing models or deployment. Sonnet 5 pricing is from the current official table, not older Sonnet pricing remembered from previous releases.

An illustrative 8,000-input / 1,000-output request costs $0.013 on Haiku versus $0.026 on Sonnet 5. These are arithmetic examples, not measured typical app costs. A comparison makes one assessment per candidate and one additional check if any finding is non-unknown; that extra pass adds cost and latency. No caching discount is assumed.

## Task design

- Requirement drafting preserves exact source quotes, leaves priorities unsure and requires user confirmation. It may suggest search phrases, but the current interface does not use those to perform automatic AI discovery. Directory search is still local keyword matching.
- Documentation explanation receives only server-owned citable excerpts, parser warnings and explicit coverage limits. It returns short statements with exact evidence IDs and quotations.
- A statement with an invalid quotation is withheld in full and counted in a visible notice; other individually validated statements can still be shown. Top-level malformed/over-limit output fails closed. No fuzzy quote repair or automatic paid retry. Live public-document checks showed that prompt instructions alone do not guarantee exact copying.
- Fit assessment receives confirmed requirements and selected source excerpts. Unknown is different from unsupported. Regional/freshness/pricing/account assertions cannot be inferred from related endpoint names or fields.
- Before secondary review, a deterministic one-way gate downgrades unsupported claims without recognised restrictive wording in their exact quotes. This prevents positive examples being silently treated as exhaustive. It is conservative and English-oriented, not proof of semantic contradiction; unrecognised/implicit restrictions can remain unknown. It cannot promote a claim to a stronger status.
- Definitive/conditional findings receive a second, separately prompted Haiku evidence check. A failed check downgrades to unknown. This is not independence between different model families and cannot prove semantic truth.
- Deterministic rules, not the model, apply must-have precedence. No aggregate winner, fake percentage, live-test claim or key-access claim is generated.

One AI job at a time. Per-call deadlines: 45 seconds. Input JSON: 48KB maximum; estimated context: 24K tokens maximum. Output bounds: drafting 1,400; explanation 2,200; assessment 3,000; verification 1,200 tokens. Up to 10 AI requirements, 5 candidates and 40 / 28KB selected evidence excerpts per candidate. These are processing bounds, not restrictions on API industries/providers. Selected versus available evidence is displayed and exported.

Extended thinking is off, temperature is zero, outputs are schema-constrained and independently validated at runtime. Built-in citations are not enabled because they are incompatible with strict JSON-schema output; APIFit validates its own evidence-ID / exact-quote contract. No paid retries, model fallback, browsing, server tools or source-controlled code execution.

## Credential and privacy boundary

The credential pasted into chat must be revoked; it was not used or copied. `npm run ai:setup` compiles a native masked-entry window which saves a replacement as an APIFit-specific macOS Keychain item. The secret does not pass through command arguments, environment variables, project files, browser storage or application logs. `npm run ai:check` reads item presence only. The backend reads the secret through a private child-process pipe for the fixed Anthropic host; other same-user native processes remain trusted, not authenticated away.

The integration-provider keys of APIs being assessed are never requested. The Anthropic key is the local operator's AI-service credential, not evidence of access to a recommended API.

AI is off on each browser reload. Explicit consent covers sending project requirements and selected documentation to Anthropic, including its free token-count endpoint. Heuristic credential-pattern rejection is a precaution, not a complete secret/PII detector. Do not submit sensitive/private material. Backend records expire after 15 minutes; browser state remains until cleared/reloaded. No prompt/response telemetry or persistent private result cache is added.

[Anthropic's API retention policy](https://privacy.claude.com/en/articles/7996866-how-long-do-you-store-my-organization-s-data) generally deletes inputs/outputs within 30 days, with contractual, safety, legal and other documented exceptions. This application does not establish a zero-retention agreement.

## US$5 development budget

Owner-approved cumulative ledger: `.local/ai-budget.json`, ignored by Git, directory 0700/file 0600. Only cost units are stored, never prompts or keys. Exclusive lock; write, file sync, atomic rename, directory sync. Missing/corrupt ledger and stale locks fail closed. Setup, session clearing and process restarts do not reset spending.

Before every paid generation, reserve the **entire pinned model's 200,000-token context at input rates plus the task's full output allowance** ($0.206–$0.215). The smaller token-count estimate is a size check only: it does not set the financial guarantee. Reconcile down to explicit reported input/output usage after a valid provider response. Retain the full reservation on ambiguous timeout, transport failure or cancellation. Reject a request when its reservation will not fit; thus up to roughly $0.215 can remain unused. Unexpected charges above the reservation halt future requests for review.

This bounds this app's standard token requests at the documented pinned rates. It is not a billing control for other users/apps using the same Anthropic account, provider pricing changes, taxes or billing adjustments. Set a corresponding provider-side workspace spending limit where supported. No automated budget top-up or ledger reset is allowed.

## Verification and tradeoffs

Offline transport tests use injected fake fetch only and cannot spend money. They cover opt-in, credentials in input, exact quotes/IDs, omitted requirements, conditional evidence, provider refusal, truncation, redacted errors, cancellation, budget persistence/concurrency and an underestimated-token counterexample. A read-only independent security review led to full-context budget reservations and explicit AI evidence-coverage disclosure.

`npm run ai:eval -- --confirm-paid` runs 20 fictional source/requirement cases through the real configured model only after a replacement key is stored. It records status outcomes, aggregate timing and cost, not raw prompts/responses. Cases cover positive, conditional and contradictory evidence; geography, refresh interval, personal permissions, compound requirements, pricing, MCP parity and a prompt injection. Never run it as part of tests/build or silently against the pasted key.

Live observations are recorded separately and include failures: prompt v1 scored 9/10; v2 and v3 scored 19/20 on an expanded suite; the final v4 pipeline scored 20/20 after adding the conservative restriction gate. A small synthetic suite is not broad product validation: diverse real public docs, long/ambiguous requirements, multilingual input and human entailment review remain necessary. Full-context reservation favors the spending boundary over using every last cent; a second model pass favors conservative judgments over minimum latency.
