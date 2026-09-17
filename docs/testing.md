# Backend test plan and verification

Updated: 2026-09-16. Latest: **189 tests pass**, **60 modules syntax-checked**, production build passes. Search-to-brief changes, live benchmark results, retained failures, deterministic replay and browser verification are recorded in the [latest phase report](search-phase-results-2026-09-16.md). Earlier dated verification records and counts are retained below.

The active search-first interface supersedes the earlier requirement-confirmation flow. Its new HTTP/schema/free-save/continuation/brief tests and live results are recorded in [search-first verification](search-first-verification-2026-09-14.md): **122 tests passed**, **38 modules** syntax-checked, production build passed. Counts and UI observations below describe prior milestones unless explicitly noted.

## Strategy

Follow a test pyramid: offline unit cases for dangerous or business-critical boundaries; HTTP integration tests for the connected workflow; explicit live checks for changing external contracts; real-browser interaction and visual checks for the first UI.

| Area | Type and target | Examples covered |
| --- | --- | --- |
| Network boundary | Unit/transport tests for each rejection class | Private/encoded IPs, signed URLs, DNS rebinding, redirects, cancellation, compression, size limits |
| Document parsing | Offline unit + real worker tests across supported formats | JSON/YAML, Swagger, local refs, cycles, auth overrides, HTML text-only mode, pagination, malicious YAML |
| Discovery contracts | Offline adapter fixtures + opt-in live checks | Multiple products per provider, preferred versions, pagination, cache reuse, local query handling, source failure, title ranking |
| Decision correctness | Unit tests for every verdict and evidence rule | Hard blocker dominance, unknown vs unsupported, conditional fit, unsure priorities, missing/invalid evidence |
| HTTP workflow | Local integration tests | Discover → analyse → confirm → prepare comparison → export → clear; no frontend required |
| Privacy and failure handling | Unit/integration tests | Expiry, capacity eviction, no-store, safe errors, cross-origin rejection, body/rate/concurrency bounds |
| Source syntax and frontend build | Every backend/script/test module plus Vite | `npm run build` invokes Node syntax checks and production frontend compilation |
| Palette preview and appearance | Offline CSS-token and isolated startup tests | Four palettes in light/dark modes, normal text ≥4.5:1, large text ≥3:1, focus/control boundaries ≥3:1; preference validation and blocked-storage fallback |

No numerical coverage percentage is claimed. The target is explicit behavioural coverage of the listed risks, not a fabricated line-coverage score.

## Verification record

- Current offline suite: **105 passed, 0 failed, 0 skipped**, including AI/budget regressions and ten additional connected-discovery cases. Earlier milestone counts are retained below.
- Backend/script/test syntax checks passed for **34 modules**. Production frontend build passed; the interface is served from the same origin with a self-only content policy and no inline scripts or theme styles.
- Read-only live source smoke check on 2026-09-12: APIs.guru loaded **2,529** preferred-version records. The first MCP page produced **97** usable listings after filtering deleted/deprecated entries; a second page produced **100**. These are observed counts for that run, not permanent coverage claims.
- The initial live linked OpenAPI document had **18** operations, with **5** requested and partial coverage reported. After improving name-weighted ranking, the weather query retrieved the **Visual Crossing Weather API** specification, with all **5** operations parsed. No integration operation was called in either check.
- Directory retrieval took approximately **1.27 seconds** in the final run. This is a smoke observation, not a performance benchmark or SLA.
- `npm audit --json` reported **0 known vulnerabilities** across the installed dependency tree on 2026-09-12. This is not a full security audit.

The sandbox initially blocked local test ports; rerunning with explicitly approved localhost permissions allowed integration verification. Tests are otherwise offline and use clearly fictional fixtures, never fake production search results.

## Remaining test gaps

The latest connected workflow, live retrieval weaknesses, UI checks and spend are recorded in [requirements-led discovery verification](discovery-verification-2026-09-14.md). In particular, Singapore parking retrieval remains weak; the new flow is not a broadly validated recommender.

- Broad model quality, citation entailment and prompt-injection resilience are not established. Initial real-provider tests and their failures are recorded in [the live evaluation](ai-live-evaluation-2026-09-14.md). The small fixtures and one public document do not replace diverse repeated testing or human review.
- Executable Postman pack schema/import checks: no packs enabled yet.
- Full screen-reader, real-device and comprehensive accessibility testing remain; the first browser checks below are not accessibility certification.
- Large-scale source availability, full MCP corpus indexing, multilingual semantic search, broad specification conformance and sustained load: not established.
- Actual client disconnect while parsing and worker resource-exhaustion stress deserve additional cases; parsing already has fixed resource/deadline boundaries.
- Private HTTPS rejection and DNS/transport pinning are tested using controlled adapters. Public smoke checks exercise the real transport, but there is no adversarial internet DNS service in this suite.
- Public deployment threat modelling, authentication, quotas across users and operational monitoring remain out of scope for the local-only milestone.

