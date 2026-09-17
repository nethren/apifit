import { AI_CONFIG } from './ai-config.mjs';
import { SYSTEM, CITATION_RULES, TASKS, taskSchema } from './ai-prompts.mjs';
import { fail } from './errors.mjs';

const HOST = 'https://api.anthropic.com';
// Reject rather than trying to silently redact a sensitive project request.
export function assertNoSecrets(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/sk-ant-[A-Za-z0-9_-]{12,}|sk-[A-Za-z0-9_-]{24,}|(?:ghp_|github_pat_|xox[baprs]-)[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+[A-Za-z0-9._~+\/-]{12,}|\bAKIA[A-Z0-9]{16}\b|[?&](?:api_?key|access_?token|secret|password)=\S+/i.test(text)
    || /(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret|password)["'\\\s]*[:=]["'\\\s]*[A-Za-z0-9_./+~-]{16,}/i.test(text)) {
    fail('AI_SENSITIVE_INPUT', 'This input appears to contain credentials. Remove them before using AI. Nothing was sent.', 422);
  }
}
async function boundedJson(response) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => {});
    fail(response.status === 401 || response.status === 403 ? 'AI_AUTH' : response.status === 429 ? 'AI_RATE_LIMIT' : 'AI_UPSTREAM',
      response.status === 401 || response.status === 403 ? 'Anthropic rejected the credential or account access. The operator should check the server credential and provider account.' : 'The AI provider could not complete this request. No result was fabricated and no automatic retry was made.', 502);
  }
  const reader = response.body?.getReader();
  if (!reader) fail('AI_RESPONSE', 'The AI provider returned no readable response.', 502);
  let size = 0; const chunks = [];
  try {
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 262144) fail('AI_RESPONSE', 'The AI response exceeded the safe size limit.', 502); chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) { await reader.cancel().catch(() => {}); if (error.code === 'AI_RESPONSE') throw error; fail('AI_RESPONSE', 'The AI provider returned an unreadable response.', 502); }
}

export class ClaudeClient {
  constructor({ budget, keyProvider, fetcher = fetch, onUsage = () => {} }) { this.budget = budget; this.keyProvider = keyProvider; this.fetcher = fetcher; this.onUsage = onUsage; this.busy = false; }
  async run(taskName, data, { signal } = {}) {
    const task = TASKS[taskName];
    if (!task) fail('AI_TASK', 'That AI task is not supported.');
    if (this.busy) fail('AI_BUSY', 'An AI request is already running. Try again after it finishes.', 429);
    assertNoSecrets(data);
    const content = JSON.stringify({ task: taskName, untrustedData: data });
    if (Buffer.byteLength(content) > AI_CONFIG.maxPayloadBytes) fail('AI_CONTEXT_LIMIT', 'This evidence set is too large. Use fewer requirements or a more specific documentation page.', 422);
    if (signal?.aborted) fail('AI_CANCELLED', 'AI request cancelled.', 499);
    this.busy = true;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, AI_CONFIG.timeoutMs);
    try {
      const key = await this.keyProvider();
      const headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
      const base = { model: AI_CONFIG.model, system: `${SYSTEM}\n${['request', 'searchQueries', 'searchPlan', 'rank', 'rankEvidence', 'summary', 'handoff'].includes(taskName) ? '' : CITATION_RULES}\n\nTASK:\n${task.instruction}`, messages: [{ role: 'user', content }] };
      const format = { format: { type: 'json_schema', schema: taskSchema(taskName, data) } };
      const countStarted = performance.now();
      const count = await boundedJson(await this.fetcher(`${HOST}/v1/messages/count_tokens`, { method: 'POST', headers, redirect: 'error', signal: controller.signal, body: JSON.stringify({ ...base, output_config: format }) }));
      const countMs = Math.round(performance.now() - countStarted);
      if (!Number.isSafeInteger(count.input_tokens) || count.input_tokens < 0 || count.input_tokens > AI_CONFIG.maxInputTokens) fail('AI_CONTEXT_LIMIT', 'The evidence exceeds this AI request’s token limit.', 422);
      // Token counting is only a context/size check, never the budget guarantee.
      // Reserve the entire pinned model's 200K context at standard input rates,
      // plus maximum output. No long-context headers, caching or billable tools.
      const reservedInput = AI_CONFIG.maxBillableInputTokens;
      const reservation = reservedInput * AI_CONFIG.inputMicrousdPerToken + task.maxTokens * AI_CONFIG.outputMicrousdPerToken;
      if (controller.signal.aborted) fail('AI_CANCELLED', 'AI request cancelled before generation.', 499);
      const settle = await this.budget.reserve(reservation);
      // An ambiguous response/cancellation retains the reservation across restarts.
      const generationStarted = performance.now();
      const result = await boundedJson(await this.fetcher(`${HOST}/v1/messages`, { method: 'POST', headers, redirect: 'error', signal: controller.signal,
        body: JSON.stringify({ ...base, max_tokens: task.maxTokens, temperature: 0, thinking: { type: 'disabled' }, output_config: format }) }));
      const generationMs = Math.round(performance.now() - generationStarted);
      const usage = result.usage;
      if (usage && Number.isSafeInteger(usage.input_tokens) && usage.input_tokens >= 0 && Number.isSafeInteger(usage.output_tokens) && usage.output_tokens >= 0 && !usage.cache_creation_input_tokens && !usage.cache_read_input_tokens && !usage.server_tool_use) {
        await settle(usage.input_tokens * AI_CONFIG.inputMicrousdPerToken + usage.output_tokens * AI_CONFIG.outputMicrousdPerToken);
        // Optional local instrumentation receives numeric usage/timings only, never
        // prompts, outputs, credentials or provider response objects.
        try { this.onUsage({ task: taskName, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens, countMs, generationMs }); } catch { /* Observability must not affect the result or accounting. */ }
      }
      if (result.stop_reason !== 'end_turn' || result.model !== AI_CONFIG.model || !Array.isArray(result.content) || result.content.length !== 1 || result.content[0].type !== 'text') fail('AI_INCOMPLETE', 'The AI response was refused, incomplete or unexpected. No result was accepted.', 502);
      let output;
      try { output = JSON.parse(result.content[0].text); } catch { fail('AI_RESPONSE', 'The AI response was not valid structured data.', 502); }
      assertNoSecrets(output);
      return output;
    } catch (error) {
      if (controller.signal.aborted) fail('AI_CANCELLED', 'The AI request was cancelled or timed out. Any uncertain charge remains reserved.', 504);
      if (typeof error.code === 'string' && error.code.startsWith('AI_')) throw error;
      fail('AI_UNAVAILABLE', 'AI is temporarily unavailable. No result was fabricated and no automatic retry was made.', 503);
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); this.busy = false; }
  }
}
