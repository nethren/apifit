import { open, rename, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fail } from './errors.mjs';

// Private text and credentials are never stored here: only cumulative cost units.
export class AiBudget {
  constructor(path) { this.path = path; this.lockPath = `${path}.lock`; }
  async read() {
    try {
      const handle = await open(this.path, constants.O_RDONLY | constants.O_NOFOLLOW);
      let raw;
      try { if ((await handle.stat()).size > 16384) throw new Error(); raw = await handle.readFile('utf8'); } finally { await handle.close(); }
      const value = JSON.parse(raw);
      if (value.version !== 1 || value.limitMicrousd !== 5000000 || !Number.isSafeInteger(value.chargedMicrousd) || value.chargedMicrousd < 0 || typeof value.halted !== 'boolean') throw new Error();
      return value;
    } catch { fail('AI_BUDGET_UNAVAILABLE', 'The AI spending ledger is missing or invalid. AI requests are stopped; it will not be reset automatically.', 503); }
  }
  async transaction(change) {
    let lock;
    try { lock = await open(this.lockPath, 'wx', 0o600); }
    catch { fail('AI_BUDGET_BUSY', 'The spending ledger is locked. Try again; a stale lock needs a local review, not an automatic reset.', 503); }
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      const value = await this.read();
      const result = change(value);
      const file = await open(temporary, 'wx', 0o600);
      try { await file.writeFile(`${JSON.stringify(value)}\n`); await file.sync(); } finally { await file.close(); }
      await rename(temporary, this.path);
      const directory = await open(dirname(this.path), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
      return result;
    } finally { await unlink(temporary).catch(() => {}); await lock.close(); await unlink(this.lockPath); }
  }
  async reserve(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) fail('AI_BUDGET_INVALID', 'Invalid AI request cost.', 503);
    await this.transaction(value => {
      if (value.halted || value.chargedMicrousd + amount > value.limitMicrousd) fail('AI_BUDGET_EXHAUSTED', 'The US$5 development budget cannot cover this request. No AI call was made.', 429);
      value.chargedMicrousd += amount;
    });
    let settled = false;
    return async actual => {
      if (settled) fail('AI_BUDGET_INVALID', 'AI usage was already recorded.', 503);
      settled = true;
      if (!Number.isSafeInteger(actual) || actual < 0) return; // Ambiguous calls keep the whole reservation.
      await this.transaction(value => {
        value.chargedMicrousd += actual - amount;
        if (actual > amount || value.chargedMicrousd > value.limitMicrousd) value.halted = true;
      });
    };
  }
  async status() {
    try { const value = await this.read(); return { available: !value.halted, limitUsd: value.limitMicrousd / 1e6, chargedOrReservedUsd: value.chargedMicrousd / 1e6, remainingUsd: Math.max(0, value.limitMicrousd - value.chargedMicrousd) / 1e6 }; }
    catch { return { available: false, limitUsd: 5, remainingUsd: 0 }; }
  }
}
