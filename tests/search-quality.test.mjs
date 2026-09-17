import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { digest, validateDataset, snapshotFetcher, scoreCase, summarize } from '../scripts/search-quality-metrics.mjs';
const c = { id: 'd01', split: 'development', query: 'Send emails', expected: ['mail:send'], forbidden: ['mail:verify'] };
const result = { caseId: c.id, covered: true, candidates: [{ product: 'mail:send' }], status: 200, response: { items: [{ product: 'mail:verify' }, { product: 'unjudged:alternative' }, { product: 'mail:send' }] }, elapsedMs: 100, costMicrousd: 10, usage: [{ inputTokens: 5, outputTokens: 1 }] };
test('benchmark separates missing references, unjudged results and explicitly wrong actions', () => {
  assert.deepEqual(scoreCase(c, result), { referenceCase: true, covered: true, retrieved: true, hit3: true, reciprocalRank: 1 / 3, forbiddenTop3: 1, unjudgedTop3: 1, duplicateTop3: 0, abstained: null, error: false, elapsedMs: 100 });
  assert.equal(scoreCase(c, { ...result, response: { items: [{ product: 'mail:unknown' }] } }).forbiddenTop3, 0);
});
test('conditional denominator excludes source gaps; end-to-end denominator keeps them', () => {
  const missing = { ...c, id: 'd02', expected: ['absent'] };
  const metrics = summarize([c, missing], [result, { ...result, caseId: 'd02', covered: false }]);
  assert.deepEqual(metrics.coveredReferenceHit3, { count: 1, total: 1, fraction: 1 });
  assert.deepEqual(metrics.referenceHit3, { count: 1, total: 2, fraction: .5 });
  assert.deepEqual(metrics.sourceCoverage, { count: 1, total: 2, fraction: .5 });
  assert.equal(metrics.inputTokens, 10); assert.equal(metrics.outputTokens, 2); assert.equal(metrics.chargedOrReservedUsd, .00002);
});
test('failed empty response is not a successful abstention; duplicates counted by product', () => {
  const empty = { ...c, expected: [], expectEmpty: true };
  assert.equal(scoreCase(empty, { ...result, status: 502, response: {} }).abstained, false);
  assert.equal(scoreCase(c, { ...result, response: { items: [{ product: 'same' }, { product: 'same' }] } }).duplicateTop3, 1);
  assert.equal(summarize([], []).referenceHit3.fraction, null);
});
test('snapshot replay verifies digest and refuses unknown URLs with no network fallback', async () => {
  const sources = { 'https://example.test/': { text: '{}' } };
  const fetcher = snapshotFetcher({ sources, hash: digest(sources) });
  assert.deepEqual(await fetcher('https://example.test/'), sources['https://example.test/']);
  await assert.rejects(fetcher('https://example.test/other'), /No network fallback/);
  assert.throws(() => snapshotFetcher({ sources, hash: 'altered' }), /integrity/);
});
test('frozen dataset has 20 development and 10 holdout cases and validates reference boundaries', async () => {
  const dataset = validateDataset(JSON.parse(await readFile(new URL('./search-quality-cases.json', import.meta.url), 'utf8')));
  assert.equal(dataset.cases.filter(x => x.split === 'development').length, 20);
  assert.equal(dataset.cases.filter(x => x.split === 'holdout').length, 10);
  assert.throws(() => validateDataset({ version: 'bad', cases: [c, c] }), /Invalid/);
  assert.throws(() => validateDataset({ version: 'bad', cases: [{ ...c, forbidden: c.expected }] }), /Invalid/);
});
test('phase gate keeps named/API/MCP requests, negatives and abstentions across both splits', async () => {
  const dataset = validateDataset(JSON.parse(await readFile(new URL('./search-phase-cases.json', import.meta.url), 'utf8')));
  for (const split of ['development', 'holdout']) {
    const cases = dataset.cases.filter(c => c.split === split);
    assert.equal(cases.length, 14);
    assert.ok(cases.some(c => c.source === 'api') && cases.some(c => c.source === 'mcp'));
    assert.ok(cases.some(c => c.expectEmpty) && cases.some(c => c.forbidden?.length));
  }
});
