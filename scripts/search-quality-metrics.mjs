import { createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
export function validateDataset(dataset) {
  if (!dataset?.version || !Array.isArray(dataset.cases) || !dataset.cases.length) throw new Error('Invalid benchmark dataset.');
  const ids = new Set();
  for (const c of dataset.cases) {
    if (!/^[dh]\d{2}$/.test(c.id) || ids.has(c.id) || !['development', 'holdout'].includes(c.split) || typeof c.query !== 'string' || !c.query.trim() || c.query.length > 1000
      || !Array.isArray(c.expected) || c.expected.some(x => typeof x !== 'string' || !x) || (c.expectEmpty ? c.expected.length : !c.expected.length)
      || (c.forbidden || []).some(x => typeof x !== 'string' || c.expected.includes(x)) || c.source && !['api', 'mcp', 'all'].includes(c.source)) throw new Error('Invalid benchmark case.');
    ids.add(c.id);
  }
  return dataset;
}
export function snapshotFetcher(snapshot) {
  if (!snapshot?.sources || digest(snapshot.sources) !== snapshot.hash) throw new Error('Snapshot integrity check failed.');
  return async url => {
    if (!Object.hasOwn(snapshot.sources, url)) throw new Error('Snapshot does not contain this URL. No network fallback.');
    return snapshot.sources[url];
  };
}
export function scoreCase(c, result) {
  const expected = new Set(c.expected); const forbidden = new Set(c.forbidden || []);
  const items = result.response?.items || []; const top = items.slice(0, 3);
  const first = items.findIndex(x => expected.has(x.product));
  return { referenceCase: expected.size > 0, covered: result.covered,
    retrieved: (result.candidates || []).some(x => expected.has(x.product)), hit3: top.some(x => expected.has(x.product)),
    reciprocalRank: first < 0 ? 0 : 1 / (first + 1),
    forbiddenTop3: top.filter(x => forbidden.has(x.product)).length,
    unjudgedTop3: top.filter(x => !expected.has(x.product) && !forbidden.has(x.product)).length,
    duplicateTop3: top.length - new Set(top.map(x => x.product)).size,
    abstained: c.expectEmpty ? result.status === 200 && items.length === 0 : null,
    error: result.status !== 200, elapsedMs: result.elapsedMs };
}
export function summarize(cases, results) {
  const rows = cases.map(c => { const r = results.find(x => x.caseId === c.id); return r && { ...scoreCase(c, r), usage: r.usage || [], costMicrousd: r.costMicrousd }; }).filter(Boolean);
  const ref = rows.filter(x => x.referenceCase); const covered = ref.filter(x => x.covered);
  const ratio = (num, den) => ({ count: num, total: den, fraction: den ? num / den : null });
  const sum = (list, key) => list.reduce((n, x) => n + Number(x[key] || 0), 0);
  const times = rows.map(x => x.elapsedMs).sort((a, b) => a - b);
  const percentile = p => times.length ? times[Math.ceil(times.length * p) - 1] : null;
  return { completed: rows.length, planned: cases.length,
    sourceCoverage: ratio(sum(ref, 'covered'), ref.length), retrievalHit: ratio(sum(covered, 'retrieved'), covered.length),
    referenceHit3: ratio(sum(ref, 'hit3'), ref.length), coveredReferenceHit3: ratio(sum(covered, 'hit3'), covered.length),
    meanReciprocalRank: ref.length ? sum(ref, 'reciprocalRank') / ref.length : null,
    forbiddenTop3: sum(rows, 'forbiddenTop3'), unjudgedTop3: sum(rows, 'unjudgedTop3'), duplicateTop3: sum(rows, 'duplicateTop3'),
    abstention: ratio(rows.filter(x => x.abstained === true).length, rows.filter(x => x.abstained !== null).length),
    errors: sum(rows, 'error'), latencyMs: { p50: percentile(.5), p95: percentile(.95) },
    inputTokens: sum(rows.flatMap(x => x.usage), 'inputTokens'), outputTokens: sum(rows.flatMap(x => x.usage), 'outputTokens'),
    chargedOrReservedUsd: sum(rows, 'costMicrousd') / 1e6 };
}
