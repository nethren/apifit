import { createApp } from './app.mjs';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { AiBudget } from './ai-budget.mjs';
import { ClaudeClient } from './ai-client.mjs';
import { AiService } from './ai-service.mjs';
import { runtimeConfig } from './runtime-config.mjs';
import { runtimeCredential } from './runtime-credential.mjs';
import { Catalog } from './catalog.mjs';

const config = runtimeConfig();
const credential = runtimeCredential(config);
const frontend = fileURLToPath(new URL('../dist/', import.meta.url));
if (config.mode === 'hosted' && !existsSync(join(frontend, 'index.html'))) throw new Error('Build the frontend before starting hosted mode.');
const budget = new AiBudget(join(config.dataDir, 'ai-budget.json'));
const ai = config.aiEnabled ? new AiService({ budget, credentialStatus: credential.status, client: new ClaudeClient({ budget, keyProvider: credential.read }) }) : null;
const catalog = new Catalog({ indexed: true, indexFile: join(config.dataDir, 'mcp-index.json') });
const app = createApp({ ai, catalog, hosting: config.hosting, frontendDir: existsSync(join(frontend, 'index.html')) ? frontend : null });
const server = app.listen(config.port, config.host, () => {
  console.log(config.mode === 'hosted' ? 'APIFit hosted preview started. HTTPS ingress and access protection are required.' : `APIFit ready at http://127.0.0.1:${config.port}. Local only.`);
  void catalog.warmIndex().catch(() => { /* Source status reports incomplete coverage. */ });
});
server.once('close', app.locals.dispose);
server.headersTimeout = 10000;
server.requestTimeout = 30000;
server.keepAliveTimeout = 5000;
server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'That port is in use. Choose another APIFIT_PORT.' : 'The backend could not start.'); app.locals.dispose(); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  server.close(); server.closeAllConnections();
  setTimeout(() => process.exit(), 1000).unref();
});
