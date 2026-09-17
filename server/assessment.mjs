import { fail } from './errors.mjs';
import { hash, relatedTerms, markdownText } from './text.mjs';

export function validateRequirements(requirements) {
  if (!Array.isArray(requirements) || !requirements.length || requirements.length > 30) fail('INVALID_REQUIREMENTS', 'Supply between 1 and 30 confirmed requirements.');
  const ids = new Set();
  return requirements.map(r => {
    if (!r || typeof r.id !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(r.id) || ids.has(r.id) || typeof r.text !== 'string' || !r.text.trim() || r.text.length > 1000 || !['must', 'nice', 'unsure'].includes(r.priority)) fail('INVALID_REQUIREMENTS', 'Each requirement needs a unique ID, text and must/nice/unsure priority.');
    ids.add(r.id);
    return { id: r.id, text: r.text.trim(), priority: r.priority };
  });
}

export function draftRequirements(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 8000) fail('INVALID_BRIEF', 'Supply a project brief of 1–8,000 characters.');
  const lines = text.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
  // Preserve whole clauses: no silent semantic splitting or dropped requirements.
  if (lines.length > 30 || lines.some(line => line.length > 1000)) fail('BRIEF_NEEDS_EDIT', 'Use at most 30 lines, each no longer than 1,000 characters. Long paragraphs need your own requirement breaks.');
  const requirements = lines.map((line, index) => ({ id: `r${index + 1}`, text: line, priority: 'unsure' }));
  return { requirements, confirmed: false, mode: 'line-preserving-draft', revision: hash(JSON.stringify(requirements)), notice: 'Review these lines and set priorities before assessment. AI was not used for this draft.' };
}

export function decision(requirements, findings) {
  const reqs = validateRequirements(requirements);
  if (!Array.isArray(findings) || findings.length !== reqs.length || new Set(findings.map(f => f.requirementId)).size !== reqs.length) fail('INVALID_FINDINGS', 'Every requirement must have exactly one finding.');
  const byId = new Map(findings.map(f => [f.requirementId, f]));
  if (reqs.some(r => !['supported', 'conditional', 'unsupported', 'unknown'].includes(byId.get(r.id)?.status))) fail('INVALID_FINDINGS', 'Findings contain an unknown requirement or status.');
  const must = reqs.filter(r => r.priority === 'must');
  if (must.some(r => byId.get(r.id).status === 'unsupported')) return 'does-not-meet-must-haves';
  if (!must.length || reqs.some(r => r.priority === 'unsure') || must.some(r => byId.get(r.id).status === 'unknown')) return 'insufficient-evidence';
  if (must.some(r => byId.get(r.id).status === 'conditional')) return 'conditional-fit';
  return 'meets-documented-must-haves';
}

// Boundary for a future interpretation adapter. Citation presence alone does
// not establish semantic truth; this validates structure, not claim correctness.
export function validateFindings(requirements, findings, analysis) {
  decision(requirements, findings);
  const evidenceIds = new Set(analysis.evidence.map(e => e.id));
  for (const finding of findings) {
    if (typeof finding.explanation !== 'string' || !finding.explanation.trim() || finding.explanation.length > 4000 || !Array.isArray(finding.evidenceIds) || finding.evidenceIds.some(id => !evidenceIds.has(id))) fail('INVALID_EVIDENCE', 'Findings must refer only to available analysis evidence.');
    if (finding.status !== 'unknown' && !finding.evidenceIds.length) fail('MISSING_EVIDENCE', 'Definitive and conditional findings need source evidence.');
    if (finding.status === 'conditional' && (!Array.isArray(finding.conditions) || !finding.conditions.length || finding.conditions.some(c => typeof c !== 'string' || !c.trim()))) fail('MISSING_CONDITIONS', 'Conditional findings need explicit unresolved conditions.');
  }
  return findings;
}

