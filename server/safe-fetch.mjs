import https from 'node:https';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { AppError, fail } from './errors.mjs';

const sensitive = /(?:key|token|secret|signature|credential|password|authorization|^sig$)/i;
export function publicUrl(input) {
  if (typeof input !== 'string' || input.length > 4096) fail('INVALID_URL', 'Supply a public HTTPS documentation URL.');
  let url;
  try { url = new URL(input); } catch { fail('INVALID_URL', 'Supply a complete public HTTPS URL.'); }
  if (url.protocol !== 'https:' || (url.port && url.port !== '443')) fail('UNSAFE_URL', 'Only public HTTPS on the standard port is supported.');
  if (url.username || url.password || [...url.searchParams.keys()].some(k => sensitive.test(k))) fail('CREDENTIAL_URL', 'Do not include credentials or signed access links.');
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host.includes('.') || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion)$/.test(host) || host === 'metadata.google.internal') fail('UNSAFE_URL', 'Local and private destinations are not permitted.');
  if (isIP(host) && !isPublicAddress(host)) fail('UNSAFE_ADDRESS', 'Local, private and special-use addresses are not permitted.');
  url.hash = '';
  return url;
}

export function isPublicAddress(address) {
  try {
    const value = ipaddr.parse(address);
    // Deliberately conservative initial support: no IPv6/transition addresses.
    return value.kind() === 'ipv4' && value.range() === 'unicast';
  } catch { return false; }
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new AppError('FETCH_TIMEOUT', 'The document request was cancelled or exceeded its time limit.', 504));
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export async function resolvePublic(url, resolver = lookup) {
  const hostname = url.hostname.replace(/\.$/, '');
  let records;
  try { records = isIP(hostname) ? [{ address: hostname, family: 4 }] : await resolver(hostname, { all: true, family: 4 }); }
  catch { fail('DNS_UNAVAILABLE', 'The public documentation host could not be resolved.', 502); }
  if (!records?.length || records.some(r => r.family !== 4 || !isPublicAddress(r.address))) fail('UNSAFE_ADDRESS', 'The host does not resolve exclusively to supported public addresses.');
  return records[0];
}

export function pinnedLookup(record) {
  return (_host, options, callback) => {
    if (options?.all) callback(null, [record]);
    else callback(null, record.address, record.family);
  };
}

// The only POST bodies allowed at the public-network boundary are MCP
// negotiation and tool-description listing. Never accept a tool name/arguments.
export function validateMetadataRequest(mcp) {
  const { rpc, sessionId, protocolVersion } = mcp || {};
  if (!rpc || rpc.jsonrpc !== '2.0' || !['initialize', 'notifications/initialized', 'tools/list'].includes(rpc.method)
    || Object.keys(rpc).some(key => !['jsonrpc', 'id', 'method', 'params'].includes(key))) fail('MCP_METHOD_BLOCKED', 'Only MCP capability inspection is permitted.');
  const params = rpc.params || {};
  if (!params || typeof params !== 'object' || Array.isArray(params)) fail('MCP_METHOD_BLOCKED', 'Invalid inspection request.');
  if (rpc.method === 'initialize' && (JSON.stringify(params.capabilities) !== '{}' || params.protocolVersion !== '2025-11-25'
    || JSON.stringify(params.clientInfo) !== JSON.stringify({ name: 'APIFit', version: '0.2.0' })
    || Object.keys(params).some(key => !['protocolVersion', 'capabilities', 'clientInfo'].includes(key)))) fail('MCP_METHOD_BLOCKED', 'Invalid negotiation request.');
  if (rpc.method === 'notifications/initialized' ? rpc.id !== undefined || Object.keys(params).length : !Number.isSafeInteger(rpc.id)) fail('MCP_METHOD_BLOCKED', 'Invalid inspection request.');
  if (rpc.method === 'tools/list' && (Object.keys(params).some(key => key !== 'cursor') || params.cursor !== undefined && (typeof params.cursor !== 'string' || params.cursor.length > 2048))) fail('MCP_METHOD_BLOCKED', 'Invalid listing request.');
  if (sessionId !== undefined && (typeof sessionId !== 'string' || !/^[\x21-\x7e]{1,1024}$/.test(sessionId))) fail('MCP_FORMAT', 'Invalid MCP session response.', 422);
  if (protocolVersion !== undefined && !['2025-11-25', '2025-06-18', '2025-03-26'].includes(protocolVersion)) fail('MCP_VERSION', 'This MCP connection version is not supported.', 422);
}

export function metadataEvent(text, id) {
  for (const event of text.split(/\r?\n\r?\n/).slice(0, -1)) {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
    if (!data) continue;
    try { const message = JSON.parse(data); if (message.jsonrpc === '2.0' && message.id === id && !message.method) return message; } catch { /* Ignore non-JSON events, never execute server messages. */ }
  }
  return null;
}

