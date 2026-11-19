import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareCatalog } from '../scripts/build-catalog.mjs';

test('build reuses a complete snapshot within the hosted daily freshness window', async () => {
  let refreshed = 0;
  const index = { load: async () => {}, complete: true, entries: new Map([['a', {}]]), updatedAt: 1000,
    refresh: async () => { refreshed++; } };
  await prepareCatalog({ index }, () => 1000 + 7200000);
  assert.equal(refreshed, 0);
});
test('build rejects failed refreshes even when an older complete snapshot survives', async () => {
  const index = { load: async () => {}, complete: true, entries: new Map([['a', {}]]), updatedAt: 1000,
    async refresh() { this.warning = 'upstream unavailable'; } };
  await assert.rejects(prepareCatalog({ index }, () => 1000 + 86400000), /refresh failed/);
});
test('build requires complete nonempty coverage after downloading a new snapshot', async () => {
  const index = { load: async () => {}, complete: false, entries: new Map(), updatedAt: 0,
    async refresh() { this.complete = true; this.entries.set('a', {}); } };
  await prepareCatalog({ index });
  index.complete = false; index.refresh = async () => {};
  await assert.rejects(prepareCatalog({ index }), /coverage is incomplete/);
});
