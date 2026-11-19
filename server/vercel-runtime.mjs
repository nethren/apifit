import { fileURLToPath } from 'node:url';
import { createApp } from './app.mjs';
import { runtimeConfig } from './runtime-config.mjs';
import { runtimeCredential } from './runtime-credential.mjs';
import { RedisState } from './shared-state.mjs';
import { SharedBudget } from './shared-budget.mjs';
import { SealedStore } from './sealed-store.mjs';
import { createDistributedBoundary } from './distributed-boundary.mjs';
import { Catalog } from './catalog.mjs';
import { AiService } from './ai-service.mjs';
import { ClaudeClient } from './ai-client.mjs';

// Use only deployment-owned configuration, never Host or forwarded headers.
// Production always requires the explicitly configured custom-domain origin.
export function vercelRuntimeConfig(env) {
  let origin = env.APIFIT_PUBLIC_ORIGIN;
  if (!origin && env.VERCEL === '1' && env.VERCEL_ENV === 'preview'
    && typeof env.VERCEL_URL === 'string' && /^[a-z0-9-]+\.vercel\.app$/.test(env.VERCEL_URL)) {
    origin = `https://${env.VERCEL_URL}`;
  }
  return runtimeConfig({ ...env, APIFIT_PUBLIC_ORIGIN: origin,
    ...(env.VERCEL_ENV === 'preview' ? { APIFIT_AI_ENABLED: 'false' } : {}),
    APIFIT_DATA_DIR: '/unused-vercel-state' });
}

export async function createVercelApp(env = process.env) {
  if (env.APIFIT_MODE !== 'hosted') throw new Error('Vercel requires explicit hosted configuration.');
  // Reuse the traditional host/origin/credential checks. This directory is an
  // inert validation placeholder: Vercel never constructs a file-backed ledger.
  const config = vercelRuntimeConfig(env);
  const state = new RedisState({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
  const store = new SealedStore({ state, key: env.APIFIT_RECORD_SECRET });
  const boundary = createDistributedBoundary(config.hosting, state);
  const budget = new SharedBudget(state); const credential = runtimeCredential(config, { env });
  const ai = config.aiEnabled ? new AiService({ budget, credentialStatus: credential.status, client: new ClaudeClient({ budget, keyProvider: credential.read }) }) : null;
  const catalog = new Catalog({ indexed: true, indexFile: fileURLToPath(new URL('../generated/mcp-index.json', import.meta.url)), indexOptions: { readOnly: true, ttlMs: 86400000 } });
  await catalog.warmIndex();
  if (!catalog.index.complete || !catalog.index.entries.size) throw new Error('The complete public registry snapshot is missing. Rebuild before deploying.');
  return createApp({ ai, store, catalog, hosting: config.hosting, boundary });
}
