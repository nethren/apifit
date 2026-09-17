# Release checklist

## Prepared in source

- Product scope, decisions, reviewer-oriented README, MIT licence and guides.
- Postman removed from future-facing scope and manual brief copy.
- Explicit public access with isolated expiring sessions; optional password gate.
- Runtime secrets, AI-off bootstrap and unchanged cumulative spending controls.
- Non-root container, persistent-data instructions and rollback procedure.
- Read-only CI for offline checks and container build; repository hygiene check.
- Dated experiments, measured outcomes and retained failures.

## Required before actual hosting

- Choose hosting/domain; public access and public paid-AI intent are approved.
- Container build/runtime smoke verified in an available Docker environment.
- Actual HTTPS, Host preservation, cookies and direct-port isolation verified.
- Two-profile isolation, expiry, restart and rollback verified on that host.
- Ingress logs reviewed; only public/fictional material used for QA.
- Migrate the original ledger under one active owner and inject a replacement
  runtime credential before enabling AI. No new spending allowance is implied.
- Confirm sufficient remaining allowance before any paid smoke or public launch.

Record actual automated results and unavailable checks in the handover. This
checklist is not evidence that live hosting verification already passed.
