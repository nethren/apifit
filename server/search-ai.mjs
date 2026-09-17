import { fail } from './errors.mjs';
import { plain } from './text.mjs';
export { exportHandoff } from '../shared/brief-export.mjs';
import { explanationContext, validateGoalExplanation } from './goal-explanation.mjs';

const invalid = () => fail('AI_INVALID_RESULT', 'The AI response could not be verified. No invented result was used.', 502);
const exact = (value, keys) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) invalid(); };
const text = (value, max, empty = false) => { if (typeof value !== 'string' || value.length > max || (!empty && !value.trim())) invalid(); };
const list = (value, max) => { if (!Array.isArray(value) || value.length > max) invalid(); };

export function validateSearchQueries(value) {
  exact(value, ['queries']); list(value.queries, 3); value.queries.forEach(q => text(q, 150));
  // Directory matching is positive word overlap, not a Boolean search engine.
  // A generated suffix such as "SMS not Vendor" must not BOOST Vendor. Keep
  // the positive phrase; the untouched original request still governs ranking.
  // Require surrounding whitespace: preserve Notion, no-code and leading names
  // such as "Not Boring API". This is not a general natural-language parser.
  return [...new Set(value.queries.map(q => q.replace(/\s+(?:not|no|excluding|except|without|avoid(?:ing)?)\s+.*$/i, '').trim()).filter(Boolean))];
}
export function directoryContext(items) {
  return items.map((item, index) => ({ id: `c${index + 1}`, evidenceId: `c${index + 1}`, excerpt: `Name: ${plain(item.name, 200)}\nProduct: ${plain(item.product, 200)}\nDescription: ${plain(item.description, 950)}` }));
}
export function documentationSignal(item) {
  if (item.rankingEvidence?.status === 'documentation-read') return { label: 'Documentation read', strength: 3, reliability: 'Not measured: documentation is not an uptime, safety or response-quality check.' };
  return { label: item.specificationUrl ? 'Specification linked' : item.repositoryUrl ? 'Repository linked' : item.remoteEndpoints?.length ? 'MCP connection listed' : item.documentationUrl ? 'Website linked' : 'No source linked',
    strength: item.specificationUrl ? 2 : item.repositoryUrl || item.documentationUrl || item.remoteEndpoints?.length ? 1 : 0,
    reliability: 'Not measured: no uptime, response-quality or provider-reputation check.' };
}
export function rankingContext(items) {
  return items.map((item, i) => ({ id: `c${i + 1}`, name: plain(item.name, 200), product: plain(item.product, 250), kind: item.kind,
    documentationStatus: item.rankingEvidence?.status || 'not-read',
    evidence: [{ id: `c${i + 1}.listing`, basis: 'directory-only', excerpt: plain(item.description, 500) || plain(item.name, 200) },
      ...(item.rankingEvidence?.excerpts || []).map((e, j) => ({ id: `c${i + 1}.d${j + 1}`, basis: 'documentation', excerpt: e.excerpt }))] }));
}
export function validateEvidenceRanking(value, items, context) {
  exact(value, ['matches', 'uncovered']); list(value.matches, 12); list(value.uncovered, 1);
  value.uncovered.forEach(line => text(line, 180));
  const seen = new Set(); let withheldMatches = 0;
  const ranked = value.matches.flatMap((match, order) => {
    exact(match, ['id', 'tier', 'reason', 'gap', 'evidenceId']);
    const index = context.findIndex(c => c.id === match.id);
    if (index < 0 || seen.has(match.id) || !['close', 'partial'].includes(match.tier)) invalid();
    seen.add(match.id);
    const evidence = context[index].evidence.find(e => e.id === match.evidenceId);
    try { text(match.reason, 180); text(match.gap, 180, true); if (!evidence) invalid(); }
    catch (error) { if (error.code !== 'AI_INVALID_RESULT') throw error; withheldMatches++; return []; }
    const item = items[index]; const documented = evidence.basis === 'documentation';
    return [{ ...item, match: {
      tier: documented ? match.tier : 'partial',
      reason: documented ? match.reason : 'Potential match from its listing. Open an explanation to check its capabilities.',
      gap: documented ? match.gap : '', quote: evidence.excerpt,
      evidenceId: evidence.id, source: documented ? item.rankingEvidence.source : item.source,
      basis: documented ? 'AI interpretation of selected documentation; not verified feasibility.' : 'Directory-only lead; no capability claim accepted.' },
      signals: documentationSignal(item), rankingOrder: 'relevance-first-v3', order }];
  });
  if (withheldMatches && !ranked.length) invalid();
  // Preserve relevance order. A readable source is useful evidence, not a reason
  // to promote a tangential product above a directly relevant directory lead.
  ranked.sort((a, b) => a.order - b.order);
  return { items: ranked.map(({ order, ...item }) => item), uncovered: value.uncovered, withheldMatches };
}
export function validateRanking(value, items, context) {
  exact(value, ['matches', 'uncovered']); list(value.matches, 12); list(value.uncovered, 1);
  value.uncovered.forEach(line => text(line, 180));
  const seen = new Set();
  let withheldMatches = 0;
  const ranked = value.matches.flatMap((match, order) => {
    exact(match, ['id', 'tier', 'reason', 'gap', 'quote']);
    const index = context.findIndex(c => c.id === match.id);
    if (index < 0 || seen.has(match.id) || !['close', 'partial'].includes(match.tier)) invalid();
    seen.add(match.id);
    // Independently invalid statements cannot erase other verified quotes.
    // Identity/schema errors still reject the entire envelope.
    try {
      text(match.reason, 180); text(match.gap, 180, true); text(match.quote, 350);
      if (!context[index].excerpt.includes(match.quote)) invalid();
    } catch (error) {
      if (error.code !== 'AI_INVALID_RESULT') throw error;
      withheldMatches++; return [];
    }
    const item = items[index];
    const identityLines = context[index].excerpt.split('\n').slice(0, 2);
    const identityOnly = match.quote.split('\n').every(line => identityLines.includes(line));
    if (identityOnly) {
      return [{ ...item, match: { tier: 'partial', reason: 'Listed under this name. Open an explanation to check how it could help.', gap: '',
        quote: match.quote, basis: 'Directory identity only; capabilities have not been checked.' }, signals: documentationSignal(item), order }];
    }
    // Discovery has not checked ownership, trust or operational quality. If a
    // model nevertheless adds such an assurance, retain only a neutral listing
    // lead, never the assurance or a high-fit tier. This is not claim entailment
    // verification and does not repair other unsupported capability statements.
    if (/\b(?:official(?:ly)?|verified|certified|trusted|guaranteed|safe|secure|reliable|uptime)\b/i.test(`${match.reason} ${match.gap}`)) {
      return [{ ...item, match: { tier: 'partial', reason: 'Found in public listings. Open an explanation to check what it can do.', gap: '',
        quote: `Name: ${plain(item.name, 200)}`, basis: 'Directory listing only; an unverified assurance was withheld.' }, signals: documentationSignal(item), order }];
    }
    return [{ ...item, match: { tier: match.tier, reason: match.reason, gap: match.gap, quote: match.quote, basis: 'AI interpretation of directory metadata, not verified feasibility.' }, signals: documentationSignal(item), order }];
  });
  if (withheldMatches && !ranked.length) invalid();
  // The model has already ordered by relevance. Evidence caveats must not push
  // an exact named lead below third-party alternatives or more verbose listings.
  // A linked specification describes inspectability, not comparative fitness.
  ranked.sort((a, b) => a.order - b.order);
  return { items: ranked.map(({ order, ...item }) => ({ ...item, rankingOrder: 'relevance-first-v3' })), uncovered: value.uncovered, withheldMatches };
}
export function handoffContext(analyses, query) {
  return analyses.map((analysis, index) => ({ id: `c${index + 1}`, ...explanationContext(analysis, query, { maxBytes: 5000, maxExcerpts: 8 }) }));
}
export function validateHandoff(value, analyses, context) {
  exact(value, ['integrations']); exact(value.integrations, context.map(c => c.id));
  if (analyses.length !== context.length || analyses.length > 5) invalid();
  const integrations = analyses.map((_analysis, i) => {
    const result = validateGoalExplanation(value.integrations[context[i].id], context[i].evidence, { maxCapabilities: 2, maxWords: 140 });
    return { ...result, title: analyses[i].integration?.name || analyses[i].title, integrationKind: analyses[i].integration?.kind || 'unknown', source: analyses[i].source,
      documentationStatus: analyses[i].documentationStatus, documentationNote: analyses[i].documentationNote, coverage: context[i].coverage, evidence: context[i].evidence };
  });
  return { integrations, nextSteps: [
    'Confirm current access, pricing and limits for the selected integrations.',
    'Prototype the documented capabilities before committing the full app.',
    'Resolve the checks above before building features that depend on unconfirmed data.',
    'Test the returned data for coverage and quality against the original project request.',
  ], nextStepsBasis: 'APIFit checklist, not AI-generated API instructions' };
}
