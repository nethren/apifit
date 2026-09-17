import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const DIRECTORY = 'https://registry.modelcontextprotocol.io/v0.1/servers';
// Public metadata only. Never store a request, a query-selected excerpt or a key.
export class McpIndex {
  constructor({ fetcher, normalize, now = Date.now, file = null, maxPages = 400, maxRecords = 40000, ttlMs = 3600000 } = {}) {
    Object.assign(this, { fetcher, normalize, now, file, maxPages, maxRecords, ttlMs });
    this.entries = new Map(); this.pages = 0; this.complete = false; this.updatedAt = 0; this.lastAttempt = 0; this.stopped = false;
    this.controller = new AbortController();
  }
  async load() {
    if (!this.file) return;
    try {
      const raw = await readFile(this.file, 'utf8');
      if (Buffer.byteLength(raw) > 48 * 1024 * 1024) return;
      const data = JSON.parse(raw);
      if (data.version !== 1 || !Number.isFinite(data.updatedAt) || data.updatedAt > this.now() || !Array.isArray(data.entries) || data.entries.length > this.maxRecords) return;
      if (data.entries.some(e => e.kind !== 'mcp' || typeof e.id !== 'string' || typeof e.product !== 'string' || typeof e.name !== 'string' || typeof e.description !== 'string')) return;
      this.entries = new Map(data.entries.map(e => [e.id, e])); this.updatedAt = data.updatedAt;
      this.complete = data.complete === true; this.pages = data.pages || 0;
      if (!this.complete) this.warning = 'The cached registry index is incomplete; an absent result is not proof an integration does not exist.';
    } catch { /* Missing/invalid local cache: refresh through the safe boundary. */ }
  }
  start() {
    if (this.stopped) return Promise.resolve();
    if (this.running) return this.running;
    if (this.updatedAt && this.now() - this.updatedAt < this.ttlMs || this.lastAttempt && this.now() - this.lastAttempt < 60000) return Promise.resolve();
    this.running = this.refresh().finally(() => { this.running = null; });
    return this.running;
  }
  async refresh() {
    const nextEntries = new Map(); const visited = new Set(); let cursor = ''; let pages = 0; let complete = false;
    const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(360000)]);
    this.warning = null;
    try {
      while (pages < this.maxPages && nextEntries.size < this.maxRecords) {
        signal.throwIfAborted(); visited.add(cursor);
        const url = new URL(DIRECTORY); url.searchParams.set('limit', '100'); url.searchParams.set('version', 'latest');
        if (cursor) url.searchParams.set('cursor', cursor);
        const response = await this.fetcher(url.href, { signal, maxBytes: 2 * 1024 * 1024, timeoutMs: 15000 });
        const data = JSON.parse(response.text);
        for (const entry of this.normalize(data, response.fetchedAt)) if (nextEntries.size < this.maxRecords) nextEntries.set(entry.id, entry);
        pages++;
        const next = data.metadata?.nextCursor;
        if (!next) { complete = true; break; }
        if (typeof next !== 'string' || next.length > 2000 || visited.has(next)) throw new Error('Invalid cursor');
        cursor = next;
        // First-time searches can use progressively loaded public metadata.
        // On refresh, retain the old snapshot until the replacement is complete.
        if (!this.updatedAt) { this.entries = new Map(nextEntries); this.pages = pages; }
      }
    } catch {
      this.warning = 'The registry refresh stopped early; coverage is incomplete.';
    }
    if (this.stopped) return;
    // Do not erase a previously broader index after a transient refresh failure.
    if (complete || nextEntries.size >= this.entries.size) {
      this.entries = nextEntries; this.complete = complete; this.pages = pages;
      this.updatedAt = this.now();
    }
    this.lastAttempt = this.now();
    if (!complete) this.warning ||= 'Registry coverage is bounded and incomplete; an absent result is not proof an integration does not exist.';
    if (this.file && this.entries.size) {
      const temporary = `${this.file}.next`;
      try {
        await mkdir(dirname(this.file), { recursive: true });
        await writeFile(temporary, JSON.stringify({ version: 1, updatedAt: this.updatedAt, complete: this.complete, pages: this.pages, entries: [...this.entries.values()] }), { mode: 0o600 });
        await rename(temporary, this.file);
      } catch { /* Disk cache is optional; keep serving the in-memory index. */ }
    }
  }
  async view({ signal, waitMs = 800 } = {}) {
    signal?.throwIfAborted();
    const running = this.start();
    if (!this.entries.size) {
      let timer; let abort;
      try {
        await Promise.race([running, new Promise(resolve => { timer = setTimeout(resolve, waitMs); }), new Promise((_, reject) => {
          abort = () => reject(signal.reason); signal?.addEventListener('abort', abort, { once: true });
        })]);
      } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
    }
    signal?.throwIfAborted();
    return { entries: [...this.entries.values()], indexed: true, pagesLoaded: this.pages, partial: !this.complete || Boolean(this.warning),
      stale: Boolean(this.updatedAt && this.now() - this.updatedAt >= this.ttlMs),
      refreshing: Boolean(this.running), fetchedAt: this.updatedAt ? new Date(this.updatedAt).toISOString() : null,
      warning: this.warning || (!this.complete ? 'The public registry index is still loading. Search again shortly for broader coverage.' : null), nextCursor: null };
  }
  close() { this.stopped = true; this.controller.abort(); }
}