## First interface verification

Verified in a dedicated Chromium session against the live local service:

- Illustrated weather starter → real directory results → Visual Crossing specification → capability summary with 5 operations.
- Shortlist → edit a Singapore forecast requirement → choose must-have → confirm → evidence comparison → actual Markdown download.
- Desktop layout at 1440×900 and phone layout at 390×844; no document or comparison-dialog horizontal overflow observed.
- Escape dismisses the native dialog; Command-K focuses the search input and switches to instant keyboard interaction mode.
- Reduced-motion emulation reports zero active CSS animations.
- A deliberately unmatched query shows the explicit no-results state rather than manufactured candidates.
- Requirement text and priority survive closing and reopening the shortlist dialog.
- The final home layout has no horizontal overflow at 320, 390, 768 and 1440 pixels wide.
- A private documentation URL is rejected in the UI with a readable error; the expected HTTP rejection appears in the browser network log. No private destination is fetched.
- Initial favicon 404 was fixed; the rebuilt page loads without that browser-console error.

Local screenshots are ignored under `output/playwright/`; browser snapshots and the sample downloaded brief are ignored under `.playwright-cli/`. No real private project brief or API key was used in these checks. A reusable automated browser test suite has not been added; these are recorded exploratory checks.

## Owner palette review — 2026-09-12

- All four supplied palettes render through CSS-only tokens under the existing content policy. Settled computed button colours and foregrounds match the intended tokens, including dark text on Frozen mist orange.
- Ten offline palette tests cover completeness, body/muted/link/button text, large headline text, illustration foregrounds, focus and form-boundary contrast. They do not certify every rendered state or the entire application.
- Home layouts checked at 320, 390, 580, 768, 800, 1000 and 1440 pixels: document scroll width does not exceed client width. The palette control is at least 44×44 pixels.
- A real weather result was opened and its public specification read. Switching through all four palettes preserved the query, parsed reader, shortlist, requirement draft and must-have priority.
- A 390-pixel result view and populated shortlist dialog have no horizontal overflow. Desktop and phone screenshots are saved in the ignored screenshot directory.
- Tab reaches the named palette select and exposes a solid 2-pixel focus outline. Command-K still focuses search. Reduced-motion emulation reports zero running animations. Native option changes by arrow keys were not confirmed by this automation; a manual OS-picker/screen-reader check remains.
- Browser console reported zero errors and zero warnings after these checks. No AI service, provider key or integration execution was added.

## Neutral background and dark-mode verification — 2026-09-12

- All eight palette/mode combinations were exercised in Chromium. Computed canvas/button colours, native control colour scheme and stored preference values matched the selected mode. Every light palette now uses the same non-cream silver-grey canvas.
- All eight combinations fit at 320, 390, 768 and 1440 pixels. The appearance toggle remains at least 44×44 pixels; mobile shortlist controls retain an explicit accessible name when their visual label is hidden.
- Enter toggles the focused mode button, preserves focus, updates its pressed state, exposes a visible outline and uses zero-duration keyboard transitions. Reduced-motion emulation also reports zero active animations and zero canvas transition duration.
- A light/Frozen mist preference survived reload; the preview was then returned to dark/Yacht club. Isolated startup tests cover malformed values and blocked storage. The startup script is served with the existing self-only policy; no inline-script allowance was added.
- Real weather search → public specification reader → shortlist and synthetic requirement draft was checked in dark mode. Switching light/dark preserved the query, parsed reader, saved option, requirement text and priority. The dark shortlist dialog had no horizontal overflow at 390 pixels.
- Final verification: 83 tests passed, production build passed, and the rebuilt browser page reported zero errors/warnings. Screenshots are in the ignored `output/playwright/` folder.
- Manual screen-reader/real-device checks, full rendered-state accessibility auditing and first-paint filmstrip measurement remain unperformed. Contrast results apply to the explicitly tested token pairs, not a blanket WCAG certification.

Repository status remains an uncommitted initial application (untracked project files); no publish, remote, commit or portfolio-state change was made for this visual revision.

## Homepage proportions — 2026-09-14

