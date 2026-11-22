import { fileURLToPath, pathToFileURL } from 'node:url';
import { Catalog } from '../server/catalog.mjs';
import { McpIndex } from '../server/catalog-index.mjs';

// Public metadata only, fetched through the same SSRF-safe network boundary.
// Runs during build, not as detached work inside a serverless request.
export async function prepareCatalog(catalog, now = Date.now) {
  await catalog.index.load();
  // Match the hosted daily freshness window. Rebuilding code should not force
  // another full registry download when today's complete snapshot is already here.
  if (!catalog.index.complete || now() - catalog.index.updatedAt >= 86400000) {
    await catalog.index.refresh();
    if (catalog.index.warning) throw new Error('Registry refresh failed; the previous deployment remains the release candidate. Retry later.');
  }
  if (!catalog.index.complete || !catalog.index.entries.size) throw new Error('Registry coverage is incomplete; refusing to deploy a reduced catalogue.');
}

// A completed download is not necessarily loadable: the write can fail or the
// file can exceed the runtime's bounds. Either would leave a live API returning
// 503, so read it back through the runtime's loader before allowing a deploy.
export async function verifySnapshot(file, expected, options = {}) {
  const index = new McpIndex({ file, readOnly: true, ...options });
  try {
    await index.load();
    if (!index.complete || !index.entries.size || index.entries.size !== expected) throw new Error('The catalogue snapshot cannot be loaded at runtime; check the index limits. Refusing to deploy it.');
  } finally { index.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = fileURLToPath(new URL('../generated/mcp-index.json', import.meta.url));
  const catalog = new Catalog({ indexed: true, indexFile: file, indexOptions: {
    // Use the same bounded index capacity as runtime snapshot loading.
    refreshTimeoutMs: 840000,
    onProgress: ({ pages, entries }) => { if (pages % 25 === 0) console.log(`Registry download: ${pages} pages, ${entries} entries.`); },
  } });
  // Build-only hard deadline; never let lingering network handles hang CI.
  const deadline = setTimeout(() => { console.error('Catalogue build exceeded 15 minutes; deployment stopped.'); process.exit(1); }, 900000).unref();
  try {
    await prepareCatalog(catalog);
    await verifySnapshot(file, catalog.index.entries.size);
    console.log(`Public MCP snapshot: ${catalog.index.entries.size} entries across ${catalog.index.pages} pages.`);
  } finally { clearTimeout(deadline); catalog.close(); }
}
