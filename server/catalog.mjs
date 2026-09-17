import { fetchDocument, publicUrl } from './safe-fetch.mjs';
import { fail, publicError } from './errors.mjs';
import { plain, relatedTerms, terms } from './text.mjs';
import { knownRetirement } from './lifecycle.mjs';
import { McpIndex } from './catalog-index.mjs';
import { filterIntent } from './search-intent.mjs';
import { mcpLexicalFields, mcpQueryPhrases, mcpQueryWeights } from './mcp-retrieval.mjs';

const API_DIRECTORY = 'https://api.apis.guru/v2/list.json';
const MCP_DIRECTORY = 'https://registry.modelcontextprotocol.io/v0.1/servers';
// These modifiers swamp domain retrieval; retain them when they are the entire
// search, and leave their actual feasibility to the confirmed assessment.
const modifiers = new Set('data service services json xml rest restful http https response responses endpoint endpoints integration integrations platform solution tool tools free paid real time realtime global worldwide'.split(' '));
function link(value) { try { return publicUrl(value).href; } catch { return null; } }
function json(text) {
  try { return JSON.parse(text); } catch { fail('SOURCE_FORMAT', 'The directory returned an unreadable response.', 502); }
}

export function normalizeApis(data, fetchedAt) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('SOURCE_FORMAT', 'Unexpected API directory format.', 502);
  const entries = [];
  for (const [id, product] of Object.entries(data)) {
    const version = product?.preferred;
    const record = product?.versions?.[version];
    if (!record?.info || !version) continue;
    const info = record.info;
    entries.push({
      id: `apis.guru:${id}:${version}`, kind: 'api', provider: plain(info['x-providerName'] || id.split(':')[0], 200),
      name: plain(info.title || id, 200), version: plain(version, 100), product: plain(id, 300),
      description: plain(info.description), categories: (Array.isArray(info['x-apisguru-categories']) ? info['x-apisguru-categories'] : []).map(v => plain(v, 100)),
      specificationUrl: link(record.swaggerUrl), documentationUrl: link(record.externalDocs?.url || info['x-origin']?.[0]?.url || info.contact?.url),
      originUrl: link(info['x-origin']?.[0]?.url),
      availableVersions: Object.keys(product.versions).map(v => plain(v, 100)),
      source: { name: 'APIs.guru', url: API_DIRECTORY, fetchedAt, evidenceLevel: 'directory-metadata' },
      warning: 'A directory listing is a discovery lead, not provider verification or an assessment of your account access.',
    });
  }
  if (!entries.length && Object.keys(data).length) fail('SOURCE_FORMAT', 'No supported API records were found in this directory response.', 502);
  return entries;
}

export function normalizeMcp(data, fetchedAt) {
  if (!Array.isArray(data?.servers)) fail('SOURCE_FORMAT', 'Unexpected MCP Registry format.', 502);
  return data.servers.flatMap(wrapper => {
    const server = wrapper.server;
    const registry = wrapper._meta?.['io.modelcontextprotocol.registry/official'];
    if (!server?.name || ['deleted', 'deprecated'].includes(registry?.status)) return [];
    return [{
      id: `mcp:${server.name}:${server.version}`, kind: 'mcp', provider: plain(server.name.split('/')[0], 200),
      name: plain(server.title || server.name, 200), product: plain(server.name, 300), version: plain(server.version, 100),
      registryLatest: registry?.isLatest === true,
      registryUpdatedAt: typeof registry?.updatedAt === 'string' && Number.isFinite(Date.parse(registry.updatedAt)) ? registry.updatedAt : null,
      description: plain(server.description), documentationUrl: link(server.websiteUrl || server.repository?.url), repositoryUrl: link(server.repository?.url), specificationUrl: null,
      remoteEndpoints: (Array.isArray(server.remotes) ? server.remotes : []).slice(0, 3).flatMap(remote => {
        const url = link(remote.url);
        return url && ['streamable-http', 'sse'].includes(remote.type) && !/[{}]/.test(remote.url) ? [{ type: remote.type, url }] : [];
      }),
      transports: [...new Set([...(server.packages || []).map(p => p.transport?.type), ...(server.remotes || []).map(r => r.type)].filter(v => typeof v === 'string'))].map(v => plain(v, 60)),
      source: { name: 'Official MCP Registry', url: MCP_DIRECTORY, fetchedAt, evidenceLevel: 'registry-metadata' },
      warning: 'Registry metadata is not a safety review or proof of tool capabilities. Nothing has been installed or executed.',
    }];
  });
}

export function collapseMcpVersions(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const key = entry.kind === 'mcp' ? `mcp:${entry.product}` : entry.id;
    const previous = groups.get(key);
    if (!previous) { groups.set(key, { chosen: entry, versions: [entry.version] }); continue; }
    previous.versions.push(entry.version);
    // Prefer the registry's explicit latest flag. Otherwise choose the most
    // recently updated loaded record, not a guessed semantic version ordering.
    if (Number(entry.registryLatest) > Number(previous.chosen.registryLatest)
      || entry.registryLatest === previous.chosen.registryLatest && (Date.parse(entry.registryUpdatedAt) || 0) > (Date.parse(previous.chosen.registryUpdatedAt) || 0)) previous.chosen = entry;
  }
  return [...groups.values()].map(({ chosen, versions }) => chosen.kind === 'mcp' ? { ...chosen, loadedVersions: [...new Set(versions)] } : chosen);
}

