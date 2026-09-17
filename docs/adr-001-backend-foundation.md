# ADR-001: Local backend before interface and AI activation

Status: Accepted as an implementation default within the owner's backend-first request; not a production architecture approval.

Date: 2026-09-12

Deciders: Owner controls frontend direction, external data processing, spending and deployment. Codex implements reversible local defaults.

## Context

APIFit needs broad API/MCP discovery, documentation understanding and requirement-level fit assessment. The owner requested backend work first and consultation before frontend implementation. AI/search providers, spending limits and third-party handling of project briefs have not been selected. The actual application must stay in its own sibling repository, separate from portfolio records.

The important correctness risks are false feasibility claims, treating an API key as a product, unsafe document retrieval, unbounded parsing, hidden coverage gaps and misleading live-test labels.

## Decision

Use a small Node/Express service bound to loopback. Keep public directory adapters, constrained fetching, worker-isolated structural parsing, deterministic decision rules and HTTP contracts as separate modules. Store private records only in bounded expiring memory. Fetch public metadata/documents live, with provenance and source failures. Keep semantic interpretation and executable exports disabled rather than fabricating their outputs.

The frontend consultation gate was subsequently satisfied by the owner's search-first, tasteful-interactivity working direction. A React interface is now built and served locally from the same origin; visual acceptance remains with the owner. No database, cloud infrastructure, accounts, remote repository, hosted inference or paid search is introduced.

## Options considered

| Option | Complexity / cost | Advantages | Trade-offs |
| --- | --- | --- | --- |
| Local modular backend with direct public-source adapters | Low; no inference charges | Testable boundaries, tangible ingestion, private local briefs, easy future UI integration | No remote collaboration; external-source gaps; AI value remains unfinished |
| Full hosted AI web app immediately | Medium/high; provider and hosting costs | Earlier end-to-end natural-language experience | Requires unmade privacy/spend/design decisions; larger security surface |
| Static mock/demo backend | Low | Fast visual prototyping | Does not establish real ingestion or coverage; weak evidence foundation |

## Consequences

- The project has a real, testable foundation but is not yet the complete PRD implementation.
- MCP pagination supports continued discovery but not corpus-wide semantic search. A background public metadata index is a sensible next discovery improvement.
- Structural parsing preserves source wording and bounded fields; plain-language synthesis and feasibility reasoning still require an approved interpretation approach.
- Parser limits and unresolved references must remain visible when the frontend is built.
- IPv6-only hosts, compressed-only responses and some document formats remain unsupported. Never bypass the safe fetcher merely to make a demo succeed.
- Local HTTP protections are not authentication or public-deployment hardening. Public hosting needs separate authorization and design review.

## Action items

- [x] Live public catalog adapters and provenance.
- [x] Safe fetch boundary and parser workers.
- [x] Requirements/assessment/export contracts with honest disabled modes.
- [x] Offline correctness/security tests and read-only live checks.
- [x] Consult owner and implement a first pass from their supplied direction using the requested design skills; final visual review remains.
- [ ] Select AI/search integration, data handling and spend before enabling external calls.
- [ ] Add semantic quality regressions, human-readable synthesis and traceable fit judgments.
- [ ] Add reviewed Postman templates and verify their import before advertising executable packs.
