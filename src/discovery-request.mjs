// Recover search availability without retrying a paid AI request, weakening
// input validation, or presenting keyword results as AI-reviewed matches.
const availabilityCodes = new Set([
  'AI_AUTH', 'AI_KEY_REQUIRED', 'AI_NOT_READY', 'AI_UNAVAILABLE', 'AI_UPSTREAM',
  'AI_RATE_LIMIT', 'AI_BUSY', 'AI_SESSION_LIMIT', 'AI_BUDGET_EXHAUSTED',
  'AI_BUDGET_UNAVAILABLE', 'AI_BUDGET_BUSY',
]);

export const aiUnavailable = error => availabilityCodes.has(error?.code);

export async function discoverWithFallback(request, path, body, { signal } = {}) {
  try { return { data: await request(path, body, { signal }), fallback: false }; }
  catch (error) {
    if (!body?.ai || signal?.aborted || !aiUnavailable(error)) throw error;
    signal?.throwIfAborted();
    const { ai, aiConsent, ...keywordBody } = body;
    return { data: await request(path, keywordBody, { signal }), fallback: true };
  }
}
