import { AI_CONFIG } from './ai-config.mjs';
import { assertNoSecrets } from './ai-client.mjs';
import { assess, decision, validateFindings } from './assessment.mjs';
import { hash } from './text.mjs';
import { fail } from './errors.mjs';
import { validateSearchQueries, directoryContext, validateRanking, rankingContext, validateEvidenceRanking, handoffContext, validateHandoff } from './search-ai.mjs';
import { validateSearchPlan } from './search-intent.mjs';
import { validateCitations, evidenceContext } from './ai-evidence.mjs';
import { explanationContext, validateGoalExplanation } from './goal-explanation.mjs';
import { sourceQuality, unavailableExplanation } from './source-quality.mjs';
export { validateCitations, evidenceContext } from './ai-evidence.mjs';

export const AI_CONSENT = 'anthropic-project-text-v1';
const invalid = () => fail('AI_INVALID_RESULT', 'The AI result failed evidence or format checks. No judgment was accepted.', 502);
const object = (value, keys) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(k => !Object.hasOwn(value, k))) invalid();
};
const text = (value, max = 1000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) invalid();
  return value;
};
const list = (value, max) => { if (!Array.isArray(value) || value.length > max) invalid(); return value; };
export function validateDraft(value, original) {
  object(value, ['requirements', 'queries', 'questions']);
  const requirements = list(value.requirements, 10).map((r, i) => {
    object(r, ['text', 'sourceQuote']); text(r.text); text(r.sourceQuote, 2000);
    if (!original.includes(r.sourceQuote)) invalid();
    return { id: `r${i + 1}`, text: r.text, sourceQuote: r.sourceQuote, priority: 'unsure' };
  });
  list(value.queries, 3).forEach(q => text(q, 150)); list(value.questions, 3).forEach(q => text(q, 400));
  return { ...value, requirements, confirmed: false, mode: 'ai-draft', revision: hash(JSON.stringify(requirements)), notice: 'AI draft: check every requirement against your original request and choose priorities. Nothing is confirmed automatically.' };
}
export function validateExplanation(value, evidence) {
  object(value, ['summary', 'capabilities', 'limitations']);
  for (const [key, max] of [['summary', 3], ['capabilities', 6], ['limitations', 4]]) {
    for (const statement of list(value[key], max)) { object(statement, ['text', 'citations']); text(statement.text, 800); validateCitations(statement.citations, evidence); }
  }
  return value;
}
export function verifiedExplanationStatements(value, evidence) {
  object(value, ['summary', 'capabilities', 'limitations']);
  const result = { summary: [], capabilities: [], limitations: [], withheldStatements: 0 };
  for (const [key, max] of [['summary', 3], ['capabilities', 6], ['limitations', 4]]) {
    for (const statement of list(value[key], max)) {
      try {
        validateExplanation({ summary: [], capabilities: [], limitations: [], [key]: [statement] }, evidence);
        result[key].push(statement);
      } catch (error) {
        if (error.code !== 'AI_INVALID_RESULT') throw error;
        result.withheldStatements++; // Never expose the rejected statement or relax exact quotation checks.
      }
    }
  }
  return result;
}
export function validateAiFindings(value, requirements, evidence) {
  object(value, ['findings']); list(value.findings, 10);
  const findings = value.findings.map(f => {
    object(f, ['requirementId', 'status', 'explanation', 'conditions', 'citations']);
    text(f.requirementId, 60); text(f.explanation, 1500);
    list(f.conditions, 4).forEach(c => text(c, 400));
    validateCitations(f.citations, evidence, f.status !== 'unknown');
    return { ...f, evidenceIds: [...new Set(f.citations.map(c => c.evidenceId))], relatedEvidence: [] };
  });
  validateFindings(requirements, findings, { evidence });
  return findings;
}
export function validateVerification(value, findings) {
  object(value, ['checks']); list(value.checks, 10);
  const expected = new Set(findings.map(f => f.requirementId));
  if (value.checks.length !== expected.size) invalid();
  for (const check of value.checks) {
    object(check, ['requirementId', 'acceptable', 'reason']); text(check.reason, 1000);
    if (typeof check.acceptable !== 'boolean' || !expected.delete(check.requirementId)) invalid();
  }
  return value.checks;
}

