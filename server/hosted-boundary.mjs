import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.mjs';
import { publicUrl } from './safe-fetch.mjs';

const COOKIE = '__Host-apifit-session';
const hash = value => createHash('sha256').update(value).digest();
const SESSION_TTL = 15 * 60 * 1000;

// Public access is an explicit operator choice, not an account/identity system.
// The proxy must preserve Host and terminate HTTPS; forwarded headers are ignored.
export function createHostedBoundary(hosting, { onExpire = () => {}, now = Date.now, maxSessions = 200, sessionRequests = 30, peerRequests = 120 } = {}) {
  let origin;
  try { origin = publicUrl(hosting?.origin); } catch { throw new Error('Hosted mode requires an explicit public HTTPS origin.'); }
  const accessMode = hosting?.accessMode === undefined ? 'password' : hosting.accessMode;
  if (!['public', 'password'].includes(accessMode)) throw new Error('Hosted accessMode must be public or password.');
  if (!hosting || Object.keys(hosting).some(key => !['origin', 'accessPassword', 'accessMode'].includes(key)) || origin.protocol !== 'https:' || origin.origin !== hosting.origin || origin.username || origin.password
    || accessMode === 'password' && (typeof hosting.accessPassword !== 'string' || hosting.accessPassword.length < 32 || hosting.accessPassword.length > 1024 || hosting.accessPassword.trim() !== hosting.accessPassword || /[\u0000-\u001f\u007f]/.test(hosting.accessPassword))) {
    throw new Error('Hosted mode requires an HTTPS origin and a 32–1024 character access password without control characters or surrounding whitespace.');
  }
  const expected = accessMode === 'password' ? hash(`apifit:${hosting.accessPassword}`) : null;
  const sessions = new Map(); const peers = new Map();
  const admittedAiRequests = new WeakSet();
  const expire = id => { sessions.delete(id); onExpire(id); };
  const prune = () => {
    const time = now();
    for (const [id, session] of sessions) if (session.expires <= time) expire(id);
    for (const [ip, counter] of peers) if (counter.until <= time) peers.delete(ip);
  };
  const timer = setInterval(prune, 60000).unref();
  const limited = (res, next) => { res.set('Retry-After', '60'); return next(new AppError('RATE_LIMIT', 'Too many requests. Try again in a minute.', 429)); };
  const chargePeer = req => {
    // This deliberately uses the actual socket peer, NOT spoofable X-Forwarded-For.
    // Behind a proxy this is a shared ceiling; configure tighter limits at ingress.
    const ip = req.socket.remoteAddress || 'unknown'; let counter = peers.get(ip);
    if (!counter) {
      if (peers.size >= 1000) return false;
      counter = { count: 0, until: now() + 60000 }; peers.set(ip, counter);
    }
    return ++counter.count <= peerRequests;
  };
  const middleware = (req, res, next) => {
    res.set('Strict-Transport-Security', 'max-age=31536000');
    if (req.headers.host !== origin.host) return next(new AppError('INVALID_HOST', 'Use the configured APIFit address.', 403));
    const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (req.headers.origin && req.headers.origin !== origin.origin || mutation && req.headers.origin !== origin.origin || req.headers['sec-fetch-site'] === 'cross-site') {
      return next(new AppError('CROSS_ORIGIN', 'Use APIFit from its own website.', 403));
    }
    // Liveness is always minimal and creates no session, even in public mode.
    if (req.method === 'GET' && req.path === '/api/health') return res.json({ status: 'ok' });
    prune();
    if (accessMode === 'password') {
      const authorization = req.headers.authorization || '';
      const match = /^Basic ([A-Za-z0-9+/]{1,8192}={0,2})$/i.exec(authorization);
      const actual = hash(match ? Buffer.from(match[1], 'base64') : '');
      if (!timingSafeEqual(actual, expected)) {
        if (!chargePeer(req)) return limited(res, next);
        res.set('WWW-Authenticate', 'Basic realm="APIFit preview", charset="UTF-8"');
        return next(new AppError('AUTH_REQUIRED', 'This APIFit preview requires an access password.', 401));
      }
    }
    const isApi = req.path.startsWith('/api/');
    if (isApi && !chargePeer(req)) return limited(res, next);
    const cookies = (req.headers.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${COOKIE}=`));
    const candidate = cookies.length === 1 ? cookies[0].slice(COOKIE.length + 1) : '';
    let id = /^[a-f0-9]{64}$/.test(candidate) ? candidate : ''; let session = sessions.get(id);
    if (!session) {
      if (!isApi && !chargePeer(req)) return limited(res, next);
      if (sessions.size >= maxSessions) return next(new AppError('SESSION_CAPACITY', 'This preview is busy. Try again after an inactive session expires.', 503));
      id = randomBytes(32).toString('hex');
      session = { expires: now() + SESSION_TTL, count: 0, until: now() + 60000, aiAttempts: 0 }; sessions.set(id, session);
      res.set('Set-Cookie', `${COOKIE}=${id}; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict`);
    }
    // Absolute expiry keeps browser and server lifetimes aligned, without sessions
    // being held open indefinitely by background polling.
    req.sessionId = id;
    if (isApi) {
      if (session.until <= now()) { session.count = 0; session.until = now() + 60000; }
      if (++session.count > sessionRequests) return limited(res, next);
    }
    return next();
  };
  const admitAi = req => {
    if (accessMode !== 'public' || admittedAiRequests.has(req)) return;
    const session = sessions.get(req.sessionId);
    if (!session || session.expires <= now()) throw new AppError('SESSION_EXPIRED', 'This session has expired. Refresh APIFit before trying again.', 403);
    if (session.aiAttempts >= 10) throw new AppError('AI_SESSION_LIMIT', 'This session has reached its AI request limit. Try again after the 15-minute session expires.', 429);
    session.aiAttempts++; admittedAiRequests.add(req);
    // An anonymous cookie is not a person: this admission cap is supplementary.
    // Resetting cookies does not reset peer/global limits or the durable AI ledger.
  };
  return { middleware, admitAi, close() { clearInterval(timer); for (const id of sessions.keys()) expire(id); peers.clear(); } };
}
