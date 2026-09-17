import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSource } from '../server/parser.mjs';
import { source, specification, mcpDirectory } from './fixtures.mjs';
import { normalizeMcp } from '../server/catalog.mjs';
import { integrationInput, githubReadmeUrl, readIntegration } from '../server/integration-docs.mjs';
import { explanationContext, validateGoalExplanation } from '../server/goal-explanation.mjs';
import { handoffContext, validateHandoff, exportHandoff } from '../server/search-ai.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { explanationKey, documentationSelection, hasDocumentation } from '../src/search-state.mjs';
import { createApp } from '../server/app.mjs';
import { taskSchema } from '../server/ai-prompts.mjs';

test('brief generation schema fixes exactly one entry for each selected integration', () => {
  const schema = taskSchema('handoff', { candidates: [{ id: 'c1' }, { id: 'c2' }] });
  assert.equal(schema.properties.integrations.type, 'object');
  assert.deepEqual(schema.properties.integrations.required, ['c1', 'c2']);
  assert.equal(schema.properties.integrations.additionalProperties, false);
  assert.throws(() => taskSchema('handoff', { candidates: [{ id: 'untrusted' }] }));
});

test('excess valid prose is compacted as whole blocks, without relaxing evidence checks', () => {
  const evidence = parseSource(source()).evidence;
  const input = response({ evidence });
  input.capabilities = Array.from({ length: 3 }, () => structuredClone(input.capabilities[0]));
  const result = validateGoalExplanation(input, evidence, { maxCapabilities: 2, maxWords: 140 });
  assert.equal(result.capabilities.length, 2); assert.equal(result.omittedForBrevity, 1);
  input.capabilities[2].evidenceIds = ['invented'];
  assert.throws(() => validateGoalExplanation(input, evidence, { maxCapabilities: 2 }), { code: 'AI_INVALID_RESULT' });
  input.capabilities = Array(7).fill(response({ evidence }).capabilities[0]);
  assert.throws(() => validateGoalExplanation(input, evidence), { code: 'AI_INVALID_RESULT' });
});

const query = 'Find cafes nearby and match coffee bean origin and roast preferences.';
const readme = '# Coffee tools\n\nAn MCP server for coffee assistants.\n\n## Tools\nSearch coffee products by bean origin. Read the roast description for a selected coffee.';
const mcp = { kind: 'mcp', name: 'Coffee assistant', product: 'org.example/coffee', repositoryUrl: 'https://github.com/example/coffee', documentationUrl: 'https://coffee.example.com/' };
const opts = { ai: true, aiConsent: AI_CONSENT };
const response = context => ({ sourceFit: 'software-docs', capabilities: [{ title: 'Read available spaces', does: 'Reads parking availability.', helps: 'You could show drivers available parking.', evidenceIds: [context.evidence[0].id] }], checks: ['Confirm location coverage.'] });

test('MCP tool evidence is labelled as declarations, not a mismatched README or executed capability', () => {
  const analysis = { format: 'mcp-tools', title: 'Documentation tools', integration: { kind: 'mcp', name: 'Documentation tools' },
    source: { evidenceLevel: 'server-declared-tool-metadata' },
    evidence: [{ id: 'tool-1', location: 'tools/list:lookup', excerpt: 'Retrieves documentation for a named framework.' }] };
  const context = explanationContext(analysis, 'Look up framework documentation.');
  assert.equal(context.sourceBasis, 'server-declared-tool-metadata');
  assert.match(context.warning, /advertised functionality/);
  assert.match(context.warning, /no tool was executed/);
  assert.doesNotMatch(context.warning, /README/);
  assert.deepEqual(context.evidence, analysis.evidence);
});

test('MCP selections retain repository and identity; repository is read before retail website', async () => {
  assert.equal(normalizeMcp(mcpDirectory, '2026-09-15')[0].repositoryUrl, 'https://github.com/example/parking');
  const requests = [];
  const analysis = await readIntegration(integrationInput(mcp), query, { parser: parseSource, fetcher: async url => {
    requests.push(url);
    return { ...source({ encoding: 'base64', content: Buffer.from(readme).toString('base64') }), url };
  } });
  assert.deepEqual(requests, ['https://api.github.com/repos/example/coffee/readme']);
  assert.equal(analysis.integration.kind, 'mcp'); assert.equal(analysis.integration.name, mcp.name);
  assert.equal(analysis.source.url, mcp.repositoryUrl);
  assert.equal(analysis.source.retrievalUrl, requests[0]);
  assert.equal(analysis.format, 'markdown'); assert.match(analysis.evidence[0].excerpt, /bean origin/);
  const context = explanationContext(analysis, query);
  assert.equal(context.request, query); assert.equal(context.integration.kind, 'mcp');
  assert.equal(context.integration.labelBasis, 'unverified-selection-context');
  assert.match(context.warning, /Nothing has been run/);
});

