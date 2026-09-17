# APIFit project instructions

This is APIFit's independent application repository. Keep source, tests and implementation notes here. Do not put application code in the sibling PROJECTS control repository.

## Product boundaries

- Support broad API/MCP discovery without hardcoded industry or provider limits.
- Distinguish discovered metadata, parsed/automatically assessed evidence, human review and actual observations. Never claim unknown capabilities or key permissions are verified.
- Keep search central: Find → Shortlist → on-demand explanation → build brief. Keep Understand an API for existing links. Do not reintroduce mandatory requirements confirmation or paid shortlist checks.
- Postman integration and executable collections were removed from scope on 2026-09-17, superseding historical plans to revisit them.
- Do not collect integration-provider keys. Do not execute APIs/MCP tools while analysing documentation.
- No paid services, external LLM calls, deployment, remote creation or push without owner approval.
- Owner approved Anthropic integration with a US$5 total development cap on 2026-09-14. The pasted chat credential is exposed and must not be used. Use the backend credential adapter: macOS Keychain locally, runtime secret in hosted mode. Never expose credentials through prompts, committed files, browser storage or logs. Paid requests require consent and the durable ledger. Do not reset it, duplicate active ledger owners or raise the cap without a new owner decision.
- Deployment preparation and public nethren/apifit publication with MIT are authorized on 2026-09-17. The owner chose a public app with paid AI available within the existing allowance. Actually provisioning/deploying or increasing the allowance requires a separate decision. Hosted AI defaults off until runtime credential and existing ledger setup.

## Engineering

- The owner has supplied the frontend working direction: search is central; tasteful interactive graphics and motion; a creatively considered tool, not an AI-generated-looking marketing page. Build a reviewable first pass within that direction using emil-design-eng and apple-design. Final visual acceptance remains with the owner.

- Keep private briefs in session memory; do not log or persist them.
- Route all remote document retrieval through the tested public-network fetch boundary. Never bypass it to make a source work.
- Test parsing, URL safety, evidence provenance, must-have rules and error states.
- Use reviewed deterministic templates for executable exports, not source-provided scripts.
- Run npm test and npm run build before handoff, then verify implemented UI flows in a real browser. Document unavailable live services honestly.
- Preserve user changes. No destructive file/repository operations without explicit approval.

## Local workflow

Use Node 22 or newer. npm run build checks backend syntax and builds the frontend. npm start serves both at http://127.0.0.1:4173. Never expose the documentation fetcher publicly without a deployment security review.

Hosted mode requires an exact HTTPS origin, explicit access mode and persistent data directory. Password mode requires a secret; public mode keeps every other protection. Preserve Host/origin validation, owner-scoped records, bounded work and minimal health. See documentation/deployment.md. Run npm run repo:check before committing. Keep dated evidence intact but label superseded scope accurately.
