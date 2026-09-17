import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { keychainHelper, keychainStatus } from '../server/ai-keychain.mjs';

const run = promisify(execFile);
if (process.platform !== 'darwin') { console.error('This secure setup uses macOS Keychain.'); process.exit(1); }
try {
  if (process.argv.includes('--status')) console.log(`APIFit Keychain: ${await keychainStatus()}. No credential was read.`);
  else {
    const directory = fileURLToPath(new URL('../.local/', import.meta.url));
    await mkdir(directory, { recursive: true, mode: 0o700 });
    await chmod(directory, 0o700);
    await run('/usr/bin/swiftc', ['-O', fileURLToPath(new URL('./keychain.swift', import.meta.url)), '-o', keychainHelper], { timeout: 120000, maxBuffer: 16384 });
    await chmod(keychainHelper, 0o700);
    const { stdout } = await run(keychainHelper, ['store'], { timeout: 600000, maxBuffer: 1024 });
    if (stdout.trim() === 'stored') console.log('Replacement key saved in macOS Keychain. No API request was made.');
  }
} catch { console.error('Secure key setup did not complete. No credential was printed or written to a file.'); process.exitCode = 1; }