- Rebuilt the homepage with a shared 1200px maximum content width, larger typography and illustrations, and smaller gaps between sections. At a 1440px viewport, both search and starter sections measure 1200px and the desktop heading is 68px.
- DOM geometry checks at 320, 390, 768, 1440 and 1920px found no document horizontal overflow. Checked the search controls and starter cards for internal overflow; the initial 320px control collision was corrected by stacking the submit action. Dark mode was also checked at 320px.
- Reviewed the default-size homepage visually in light and dark Yacht club. Responsive browser screenshot capture was unreliable at overridden dimensions; narrow-width conclusions use DOM geometry, not a claim of real-device visual certification. Temporary viewport overrides were reset.
- Keyboard activation of the appearance toggle works. Real weather search returned results, and opening Visual Crossing displayed the adjacent reader. This check did not execute an API operation or re-run document parsing.
- The preview server had stopped before this revision; it was restarted on localhost. No server logic changed. All 83 existing tests passed; the final production build and 22-module syntax check passed.
- Changes are limited to homepage CSS, a small footer type adjustment and these design/testing notes. No product scope, credentials, privacy policy, repository boundaries or portfolio records changed. Final visual acceptance remains with the owner.

## Discovery studio revision — 2026-09-14

- Visually reviewed the new homepage in dark and light Yacht club, the 320px phone homepage and the populated 390px shortlist dialog. Geometry checks at 320, 768 and 1440px found no document or tested search/starter-container horizontal overflow. Temporary viewport overrides were reset.
- Topic selection changes the example heading and three search actions. The heading announces changes politely; controls use native buttons with pressed states and keyboard focus. The weather example retrieved real directory results; examples explicitly select API scope immediately, including when invoked after MCP selection or from Understand mode.
- Source controls update the decorative scene state. Keyboard-triggered scene transitions compute to zero seconds. Reduced-motion CSS disables hover movement; OS reduced-motion emulation and real-device testing were not rerun in this revision.
- The docs entry switches to Understand mode and focuses the URL field. Real weather search → Visual Crossing reader → public specification parsing returned five documented operations. Saving updates the shortlist count and saved appearance; the requirement dialog remains readable without horizontal overflow at 390px. No provider operation was executed.
- Enlarged reader typography initially overlapped the sticky search area. Final desktop measurement: search bottom 244.8px, reader top 268px at 1440px viewport width. On phones the search scrolls with content, leaving the sticky header and in-flow reader; populated 320px results and search controls have no horizontal overflow.
- Instrument Sans is served as `font/woff2` from localhost with HTTP 200 and the existing self-only content policy. Its Git blob hash matches the official source (`6cc0b91654167b4f5a8205ecad6edd79cbca3e5b`). OFL license is bundled alongside it. No new package dependency or external runtime font request was added.
- Final regression run: 83 passed, 0 failed. Production build and 22-module syntax checks passed. Browser console reported no errors or warnings. These are exploratory browser checks, not a new automated browser suite or a full accessibility certification.
- Repository remains an uncommitted initial application; no commit, remote, publishing, portfolio-state change or backend product expansion was made.

## Yacht Club / citron revision — 2026-09-14

- All 72 current tests passed; production build and 22-module syntax checks passed. The count changed from 83 because 12 contrast cases for the three retired palettes were removed and one saved-preference migration test was added. Both Yacht modes retain text, button, focus and control-boundary tests. Illustration label contrast now requires 4.5:1 rather than 3:1.
- Reviewed the rebuilt light and dark homepages at the browser's normal 1462px width. Citron replaces the brown/grey accent roles in the modular artwork and documentation entry. The old palette chooser is absent; dark/light toggling and keyboard Enter activation work. Light/Yacht survives a reload.
- Reviewed a phone-sized dark homepage with a 375px document client width (390px viewport including scrollbar). Document scroll width equals client width, and the mode toggle measures 44×44px. Reset the viewport override afterward.
- Final preview is light/Yacht. Browser console reports no errors or warnings. These targeted checks do not constitute a full accessibility audit or real-device certification. No backend code, provider operation, paid service, repository boundary or portfolio record changed.

## Pearl + sea-glass implementation — 2026-09-14

- All 72 tests passed, including text/button, illustration-label, focus and form-boundary contrast for both modes. Updated exact-colour assertions cover the selected backgrounds and sea-glass fills, plus the HTML theme-colour fallback and browser icon. Saved preferences and retired-palette migration tests still pass. Production build and the 22-module syntax check passed.
- Visually reviewed the actual rebuilt homepage in light and dark modes at 1462px width. Computed page backgrounds match `#F7FAF9` and `#102125`; the dark search panel matches `#1B3036`. Browser theme colour tracks the selected mode. The desktop page has no horizontal overflow.
- Keyboard Enter toggles the appearance button with a visible focus outline. A synthetic search input remains unchanged when switching from dark to light; reloading preserves light mode. Returned to the clean light-mode homepage for owner review.
- This colour-only pass does not re-certify every application state or real device. No provider operation, external AI service, repository boundary or portfolio record changed.

