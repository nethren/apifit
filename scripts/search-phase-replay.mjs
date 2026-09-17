// Free deterministic regression audit of the fixed fictional release run.
// No credential access, network fallback, model request or output persistence.
import { readFile } from 'node:fs/promises';
import { Catalog } from '../server/catalog.mjs';
import { directoryContext, validateRanking, validateSearchQueries } from '../server/search-ai.mjs';
import { assertNoSecrets } from '../server/ai-client.mjs';
import { digest, snapshotFetcher, summarize, scoreCase } from './search-quality-metrics.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const datasetText = await readFile(new URL('../tests/search-quality-v2-cases.json', import.meta.url), 'utf8');
const cases = JSON.parse(datasetText).cases;
const manifest = await read('output/search-quality/phase-release-v43/manifest.json');
if (manifest.datasetHash !== digest(datasetText)) throw new Error('Dataset changed; this is not the same evaluation.');
const snapshot = await read('output/search-quality/catalog-v2-2026-09-16.json');
if (manifest.snapshotHash !== snapshot.hash) throw new Error('Snapshot changed.');
const catalog = new Catalog({ fetcher: snapshotFetcher(snapshot), now: () => Date.parse(snapshot.createdAt), indexed: true, indexOptions: { maxPages: snapshot.pages } });
await catalog.warmIndex();
const before = [], after = [], queryChanges = [], candidateChanges = [], rankingChanges = [];
try {
  for (const c of cases) {
    const r = await read(`output/search-quality/phase-release-v43/${c.id}.json`);
    before.push(r);
    if (!r.queries) { after.push(r); continue; }
    const queries = validateSearchQueries({ queries: r.queries });
    const changedQuery = JSON.stringify(queries) !== JSON.stringify(r.queries);
    const found = await catalog.search({ query: c.query, queries, source: c.source || 'api', limit: 24, mcpPages: 3 });
    if (JSON.stringify(found.items.map(x => x.id)) !== JSON.stringify(r.candidates.map(x => x.id))) candidateChanges.push(c.id);
    if (changedQuery) {
      queryChanges.push({ id: c.id, before: r.queries, after: queries, referenceRetrieved: found.items.some(x => c.expected.includes(x.product)), needsLiveRanking: true });
      // Old model IDs refer to the OLD candidate pool; never replay them against
      // different candidates or count the retrieval fix as an AI-ranking pass.
      after.push(r); continue;
    }
    const safeItems = r.candidates.filter(item => {
      try { assertNoSecrets(directoryContext([item])[0]); return true; }
      catch (error) { if (error.code !== 'AI_SENSITIVE_INPUT') throw error; return false; }
    });
    if (!r.rankingOutput) { after.push(r); continue; }
    const ranked = validateRanking(r.rankingOutput, safeItems, directoryContext(safeItems));
    const updated = { ...r, response: { ...r.response, ...ranked } };
    if (scoreCase(c, r).hit3 !== scoreCase(c, updated).hit3) rankingChanges.push({ id: c.id, beforeHit3: scoreCase(c, r).hit3, afterHit3: scoreCase(c, updated).hit3 });
    after.push(updated);
  }
} finally { catalog.close(); }
console.log(JSON.stringify({ recordedLive: summarize(cases, before), deterministicReplay: summarize(cases, after), queryChanges, candidateChanges, rankingChanges,
  note: 'Replay is not a new live run. Changed-query cases retain their old score and require a separate live check. Token/cost/latency fields describe the original recorded requests, not this free replay.' }, null, 2));
