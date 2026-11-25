import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';
import { parseSource } from '../server/parser.mjs';
import { source, apiDirectory } from './fixtures.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { directoryContext, rankingContext, validateRanking, validateEvidenceRanking, validateConcepts, conceptCoverage } from '../server/search-ai.mjs';
import { taskSchema, TASKS, RANK_EVIDENCE_PATTERN } from '../server/ai-prompts.mjs';
import { normalizeApis } from '../server/catalog.mjs';
import { CONCEPT_ICONS } from '../shared/concept-icons.mjs';

// Synthetic model responses only: this file never reads credentials or calls a provider.
const options = { ai: true, aiConsent: AI_CONSENT };
const items = normalizeApis(apiDirectory, '2026-09-14');
const context = directoryContext(items);
const query = 'Text drivers when parking is free and the weather turns';
const concepts = validateConcepts([
  { label: 'Parking', icon: 'car', words: ['parking'] },
  { label: 'Weather', icon: 'weather', words: ['weather'] },
  { label: 'SMS', icon: 'sms', words: ['Text'] },
], query);
const cite = index => context[index].evidence[0].id;
const match = (index, covers, extra = {}) => ({ id: `c${index + 1}`, evidenceId: cite(index), tier: 'close', reason: 'A related capability.', gap: '', covers, ...extra });
function service(run) {
  return new AiService({ client: { run }, budget: { status: async () => ({ available: true, remainingUsd: 4 }) }, credentialStatus: async () => 'stored' });
}

test('concepts are anchored in the request, use the closed icon list and get server-issued IDs', () => {
  assert.deepEqual(concepts.map(c => [c.id, c.label, c.icon, c.words]), [['k1', 'Parking', 'car', ['parking']], ['k2', 'Weather', 'weather', ['weather']], ['k3', 'SMS', 'sms', ['Text']]]);
  const filtered = validateConcepts([
    { label: 'Invented need', icon: 'payment', words: ['payments'] }, // words not in the request
    { label: 'Weather', icon: 'not-an-icon', words: ['weather'] }, // icon outside the vocabulary
    { label: 'Weather', icon: 'weather', words: ['weather', 'weather', 'sunshine'] }, // duplicate and absent words
    { label: 'weather', icon: 'weather', words: ['weather'] }, // duplicate label
    { label: 'x'.repeat(25), icon: 'generic', words: ['parking'] }, // label too long
    { label: 'Parking', icon: 'car', words: ['parking'], id: 'k9' }, // extra key
    { label: 'Parking', icon: 'car', words: ['PARKING'] }, // case-insensitive anchor
  ], query);
  assert.deepEqual(filtered, [{ id: 'k1', label: 'Weather', icon: 'weather', words: ['weather'] }, { id: 'k2', label: 'Parking', icon: 'car', words: ['PARKING'] }]);
  assert.equal(validateConcepts(Array.from({ length: 6 }, (_, i) => ({ label: `Need ${i}`, icon: 'generic', words: ['parking'] })), query).length, 4);
  for (const value of [undefined, null, 'Weather', {}, [null, 3]]) assert.deepEqual(validateConcepts(value, query), []);
  assert.ok(CONCEPT_ICONS.includes('generic'));
});

test('coverage accepts only issued concept IDs, in concept order, without repeats', () => {
  assert.deepEqual(conceptCoverage(['k3', 'k1', 'k1', 'k9', 7], concepts), ['k1', 'k3']);
  assert.deepEqual(conceptCoverage(['k1'], []), []);
  assert.deepEqual(conceptCoverage('k1', concepts), []);
});

