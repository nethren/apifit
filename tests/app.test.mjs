import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server/app.mjs';
import { parseSource } from '../server/parser.mjs';
import { MemoryStore } from '../server/store.mjs';
import { source, apiDirectory, mcpDirectory } from './fixtures.mjs';

async function serve(t, options = {}) {
  const app = createApp({ fetcher: async url => url.includes('apis.guru') ? source(apiDirectory) : url.includes('registry.modelcontextprotocol') ? source(mcpDirectory) : source(), parser: parseSource, ...options });
  const server = app.listen(0, '127.0.0.1');
  server.once('close', app.locals.dispose);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, request: (path, body) => fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}
test('HTTP workflow: discover, understand, confirm, prepare comparison, export and forget', async t => {
  const { request, base } = await serve(t);
  const health = await (await request('/api/health')).json(); assert.equal(health.capabilities.frontend, 'not-mounted');
  const search = await (await request('/api/search', { query: 'parking' })).json(); assert.equal(search.items.length, 2);
  const response = await request('/api/analyses', { url: 'https://docs.example.com/spec.json' }); assert.equal(response.status, 201);
  const analysis = await response.json(); assert.equal(analysis.capabilities.length, 3);
  const draft = await (await request('/api/requirements/draft', { text: 'Parking availability in Singapore' })).json();
  draft.requirements[0].priority = 'must';
  assert.equal((await request('/api/assessments', { requirements: draft.requirements, analysisIds: [analysis.id] })).status, 400);
  const result = await request('/api/assessments', { requirements: draft.requirements, analysisIds: [analysis.id], confirmed: true });
  assert.equal(result.status, 201); const assessment = await result.json();
  const brief = await request(`/api/assessments/${assessment.id}/brief`);
  assert.equal(brief.status, 200); assert.ok((await brief.text()).includes('Evidence preparation only; no AI judgment requested'));
  assert.equal(brief.headers.get('cache-control'), 'no-store');
  assert.equal((await fetch(`${base}/api/records/${analysis.id}`, { method: 'DELETE' })).status, 204);
  assert.equal((await request(`/api/analyses/${analysis.id}`)).status, 404);
  // Assessment snapshots retain their own evidence after the source record expires.
  assert.equal((await request(`/api/assessments/${assessment.id}/brief`)).status, 200);
  await fetch(`${base}/api/session`, { method: 'DELETE' });
  assert.equal((await request(`/api/assessments/${assessment.id}`)).status, 404);
});
test('requirements-led HTTP flow drafts once, retries and pages for free, then assesses server-owned evidence', async t => {
  let drafts = 0;
  const { request } = await serve(t, { ai: { draft: async (text, options) => {
    assert.equal(options.ai, true); assert.equal(options.aiConsent, 'test-consent'); drafts++;
    return { requirements: [{ id: 'r1', text: 'Parking availability', priority: 'unsure', sourceQuote: text }], queries: ['parking', 'weather'], questions: [] };
  } } });
  const draft = await (await request('/api/requirements/draft', { text: 'Outdoor trip with parking', ai: true, aiConsent: 'test-consent' })).json();
  const search = { query: 'Outdoor trip with parking', queries: draft.queries, source: 'api', limit: 1 };
  const first = await (await request('/api/search', search)).json();
  await request('/api/search', search);
  const second = await (await request('/api/search', { ...search, offset: 1 })).json();
  assert.equal(drafts, 1); assert.notEqual(first.items[0].id, second.items[0].id);
  const analysis = await (await request('/api/analyses', { url: first.items[0].specificationUrl, limit: 20 })).json();
  const input = { analysisIds: [analysis.id], requirements: [{ ...draft.requirements[0], priority: 'must' }] };
  assert.equal((await request('/api/assessments', input)).status, 400);
  const result = await (await request('/api/assessments', { ...input, confirmed: true })).json();
  assert.equal(result.requirements[0].priority, 'must'); assert.equal(result.candidates.length, 1);
  assert.equal(result.candidates[0].findings[0].status, 'unknown');
});
test('local HTTP boundary rejects DNS rebinding, cross-origin requests and non-JSON writes', async t => {
  const { base } = await serve(t);
  for (const headers of [{ Host: 'attacker.example' }, { Origin: 'https://attacker.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    const status = await new Promise((resolve, reject) => { const req = httpRequest(base + '/api/health', { headers }, res => { res.resume(); resolve(res.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(status, 403, JSON.stringify(headers));
  }
  assert.equal((await fetch(base + '/api/search', { method: 'POST', body: 'query=parking' })).status, 415);
  assert.equal((await fetch(base + '/api/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' })).status, 400);
});
test('HTTP oversized bodies and unknown routes have safe errors', async t => {
  const { base, request } = await serve(t);
  assert.equal((await request('/api/requirements/draft', { text: 'x'.repeat(70000) })).status, 413);
  assert.equal((await fetch(base + '/missing')).status, 404);
});
test('rate limit and concurrency limits bound local work', async t => {
  const limited = await serve(t, { maxRequests: 1 });
  await limited.request('/api/health'); assert.equal((await limited.request('/api/health')).status, 429);
  let release; const pending = new Promise(resolve => { release = resolve; });
  let started = 0;
  const { request } = await serve(t, { fetcher: async () => { started++; await pending; return source(); } });
  const calls = Array.from({ length: 4 }, () => request('/api/analyses', { url: 'https://example.com/docs' }));
  for (let attempt = 0; started < 4 && attempt < 200; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(started, 4);
  assert.equal((await request('/api/analyses', { url: 'https://example.com/docs' })).status, 429);
  release(); assert.ok((await Promise.all(calls)).every(r => r.status === 201));
});
test('session records expire, clone values and evict oldest at capacity', () => {
  let now = 0; const store = new MemoryStore({ ttlMs: 100, max: 2, now: () => now });
  const a = store.put({ value: 'first' }); a.value = 'changed'; assert.equal(store.get(a.id).value, 'first');
  store.put({ value: 'second' }); store.put({ value: 'third' }); assert.throws(() => store.get(a.id), { code: 'EXPIRED_RECORD' });
  const b = store.put({ value: 'last' }); now = 101; assert.throws(() => store.get(b.id), { code: 'EXPIRED_RECORD' });
});
test('static interface assets keep a same-origin policy without exposing source or relaxing API policy', async t => {
  const { request } = await serve(t, { frontendDir: fileURLToPath(new URL('../public/', import.meta.url)) });
  const icon = await request('/favicon.svg');
  assert.equal(icon.status, 200); assert.ok(icon.headers.get('content-type').includes('image/svg+xml'));
  assert.ok(icon.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.ok(!icon.headers.get('content-security-policy').includes('unsafe-inline'));
  const appearance = await request('/appearance.js');
  assert.equal(appearance.status, 200);
  assert.ok(appearance.headers.get('content-type').includes('javascript'));
  assert.ok(appearance.headers.get('content-security-policy').includes("script-src 'self'"));
  assert.ok(!appearance.headers.get('content-security-policy').includes('unsafe-inline'));
  const health = await request('/api/health');
  assert.ok(health.headers.get('content-security-policy').includes("default-src 'none'"));
  assert.equal((await health.json()).capabilities.frontend, 'local-interface');
  assert.equal((await request('/server/index.mjs')).status, 404);
  assert.equal((await request('/.env')).status, 404);
});
