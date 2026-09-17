import express from 'express';
import { AppError, fail, publicError } from './errors.mjs';
import { fetchDocument, publicUrl } from './safe-fetch.mjs';
import { Catalog } from './catalog.mjs';
import { MemoryStore } from './store.mjs';
import { parseInWorker } from './parse-job.mjs';
import { draftRequirements, assess, exportBrief } from './assessment.mjs';
import { documentationSignal, exportHandoff } from './search-ai.mjs';
import { assertNoSecrets } from './ai-client.mjs';
import { integrationInput, readIntegration } from './integration-docs.mjs';
import { unavailableExplanation } from './source-quality.mjs';
import { inspectMcp } from './mcp-inspection.mjs';
import { RankingEvidence } from './ranking-evidence.mjs';
import { createHostedBoundary } from './hosted-boundary.mjs';

export function createApp({ fetcher = fetchDocument, parser = parseInWorker, inspector = inspectMcp, catalog = new Catalog({ fetcher, indexed: true }), rankingEvidence = new RankingEvidence({ fetcher, parser }), evidenceSearch = false, store = new MemoryStore(), maxRequests = 90, frontendDir = null, ai = null, hosting = null } = {}) {
  const app = express();
  // Route matching must agree with the case-sensitive API quota classification.
  app.set('case sensitive routing', true);
  const pending = new Map();
  const clearSession = owner => { for (const [controller, jobOwner] of pending) if (jobOwner === owner) controller.abort(); store.clear(owner); };
  const hosted = hosting === null ? null : createHostedBoundary(hosting, { onExpire: clearSession });
  app.locals.dispose = () => { for (const controller of pending.keys()) controller.abort(); hosted?.close(); store.close(); catalog.close?.(); rankingEvidence.close?.(); };
  app.disable('x-powered-by');
  app.set('etag', false);
  let windowStart = Date.now(); let requestCount = 0; let activeJobs = 0;
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Referrer-Policy': 'no-referrer' });
    if (hosted) return hosted.middleware(req, res, next);
    // No proxy trust: Host must match the actual loopback listener, protecting
    // this unauthenticated local service against browser DNS rebinding.
    const allowed = [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`];
    const host = req.headers.host;
    if (!allowed.includes(host)) return next(new AppError('INVALID_HOST', 'Use the local APIFit address.', 403));
    if (req.headers.origin && req.headers.origin !== `http://${host}` || req.headers['sec-fetch-site'] === 'cross-site') return next(new AppError('CROSS_ORIGIN', 'Cross-origin requests to this local service are not allowed.', 403));
    next();
  });
  app.use((req, res, next) => {
    if (Date.now() - windowStart >= 60000) { requestCount = 0; windowStart = Date.now(); }
    // Assets and anonymous liveness probes must not consume hosted API capacity.
    if ((!hosted || req.path.startsWith('/api/')) && ++requestCount > maxRequests) { res.set('Retry-After', '60'); return next(new AppError('RATE_LIMIT', 'Too many requests. Try again in a minute.', 429)); }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) return next(new AppError('JSON_REQUIRED', 'Send an application/json request body.', 415));
    next();
  });
  app.use(express.json({ limit: '64kb', strict: true }));
  const job = handler => async (req, res, next) => {
    if (hosted && [...pending.values()].filter(owner => owner === req.sessionId).length >= 2) return next(new AppError('BUSY', 'Two jobs are already running in this session. Try again shortly.', 429));
    if (activeJobs >= 4) return next(new AppError('BUSY', 'Four discovery/analysis jobs are already running. Try again shortly.', 429));
    activeJobs++;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    pending.set(controller, req.sessionId ?? null); req.jobSignal = controller.signal; res.once('close', cancel);
    try { await handler(req, res); } catch (error) { next(error); } finally { activeJobs--; pending.delete(controller); res.off('close', cancel); }
  };
  const put = (req, value) => store.put(value, req.sessionId ?? null);
  const record = (req, id, kind) => { const value = store.get(id, req.sessionId ?? null); if (value.kind !== kind) fail('RECORD_TYPE', 'This record is not the requested type.', 404); return value; };
  const aiOptions = req => {
    if (!ai) fail('AI_NOT_READY', 'AI assistance is not configured on this server.', 503);
    hosted?.admitAi(req);
    return { ai: req.body.ai, aiConsent: req.body.aiConsent, signal: req.jobSignal };
  };
  const preflightAi = async options => {
    // Check consent/readiness before potentially costly documentation retrieval.
    // authorized performs no model call itself; the final generation rechecks it.
    if (typeof ai?.authorized === 'function') await ai.authorized(options, async () => {});
    else if (hosted) fail('AI_NOT_READY', 'AI assistance is not configured for this preview.', 503);
  };
  const projectQuery = value => {
    if (typeof value !== 'string' || !value.trim() || value.length > 1000) fail('INVALID_SEARCH', 'Describe what you want to build in up to 1,000 characters.');
    assertNoSecrets(value); return value.trim();
  };
  const discover = async (req, query, request, options, signal) => {
    const result = await catalog.search({ ...request, query, limit: 24 }, { signal });
    signal.throwIfAborted();
    const candidates = evidenceSearch && options && result.items.length ? await rankingEvidence.enrich(result.items, query, { signal, searchQueries: request.queries }) : result.items;
    const ranked = options && candidates.length ? await ai.rank(query, candidates, options) : { items: candidates.map(item => ({ ...item, signals: documentationSignal(item) })), uncovered: [] };
    if (options && !ranked.items.length && request.constraints?.some(c => c.mode === 'include' && (c.scope === 'product' || candidates.length === 1))) {
      // A literal product finder should still surface the named listing when its
      // requested capability is not established. This is not a fit endorsement.
      ranked.items = candidates.slice(0, 3).map(item => ({ ...item, rankingOrder: 'relevance-first-v3', signals: documentationSignal(item),
        match: { tier: 'partial', reason: 'Matches the requested product name. Its fit for this feature still needs checking.', gap: '', basis: 'Identity-only directory lead; requested capability not established.' } }));
    }
    signal.throwIfAborted();
    const nextRequest = result.pagination.nextOffset !== null ? { ...request, offset: result.pagination.nextOffset }
      : result.pagination.nextMcpCursor ? { ...request, source: 'mcp', offset: 0, mcpCursor: result.pagination.nextMcpCursor } : null;
    return put(req, { kind: 'discovery', query, ...ranked, sources: result.sources, nextRequest,
      ranking: { mode: options ? 'ai-ranked-directory-leads' : 'keyword-search', experimentalEvidenceSearch: evidenceSearch, reviewed: result.items.length, documentationRead: candidates.filter(c => c.rankingEvidence?.status === 'documentation-read').length, matchesInLoadedMetadata: result.pagination.matchesInLoadedMetadata, reliability: evidenceSearch ? 'Selected documentation informs ordering; operational reliability has not been measured.' : 'Documentation links inform ordering; operational reliability has not been measured.' }, coverage: result.coverage });
  };

  if (!frontendDir) app.get('/', (_req, res) => res.json({ product: 'APIFit', stage: 'backend-foundation', frontend: 'not-mounted', health: '/api/health' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', version: '0.2.0', capabilities: { apiDirectory: 'live-adapter', mcpRegistry: 'live-paginated-adapter', documentation: ['OpenAPI 3.0', 'OpenAPI 3.1', 'Swagger 2.0', 'HTML excerpts'], aiInterpretation: ai ? 'opt-in-anthropic' : 'not-configured', webSearch: 'not-configured', postman: 'out-of-scope', frontend: frontendDir ? 'local-interface' : 'not-mounted' }, storage: { type: 'in-memory', ttlMinutes: 15, maxRecords: 100 }, network: 'public documentation retrieval; optional consented Anthropic interpretation; no integration execution' }));
  app.get('/api/ai/status', async (_req, res, next) => { try { res.json(ai ? await ai.status() : { configured: false, ready: false }); } catch (error) { next(error); } });
  app.post('/api/search', job(async (req, res) => { const result = await catalog.search(req.body, { signal: req.jobSignal }); if (!req.jobSignal.aborted) res.json(result); }));
  app.post('/api/discover', job(async (req, res) => {
    const query = projectQuery(req.body.query); const source = req.body.source || 'api';
    if (!['api', 'mcp', 'all'].includes(source)) fail('INVALID_SEARCH', 'Choose APIs, MCP servers or all sources.');
    const options = req.body.ai === true ? aiOptions(req) : null;
    const plan = options ? (evidenceSearch && ai.searchPlan ? await ai.searchPlan(query, options) : { queries: await ai.searchQueries(query, options), constraints: [] }) : undefined;
    const queries = plan?.queries;
    req.jobSignal.throwIfAborted();
    if (queries && !queries.length) return res.json({ query, items: [], sources: [], nextRequest: null, ranking: { mode: 'needs-api-request', reviewed: 0 }, uncovered: ['Describe an API capability or the product you want to build.'] });
    res.json(await discover(req, query, { source, ...(queries ? { queries, constraints: plan.constraints, mcpPages: 3 } : {}) }, options, req.jobSignal));
  }));
  app.post('/api/discover/:id/more', job(async (req, res) => {
    const previous = record(req, req.params.id, 'discovery');
    if (!previous.nextRequest) fail('NO_MORE_RESULTS', 'There are no more entries in this source view.');
    const options = req.body.ai === true ? aiOptions(req) : null;
    res.json(await discover(req, previous.query, previous.nextRequest, options, req.jobSignal));
  }));
  app.post('/api/summaries', job(async (req, res) => {
    const options = aiOptions(req);
    const query = req.body.query === undefined || req.body.query === '' ? '' : projectQuery(req.body.query);
    const selection = integrationInput(req.body.integration || { url: req.body.url });
    await preflightAi(options);
    const analysis = await readIntegration(selection, query, { fetcher, parser, inspector, signal: req.jobSignal });
    const summary = analysis.documentationStatus.state === 'unavailable' ? unavailableExplanation() : await ai.summarize(analysis, options, query);
    if (!req.jobSignal.aborted) res.json(put(req, { kind: 'summary', query, title: analysis.integration.name, integrationKind: analysis.integration.kind,
      documentationStatus: analysis.documentationStatus, documentationNote: analysis.documentationNote, source: analysis.source, evidence: analysis.evidence, summary }));
  }));
  app.post('/api/build-briefs', job(async (req, res) => {
    const query = projectQuery(req.body.query);
    const raw = req.body.integrations ?? (Array.isArray(req.body.urls) ? req.body.urls.map(url => ({ url })) : null);
    if (!Array.isArray(raw) || !raw.length || raw.length > 5) fail('INVALID_CANDIDATES', 'Choose 1–5 integrations with public documentation.');
    const selections = raw.map(integrationInput);
    if (new Set(selections.map(s => JSON.stringify(s))).size !== selections.length) fail('INVALID_CANDIDATES', 'Choose distinct integrations.');
    const unlinked = req.body.unlinked || [];
    if (!Array.isArray(unlinked) || unlinked.length + selections.length > 5 || unlinked.some(name => typeof name !== 'string' || !name.trim() || name.length > 200)) fail('INVALID_CANDIDATES', 'Choose at most five integrations with valid names.');
    assertNoSecrets(unlinked);
    // Reject unsafe links before fetching or storing any partial-result record.
    const options = aiOptions(req); const analyses = []; const unreadable = unlinked.map(name => ({ name, message: 'No documentation link was available. Check this integration before building.' }));
    await preflightAi(options);
    for (const selection of selections) {
      req.jobSignal.throwIfAborted();
      try {
        const analysis = await readIntegration(selection, query, { fetcher, parser, inspector, signal: req.jobSignal });
        if (analysis.documentationStatus.state === 'available') analyses.push(analysis);
        else unreadable.push({ name: selection.name || analysis.title, url: analysis.source.url, message: 'Capabilities couldn’t be verified. No AI summary was generated for this integration.' });
      }
      catch (error) { req.jobSignal.throwIfAborted(); unreadable.push({ name: selection.name, url: selection.url || selection.repositoryUrl || selection.specificationUrl || selection.documentationUrl, message: publicError(error).message }); }
    }
    if (!analyses.length) fail('NO_READABLE_DOCS', 'Capabilities couldn’t be verified for these selections. No AI credits were used and no build brief was generated.', 422);
    const result = await ai.handoff(query, analyses, options);
    if (!req.jobSignal.aborted) res.status(201).json(put(req, { kind: 'build-brief', query, ...result, unreadable }));
  }));
  app.get('/api/build-briefs/:id/download', (req, res) => res.type('text/markdown').set('Content-Disposition', 'attachment; filename="apifit-build-brief.md"').send(exportHandoff(record(req, req.params.id, 'build-brief'))));
  app.post('/api/analyses', job(async (req, res) => {
    const { url, offset = 0, limit = 100 } = req.body;
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) fail('INVALID_PAGE', 'Use a valid offset and a page size between 1 and 100.');
      if (req.body.ai === true) await preflightAi(aiOptions(req));
      const source = await fetcher(url, { signal: req.jobSignal });
      if (req.jobSignal.aborted) return;
      const analysis = await parser(source, { offset, limit });
      if (req.body.ai === true) analysis.aiExplanation = await ai.explain(analysis, aiOptions(req));
      if (!req.jobSignal.aborted) res.status(201).json(put(req, analysis));
  }));
  app.get('/api/analyses/:id', (req, res) => res.json(record(req, req.params.id, 'analysis')));
  app.post('/api/requirements/draft', job(async (req, res) => {
    const options = req.body.ai === true ? aiOptions(req) : null;
    const result = options ? await ai.draft(req.body.text, options) : draftRequirements(req.body.text);
    if (!req.jobSignal.aborted) res.json(result);
  }));
  app.post('/api/assessments', job(async (req, res) => {
    const { analysisIds, requirements, confirmed } = req.body;
    if (!Array.isArray(analysisIds) || !analysisIds.length || analysisIds.length > 5 || analysisIds.some(id => typeof id !== 'string')) fail('INVALID_CANDIDATES', 'Choose between 1 and 5 analysis IDs.');
    const analyses = analysisIds.map(id => record(req, id, 'analysis'));
    const input = { requirements, confirmed, analyses };
    const options = req.body.ai === true ? aiOptions(req) : null;
    const result = options ? await ai.assessment(input, options) : assess(input);
    if (!req.jobSignal.aborted) res.status(201).json(put(req, result));
  }));
  app.get('/api/assessments/:id', (req, res) => res.json(record(req, req.params.id, 'assessment')));
  app.get('/api/assessments/:id/brief', (req, res) => {
    res.type('text/markdown').set('Content-Disposition', 'attachment; filename="apifit-decision-brief.md"').send(exportBrief(record(req, req.params.id, 'assessment')));
  });
  app.delete('/api/records/:id', (req, res) => { store.delete(req.params.id, req.sessionId ?? null); res.status(204).end(); });
  app.delete('/api/session', (req, res) => { clearSession(req.sessionId ?? null); res.status(204).end(); });
  if (frontendDir) app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
    return express.static(frontendDir, { dotfiles: 'deny', redirect: false })(req, res, next);
  });
  app.use((_req, _res, next) => next(new AppError('NOT_FOUND', 'This backend route does not exist.', 404)));
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    const safe = error.type === 'entity.too.large' ? { status: 413, code: 'BODY_TOO_LARGE', message: 'Keep requests under 64 KiB.' }
      : error.type === 'entity.parse.failed' ? { status: 400, code: 'INVALID_JSON', message: 'The request body must contain valid JSON.' } : publicError(error);
    res.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  });
  return app;
}
