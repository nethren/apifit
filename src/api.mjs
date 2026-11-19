// Sealed serverless records live only in this tab's JS memory. No localStorage,
// sessionStorage, URL/query strings or persistent browser cache.
const records = new Map();
export async function api(path, body, { signal, method } = {}) {
  const id = path.match(/^\/(?:discover|analyses|assessments|build-briefs|records)\/([^/]+)/)?.[1];
  const needed = [...new Set([id, ...(body?.analysisIds || [])].filter(Boolean))];
  const tokens = Object.fromEntries(needed.filter(key => records.has(key)).map(key => [key, records.get(key)]));
  if (Object.keys(tokens).length && method !== 'DELETE') { body = { ...(body || {}), _records: tokens }; method ||= 'POST'; }
  let response;
  try { response = await fetch(`/api${path}`, { method: method || (body === undefined ? 'GET' : 'POST'), headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Could not reach APIFit. Check your connection and try again. Your current shortlist is still in this tab.'); }
  if (response.status === 204) { if (path === '/session') records.clear(); else if (id) records.delete(id); return null; }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error?.message || 'The request could not be completed. Please try again.');
    error.code = typeof data?.error?.code === 'string' ? data.error.code : undefined;
    error.status = response.status;
    throw error;
  }
  if (!data) throw new Error('The backend returned an unreadable response. Please retry.');
  if (typeof data._recordToken === 'string' && typeof data.id === 'string') {
    if (records.size >= 20) records.delete(records.keys().next().value);
    records.set(data.id, data._recordToken); delete data._recordToken;
    const expiry = setTimeout(() => records.delete(data.id), 900000);
    expiry.unref?.();
  }
  return data;
}
export function safeLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function host(value) { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return 'Public documentation'; } }
export const readableDate = value => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
