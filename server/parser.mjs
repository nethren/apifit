import { parseDocument } from 'yaml';
import { load } from 'cheerio';
import { plain, hash, relatedTerms } from './text.mjs';
import { fail } from './errors.mjs';
import { publicUrl } from './safe-fetch.mjs';

const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];
const own = (value, key) => value && typeof value === 'object' && Object.hasOwn(value, key) ? value[key] : undefined;
const pointer = part => part.replace(/~/g, '~0').replace(/\//g, '~1');

export function parseSource({ text, url, fetchedAt, contentType = '', retrievalUrl }, { offset = 0, limit = 100, query = '' } = {}) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > 8 * 1024 * 1024) fail('DOCUMENT_TOO_LARGE', 'The document must be at most 8 MiB.', 413);
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_PAGE', 'Use a valid capability offset and page size between 1 and 100.');
  if (typeof query !== 'string' || query.length > 1000) fail('INVALID_SEARCH', 'Keep the project request under 1,000 characters.');
  const evidence = [];
  const version = hash(text);
  const source = { url, ...(retrievalUrl ? { retrievalUrl } : {}), fetchedAt, contentHash: version, evidenceLevel: 'automatically-parsed-document', providerOwnershipVerified: false };
  const cite = (location, excerpt) => {
    const id = `ev_${hash(`${version}:${location}`).slice(0, 20)}`;
    if (!evidence.some(e => e.id === id)) evidence.push({ id, location, excerpt: plain(excerpt, 1500), source });
    return id;
  };
  const common = { kind: 'analysis', revision: version, source, reviewLevel: 'automatically-parsed', liveTested: false, accountAccess: 'not-checked', evidence, capabilities: [], unknowns: ['Account/key permissions, pricing, quotas, licensing and production suitability have not been verified.'] };
  if (/markdown/.test(contentType) || /\.md(?:$|\?)/i.test(url)) {
    const body = plain(text, 96000);
    if (!body) fail('EMPTY_DOCUMENT', 'This README has no readable documentation.', 422);
    for (let start = 0; start < body.length; start += 1400) cite(`readme:${start}`, body.slice(start, start + 1500));
    return { ...common, format: 'markdown', title: plain(text.match(/^#\s+(.+)$/m)?.[1], 200) || 'Repository documentation', purpose: null,
      coverage: { status: 'text-excerpt-only', charactersRead: body.length, truncated: plain(text, 96001).length > body.length } };
  }
  if (/html/.test(contentType) || /^\s*(?:<!doctype\s+html|<html)/i.test(text)) {
    const $ = load(text);
    const documentationLinks = [];
    // Follow only explicit documentation links, one hop on this exact origin.
    // Never guess endpoints, crawl a site, follow login links or run scripts.
    $('a[href]').slice(0, 500).each((_index, element) => {
      const href = $(element).attr('href'); const label = $(element).text();
      if (!/(?:\b(?:api|mcp|developer|documentation|reference|readme|openapi|swagger)\b|\/docs(?:\/|$))/i.test(`${label} ${href}`)) return;
      try {
        const candidate = publicUrl(new URL(href, url).href);
        if (candidate.origin === new URL(url).origin && candidate.href !== url && !documentationLinks.includes(candidate.href)) documentationLinks.push(candidate.href);
      } catch { /* Unsafe links remain unfetched. */ }
    });
    $('script,style,noscript,iframe,form,nav,footer,header,svg').remove();
    const title = plain($('title').first().text() || $('h1').first().text(), 200);
    const body = plain($('main').text() || $('article').text() || $('body').text(), query ? 96001 : 24000);
    if (!body) fail('EMPTY_DOCUMENT', 'This page has no readable documentation text. It may require JavaScript or login.', 422);
    const excerpt = body.slice(0, query ? 96000 : 6000);
    for (let start = 0; start < excerpt.length; start += 1500) cite(start === 0 ? 'readable-page-excerpt' : `readable-page-excerpt:${start}-${Math.min(start + 1500, excerpt.length)}`, excerpt.slice(start, start + 1500));
    return { ...common, format: 'html', title: title || 'Documentation page', purpose: null, documentExcerpt: excerpt, documentationLinks: documentationLinks.slice(0, 3),
      headings: $('h1,h2,h3').toArray().slice(0, 40).map(e => plain($(e).text(), 200)),
      coverage: { status: 'text-excerpt-only', charactersRead: excerpt.length, truncated: body.length > excerpt.length },
      unknowns: [...common.unknowns, 'The structural reader does not infer capabilities from prose. An optional AI explanation is separate from these parsed results.'] };
  }
  let doc;
  try {
    if (/^\s*[\[{]/.test(text)) doc = JSON.parse(text);
    else {
      const parsed = parseDocument(text, { uniqueKeys: true, strict: true, customTags: [] });
      if (parsed.errors.length || parsed.warnings.length) throw new Error('Unsafe or malformed YAML');
      doc = parsed.toJS({ maxAliasCount: 0 });
    }
  } catch { fail('DOCUMENT_FORMAT', 'Provide valid OpenAPI JSON/YAML. Malformed data, YAML aliases and custom tags are not supported.', 422); }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) fail('DOCUMENT_FORMAT', 'This document is not a supported API specification.', 422);
  const specVersion = String(doc.openapi || doc.swagger || '');
  if (!/^3\.[01]\.\d+(?:[-+].*)?$/.test(specVersion) && specVersion !== '2.0') fail('UNSUPPORTED_SPEC', 'This reader supports OpenAPI 3.0/3.1 and Swagger 2.0. Other formats remain unassessed.', 422);
  if (!doc.info || typeof doc.info !== 'object' || !doc.paths || typeof doc.paths !== 'object' || Array.isArray(doc.paths)) fail('DOCUMENT_FORMAT', 'The specification needs an info object and a paths object.', 422);
  const warnings = new Set();
  const resolve = (value, visited = new Set()) => {
    if (!value || typeof value !== 'object') return {};
    if (!value.$ref) return value;
    const ref = value.$ref;
    if (typeof ref !== 'string' || !ref.startsWith('#/')) { warnings.add('External or non-pointer references were not followed.'); return {}; }
    if (visited.has(ref) || visited.size >= 10) { warnings.add('Cyclic or deeply nested references were not fully expanded.'); return {}; }
    let target = doc;
    for (const part of ref.slice(2).split('/')) target = own(target, part.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (!target) { warnings.add('Unresolved local references may hide inputs or outputs.'); return {}; }
    return resolve(target, new Set([...visited, ref]));
  };
  const fields = (schema, prefix = '', depth = 0, result = []) => {
    if (depth > 4 || result.length >= 30) { warnings.add('Some response/input schemas exceed the field expansion limit.'); return result; }
    const resolved = resolve(schema);
    if (resolved.allOf || resolved.oneOf || resolved.anyOf) warnings.add('Composed schemas are not fully expanded; branch-specific fields remain unknown.');
    if (resolved.type === 'array' || resolved.items) return fields(resolved.items, `${prefix}[]`, depth + 1, result);
    for (const [name, raw] of Object.entries(resolved.properties || {})) {
      if (result.length >= 30) { warnings.add('Some response/input schemas exceed the field expansion limit.'); break; }
      const item = resolve(raw);
      if (item.allOf || item.oneOf || item.anyOf) warnings.add('Composed schemas are not fully expanded; branch-specific fields remain unknown.');
      const path = prefix ? `${prefix}.${name}` : name;
      result.push({ name: plain(path, 200), type: plain(Array.isArray(item.type) ? item.type.join(' | ') : item.type, 100) || 'unspecified', description: plain(item.description, 300), required: Array.isArray(resolved.required) && resolved.required.includes(name) });
      if (item.properties || item.items) fields(item, path, depth + 1, result);
    }
    return result;
  };
  const all = [];
  for (const [path, raw] of Object.entries(doc.paths)) {
    if (!path.startsWith('/')) continue;
    const item = resolve(raw);
    for (const method of methods) if (item[method] && typeof item[method] === 'object') all.push({ path, method, item, operation: item[method] });
  }
  if (Object.keys(doc.webhooks || {}).length) warnings.add('Webhook definitions are not part of this operations summary.');
  // Select relevant operations before expansion, rather than assuming the
  // first page contains the features a project needs. No external refs fetched.
  if (query) {
    for (const entry of all) entry.relevance = relatedTerms(query, `${entry.path} ${plain(JSON.stringify(entry.operation), 4000)}`).length;
    all.sort((a, b) => b.relevance - a.relevance);
  }
  const capabilities = all.slice(offset, offset + limit).map(({ path, method, item, operation }) => {
    const location = `#/paths/${pointer(path)}/${method}`;
    const title = plain(operation.summary || operation.operationId, 200) || `${method.toUpperCase()} ${plain(path, 180)}`;
    const description = plain(operation.description);
    const security = Object.hasOwn(operation, 'security') ? operation.security : doc.security;
    const requirements = Array.isArray(security) ? security.map(group => Object.entries(group).map(([name, scopes]) => ({ scheme: plain(name, 100), scopes: Array.isArray(scopes) ? scopes.map(s => plain(s, 200)) : [] }))) : null;
    const parameterMap = new Map();
    for (const raw of [...(Array.isArray(item.parameters) ? item.parameters : []), ...(Array.isArray(operation.parameters) ? operation.parameters : [])]) {
      const p = resolve(raw); if (p.name && p.in) parameterMap.set(`${p.in}:${p.name}`, p);
    }
    const inputs = [...parameterMap.values()].slice(0, 50).map(p => ({ name: plain(p.name, 100), location: plain(p.in, 50), required: p.required === true || p.in === 'path', description: plain(p.description, 400), type: plain(resolve(p.schema).type || p.type, 100) || 'unspecified' }));
    if (parameterMap.size > 50) warnings.add('Some operations exceed the displayed input limit.');
    const body = resolve(operation.requestBody);
    const bodyContent = Object.values(body.content || {})[0];
    const responses = Object.entries(operation.responses || {}).slice(0, 20).map(([status, raw]) => {
      const response = resolve(raw);
      const content = Object.values(response.content || {})[0];
      return { status: plain(status, 20), description: plain(response.description, 400), fields: fields(content?.schema || response.schema) };
    });
    if (Object.keys(body.content || {}).length > 1 || Object.values(operation.responses || {}).some(r => Object.keys(r?.content || {}).length > 1)) warnings.add('Only the first documented media type is expanded per input/response.');
    if (Object.keys(operation.responses || {}).length > 20) warnings.add('Some operations exceed the displayed response limit.');
    if (operation.callbacks) warnings.add('Callback operations are not expanded.');
    const evidenceId = cite(location, `${method.toUpperCase()} ${path} — ${title}. ${description}`);
    const capability = { id: `cap_${hash(`${version}:${location}`).slice(0, 20)}`, title, description, method: method.toUpperCase(), path: plain(path, 1000),
      group: plain(operation.tags?.[0], 100) || 'General', inputs,
      requestBody: operation.requestBody ? { required: body.required === true, fields: fields(bodyContent?.schema) } : null,
      responses, authentication: { status: requirements === null ? 'not-declared' : !requirements.length || requirements.some(g => !g.length) ? 'no-auth-option-documented' : 'required-in-spec', alternatives: requirements },
      deprecated: operation.deprecated === true, evidenceIds: [evidenceId], executable: false };
    const detail = JSON.stringify({ operation: `${capability.method} ${capability.path}`, inputs, requestBody: capability.requestBody, responses, authentication: capability.authentication, deprecated: capability.deprecated });
    // Derived excerpts retain the operation pointer. No external references or
    // undocumented claims are introduced; bounded chunks are individually citable.
    if (detail.length > 18000) warnings.add('Some operation detail excerpts were shortened; omitted details remain unassessed.');
    for (let start = 0; start < Math.min(detail.length, 18000); start += 1400) capability.evidenceIds.push(cite(`${location}/parsed-detail:${start}`, detail.slice(start, start + 1400)));
    return capability;
  });
  const title = plain(doc.info.title, 200) || 'Untitled API';
  const purpose = plain(doc.info.description) || null;
  cite('#/info', `${title}. ${purpose || 'No purpose description supplied.'}`);
  const partial = offset > 0 || offset + limit < all.length || warnings.size > 0;
  return { ...common, format: specVersion === '2.0' ? 'swagger' : 'openapi', specVersion, title, purpose, apiVersion: plain(doc.info.version, 100), capabilities,
    coverage: { status: partial ? 'partial' : 'operations-parsed', selection: query ? 'project-word-overlap' : 'document-order', totalOperations: all.length, returnedOperations: capabilities.length, offset, limit, nextOffset: offset + limit < all.length ? offset + limit : null },
    unknowns: [...common.unknowns, ...warnings],
    interpretation: 'Titles and descriptions are taken from the specification; they are not an AI-written plain-language explanation. No operation has been called.',
  };
}
