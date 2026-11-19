import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

let checked = 0;
for (const directory of ['api', 'server', 'shared', 'scripts', 'tests']) {
  const entries = await readdir(new URL(`../${directory}/`, import.meta.url), { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(?:mjs|js)$/.test(entry.name)) continue;
    const file = new URL(`../${directory}/${entry.name}`, import.meta.url);
    const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { stdio: 'inherit' });
    if (result.status !== 0) process.exit(result.status || 1);
    checked++;
  }
}
console.log(`Backend syntax checked: ${checked} modules.`);
