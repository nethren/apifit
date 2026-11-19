import { AppError } from './errors.mjs';

// Operator-owned endpoint only. This is not a user-supplied document URL.
export class RedisState {
  constructor({ url, token, fetcher = fetch, prefix = '{apifit}:' } = {}) {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/.test(parsed.hostname) || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash || parsed.username || parsed.password
      || typeof token !== 'string' || !token || /\s/.test(token)) throw new Error('Configure a valid Upstash REST endpoint and runtime token.');
    this.url = parsed.origin; this.token = token; this.fetcher = fetcher; this.prefix = prefix;
  }
  async command(command) {
    try {
      const response = await this.fetcher(this.url, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(command), signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (data.error || !Object.hasOwn(data, 'result')) throw new Error();
      return data.result;
    } catch { throw new AppError('SHARED_STATE_UNAVAILABLE', 'The shared safety store is unavailable. Please try again shortly.', 503); }
  }
  eval(script, keys = [], args = []) { return this.command(['EVAL', script, keys.length, ...keys.map(key => this.prefix + key), ...args.map(String)]); }
  get(key) { return this.command(['GET', this.prefix + key]); }
  setNew(key, value, ttl) { return this.command(['SET', this.prefix + key, value, 'NX', ...(ttl ? ['EX', ttl] : [])]); }
  delete(key) { return this.command(['DEL', this.prefix + key]); }
}

export const LIMIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[2]) end
return count <= tonumber(ARGV[1]) and 1 or 0`;

export const LEASE_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
for _, key in ipairs(KEYS) do redis.call('ZREMRANGEBYSCORE', key, '-inf', now) end
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[2]) or redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[3]) then return 0 end
for _, key in ipairs(KEYS) do
  redis.call('ZADD', key, now + tonumber(ARGV[4]), ARGV[1])
  redis.call('PEXPIRE', key, ARGV[4])
end
return 1`;

export const RELEASE_SCRIPT = `
for _, key in ipairs(KEYS) do redis.call('ZREM', key, ARGV[1]) end
return 1`;
