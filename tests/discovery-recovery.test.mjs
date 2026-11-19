import test from 'node:test';
import assert from 'node:assert/strict';
import { api } from '../src/api.mjs';
import { discoverWithFallback } from '../src/discovery-request.mjs';

test('rejected AI credential recovers to the same keyword query without a second paid request', async t => {
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  const calls = [];
  const result = { id: 'keyword-result', ranking: { mode: 'keyword' }, items: [{ id: 'weather-api' }] };
  globalThis.fetch = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return calls.length === 1
      ? Response.json({ error: { code: 'AI_AUTH', message: 'Provider access rejected.' } }, { status: 502 })
      : Response.json(result);
  };
  const response = await discoverWithFallback(api, '/discover', { query: 'weather', source: 'all', ai: true, aiConsent: 'accepted' });
  assert.deepEqual(response, { data: result, fallback: true });
  assert.deepEqual(calls, [
    { url: '/api/discover', body: { query: 'weather', source: 'all', ai: true, aiConsent: 'accepted' } },
    { url: '/api/discover', body: { query: 'weather', source: 'all' } },
  ]);
});

test('cancelled requests, sensitive inputs and non-AI failures do not trigger a fallback', async () => {
  for (const code of ['AI_SENSITIVE_INPUT', 'AI_CONSENT_REQUIRED', 'INVALID_SEARCH', 'RATE_LIMIT', 'AI_CANCELLED']) {
    let calls = 0;
    const error = Object.assign(new Error('Rejected'), { code });
    await assert.rejects(discoverWithFallback(async () => { calls++; throw error; }, '/discover', { ai: true }), e => e === error);
    assert.equal(calls, 1);
  }
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(discoverWithFallback(async () => { calls++; controller.abort(); throw Object.assign(new Error('Cancelled'), { code: 'AI_AUTH' }); }, '/discover', { ai: true }, { signal: controller.signal }));
  assert.equal(calls, 1);
});

test('pagination keeps its record path, and a failed keyword fallback is surfaced once', async () => {
  const calls = [];
  const request = async (path, body) => {
    calls.push({ path, body });
    if (calls.length === 1) throw Object.assign(new Error('Unavailable'), { code: 'AI_NOT_READY' });
    return { items: [{ id: 'next' }], ranking: { mode: 'keyword' } };
  };
  assert.equal((await discoverWithFallback(request, '/discover/existing-record/more', { ai: true, aiConsent: 'accepted' })).fallback, true);
  assert.deepEqual(calls[1], { path: '/discover/existing-record/more', body: {} });
  let count = 0;
  await assert.rejects(discoverWithFallback(async () => { count++; throw Object.assign(new Error(count === 1 ? 'AI down' : 'Directory down'), { code: count === 1 ? 'AI_AUTH' : 'DIRECTORY_UNAVAILABLE' }); }, '/discover', { ai: true }), /Directory down/);
  assert.equal(count, 2);
});

test('healthy AI results and explicit keyword searches are not retried or relabelled', async () => {
  for (const body of [{ ai: true }, { query: 'weather' }]) {
    let calls = 0; const data = { ranking: { mode: body.ai ? 'ai-ranked-directory-leads' : 'keyword' } };
    assert.deepEqual(await discoverWithFallback(async () => { calls++; return data; }, '/discover', body), { data, fallback: false });
    assert.equal(calls, 1);
  }
});
