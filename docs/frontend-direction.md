# Frontend direction — first working pass

Status: Owner supplied a working direction; first interface implemented for review. This is not a claim of final visual approval or user-research validation.

## Owner instruction

Build the backend first. Consult the owner before doing up the frontend. Use **emil-design-eng** and **apple-design** as inspiration and direction with the owner's input.

These skills are not permission to assume that APIFit should resemble an Apple marketing page, use glass effects, use a particular colour palette, or add animations. Their applicable value is interaction clarity, hierarchy, accessibility, precise feedback and restrained motion after the owner chooses the product direction.

## Owner's supplied direction

Search should be the central focus. Interactive elements, graphics and animations should be tasteful. It should have life and feel thoughtfully designed specifically for API finding, without a generic AI-generated marketing-site appearance. The owner has no reference sites and invited relevant research and skills.

## Design response

- **One search workspace, two intentions.** Find an API by keyword or understand one from a documentation URL. Recognising a URL switches to the documentation route. No onboarding questionnaire before useful output.
- **Quiet character.** Owner-supplied colour studies replace the initial warm ivory/terracotta direction, which the owner felt resembled Claude. Yacht club is the temporary default, not a final brand decision. System typography with deliberate size/weight/tracking. No external fonts, stock photos, looping backgrounds, AI sparkle motif or fake metrics.
- **Graphics with a job.** Three original vector starting points run real weather, communication and commerce searches. A small modular connector mark changes on search focus; it is an identity detail, not a loading claim.
- **Research without losing place.** A result opens an adjacent capability reader on desktop. On smaller screens it becomes an in-flow panel with explicit close/return behaviour. Results remain available.
- **Evidence progressively disclosed.** A concise product description precedes operation details. Inputs, outputs and auth declarations expand only when asked for. Source dates, coverage limits and account-access uncertainty remain visible.
- **A continuous decision workflow.** Save up to five leads, edit requirements, confirm priorities and prepare a comparison brief. Closing the dialog preserves the draft within the tab. No provider keys or automatic integration execution.

## Motion decisions from the requested skills

Emil's guidance shaped prompt press feedback, specific transition properties, short timings and immediate keyboard actions. Apple's guidance shaped the adjacent reader, preserved context, direct controls, typography hierarchy and gentle material separation.

Motion is limited to press feedback, a small focus-driven mark change, hover response on illustrated starters, brief dialog/toast entrances and an actual waiting spinner. There is no artificial delay, fake progress, entrance animation blocking interaction, or constant decorative movement. Keyboard actions and reduced-motion preferences disable spatial animation. Mobile hover rules are gated to fine pointers.

## Research inputs

