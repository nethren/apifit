import test from 'node:test';
import assert from 'node:assert/strict';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { createHostedBoundary } from '../server/hosted-boundary.mjs';
import { createApp } from '../server/app.mjs';
import { MemoryStore } from '../server/store.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { parseSource } from '../server/parser.mjs';
import { source } from './fixtures.mjs';

// Fixed fictional access secret; never reads a credential or contacts a provider.
const hosting = { origin: 'https://apifit.example.com', accessPassword: 'fictional-preview-password-for-tests-only' };
const authorization = `Basic ${Buffer.from(`apifit:${hosting.accessPassword}`).toString('base64')}`;
const consent = { ai: true, aiConsent: AI_CONSENT };
const analysisInput = { url: 'https://docs.example.com/spec.json' };

async function serve(t, overrides = {}) {
  const app = createApp({ hosting, fetcher: async () => source(), parser: parseSource, ...overrides });
  const server = app.listen(0, '127.0.0.1'); server.once('close', app.locals.dispose);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const client = () => {
    let cookie;
    return async (path = '/', { method = 'GET', body, headers = {}, authenticated = overrides.hosting?.accessMode !== 'public' } = {}) => {
      const requestHeaders = { Host: 'apifit.example.com', ...(authenticated ? { Authorization: authorization } : {}), ...(cookie ? { Cookie: cookie } : {}),
        ...(!['GET', 'HEAD', 'OPTIONS'].includes(method) ? { Origin: hosting.origin } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)) }), ...headers };
      for (const key of Object.keys(requestHeaders)) if (requestHeaders[key] === null) delete requestHeaders[key];
      return new Promise((resolve, reject) => {
        const request = httpRequest({ host: '127.0.0.1', port: server.address().port, path, method, headers: requestHeaders, agent: false }, response => {
          let text = ''; response.setEncoding('utf8'); response.on('data', chunk => { text += chunk; });
          response.on('end', () => {
            if (response.headers['set-cookie']) cookie = response.headers['set-cookie'][0].split(';')[0];
            resolve({ status: response.statusCode, headers: response.headers, text, json: () => JSON.parse(text) });
          });
        });
        request.on('error', reject); request.end(body === undefined ? undefined : JSON.stringify(body));
      });
    };
  };
  return { client };
}

test('hosted configuration fails closed without an exact HTTPS origin and strong access password', () => {
  for (const value of [null, {}, { ...hosting, origin: 'http://apifit.example.com' }, { ...hosting, origin: `${hosting.origin}/` },
    { ...hosting, origin: `${hosting.origin}/path` }, { ...hosting, accessPassword: 'short' }, { ...hosting, accessPassword: `${hosting.accessPassword} ` },
    { ...hosting, accessPassword: `${hosting.accessPassword}\n` }, { ...hosting, accessPassword: 'a'.repeat(1025) }, { ...hosting, public: true }]) {
    assert.throws(() => createHostedBoundary(value), /Hosted mode requires/);
  }
  const boundary = createHostedBoundary(hosting); boundary.close();
  for (const accessPassword of ['密'.repeat(32), 'long-fictional-test-password-'.repeat(30)]) createHostedBoundary({ ...hosting, accessPassword }).close();
  createHostedBoundary({ origin: hosting.origin, accessMode: 'public' }).close();
  createHostedBoundary({ ...hosting, accessMode: 'password' }).close();
  for (const accessMode of [null, '', 'anonymous', false]) assert.throws(() => createHostedBoundary({ ...hosting, accessMode }), /accessMode must/);
});

