import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { integrationInput, readIntegration } from '../server/integration-docs.mjs';
import { inspectMcp } from '../server/mcp-inspection.mjs';
import { normalizeMcp } from '../server/catalog.mjs';
import { parseSource } from '../server/parser.mjs';
import { fetchMcpMetadata, fetchDocument, requestPinned, validateMetadataRequest, metadataEvent } from '../server/safe-fetch.mjs';
import { sourceQuality } from '../server/source-quality.mjs';
import { validateGoalExplanation } from '../server/goal-explanation.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { createApp } from '../server/app.mjs';
import { source } from './fixtures.mjs';
import { documentationSelection, explanationKey, hasDocumentation } from '../src/search-state.mjs';

const endpoint = { type: 'streamable-http', url: 'https://mcp.example.com/coffee' };
const mcp = { kind: 'mcp', name: 'Coffee', remoteEndpoints: [endpoint], documentationUrl: 'https://shop.example.com/' };
const tool = { name: 'search_coffee', description: 'Search the roaster’s own coffee products by origin.', inputSchema: { type: 'object', properties: { origin: { type: 'string', description: 'Country where the beans were grown' } } } };
const retail = url => ({ ...source('<html><title>Coffee shop</title><main>Buy freshly roasted coffee. Search our shop for your next bag.</main></html>'), contentType: 'text/html', url });
const software = url => ({ ...source('<html><title>Coffee API documentation</title><main>API reference. Search coffee products. The search endpoint returns the origin and roast of matching products.</main></html>'), contentType: 'text/html', url });
const init = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'APIFit', version: '0.2.0' } } };
const listing = { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} };
const resolver = async () => [{ address: '93.184.216.34', family: 4 }];
function metadataFixture(pages = [{ tools: [tool] }], seen = []) {
  let page = 0;
  return async (url, request) => {
    validateMetadataRequest(request); seen.push({ url, ...request });
    const { rpc } = request;
    if (rpc.method === 'notifications/initialized') return { status: 202, text: '' };
    const result = rpc.method === 'initialize' ? { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'Coffee tools' } } : pages[page++];
    return { sessionId: 'ephemeral-session', text: JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result }) };
  };
}
const metadataAnalysis = () => inspectMcp(endpoint, 'coffee', { fetcher: metadataFixture() });

test('registry connection survives normalization, UI selection and cache identity', () => {
  const [item] = normalizeMcp({ servers: [{ server: { name: 'example/coffee', version: '1', websiteUrl: mcp.documentationUrl, remotes: [endpoint, { type: 'streamable-http', url: 'https://127.0.0.1/private' }, { type: 'streamable-http', url: 'https://mcp.example.com/{secret}' }] } }] }, '2026-09-15');
  assert.deepEqual(item.remoteEndpoints, [endpoint]);
  assert.deepEqual(integrationInput(documentationSelection(item)).remoteEndpoints, [endpoint]);
  assert.ok(hasDocumentation({ remoteEndpoints: [endpoint] }));
  assert.notEqual(explanationKey('coffee', item), explanationKey('coffee', { ...item, remoteEndpoints: [] }));
});

test('inspection only negotiates and lists tools; project, session and server instructions never become evidence', async () => {
  const seen = [];
  const analysis = await inspectMcp(endpoint, 'private project about cafes', { fetcher: metadataFixture([{ tools: [tool] }], seen) });
  assert.deepEqual(seen.map(request => request.rpc.method), ['initialize', 'notifications/initialized', 'tools/list']);
  assert.equal(seen[1].sessionId, 'ephemeral-session'); assert.equal(seen[2].protocolVersion, '2025-11-25');
  assert.ok(!JSON.stringify(seen).includes('private project'));
  assert.ok(!JSON.stringify(analysis).includes('ephemeral-session'));
  assert.equal(analysis.source.evidenceLevel, 'server-declared-tool-metadata'); assert.equal(analysis.liveTested, false);
  assert.match(analysis.evidence[0].excerpt, /origin/); assert.equal(sourceQuality(analysis).usable, true);
});

test('tool metadata is preferred to a retail homepage for any remote MCP', async () => {
  let documents = 0;
  const analysis = await readIntegration(integrationInput(mcp), 'coffee', { inspector: metadataAnalysis, parser: parseSource, fetcher: async url => { documents++; return retail(url); } });
  assert.equal(documents, 0); assert.equal(analysis.documentationStatus.basis, 'tool-descriptions');
  assert.equal(analysis.integration.name, 'Coffee');
});

