import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { RedisState, LEASE_SCRIPT, RELEASE_SCRIPT } from '../server/shared-state.mjs';
import { SharedBudget } from '../server/shared-budget.mjs';
import { SealedStore } from '../server/sealed-store.mjs';
import { createDistributedBoundary } from '../server/distributed-boundary.mjs';
import { createApp } from '../server/app.mjs';
import { McpIndex } from '../server/catalog-index.mjs';
import { source } from './fixtures.mjs';
import { testState, redisEnabled } from './redis-test-helper.mjs';
import { vercelRuntimeConfig } from '../server/vercel-runtime.mjs';

const key = 'ab'.repeat(32);
const budgetValue = chargedMicrousd => JSON.stringify({ version: 1, limitMicrousd: 5000000, chargedMicrousd, halted: false });
const integration = (name, fn) => test(name, { skip: !redisEnabled && 'Requires an isolated Redis test server; CI runs this gate.' }, fn);

test('preview uses an exact deployment-owned origin with AI off; production requires an explicit origin', () => {
  const env = { APIFIT_MODE: 'hosted', APIFIT_ACCESS_MODE: 'public', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'apifit-preview.vercel.app', APIFIT_AI_ENABLED: 'true' };
  const config = vercelRuntimeConfig(env);
  assert.equal(config.hosting.origin, 'https://apifit-preview.vercel.app');
  assert.equal(config.aiEnabled, false);
  for (const invalid of ['https://apifit.vercel.app', 'apifit.vercel.app.evil.test', 'a.vercel.app/path', 'localhost']) {
    assert.throws(() => vercelRuntimeConfig({ ...env, VERCEL_URL: invalid }));
  }
  assert.throws(() => vercelRuntimeConfig({ ...env, VERCEL: '0' }));
  assert.throws(() => vercelRuntimeConfig({ ...env, VERCEL_ENV: 'production' }));
  assert.equal(vercelRuntimeConfig({ ...env, VERCEL_ENV: 'production', APIFIT_PUBLIC_ORIGIN: 'https://apifit.example.com' }).hosting.origin, 'https://apifit.example.com');
});

test('Redis adapter accepts only operator Upstash origins and redacts transport failures without retries', async () => {
  for (const url of ['http://a.upstash.io', 'https://localhost', 'https://a.upstash.io/extra', 'https://a.upstash.io.evil.test', 'https://user:pass@a.upstash.io']) assert.throws(() => new RedisState({ url, token: 'test' }));
  let calls = 0;
  const state = new RedisState({ url: 'https://example.upstash.io', token: 'secret-test-value', fetcher: async () => { calls++; throw new Error('secret-test-value'); } });
  await assert.rejects(state.get('budget'), error => error.code === 'SHARED_STATE_UNAVAILABLE' && !error.message.includes('secret-test-value'));
  assert.equal(calls, 1);
});