test('ranking keeps coverage for accepted reasons and drops it for neutral or withheld leads', () => {
  const result = validateRanking({ matches: [match(0, ['k1', 'k7']), match(1, ['k2'])], uncovered: [] }, items, context, concepts);
  assert.deepEqual(result.items.map(i => i.match.covers), [['k1'], ['k2']]);
  // A named lookup cites no sentence: listed under its name, so it covers nothing.
  const identity = validateRanking({ matches: [match(0, ['k1', 'k2', 'k3'], { evidenceId: 'none' })], uncovered: [] }, items, context, concepts);
  assert.deepEqual(identity.items[0].match.covers, []);
  // An unverified assurance downgrades the lead and withholds its coverage.
  const assured = validateRanking({ matches: [match(0, ['k1'], { reason: 'Official, verified parking data.' })], uncovered: [] }, items, context, concepts);
  assert.deepEqual(assured.items[0].match.covers, []);
  // Citing another candidate's sentence withholds the whole match, coverage included.
  const invented = validateRanking({ matches: [match(0, ['k1'], { evidenceId: cite(1) }), match(1, ['k2'])], uncovered: [] }, items, context, concepts);
  assert.deepEqual(invented.items.map(i => [i.id, i.match.covers]), [[items[1].id, ['k2']]]);
});

test('the covers field is required with concepts and rejected without them', () => {
  assert.throws(() => validateRanking({ matches: [{ ...match(0), covers: undefined }].map(({ covers, ...m }) => m), uncovered: [] }, items, context, concepts), { code: 'AI_INVALID_RESULT' });
  assert.throws(() => validateRanking({ matches: [match(0, ['k1'])], uncovered: [] }, items, context, []), { code: 'AI_INVALID_RESULT' });
  const plain = validateRanking({ matches: [(({ covers, ...m }) => m)(match(0))], uncovered: [] }, items, context);
  assert.deepEqual(plain.items[0].match.covers, []);
});

test('evidence ranking grants coverage only to documentation-backed matches', () => {
  const enriched = [{ ...items[0], rankingEvidence: { status: 'documentation-read', source: { url: 'https://docs.example.com/parking.json' }, excerpts: [{ excerpt: 'List parking locations with free spaces.' }] } }, items[1]];
  const ctx = rankingContext(enriched);
  const result = validateEvidenceRanking({ matches: [
    { id: 'c1', tier: 'close', reason: 'Lists parking locations with free spaces.', gap: '', evidenceId: 'c1.d1', covers: ['k1'] },
    { id: 'c2', tier: 'close', reason: 'Weather forecasts.', gap: '', evidenceId: 'c2.listing', covers: ['k2'] },
  ], uncovered: [] }, enriched, ctx, concepts);
  assert.deepEqual(result.items.map(i => i.match.covers), [['k1'], []]);
});

test('ranking schema offers a covers enum of issued IDs only when concepts are supplied', () => {
  const withConcepts = taskSchema('rank', { candidates: context, concepts: concepts.map(({ id, label }) => ({ id, label })) });
  assert.deepEqual(withConcepts.properties.matches.items.properties.covers.items.enum, ['k1', 'k2', 'k3']);
  assert.ok(withConcepts.properties.matches.items.required.includes('covers'));
  assert.equal(taskSchema('rank', { candidates: [] }).properties.matches.items.properties.covers, undefined);
  assert.equal(taskSchema('rankEvidence', { concepts: [{ id: 'k1', label: 'Parking' }] }).properties.matches.items.properties.covers.items.enum[0], 'k1');
  assert.throws(() => taskSchema('rank', { candidates: context, concepts: [{ id: 'injected', label: 'Parking' }] }), /Invalid concept envelope/);
  const plan = taskSchema('searchQueries', {});
  assert.deepEqual(plan.properties.concepts.items.properties.icon.enum, CONCEPT_ICONS);
  assert.ok(taskSchema('searchPlan', { request: query }).required.includes('concepts'));
});

