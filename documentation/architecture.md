# Architecture

The React client and JSON API share one origin. Express serves the production
Vite build and coordinates directory search, bounded documentation retrieval,
parsing and optional AI. There is no separate browser credential or database.

```text
Browser: search → shortlist → explanation → Markdown brief
  │ same-origin requests; explicit AI opt-in
  ▼
Express: access boundary → bounded jobs → session-owned records
  ├─ Public API/MCP directories → reusable public metadata cache
  ├─ Safe fetch → parser worker / public MCP tool descriptions
  └─ Optional Anthropic call → validated output + cumulative cost ledger
```

| Location | Responsibility |
| --- | --- |
| `src/SearchApp.jsx` | Current search-first interface and tab-local shortlist |
| `src/App.jsx` | Earlier comparison interface retained as legacy source, not the entry point |
| `server/app.mjs` | HTTP routes, limits, job cancellation and record ownership |
| `server/hosted-boundary.mjs` | Explicit public/optional password access, exact origin, expiring cookies and quotas |
| `server/runtime-config.mjs` | Explicit local/hosted configuration; hosted AI defaults off |
| `server/runtime-credential.mjs` | Local Keychain or backend-only hosted secret adapter |
| `server/catalog.mjs` | Directory retrieval and bounded MCP index |
| `server/safe-fetch.mjs` | Public HTTPS destination, DNS, redirect and response boundary |
| `server/integration-docs.mjs` | Integration-aware source selection and fallbacks |
| `server/mcp-inspection.mjs` | Public MCP metadata inspection, never tool execution |
| `server/ai-service.mjs` | Consent, task orchestration and output validation |
| `server/ai-budget.mjs` | Durable reservations and the unchanged cumulative US$5 cap |
| `shared/` | Deterministic browser/server text and brief export helpers |

Private backend records expire after 15 minutes. The browser may retain a
visible result until cleared or reloaded; an existing brief can be downloaded
from that tab without another server record or AI call. Hosted cookies also
expire after 15 minutes. There is no durable project history or account system.

One process must own one writable ledger. The recipe does not support replicas,
ephemeral serverless functions or separate frontend-only deployment. The public
MCP index can be rebuilt; the spending ledger must never be recreated as an
empty balance. Experimental documentation-assisted ranking remains disabled by
default following the recorded quality regression.
