import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createHostedBoundary } from './hosted-boundary.mjs';
import { AppError } from './errors.mjs';
import { LIMIT_SCRIPT, LEASE_SCRIPT, RELEASE_SCRIPT } from './shared-state.mjs';

const COOKIE = '__Host-apifit-session';
const hash = value => createHash('sha256').update(value).digest();
export const SESSION_SCRIPT = `
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', now)
if redis.call('ZCARD', KEYS[1]) >= 200 then return 0 end
redis.call('SET', KEYS[2], '1', 'EX', 900)
redis.call('ZADD', KEYS[1], now + 900000, ARGV[1])
redis.call('EXPIRE', KEYS[1], 900)
return 1`;

export function createDistributedBoundary(hosting, state) {
  // Reuse the same strict deployment-owned origin/access validation.
  createHostedBoundary(hosting).close();
  const origin = new URL(hosting.origin); const admitted = new WeakSet();
  const limited = () => { throw new AppError('RATE_LIMIT', 'Too many requests. Try again in a minute.', 429); };
  const limit = async (key, count, seconds) => {
    if (await state.eval(LIMIT_SCRIPT, [key], [count, seconds]) !== 1) limited();
  };
  return {
    async middleware(req, res, next) {
      try {
        res.set('Strict-Transport-Security', 'max-age=31536000');
        if (req.headers.host !== origin.host) throw new AppError('INVALID_HOST', 'Use the configured APIFit address.', 403);
        if (req.headers.origin && req.headers.origin !== origin.origin || !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== origin.origin || req.headers['sec-fetch-site'] === 'cross-site') throw new AppError('CROSS_ORIGIN', 'Use APIFit from its own website.', 403);
        if (req.method === 'GET' && req.path === '/api/health') return res.json({ status: 'ok' });
        await limit('rate:global', 90, 60);
        if (hosting.accessMode !== 'public') {
          const match = /^Basic ([A-Za-z0-9+/]{1,8192}={0,2})$/i.exec(req.headers.authorization || '');
          if (!timingSafeEqual(hash(match ? Buffer.from(match[1], 'base64') : ''), hash(`apifit:${hosting.accessPassword}`))) {
            res.set('WWW-Authenticate', 'Basic realm="APIFit preview", charset="UTF-8"');
            throw new AppError('AUTH_REQUIRED', 'This APIFit preview requires an access password.', 401);
          }
        }
        const cookies = (req.headers.cookie || '').split(';').map(x => x.trim()).filter(x => x.startsWith(`${COOKIE}=`));
        let id = cookies.length === 1 ? cookies[0].slice(COOKIE.length + 1) : '';
        if (!/^[a-f0-9]{64}$/.test(id) || !await state.get(`session:${id}`)) {
          id = randomBytes(32).toString('hex');
          if (await state.eval(SESSION_SCRIPT, ['sessions', `session:${id}`], [id]) !== 1) throw new AppError('SESSION_CAPACITY', 'This preview is busy. Try again after an inactive session expires.', 503);
          res.set('Set-Cookie', `${COOKIE}=${id}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict`);
        }
        req.sessionId = id;
        await limit(`rate:session:${id}`, 30, 60);
        next();
      } catch (error) { if (error.status === 429) res.set('Retry-After', '60'); next(error); }
    },
    async admitAi(req) {
      if (admitted.has(req)) return;
      if (!await state.get(`session:${req.sessionId}`)) throw new AppError('SESSION_EXPIRED', 'This session has expired. Refresh APIFit before trying again.', 403);
      if (hosting.accessMode === 'public') await limit(`rate:ai:${req.sessionId}`, 10, 900);
      admitted.add(req);
    },
    async acquireJob(req, controller) {
      const id = randomUUID(); const keys = ['jobs', `jobs:${req.sessionId}`];
      if (await state.eval(LEASE_SCRIPT, keys, [id, 4, 2, 305000]) !== 1) throw new AppError('BUSY', 'Discovery is busy. Try again shortly.', 429);
      // Cross-instance session deletion aborts work too. Quota-store failures
      // cancel instead of allowing ungoverned paid work to continue.
      let checking = false;
      const timer = setInterval(async () => {
        if (checking) return; checking = true;
        try { if (!await state.get(`session:${req.sessionId}`)) controller.abort(); }
        catch { controller.abort(); }
        finally { checking = false; }
      }, 5000).unref();
      return async () => { clearInterval(timer); await state.eval(RELEASE_SCRIPT, keys, [id]).catch(() => {}); };
    },
    async clearSession(owner) {
      await state.delete(`session:${owner}`);
      await state.command(['ZREM', state.prefix + 'sessions', owner]);
    },
    close() {},
  };
}
