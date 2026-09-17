import { randomUUID } from 'node:crypto';
import { fail } from './errors.mjs';

// Private analyses/briefs never reach disk. IDs are unguessable, with bounded TTL.
export class MemoryStore {
  constructor({ ttlMs = 15 * 60 * 1000, max = 100, maxPerOwner = 20, now = Date.now } = {}) {
    this.ttlMs = ttlMs; this.max = max; this.maxPerOwner = maxPerOwner; this.now = now; this.items = new Map();
    this.cleanup = setInterval(() => this.prune(), 60000).unref();
  }
  prune() { for (const [key, value] of this.items) if (value.expires <= this.now()) this.items.delete(key); }
  put(value, owner = null) {
    this.prune();
    if (owner !== null) {
      const own = [...this.items].filter(([, record]) => record.owner === owner);
      if (own.length >= this.maxPerOwner) this.items.delete(own[0][0]);
      if (this.items.size >= this.max) fail('RECORD_CAPACITY', 'This preview is busy. Try again after older results expire.', 429);
    } else if (this.items.size >= this.max) this.items.delete(this.items.keys().next().value);
    const id = randomUUID(); this.items.set(id, { owner, value: { ...value, id }, expires: this.now() + this.ttlMs }); return this.get(id, owner);
  }
  get(id, owner = null) { this.prune(); const record = this.items.get(id); if (!record || record.owner !== owner) fail('EXPIRED_RECORD', 'This session record has expired. Run the analysis again.', 404); return structuredClone(record.value); }
  delete(id, owner = null) { if (this.items.get(id)?.owner !== owner) return false; return this.items.delete(id); }
  clear(owner) { if (owner === undefined) this.items.clear(); else for (const [id, record] of this.items) if (record.owner === owner) this.items.delete(id); }
  close() { clearInterval(this.cleanup); this.clear(); }
}
