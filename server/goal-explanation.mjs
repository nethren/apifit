import { evidenceContext } from './ai-evidence.mjs';
import { assertNoSecrets } from './ai-client.mjs';
import { fail } from './errors.mjs';

const invalid = () => fail('AI_INVALID_RESULT', 'The explanation did not pass source and format checks. No unsupported text was shown.', 502);
const exact = (value, keys) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid(); };
const text = (value, max) => { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) invalid(); };

export function explanationContext(analysis, query = '', { maxBytes = 22000, maxExcerpts = 28 } = {}) {
  assertNoSecrets(query);
  const safeEvidence = analysis.evidence.filter(e => {
    try { assertNoSecrets(e.excerpt); return true; }
    catch (error) { if (error.code !== 'AI_SENSITIVE_INPUT') throw error; return false; }
  });
  const selected = evidenceContext({ ...analysis, evidence: safeEvidence }, query ? [{ text: query }] : []);
  let bytes = 0;
  const evidence = selected.evidence.filter(e => { const size = Buffer.byteLength(JSON.stringify(e)); if (bytes + size > maxBytes) return false; bytes += size; return true; }).slice(0, maxExcerpts);
  return { request: query, integration: analysis.integration || { kind: 'unknown', name: analysis.title }, documentTitle: analysis.title, documentFormat: analysis.format,
    sourceBasis: analysis.source?.evidenceLevel || 'documentation',
    evidence, coverage: { selected: evidence.length, total: analysis.evidence.length, omittedSensitiveExcerpts: analysis.evidence.length - safeEvidence.length },
    warning: analysis.format === 'mcp-tools'
      ? 'These are tool descriptions returned by the selected public MCP connection. They describe advertised functionality, not tested results or verified publisher ownership. Protocol metadata was read; no tool was executed. Missing facts are unknown.'
      : 'Partial documentation. Selection identity is unverified context, not capability evidence. README may not match the installed version. Nothing has been run. Missing facts are unknown.' };
}

// Exact quotes establish traceability, not entailment. Applications are labelled
// as possible uses, distinct from the documented capability; live quality is not certified.
export function validateGoalExplanation(value, evidence, { maxCapabilities = 3, maxWords = 180, withholdInvalid = false } = {}) {
  exact(value, ['sourceFit', 'capabilities', 'checks']);
  if (!['software-docs', 'unclear'].includes(value.sourceFit) || !Array.isArray(value.capabilities) || value.capabilities.length > 6 || !Array.isArray(value.checks) || value.checks.length > 4) invalid();
  if (value.sourceFit === 'unclear' && value.capabilities.length) invalid();
  value.checks.forEach(check => text(check, 220));
  let withheldStatements = 0;
  const byId = new Map(evidence.map(e => [e.id, e]));
  const verified = value.capabilities.flatMap(capability => {
    try {
      exact(capability, ['title', 'does', 'helps', 'evidenceIds']);
      text(capability.title, 70); text(capability.does, 280); text(capability.helps, 350);
      if (!Array.isArray(capability.evidenceIds) || !capability.evidenceIds.length || capability.evidenceIds.length > 3 || new Set(capability.evidenceIds).size !== capability.evidenceIds.length || capability.evidenceIds.some(id => !byId.has(id))) invalid();
      const { evidenceIds, ...prose } = capability;
      return [{ ...prose, citations: evidenceIds.map(id => ({ evidenceId: id, quote: byId.get(id).excerpt })) }];
    } catch (error) {
      if (!withholdInvalid || error.code !== 'AI_INVALID_RESULT') throw error;
      withheldStatements++; return [];
    }
  });
  // Length is a presentation concern, not a reason to discard valid evidence.
  // Keep complete, source-checked blocks in the model's relevance order; never
  // truncate a caveat mid-sentence or relax source-ID validation.
  const capabilities = verified.slice(0, maxCapabilities);
  const checks = capabilities.length ? value.checks.slice(0, 2) : [];
  const words = () => [...capabilities.flatMap(c => [c.title, c.does, c.helps]), ...checks].join(' ').trim().split(/\s+/).length;
  while (words() > maxWords && capabilities.length > 1) capabilities.pop();
  while (words() > maxWords && checks.length) checks.pop();
  if (words() > maxWords) invalid();
  return { ...value, capabilities, checks, withheldStatements, omittedForBrevity: verified.length - capabilities.length + value.checks.length - checks.length };
}
