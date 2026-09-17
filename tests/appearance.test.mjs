import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { palettes, defaultPalette } from '../src/palettes.mjs';

const startup = readFileSync(new URL('../public/appearance.js', import.meta.url), 'utf8');
function initialise(saved, blocked = false) {
  const dataset = {};
  let meta;
  runInNewContext(startup, {
    localStorage: { getItem(key) { assert.equal(key, 'apifit.appearance'); if (blocked) throw new Error('Storage disabled'); return saved; } },
    document: { documentElement: { dataset }, querySelector() { return { setAttribute(name, value) { assert.equal(name, 'content'); meta = value; } }; } },
  });
  return { ...dataset, meta };
}

test('appearance defaults to dark Yacht before the first render', () => {
  assert.deepEqual(initialise(null), { palette: defaultPalette, mode: 'dark', meta: '#0c0e0f' });
});
test('every supported appearance preference survives startup', () => {
  for (const { id } of palettes) for (const mode of ['light', 'dark']) {
    assert.deepEqual(initialise(JSON.stringify({ palette: id, mode })), { palette: id, mode, meta: mode === 'dark' ? '#0c0e0f' : '#f7faf9' });
  }
});
test('retired palette choices migrate to Yacht without losing the saved mode', () => {
  for (const palette of ['jade', 'driftwood', 'frozen']) for (const mode of ['light', 'dark']) {
    assert.deepEqual(initialise(JSON.stringify({ palette, mode })), {
      palette: defaultPalette, mode, meta: mode === 'dark' ? '#0c0e0f' : '#f7faf9',
    });
  }
});
test('invalid or inaccessible stored appearance cannot block startup', () => {
  for (const value of ['not json', '{}', 'null', '7', '[]', '{"palette":"unknown","mode":"system"}']) {
    assert.deepEqual(initialise(value), initialise(null));
  }
  assert.deepEqual(initialise(null, true), initialise(null));
});