test('metadata listing handles pagination with a bounded partial result', async () => {
  const seen = [];
  const pages = Array.from({ length: 3 }, (_, i) => ({ tools: [{ ...tool, name: `coffee_${i}` }], nextCursor: `page_${i}` }));
  const analysis = await inspectMcp(endpoint, '', { fetcher: metadataFixture(pages, seen) });
  assert.equal(analysis.capabilities.length, 3); assert.equal(analysis.coverage.truncated, true);
  assert.equal(seen.length, 5); assert.deepEqual(seen[3].rpc.params, { cursor: 'page_0' });
  await assert.rejects(inspectMcp(endpoint, '', { fetcher: metadataFixture([{ tools: [tool], nextCursor: 'repeat' }, { tools: [], nextCursor: 'repeat' }]) }), { code: 'MCP_FORMAT' });
});

test('unsupported, empty, unauthenticated and malformed MCP sources fall back without installing or executing', async () => {
  for (const code of ['MCP_AUTH_REQUIRED', 'MCP_VERSION', 'MCP_NO_TOOLS', 'MCP_FORMAT', 'FETCH_TIMEOUT', 'MCP_TRANSPORT']) {
    const analysis = await readIntegration(integrationInput(mcp), 'coffee', { parser: parseSource, inspector: async () => { throw Object.assign(Error('private error'), { code }); }, fetcher: software });
    assert.equal(analysis.documentationStatus.state, 'available'); assert.equal(analysis.format, 'html');
    assert.equal(analysis.documentationStatus.attempts[0].outcome, code); assert.ok(!JSON.stringify(analysis).includes('private error'));
  }
  await assert.rejects(inspectMcp({ ...endpoint, type: 'sse' }, '', { fetcher: () => assert.fail('must not connect') }), { code: 'MCP_TRANSPORT' });
  await assert.rejects(inspectMcp(endpoint, '', { fetcher: metadataFixture([{ tools: [] }]) }), { code: 'MCP_NO_DESCRIPTIONS' });
  await assert.rejects(inspectMcp(endpoint, '', { fetcher: async () => ({ text: JSON.stringify({ jsonrpc: '2.0', id: 99, result: {} }) }) }), { code: 'MCP_FORMAT' });
});

test('readable-but-irrelevant API specifications and MCP README sources advance to useful fallback docs', async () => {
  for (const selection of [{ kind: 'api', specificationUrl: 'https://docs.example.com/spec', documentationUrl: 'https://docs.example.com/api' }, { kind: 'mcp', repositoryUrl: 'https://github.com/example/coffee', documentationUrl: 'https://docs.example.com/api' }]) {
    const seen = [];
    const analysis = await readIntegration(integrationInput(selection), 'coffee', { parser: parseSource, fetcher: async url => { seen.push(url); return url === selection.documentationUrl ? software(url) : url.includes('api.github.com') ? { ...source('# Shop\nBuy our beans.'), url, contentType: 'text/plain' } : retail(url); } });
    assert.equal(seen.length, 2); assert.equal(analysis.source.url, selection.documentationUrl);
    assert.equal(analysis.documentationStatus.attempts[0].outcome, 'no-capability-evidence');
  }
});

test('homepage follows explicitly linked same-origin docs, never arbitrary links or private targets', async () => {
  const homepage = '<html><nav><a href="/docs">API documentation</a><a href="https://127.0.0.1/docs">API docs</a><a href="https://elsewhere.example.com/api">API docs</a></nav><main>Shop our coffee.</main></html>';
  const seen = [];
  const analysis = await readIntegration(integrationInput({ kind: 'api', documentationUrl: 'https://shop.example.com/' }), '', { parser: parseSource, fetcher: async url => { seen.push(url); return url.endsWith('/docs') ? software(url) : { ...retail(url), text: homepage }; } });
  assert.deepEqual(seen, ['https://shop.example.com/', 'https://shop.example.com/docs']);
  assert.equal(analysis.documentationStatus.state, 'available');
});

test('all irrelevant sources produce an honest unavailable status and no generated homework', async () => {
  const analysis = await readIntegration(integrationInput(mcp), 'coffee', { parser: parseSource, inspector: async () => { throw Object.assign(Error(), { code: 'UPSTREAM_STATUS' }); }, fetcher: retail });
  assert.equal(analysis.documentationStatus.state, 'unavailable');
  const ai = new AiService({ client: { run: () => assert.fail('no paid generation') }, budget: { status: () => assert.fail('no reservation') }, credentialStatus: () => assert.fail('no credential access') });
  const result = await ai.summarize(analysis, { ai: true, aiConsent: AI_CONSENT }, 'coffee');
  assert.equal(result.generation, 'skipped-no-usable-evidence'); assert.deepEqual(result.checks, []);
  assert.deepEqual(validateGoalExplanation({ sourceFit: 'unclear', capabilities: [], checks: ['Check the whole thing yourself.'] }, []).checks, []);
});