test('public README raw responses and fallback pages are handled explicitly', async () => {
  const raw = await readIntegration(integrationInput(mcp), query, { parser: parseSource, fetcher: async url => ({ ...source(readme), url, contentType: 'text/plain' }) });
  assert.equal(raw.format, 'markdown');
  const fallback = await readIntegration(integrationInput(mcp), query, { parser: parseSource, fetcher: async url => {
    if (url.includes('api.github.com')) throw Error('rate limit');
    return { ...source('<html><title>Coffee shop</title><main>Buy our coffee.</main></html>'), url, contentType: 'text/html' };
  } });
  assert.equal(fallback.integration.name, mcp.name); assert.equal(fallback.title, 'Coffee shop');
  assert.equal(fallback.documentationNote, null); assert.equal(fallback.capabilities.length, 0);
  assert.equal(fallback.documentationStatus.state, 'unavailable');
  assert.equal(fallback.documentationStatus.attempts.length, 2);
});

test('README resolver does not guess branches, accept lookalike hosts or run MCP endpoints', () => {
  assert.equal(githubReadmeUrl('https://github.com/owner/repo.git'), 'https://api.github.com/repos/owner/repo/readme');
  assert.equal(githubReadmeUrl('https://github.com.evil.example/owner/repo'), null);
  assert.equal(githubReadmeUrl('https://github.com/owner/repo/tree/branch/subfolder'), null);
  assert.throws(() => integrationInput({ ...mcp, repositoryUrl: 'https://127.0.0.1/private' }), { code: 'UNSAFE_ADDRESS' });
  assert.throws(() => integrationInput({ ...mcp, documentationUrl: 'http://example.com' }), { code: 'UNSAFE_URL' });
  assert.throws(() => integrationInput({ kind: 'mcp', name: 'No docs' }), { code: 'INVALID_CANDIDATES' });
});

test('cancellation after a failed README does not fetch the fallback', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(readIntegration(integrationInput(mcp), query, { signal: controller.signal, parser: parseSource, fetcher: async () => { calls++; controller.abort(); throw Error('cancelled'); } }));
  assert.equal(calls, 1);
});

test('project selection finds later operations without changing ordinary pagination', () => {
  const doc = structuredClone(specification);
  doc.paths = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`/admin/${i}`, { get: { summary: 'Read account details', responses: {} } }]));
  doc.paths['/cafes'] = { get: { summary: 'Find nearby cafes', responses: {} } };
  const original = parseSource(source(doc), { limit: 20 });
  const selected = parseSource(source(doc), { limit: 20, query });
  assert.ok(!original.capabilities.some(c => c.path === '/cafes'));
  assert.equal(selected.capabilities[0].path, '/cafes'); assert.equal(selected.coverage.totalOperations, 81);
  assert.equal(selected.coverage.selection, 'project-word-overlap'); assert.equal(selected.coverage.status, 'partial');
});

test('later README and HTML sections are eligible and remain bounded', () => {
  const text = '# Docs\n' + 'General documentation. '.repeat(500) + '\n## Coffee tools\nSearch coffee by bean origin and roast.';
  const analysis = parseSource({ ...source(text), contentType: 'text/markdown' }, { query });
  assert.match(explanationContext(analysis, query).evidence[0].excerpt, /bean origin/);
  const html = parseSource({ ...source(`<html><main>${text}</main></html>`), contentType: 'text/html' }, { query });
  assert.match(explanationContext(html, query).evidence[0].excerpt, /bean origin/);
  const long = parseSource({ ...source('readable '.repeat(20000)), contentType: 'text/markdown' });
  assert.equal(long.coverage.charactersRead, 96000); assert.equal(long.coverage.truncated, true);
});

test('summary sends goal and kind, and cache changes with goal, source or integration kind', async () => {
  const analysis = { ...parseSource(source()), integration: { kind: 'api', name: 'Parking' } }; let sent;
  const ai = new AiService({ client: { run: async (task, context) => { assert.equal(task, 'summary'); sent = context; return response(context); } }, budget: { status: async () => ({ available: true, remainingUsd: 4 }) }, credentialStatus: async () => 'stored' });
  await ai.summarize(analysis, opts, 'Find parking near a cafe');
  assert.equal(sent.request, 'Find parking near a cafe'); assert.equal(sent.integration.kind, 'api');
  assert.notEqual(explanationKey(query, mcp), explanationKey('Delivery addresses', mcp));
  assert.notEqual(explanationKey(query, mcp), explanationKey(query, { ...mcp, repositoryUrl: 'https://github.com/example/other' }));
  assert.notEqual(explanationKey(query, mcp), explanationKey(query, { ...mcp, kind: 'api' }));
  assert.notEqual(explanationKey(query, { ...mcp, version: '1' }), explanationKey(query, { ...mcp, version: '2' }));
  assert.equal(explanationKey(query, mcp), explanationKey(query, { ...mcp }));
  assert.equal(documentationSelection(mcp).repositoryUrl, mcp.repositoryUrl); assert.ok(hasDocumentation({ repositoryUrl: mcp.repositoryUrl }));
});

