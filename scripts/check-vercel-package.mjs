import assert from 'node:assert/strict';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

// Run after `vercel build`, before uploading a prebuilt deployment. Inspect
// both physical files and Vercel's external file references; never print data.
const root = resolve('.vercel/output');
const forbidden = /(^|\/)(?:\.local|\.git|vercel-auth)(?:\/|$)|(^|\/)\.env(?:\.|$)|(^|\/)ai-budget\.json$/;
const paths = [];
async function visit(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await visit(path);
    else paths.push(path);
  }
}
await visit(root);
for (const path of paths) assert.ok(!forbidden.test(relative(root, path)), 'Deployment contains a forbidden local file.');
const functionDir = join(root, 'functions/api/index.func');
const config = JSON.parse(await readFile(join(functionDir, '.vc-config.json'), 'utf8'));
for (const [target, source] of Object.entries(config.filePathMap ?? {})) {
  for (const value of [target, source]) {
    assert.ok(!forbidden.test(value) && !value.split('/').includes('..') && !value.startsWith('/'), 'Deployment references a forbidden file.');
  }
  assert.ok((await stat(resolve(source))).isFile(), 'A referenced deployment file is missing.');
}
for (const target of ['server/parse-worker.mjs', 'generated/mcp-index.json']) {
  const path = config.filePathMap?.[target] ? resolve(config.filePathMap[target]) : join(functionDir, target);
  assert.ok((await stat(path)).isFile(), 'A required runtime asset is missing.');
}
assert.match(config.runtime, /^nodejs(?:22|24)\.x$/);
assert.equal(config.maxDuration, 300);
assert.equal(Object.keys(config.environment ?? {}).length, 0, 'Secrets must be runtime settings, not embedded in the package.');
console.log('Vercel package passed: required runtime assets present; local files and embedded environment values excluded.');
