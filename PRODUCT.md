# APIFit — product scope

## The problem

A PM can describe a feature without knowing which API supports it. Directories
offer names and descriptions; documentation explains interfaces. Neither makes
the connection to a particular product idea easy to judge.

APIFit helps PMs and early-stage builders find plausible integrations and
understand their contribution before asking a technical collaborator to build.
It is a discovery and planning tool, not an integration platform.

## The current flow

1. Describe a project or search a capability. Browse API or MCP listings.
2. Save promising results immediately. Shortlisting does not require AI.
3. Request an explanation of which documented capabilities could help your
   goal, what remains unknown, and what to check before relying on the result.
4. Generate and download a brief from up to five shortlisted integrations.

Someone with an existing documentation link can start in Understand an API.
Evidence is available on expansion rather than dominating the initial view.
The search-first interface deliberately replaces the earlier requirements
editor and mandatory confirmation step. Some legacy backend routes remain for
regression coverage; they do not define the current product flow.

## What a useful result means

- A real directory listing, not an invented provider.
- A clear connection between a documented capability and the user's request.
- Honest distinctions between a possible use, documented support and an
  untested assumption. A citation is not a guarantee of semantic correctness.
- A brief that separates the proposed build from missing data and decisions.
- No paid call when saving a result or downloading an already-generated brief.

These are acceptance criteria, not claims of demonstrated user adoption.
The [evaluation record](docs/search-phase-results-2026-09-16.md) describes the
bounded tests, retained failures and remaining gaps.

## Deliberate exclusions

Postman integration and executable collections were removed from scope by the
owner on September 17, 2026. They are not a deferred next-phase commitment.
There is no provider-key management, integration execution, MCP installation,
uptime monitoring, account-entitlement checking or procurement workflow.

APIFit does not claim exhaustive market coverage or a verified reliability
ranking. It currently searches public directories, not the whole web. Broader
source freshness, recommendation quality and accessible copy remain work to
validate. There are no accounts, billing, collaborative workspaces or hosted
multi-tenant service promises.

## Current release boundary

Publish an independently understandable MIT-licensed repository and prepare a
public, single-instance app with optional operator-funded AI. The owner handles
the demo and approved public GitHub visibility and public paid-AI availability.
Hosting provider and domain remain undecided. Runtime credentials and the
existing cumulative ledger must be configured before paid features work; this
preparation does not deploy the app or increase the spending allowance.

Public visitors can consume the shared allowance. Session/request limits reduce
casual abuse but do not establish individual identity or guarantee access. The
durable cap bounds app-managed model spend under the pinned pricing and
single-ledger-owner assumptions. Keyword discovery remains usable without AI.
