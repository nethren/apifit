import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { exportHandoff } from '../shared/brief-export.mjs';
import { exportHandoff as serverExport } from '../server/search-ai.mjs';
import { MemoryStore } from '../server/store.mjs';

test('a generated brief stays downloadable from tab memory after the server record expires', async () => {
  let now = 0; const store = new MemoryStore({ now: () => now, ttlMs: 10 });
  try {
    const brief = store.put({ kind: 'build-brief', query: 'A fictional project', integrations: [], unreadable: [{ name: 'Missing source', message: 'No readable docs' }], nextSteps: ['Check the documentation.'] });
    const expected = serverExport(brief); now = 11;
    assert.throws(() => store.get(brief.id), { code: 'EXPIRED_RECORD' });
    assert.equal(await new Blob([exportHandoff(brief)]).text(), expected);
    assert.match(expected, /Documentation unavailable/);
    const app = await readFile(new URL('../src/SearchApp.jsx', import.meta.url), 'utf8');
    const download = app.slice(app.indexOf('async function downloadBrief'), app.indexOf('function submit'));
    assert.match(download, /exportHandoff\(brief\)/);
    assert.doesNotMatch(download, /fetch\(|api\(|withAi\(/);
  } finally { store.close(); }
});

test('shared export escapes untrusted markup and keeps the evidence/untested boundary', () => {
  const markdown = exportHandoff({ query: '<script>alert(1)</script> [click](javascript:evil)', integrations: [], nextSteps: ['<iframe>Do this</iframe>'], unreadable: [] });
  assert.ok(!markdown.includes('<script>') && !markdown.includes('<iframe>'));
  assert.ok(!markdown.includes('[click](javascript:evil)'));
  assert.match(markdown, /No API\/MCP operation was executed/);
});