test('interpretation returns concepts with the search phrases and drops invalid ones without failing', async () => {
  const calls = [];
  const ai = service(async (task, data) => { calls.push(task); return { queries: ['parking', 'parking'], concepts: [{ label: 'Parking', icon: 'car', words: ['parking'] }, { label: 'Invented', icon: 'car', words: ['nowhere'] }] }; });
  assert.deepEqual(await ai.searchQueries(query, options), { queries: ['parking'], concepts: [{ id: 'k1', label: 'Parking', icon: 'car', words: ['parking'] }] });
  const noConcepts = service(async () => ({ queries: ['parking'] }));
  assert.deepEqual(await noConcepts.searchQueries(query, options), { queries: ['parking'], concepts: [] });
  const planned = service(async () => ({ queries: ['parking'], constraints: [], concepts: [{ label: 'Weather', icon: 'weather', words: ['weather'] }] }));
  assert.deepEqual((await planned.searchPlan(query, options)).concepts.map(c => c.label), ['Weather']);
  assert.deepEqual(calls, ['searchQueries']);
});

test('rank sends only concept IDs, labels and request words to the model', async () => {
  let sent;
  const ai = service(async (task, data) => { sent = data; return { matches: [match(0, ['k1'])], uncovered: [] }; });
  const result = await ai.rank(query, items, options, concepts);
  assert.deepEqual(sent.concepts, [{ id: 'k1', label: 'Parking', requestWords: ['parking'] }, { id: 'k2', label: 'Weather', requestWords: ['weather'] }, { id: 'k3', label: 'SMS', requestWords: ['Text'] }]);
  assert.deepEqual(result.items[0].match.covers, ['k1']);
  const without = service(async (task, data) => { sent = data; return { matches: [(({ covers, ...m }) => m)(match(0))], uncovered: [] }; });
  await without.rank(query, items, options);
  assert.equal(sent.concepts, undefined);
});

async function serve(t, run) {
  const calls = [];
  const ai = service(async (task, data) => { calls.push({ task, data }); return run(task, data); });
  const app = createApp({ fetcher: async url => url.includes('apis.guru') ? source(apiDirectory) : source(), parser: parseSource, ai });
  const server = app.listen(0, '127.0.0.1'); server.once('close', app.locals.dispose);
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { calls, request: (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) };
}

test('HTTP discovery returns request concepts and per-result coverage from one interpretation', async t => {
  const { request, calls } = await serve(t, (task, data) => {
    if (task === 'searchQueries') return { queries: ['parking'], concepts: [{ label: 'Parking', icon: 'car', words: ['parking'] }, { label: 'SMS', icon: 'sms', words: ['Text'] }] };
    if (task === 'rank') return { matches: data.candidates.map(c => ({ id: c.id, tier: 'close', evidenceId: c.evidence[0]?.id || 'none', reason: 'Shows parking availability.', gap: '', covers: ['k1', 'k5'] })), uncovered: [] };
    throw new Error(`Unexpected task ${task}`);
  });
  const found = await (await request('/api/discover', { query, source: 'api', ...options })).json();
  assert.deepEqual(found.concepts, [{ id: 'k1', label: 'Parking', icon: 'car', words: ['parking'] }, { id: 'k2', label: 'SMS', icon: 'sms', words: ['Text'] }]);
  assert.deepEqual(found.items.map(i => i.match.covers), [['k1']]);
  assert.deepEqual(calls.map(c => c.task), ['searchQueries', 'rank']);
  assert.deepEqual(calls[1].data.concepts.map(c => c.id), ['k1', 'k2']);
});

test('keyword discovery has no concepts or coverage and makes no AI call', async t => {
  const { request, calls } = await serve(t, () => { throw new Error('No AI call expected'); });
  const found = await (await request('/api/discover', { query: 'parking', source: 'api' })).json();
  assert.deepEqual(found.concepts, []); assert.equal(found.ranking.mode, 'keyword-search');
  assert.ok(found.items.length > 0); assert.ok(found.items.every(i => i.match === undefined));
  assert.equal(calls.length, 0);
});

