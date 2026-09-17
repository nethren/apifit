import test from 'node:test';
import assert from 'node:assert/strict';
import { discoveryRequest, comparisonCriteria } from '../src/discovery.mjs';

const project = { text: 'Find car park availability', queries: [' parking ', '', 'availability'], requirements: [{ id: 'r1', text: 'Available parking spaces', priority: 'must', sourceQuote: 'car park availability' }], confirmed: true };
test('directory refinements preserve the project request and make no paid AI request', () => {
  const request = discoveryRequest(project, 'all');
  assert.deepEqual(request.queries, ['parking', 'availability']);
  assert.equal(request.query, project.text); assert.equal(request.mcpPages, 3);
  assert.equal(request.ai, undefined); assert.equal(request.aiDraft, undefined);
});
test('inline requirements carry into comparison without old findings or shared mutable criteria', () => {
  const draft = comparisonCriteria(project); assert.equal(draft.confirmed, true);
  assert.deepEqual(draft.requirements, project.requirements); assert.equal(draft.assessment, null);
  draft.requirements[0].text = 'Changed'; assert.equal(project.requirements[0].text, 'Available parking spaces');
});
