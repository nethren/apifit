// Verified against Anthropic's official model/pricing pages on 2026-09-14.
// No request parameter may change the host, model, thinking mode or budget.
export const AI_CONFIG = Object.freeze({
  provider: 'Anthropic', model: 'claude-haiku-4-5-20251001',
  inputMicrousdPerToken: 1, outputMicrousdPerToken: 5,
  maxInputTokens: 24000, maxOutputTokens: 3000,
  // Reserve the full documented model context, not the estimated request count.
  maxBillableInputTokens: 200000,
  maxPayloadBytes: 48000, timeoutMs: 45000,
  promptVersion: 'apifit-lookup-and-capabilities-v4.6', liveQualityValidated: false,
});
