# Configuration and credentials

Keyword discovery and structural documentation reading need no provider key.
Never use a `VITE_` variable for secrets: those values enter the browser bundle.
The application does not automatically load `.env` files.

| Variable | Local default | Hosted requirement |
| --- | --- | --- |
| `APIFIT_MODE` | `local` | Explicitly `hosted` |
| `APIFIT_PORT` | `4173` | Optional 1024–65535; overrides `PORT` |
| `PORT` | Ignored | Default `8080` |
| `APIFIT_PUBLIC_ORIGIN` | Ignored | Exact public HTTPS origin; no trailing slash/path/query |
| `APIFIT_ACCESS_MODE` | Ignored | `password` by default; set `public` for the owner-approved public app |
| `APIFIT_ACCESS_PASSWORD` | Ignored | Required only in password mode: 32–1024 characters; no controls or surrounding whitespace |
| `APIFIT_DATA_DIR` | Fixed ignored `.local/` | Absolute non-root path on a writable persistent volume |
| `APIFIT_AI_ENABLED` | `true`, still subject to readiness and consent | Defaults `false`; strict `true` or `false` |
| `ANTHROPIC_API_KEY` | Ignored; macOS Keychain is used | Backend runtime secret, only when hosted AI is enabled |

Invalid hosted configuration fails startup. Never log the returned configuration
object: password mode contains an access secret. In password mode the login
username is `apifit`; generate a random password in a password manager. Basic
Auth requires HTTPS. Public mode ignores the password and has no login prompt.

## Optional local AI

On macOS, `npm run ai:setup` opens the existing secure replacement-key setup;
`npm run ai:check` checks Keychain presence only, not budget or provider access.
The app's AI control reads `/api/ai/status` for application readiness. Never reuse a key
exposed in chat. Other platforms can use free local features; Keychain is
macOS-specific. The pinned model and limits live in `server/ai-config.mjs` and
cannot be selected by a request. Consent is per tab, not authentication.

The allowance is **US$5 cumulative**, not per visitor, day, deployment or clone.
A missing, invalid or locked ledger stops paid calls. It is not auto-initialized.

## Separately enabling hosted AI

The container and Compose recipe keep AI off. Before enabling it:

1. Stop every process that could spend against the existing development ledger.
   Do not copy it during a call or leave local and hosted copies active.
2. Securely migrate the existing ledger to `APIFIT_DATA_DIR/ai-budget.json`,
   preserving charged units, reservations, cap and halted state. Investigate
   stale locks; never reset the balance to resolve one.
3. Keep a private backup and service-owner-only write access. Do not commit the
   ledger or place it in an image.
4. Add a replacement Anthropic key through the host's runtime-secret settings.
   Set `APIFIT_AI_ENABLED=true` for the approved public app. Every visitor shares
   the remaining allowance, not a fresh allowance per session.
5. Check readiness without generating. Paid smoke tests still need consent and
   remaining allowance; liveness does not prove AI readiness.

There must be exactly one active ledger owner. Replicas with copied ledgers
would bypass the intended shared ceiling. No new allowance or migration is
performed by this preparation. Compose reads the key from the operator's runtime
environment only; never print rendered configuration with real secrets present.

The pinned Haiku 4.5 base rates were rechecked on September 17, 2026 against
[Anthropic pricing](https://platform.claude.com/docs/en/about-claude/pricing):
US$1/million input tokens and US$5/million output tokens. Review rates before
launch. The app ledger covers these model calls, not hosting charges, taxes or
unrelated use of the provider account. Configure provider-side account limits
as a second boundary where available; no account limit was changed here.