export function assess({ requirements, confirmed, analyses }) {
  if (confirmed !== true) fail('CONFIRM_REQUIREMENTS', 'Confirm the requirements before assessing fit.');
  const reqs = validateRequirements(requirements);
  if (!Array.isArray(analyses) || !analyses.length || analyses.length > 5 || new Set(analyses.map(a => a?.id)).size !== analyses.length || analyses.some(a => a?.kind !== 'analysis')) fail('INVALID_CANDIDATES', 'Select between 1 and 5 different analysed documents for this comparison.');
  const candidates = analyses.map(analysis => {
    const findings = reqs.map(req => {
      const related = analysis.capabilities.map(cap => ({ capabilityId: cap.id, evidenceIds: cap.evidenceIds, matchedTerms: relatedTerms(req.text, `${cap.title} ${cap.description} ${cap.responses.map(r => r.fields.map(f => `${f.name} ${f.description}`).join(' ')).join(' ')}`) }))
        .filter(match => match.matchedTerms.length).sort((a, b) => b.matchedTerms.length - a.matchedTerms.length).slice(0, 5);
      return { requirementId: req.id, status: 'unknown', explanation: 'No AI fit check was requested. Related wording is provided for investigation, not proof that the requirement is supported or unsupported.', evidenceIds: [], relatedEvidence: related, conditions: [] };
    });
    validateFindings(reqs, findings, analysis);
    return { analysisId: analysis.id, revision: analysis.revision, title: analysis.title, source: analysis.source, coverage: analysis.coverage, unknowns: analysis.unknowns, evidence: analysis.evidence, findings, verdict: decision(reqs, findings), reviewLevel: 'not-reviewed', liveTested: false, accountAccess: 'not-checked' };
  });
  return { kind: 'assessment', createdAt: new Date().toISOString(), requirements: reqs, requirementsRevision: hash(JSON.stringify(reqs)), candidates,
    recommendation: null, mode: 'evidence-preparation', interpretation: 'not-configured',
    notice: 'AI assistance was not used for this comparison. Related wording is for investigation, not a fit judgment or recommendation.' };
}

export function exportBrief(assessment) {
  if (assessment?.kind !== 'assessment') fail('INVALID_ASSESSMENT', 'Select an assessment to export.', 404);
  const m = markdownText;
  const lines = ['# APIFit decision preparation brief', '', `Created: ${assessment.createdAt}`, '', `Requirements revision: ${assessment.requirementsRevision}`, '',
    `Status: ${assessment.interpretation === 'ai-with-quote-checks' ? 'AI interpretation with quote validation, not human-reviewed. Model: ' + assessment.provenance.model + '. Prompt: ' + assessment.provenance.promptVersion + '.' : 'Evidence preparation only; no AI judgment requested.'} No provider API/MCP operation has been executed and no account/key access has been checked.`, '', '## Confirmed requirements', ''];
  for (const r of assessment.requirements) lines.push(`- **${m(r.priority)}** · ${m(r.id)}: ${m(r.text)}`);
  for (const candidate of assessment.candidates) {
    lines.push('', `## ${m(candidate.title)}`, '', `Verdict: ${m(candidate.verdict)}. Review: ${m(candidate.reviewLevel)}.`, '', `Document: ${m(candidate.source.url)}`, '', `Retrieved: ${m(candidate.source.fetchedAt)}. Content hash: ${candidate.revision}`, '', `Coverage: ${m(JSON.stringify(candidate.coverage))}`, '');
    if (candidate.aiCoverage) lines.push(`AI evidence coverage: ${candidate.aiCoverage.selectedEvidence} of ${candidate.aiCoverage.totalEvidence} parsed excerpts selected. Not a complete API audit.`, '');
    for (const f of candidate.findings) {
      lines.push(`- ${m(f.requirementId)} — **${m(f.status)}**: ${m(f.explanation)}`);
      for (const citation of f.citations || []) lines.push(`  - Source quote: ${m(citation.quote)} (evidence: ${m(citation.evidenceId)})`);
      for (const condition of f.conditions || []) lines.push(`  - Condition: ${m(condition)}`);
      for (const related of f.relatedEvidence) for (const id of related.evidenceIds) {
        const evidence = candidate.evidence.find(e => e.id === id);
        if (evidence) lines.push(`  - Related, not verified: ${m(evidence.excerpt)} (source location: ${m(evidence.location)}; evidence: ${id})`);
      }
    }
    lines.push('', 'Unresolved:', '', ...candidate.unknowns.map(u => `- ${m(u)}`));
  }
  lines.push('', '## Before building', '',
    '- Read the linked source and confirm the exact API product and version.',
    '- Check provider signup, account permissions, terms, quotas and regional coverage directly with the provider.',
    '- Have a technical collaborator choose a safe test endpoint and representative inputs for each must-have.',
    '- Keep provider credentials in your own secure development environment; never paste them into APIFit.',
    '- Obtain consent before making billable, write or destructive requests. An exported checklist is not a test result.',
    '- For MCP, inspect documented tools and permissions without assuming parity with a provider API. APIFit does not install or execute MCP servers.',
    '', 'This is a planning brief, not an executable integration or a live test result.', '');
  return lines.join('\n');
}
