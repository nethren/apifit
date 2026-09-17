export async function api(path, body, { signal, method } = {}) {
  let response;
  try { response = await fetch(`/api${path}`, { method: method || (body === undefined ? 'GET' : 'POST'), headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal }); }
  catch (error) { if (error.name === 'AbortError') throw error; throw new Error('Could not reach the local backend. Check that APIFit is running, then try again.'); }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message || 'The request could not be completed. Please try again.');
  if (!data) throw new Error('The backend returned an unreadable response. Please retry.');
  return data;
}
export function safeLink(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}
export function host(value) { try { return new URL(value).hostname.replace(/^www\./, ''); } catch { return 'Public documentation'; } }
export const readableDate = value => { const date = new Date(value); return Number.isNaN(date.valueOf()) ? 'Date unavailable' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
