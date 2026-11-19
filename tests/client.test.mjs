import test from 'node:test';
import assert from 'node:assert/strict';
import { api, safeLink, host, readableDate } from '../src/api.mjs';

test('frontend external links reject executable protocols, HTTP and credentials', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:secret@example.com', 'invalid']) assert.equal(safeLink(value), null);
  assert.equal(safeLink('https://example.com/docs'), 'https://example.com/docs');
  assert.equal(host('https://www.example.com/docs'), 'example.com');
  assert.equal(readableDate('bad date'), 'Date unavailable');
});
test('API client surfaces safe errors and preserves abort semantics', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: 'This record has expired.' } }), { status: 404 });
  await assert.rejects(api('/analyses/expired'), /expired/);
  globalThis.fetch = async () => { throw new TypeError('raw connection details'); };
  await assert.rejects(api('/health'), error => error.message.includes('Could not reach APIFit') && !error.message.includes('raw'));
  globalThis.fetch = async () => { throw new DOMException('Cancelled', 'AbortError'); };
  await assert.rejects(api('/search', { query: 'test' }), { name: 'AbortError' });
});
test('API client sends JSON locally and accepts no-content session clearing', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (url, options) => { assert.equal(url, '/api/search'); assert.equal(options.method, 'POST'); assert.equal(options.headers['Content-Type'], 'application/json'); return Response.json({ items: [] }); };
  assert.deepEqual(await api('/search', { query: 'weather' }), { items: [] });
  globalThis.fetch = async () => new Response(null, { status: 204 });
  assert.equal(await api('/session', undefined, { method: 'DELETE' }), null);
});

test('serverless tokens stay in tab memory and return only with the relevant request', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => Response.json({ id: 'fixture-record', _recordToken: 'encrypted-fixture', items: [] });
  assert.deepEqual(await api('/discover', { query: 'test' }), { id: 'fixture-record', items: [] });
  globalThis.fetch = async (_url, options) => { assert.deepEqual(JSON.parse(options.body)._records, { 'fixture-record': 'encrypted-fixture' }); return Response.json({ items: [] }); };
  await api('/discover/fixture-record/more', {});
  globalThis.fetch = async () => new Response(null, { status: 204 }); await api('/session', undefined, { method: 'DELETE' });
  globalThis.fetch = async (_url, options) => { assert.equal(JSON.parse(options.body)._records, undefined); return Response.json({ items: [] }); };
  await api('/discover/fixture-record/more', {});
});