integration('shared ledger survives independent instances, missing/corrupt state fails closed, concurrent reservations never exceed $5', async () => {
  const state = testState(); const a = new SharedBudget(state); const b = new SharedBudget(state);
  assert.equal((await a.status()).available, false);
  await assert.rejects(a.reserve(1), { code: 'AI_BUDGET_UNAVAILABLE' });
  await state.setNew('budget', budgetValue(4900000));
  const results = await Promise.allSettled(Array.from({ length: 20 }, (_, i) => (i % 2 ? a : b).reserve(10000)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 10);
  assert.equal((await b.status()).chargedOrReservedUsd, 5);
  const settlement = results.find(r => r.status === 'fulfilled').value;
  await settlement(2000);
  await assert.rejects(settlement(0), { code: 'AI_BUDGET_INVALID' });
  assert.equal((await new SharedBudget(state).status()).chargedOrReservedUsd, 4.992);
  await state.command(['SET', state.prefix + 'budget', '{"version":1}']);
  assert.equal((await a.status()).available, false);
  await assert.rejects(b.reserve(1), { code: 'AI_BUDGET_UNAVAILABLE' });
});

integration('ambiguous reservations keep full charge and unexpectedly expensive usage halts globally', async () => {
  const state = testState(); await state.setNew('budget', budgetValue(0)); const budget = new SharedBudget(state);
  const uncertain = await budget.reserve(1000); await uncertain(undefined);
  assert.equal((await budget.status()).chargedOrReservedUsd, 0.001);
  const settle = await budget.reserve(1000); await settle(2000);
  assert.equal((await new SharedBudget(state).status()).available, false);
  await assert.rejects(budget.reserve(1), { code: 'AI_BUDGET_EXHAUSTED' });
});

integration('sealed records cross instances without storing private text; reject tampering, other owners, expiry and deleted records', async () => {
  const state = testState(); const writes = []; const command = state.command.bind(state);
  state.command = args => { writes.push(JSON.stringify(args)); return command(args); };
  const first = new SealedStore({ state, key }); const second = new SealedStore({ state, key });
  const record = await first.put({ kind: 'analysis', private: 'private-project-sentinel' }, 'owner');
  const tokens = { [record.id]: record._recordToken };
  assert.equal((await second.get(record.id, 'owner', tokens)).private, 'private-project-sentinel');
  assert.ok(writes.every(write => !write.includes('private-project-sentinel') && !write.includes(record._recordToken)));
  await assert.rejects(second.get(record.id, 'other', tokens), { code: 'EXPIRED_RECORD' });
  await assert.rejects(second.get(record.id, 'owner', { [record.id]: 'bad' + record._recordToken }), { code: 'EXPIRED_RECORD' });
  const future = new SealedStore({ state, key, now: () => Date.now() + 900001 });
  await assert.rejects(future.get(record.id, 'owner', tokens), { code: 'EXPIRED_RECORD' });
  await second.delete(record.id, 'other');
  assert.equal((await first.get(record.id, 'owner', tokens)).id, record.id);
  await second.delete(record.id, 'owner');
  await assert.rejects(first.get(record.id, 'owner', tokens), { code: 'EXPIRED_RECORD' });
  const next = await first.put({ kind: 'analysis' }, 'owner'); await second.clear('owner');
  await assert.rejects(first.get(next.id, 'owner', { [next.id]: next._recordToken }), { code: 'EXPIRED_RECORD' });
});

integration('global work leases enforce per-session and total limits across instances and release safely', async () => {
  const state = testState();
  const acquire = (owner, id) => state.eval(LEASE_SCRIPT, ['jobs', `jobs:${owner}`], [id, 4, 2, 305000]);
  assert.equal(await acquire('a', '1'), 1); assert.equal(await acquire('a', '2'), 1); assert.equal(await acquire('a', '3'), 0);
  assert.equal(await acquire('b', '3'), 1); assert.equal(await acquire('b', '4'), 1); assert.equal(await acquire('c', '5'), 0);
  await state.eval(RELEASE_SCRIPT, ['jobs', 'jobs:a'], ['1']); assert.equal(await acquire('c', '5'), 1);
});

integration('HTTP flow preserves pagination and analysis across function instances; session reset and owner isolation remain enforced', async t => {
  const state = testState(); const hosting = { origin: 'https://apifit.example.com', accessMode: 'public' };
  const start = async () => {
    const catalog = { search: async ({ offset = 0 }) => ({ items: [{ name: `Result ${offset}` }], sources: [], coverage: 'fixture', pagination: { nextOffset: offset ? null : 24 } }) };
    const app = createApp({ hosting, boundary: createDistributedBoundary(hosting, state), store: new SealedStore({ state, key }), fetcher: async () => source(), catalog });
    const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
    t.after(() => { server.closeAllConnections(); server.close(); app.locals.dispose(); });
    return `http://127.0.0.1:${server.address().port}`;
  };
  const a = await start(); const b = await start(); let cookie;
  const call = async (base, path, body, options = {}) => {
    return new Promise((resolve, reject) => {
      const request = httpRequest(base + '/api' + path, { method: options.method || 'POST', headers: { Host: 'apifit.example.com', Origin: hosting.origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...options.headers } }, response => {
        let text = ''; response.setEncoding('utf8'); response.on('data', part => { text += part; });
        response.on('end', () => { cookie ||= response.headers['set-cookie']?.[0]?.split(';')[0]; resolve({ status: response.statusCode, json: () => JSON.parse(text) }); });
      });
      request.on('error', reject); request.end(body ? JSON.stringify(body) : undefined);
    });
  };
  const initial = await call(a, '/discover', { query: 'parking', source: 'api' }); assert.equal(initial.status, 200); const discovery = await initial.json();
  const more = await call(b, `/discover/${discovery.id}/more`, { _records: { [discovery.id]: discovery._recordToken } }); assert.equal(more.status, 200); assert.equal((await more.json()).items[0].name, 'Result 24');
  const analysis = await (await call(a, '/analyses', { url: 'https://docs.example.com/api' })).json();
  const readBody = { _records: { [analysis.id]: analysis._recordToken } };
  assert.equal((await call(b, `/analyses/${analysis.id}`, readBody)).status, 200);
  assert.equal((await call(b, `/analyses/${analysis.id}`, readBody, { headers: { Cookie: '' } })).status, 404);
  assert.equal((await call(b, '/discover', { query: 'x' }, { headers: { Origin: 'https://evil.example' } })).status, 403);
  assert.equal((await call(b, '/session', undefined, { method: 'DELETE' })).status, 204);
  assert.equal((await call(a, `/analyses/${analysis.id}`, readBody)).status, 404);
});

test('read-only registry snapshot never starts detached network refresh', async () => {
  let calls = 0; const index = new McpIndex({ readOnly: true, fetcher: async () => { calls++; throw new Error(); }, normalize: () => [] });
  index.entries.set('mcp:x', { id: 'mcp:x' }); index.complete = true; index.updatedAt = Date.now() - 90000000;
  const view = await index.view(); assert.equal(calls, 0); assert.equal(view.stale, true); assert.match(view.warning, /refreshing/); index.close();
});
