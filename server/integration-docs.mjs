import { publicUrl } from './safe-fetch.mjs';
import { assertNoSecrets } from './ai-client.mjs';
import { fail } from './errors.mjs';
import { plain } from './text.mjs';
import { inspectMcp } from './mcp-inspection.mjs';
import { sourceQuality } from './source-quality.mjs';

// Selection labels are untrusted context, not citable proof of capabilities.
export function integrationInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_CANDIDATES', 'Choose an API or MCP server with public documentation.');
  const kind = input.kind || 'unknown';
  if (!['api', 'mcp', 'unknown'].includes(kind)) fail('INVALID_CANDIDATES', 'Choose an API, MCP server or documentation link.');
  const result = { kind };
  for (const key of ['name', 'product', 'version']) {
    if (input[key] != null && (typeof input[key] !== 'string' || input[key].length > 300)) fail('INVALID_CANDIDATES', 'The selected integration has an invalid name.');
    result[key] = plain(input[key], 300);
  }
  for (const key of ['url', 'specificationUrl', 'documentationUrl', 'repositoryUrl']) {
    if (input[key]) result[key] = publicUrl(input[key]).href;
  }
  if (input.remoteEndpoints !== undefined) {
    if (kind !== 'mcp' || !Array.isArray(input.remoteEndpoints) || input.remoteEndpoints.length > 3) fail('INVALID_CANDIDATES', 'Invalid MCP connections.');
    result.remoteEndpoints = input.remoteEndpoints.map(remote => {
      if (!remote || !['streamable-http', 'sse'].includes(remote.type)) fail('INVALID_CANDIDATES', 'Unsupported MCP connection type.');
      return { type: remote.type, url: publicUrl(remote.url).href };
    });
  }
  assertNoSecrets(result);
  if (!Object.keys(result).some(key => key.endsWith('Url') || key === 'url') && !result.remoteEndpoints?.length) fail('INVALID_CANDIDATES', 'This integration has no public documentation link.');
  return result;
}

export function githubReadmeUrl(input) {
  const url = publicUrl(input);
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname !== 'github.com' || parts.length !== 2 || parts.some(part => !/^[\w.-]+$/.test(part))) return null;
  return `https://api.github.com/repos/${parts[0]}/${parts[1].replace(/\.git$/, '')}/readme`;
}

async function readSource(url, fetcher, signal) {
  const readmeUrl = githubReadmeUrl(url);
  if (!readmeUrl) return fetcher(url, { signal });
  const response = await fetcher(readmeUrl, { signal, maxBytes: 1024 * 1024 });
  // GitHub may return JSON with base64 content or a raw README. No scripts,
  // linked files, packages or MCP endpoints are executed or followed.
  let document;
  try { document = JSON.parse(response.text); } catch { /* Raw README. */ }
  if (document) {
    if (document.encoding !== 'base64' || typeof document.content !== 'string' || !/^[A-Za-z0-9+/=\s]+$/.test(document.content)) fail('DOCUMENT_FORMAT', 'The repository did not return a readable README.', 422);
    return { ...response, text: Buffer.from(document.content, 'base64').toString('utf8'), contentType: 'text/markdown', url, retrievalUrl: response.url };
  }
  return { ...response, contentType: 'text/markdown', url, retrievalUrl: response.url };
}

export async function readIntegration(selection, query, { fetcher, parser, inspector = inspectMcp, signal: external }) {
  const signal = external ? AbortSignal.any([external, AbortSignal.timeout(35000)]) : AbortSignal.timeout(35000);
  const urls = [...new Set((selection.kind === 'mcp'
    ? [selection.repositoryUrl, selection.documentationUrl, selection.url, selection.specificationUrl]
    : [selection.specificationUrl, selection.url, selection.documentationUrl, selection.repositoryUrl]).filter(Boolean))];
  const attempts = []; let lastAnalysis;
  const attach = analysis => ({ ...analysis, integration: { kind: selection.kind, name: selection.name || analysis.title, product: selection.product, version: selection.version, labelBasis: 'unverified-selection-context' },
    documentationStatus: { state: 'available', basis: analysis.format === 'mcp-tools' ? 'tool-descriptions' : 'documentation', attempts }, documentationNote: attempts.length > 1 ? 'Used an alternative source after the first link did not provide usable capabilities.' : null });
  const accept = (analysis, url, method) => {
    lastAnalysis = analysis;
    const quality = sourceQuality(analysis);
    attempts.push({ url, method, outcome: quality.usable ? 'usable' : 'no-capability-evidence' });
    return quality.usable ? attach(analysis) : null;
  };
  // Prefer the server's own declared tools over an unrelated shop homepage.
  for (const endpoint of selection.remoteEndpoints || []) {
    external?.throwIfAborted(); if (signal.aborted) break;
    try { const result = accept(await inspector(endpoint, query, { signal }), endpoint.url, 'tool-descriptions'); if (result) return result; }
    catch (error) { external?.throwIfAborted(); attempts.push({ url: endpoint.url, method: 'tool-descriptions', outcome: error.code || 'unavailable' }); }
  }
  const queue = urls.map(url => ({ url, depth: 0 })); const seen = new Set();
  for (let index = 0; index < queue.length && seen.size < 7; index++) {
    const { url, depth } = queue[index];
    if (seen.has(url)) continue;
    seen.add(url);
    external?.throwIfAborted(); if (signal.aborted) break;
    try {
      const source = await readSource(url, fetcher, signal);
      signal?.throwIfAborted();
      const analysis = await parser(source, { offset: 0, limit: 40, query });
      signal?.throwIfAborted();
      const result = accept(analysis, url, 'documentation');
      if (result) return result;
      if (depth === 0) queue.push(...(analysis.documentationLinks || []).slice(0, 3).map(url => ({ url, depth: 1 })));
    } catch (error) { external?.throwIfAborted(); attempts.push({ url, method: 'documentation', outcome: error.code || 'unavailable' }); }
  }
  external?.throwIfAborted();
  const analysis = lastAnalysis || { title: selection.name || 'Integration', evidence: [], capabilities: [], source: { url: urls[0] || selection.remoteEndpoints?.[0]?.url }, format: 'unavailable' };
  const result = attach(analysis);
  return { ...result, documentationNote: null, documentationStatus: { state: 'unavailable', attempts, reason: 'no-usable-capability-evidence' } };
}