export function requestPinned(url, record, { signal, maxBytes, request = https.request, mcp }) {
  if (mcp) validateMetadataRequest(mcp);
  const body = mcp ? JSON.stringify(mcp.rpc) : undefined;
  return new Promise((resolve, reject) => {
    // Original hostname remains the TLS identity. Only DNS is replaced, and no
    // pooled socket or proxy is used. Redirects return to the validation layer.
    const req = request(url, {
      method: mcp ? 'POST' : 'GET', agent: false, family: 4, lookup: pinnedLookup(record), signal,
      maxHeaderSize: 16384,
      headers: { 'User-Agent': 'APIFit-local/0.1 documentation-reader', Accept: mcp ? 'application/json, text/event-stream' : 'application/json, application/yaml, text/yaml, text/html, text/plain', 'Accept-Encoding': 'identity',
        ...(mcp ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...(mcp.sessionId ? { 'MCP-Session-Id': mcp.sessionId } : {}), ...(mcp.protocolVersion ? { 'MCP-Protocol-Version': mcp.protocolVersion } : {}) } : {}) },
    }, res => {
      const status = res.statusCode || 502;
      if ([301, 302, 303, 307, 308].includes(status)) {
        res.destroy(); resolve({ status, location: res.headers.location }); return;
      }
      if (status < 200 || status >= 300) {
        if (mcp && [401, 403].includes(status)) { res.destroy(); reject(new AppError('MCP_AUTH_REQUIRED', 'This MCP server requires access that APIFit does not have.', 422)); return; }
        res.destroy(); reject(new AppError('UPSTREAM_STATUS', `The documentation source returned HTTP ${status}.`, 502)); return;
      }
      if (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity') {
        res.destroy(); reject(new AppError('ENCODING_UNSUPPORTED', 'Compressed source responses are not supported by this reader.', 415)); return;
      }
      const declared = Number(res.headers['content-length'] || 0);
      if (declared > maxBytes) { res.destroy(); reject(new AppError('DOCUMENT_TOO_LARGE', 'The document exceeds the download limit.', 413)); return; }
      const chunks = []; let size = 0;
      const metadata = mcp ? { sessionId: res.headers['mcp-session-id'] } : {};
      if (mcp && mcp.rpc.id === undefined) { res.destroy(); resolve({ status, text: '', ...metadata }); return; }
      res.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(); reject(new AppError('DOCUMENT_TOO_LARGE', 'The document exceeds the download limit.', 413)); }
        else {
          chunks.push(chunk);
          if (mcp && String(res.headers['content-type']).includes('text/event-stream')) {
            const message = metadataEvent(Buffer.concat(chunks).toString('utf8'), mcp.rpc.id);
            if (message) { resolve({ status, text: JSON.stringify(message), bytes: size, contentType: 'application/json', ...metadata }); res.destroy(); }
          }
        }
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status, text: Buffer.concat(chunks).toString('utf8'), bytes: size, contentType: String(res.headers['content-type'] || '').split(';')[0], ...metadata }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

export async function fetchDocument(input, options = {}) {
  return fetchPublic(input, options);
}

export async function fetchMcpMetadata(input, mcp, options = {}) {
  validateMetadataRequest(mcp);
  return fetchPublic(input, { ...options, maxBytes: Math.min(options.maxBytes || 1024 * 1024, 1024 * 1024), timeoutMs: Math.min(options.timeoutMs || 12000, 12000) }, mcp);
}

async function fetchPublic(input, options = {}, mcp) {
  const { resolver = lookup, transport = requestPinned, maxBytes = 8 * 1024 * 1024, timeoutMs = 15000, signal: external } = options;
  const timer = AbortSignal.timeout(timeoutMs);
  const signal = external ? AbortSignal.any([external, timer]) : timer;
  let url = publicUrl(input);
  try {
    for (let hops = 0; hops <= 3; hops++) {
      const record = await abortable(resolvePublic(url, resolver), signal);
      const result = await abortable(transport(url, record, { signal, maxBytes, ...(mcp ? { mcp } : {}) }), signal);
      // Never replay session headers or POST bodies to a redirect destination.
      if (mcp && (result.location || [301, 302, 303, 307, 308].includes(result.status))) fail('MCP_REDIRECT', 'This MCP connection redirects; its capabilities could not be inspected safely.', 422);
      if ([301, 302, 303, 307, 308].includes(result.status) && !result.location) fail('INVALID_REDIRECT', 'The source returned a redirect without a destination.', 502);
      if (result.location) { url = publicUrl(new URL(result.location, url).href); continue; }
      return { ...result, url: url.href, fetchedAt: new Date().toISOString() };
    }
    fail('TOO_MANY_REDIRECTS', 'The source has too many redirects.', 502);
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (signal.aborted) fail('FETCH_TIMEOUT', 'The document request was cancelled or exceeded its time limit.', 504);
    fail('FETCH_UNAVAILABLE', 'The public document could not be retrieved. It may require login or be unavailable.', 502);
  }
}