test('irrelevant pages have no capability claims; malformed, invented and crossed citations are rejected', () => {
  const evidence = parseSource(source()).evidence;
  assert.deepEqual(validateGoalExplanation({ sourceFit: 'unclear', capabilities: [], checks: [] }, evidence).capabilities, []);
  const good = response({ evidence });
  const verified = validateGoalExplanation(good, evidence);
  assert.equal(verified.capabilities[0].citations[0].quote, evidence[0].excerpt);
  assert.equal(verified.capabilities[0].citations[0].evidenceId, evidence[0].id);
  assert.throws(() => validateGoalExplanation({ ...good, capabilities: [{ ...good.capabilities[0], citations: [{ quote: 'model-authored quotation' }] }] }, evidence), { code: 'AI_INVALID_RESULT' });
  assert.throws(() => validateGoalExplanation({ ...good, sourceFit: 'unclear' }, evidence), { code: 'AI_INVALID_RESULT' });
  assert.throws(() => validateGoalExplanation({ ...good, summary: 'This is not an API' }, evidence), { code: 'AI_INVALID_RESULT' });
  good.capabilities[0].evidenceIds = ['unknown'];
  assert.throws(() => validateGoalExplanation(good, evidence), { code: 'AI_INVALID_RESULT' });
  assert.equal(validateGoalExplanation(good, evidence, { withholdInvalid: true }).withheldStatements, 1);
  const a = parseSource(source()); const b = parseSource({ ...source(readme), contentType: 'text/markdown' });
  const contexts = handoffContext([a, b], query);
  const result = { integrations: Object.fromEntries(contexts.map(c => [c.id, response(c)])) };
  result.integrations.c2.capabilities[0].evidenceIds = result.integrations.c1.capabilities[0].evidenceIds;
  assert.throws(() => validateHandoff(result, [a, b], contexts), { code: 'AI_INVALID_RESULT' });
});

test('credential-like documentation excerpts are not sent; project credentials still fail', () => {
  const analysis = parseSource(source()); analysis.evidence.push({ id: 'secret', excerpt: 'Bearer ' + 'synthetic'.repeat(8), location: 'example' });
  const context = explanationContext(analysis, query);
  assert.equal(context.coverage.omittedSensitiveExcerpts, 1); assert.ok(context.evidence.every(e => e.id !== 'secret'));
  assert.throws(() => explanationContext(analysis, 'Bearer ' + 'synthetic'.repeat(8)), { code: 'AI_SENSITIVE_INPUT' });
});

test('HTTP summary and mixed brief carry original goal, API/MCP identity and source lineage', async t => {
  const seen = [];
  const ai = { summarize: async (analysis, options, request) => { seen.push({ task: 'summary', request, kind: analysis.integration.kind }); return response(explanationContext(analysis, request)); },
    handoff: async (request, analyses) => { seen.push({ task: 'handoff', request, kinds: analyses.map(a => a.integration.kind) }); const contexts = handoffContext(analyses, request); return validateHandoff({ integrations: Object.fromEntries(contexts.map(c => [c.id, response(c)])) }, analyses, contexts); } };
  const app = createApp({ ai, parser: parseSource, fetcher: async url => url.includes('api.github.com') ? { ...source(readme), url, contentType: 'text/plain' } : { ...source(), url } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { app.locals.dispose(); server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const post = (path, body) => fetch(`http://127.0.0.1:${server.address().port}/api/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, ...opts }) });
  const summary = await (await post('summaries', { query, integration: mcp })).json();
  assert.equal(summary.query, query); assert.equal(summary.title, mcp.name); assert.equal(summary.integrationKind, 'mcp');
  const brief = await (await post('build-briefs', { query, integrations: [mcp, { kind: 'api', name: 'Parking', specificationUrl: 'https://docs.example.com/parking.json' }] })).json();
  assert.deepEqual(seen[1], { task: 'handoff', request: query, kinds: ['mcp', 'api'] });
  assert.match(exportHandoff(brief), /MCP server/); assert.match(exportHandoff(brief), /How you could use it/);
  assert.equal((await post('summaries', { query: 'x'.repeat(1001), integration: mcp })).status, 400);
  assert.equal(seen.length, 2);
});
