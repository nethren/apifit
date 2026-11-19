import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { deflateSync, inflateSync } from 'node:zlib';
import { fail } from './errors.mjs';

const MAX_BYTES = 3 * 1024 * 1024;
export const RECORD_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[2], '-inf', now)
if redis.call('ZCARD', KEYS[2]) >= 20 then
  local oldest = redis.call('ZRANGE', KEYS[2], 0, 0)[1]
  redis.call('ZREM', KEYS[1], oldest)
  redis.call('ZREM', KEYS[2], oldest)
end
if redis.call('ZCARD', KEYS[1]) >= 100 then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('ZADD', KEYS[2], ARGV[2], ARGV[1])
redis.call('EXPIRE', KEYS[1], 900)
redis.call('EXPIRE', KEYS[2], 900)
return 1`;
export const DELETE_RECORD_SCRIPT = `
if redis.call('ZSCORE', KEYS[2], ARGV[1]) then
  redis.call('ZREM', KEYS[1], ARGV[1])
  redis.call('ZREM', KEYS[2], ARGV[1])
end
return 1`;
export const CLEAR_RECORDS_SCRIPT = `
for _, id in ipairs(redis.call('ZRANGE', KEYS[2], 0, -1)) do redis.call('ZREM', KEYS[1], id) end
redis.call('DEL', KEYS[2])
return 1`;
const expired = () => fail('EXPIRED_RECORD', 'This session record has expired. Run the analysis again.', 404);

// Private payloads exist only in request/server/browser memory, never Redis.
// Redis receives UUIDs, owner UUIDs and expirations only. Authenticated encryption
// prevents a browser from fabricating evidence or changing pagination context.
export class SealedStore {
  constructor({ state, key, now = Date.now }) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('APIFIT_RECORD_SECRET must be 32 random bytes encoded as hex.');
    this.state = state; this.key = Buffer.from(key, 'hex'); this.now = now; this.transport = true;
  }
  async put(value, owner) {
    if (!owner) expired();
    const id = randomUUID(); const expires = this.now() + 900000;
    const record = { ...value, id };
    const raw = Buffer.from(JSON.stringify({ owner, expires, record }));
    if (raw.length > MAX_BYTES) fail('RECORD_TOO_LARGE', 'This document is too large for a session record. Try a more specific documentation page.', 413);
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from('apifit-record-v1'));
    const encrypted = Buffer.concat([cipher.update(deflateSync(raw)), cipher.final()]);
    const token = Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
    if (await this.state.eval(RECORD_SCRIPT, ['records', `records:${owner}`], [id, expires]) !== 1) fail('RECORD_CAPACITY', 'This preview is busy. Try again after older results expire.', 429);
    return { ...record, _recordToken: token };
  }
  async get(id, owner, tokens) {
    let data;
    try {
      const token = tokens?.[id];
      if (typeof token !== 'string' || token.length > MAX_BYTES * 1.4 || !/^[\w-]+$/.test(token)) expired();
      const raw = Buffer.from(token, 'base64url'); const decipher = createDecipheriv('aes-256-gcm', this.key, raw.subarray(0, 12));
      decipher.setAAD(Buffer.from('apifit-record-v1')); decipher.setAuthTag(raw.subarray(12, 28));
      const compressed = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]);
      data = JSON.parse(inflateSync(compressed, { maxOutputLength: MAX_BYTES }).toString());
      if (data.owner !== owner || data.record.id !== id || data.expires <= this.now()) expired();
    } catch { expired(); }
    const live = await this.state.command(['ZSCORE', this.state.prefix + `records:${owner}`, id]);
    if (!Number.isFinite(Number(live)) || Number(live) <= this.now()) expired();
    return data.record;
  }
  delete(id, owner) { return this.state.eval(DELETE_RECORD_SCRIPT, ['records', `records:${owner}`], [id]); }
  clear(owner) { return this.state.eval(CLEAR_RECORDS_SCRIPT, ['records', `records:${owner}`]); }
  close() {} // A retiring function must never clear other instances' sessions.
}
