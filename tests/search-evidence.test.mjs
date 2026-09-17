import test from 'node:test';
import assert from 'node:assert/strict';
import { McpIndex } from '../server/catalog-index.mjs';
import { normalizeMcp, collapseApiAliases, Catalog } from '../server/catalog.mjs';
import { validateSearchPlan, filterIntent, requestNameChoices } from '../server/search-intent.mjs';
import { PublicDocumentCache, RankingEvidence, selectRankingEvidence } from '../server/ranking-evidence.mjs';
import { rankingContext, validateEvidenceRanking } from '../server/search-ai.mjs';
import { parseSource } from '../server/parser.mjs';
import { source } from './fixtures.mjs';

const page = (name, cursor) => ({ text: JSON.stringify({ servers: [{ server: { name, title: name.split('/').at(-1), version: '1', description: 'Search library documentation', repository: { url: 'https://github.com/example/docs' } } }], metadata: cursor ? { nextCursor: cursor } : {} }), fetchedAt: '2026-09-16T00:00:00Z' });
const api = { id: 'one', name: 'Example API', kind: 'api', provider: 'example.com', product: 'example.com:one', version: '1', description: 'Parking availability in cities', specificationUrl: 'https://example.com/spec', originUrl: 'https://example.com/spec', source: { url: 'https://directory.example.com' } };
const restriction = (name, scope = 'publisher', mode = 'include') => ({ name, scope, mode });

