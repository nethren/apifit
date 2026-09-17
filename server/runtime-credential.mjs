import { keychainStatus as localStatus, readAnthropicKey as localRead } from './ai-keychain.mjs';
import { fail } from './errors.mjs';

const validKey = key => typeof key === 'string' && /^sk-ant-[A-Za-z0-9_-]{33,293}$/.test(key);

// Secrets enter only through this backend runtime adapter, never the config
// response, browser bundle, request body, deployment image or persistent files.
export function runtimeCredential(config, { env = process.env, keychainStatus = localStatus, readAnthropicKey = localRead } = {}) {
  if (!config || !['local', 'hosted'].includes(config.mode) || typeof config.aiEnabled !== 'boolean'
    || config.credentialMode !== (config.mode === 'hosted' ? 'runtime-secret' : 'keychain')) {
    throw new Error('Invalid AI credential configuration.');
  }
  return Object.freeze({
    async status() {
      if (!config.aiEnabled) return 'disabled';
      if (config.mode === 'local') return keychainStatus();
      const key = env.ANTHROPIC_API_KEY;
      return key === undefined || key === '' ? 'missing' : validKey(key) ? 'stored' : 'invalid';
    },
    async read() {
      if (!config.aiEnabled) fail('AI_NOT_READY', 'AI assistance is disabled on this server.', 503);
      if (config.mode === 'local') return readAnthropicKey();
      const key = env.ANTHROPIC_API_KEY;
      if (!validKey(key)) fail('AI_KEY_REQUIRED', 'The hosted AI runtime credential is missing or invalid.', 503);
      return key;
    },
  });
}
