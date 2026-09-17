import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { Catalog, normalizeApis, normalizeMcp } from '../server/catalog.mjs';
import { createApp } from '../server/app.mjs';
import { ClaudeClient } from '../server/ai-client.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { AiBudget } from '../server/ai-budget.mjs';
import { keychainStatus, readAnthropicKey } from '../server/ai-keychain.mjs';
import { knownRetirement } from '../server/lifecycle.mjs';
import { fetchDocument } from '../server/safe-fetch.mjs';
import { assertNoSecrets } from '../server/ai-client.mjs';
import { digest, validateDataset, snapshotFetcher, scoreCase, summarize } from './search-quality-metrics.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2); const flag = name => args.includes(name);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const run = option('--run', ''); const split = option('--split', 'development');
if (!/^[a-z][a-z0-9-]{0,40}$/.test(run) || !['development', 'holdout', 'all'].includes(split)) throw new Error('Use --run unique-name --split development|holdout|all.');
const datasetText = await readFile(`${root}tests/${flag('--phase-gate') ? 'search-phase-cases' : flag('--mcp-retrieval') ? 'mcp-retrieval-cases' : flag('--v2') ? 'search-quality-v2-cases' : 'search-quality-cases'}.json`, 'utf8');
const dataset = validateDataset(JSON.parse(datasetText));
const selectedIds = option('--cases', '').split(',').filter(Boolean);
if (selectedIds.some(id => !dataset.cases.some(c => c.id === id))) throw new Error('Unknown evaluation case ID.');
const cases = dataset.cases.filter(c => (split === 'all' || c.split === split) && (!selectedIds.length || selectedIds.includes(c.id)));
if (!cases.length) throw new Error('No evaluation cases selected.');
const directory = `${root}output/search-quality/${run}`;
if (flag('--report')) {
  const manifest = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
  if (manifest.datasetHash !== digest(datasetText)) throw new Error('Dataset changed since this run.');
  const results = [];
  for (const c of cases) {
    try { results.push(JSON.parse(await readFile(`${directory}/${c.id}.json`, 'utf8'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  console.log(JSON.stringify({ run, split, metrics: summarize(cases, results), cases: results.map(r => ({ id: r.caseId, ...scoreCase(cases.find(c => c.id === r.caseId), r), queries: r.queries, items: r.response?.items?.map(x => ({ product: x.product, match: x.match })) })) }, null, 2));
  process.exit(0);
}
if (!flag('--confirm-paid')) throw new Error('No AI calls made. Paid evaluation requires --confirm-paid under the existing US$5 ledger.');
const snapshot = JSON.parse(await readFile(`${root}output/search-quality/${flag('--v2') ? 'catalog-v2-2026-09-16' : 'catalog-2026-09-15'}.json`, 'utf8'));
const replay = snapshotFetcher(snapshot);
const loaded = Object.entries(snapshot.sources).filter(([url]) => url.includes('apis.guru') || flag('--indexed') === new URL(url).searchParams.has('version')).flatMap(([url, source]) => url.includes('apis.guru') ? normalizeApis(JSON.parse(source.text), source.fetchedAt) : normalizeMcp(JSON.parse(source.text), source.fetchedAt))
  .filter(x => !knownRetirement(x.product, Date.parse(snapshot.createdAt)));
const catalog = new Catalog({ fetcher: replay, now: () => Date.parse(snapshot.createdAt), indexed: flag('--indexed'), indexOptions: { maxPages: snapshot.pages || 300 } });
if (flag('--indexed')) await catalog.warmIndex();
const preflight = await catalog.search({ query: '', source: 'all', limit: 100, mcpPages: 3 });
if (preflight.sources.some(s => s.status !== 'available' || s.partial && !flag('--indexed'))) throw new Error('Incomplete snapshot replay. No AI requests made.');
const files = ['server/catalog-index.mjs', 'server/mcp-retrieval.mjs', 'server/ranking-evidence.mjs', 'server/search-intent.mjs', 'server/catalog.mjs', 'server/text.mjs', 'shared/plain-text.mjs', 'shared/brief-export.mjs', 'server/search-ai.mjs', 'server/ai-prompts.mjs', 'server/ai-config.mjs', 'server/ai-client.mjs', 'server/ai-service.mjs', 'server/app.mjs', 'server/lifecycle.mjs', 'scripts/search-quality.mjs', 'scripts/search-quality-metrics.mjs'];
const fingerprint = Object.fromEntries(await Promise.all(files.map(async path => [path, digest(await readFile(`${root}${path}`, 'utf8'))])));
const durable = new AiBudget(`${root}.local/ai-budget.json`); const before = await durable.status();
if (await keychainStatus() !== 'stored' || !before.available) throw new Error('Approved Keychain credential or spending ledger unavailable.');
const maxRunMicrousd = flag('--mcp-retrieval') ? 300_000 : flag('--phase-gate') ? 500_000 : 1_250_000;
const manifest = { run, split, indexed: flag('--indexed'), experimentalEvidenceSearch: flag('--experimental'), createdAt: new Date().toISOString(), datasetHash: digest(datasetText), snapshotHash: snapshot.hash, fingerprint, before, caseIds: cases.map(c => c.id), maxRunUsd: maxRunMicrousd / 1e6 };
let runCost = 0; let active;
if (flag('--resume')) {
  const previous = JSON.parse(await readFile(`${directory}/manifest.json`, 'utf8'));
  if (previous.datasetHash !== manifest.datasetHash || previous.snapshotHash !== manifest.snapshotHash || JSON.stringify(previous.caseIds) !== JSON.stringify(manifest.caseIds)
    || previous.indexed !== manifest.indexed || Boolean(previous.experimentalEvidenceSearch) !== manifest.experimentalEvidenceSearch || previous.maxRunUsd !== manifest.maxRunUsd
    || files.filter(p => p.startsWith('server/')).some(p => previous.fingerprint[p] !== fingerprint[p])) throw new Error('Cannot resume: dataset, snapshot, split, budget or production configuration changed.');
  for (const id of manifest.caseIds) {
    try { runCost += JSON.parse(await readFile(`${directory}/${id}.json`, 'utf8')).costMicrousd; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  await writeFile(`${directory}/resume-${Date.now()}.json`, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
} else {
  await mkdir(directory); // Deliberately exclusive; existing results never rerun or overwritten.
  await writeFile(`${directory}/manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx', mode: 0o600 });
}
const budget = { status: () => durable.status(), reserve: async amount => {
  if (runCost + amount > maxRunMicrousd) throw Object.assign(new Error('Evaluation run cap reached.'), { code: 'AI_EVAL_CAP' });
  const settle = await durable.reserve(amount); runCost += amount; active.costMicrousd += amount;
  return async actual => { await settle(actual); runCost += actual - amount; active.costMicrousd += actual - amount; };
} };
const client = new ClaudeClient({ budget, keyProvider: readAnthropicKey, onUsage: usage => active.usage.push(usage) });
const runTask = client.run.bind(client);
client.run = async (...params) => {
  const result = await runTask(...params);
  // This runner accepts only the checked-in fictional corpus, never user input.
  // Preserve structured intent output so a failed strict validator is diagnosable.
  if (params[0] === 'searchPlan') active.intentOutput = result;
  if (params[0] === 'rank') active.rankingOutput = result;
  return result;
};
const ai = new AiService({ client, budget, credentialStatus: keychainStatus });
const originalSearch = catalog.search.bind(catalog);
catalog.search = async (...params) => {
  const result = await originalSearch(...params);
  if (result.sources.some(s => s.status !== 'available' || s.partial && !flag('--indexed'))) throw Object.assign(new Error('Incomplete snapshot replay.'), { code: 'EVAL_SOURCE' });
  active.queries = params[0].queries; active.constraints = params[0].constraints; active.candidates = result.items; return result;
};
// Directory retrieval is frozen. Record public documentation separately, keyed
// only by URL, to make subsequent inspection/replay possible without retaining
// private queries. Fictional benchmark requests live only in this run folder.
const documents = new Map(); const docDirectory = `${root}output/search-quality/public-docs-v2`;
await mkdir(docDirectory, { recursive: true });
const documentFetcher = async (url, options) => {
  const path = `${docDirectory}/${digest(url)}.json`;
  try {
    const saved = JSON.parse(await readFile(path, 'utf8'));
    if (saved.requestUrl !== url || saved.hash !== digest(JSON.stringify(saved.source))) throw new Error('Invalid document snapshot');
    documents.set(url, { hash: saved.hash, state: 'replayed' }); return saved.source;
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try {
    const source = await fetchDocument(url, options); assertNoSecrets(source.text);
    const hash = digest(JSON.stringify(source));
    await writeFile(path, JSON.stringify({ requestUrl: url, hash, source }), { flag: 'wx', mode: 0o600 });
    documents.set(url, { hash, state: 'captured' }); return source;
  } catch (error) { documents.set(url, { state: 'unavailable', code: error.code || 'unavailable' }); throw error; }
};
const app = createApp({ catalog, ai, fetcher: documentFetcher, evidenceSearch: flag('--experimental') }); const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  for (const c of cases) {
    if (flag('--resume')) {
      try { await readFile(`${directory}/${c.id}.json`); continue; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    active = { caseId: c.id, query: c.query, covered: loaded.some(x => c.expected.includes(x.product) && (c.source === 'all' || x.kind === (c.source || 'api'))), usage: [], costMicrousd: 0 };
    const started = performance.now();
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/discover`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: c.query, source: c.source || 'api', ai: true, aiConsent: AI_CONSENT }), signal: AbortSignal.timeout(100000) });
      active.status = response.status; active.response = await response.json();
    } catch { active.status = 599; active.response = { error: { code: 'EVAL_REQUEST_FAILED' } }; }
    active.elapsedMs = Math.round(performance.now() - started);
    await writeFile(`${directory}/${c.id}.json`, JSON.stringify(active, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(JSON.stringify(c.split === 'holdout' ? { completed: c.id, sealed: true } : { completed: c.id, ...scoreCase(c, active), costUsd: active.costMicrousd / 1e6 }));
    if (active.status !== 200 && !['AI_INVALID_RESULT', 'AI_INCOMPLETE', 'AI_SENSITIVE_INPUT', 'AI_CONTEXT_LIMIT'].includes(active.response?.error?.code)) { console.log('Run stopped after transport/budget failure; no automatic paid retry.'); break; }
  }
} finally {
  app.locals.dispose(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  await writeFile(`${directory}/finished-${Date.now()}.json`, JSON.stringify({ finishedAt: new Date().toISOString(), chargedOrReservedUsd: runCost / 1e6, after: await durable.status() }, null, 2), { flag: 'wx', mode: 0o600 });
  await writeFile(`${directory}/documents-${Date.now()}.json`, JSON.stringify(Object.fromEntries(documents), null, 2), { flag: 'wx', mode: 0o600 });
}