export function requireExplicitRestriction(findings) {
  // A one-way conservative gate, not an entailment classifier. Positive examples
  // must never become exclusions just because a model silently inserts "only".
  // Unrecognised/non-English restrictions remain unknown for human review.
  const restriction = /\b(?:only|not|no|never|cannot|unsupported|unavailable|prohibited|forbidden|maximum|minimum)\b|\b(?:limited to|at most|at least|up to|doesn't|can't|won't)\b/i;
  return findings.map(f => f.status === 'unsupported' && !f.citations.some(c => restriction.test(c.quote))
    ? { ...f, status: 'unknown', explanation: 'APIFit could not verify an explicit restriction in the cited text. Check the broader documentation before ruling out this API.', conditions: [], restrictionGate: 'no-explicit-boundary' }
    : f);
}

const provenance = () => ({ provider: AI_CONFIG.provider, model: AI_CONFIG.model, promptVersion: AI_CONFIG.promptVersion, reviewLevel: 'ai-interpreted-not-human-reviewed', liveTested: false, accountAccess: 'not-checked' });

export class AiService {
  constructor({ client, budget, credentialStatus }) { this.client = client; this.budget = budget; this.credentialStatus = credentialStatus; this.busy = false; }
  async status() {
    const [credential, budget] = await Promise.all([this.credentialStatus(), this.budget.status()]);
    return { configured: true, ready: credential === 'stored' && budget.available && budget.remainingUsd > 0, credential, budget,
      model: AI_CONFIG.model, consentVersion: AI_CONSENT, liveQualityValidated: AI_CONFIG.liveQualityValidated,
      privacy: 'With AI on, your request and selected documentation excerpts are sent to Anthropic. Local records expire after 15 minutes; Anthropic has its own retention policy. Never include credentials or sensitive personal data.' };
  }
  async authorized(options, action) {
    if (options?.ai !== true || options.aiConsent !== AI_CONSENT) fail('AI_CONSENT_REQUIRED', 'Enable AI assistance and accept the text-sharing notice before making an AI request.', 403);
    if (this.busy) fail('AI_BUSY', 'An AI task is already running. Wait until it finishes.', 429);
    this.busy = true;
    try {
      const status = await this.status();
      if (!status.ready) fail('AI_NOT_READY', 'AI is not ready. The operator should check the server credential and development budget.', 503);
      if (options.signal?.aborted) fail('AI_CANCELLED', 'AI request cancelled.', 499);
      return await action();
    } finally { this.busy = false; }
  }
  draft(original, options) {
    if (typeof original !== 'string' || !original.trim() || original.length > 8000) fail('INVALID_BRIEF', 'Supply a project brief of 1–8,000 characters.');
    assertNoSecrets(original);
    return this.authorized(options, async () => ({ ...validateDraft(await this.client.run('request', { request: original }, options), original), provenance: provenance() }));
  }
  searchQueries(query, options) {
    assertNoSecrets(query);
    return this.authorized(options, async () => validateSearchQueries(await this.client.run('searchQueries', { request: query }, options)));
  }
  searchPlan(query, options) {
    assertNoSecrets(query);
    return this.authorized(options, async () => validateSearchPlan(await this.client.run('searchPlan', { request: query }, options), query));
  }
  rank(query, items, options) {
    assertNoSecrets(query);
    const enriched = items.some(item => item.rankingEvidence);
    // Omit public listings containing credential-like examples. Never weaken
    // detection or send those examples alongside otherwise clean candidates.
    const safeItems = items.filter(item => {
      try { assertNoSecrets(enriched ? rankingContext([item])[0] : directoryContext([item])[0]); return true; }
      catch (error) { if (error.code !== 'AI_SENSITIVE_INPUT') throw error; return false; }
    });
    const context = enriched ? rankingContext(safeItems) : directoryContext(safeItems);
    return this.authorized(options, async () => ({
      ...(safeItems.length ? (enriched ? validateEvidenceRanking : validateRanking)(await this.client.run(enriched ? 'rankEvidence' : 'rank', { request: query, candidates: context }, options), safeItems, context)
        : { items: [], uncovered: ['These listings could not be safely used for AI matching.'], withheldMatches: 0 }),
      omittedSensitiveListings: items.length - safeItems.length, provenance: provenance(),
    }));
  }
  summarize(analysis, options, query = '') {
    assertNoSecrets(query);
    if (!sourceQuality(analysis).usable) return Promise.resolve(unavailableExplanation());
    const context = explanationContext(analysis, query);
    return this.authorized(options, async () => {
      const result = validateGoalExplanation(await this.client.run('summary', context, options), context.evidence, { withholdInvalid: true });
      return { ...result, provenance: provenance(), coverage: context.coverage };
    });
  }
  handoff(query, analyses, options) {
    if (!analyses.length || analyses.some(analysis => !sourceQuality(analysis).usable)) fail('NO_READABLE_DOCS', 'Usable capability evidence is needed before generating a build brief.', 422);
    const context = handoffContext(analyses, query);
    return this.authorized(options, async () => ({ ...validateHandoff(await this.client.run('handoff', { request: query, candidates: context }, options), analyses, context), provenance: provenance() }));
  }
  explain(analysis, options) {
    if (!sourceQuality(analysis).usable) return Promise.resolve({ summary: [], capabilities: [], limitations: [], withheldStatements: 0, generation: 'skipped-no-usable-evidence' });
    const context = evidenceContext(analysis);
    assertNoSecrets(context);
    return this.authorized(options, async () => ({ ...verifiedExplanationStatements(await this.client.run('explain', context, options), context.evidence), provenance: provenance(), coverage: { selectedEvidence: context.selectedEvidence, totalEvidence: context.totalEvidence } }));
  }
  assessment(input, options) {
    const base = assess(input); // Confirm priorities and validate server-owned records first.
    if (base.requirements.length > 10) fail('AI_REQUIREMENT_LIMIT', 'Use at most 10 requirements per AI comparison. Manual comparison supports up to 30.', 422);
    const contexts = input.analyses.map(a => evidenceContext(a, base.requirements));
    assertNoSecrets({ requirements: base.requirements, contexts });
    return this.authorized(options, async () => {
      const candidates = [];
      for (const [index, candidate] of base.candidates.entries()) {
        const context = contexts[index];
        const data = { requirements: base.requirements, ...context };
        let findings = requireExplicitRestriction(validateAiFindings(await this.client.run('assess', data, options), base.requirements, context.evidence));
        const proposed = findings.filter(f => f.status !== 'unknown');
        if (proposed.length) {
          const checks = validateVerification(await this.client.run('verify', { ...data, proposedFindings: proposed }, options), proposed);
          findings = findings.map(f => {
            const check = checks.find(c => c.requirementId === f.requirementId);
            return check && !check.acceptable ? { ...f, status: 'unknown', explanation: 'A second evidence check did not confirm the full requirement. Review the documentation before treating it as supported or unsupported.', evidenceIds: [], citations: [], conditions: [], verification: 'not-confirmed' } : { ...f, verification: check ? 'second-ai-check-passed' : 'not-applicable' };
          });
        }
        candidates.push({ ...candidate, findings, verdict: decision(base.requirements, findings), reviewLevel: 'ai-interpreted-not-human-reviewed', aiCoverage: { selectedEvidence: context.selectedEvidence, totalEvidence: context.totalEvidence } });
      }
      return { ...base, candidates, mode: 'ai-evidence-assessment', interpretation: 'ai-with-quote-checks', provenance: provenance(),
        notice: 'AI interpretation, not a verified test. Source quotes were checked and non-unknown findings received a second AI check; both passes can still be wrong. Verdicts apply your confirmed must-haves mechanically. No winner or account access is inferred.' };
    });
  }
}
