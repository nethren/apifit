import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpIndex, INDEX_LIMITS } from '../server/catalog-index.mjs';
import { verifySnapshot } from '../scripts/build-catalog.mjs';

test('serverless runtime can load a complete registry larger than the old 100000-record cap', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apifit-registry-capacity-'));
  const file = join(directory, 'index.json');
  const entries = Array.from({ length: 100001 }, (_, i) => ({ id: `mcp-${i}`, kind: 'mcp', product: `product-${i}`, name: `Server ${i}`, description: 'Public metadata' }));
  let calls = 0;
  const index = new McpIndex({ file, readOnly: true, fetcher: async () => { calls++; throw new Error('Unexpected network'); }, normalize: () => [] });
  try {
    await writeFile(file, JSON.stringify({ version: 1, updatedAt: Date.now(), complete: true, pages: 1001, entries }));
    await index.load();
    const view = await index.view();
    assert.equal(view.entries.length, 100001);
    assert.equal(view.partial, false);
    assert.equal(calls, 0);
  } finally { index.close(); await rm(directory, { recursive: true, force: true }); }
});

test('a refresh completes past the old 1000-page and 100000-record caps', async () => {
  let page = 0;
  const index = new McpIndex({
    fetcher: async () => { page++; return { text: JSON.stringify({ page, metadata: page < 1100 ? { nextCursor: `c${page}` } : {} }) }; },
    normalize: data => Array.from({ length: 100 }, (_, i) => ({ id: `mcp-${data.page}-${i}` })),
  });
  try {
    await index.refresh();
    assert.equal(index.complete, true);
    assert.equal(index.warning, null);
    assert.equal(index.pages, 1100);
    assert.equal(index.entries.size, 110000);
  } finally { index.close(); }
});

test('the build refuses any snapshot the runtime could not load', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apifit-registry-verify-'));
  const file = join(directory, 'index.json');
  const entries = [{ id: 'mcp-1', kind: 'mcp', product: 'product-1', name: 'Server 1', description: 'Public metadata' }];
  try {
    await assert.rejects(verifySnapshot(file, 1), /cannot be loaded at runtime/); // silent write failure
    await writeFile(file, JSON.stringify({ version: 1, updatedAt: Date.now() - 1000, complete: true, pages: 1, entries }));
    await verifySnapshot(file, 1);
    await assert.rejects(verifySnapshot(file, 2), /cannot be loaded at runtime/); // stale or truncated file
    await assert.rejects(verifySnapshot(file, 1, { maxBytes: 20 }), /cannot be loaded at runtime/);
    await assert.rejects(verifySnapshot(file, 1, { maxRecords: 0 }), /cannot be loaded at runtime/);
    // Leave room for dependencies inside the 250 MB function bundle.
    assert.ok(INDEX_LIMITS.maxBytes <= 200 * 1024 * 1024);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
