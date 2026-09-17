import { fileURLToPath } from 'node:url';
import { AiBudget } from '../server/ai-budget.mjs';
import { ClaudeClient } from '../server/ai-client.mjs';
import { AiService, AI_CONSENT } from '../server/ai-service.mjs';
import { keychainStatus, readAnthropicKey } from '../server/ai-keychain.mjs';
import { AI_CONFIG } from '../server/ai-config.mjs';
import { AI_EVAL_CASES } from '../tests/ai-eval-cases.mjs';

// Never run as part of npm test/build. Only public fictional inputs are used.
if (!process.argv.includes('--confirm-paid')) {
  console.log('Not run. After storing a fresh replacement key, use npm run ai:eval -- --confirm-paid to charge the existing US$5 development ledger for synthetic quality checks.');
} else {
  const budget = new AiBudget(fileURLToPath(new URL('../.local/ai-budget.json', import.meta.url)));
  const service = new AiService({ budget, credentialStatus: keychainStatus, client: new ClaudeClient({ budget, keyProvider: readAnthropicKey }) });
  const start = await budget.status(); const timings = []; let passed = 0; let completed = 0;
  try {
    for (const [i, item] of AI_EVAL_CASES.entries()) {
      const analysis = { id: `eval-${i}`, kind: 'analysis', revision: `fictional-${i}`, title: 'Fictional evaluation document', source: { url: 'https://example.com/fictional-evaluation', fetchedAt: new Date().toISOString() },
        coverage: { status: 'synthetic-evaluation-excerpt' }, unknowns: ['Fictional test, not a real provider. No operation or account was tested.'], capabilities: [], evidence: [{ id: `ev_${i}`, location: 'synthetic-excerpt', excerpt: item.excerpt }] };
      const before = performance.now();
      const result = await service.assessment({ analyses: [analysis], confirmed: true, requirements: [{ id: 'r1', priority: 'must', text: item.requirement }] }, { ai: true, aiConsent: AI_CONSENT });
      timings.push(performance.now() - before); completed++;
      const actual = result.candidates[0].findings[0].status;
      if (actual === item.expected) passed++;
      console.log(`${actual === item.expected ? 'PASS' : 'FAIL'}: ${item.name} — expected ${item.expected}, received ${actual}.`);
    }
  } catch (error) { console.error(`Evaluation stopped: ${error.code?.startsWith('AI_') ? error.message : 'Unexpected local evaluation failure.'}`); process.exitCode = 1; }
  const end = await budget.status(); const sorted = timings.toSorted((a, b) => a - b);
  console.log(JSON.stringify({ model: AI_CONFIG.model, completed, passed, total: AI_EVAL_CASES.length, medianLatencyMs: sorted.length ? Math.round(sorted[Math.floor(sorted.length / 2)]) : null,
    chargedOrReservedUsd: Number(((end.chargedOrReservedUsd ?? 0) - (start.chargedOrReservedUsd ?? 0)).toFixed(6)), remainingUsd: end.remainingUsd,
    limitation: 'Small synthetic status/guardrail suite, not broad quality, multilingual or production validation. No raw outputs or private prompts recorded.' }, null, 2));
  if (passed !== AI_EVAL_CASES.length) process.exitCode = 1;
}
