import test from 'node:test';
import assert from 'node:assert/strict';
import { draftRequirements, decision, assess, validateFindings, exportBrief } from '../server/assessment.mjs';
import { parseSource } from '../server/parser.mjs';
import { source } from './fixtures.mjs';
const requirements = [{ id: 'r1', text: 'Parking availability in Singapore', priority: 'must' }, { id: 'r2', text: 'Reservation support', priority: 'nice' }];
const findings = (must, nice = 'supported') => [{ requirementId: 'r1', status: must }, { requirementId: 'r2', status: nice }];

test('must-have failure cannot be outweighed by optional success', () => assert.equal(decision(requirements, findings('unsupported')), 'does-not-meet-must-haves'));
test('unknown is not unsupported', () => assert.equal(decision(requirements, findings('unknown')), 'insufficient-evidence'));
test('conditional fit keeps caveats', () => assert.equal(decision(requirements, findings('conditional')), 'conditional-fit'));
test('optional failure does not override confirmed must-haves', () => assert.equal(decision(requirements, findings('supported', 'unsupported')), 'meets-documented-must-haves'));
test('missing priorities and missing/duplicate findings prevent verdicts', () => {
  assert.equal(decision(requirements.map(r => ({ ...r, priority: 'unsure' })), findings('supported')), 'insufficient-evidence');
  assert.throws(() => decision(requirements, [findings('supported')[0]]));
  assert.throws(() => decision(requirements, [findings('supported')[0], findings('supported')[0]]));
});
test('drafts preserve full lines without semantic splitting or claiming confirmation', () => {
  const text = 'Parking in Singapore and updates every minute\nNo credential collection';
  const draft = draftRequirements(text);
  assert.equal(draft.requirements[0].text, text.split('\n')[0]); assert.equal(draft.requirements[0].priority, 'unsure'); assert.equal(draft.confirmed, false);
});
test('assessment requires explicit confirmation and only returns unknown fit without AI', () => {
  const analysis = { ...parseSource(source()), id: 'analysis1' };
  assert.throws(() => assess({ requirements, analyses: [analysis] }), { code: 'CONFIRM_REQUIREMENTS' });
  const assessment = assess({ requirements, analyses: [analysis], confirmed: true });
  assert.equal(assessment.recommendation, null); assert.equal(assessment.candidates[0].verdict, 'insufficient-evidence');
  assert.ok(assessment.candidates[0].findings[0].relatedEvidence.length);
  assert.ok(assessment.candidates[0].findings.every(f => f.status === 'unknown' && !f.evidenceIds.length));
});
test('citation validation rejects nonexistent evidence and conditional claims without conditions', () => {
  const analysis = parseSource(source());
  const base = findings('supported').map(f => ({ ...f, explanation: 'Test assertion only', evidenceIds: ['invented'] }));
  assert.throws(() => validateFindings(requirements, base, analysis), { code: 'INVALID_EVIDENCE' });
  base.forEach(f => f.evidenceIds = [analysis.evidence[0].id]); base[0].status = 'conditional';
  assert.throws(() => validateFindings(requirements, base, analysis), { code: 'MISSING_CONDITIONS' });
});
test('brief keeps requirements, evidence versions and uncertainty, without active untrusted Markdown', () => {
  const analysis = { ...parseSource(source()), id: 'a1', title: '[Click](javascript:bad)' };
  const assessment = assess({ requirements, analyses: [analysis], confirmed: true });
  const brief = exportBrief(assessment);
  assert.ok(brief.includes(assessment.requirementsRevision)); assert.ok(brief.includes(analysis.revision));
  assert.ok(brief.includes('insufficient')); assert.ok(brief.includes('not an executable integration or a live test result'));
  assert.ok(!brief.includes('Postman'));
  assert.ok(!brief.includes('[Click](javascript:bad)')); assert.ok(!brief.includes('<script>'));
});
