import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { fail } from './errors.mjs';

const run = promisify(execFile);
export const keychainHelper = fileURLToPath(new URL('../.local/apifit-keychain', import.meta.url));
export async function keychainStatus() {
  if (process.platform !== 'darwin') return 'unsupported-platform';
  try { const { stdout } = await run(keychainHelper, ['status'], { timeout: 5000, maxBuffer: 1024 }); return ['stored', 'missing', 'locked-or-unavailable'].includes(stdout.trim()) ? stdout.trim() : 'unavailable'; }
  catch { return 'setup-required'; }
}
export async function readAnthropicKey() {
  if (process.platform !== 'darwin') fail('AI_KEY_REQUIRED', 'Secure local AI storage currently requires macOS Keychain.', 503);
  try {
    const { stdout } = await run(keychainHelper, ['read'], { timeout: 20000, maxBuffer: 1024 });
    const key = stdout.trim();
    if (!/^sk-ant-[A-Za-z0-9_-]{33,293}$/.test(key)) throw new Error();
    return key;
  } catch { fail('AI_KEY_REQUIRED', 'Save a replacement Anthropic key using the local secure setup, or unlock Keychain.', 503); }
}
