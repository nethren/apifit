import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Catalog } from '../server/catalog.mjs';
import { fetchDocument } from '../server/safe-fetch.mjs';
import { AiBudget } from '../server/ai-budget.mjs';
import { keychainStatus } from '../server/ai-keychain.mjs';
import { hash } from '../server/text.mjs';

const directory = fileURLToPath(new URL('../output/search-quality/', import.meta.url));
await mkdir(directory, { recursive: true });
const sources = {};
const catalog = new Catalog({ fetcher: async (url, options) => { const source = await fetchDocument(url, options); sources[url] = source; return source; } });
const result = await catalog.search({ query: '', source: 'all', limit: 100, mcpPages: 3 });
if (result.sources.some(s => s.status !== 'available' || s.partial)) throw new Error('A source is unavailable/partial; no benchmark snapshot written.');
const snapshot = { createdAt: new Date().toISOString(), sources, coverage: result.sources, hash: hash(JSON.stringify(sources)) };
const path = `${directory}catalog-2026-09-15.json`;
await writeFile(path, JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ snapshot: path, hash: snapshot.hash, coverage: result.sources, credential: await keychainStatus(), budget: await new AiBudget(fileURLToPath(new URL('../.local/ai-budget.json', import.meta.url))).status() }, null, 2));
