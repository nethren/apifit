import { AiBudget } from '../server/ai-budget.mjs';
import { ClaudeClient } from '../server/ai-client.mjs';
import { readAnthropicKey } from '../server/ai-keychain.mjs';
import { evidenceContext, validateExplanation } from '../server/ai-service.mjs';
import { fetchDocument } from '../server/safe-fetch.mjs';
import { parseInWorker } from '../server/parse-job.mjs';
import { fileURLToPath } from 'node:url';

// Fixed public documentation only. Not part of npm test/build; no private inputs.
if (!process.argv.includes('--confirm-paid')) {
  console.log('Not run. Pass --confirm-paid to test a public weather specification using the existing US$5 AI ledger.');
} else {
  const budget = new AiBudget(fileURLToPath(new URL('../.local/ai-budget.json', import.meta.url)));
  const client = new ClaudeClient({ budget, keyProvider: readAnthropicKey });
  try {
    const source = await fetchDocument('https://api.apis.guru/v2/specs/visualcrossing.com/weather/4.6/openapi.json');
    const analysis = await parseInWorker(source, { limit: 20 });
    const context = evidenceContext(analysis); const started = performance.now();
    const output = await client.run('explain', context);
    let valid = true;
    try { validateExplanation(output, context.evidence); }
    catch { valid = false; process.exitCode = 1; }
    const checks = Object.fromEntries(Object.entries(output).map(([name, items]) => [name, Array.isArray(items) ? items.map(s => ({ text: s.text, textLength: s.text?.length, keys: Object.keys(s),
      citations: s.citations?.map(c => { const item = context.evidence.find(e => e.id === c.evidenceId); const exact = item?.excerpt.includes(c.quote); return { id: c.evidenceId, knownId: Boolean(item), quoteLength: c.quote?.length, exact,
        ...(!exact ? { rejectedQuote: c.quote, originalPublicExcerpt: item?.excerpt } : {}) }; }) })) : typeof items]));
    console.log(JSON.stringify({ valid, elapsedMs: Math.round(performance.now() - started), source: analysis.source.url, evidence: context.selectedEvidence, outputKeys: Object.keys(output), checks, budget: await budget.status() }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({ code: error.code || 'PUBLIC_SMOKE_ERROR', message: error.code?.startsWith('AI_') ? error.message : 'Public-document smoke check failed.' })); process.exitCode = 1;
  }
}
