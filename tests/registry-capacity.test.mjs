import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpIndex } from '../server/catalog-index.mjs';

test('serverless runtime can load a complete registry larger than the old 40000-record cap', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'apifit-registry-capacity-'));
  const file = join(directory, 'index.json');
  const entries = Array.from({ length: 40001 }, (_, i) => ({ id: `mcp-${i}`, kind: 'mcp', product: `product-${i}`, name: `Server ${i}`, description: 'Public metadata' }));
  let calls = 0;
  const index = new McpIndex({ file, readOnly: true, fetcher: async () => { calls++; throw new Error('Unexpected network'); }, normalize: () => [] });
  try {
    await writeFile(file, JSON.stringify({ version: 1, updatedAt: Date.now(), complete: true, pages: 401, entries }));
    await index.load();
    const view = await index.view();
    assert.equal(view.entries.length, 40001);
    assert.equal(view.partial, false);
    assert.equal(calls, 0);
  } finally { index.close(); await rm(directory, { recursive: true, force: true }); }
});