## Near-black dark-mode verification — 2026-09-14

- All 72 tests passed, including both modes' contrast pairings and startup preferences. Production build and 22-module syntax checks passed. The light palette file's SHA-256 is unchanged from before this pass; computed light-mode pearl and sea-glass values remain `#F7FAF9` and `#AFCBC4`.
- Reviewed the rebuilt dark homepage at 1462px: page background `#0C0E0F`, search surface `#171B1D`, matching browser theme colour, and no horizontal overflow. Keyboard Enter switches modes with a visible focus outline. The preview is left in dark mode for review.
- Changes are limited to dark appearance, matching browser theme/icon values, tests and documentation. Existing untracked application files remain uncommitted; no backend, layout, interaction or portfolio-state changes were made.

## Initial opt-in Anthropic implementation, before credential entry — 2026-09-14

- Final offline suite: 92 passed, 0 failed, 0 skipped. Backend/script/test syntax checks: 32 modules. Production frontend build passed. AI tests inject synthetic providers and never access Keychain credentials or Anthropic.
- Independent read-only security review found two issues before handoff: estimate-based budget reservations could understate cost, and comparison output did not expose the narrower AI evidence selection. Both were fixed and reviewed again: full 200K-context reservations precede generation; selected/total evidence is displayed/exported and parser warnings accompany both model passes. No remaining must-fix issue was reported within that review's scope.
- Real local browser: AI starts off; missing Keychain credential disables the consent checkbox; panel displays US$5.000 remaining and the text-sharing/retention notice. A real weather directory search returned 11 matches. Visual Crossing was shortlisted and its public specification read as part of a confirmed manual comparison; five parsed operations were reported, fit stayed unknown and no provider operation was executed.
- The new header control initially inherited a mobile hide rule. Fixed it and verified it is visible at a 320px viewport, 44px high, with page scroll width equal to the 305px client width. The AI dialog's 250px client/scroll widths match. Restored the normal viewport afterward. The dark settings panel was visually reviewed; final browser logs contain no errors or warnings.
- Native masked Keychain setup compiled and opened but timed out without a saved replacement. No chat-exposed credential was copied or used. The live quality runner's default dry invocation correctly declined to make calls without `--confirm-paid`; actual quality/latency evaluation is pending a replacement credential. Spending remains US$0.
- AI-enabled browser outputs have not been exercised against the real provider; mocked service/transport tests are not a live quality or end-to-end provider compatibility claim. Ten fictional quality cases are ready for explicit paid evaluation. No new automated browser suite, full accessibility certification or public-deployment audit is claimed.
- The app remains local-only with uncommitted initial project files. No commit, remote, deployment or portfolio-record change was made. Keychain helper and budget ledger are ignored; no live-looking Anthropic key was found in source/build scans.

## Credential activation and live AI verification — 2026-09-14

- Owner completed the native masked replacement-key entry. Keychain presence and guarded real-provider access are confirmed; the chat-exposed credential was never copied or used. AI remains off unless explicitly enabled for the browser tab.
- Final offline suite: **95 passed, 0 failed, 0 skipped**. Syntax checks: **33 modules**. Production build passed. These routine tests do not contact the paid provider.
- Live fictional assessments: v1 9/10; expanded v2 and v3 19/20; final v4 20/20 with a conservative restriction gate. Failed runs, limitations, costs and timing are retained in [the evaluation record](ai-live-evaluation-2026-09-14.md). Small regression-suite success does not establish production accuracy.
- Real browser: keyword weather search → public Visual Crossing specification → labelled partial AI explanation (four displayed statements; two invalid-quotation statements withheld) → shortlist → fictional brief split into two editable requirements → explicit must-have confirmation → AI assessment. JSON received documented support; Singapore/hourly coverage remained unknown after the second check. Expanded source evidence, selected/total coverage and the absence of live/account validation were visible.
- Visually reviewed the normal desktop comparison. Final browser logs reported no errors/warnings. AI was switched off after the checks, with the public example left available. No provider operation or MCP tool was executed. This was exploratory browser verification, not a full accessibility audit or reusable automated UI suite.
- Final ledger: **US$0.213533 charged or reserved; US$4.786467 remaining**. Cap stays US$5 cumulative. No remote, commit, deployment, publication, portfolio-record change or ledger reset was made; the repository still has untracked initial application files.