test('intent restrictions require grounded original text and bounded strict schemas', () => {
  const query = "Only Microsoft's own Playwright MCP. Exclude Acme.";
  const value = { queries: ['Playwright browser'], constraints: [restriction('Microsoft'), restriction('Acme', 'publisher', 'exclude')] };
  const plan = validateSearchPlan(value, query); assert.equal(plan.constraints.length, 2); assert.equal(plan.constraints[0].quote, query);
  for (const c of [{ ...value.constraints[0], name: 'Invented' }, { ...value.constraints[0], quote: 'Invented' }, { ...value.constraints[0], scope: 'capability' }]) assert.throws(() => validateSearchPlan({ ...value, constraints: [c] }, query), { code: 'AI_INVALID_RESULT' });
  const choices = requestNameChoices(query); assert.ok(choices.includes('Microsoft')); assert.ok(choices.includes('Playwright MCP')); assert.ok(choices.every(name => query.includes(name))); assert.ok(!choices.includes('Imaginary vendor'));
});
test('publisher identity does not come from a description or third-party repository link', () => {
  const official = { ...api, kind: 'mcp', provider: 'io.github.github', product: 'io.github.github/github-mcp-server', name: 'GitHub MCP' };
  const wrapper = { ...official, id: 'two', provider: 'io.github.other', description: 'Official GitHub integration', repositoryUrl: 'https://github.com/github/github-mcp-server' };
  assert.deepEqual(filterIntent([wrapper, official], [restriction('GitHub')]).map(x => x.id), ['one']);
  assert.deepEqual(filterIntent([wrapper, official], [restriction('GitHub', 'publisher', 'exclude')]).map(x => x.id), ['two']);
});
test('product and publisher restrictions combine without excluding unknown providers globally', () => {
  const sheets = { ...api, provider: 'googleapis.com', product: 'googleapis.com:sheets', name: 'Google Sheets API' };
  const drive = { ...sheets, product: 'googleapis.com:drive', name: 'Google Drive API' };
  assert.deepEqual(filterIntent([drive, sheets], [restriction('Google'), restriction('Sheets', 'product')]), [sheets]);
  assert.equal(filterIntent([{ ...api, provider: 'newvendor.dev' }], [restriction('NewVendor')]).length, 1);
  assert.equal(filterIntent([api], [restriction('Unlisted')]).length, 0);
  const calendar = { ...sheets, product: 'googleapis.com:calendar', name: 'Calendar API' };
  assert.equal(filterIntent([calendar], [restriction('Google Calendar', 'product')]).length, 1);
  const youtube = { ...sheets, product: 'googleapis.com:youtube', name: 'YouTube Data API' };
  assert.deepEqual(filterIntent([sheets, youtube], [restriction('YouTube')]), [youtube]);
});
test('aliases collapse only with the same original specification, title, provider and version', () => {
  const alias = { ...api, id: 'alias', product: 'example.com:alias' };
  const dated = { ...api, id: 'dated', originUrl: 'https://example.com/spec-2025' };
  const other = { ...api, id: 'other', name: 'Different Product' };
  const result = collapseApiAliases([api, alias, dated, other]);
  assert.equal(result.length, 3); assert.deepEqual(result[0].aliases, [api.product, alias.product]);
  assert.equal(collapseApiAliases([{ ...api, originUrl: null }, { ...alias, originUrl: null }]).length, 2);
});
test('local MCP index follows latest-version cursors, coalesces refresh and never sends search text', async t => {
  const urls = []; const index = new McpIndex({ normalize: normalizeMcp, fetcher: async url => { urls.push(url); return page(url.includes('cursor') ? 'io.github.z/second' : 'ac.first/one', url.includes('cursor') ? null : 'next'); } });
  t.after(() => index.close());
  await Promise.all([index.start(), index.start()]); const result = await index.view();
  assert.equal(urls.length, 2); assert.equal(result.entries.length, 2); assert.equal(result.partial, false);
  assert.ok(urls.every(u => new URL(u).searchParams.get('version') === 'latest' && !new URL(u).searchParams.has('search')));
  await index.start(); assert.equal(urls.length, 2);
});
test('MCP index bounds pages, reports partial coverage and rejects repeated cursors', async t => {
  for (const repeated of [true, false]) {
    let calls = 0; const index = new McpIndex({ normalize: normalizeMcp, maxPages: 2, fetcher: async () => page(`io.github.x/item${++calls}`, repeated ? 'same' : `page${calls}`) });
    t.after(() => index.close()); await index.start(); const result = await index.view();
    assert.equal(calls, 2); assert.equal(result.partial, true); assert.match(result.warning, /incomplete/);
  }
});
test('failed registry refresh retains previously loaded entries rather than clearing coverage', async t => {
  let now = 100; let broken = false;
  const index = new McpIndex({ normalize: normalizeMcp, now: () => now, ttlMs: 10, fetcher: async () => { if (broken) throw new Error('upstream'); return page('io.github.x/one'); } });
  t.after(() => index.close()); await index.start(); now = 60120; broken = true; await index.start();
  const result = await index.view();
  assert.equal(result.entries.length, 1); assert.match(index.warning, /stopped early/); assert.equal(result.stale, true); assert.equal(index.updatedAt, 100);
});
test('cancelled index reader stops waiting without discarding shared public work', async t => {
  let release; const index = new McpIndex({ normalize: normalizeMcp, fetcher: () => new Promise(resolve => { release = resolve; }) });
  t.after(() => index.close()); const controller = new AbortController(); const waiting = index.view({ signal: controller.signal });
  controller.abort(); await assert.rejects(waiting, { name: 'AbortError' });
  release(page('io.github.x/one')); await index.running;
  assert.equal(index.entries.size, 1);
});
test('public document cache coalesces requests, respects TTL and has no query keys', async t => {
  let now = 100; let calls = 0; const cache = new PublicDocumentCache({ now: () => now, ttlMs: 10, fetcher: async url => { calls++; return { ...source(), url }; } });
  t.after(() => cache.close());
  await Promise.all([cache.get(api.specificationUrl), cache.get(api.specificationUrl)]); assert.equal(calls, 1);
  now = 120; await cache.get(api.specificationUrl); assert.equal(calls, 2);
  assert.deepEqual([...cache.cache.keys()], [api.specificationUrl]);
  assert.throws(() => cache.get('https://127.0.0.1/'), { code: 'UNSAFE_ADDRESS' });
});
test('public document cache bounds bytes/entries and negative-caches failures', async t => {
  let calls = 0; const cache = new PublicDocumentCache({ maxEntries: 2, maxBytes: 8, fetcher: async url => { calls++; if (url.endsWith('bad')) throw new Error('failed'); return { text: '12345' }; } });
  t.after(() => cache.close()); await cache.get('https://example.com/1'); await cache.get('https://example.com/2');
  assert.ok(cache.bytes <= 8); assert.equal(cache.cache.size, 1);
  await assert.rejects(cache.get('https://example.com/bad')); await assert.rejects(cache.get('https://example.com/bad')); assert.equal(calls, 3);
});
test('cancelling one cached source reader does not cancel another', async t => {
  let release; const cache = new PublicDocumentCache({ fetcher: () => new Promise(resolve => { release = resolve; }) }); t.after(() => cache.close());
  const controller = new AbortController(); const first = cache.get(api.specificationUrl, { signal: controller.signal }); const second = cache.get(api.specificationUrl);
  await Promise.resolve(); controller.abort(); await assert.rejects(first, { name: 'AbortError' }); release(source()); assert.ok((await second).text);
});
test('search evidence uses bounded documentation reads but never calls MCP endpoints', async t => {
  const urls = []; const evidence = new RankingEvidence({ fetcher: async url => { urls.push(url); return source(); }, parser: parseSource, maxCandidates: 1 });
  t.after(() => evidence.close()); const result = await evidence.enrich([{ ...api, kind: 'mcp', remoteEndpoints: [{ type: 'streamable-http', url: 'https://rpc.example.com/mcp' }] }, { ...api, id: 'two' }], 'Private parking project');
  assert.equal(result[0].rankingEvidence.status, 'documentation-read'); assert.equal(result[1].rankingEvidence.status, 'not-read');
  assert.deepEqual(urls, [api.specificationUrl]); assert.equal(JSON.stringify([...evidence.cache.cache.keys()]).includes('Private'), false);
});
test('generic or unavailable documentation never becomes verified capability evidence', async t => {
  const evidence = new RankingEvidence({ fetcher: async () => ({ ...source(), text: '<html><h1>Shop</h1><p>Fresh beans for sale.</p></html>', contentType: 'text/html' }), parser: parseSource }); t.after(() => evidence.close());
  const result = await evidence.enrich([api], 'coffee'); assert.equal(result[0].rankingEvidence.status, 'unavailable');
});
test('operation descriptions survive ranking selection when parameter details repeat more query words', () => {
  const analysis = { capabilities: [{ title: 'Find nearby places', description: 'Search for places around a location.', evidenceIds: ['action', 'detail1', 'detail2', 'detail3'] }], evidence: [
    { id: 'action', excerpt: 'Find nearby places.' },
    ...[1, 2, 3].map(n => ({ id: `detail${n}`, excerpt: 'places location address map inputs longitude latitude' })),
  ] };
  assert.deepEqual(selectRankingEvidence(analysis, 'places location map').map(e => e.id), ['action', 'detail1']);
});
test('directory-only ranking cannot expose the model capability claim or a close-match label', () => {
  const items = [{ ...api, rankingEvidence: { status: 'not-read', excerpts: [] } }]; const context = rankingContext(items);
  const result = validateEvidenceRanking({ matches: [{ id: 'c1', tier: 'close', reason: 'Scans barcode images automatically.', gap: 'Must buy a plan.', evidenceId: 'c1.listing' }], uncovered: [] }, items, context);
  assert.equal(result.items[0].match.tier, 'partial'); assert.doesNotMatch(JSON.stringify(result), /Scans|Must buy/); assert.match(result.items[0].match.reason, /Potential match/);
});
test('documentation ranking attaches server-owned source excerpts and refuses cross-source IDs', () => {
  const item = { ...api, rankingEvidence: { status: 'documentation-read', source: { url: api.specificationUrl }, excerpts: [{ excerpt: 'Look up product details from a UPC code.' }] } };
  const context = rankingContext([item]); const match = { id: 'c1', tier: 'close', reason: 'Looks up product details from a barcode number.', gap: '', evidenceId: 'c1.d1' };
  const result = validateEvidenceRanking({ matches: [match], uncovered: [] }, [item], context);
  assert.equal(result.items[0].match.quote, item.rankingEvidence.excerpts[0].excerpt); assert.equal(result.items[0].signals.strength, 3);
  assert.throws(() => validateEvidenceRanking({ matches: [{ ...match, evidenceId: 'c2.d1' }], uncovered: [] }, [item], context), { code: 'AI_INVALID_RESULT' });
});
test('readable documentation does not override the model relevance ordering', () => {
  const listing = { ...api, rankingEvidence: { status: 'not-read', excerpts: [] } };
  const documented = { ...api, id: 'two', rankingEvidence: { status: 'documentation-read', source: api.source, excerpts: [{ excerpt: 'Related narrow function.' }] } };
  const context = rankingContext([listing, documented]);
  const result = validateEvidenceRanking({ matches: [
    { id: 'c1', tier: 'close', reason: 'Direct lead.', gap: '', evidenceId: 'c1.listing' },
    { id: 'c2', tier: 'partial', reason: 'Related narrow function.', gap: '', evidenceId: 'c2.d1' },
  ], uncovered: [] }, [listing, documented], context);
  assert.deepEqual(result.items.map(x => x.id), ['one', 'two']);
});
