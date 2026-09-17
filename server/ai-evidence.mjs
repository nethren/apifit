import { relatedTerms } from './text.mjs';
import { fail } from './errors.mjs';

export function validateCitations(citations, evidence, required = true) {
  const invalid = () => fail('AI_INVALID_RESULT', 'The AI result failed evidence or format checks. No judgment was accepted.', 502);
  if (!Array.isArray(citations) || citations.length > 4 || (required && !citations.length)) invalid();
  const byId = new Map(evidence.map(e => [e.id, e]));
  for (const c of citations) {
    if (!c || typeof c !== 'object' || Array.isArray(c) || Object.keys(c).length !== 2 || !Object.hasOwn(c, 'evidenceId') || !Object.hasOwn(c, 'quote')) invalid();
    for (const [value, max] of [[c.evidenceId, 80], [c.quote, 1200]]) {
      if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid();
    }
    if (!byId.get(c.evidenceId)?.excerpt.includes(c.quote)) invalid();
  }
  return citations;
}

export function evidenceContext(analysis, requirements = []) {
  const query = requirements.map(r => r.text).join(' ');
  const ranked = analysis.evidence.map((e, index) => ({ e, index, score: relatedTerms(query, e.excerpt).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index);
  const evidence = []; let bytes = 0;
  for (const { e } of ranked) {
    const item = { id: e.id, location: e.location, excerpt: e.excerpt };
    const size = Buffer.byteLength(JSON.stringify(item));
    if (bytes + size > 28000 || evidence.length >= 40) continue;
    evidence.push(item); bytes += size;
  }
  if (!evidence.length) fail('AI_NO_EVIDENCE', 'There is no readable source evidence to send for explanation.', 422);
  return { evidence, coverage: analysis.coverage, parserWarnings: analysis.unknowns, selectedEvidence: evidence.length, totalEvidence: analysis.evidence.length,
    warning: 'This is a bounded, automatically parsed evidence selection, not a complete API audit. Missing evidence does not prove a missing capability. Account access and live behavior are not checked.' };
}