- [Apple: Searching](https://developer.apple.com/design/human-interface-guidelines/searching) — primary placement, clear scope, one recognisable search location and privacy-conscious history. Applied to the central field and explicit API/MCP source controls.
- [Kagi: Search settings](https://help.kagi.com/kagi/settings/search.html) — useful control over result presentation and search scope. Applied as a restrained source selector, not a duplicated search engine UI.
- [Kagi: Lenses](https://help.kagi.com/kagi/features/lenses.html) — visible scope can help people understand where results come from. APIFit does not claim to implement Kagi's custom lenses.
- [Postman: Public API search](https://learning.postman.com/docs/postman-api-network/explore/find/search) and its live public network — API and MCP discovery are adjacent jobs. APIFit's interface emphasises a focused investigation rather than the broader publishing/network navigation.

These are design references, not competitor endorsement, copied visual assets or evidence of usability validation.

## Carry-forward requirements for any approved direction

- Keep “Find an API” and “Understand an API” accessible without a full project brief.
- Clearly separate relevance, documented evidence, unknowns, human review and actual test observations.
- Use plain-language labels and progressive disclosure for technical fields.
- Keep source failures, partial coverage, disabled AI features and account-access uncertainty visible.
- Provide keyboard access, accessible form labels, visible focus, adequate contrast and reduced-motion behaviour.
- Do not collect provider API keys. Do not imply that downloading a brief means an API was validated.

## Next review with the owner

Use the temporary **Colour study** control beside the logo to compare the owner's four palettes on the same interface. On a narrow screen, use the small colour swatch. The adjacent sun/moon button toggles light and dark mode. Both apply to the whole workspace without resetting search, reader or shortlist state. Only these visual preferences are stored under `apifit.appearance`; no query, brief or key is persisted. First visits start in dark Yacht club. Remove the palette study control once the owner chooses a direction; the mode toggle remains useful.

| Study | Supplied colours | Application |
| --- | --- | --- |
| Yacht club | `#F2F0EF`, `#BBBDBC`, `#245F73`, `#733E24` | Neutral canvas, teal headline/actions, small brown illustration accents |
| Jade pebble morning | `#7B9669`, `#E6E6E6`, `#404E3B`, `#6C8480`, `#BAC8B1` | Forest actions, sage illustrations, desaturated teal linework |
| Driftwood pearl morning | `#BC7B6F`, `#5A322A`, `#CCCDC7`, `#E4A499`, `#718A9E` | Brown/rose actions and rose/slate illustrations on the shared neutral canvas |
| Frozen mist | `#7C7D75`, `#ADACA7`, `#DD700B`, `#FCF8D8`, `#D9DADF` | Stone/gray base, orange actions with dark text, pale yellow secondary surfaces |

Lighter surface tints and darker text variants supplement the supplied colours. The accessibility-review skill shaped colour roles: pale colours are not small white-text buttons; Frozen mist uses dark button text and darker orange text links. Focus outlines and form boundaries use separately tested contrast pairs. This is a scoped colour review, not a complete accessibility audit. Search layout, interactions and product scope are otherwise unchanged.

## Neutral surfaces and dark mode — owner revision

The owner explicitly rejected the pastel-cream background and requested dark mode. This supersedes the cream/pearl structural surfaces in the original palette references; those references now guide accents rather than the whole canvas.

| Before | After | Why |
| --- | --- | --- |
| Palette-tinted near-white background | Shared silver-grey `#F3F4F6` canvas and white panels | Removes the warm cream cast while preserving clear search hierarchy |
| Light-only surfaces | Graphite `#111315` canvas and charcoal `#1C1F22` panels | Depth comes from distinct surfaces, not colour inversion or glowing backgrounds |
| Dark accent text designed for white surfaces | Separately tuned dark-mode accent, text, focus, warning and error colours | Keeps all four palettes usable and readable in both modes |
| Appearance reset on reload | Whitelisted visual preferences loaded by a same-origin script before the body | Remembers the user's choice without persisting project data or relaxing the content policy |

Emil's guidance keeps keyboard toggles immediate; pointer-triggered canvas changes use a short 160ms colour transition. Apple's guidance shaped the separate surface levels and adaptive foreground colours. The accessibility review adds contrast checks for eight palette/mode combinations, including toast, warning and error pairings. No full-page glow, decorative animation or new product workflow was added.

## Content scale and spacing — owner revision, 2026-09-14

The owner found the text and visuals too small relative to the page. This is a homepage proportion pass, not a new workflow or a final visual approval.

| Before | After | Why |
| --- | --- | --- |
| Search capped at 790px; starter section at 964px | Shared responsive grid capped at 1200px | Makes search more prominent and aligns the two functional sections |
| Desktop search text 21px; starter titles 14px; descriptions 11px | 25px search text; 18px titles; 13px descriptions | Uses the available area for readable content rather than padding |
| Starter illustrations 118×70px | 180×107px on desktop, scaled down on tablet/phone | Gives the existing functional illustrations more presence |
| 54px gap before starters, 24px below the motif; extra gaps on large screens | 30px and 12px respectively; no large-screen gap inflation | Connects the heading, search and starting points into one composition |
| Single-row source controls and submit action on the narrowest phones | Stacked source row and full-width action below 361px | Prevents controls colliding while retaining readable text |

Emil's guidance shaped consistent spacing and responsive controls; Apple's hierarchy guidance shaped the larger type and proportional graphics. Palettes, dark mode, existing motion and product behaviour are unchanged. The results workspace retains its existing compact layout.

## Discovery studio revision — 2026-09-14

The owner requested more professional visuals, a better search box, useful interaction, more character and readable supporting text. This revision supersedes the original centred heading and three illustrated starter cards; approval still belongs to the owner.

### Reference study

- [Raycast Store](https://www.raycast.com/store): observed its live interface and search entry. Borrow the clear search/control hierarchy and tangible component treatment, not its promotional page structure. Computed heading/body font was Inter; a font alone is not evidence of how a site was made.
- [Are.na](https://www.are.na/): observed its live interface and larger editorial text. Its [custom Areal typeface](https://www.are.na/editorial/introducing-areal-are-nas-new-typeface) demonstrates deliberate typography. Borrow legibility and direct language; do not copy the proprietary font.
- [Cosmos](https://www.cosmos.so/): observed its live search entry, large typography and layered imagery. Computed heading/search font was cosmosOracle. Borrow the visual depth and confident hierarchy, not its assets or distracting full-page movement.
- [Instrument Sans](https://github.com/Instrument/instrument-sans): the chosen open-source alternative was designed by Rodrigo Fuenzalida with direction from Jordan Egstad for Instrument. The official 88,784-byte variable WOFF2 and OFL license are bundled in `public/fonts/`. Font requests remain same-origin; no runtime font CDN or new package dependency.

These are observations of existing products, not claims about whether their teams ever use AI. The design decision is grounded in the rendered interfaces and original font provenance.

| Before | After | Why |
| --- | --- | --- |
| Centred heading and separate small doodles | Offset display heading and original layered API/MCP/docs modules | Gives APIFit a distinctive composition tied to its actual subject |
| Large generic field with disconnected modes and captions | One search console with segmented modes, a clear action and source controls | Keeps the primary task obvious and groups related controls |
| Three static illustrated starter buttons | Selectable topics revealing nine real example searches | Adds exploration with an actual outcome; these are examples, not recommendations or a scope limit |
| Small body and metadata text throughout the workspace | Instrument Sans, 14–19px working copy and generally 12–14px metadata | Makes results, documentation and dialogs readable, not just the hero |
| Decorative tiny captions | Fewer captions; readable keyword-search limitation opens the existing explanation | Reduces visual noise without concealing missing AI capabilities |
| Minimal visual feedback | Source-responsive modules, brief hover/press feedback, fanning docs stack and visible saved state | Adds character tied to user action; no loops, synthetic progress or input delays |

Emil's rules govern interruptible, short CSS transitions and instant keyboard actions. Apple's rules govern readable hierarchy, state preservation and purposeful feedback. The redesign skill shaped the type replacement, asymmetric layout and removal of repeated card patterns. Existing palettes, light/dark storage, backend safeguards and product scope are preserved. The decorative hero is hidden on small phones so the search remains prominent.

## Selected Yacht Club palette — 2026-09-14

The owner selected Yacht Club, removed the burgundy/brown tertiary colour, and asked for a more lively replacement for secondary grey. The revised two-colour identity pairs the existing ocean teal (`#245F73`, with a lighter dark-mode variant) with muted citron (`#D6E68A`). Structural backgrounds remain neutral, not cream. Supporting lines and selected surfaces lean toward teal rather than flat grey.

- Citron appears on the MCP module and front documentation sheet. The documentation entry has a lighter/darker citron-family surface and matching action text; search actions stay teal.
- Dark ink is used on citron fills. Olive text is reserved for pale secondary surfaces; dark mode uses the brighter citron foreground. The design-system and accessibility skills guided semantic token reuse and contrast testing rather than scattering new colours through components.
- Research reference: [Tealium's official brand assets](https://tealium.com/company/brand-assets/) pair teal with lime. This informed the colour relationship only; APIFit's shade, artwork, typography and layout remain its own. No third brand hue or brand assets were copied.
- The temporary four-palette picker and unused palette definitions are retired. Older saved choices migrate to Yacht while preserving the user's light/dark preference. The mode toggle remains. No search, evidence, backend or privacy behaviour changed.

This is an implemented colour direction for owner review, not a claim of final visual approval.

## Owner-selected pearl + sea glass — 2026-09-14

Supersedes the citron exploration above. The owner clarified that the grey **page background** was the problem and requested quieter secondary alternatives. After reviewing three paired background/accent options, the owner selected pearl + sea glass.

- Light mode uses the selected pearl canvas `#F7FAF9`, white working surfaces and sea-glass artwork `#AFCBC4`. Teal `#245F73` remains the primary action colour.
- Dark mode uses deep petrol `#102125`, raised teal panels `#1B3036` and sea-glass artwork `#9BBAB4`, matching the selected comparison. Secondary text and tinted surfaces are adjusted for readable contrast.
- The same tokens cover documentation panels, MCP badges, artwork and controls. The early theme-colour script, HTML fallback and browser icon match the new direction. No citron or burgundy brand accent remains.
- Design-system and accessibility skills guided consistent colour roles and contrast checks. No layout, type, interaction, backend or data-storage changes were made. Existing light/dark preferences are preserved.

## Near-black dark-mode refinement — 2026-09-14

The owner approved pearl light mode but preferred dark mode as close to black as practical. The dark canvas is now `#0C0E0F`, with raised panels at `#171B1D` and less saturated dark selection/documentation surfaces. Teal and sea-glass accents are retained. The pearl light palette and shared light-mode tokens are unchanged; only dark-mode colours, matching browser chrome/icon colours and their regression expectations were updated. Design-system and accessibility skills guided consistent surface separation and contrast verification.
