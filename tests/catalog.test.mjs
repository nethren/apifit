import test from 'node:test';
import assert from 'node:assert/strict';
import { Catalog, normalizeApis, normalizeMcp, collapseMcpVersions } from '../server/catalog.mjs';
import { apiDirectory, mcpDirectory } from './fixtures.mjs';

test('keeps products separate, includes versions and distinguishes metadata from capability evidence', () => {
  const entries = normalizeApis(apiDirectory, 'date');
  assert.equal(entries.length, 2); assert.equal(entries[0].availableVersions.length, 2);
  assert.equal(entries[0].provider, 'sample.org'); assert.equal(entries[1].provider, 'sample.org');
  assert.notEqual(entries[0].id, entries[1].id); assert.equal(entries[0].source.evidenceLevel, 'directory-metadata');
});
test('MCP metadata never implies tool execution or safety and excludes deleted records', () => {
  const entries = normalizeMcp(mcpDirectory, 'date');
  assert.equal(entries.length, 1); assert.deepEqual(entries[0].transports, ['stdio']);
  assert.ok(entries[0].warning.includes('not a safety review'));
});
test('MCP revisions occupy one search slot; explicit latest beats version spelling or update time', () => {
  const entry = (version, extra = {}) => ({ id: `mcp:test:${version}`, product: 'org.example/tool', kind: 'mcp', version, registryLatest: false, ...extra });
  const api = { id: 'api:one', product: 'org.example/tool', kind: 'api', version: '1' };
  const result = collapseMcpVersions([entry('9', { registryUpdatedAt: '2026-09-15' }), entry('10', { registryLatest: true, registryUpdatedAt: '2026-09-01' }), api]);
  assert.equal(result.length, 2); assert.equal(result[0].version, '10');
  assert.deepEqual(result[0].loadedVersions, ['9', '10']); assert.deepEqual(result[1], api);
  assert.equal(collapseMcpVersions([entry('9'), entry('10', { registryUpdatedAt: '2026-09-01' })])[0].version, '10');
});
test('cached keyword discovery keeps queries local and reports MCP page scope', async () => {
  const urls = [];
  const catalog = new Catalog({ fetcher: async url => { urls.push(url); return { text: JSON.stringify(url.includes('apis.guru') ? apiDirectory : mcpDirectory), fetchedAt: 'date' }; } });
  const result = await catalog.search({ query: 'I need an API for car park availability' });
  assert.equal(result.items.length, 2); assert.equal(result.pagination.nextMcpCursor, mcpDirectory.metadata.nextCursor);
  assert.equal(result.mode, 'keyword-directory-search'); assert.equal(result.webSearch, 'not-configured');
  await catalog.search({ query: 'weather' }); assert.equal(urls.length, 2);
  assert.ok(urls.every(url => !url.includes('availability') && !url.includes('weather')));
  await catalog.search({ query: 'parking', source: 'mcp', mcpCursor: result.pagination.nextMcpCursor });
  assert.equal(new URL(urls[2]).searchParams.get('cursor'), mcpDirectory.metadata.nextCursor);
});
test('one failed source preserves the other source with no fabricated fallback', async () => {
  const catalog = new Catalog({ fetcher: async url => { if (url.includes('apis.guru')) throw new Error('private secret'); return { text: JSON.stringify(mcpDirectory) }; } });
  const result = await catalog.search({ query: 'parking' });
  assert.equal(result.items.length, 1); assert.equal(result.sources[0].status, 'unavailable'); assert.ok(!JSON.stringify(result).includes('private secret'));
});
test('search pagination and bounds are explicit', async () => {
  const catalog = new Catalog({ fetcher: async () => ({ text: JSON.stringify(apiDirectory) }) });
  const result = await catalog.search({ source: 'api', limit: 1 });
  assert.equal(result.pagination.nextOffset, 1);
  assert.equal((await catalog.search({ source: 'api', limit: 1, offset: 1 })).pagination.nextOffset, null);
  await assert.rejects(catalog.search({ source: 'payments' }), { code: 'INVALID_SEARCH' });
  await assert.rejects(catalog.search({ limit: 101 }), { code: 'INVALID_SEARCH' });
});
test('a relevant API title outranks a passing mention in another product description', async () => {
  const data = structuredClone(apiDirectory);
  data['sample.org:parking'].versions[1].info.description += ' and weather';
  const catalog = new Catalog({ fetcher: async () => ({ text: JSON.stringify(data) }) });
  const result = await catalog.search({ source: 'api', query: 'weather' });
  assert.equal(result.items[0].name, 'Weather API'); assert.deepEqual(result.items[0].relevance.titleTerms, ['weather']);
});
test('expanded queries merge real products, retain explanations and paginate without repeating retrieval', async () => {
  let calls = 0;
  const catalog = new Catalog({ fetcher: async () => { calls++; return { text: JSON.stringify(apiDirectory) }; } });
  const request = { query: 'Plan an outdoor visit', queries: ['parking', 'weather', 'PARKING'], source: 'api', limit: 1 };
  const first = await catalog.search(request);
  const second = await catalog.search({ ...request, offset: first.pagination.nextOffset });
  assert.equal(first.mode, 'expanded-directory-search'); assert.equal(first.pagination.matchesInLoadedMetadata, 2);
  assert.notEqual(first.items[0].id, second.items[0].id); assert.equal(calls, 1);
  assert.deepEqual(first.queries, ['PARKING', 'weather']);
  assert.ok(first.items[0].matchedQueries.length); assert.equal(first.semanticSearch, 'not-configured');
  assert.ok(first.items.every(item => item.source.evidenceLevel === 'directory-metadata'));
});
test('empty, meaningless and oversized query expansions cannot accidentally browse everything', async () => {
  let calls = 0; const catalog = new Catalog({ fetcher: async () => { calls++; } });
  for (const queries of [[], [''], ['the API'], ['x'.repeat(151)], ['a', 'b', 'c', 'd'], 'parking', [null]]) {
    await assert.rejects(catalog.search({ queries }), { code: 'INVALID_QUERIES' });
  }
  for (const mcpPages of [0, 4, 1.5, '3']) await assert.rejects(catalog.search({ mcpPages }), { code: 'INVALID_SEARCH' });
  assert.equal(calls, 0);
});
test('expanded retrieval does not match unrelated APIs on generic formats or infrastructure words', async () => {
  const data = structuredClone(apiDirectory);
  data['sample.org:parking'].versions[1].info.title = 'JSON Data Service';
  data['sample.org:parking'].versions[1].info.description = 'A JSON service for storing data.';
  const catalog = new Catalog({ fetcher: async () => ({ text: JSON.stringify(data) }) });
  const result = await catalog.search({ queries: ['hourly weather forecast API', 'weather data Singapore API', 'JSON weather service'], source: 'api' });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].name, 'Weather API');
  assert.deepEqual(result.ignoredModifiers, ['data', 'json', 'service']);
  // Deliberate generic-only searches still work; no hidden provider/category cap.
  assert.equal((await catalog.search({ queries: ['JSON data'], source: 'api' })).items[0].name, 'JSON Data Service');
});
test('expanded MCP retrieval is bounded, deduplicated and reports continuation', async () => {
  const urls = [];
  const catalog = new Catalog({ fetcher: async url => {
    urls.push(url); const n = Number(new URL(url).searchParams.get('cursor') || 0);
    const data = structuredClone(mcpDirectory); data.metadata.nextCursor = String(n + 1);
    data.servers.push({ server: { name: `org.example/weather${n}`, version: '1', description: 'weather observations' } });
    return { text: JSON.stringify(data) };
  } });
  const result = await catalog.search({ queries: ['parking', 'weather'], source: 'mcp', mcpPages: 3 });
  assert.equal(urls.length, 3); assert.equal(result.sources[0].pagesLoaded, 3);
  assert.equal(result.items.length, 4); assert.equal(result.pagination.nextMcpCursor, '3');
  assert.ok(urls.every(url => !url.includes('parking') && !url.includes('weather')));
});
test('a failed later MCP page preserves earlier results and can be retried without redrafting', async () => {
  let failPage = true;
  const catalog = new Catalog({ fetcher: async url => {
    if (new URL(url).searchParams.has('cursor')) {
      if (failPage) throw new Error('do not leak');
      return { text: JSON.stringify({ servers: [], metadata: {} }) };
    }
    return { text: JSON.stringify(mcpDirectory) };
  } });
  const result = await catalog.search({ queries: ['parking'], source: 'mcp', mcpPages: 3 });
  assert.equal(result.items.length, 1); assert.equal(result.sources[0].partial, true);
  assert.equal(result.pagination.nextMcpCursor, mcpDirectory.metadata.nextCursor);
  assert.ok(!JSON.stringify(result).includes('do not leak'));
  failPage = false;
  assert.equal((await catalog.search({ queries: ['parking'], source: 'mcp', mcpCursor: result.pagination.nextMcpCursor, mcpPages: 3 })).sources[0].partial, undefined);
});
test('repeated registry cursors stop safely instead of looping or claiming complete coverage', async () => {
  let calls = 0;
  const catalog = new Catalog({ fetcher: async () => { calls++; return { text: JSON.stringify(mcpDirectory) }; } });
  const result = await catalog.search({ source: 'mcp', mcpPages: 3 });
  assert.equal(calls, 2); assert.equal(result.items.length, 1);
  assert.equal(result.sources[0].partial, true); assert.equal(result.pagination.nextMcpCursor, null);
});
test('cancelled discovery stops before loading additional registry pages', async () => {
  const controller = new AbortController(); let calls = 0;
  const catalog = new Catalog({ fetcher: async () => { calls++; controller.abort(); return { text: JSON.stringify(mcpDirectory) }; } });
  await assert.rejects(catalog.search({ source: 'mcp', mcpPages: 3 }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 1);
});