test('hosted Basic Auth protects UI, status and records; health alone is minimal and anonymous', async t => {
  let reads = 0; const { client } = await serve(t, { fetcher: async () => { reads++; return source(); } }); const request = client();
  const health = await request('/api/health', { authenticated: false });
  assert.equal(health.status, 200); assert.deepEqual(health.json(), { status: 'ok' });
  assert.equal(health.headers['set-cookie'], undefined);
  for (const path of ['/', '/api/ai/status', '/api/analyses/anything', '/api/build-briefs/anything/download']) {
    const response = await request(path, { authenticated: false });
    assert.equal(response.status, 401); assert.match(response.headers['www-authenticate'], /^Basic /);
    assert.ok(!response.text.includes(hosting.accessPassword));
  }
  assert.equal((await request('/api/analyses', { authenticated: false, method: 'POST', body: analysisInput })).status, 401);
  assert.equal(reads, 0);
  assert.equal((await request('/', { headers: { Authorization: `Basic ${Buffer.from(`another:${hosting.accessPassword}`).toString('base64')}` } })).status, 401);
  const signedIn = await request('/'); assert.equal(signedIn.status, 200);
  assert.match(signedIn.headers['set-cookie'][0], /^__Host-apifit-session=[a-f0-9]{64}; Path=\/; Max-Age=900; HttpOnly; Secure; SameSite=Strict$/);
  assert.match(signedIn.headers['strict-transport-security'], /max-age=/);
  assert.equal((await request('/api/ai/status', { authenticated: false })).status, 401, 'session cookie alone is not authorization');
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} boundary ignores spoofed proxy headers and requires same-origin JSON mutations`, async t => {
  const { client } = await serve(t, { hosting: { ...hosting, accessMode } }); const request = client();
  for (const headers of [{ Host: 'attacker.example', 'X-Forwarded-Host': 'apifit.example.com' }, { Host: '127.0.0.1' },
    { Origin: 'https://attacker.example' }, { 'Sec-Fetch-Site': 'cross-site' }]) {
    assert.equal((await request('/api/health', { headers })).status, 403);
  }
  for (const method of ['POST', 'DELETE']) {
    for (const Origin of [null, 'null', 'http://apifit.example.com', 'https://other.example']) {
      assert.equal((await request(method === 'DELETE' ? '/api/session' : '/api/analyses', { method, body: analysisInput, headers: { Origin, 'X-Forwarded-Proto': 'https' } })).status, 403);
    }
  }
  assert.equal((await request('/api/analyses', { method: 'POST', body: analysisInput, headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await request('/api/analyses', { method: 'POST', body: analysisInput, headers: { 'X-Forwarded-Host': 'attacker.example' } })).status, 201);
});

test('mixed-case API paths cannot bypass quota classification to reach handlers', async t => {
  let reads = 0;
  const { client } = await serve(t, { fetcher: async () => { reads++; return source(); } });
  const request = client(); await request('/');
  for (const path of ['/API/analyses', '/Api/analyses', '/API/discover', '/Api/summaries']) {
    assert.equal((await request(path, { method: 'POST', body: analysisInput })).status, 404);
  }
  assert.equal(reads, 0);
  assert.equal((await request('/api/analyses', { method: 'POST', body: analysisInput })).status, 201);
  assert.equal(reads, 1);
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} sessions isolate record reads, assessment inputs, deletes and clearing`, async t => {
  const { client } = await serve(t, { hosting: { ...hosting, accessMode } }); const alice = client(); const bob = client();
  const aliceRecord = (await alice('/api/analyses', { method: 'POST', body: analysisInput })).json();
  const bobRecord = (await bob('/api/analyses', { method: 'POST', body: analysisInput })).json();
  assert.equal((await bob(`/api/analyses/${aliceRecord.id}`)).status, 404);
  assert.equal((await bob('/api/assessments', { method: 'POST', body: { analysisIds: [aliceRecord.id], requirements: [], confirmed: true } })).status, 404);
  await bob(`/api/records/${aliceRecord.id}`, { method: 'DELETE' });
  assert.equal((await alice(`/api/analyses/${aliceRecord.id}`)).status, 200);
  const assessment = (await alice('/api/assessments', { method: 'POST', body: { analysisIds: [aliceRecord.id], requirements: [{ id: 'r1', text: 'Parking availability', priority: 'must' }], confirmed: true } })).json();
  assert.equal((await bob(`/api/assessments/${assessment.id}`)).status, 404);
  assert.equal((await bob(`/api/assessments/${assessment.id}/brief`)).status, 404);
  await bob('/api/session', { method: 'DELETE' });
  assert.equal((await bob(`/api/analyses/${bobRecord.id}`)).status, 404);
  assert.equal((await alice(`/api/analyses/${aliceRecord.id}`)).status, 200);
  assert.equal((await alice(`/api/assessments/${assessment.id}/brief`)).status, 200);
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} clear aborts only the requesting session jobs`, async t => {
  const jobs = [];
  const { client } = await serve(t, { hosting: { ...hosting, accessMode }, fetcher: async (_url, { signal }) => new Promise((resolve, reject) => {
    jobs.push({ signal, resolve }); signal.addEventListener('abort', () => reject(Error('cancelled')), { once: true });
  }) });
  const alice = client(); const bob = client(); await alice(); await bob();
  const first = alice('/api/analyses', { method: 'POST', body: analysisInput });
  for (let i = 0; jobs.length < 1 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  const second = bob('/api/analyses', { method: 'POST', body: analysisInput });
  for (let i = 0; jobs.length < 2 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(jobs.length, 2);
  await alice('/api/session', { method: 'DELETE' });
  assert.equal(jobs[0].signal.aborted, true); assert.equal(jobs[1].signal.aborted, false);
  jobs[1].resolve(source()); assert.equal((await second).status, 201); await first;
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} session concurrency cannot occupy all global job slots`, async t => {
  let started = 0; let release; const hold = new Promise(resolve => { release = resolve; });
  const { client } = await serve(t, { hosting: { ...hosting, accessMode }, fetcher: async () => { started++; await hold; return source(); } });
  const alice = client(); const bob = client(); await alice(); await bob();
  const first = alice('/api/analyses', { method: 'POST', body: analysisInput });
  const second = alice('/api/analyses', { method: 'POST', body: analysisInput });
  for (let i = 0; started < 2 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
  try {
    assert.equal(started, 2);
    assert.equal((await alice('/api/analyses', { method: 'POST', body: analysisInput })).status, 429);
    const third = bob('/api/analyses', { method: 'POST', body: analysisInput });
    for (let i = 0; started < 3 && i < 100; i++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.equal(started, 3); release();
    assert.equal((await third).status, 201);
  } finally { release(); await Promise.all([first, second]); }
});

test('hosted Basic Auth supports the configured UTF-8 password length without truncation', async t => {
  const accessPassword = '密'.repeat(1024);
  const { client } = await serve(t, { hosting: { ...hosting, accessPassword } });
  const response = await client()('/', { headers: { Authorization: `Basic ${Buffer.from(`apifit:${accessPassword}`).toString('base64')}` } });
  assert.equal(response.status, 200);
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} discovery continuation and build-brief downloads require the creating session`, async t => {
  let searches = 0; let generations = 0;
  const ai = new AiService({ credentialStatus: async () => 'stored', budget: { status: async () => ({ available: true, remainingUsd: 1 }) },
    client: { run: async (task, context) => {
      assert.equal(task, 'handoff'); generations++;
      return { integrations: Object.fromEntries(context.candidates.map(candidate => [candidate.id, { sourceFit: 'software-docs', capabilities: [{ title: 'Find parking', does: 'Lists parking spaces.', helps: 'You could show parking options.', evidenceIds: [candidate.evidence[0].id] }], checks: [] }])) };
    } } });
  const { client } = await serve(t, { hosting: { ...hosting, accessMode }, ai, catalog: { search: async () => { searches++; return { items: [], sources: [], pagination: { nextOffset: 1 }, coverage: 'Test directory only' }; } } });
  const alice = client(); const bob = client();
  const found = (await alice('/api/discover', { method: 'POST', body: { query: 'parking' } })).json();
  assert.equal((await bob(`/api/discover/${found.id}/more`, { method: 'POST', body: {} })).status, 404);
  assert.equal(searches, 1);
  assert.equal((await alice(`/api/discover/${found.id}/more`, { method: 'POST', body: {} })).status, 200);
  assert.equal(searches, 2);
  const created = await alice('/api/build-briefs', { method: 'POST', body: { query: 'parking', urls: [analysisInput.url], ...consent } });
  assert.equal(created.status, 201); assert.equal(generations, 1);
  const brief = created.json();
  assert.equal((await bob(`/api/build-briefs/${brief.id}/download`)).status, 404);
  const download = await alice(`/api/build-briefs/${brief.id}/download`);
  assert.equal(download.status, 200); assert.match(download.text, /Find parking/);
  await bob('/api/session', { method: 'DELETE' });
  assert.equal((await alice(`/api/build-briefs/${brief.id}/download`)).status, 200);
  await alice('/api/session', { method: 'DELETE' });
  assert.equal((await alice(`/api/build-briefs/${brief.id}/download`)).status, 404);
});

for (const accessMode of ['password', 'public']) test(`hosted ${accessMode} quotas exclude static assets and bound individual API sessions before global capacity`, async t => {
  const { client } = await serve(t, { hosting: { ...hosting, accessMode }, maxRequests: 1000, frontendDir: fileURLToPath(new URL('../public/', import.meta.url)) });
  const alice = client(); const bob = client();
  for (let i = 0; i < 35; i++) assert.equal((await alice('/appearance.js')).status, 200);
  for (let i = 0; i < 30; i++) assert.equal((await alice('/api/ai/status')).status, 200);
  assert.equal((await alice('/api/ai/status')).status, 429);
  assert.equal((await bob('/api/ai/status')).status, 200);
  assert.equal((await alice('/api/health', { authenticated: false })).status, 200);
});

test('owned record caps never evict a different session and foreign IDs are indistinguishable', () => {
  const store = new MemoryStore({ max: 3, maxPerOwner: 2 });
  try {
    const alice = store.put({ kind: 'analysis' }, 'alice');
    const oldBob = store.put({ kind: 'analysis' }, 'bob'); store.put({ kind: 'analysis' }, 'bob'); store.put({ kind: 'analysis' }, 'bob');
    assert.equal(store.get(alice.id, 'alice').kind, 'analysis');
    assert.throws(() => store.get(oldBob.id, 'bob'), { code: 'EXPIRED_RECORD' });
    assert.throws(() => store.put({}, 'charlie'), { code: 'RECORD_CAPACITY' });
    assert.throws(() => store.get(alice.id, 'bob'), { code: 'EXPIRED_RECORD' });
    assert.throws(() => store.get(alice.id), { code: 'EXPIRED_RECORD' });
    assert.equal(store.delete(alice.id, 'bob'), false); store.clear('bob'); assert.equal(store.get(alice.id, 'alice').kind, 'analysis');
  } finally { store.close(); }
});

test('hosted sessions are bounded, expire and reject fixation or duplicate cookies', () => {
  let now = 0; const expired = [];
  const boundary = createHostedBoundary(hosting, { now: () => now, maxSessions: 1, onExpire: id => expired.push(id) });
  const invoke = cookie => {
    const headers = {}; let error; let allowed = false;
    const req = { method: 'GET', path: '/', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'apifit.example.com', authorization, cookie } };
    boundary.middleware(req, { set: (key, value) => { headers[key] = value; } }, e => { error = e; allowed = !e; });
    return { headers, error, allowed, id: req.sessionId };
  };
  try {
    const first = invoke(`__Host-apifit-session=${'a'.repeat(64)}`); assert.equal(first.allowed, true); assert.notEqual(first.id, 'a'.repeat(64));
    assert.equal(invoke().error.code, 'SESSION_CAPACITY');
    assert.equal(invoke(`__Host-apifit-session=${first.id}; __Host-apifit-session=${first.id}`).error.code, 'SESSION_CAPACITY');
    assert.equal(invoke(`__Host-apifit-session=${first.id}`).id, first.id);
    now = 900001; const replacement = invoke(`__Host-apifit-session=${first.id}`);
    assert.notEqual(replacement.id, first.id); assert.deepEqual(expired, [first.id]);
  } finally { boundary.close(); }
});

for (const accessMode of ['password', 'public']) test(`${accessMode} AI consent and readiness are checked before summary/brief documentation reads without an extra generation`, async t => {
  let reads = 0; let generations = 0; let ready = true;
  const ai = new AiService({ credentialStatus: async () => ready ? 'stored' : 'missing', budget: { status: async () => ({ available: true, remainingUsd: 1 }) },
    client: { run: async (_task, context) => { generations++; return { sourceFit: 'software-docs', capabilities: [{ title: 'Find parking', does: 'Lists parking spaces.', helps: 'You could show parking options.', evidenceIds: [context.evidence[0].id] }], checks: [] }; } } });
  const { client } = await serve(t, { hosting: { ...hosting, accessMode }, ai, fetcher: async () => { reads++; return source(); } }); const request = client();
  for (const [path, body] of [['/api/summaries', { url: analysisInput.url }], ['/api/build-briefs', { query: 'parking', urls: [analysisInput.url] }], ['/api/analyses', { ...analysisInput, ai: true }]]) {
    assert.equal((await request(path, { method: 'POST', body })).status, 403);
    ready = false;
    assert.equal((await request(path, { method: 'POST', body: { ...body, ...consent } })).status, 503); ready = true;
  }
  assert.equal(reads, 0); assert.equal(generations, 0);
  const response = await request('/api/summaries', { method: 'POST', body: { url: analysisInput.url, query: 'parking', ...consent } });
  assert.equal(response.status, 200); assert.equal(reads, 1); assert.equal(generations, 1);
});

test('explicit public mode needs no password but still issues a protected ownership cookie', async t => {
  const { client } = await serve(t, { hosting: { origin: hosting.origin, accessMode: 'public' } }); const request = client();
  const response = await request('/'); assert.equal(response.status, 200);
  assert.equal(response.headers['www-authenticate'], undefined);
  assert.match(response.headers['set-cookie'][0], /^__Host-apifit-session=[a-f0-9]{64}; Path=\/; Max-Age=900; HttpOnly; Secure; SameSite=Strict$/);
  assert.deepEqual((await request('/api/ai/status')).json(), { configured: false, ready: false });
  assert.equal((await request('/api/analyses', { method: 'POST', body: analysisInput })).status, 201);
});

test('a request cannot switch a password-protected server to public mode', async t => {
  const { client } = await serve(t); const request = client();
  assert.equal((await request('/?accessMode=public', { authenticated: false, headers: { 'X-APIFIT-Access-Mode': 'public' } })).status, 401);
  assert.equal((await request('/api/analyses', { authenticated: false, method: 'POST', body: { ...analysisInput, hosting: { accessMode: 'public' }, accessMode: 'public' } })).status, 401);
});

test('public session creation consumes socket-peer quota even without an API call or auth', () => {
  const boundary = createHostedBoundary({ origin: hosting.origin, accessMode: 'public' }, { peerRequests: 2 });
  const request = (cookie, forwardedFor = 'ignored') => {
    let error; const headers = {};
    boundary.middleware({ method: 'GET', path: '/', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'apifit.example.com', cookie, 'x-forwarded-for': forwardedFor } },
      { set: (key, value) => { headers[key] = value; } }, value => { error = value; });
    return { error, cookie: headers['Set-Cookie']?.split(';')[0] };
  };
  try {
    const first = request(); assert.equal(first.error, undefined);
    assert.equal(request().error, undefined);
    assert.equal(request(undefined, 'different-spoofed-ip').error.code, 'RATE_LIMIT');
    assert.equal(request(first.cookie).error, undefined, 'ordinary assets in an existing session do not spend API capacity');
  } finally { boundary.close(); }
});

test('public AI admission caps route attempts per session, independently of consent and session clearing', async t => {
  let reads = 0; let generations = 0;
  const ai = new AiService({ credentialStatus: async () => 'stored', budget: { status: async () => ({ available: true, remainingUsd: 1 }) }, client: { run: async () => { generations++; assert.fail('No consent; never generate.'); } } });
  const { client } = await serve(t, { hosting: { origin: hosting.origin, accessMode: 'public' }, ai, fetcher: async () => { reads++; return source(); } }); const request = client();
  for (let i = 0; i < 10; i++) assert.equal((await request('/api/summaries', { method: 'POST', body: { url: analysisInput.url } })).status, 403);
  await request('/api/session', { method: 'DELETE' });
  const denied = await request('/api/summaries', { method: 'POST', body: { url: analysisInput.url, ...consent } });
  assert.equal(denied.status, 429); assert.equal(denied.json().error.code, 'AI_SESSION_LIMIT');
  assert.equal(reads, 0); assert.equal(generations, 0);
  assert.equal((await request('/api/analyses', { method: 'POST', body: analysisInput })).status, 201, 'free analysis is not the AI admission quota');
});

test('public AI admission counts a route once even if its implementation checks options again', () => {
  let now = 0; const boundary = createHostedBoundary({ origin: hosting.origin, accessMode: 'public' }, { now: () => now });
  let cookie;
  const nextRequest = () => {
    const req = { method: 'POST', path: '/api/analyses', socket: { remoteAddress: '127.0.0.1' }, headers: { host: 'apifit.example.com', origin: hosting.origin, cookie } };
    boundary.middleware(req, { set: (key, value) => { if (key === 'Set-Cookie') cookie = value.split(';')[0]; } }, error => { assert.equal(error, undefined); });
    return req;
  };
  try {
    for (let i = 0; i < 10; i++) { const req = nextRequest(); boundary.admitAi(req); boundary.admitAi(req); }
    assert.throws(() => boundary.admitAi(nextRequest()), { code: 'AI_SESSION_LIMIT' });
    now = 900001; assert.doesNotThrow(() => boundary.admitAi(nextRequest()));
  } finally { boundary.close(); }
});
