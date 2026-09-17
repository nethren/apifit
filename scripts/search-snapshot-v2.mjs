import { mkdir, writeFile } from 'node:fs/promises';
import { fetchDocument } from '../server/safe-fetch.mjs';
import { Catalog } from '../server/catalog.mjs';
import { hash } from '../server/text.mjs';

// Public metadata only. Exclusive output; no credentials or private searches.
const sources = {};
const fetcher = async (url, options) => sources[url] ||= await fetchDocument(url, options);
const legacy = new Catalog({ fetcher });
await legacy.search({ query: '', source: 'all', limit: 100, mcpPages: 3 });
let cursor; let pages = 0; let records = 0; const seen = new Set();
do {
  const url = new URL('https://registry.modelcontextprotocol.io/v0.1/servers');
  url.searchParams.set('limit', '100'); url.searchParams.set('version', 'latest');
  if (cursor) url.searchParams.set('cursor', cursor);
  const response = await fetcher(url.href, { maxBytes: 8 * 1024 * 1024, timeoutMs: 15000 });
  const data = JSON.parse(response.text);
  if (!Array.isArray(data.servers)) throw Error('Invalid registry page');
  records += data.servers.length; pages++;
  cursor = data.metadata?.nextCursor;
  if (cursor && (typeof cursor !== 'string' || seen.has(cursor))) throw Error('Invalid registry cursor');
  seen.add(cursor);
  if (pages % 10 === 0) console.log(JSON.stringify({ pages, records }));
} while (cursor && pages < 300);
const snapshot = { createdAt: new Date().toISOString(), sources, pages, records, complete: !cursor, hash: hash(JSON.stringify(sources)) };
await mkdir(new URL('../output/search-quality/', import.meta.url), { recursive: true });
await writeFile(new URL('../output/search-quality/catalog-v2-2026-09-16.json', import.meta.url), JSON.stringify(snapshot), { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ pages, records, complete: !cursor, bytes: Buffer.byteLength(JSON.stringify(sources)), hash: snapshot.hash }));
