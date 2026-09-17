import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { parseSource } from '../server/parser.mjs';
import { source, apiDirectory } from './fixtures.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { directoryContext, validateRanking, validateSearchQueries, handoffContext, validateHandoff, exportHandoff } from '../server/search-ai.mjs';
import { normalizeApis, Catalog } from '../server/catalog.mjs';
import { knownRetirement } from '../server/lifecycle.mjs';
import { mergeOptions, shortlistKey } from '../src/search-state.mjs';
import { readFile } from 'node:fs/promises';
import { relatedTerms } from '../server/text.mjs';

// Synthetic model responses only: this file never reads credentials or uses a provider.
const options = { ai: true, aiConsent: AI_CONSENT };
const items = normalizeApis(apiDirectory, '2026-09-14');
const candidateContext = directoryContext(items);
const match = (index, override = {}) => ({ id: `c${index + 1}`, tier: 'close', reason: 'A related capability.', gap: '', quote: candidateContext[index].excerpt.split('\n')[2], ...override });
const analysis = () => parseSource(source());
function service(run) {
  return new AiService({ client: { run }, budget: { status: async () => ({ available: true, remainingUsd: 4 }) }, credentialStatus: async () => 'stored' });
}
function briefResponse(context) {
  return { integrations: Object.fromEntries(context.map(c => [c.id, explanationResponse(c)])) };
}
function explanationResponse(context) {
  return { sourceFit: 'software-docs', capabilities: [{ title: 'Find parking', does: 'Reads available parking spaces.', helps: 'You could show drivers spaces in their chosen city.', evidenceIds: [context.evidence[0].id] }], checks: ['Confirm location coverage.'] };
}
async function serve(t, overrides = {}) {
  const calls = [];
  const ai = service(async (task, context) => {
    calls.push(task);
    if (task === 'searchQueries') return { queries: ['parking'] };
    if (task === 'searchPlan') return { queries: ['parking'], constraints: [] };
    if (task === 'rankEvidence') return { matches: context.candidates.map(c => ({ id: c.id, tier: 'partial', reason: 'Find available parking.', gap: '', evidenceId: c.evidence[0].id })), uncovered: [] };
    if (task === 'rank') return { matches: context.candidates.map(c => ({ id: c.id, tier: 'close', reason: 'Find available parking.', gap: '', quote: 'Parking availability in cities' })), uncovered: [] };
    if (task === 'summary') return explanationResponse(context);
    if (task === 'handoff') return briefResponse(context.candidates);
    throw new Error(`Unexpected task: ${task}`);
  });
  const app = createApp({ fetcher: async url => url.includes('apis.guru') ? source(apiDirectory) : source(), parser: parseSource, ai, evidenceSearch: true, ...overrides });
  const server = app.listen(0, '127.0.0.1'); server.once('close', app.locals.dispose);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { calls, request: (path, body) => fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}

test('internal search phrases are bounded, unique and may decline unrelated requests', () => {
  assert.deepEqual(validateSearchQueries({ queries: ['parking', 'parking'] }), ['parking']);
  assert.deepEqual(validateSearchQueries({ queries: [] }), []);
  for (const value of [{ queries: [''] }, { queries: ['x'.repeat(151)] }, { queries: [1] }, { queries: [], questions: [] }]) assert.throws(() => validateSearchQueries(value), { code: 'AI_INVALID_RESULT' });
});
test('retrieval considers relevant words beyond the first forty description terms', () => {
  const description = Array.from({ length: 60 }, (_, i) => `filler${i}`).join(' ') + ' cafe places';
  assert.deepEqual(relatedTerms('cafe places', description), ['cafe', 'places']);
});
test('negative suffixes in generated phrases cannot become positive provider keywords', () => {
  assert.deepEqual(validateSearchQueries({ queries: ['SMS API', 'messaging API not Vendor', 'SMS API excluding Vendor'] }), ['SMS API', 'messaging API']);
  for (const suffix of ['not', 'no', 'excluding', 'except', 'without', 'avoid', 'avoiding']) {
    assert.deepEqual(validateSearchQueries({ queries: [`text messages ${suffix} Vendor`] }), ['text messages']);
  }
  assert.deepEqual(validateSearchQueries({ queries: ['Notion pages', 'no-code integrations', 'Not Boring API'] }), ['Notion pages', 'no-code integrations', 'Not Boring API']);
});
test('source-backed retirement exclusions remove old Bing APIs, not unrelated Microsoft products', async () => {
  const product = 'microsoft.com:cognitiveservices-LocalSearch';
  assert.equal(knownRetirement(product).status, 'retired');
  assert.equal(knownRetirement('microsoft.com:azure-search'), null);
  assert.equal(knownRetirement(product, Date.parse('2025-01-01')), null);
  const directory = { ...apiDirectory, [product]: { preferred: '1', versions: { 1: { info: { title: 'Local Search Client', description: 'Parking places' } } } } };
  const catalog = new Catalog({ fetcher: async () => source(directory) });
  const result = await catalog.search({ query: 'parking', source: 'api' });
  assert.ok(result.items.every(item => item.product !== product));
  assert.equal(result.sources[0].knownRetiredExcluded, 1);
});
test('ranking preserves relevance order even when an earlier lead has a stronger evidence caveat', () => {
  const result = validateRanking({ matches: [match(0, { tier: 'partial' }), match(1)], uncovered: ['Freshness is not established.'] }, items, candidateContext);
  assert.equal(result.items[0].id, items[0].id);
  assert.equal(result.items[1].specificationUrl, items[1].specificationUrl);
  assert.ok(result.items.every(item => item.rankingOrder === 'relevance-first-v3'));
  assert.match(result.items[0].signals.reliability, /Not measured/);
  assert.equal(result.items[0].reliabilityScore, undefined);
});
test('ranking rejects hallucinated IDs, duplicate entries, fabricated quotes and extra verdicts', () => {
  for (const bad of [match(0, { id: 'unknown' }), match(0, { quote: '99.99% uptime' }), match(0, { tier: 'perfect' }), match(0, { rating: 100 }), match(0, { reason: 'x'.repeat(181) })]) {
    assert.throws(() => validateRanking({ matches: [bad], uncovered: [] }, items, candidateContext), { code: 'AI_INVALID_RESULT' });
  }
  assert.throws(() => validateRanking({ matches: [match(0), match(0)], uncovered: [] }, items, candidateContext), { code: 'AI_INVALID_RESULT' });
  assert.deepEqual(validateRanking({ matches: [], uncovered: [] }, items, candidateContext).items, []);
});
test('named API and MCP lookups can return plain identity leads without inventing capability evidence', () => {
  const candidates = [
    { id: 'api:sample', product: 'sample.example:widget', kind: 'api', name: 'Widget API', description: '' },
    { id: 'mcp:sample', product: 'io.github.widget/widget-mcp', kind: 'mcp', name: 'Widget MCP', description: '' },
  ];
  const context = directoryContext(candidates);
  const response = { matches: context.map((c, i) => ({ id: c.id, tier: 'partial', reason: `Listed as ${candidates[i].name}.`, gap: 'Check whether it supports your planned feature.', quote: c.excerpt.split('\n')[0] })), uncovered: [] };
  const result = validateRanking(response, candidates, context);
  assert.equal(result.items.length, 2);
  assert.ok(result.items.every(i => i.match.tier === 'partial' && i.match.basis.includes('identity only')));
  const fabricated = structuredClone(response); fabricated.matches[0].quote = 'Official verified tool';
  assert.equal(validateRanking(fabricated, candidates, context).items.length, 1);
});
test('identity-only citations cannot carry capability or ownership assertions', () => {
  const candidate = { id: 'api:sample', product: 'sample.example:widget', kind: 'api', name: 'Widget API', description: 'Public listing.' };
  const context = directoryContext([candidate]);
  for (const quote of [context[0].excerpt.split('\n')[0], context[0].excerpt.split('\n').slice(0, 2).join('\n')]) {
    const result = validateRanking({ matches: [{ id: 'c1', tier: 'close', reason: 'Automatically retrieves every customer record.', gap: '', quote }], uncovered: [] }, [candidate], context);
    assert.equal(result.items[0].match.tier, 'partial');
    assert.doesNotMatch(result.items[0].match.reason, /customer|Automatically/);
    assert.match(result.items[0].match.basis, /capabilities have not been checked/);
    assert.equal(result.items[0].match.quote, quote);
  }
});
test('unverified ownership or reliability assurances are replaced by a neutral listing lead', () => {
  for (const reason of ['The official connector.', 'A verified safe integration.', 'Reliable API with guaranteed uptime.']) {
    const result = validateRanking({ matches: [match(0, { reason })], uncovered: [] }, items, candidateContext);
    assert.equal(result.items.length, 1); assert.equal(result.items[0].match.tier, 'partial');
    assert.equal(result.items[0].match.reason, 'Found in public listings. Open an explanation to check what it can do.');
    assert.equal(result.items[0].match.quote, `Name: ${items[0].name}`);
    assert.match(result.items[0].match.basis, /assurance was withheld/);
  }
});
test('brief input is bounded per source and citations cannot cross sources', () => {
  const analyses = [analysis(), analysis()]; const context = handoffContext(analyses, 'parking');
  assert.ok(context.every(c => c.evidence.length <= 8 && Buffer.byteLength(JSON.stringify(c.evidence)) < 5100));
  const result = validateHandoff(briefResponse(context), analyses, context);
  assert.equal(result.integrations.length, 2);
  assert.equal(result.nextStepsBasis, 'APIFit checklist, not AI-generated API instructions');
  assert.throws(() => validateHandoff({ ...briefResponse(context), nextSteps: ['Read invented menu fields'] }, analyses, context), { code: 'AI_INVALID_RESULT' });
  const bad = briefResponse(context); bad.integrations.c99 = bad.integrations.c1; delete bad.integrations.c2;
  assert.throws(() => validateHandoff(bad, analyses, context), { code: 'AI_INVALID_RESULT' });
  const invented = briefResponse(context); invented.integrations.c1.capabilities[0].evidenceIds = ['unknown'];
  assert.throws(() => validateHandoff(invented, analyses, context), { code: 'AI_INVALID_RESULT' });
});
test('one invalid quoted candidate is withheld without erasing independently valid matches', () => {
  const result = validateRanking({ matches: [match(0, { quote: 'fabricated claim' }), match(1)], uncovered: [] }, items, candidateContext);
  assert.equal(result.withheldMatches, 1); assert.deepEqual(result.items.map(x => x.id), [items[1].id]);
  assert.equal(JSON.stringify(result).includes('fabricated claim'), false);
  assert.throws(() => validateRanking({ matches: [match(0, { id: 'invented' }), match(1)], uncovered: [] }, items, candidateContext), { code: 'AI_INVALID_RESULT' });
});
test('credential-like public metadata is omitted without sending it or blocking clean matches', async () => {
  const calls = []; const sensitive = { ...items[0], description: 'Bearer ' + 'synthetic'.repeat(8) };
  const ai = service(async (task, data) => { calls.push(data); return { matches: [{ id: 'c1', tier: 'close', reason: 'Weather information.', gap: '', quote: data.candidates[0].excerpt.split('\n')[0] }], uncovered: [] }; });
  const result = await ai.rank('weather', [sensitive, items[1]], options);
  assert.equal(result.omittedSensitiveListings, 1); assert.equal(result.items[0].id, items[1].id);
  assert.equal(JSON.stringify(calls).includes('Bearer'), false);
  const empty = await ai.rank('weather', [sensitive], options);
  assert.equal(calls.length, 1); assert.deepEqual(empty.items, []);
  assert.throws(() => ai.rank('Bearer ' + 'synthetic'.repeat(8), items, options), { code: 'AI_SENSITIVE_INPUT' });
});
test('summary is one optional task with invalid quoted claims withheld', async () => {
  const ai = service(async () => ({ sourceFit: 'software-docs', capabilities: [{ title: 'Invented', does: 'Invented text', helps: 'Invented use', evidenceIds: ['unknown'] }], checks: [] }));
  const result = await ai.summarize(analysis(), options);
  assert.equal(result.capabilities.length, 0); assert.equal(result.withheldStatements, 1);
});
test('all new AI tasks preserve opt-in and do not silently start a model request', async () => {
  let calls = 0; const ai = service(async () => { calls++; });
  for (const action of [() => ai.searchPlan('parking', {}), () => ai.searchQueries('parking', {}), () => ai.rank('parking', items, {}), () => ai.summarize(analysis(), {}), () => ai.handoff('parking', [analysis()], {})]) {
    await assert.rejects(action(), { code: 'AI_CONSENT_REQUIRED' });
  }
  assert.equal(calls, 0);
});
test('HTTP new flow searches, ranks, explains on demand and writes a brief without a requirement gate', async t => {
  const { request, calls } = await serve(t);
  const response = await request('/api/discover', { query: 'Find parking', source: 'api', ...options });
  assert.equal(response.status, 200); const found = await response.json();
  assert.equal(found.items.length, 1); assert.equal(found.ranking.mode, 'ai-ranked-directory-leads');
  assert.deepEqual(calls, ['searchPlan', 'rankEvidence']);
  assert.equal(found.requirements, undefined); assert.equal(found.confirmed, undefined);
  const summary = await (await request('/api/summaries', { url: found.items[0].specificationUrl, ...options })).json();
  assert.equal(summary.kind, 'summary'); assert.equal(summary.summary.capabilities.length, 1);
  assert.deepEqual(calls, ['searchPlan', 'rankEvidence', 'summary']);
  const brief = await (await request('/api/build-briefs', { query: found.query, urls: [found.items[0].specificationUrl], ...options })).json();
  assert.equal(brief.kind, 'build-brief'); assert.equal(brief.integrations.length, 1);
  assert.deepEqual(calls, ['searchPlan', 'rankEvidence', 'summary', 'handoff']);
  const downloaded = await request(`/api/build-briefs/${brief.id}/download`);
  assert.match(await downloaded.text(), /# APIFit build brief/);
  assert.equal(downloaded.headers.get('cache-control'), 'no-store');
});
test('keyword discovery remains free and invalid source requests never call AI', async t => {
  const { request, calls } = await serve(t);
  const result = await (await request('/api/discover', { query: 'parking', source: 'api' })).json();
  assert.equal(result.items.length, 1); assert.equal(result.ranking.mode, 'keyword-search');
  assert.equal((await request('/api/discover', { query: 'parking', source: 'made-up', ...options })).status, 400);
  assert.equal((await request('/api/discover', { query: '', ...options })).status, 400);
  assert.deepEqual(calls, []);
});
test('unvalidated evidence ranking is not enabled in the default flow or by a browser request flag', async t => {
  const { request, calls } = await serve(t, { evidenceSearch: false, rankingEvidence: { enrich: () => { throw new Error('Experimental enrichment must not run'); } } });
  const response = await request('/api/discover', { query: 'Find parking', source: 'api', evidenceSearch: true, ...options });
  const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.items.length, 1);
  assert.equal(result.ranking.experimentalEvidenceSearch, false); assert.deepEqual(calls, ['searchQueries', 'rank']);
});
test('more results reuse the server-held intent and rank without another interpretation request', async t => {
  let drafts = 0; let ranks = 0; const requests = [];
  const { request } = await serve(t, {
    ai: { searchQueries: async () => { drafts++; return ['parking']; }, rank: async (query, candidates) => { assert.equal(query, 'My parking idea'); ranks++; return { items: candidates, uncovered: [] }; } },
    catalog: { search: async input => { requests.push(input); return { items: [items[0]], sources: [], coverage: {}, pagination: { nextOffset: input.offset ? null : 24, nextMcpCursor: null } }; } },
  });
  const first = await (await request('/api/discover', { query: 'My parking idea', ...options })).json();
  const next = await request(`/api/discover/${first.id}/more`, { query: 'client-injected query', ...options });
  assert.equal(next.status, 200); assert.equal(drafts, 1); assert.equal(ranks, 2);
  assert.equal(requests[1].offset, 24); assert.deepEqual(requests[1].queries, ['parking']);
});
test('unrelated intent makes no directory request and returns no invented examples', async t => {
  const { request } = await serve(t, { ai: { searchQueries: async () => [] }, catalog: { search: () => { throw new Error('Must not browse everything'); } } });
  const result = await (await request('/api/discover', { query: 'Tell me a joke', ...options })).json();
  assert.deepEqual(result.items, []); assert.equal(result.nextRequest, null);
});
test('explicit named-product discovery can retain an identity-only lead without claiming capability', async t => {
  const { request } = await serve(t, { ai: { searchPlan: async () => ({ queries: ['parking'], constraints: [{ name: 'Parking', scope: 'product', mode: 'include' }] }), rank: async () => ({ items: [], uncovered: [] }) } });
  const response = await request('/api/discover', { query: 'Find Parking API itself', source: 'api', ...options });
  const result = await response.json(); assert.equal(response.status, 200); assert.equal(result.items.length, 1);
  assert.match(result.items[0].match.reason, /fit for this feature still needs checking/); assert.equal(result.items[0].match.tier, 'partial');
});
test('brief records unreadable and unlinked selections without guessing their roles', async t => {
  const { request, calls } = await serve(t, { fetcher: async url => { if (url.includes('broken')) throw new Error('Private internals'); return source(); } });
  const result = await (await request('/api/build-briefs', { query: 'Parking', urls: ['https://docs.example.com/spec', 'https://docs.example.com/broken'], unlinked: ['No linked docs'], ...options })).json();
  assert.equal(result.integrations.length, 1); assert.equal(result.unreadable.length, 2);
  assert.equal(result.unreadable[0].name, 'No linked docs');
  assert.ok(!JSON.stringify(result).includes('Private internals')); assert.deepEqual(calls, ['handoff']);
  const markdown = await (await request(`/api/build-briefs/${result.id}/download`)).text();
  assert.match(markdown, /No linked docs/);
});
test('no readable docs means no paid generation, unsafe URLs never enter partial brief records', async t => {
  let fetched = 0;
  const { request, calls } = await serve(t, { fetcher: async () => { fetched++; throw new Error('unavailable'); } });
  for (const url of ['http://example.com', 'https://127.0.0.1/', 'https://example.com/?api_key=do-not-echo']) {
    const response = await request('/api/build-briefs', { query: 'Parking', urls: [url], ...options });
    assert.ok([400, 422].includes(response.status));
    const rejected = await response.json();
    assert.ok(['UNSAFE_URL', 'UNSAFE_ADDRESS', 'CREDENTIAL_URL', 'AI_SENSITIVE_INPUT'].includes(rejected.error.code), rejected.error.code);
    assert.ok(!JSON.stringify(rejected).includes('do-not-echo'));
  }
  assert.equal(fetched, 0);
  assert.equal((await request('/api/build-briefs', { query: 'Parking', urls: ['https://docs.example.com/spec'], ...options })).status, 422);
  assert.deepEqual(calls, []);
});
test('exports escape active Markdown and retain explicitly unavailable selections', () => {
  const context = handoffContext([analysis()], 'parking'); const result = validateHandoff(briefResponse(context), [analysis()], context);
  const markdown = exportHandoff({ ...result, query: '[click](javascript:alert(1))', unreadable: [{ name: '<script>', message: 'No docs' }] });
  assert.ok(!markdown.includes('[click](javascript:alert(1))')); assert.ok(!markdown.includes('<script>'));
});
test('merged batches are unique and preserve relevance ordering; brief cache changes with shortlist', () => {
  const close = { id: 'a', match: { tier: 'close' }, signals: { strength: 1 } }; const partial = { id: 'b', match: { tier: 'partial' }, signals: { strength: 2 } };
  assert.deepEqual(mergeOptions([partial], [close, partial]).map(i => i.id), ['a', 'b']);
  assert.notEqual(shortlistKey('parking', [close]), shortlistKey('parking', [close, partial]));
  assert.notEqual(shortlistKey('parking', [close]), shortlistKey('weather', [close]));
  assert.deepEqual(mergeOptions([{ ...partial, rankingOrder: 'relevance-first-v3' }], [close]).map(i => i.id), ['b', 'a']);
});
test('active interface has no requirement editor, assessment action or paid shortlist operation', async () => {
  const main = await readFile(new URL('../src/main.jsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/SearchApp.jsx', import.meta.url), 'utf8');
  assert.match(main, /SearchApp/); assert.doesNotMatch(app, /InlineRequirements|\/assessments|\/requirements\/draft/);
  const save = app.slice(app.indexOf('function save('), app.indexOf('function closeAction('));
  assert.doesNotMatch(save, /api\(|fetch\(|withAi\(/);
  assert.match(app, /summaries\.current\.has\(key\)/);
});