export class Catalog {
  constructor({ fetcher = fetchDocument, now = Date.now, indexed = false, indexFile = null, indexOptions = {} } = {}) {
    this.fetcher = fetcher; this.now = now; this.cache = new Map(); this.indexed = indexed;
    this.index = new McpIndex({ fetcher, normalize: normalizeMcp, now, file: indexFile, ...indexOptions });
  }
  async warmIndex() { await this.index.load(); return this.index.start(); }
  close() { this.index.close(); }
  async cached(key, url, normalize) {
    const old = this.cache.get(key);
    if (old && old.expires > this.now()) return old.promise;
    // Cache public metadata only; search queries never leave this process.
    const promise = (async () => {
      const response = await this.fetcher(url, { maxBytes: 32 * 1024 * 1024, timeoutMs: 25000 });
      const data = json(response.text);
      return { entries: normalize(data, response.fetchedAt), fetchedAt: response.fetchedAt, nextCursor: data.metadata?.nextCursor || null };
    })();
    if (this.cache.size >= 40) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, { promise, expires: this.now() + 60 * 60 * 1000 });
    try { return await promise; } catch (error) { this.cache.delete(key); throw error; }
  }
  async mcpBatch(cursor, pages, signal) {
    const entries = new Map(); const visited = new Set(); let pagesLoaded = 0; let fetchedAt;
    while (pagesLoaded < pages) {
      signal?.throwIfAborted(); visited.add(cursor);
      const url = new URL(MCP_DIRECTORY); url.searchParams.set('limit', '100');
      if (cursor) url.searchParams.set('cursor', cursor);
      let page;
      try { page = await this.cached(`mcp:${cursor}`, url.href, normalizeMcp); }
      catch (error) {
        if (!pagesLoaded) throw error;
        const detail = publicError(error);
        return { entries: [...entries.values()], fetchedAt, pagesLoaded, nextCursor: cursor, partial: true, warning: detail.message };
      }
      pagesLoaded++; fetchedAt ||= page.fetchedAt;
      page.entries.forEach(entry => entries.set(entry.id, entry));
      const next = page.nextCursor;
      if (next && (typeof next !== 'string' || next.length > 2000 || visited.has(next))) {
        return { entries: [...entries.values()], fetchedAt, pagesLoaded, nextCursor: null, partial: true, warning: 'The registry returned an invalid or repeated cursor. Pagination stopped; coverage is incomplete.' };
      }
      cursor = next;
      if (!cursor) break;
    }
    return { entries: [...entries.values()], fetchedAt, pagesLoaded, nextCursor: cursor || null };
  }
  async search({ query = '', queries, source = 'all', offset = 0, limit = 20, mcpCursor = '', mcpPages = 1, constraints = [] } = {}, { signal } = {}) {
    if (!Array.isArray(constraints) || constraints.length > 5 || constraints.some(c => !c || !['publisher', 'product'].includes(c.scope) || !['include', 'exclude'].includes(c.mode) || typeof c.name !== 'string' || c.name.length < 2 || c.name.length > 80)) fail('INVALID_SEARCH', 'Use valid product or publisher restrictions.');
    if (typeof query !== 'string' || query.length > 1000 || !['api', 'mcp', 'all'].includes(source) || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100 || typeof mcpCursor !== 'string' || mcpCursor.length > 2000 || !Number.isInteger(mcpPages) || mcpPages < 1 || mcpPages > 3) fail('INVALID_SEARCH', 'Use a short search, valid source, 1–3 registry pages and a page size between 1 and 100.');
    if (queries !== undefined && (!Array.isArray(queries) || !queries.length || queries.length > 3 || queries.some(q => typeof q !== 'string' || q.length > 150 || !terms(q).length))) fail('INVALID_QUERIES', 'Use 1–3 search phrases, each up to 150 characters, with meaningful search words.');
    const searchQueries = queries ? [...new Map(queries.map(q => [q.trim().toLowerCase(), q.trim()])).values()] : [query];
    const domainTerms = searchQueries.map(q => terms(q).filter(term => !modifiers.has(term)));
    const useDomainTerms = queries && domainTerms.some(words => words.length);
    const rankingQueries = useDomainTerms ? domainTerms.map(words => words.join(' ')) : searchQueries;
    signal?.throwIfAborted();
    const jobs = [];
    if (source !== 'mcp') jobs.push(['api', () => this.cached('apis', API_DIRECTORY, normalizeApis)]);
    if (source !== 'api') jobs.push(['mcp', () => this.indexed ? this.index.view({ signal }) : this.mcpBatch(mcpCursor, mcpPages, signal)]);
    const sources = await Promise.all(jobs.map(async ([kind, run]) => {
      try { return { kind, status: 'available', ...await run() }; }
      catch (error) { const detail = publicError(error); return { kind, status: 'unavailable', error: { code: detail.code, message: detail.message }, entries: [] }; }
    }));
    signal?.throwIfAborted();
    const entries = filterIntent(collapseApiAliases(collapseMcpVersions([...new Map(sources.flatMap(s => s.entries).map(entry => [entry.id, entry])).values()])), constraints).filter(entry => !knownRetirement(entry.product, this.now()));
    // In expanded searches, rare domain words should matter more than generic
    // words such as "search" shared by many unrelated products.
    const weights = new Map(rankingQueries.flatMap(q => terms(q)).map(term => [term, 0]));
    if (queries) for (const entry of entries) {
      const vocabulary = new Set(terms(`${entry.name} ${entry.product} ${entry.categories?.join(' ') || ''} ${entry.description}`, { limit: 1000, maxChars: 4000 }));
      for (const term of weights.keys()) if (vocabulary.has(term)) weights.set(term, weights.get(term) + 1);
    }
    for (const [term, count] of weights) weights.set(term, queries ? 1 + Math.log((entries.length + 1) / (count + 1)) : 1);
    const weight = words => words.reduce((sum, word) => sum + (weights.get(word) || 1), 0);
    const mcpPhrases = mcpQueryPhrases(rankingQueries);
    const mcpWeights = mcpQueryWeights(entries.filter(entry => entry.kind === 'mcp'), mcpPhrases, Boolean(queries));
    const matches = entries.map(entry => {
      const mcp = entry.kind === 'mcp';
      const fields = mcp ? mcpLexicalFields(entry) : { title: entry.name, category: `${entry.product} ${entry.categories?.join(' ') || ''}`, description: entry.description };
      const scoreWords = mcp ? words => words.reduce((sum, word) => sum + (mcpWeights.get(word) || 1), 0) : weight;
      const queryMatches = searchQueries.map((phrase, index) => {
        const rankQuery = mcp ? mcpPhrases[index] : rankingQueries[index];
        const titleTerms = relatedTerms(rankQuery, fields.title);
        const categoryTerms = relatedTerms(rankQuery, fields.category);
        const descriptionTerms = relatedTerms(rankQuery, fields.description);
        return { query: phrase, titleTerms, categoryTerms, descriptionTerms, score: scoreWords(titleTerms) * 5 + scoreWords(categoryTerms) * 3 + scoreWords(descriptionTerms) };
      }).filter(match => match.score > 0);
      const collect = key => [...new Set(queryMatches.flatMap(match => match[key]))];
      const titleTerms = collect('titleTerms'); const categoryTerms = collect('categoryTerms'); const descriptionTerms = collect('descriptionTerms');
      return { ...entry, matchedTerms: [...new Set([...titleTerms, ...categoryTerms, ...descriptionTerms])],
        matchedQueries: queryMatches.map(match => match.query),
        relevance: { titleTerms, categoryTerms, descriptionTerms, meaning: 'Word overlap only; not a fit score.' },
        rank: queryMatches.reduce((sum, match) => sum + match.score, 0) };
    }).filter(entry => !queries && !query.trim() || entry.matchedTerms.length)
      .sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      .map(({ rank: _rank, ...entry }) => entry);
    return {
      query, queries: searchQueries, mode: queries ? 'expanded-directory-search' : 'keyword-directory-search', items: matches.slice(offset, offset + limit),
      ignoredModifiers: useDomainTerms ? [...new Set(searchQueries.flatMap(q => terms(q)).filter(term => modifiers.has(term)))] : [],
      pagination: { offset, limit, matchesInLoadedMetadata: matches.length, nextOffset: offset + limit < matches.length ? offset + limit : null, nextMcpCursor: sources.find(s => s.kind === 'mcp')?.nextCursor || null },
      sources: sources.map(({ entries, ...s }) => ({ ...s, loadedRecords: entries.length, knownRetiredExcluded: entries.filter(entry => knownRetirement(entry.product, this.now())).length })),
      coverage: this.indexed ? 'API results cover preferred versions in APIs.guru. MCP results use a bounded, locally cached latest-version registry index; source status discloses incomplete coverage. Not an exhaustive internet search.' : 'API results cover preferred versions in the loaded directory. MCP results cover only the loaded registry pages; follow nextMcpCursor with source=mcp and offset=0 to continue. No fixed category/provider cap. Not an exhaustive internet search.',
      webSearch: 'not-configured', semanticSearch: 'not-configured',
      notice: 'Matched words indicate relevance, not project fit. Queries stay local; only public directory pages are fetched.',
    };
  }
}

export function collapseApiAliases(entries) {
  const groups = new Map();
  for (const item of entries) {
    // A shared homepage/title is insufficient. Require the same original spec,
    // provider, title AND version. Different dated specs remain distinct.
    const key = item.kind === 'api' && item.originUrl ? JSON.stringify([item.provider, item.name, item.version, item.originUrl]) : item.id;
    const previous = groups.get(key);
    if (previous) previous.aliases.push(item.product);
    else groups.set(key, { ...item, aliases: [item.product] });
  }
  return [...groups.values()];
}