test('unsafe MCP links are rejected before any retrieval and external cancellation stops fallback', async () => {
  assert.throws(() => integrationInput({ ...mcp, remoteEndpoints: [{ ...endpoint, url: 'https://127.0.0.1' }] }), { code: 'UNSAFE_ADDRESS' });
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(readIntegration(mcp, '', { parser: parseSource, signal: controller.signal, inspector: async () => { calls++; controller.abort(); throw Error(); }, fetcher: () => assert.fail('cancelled') }));
  assert.equal(calls, 1);
});

test('network boundary blocks tool calls, extra parameters and unsafe MCP headers', async () => {
  for (const rpc of [{ ...listing, method: 'tools/call', params: { name: 'delete_everything' } }, { ...listing, params: { arguments: {} } }, { ...init, params: { ...init.params, capabilities: { sampling: {} } } }, { ...listing, extra: true }]) {
    await assert.rejects(fetchMcpMetadata(endpoint.url, { rpc }, { resolver: () => assert.fail('no DNS') }), { code: 'MCP_METHOD_BLOCKED' });
  }
  assert.throws(() => validateMetadataRequest({ rpc: listing, sessionId: 'bad\r\nheader' }), { code: 'MCP_FORMAT' });
  let calls = 0;
  await assert.rejects(fetchMcpMetadata(endpoint.url, { rpc: listing, sessionId: 'ephemeral' }, { resolver, transport: async () => { calls++; return { status: 307, location: 'https://other.example.com/mcp' }; } }), { code: 'MCP_REDIRECT' });
  assert.equal(calls, 1);
  await assert.rejects(fetchMcpMetadata(endpoint.url, { rpc: listing }, { resolver: async () => [{ address: '10.0.0.1', family: 4 }], transport: () => assert.fail('private host') }), { code: 'UNSAFE_ADDRESS' });
});

test('ordinary document reads cannot be changed to POST by options', async () => {
  await fetchDocument(endpoint.url, { mcp: { rpc: listing }, resolver, transport: async (_url, _record, options) => { assert.equal(options.mcp, undefined); return { text: '{}' }; } });
});

test('SSE metadata completes without waiting for a kept-open stream; server requests are ignored', async () => {
  const foreign = 'data: {"jsonrpc":"2.0","id":8,"method":"sampling/createMessage"}\n\n';
  assert.equal(metadataEvent(foreign, 8), null);
  let stream; let outbound;
  const result = await requestPinned(new URL(endpoint.url), { address: '93.184.216.34', family: 4 }, { maxBytes: 4096, mcp: { rpc: listing }, request: (_url, options, callback) => {
    assert.equal(options.method, 'POST'); assert.equal(options.headers.Authorization, undefined);
    const request = new EventEmitter(); request.end = body => {
      outbound = JSON.parse(body); stream = new PassThrough(); stream.headers = { 'content-type': 'text/event-stream' }; stream.statusCode = 200; callback(stream);
      stream.write(foreign); stream.write('data: {"jsonrpc":"2.0","id":2,"result":{"tools":[]}}\n\n');
    }; return request;
  } });
  assert.deepEqual(outbound, listing); assert.ok(stream.destroyed); assert.deepEqual(JSON.parse(result.text).result.tools, []);
});

test('HTTP summary skips AI for bad API/MCP sources; mixed brief excludes them, all-bad brief is free', async t => {
  let calls = 0; let handed;
  const ai = { summarize: () => { calls++; assert.fail('bad source generated'); }, handoff: async (_query, analyses) => { calls++; handed = analyses; return { integrations: [], nextSteps: [] }; } };
  const app = createApp({ ai, parser: parseSource, inspector: async () => { throw Object.assign(Error(), { code: 'MCP_AUTH_REQUIRED' }); }, fetcher: async url => url.endsWith('/api') ? software(url) : retail(url) });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { app.locals.dispose(); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const post = (path, data) => fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, ai: true, aiConsent: AI_CONSENT }) });
  for (const integration of [mcp, { kind: 'api', documentationUrl: 'https://shop.example.com/' }]) {
    const response = await post('summaries', { query: 'coffee', integration }); const result = await response.json();
    assert.equal(response.status, 200); assert.equal(result.summary.generation, 'skipped-no-usable-evidence');
    assert.equal(result.documentationStatus.state, 'unavailable'); assert.deepEqual(result.summary.checks, []);
  }
  assert.equal(calls, 0);
  assert.equal((await post('build-briefs', { query: 'coffee', integrations: [mcp] })).status, 422); assert.equal(calls, 0);
  const result = await (await post('build-briefs', { query: 'coffee', integrations: [mcp, { kind: 'api', name: 'Coffee API', documentationUrl: 'https://docs.example.com/api' }] })).json();
  assert.equal(calls, 1); assert.equal(handed.length, 1); assert.equal(handed[0].integration.kind, 'api'); assert.equal(result.unreadable.length, 1); assert.equal(result.unreadable[0].name, 'Coffee');
});
