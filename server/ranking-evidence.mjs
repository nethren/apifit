import { readIntegration } from './integration-docs.mjs';
import { explanationContext } from './goal-explanation.mjs';
import { publicUrl } from './safe-fetch.mjs';
import { relatedTerms } from './text.mjs';

export function selectRankingEvidence(analysis, query) {
  if (!analysis.capabilities?.length) return analysis.evidence;
  // Do not let repeated parameter/error text crowd out what an operation does.
  // Select two distinct action descriptions, then one detail from those actions.
  const capabilities = analysis.capabilities.filter(c => !c.deprecated).map((c, order) => ({ c, order, score: relatedTerms(query, `${c.title} ${c.description}`).length }))
    .sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 2).map(x => x.c);
  const byId = new Map(analysis.evidence.map(e => [e.id, e]));
  const primary = capabilities.map(c => byId.get(c.evidenceIds[0])).filter(Boolean);
  const details = capabilities.flatMap(c => c.evidenceIds.slice(1).map(id => byId.get(id))).filter(Boolean)
    .sort((a, b) => relatedTerms(query, b.excerpt).length - relatedTerms(query, a.excerpt).length).slice(0, 1);
  return [...primary, ...details];
}

function waitFor(promise, signal) {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

export class PublicDocumentCache {
  constructor({ fetcher, now = Date.now, ttlMs = 3600000, maxEntries = 48, maxBytes = 48 * 1024 * 1024 } = {}) {
    Object.assign(this, { fetcher, now, ttlMs, maxEntries, maxBytes }); this.cache = new Map(); this.bytes = 0;
    this.controller = new AbortController();
  }
  delete(key) { this.bytes -= this.cache.get(key)?.bytes || 0; this.cache.delete(key); }
  get(url, { signal } = {}) {
    const key = publicUrl(url).href; signal?.throwIfAborted();
    const previous = this.cache.get(key);
    if (previous && previous.expires > this.now()) return waitFor(previous.promise, signal);
    if (previous) this.delete(key);
    while (this.cache.size >= this.maxEntries) this.delete(this.cache.keys().next().value);
    const entry = { bytes: 0, expires: this.now() + this.ttlMs };
    // Coalesced retrieval has its own deadline: one cancelled request cannot
    // cancel another reader. Only public document URLs/content are cached.
    entry.promise = Promise.resolve().then(() => this.fetcher(key, { signal: this.controller.signal, timeoutMs: 6500, maxBytes: 12 * 1024 * 1024 })).then(source => {
      const bytes = Buffer.byteLength(source.text);
      if (this.cache.get(key) === entry) {
        if (bytes > this.maxBytes) this.delete(key);
        else {
          entry.bytes = bytes; this.bytes += bytes;
          while (this.bytes > this.maxBytes && this.cache.size) this.delete(this.cache.keys().next().value);
        }
      }
      return source;
    }).catch(error => { entry.expires = this.now() + 60000; throw error; });
    this.cache.set(key, entry);
    return waitFor(entry.promise, signal);
  }
  close() { this.controller.abort(); this.cache.clear(); this.bytes = 0; }
}

export class RankingEvidence {
  constructor({ fetcher, parser, cache = new PublicDocumentCache({ fetcher }), maxCandidates = 12, timeoutMs = 7500 } = {}) {
    Object.assign(this, { parser, cache, maxCandidates, timeoutMs });
  }
  async enrich(items, query, { signal: external, searchQueries } = {}) {
    external?.throwIfAborted();
    const selectionQuery = searchQueries?.length ? searchQueries.join(' ') : query;
    const signal = external ? AbortSignal.any([external, AbortSignal.timeout(this.timeoutMs)]) : AbortSignal.timeout(this.timeoutMs);
    const result = items.map(item => ({ ...item, rankingEvidence: { status: 'not-read', excerpts: [] } }));
    let cursor = 0;
    const worker = async () => {
      while (cursor < Math.min(items.length, this.maxCandidates) && !signal.aborted) {
        const index = cursor++; const item = items[index]; let requests = 0;
        try {
          // Never enumerate/invoke MCP tools during search. On-demand explanation
          // has its own flow; ranking uses public specs/READMEs/pages only.
          const selection = { ...item, remoteEndpoints: [] };
          const analysis = await readIntegration(selection, selectionQuery, { parser: this.parser, signal, inspector: async () => { throw new Error('Disabled during discovery'); }, fetcher: (url, options) => {
            if (++requests > 2) throw new Error('Ranking source limit');
            return this.cache.get(url, options);
          } });
          if (analysis.documentationStatus.state !== 'available') { result[index].rankingEvidence.status = 'unavailable'; continue; }
          // Trim before selecting so one long excerpt does not crowd out all
          // useful operation titles. These remain verbatim source fragments.
          const context = explanationContext({ ...analysis, evidence: selectRankingEvidence(analysis, selectionQuery).map(e => ({ ...e, excerpt: e.excerpt.slice(0, 650) })) }, selectionQuery, { maxBytes: 1900, maxExcerpts: 3 });
          result[index].rankingEvidence = { status: 'documentation-read', documentTitle: analysis.title, source: analysis.source, excerpts: context.evidence,
            coverage: analysis.coverage, warning: 'Selected excerpts only; documentation claims are not a live test or reliability check.' };
        } catch { external?.throwIfAborted(); result[index].rankingEvidence.status = signal.aborted ? 'deadline' : 'unavailable'; }
      }
    };
    await Promise.all([worker(), worker(), worker()]); external?.throwIfAborted();
    return result;
  }
  close() { this.cache.close(); }
}
