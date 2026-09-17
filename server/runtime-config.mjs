import { isAbsolute, resolve, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publicUrl } from './safe-fetch.mjs';

const localDataDir = fileURLToPath(new URL('../.local/', import.meta.url));
const invalid = message => { throw new Error(message); };

// Only deployment-owned environment values configure these boundaries. Never
// pass request fields here or log the returned hosting access password.
export function runtimeConfig(env = process.env) {
  const mode = env.APIFIT_MODE ?? 'local';
  if (!['local', 'hosted'].includes(mode)) invalid('APIFIT_MODE must be local or hosted.');
  const hosted = mode === 'hosted';
  const enabled = env.APIFIT_AI_ENABLED;
  if (enabled !== undefined && enabled !== 'true' && enabled !== 'false') invalid('APIFIT_AI_ENABLED must be true or false.');
  const rawPort = env.APIFIT_PORT ?? (hosted ? env.PORT : undefined) ?? (hosted ? '8080' : '4173');
  if (typeof rawPort !== 'string' || !/^\d{1,5}$/.test(rawPort)) invalid('The listening port must be an integer from 1024 to 65535.');
  const port = Number(rawPort);
  if (port < 1024 || port > 65535) invalid('The listening port must be an integer from 1024 to 65535.');

  let hosting = null;
  let dataDir = localDataDir;
  if (hosted) {
    const accessMode = env.APIFIT_ACCESS_MODE ?? 'password';
    if (!['password', 'public'].includes(accessMode)) invalid('APIFIT_ACCESS_MODE must be password or public.');
    const origin = env.APIFIT_PUBLIC_ORIGIN;
    let parsed;
    try { parsed = publicUrl(origin); } catch { invalid('APIFIT_PUBLIC_ORIGIN must be an exact public HTTPS origin.'); }
    if (origin !== parsed.origin) invalid('APIFIT_PUBLIC_ORIGIN must be an exact public HTTPS origin, without a path, query, fragment or trailing slash.');
    const accessPassword = env.APIFIT_ACCESS_PASSWORD;
    if (accessMode === 'password' && (typeof accessPassword !== 'string' || accessPassword.length < 32 || accessPassword.length > 1024 || accessPassword.trim() !== accessPassword || /[\u0000-\u001f\u007f]/.test(accessPassword))) {
      invalid('APIFIT_ACCESS_PASSWORD must contain 32–1024 characters without control characters or surrounding whitespace.');
    }
    const directory = env.APIFIT_DATA_DIR;
    if (typeof directory !== 'string' || !isAbsolute(directory) || /[\u0000-\u001f\u007f]/.test(directory) || directory.trim() !== directory || resolve(directory) === parse(directory).root) {
      invalid('APIFIT_DATA_DIR must be an absolute non-root path on a persistent volume.');
    }
    dataDir = resolve(directory);
    // Public access is an explicit operator decision. Do not retain an unused
    // password in the returned configuration when visitors need no password.
    hosting = Object.freeze({ origin, accessMode, ...(accessMode === 'password' ? { accessPassword } : {}) });
  }

  // Local ledger and Keychain paths deliberately remain fixed. Merely setting
  // a hosted secret or data directory cannot redirect local spending state.
  return Object.freeze({ mode, host: hosted ? '0.0.0.0' : '127.0.0.1', port,
    dataDir, aiEnabled: enabled === undefined ? !hosted : enabled === 'true',
    credentialMode: hosted ? 'runtime-secret' : 'keychain', hosting });
}
