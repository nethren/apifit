import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { palettes, defaultPalette } from '../src/palettes.mjs';

const css = readFileSync(new URL('../src/palettes.css', import.meta.url), 'utf8');
const appearance = readFileSync(new URL('../src/appearance.css', import.meta.url), 'utf8');
const tokensFrom = body => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})\s*;/gi)].map(([, key, value]) => [key, value]));
const sharedLight = tokensFrom(appearance.match(/:root\s*\{([^}]+)\}/)[1]);
const sharedDark = tokensFrom(appearance.match(/:root\[data-mode="dark"\]\s*\{([^}]+)\}/)[1]);
const darkBlocks = new Map([...appearance.matchAll(/:root\[data-palette="([^"]+)"\]\[data-mode="dark"\]\s*\{([^}]+)\}/g)].map(([, id, body]) => [id, tokensFrom(body)]));
const blocks = new Map([...css.matchAll(/:root\[data-palette="([^"]+)"\]\s*\{([^}]+)\}/g)].map(([, id, body]) => [id,
  Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[a-f\d]{6})\s*;/gi)].map(([, key, value]) => [key, value]))]));
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const n = parseInt(channel, 16) / 255;
    return n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function check(tokens, foreground, background, minimum) {
  const ratio = contrast(tokens[foreground], tokens[background]);
  assert.ok(ratio >= minimum, `${foreground} on ${background}: ${ratio.toFixed(2)}:1; requires ${minimum}:1`);
}

test('the selected palette has complete CSS tokens and a valid CSS-only default', () => {
  assert.deepEqual(palettes.map(item => item.id), ['yacht']);
  assert.deepEqual([...blocks.keys()], palettes.map(item => item.id));
  assert.deepEqual([...darkBlocks.keys()], palettes.map(item => item.id));
  assert.equal(new Set(palettes.map(item => item.id)).size, palettes.length);
  assert.match(css, new RegExp(`:root, :root\\[data-palette="${defaultPalette}"\\]`));
  const keys = Object.keys(blocks.get(defaultPalette)).sort();
  for (const tokens of blocks.values()) assert.deepEqual(Object.keys(tokens).sort(), keys);
});

for (const { id, name } of palettes) for (const mode of ['light', 'dark']) {
  const tokens = { ...blocks.get(id), ...sharedLight, ...(mode === 'dark' ? { ...sharedDark, ...darkBlocks.get(id) } : {}) };
  test(`${name} / ${mode}: text and button pairings meet AA contrast thresholds`, () => {
    for (const surface of ['paper', 'surface', 'soft', 'secondary-soft']) {
      for (const text of ['ink', 'muted', 'brand-strong', 'accent-text']) check(tokens, text, surface, 4.5);
    }
    check(tokens, 'on-accent', 'accent', 4.5);
    check(tokens, 'on-accent', 'accent-hover', 4.5);
    check(tokens, 'secondary', 'secondary-soft', 4.5);
    check(tokens, 'headline', 'paper', 3);
    check(tokens, 'art-on-accent', 'art-accent', 4.5);
    check(tokens, 'toast-ink', 'toast-surface', 4.5);
    check(tokens, 'error-ink', 'error-surface', 4.5);
    check(tokens, 'warning-ink', 'warning-surface', 4.5);
    check(tokens, 'error-ink', 'surface', 4.5);
  });
  test(`${name} / ${mode}: focus and form boundaries meet 3:1 against adjacent surfaces`, () => {
    for (const surface of ['paper', 'surface', 'soft']) {
      check(tokens, 'focus', surface, 3);
    }
    for (const surface of ['paper', 'surface']) check(tokens, 'control-border', surface, 3);
  });
}

test('Yacht preserves pearl light mode and pairs near-black dark mode with sea glass', () => {
  for (const tokens of blocks.values()) {
    assert.equal(tokens.paper, '#f7faf9');
    assert.equal(tokens.surface, '#ffffff');
    assert.equal(tokens['art-accent'], '#afcbc4');
    assert.equal(tokens.accent, '#245f73');
  }
  assert.equal(sharedDark.paper, '#0c0e0f');
  assert.equal(sharedDark.surface, '#171b1d');
  assert.equal(darkBlocks.get(defaultPalette)['art-accent'], '#9bbab4');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<html[^>]+data-mode="dark"/);
  assert.match(html, new RegExp(`<meta name="theme-color" content="${sharedDark.paper}"`));
  assert.ok(html.indexOf('src="/appearance.js"') < html.indexOf('<body>'), 'Preferences load before the body is painted');
  const favicon = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
  assert.ok(favicon.includes(sharedDark.paper), 'Browser icon uses the near-black background');
  assert.ok(favicon.includes(darkBlocks.get(defaultPalette)['art-accent']), 'Browser icon uses sea glass');
});