test('more results reuse the stored concepts without another interpretation request', async t => {
  const requests = [];
  const app = createApp({ ai: {
    searchQueries: async () => ({ queries: ['parking'], concepts: [{ id: 'k1', label: 'Parking', icon: 'car', words: ['parking'] }] }),
    rank: async (_q, candidates, _o, received) => { requests.push(received); return { items: candidates.map(c => ({ ...c, match: { tier: 'close', reason: 'x', gap: '', covers: received.map(k => k.id) } })), uncovered: [] }; },
  }, catalog: { search: async input => { assert.equal(input.concepts, undefined, 'concepts never reach directory search'); return { items: [items[0]], sources: [], coverage: {}, pagination: { nextOffset: input.offset ? null : 24, nextMcpCursor: null } }; } } });
  const server = app.listen(0, '127.0.0.1'); server.once('close', app.locals.dispose);
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json());
  const first = await post('/api/discover', { query: 'My parking idea', ...options });
  const more = await post(`/api/discover/${first.id}/more`, { _records: first._recordToken ? { [first.id]: first._recordToken } : undefined, ...options });
  assert.deepEqual(first.concepts.map(c => c.id), ['k1']); assert.deepEqual(more.concepts.map(c => c.id), ['k1']);
  assert.deepEqual(requests.map(r => r.map(k => k.id)), [['k1'], ['k1']]);
});

test('ranking can cite only description sentences, so a name cannot carry a capability or coverage', () => {
  // Production on 2026-11-19 and 2026-11-25: asked to quote text, the ranker
  // quoted Name: lines, so every result lost its reason and coverage. It now
  // picks a sentence ID from a schema enum and the server supplies the text.
  const listing = { id: 'api:x', product: 'storm.example', kind: 'api', name: 'Storm Weather API', description: 'Hourly forecasts for any location. Severe weather alerts by region!  ok' };
  const ctx = directoryContext([listing]);
  assert.deepEqual(ctx[0].evidence, [{ id: 'c1.s1', excerpt: 'Hourly forecasts for any location.' }, { id: 'c1.s2', excerpt: 'Severe weather alerts by region!' }]);
  assert.equal(JSON.stringify(ctx[0].evidence).includes('Storm Weather API'), false);
  const schema = taskSchema('rank', { candidates: ctx, concepts }).properties.matches.items;
  const allowed = new RegExp(schema.properties.evidenceId.pattern);
  assert.equal(schema.properties.evidenceId.pattern, RANK_EVIDENCE_PATTERN);
  for (const id of ['c1.s1', 'c24.s8', 'none']) assert.ok(allowed.test(id), id);
  for (const id of ['Name: Storm Weather API', 'Hourly forecasts for any location.', 'c1.s9', 'c1', '', 'None ']) assert.equal(allowed.test(id), false, id);
  assert.deepEqual(schema.required.slice(0, 2), ['id', 'evidenceId']);
  assert.throws(() => taskSchema('rank', { candidates: [{ id: 'c1', evidence: [{ id: 'Name: x' }] }] }), /Invalid ranking candidate envelope/);
  assert.match(TASKS.rank.instruction, /choose FIRST the evidenceId of the sentence that establishes the action/);
  const rank = (evidenceId, reason = 'Sends severe weather alerts.') => validateRanking({ uncovered: [], matches: [{ id: 'c1', evidenceId, tier: 'close', reason, gap: '', covers: ['k2'] }] }, [listing], ctx, concepts);
  const cited = rank('c1.s2').items[0].match;
  assert.deepEqual([cited.reason, cited.quote, cited.evidenceId, cited.covers], ['Sends severe weather alerts.', 'Severe weather alerts by region!', 'c1.s2', ['k2']]);
  const named = rank('none').items[0].match;
  assert.deepEqual([named.tier, named.quote, named.covers], ['partial', 'Name: Storm Weather API', []]);
  assert.match(named.reason, /^Listed under this name/);
  assert.throws(() => rank('c1.s9'), { code: 'AI_INVALID_RESULT' }); // only withheld match
  assert.throws(() => validateRanking({ uncovered: [], matches: [{ id: 'c1', evidenceId: 'c1.s1', tier: 'close', reason: 'x', gap: '', quote: 'Name: Storm Weather API', covers: [] }] }, [listing], ctx, concepts), { code: 'AI_INVALID_RESULT' });
  assert.deepEqual(directoryContext([{ ...listing, description: '' }])[0].evidence, []);
});
