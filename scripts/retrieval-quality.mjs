// Offline only: replay frozen public metadata and fictional request fixtures.
// Never import an AI client or fall back to the network.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Catalog } from '../server/catalog.mjs';
import { digest, snapshotFetcher } from './search-quality-metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const option = (key, fallback) => { const i = args.indexOf(key); return i < 0 ? fallback : args[i + 1]; };
const run = option('--run', ''); const split = option('--split', 'development');
if (!/^[a-z][a-z0-9-]{0,40}$/.test(run) || !['development', 'holdout', 'all'].includes(split)) throw new Error('Use --run unique-name --split development|holdout|all.');
const snapshot = JSON.parse(await readFile(`${root}output/search-quality/catalog-v2-2026-09-16.json`, 'utf8'));
const dataset = JSON.parse(await readFile(`${root}tests/search-quality-v2-cases.json`, 'utf8'));
const fresh = JSON.parse(await readFile(`${root}tests/mcp-retrieval-cases.json`, 'utf8'));
const cases = [];
for (const c of dataset.cases) {
  const saved = JSON.parse(await readFile(`${root}output/search-quality/v2-baseline/${c.id}.json`, 'utf8'));
  cases.push({ ...c, id: `saved-${c.id}`, queries: saved.queries });
}
for (const id of ['d17', 'd25', 'd26', 'd27']) {
  const c = dataset.cases.find(c => c.id === id);
  const saved = JSON.parse(await readFile(`${root}output/search-quality/v2-shipped-smoke/${id}.json`, 'utf8'));
  cases.push({ ...c, id: `smoke-${id}`, queries: saved.queries });
}
const geocoder = JSON.parse(await readFile(`${root}output/search-quality/v2-grounded-final/d05.json`, 'utf8'));
cases.push({ ...dataset.cases.find(c => c.id === 'd05'), id: 'geocoder-d05', queries: geocoder.queries });
cases.push(...fresh.cases.map(c => ({ ...c, id: `fresh-${c.id}` })));
const selected = cases.filter(c => split === 'all' || c.split === split);
const directory = `${root}output/retrieval-quality`;
await mkdir(directory, { recursive: true });
const target = `${directory}/${run}.json`;
// Reserve the output name before any work; never overwrite an earlier run.
await writeFile(target, JSON.stringify({ state: 'started', run, split }), { flag: 'wx', mode: 0o600 });
const catalog = new Catalog({ fetcher: snapshotFetcher(snapshot), now: () => Date.parse(snapshot.createdAt), indexed: true, indexOptions: { maxPages: snapshot.pages || 300 } });
const results = [];
try {
  await catalog.warmIndex();
  for (const c of selected) {
    const started = performance.now();
    const response = c.queries?.length ? await catalog.search({ query: c.query, queries: c.queries, source: c.source || 'api', limit: 24 }) : { items: [] };
    const products = response.items.map(i => i.product);
    results.push({ id: c.id, split: c.split, source: c.source || 'api', query: c.query, queries: c.queries, expected: c.expected,
      products, hit24: products.some(p => c.expected.includes(p)), rank: products.findIndex(p => c.expected.includes(p)) + 1 || null,
      elapsedMs: Math.round(performance.now() - started) });
  }
} finally { catalog.close(); }
const fingerprint = {};
for (const file of ['server/catalog.mjs', 'server/text.mjs', 'server/catalog-index.mjs', 'server/mcp-retrieval.mjs']) {
  try { fingerprint[file] = digest(await readFile(`${root}${file}`, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
}
const reference = results.filter(r => r.expected.length);
const summary = { cases: results.length, referenceCases: reference.length, hit24: reference.filter(r => r.hit24).length,
  api: { count: reference.filter(r => r.source === 'api').length, hits: reference.filter(r => r.source === 'api' && r.hit24).length },
  mcp: { count: reference.filter(r => r.source === 'mcp').length, hits: reference.filter(r => r.source === 'mcp' && r.hit24).length } };
await writeFile(target, JSON.stringify({ run, split, state: 'complete', snapshotHash: snapshot.hash, fixturesHash: digest(cases), fingerprint, summary, results }, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ run, summary, output: target, misses: results.filter(r => r.split !== 'holdout' && r.expected.length && !r.hit24).map(r => r.id), holdoutOutputsSealed: split !== 'holdout' }));
