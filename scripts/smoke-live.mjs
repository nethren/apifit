// Explicit opt-in: reads public directory metadata and one linked specification.
// No user briefs, API credentials, inference or integration execution involved.
import { Catalog } from '../server/catalog.mjs';
import { fetchDocument } from '../server/safe-fetch.mjs';
import { parseInWorker } from '../server/parse-job.mjs';

const catalog = new Catalog();
const start = Date.now();
const result = await catalog.search({ query: 'weather', limit: 5 });
console.log(JSON.stringify({ check: 'live-directories', sources: result.sources, returnedMatches: result.items.length, milliseconds: Date.now() - start }, null, 2));
if (result.sources.some(s => s.status !== 'available')) process.exitCode = 1;
const candidate = result.items.find(item => item.kind === 'api' && item.specificationUrl);
if (candidate) {
  const response = await fetchDocument(candidate.specificationUrl);
  const analysis = await parseInWorker(response, { limit: 5 });
  console.log(JSON.stringify({ check: 'live-linked-specification', title: analysis.title, format: analysis.format, source: analysis.source.url, bytes: response.bytes, coverage: analysis.coverage, accountAccess: analysis.accountAccess, liveTested: analysis.liveTested }, null, 2));
} else { console.log('No usable API specification was discovered; document parsing smoke check was not run.'); process.exitCode = 1; }
if (result.pagination.nextMcpCursor) {
  const page = await catalog.search({ source: 'mcp', mcpCursor: result.pagination.nextMcpCursor, limit: 1 });
  console.log(JSON.stringify({ check: 'live-mcp-pagination', sources: page.sources, hasNextPage: Boolean(page.pagination.nextMcpCursor) }, null, 2));
  if (page.sources.some(s => s.status !== 'available')) process.exitCode = 1;
}
