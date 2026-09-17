import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, lstatSync } from 'node:fs';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))];
const errors = [];
const forbidden = /(^|\/)(?:node_modules|dist|\.local|coverage|test-results|playwright-report|\.git|output)(?:\/|$)|(^|\/)\.env(?:\.|$)/;
const secrets = [/sk-ant-[A-Za-z0-9_-]{32,}/, /gh[pousr]_[A-Za-z0-9]{30,}/, /github_pat_[A-Za-z0-9_]{30,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
const privatePath = /\/(?:Users|home)\/[A-Za-z0-9._-]+\//;
for (const file of files) {
  const path = resolve(root, file);
  if (forbidden.test(file) && file !== '.env.example') errors.push(`${file}: private/generated artifact must not be published`);
  if (!existsSync(path)) { errors.push(`${file}: tracked file is missing`); continue; }
  if (lstatSync(path).isSymbolicLink()) { errors.push(`${file}: review symbolic link before publication`); continue; }
  const data = readFileSync(path);
  if (data.length > 5 * 1024 * 1024) errors.push(`${file}: file exceeds the 5 MiB review limit`);
  if (data.includes(0)) continue;
  const text = data.toString('utf8');
  // Report filenames only, never the matched value or surrounding secret text.
  if (secrets.some(pattern => pattern.test(text))) errors.push(`${file}: possible secret needs private review`);
  if (privatePath.test(text)) errors.push(`${file}: machine-specific path needs removal`);
  if (!file.endsWith('.md')) continue;
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const raw = match[1].trim();
    if (/^(?:[a-z][a-z0-9+.-]*:|#)/i.test(raw)) continue;
    let target;
    try { target = decodeURIComponent(raw.split(/\s+"/)[0].replace(/^<|>$/g, '').split(/[?#]/)[0]); }
    catch { errors.push(`${file}: malformed relative Markdown link`); continue; }
    if (!target) continue;
    const destination = resolve(dirname(path), target);
    const location = relative(root, destination);
    if (isAbsolute(target) || location.startsWith('..') || !existsSync(destination)) errors.push(`${file}: relative Markdown link is missing or outside repository`);
  }
}
if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
else console.log(`Repository hygiene passed: ${files.length} candidate files; no detected secrets, private paths, forbidden artifacts or broken relative Markdown links.`);
