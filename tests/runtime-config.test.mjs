import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { runtimeConfig } from '../server/runtime-config.mjs';
import { runtimeCredential } from '../server/runtime-credential.mjs';

const hosted = overrides => ({ APIFIT_MODE: 'hosted', APIFIT_PUBLIC_ORIGIN: 'https://apifit.example.com',
  APIFIT_ACCESS_PASSWORD: 'synthetic-access-password-for-tests-only', APIFIT_DATA_DIR: '/data/apifit', ...overrides });
// Deliberately synthetic and never used in a provider request.
const syntheticKey = 'sk-ant-' + 'x'.repeat(40);

test('local startup preserves loopback, Keychain and the existing ledger directory', () => {
  const config = runtimeConfig({ PORT: '8081', APIFIT_DATA_DIR: '/other-data', ANTHROPIC_API_KEY: syntheticKey });
  assert.equal(config.mode, 'local'); assert.equal(config.host, '127.0.0.1');
  assert.equal(config.port, 4173); assert.equal(config.credentialMode, 'keychain');
  assert.equal(config.dataDir, fileURLToPath(new URL('../.local/', import.meta.url)));
  assert.equal(config.aiEnabled, true); assert.equal(config.hosting, null);
  assert.ok(!JSON.stringify(config).includes(syntheticKey));
});

test('hosted startup requires explicit configuration and defaults to AI disabled', () => {
  const config = runtimeConfig(hosted({ ANTHROPIC_API_KEY: syntheticKey }));
  assert.equal(config.host, '0.0.0.0'); assert.equal(config.port, 8080);
  assert.equal(config.aiEnabled, false); assert.equal(config.credentialMode, 'runtime-secret');
  assert.equal(config.hosting.origin, 'https://apifit.example.com');
  assert.equal(config.hosting.accessMode, 'password');
  assert.equal(config.dataDir, '/data/apifit'); assert.ok(Object.isFrozen(config));
  assert.ok(!JSON.stringify(config).includes(syntheticKey));
  assert.equal(runtimeConfig(hosted({ APIFIT_AI_ENABLED: 'true' })).aiEnabled, true);
  assert.equal(runtimeConfig({ APIFIT_AI_ENABLED: 'false' }).aiEnabled, false);
});

test('public hosted access is explicit, needs no password and does not implicitly enable AI', () => {
  for (const password of [undefined, '', 'unused-private-password']) {
    const config = runtimeConfig(hosted({ APIFIT_ACCESS_MODE: 'public', APIFIT_ACCESS_PASSWORD: password }));
    assert.deepEqual(config.hosting, { origin: 'https://apifit.example.com', accessMode: 'public' });
    assert.equal(Object.hasOwn(config.hosting, 'accessPassword'), false);
    assert.equal(config.aiEnabled, false);
    assert.ok(!JSON.stringify(config).includes('unused-private-password'));
  }
  assert.throws(() => runtimeConfig(hosted({ APIFIT_ACCESS_PASSWORD: undefined })), /APIFIT_ACCESS_PASSWORD/);
  for (const accessMode of ['', 'PUBLIC', 'anonymous', 'false']) {
    assert.throws(() => runtimeConfig(hosted({ APIFIT_ACCESS_MODE: accessMode })), /APIFIT_ACCESS_MODE/);
  }
});

test('public hosted AI can be explicitly enabled while retaining runtime credential readiness checks', async () => {
  const env = hosted({ APIFIT_ACCESS_MODE: 'public', APIFIT_ACCESS_PASSWORD: undefined, APIFIT_AI_ENABLED: 'true' });
  const config = runtimeConfig(env);
  assert.equal(config.aiEnabled, true); assert.equal(config.credentialMode, 'runtime-secret');
  const credential = runtimeCredential(config, { env });
  assert.equal(await credential.status(), 'missing');
  await assert.rejects(credential.read(), { code: 'AI_KEY_REQUIRED' });
  env.ANTHROPIC_API_KEY = syntheticKey;
  assert.equal(await credential.status(), 'stored');
  assert.equal(await credential.read(), syntheticKey);
  assert.ok(!JSON.stringify(config).includes(syntheticKey));
});

test('public mode keeps hosted origin and durable path mandatory and cannot expose local mode', () => {
  assert.throws(() => runtimeConfig(hosted({ APIFIT_ACCESS_MODE: 'public', APIFIT_PUBLIC_ORIGIN: undefined })), /APIFIT_PUBLIC_ORIGIN/);
  assert.throws(() => runtimeConfig(hosted({ APIFIT_ACCESS_MODE: 'public', APIFIT_DATA_DIR: undefined })), /APIFIT_DATA_DIR/);
  const config = runtimeConfig({ APIFIT_ACCESS_MODE: 'public', ANTHROPIC_API_KEY: syntheticKey });
  assert.equal(config.host, '127.0.0.1'); assert.equal(config.hosting, null); assert.equal(config.credentialMode, 'keychain');
});

test('ports are bounded and hosted platform PORT is subordinate to APIFIT_PORT', () => {
  assert.equal(runtimeConfig(hosted({ PORT: '9000' })).port, 9000);
  assert.equal(runtimeConfig(hosted({ PORT: '9000', APIFIT_PORT: '9001' })).port, 9001);
  for (const port of ['', '0', '80', '65536', '9000x', '1e4', ' 9000', '9000.0']) {
    assert.throws(() => runtimeConfig(hosted({ APIFIT_PORT: port })), /listening port/);
  }
  assert.throws(() => runtimeConfig({ APIFIT_MODE: 'production' }), /APIFIT_MODE/);
  assert.throws(() => runtimeConfig(hosted({ APIFIT_AI_ENABLED: 'yes' })), /APIFIT_AI_ENABLED/);
});

test('hosted origins reject paths, credentials, noncanonical and private addresses', () => {
  for (const origin of [undefined, '', 'http://apifit.example.com', 'https://localhost', 'https://127.0.0.1',
    'https://10.0.0.1', 'https://apifit.internal', 'https://user:password@apifit.example.com',
    'https://apifit.example.com/path', 'https://apifit.example.com/', 'https://apifit.example.com?x=y',
    'https://apifit.example.com#x', 'https://apifit.example.com:8443', ' https://apifit.example.com', 'https://APIFIT.example.com']) {
    assert.throws(() => runtimeConfig(hosted({ APIFIT_PUBLIC_ORIGIN: origin })), /APIFIT_PUBLIC_ORIGIN/);
  }
});

test('hosted access password and persistent path are required with safe errors', () => {
  for (const accessPassword of [undefined, '', 'short-private-value', 'x'.repeat(1025), ' x'.repeat(32), 'x'.repeat(32) + '\n']) {
    assert.throws(() => runtimeConfig(hosted({ APIFIT_ACCESS_PASSWORD: accessPassword })), error =>
      error.message.startsWith('APIFIT_ACCESS_PASSWORD') && !error.message.includes('short-private-value'));
  }
  for (const dataDir of [undefined, '', './data', '/', '/a/..', '/data\u0000', ' /data']) {
    assert.throws(() => runtimeConfig(hosted({ APIFIT_DATA_DIR: dataDir })), /APIFIT_DATA_DIR/);
  }
});

test('disabled hosted AI never reads Keychain or exposes even a configured runtime credential', async () => {
  let calls = 0;
  const env = hosted({ ANTHROPIC_API_KEY: syntheticKey });
  const adapter = runtimeCredential(runtimeConfig(env), { env, keychainStatus: async () => { calls++; }, readAnthropicKey: async () => { calls++; } });
  assert.equal(await adapter.status(), 'disabled');
  await assert.rejects(adapter.read(), { code: 'AI_NOT_READY' }); assert.equal(calls, 0);
});

test('local credential adapter ignores runtime secrets and delegates only to Keychain', async () => {
  let statusCalls = 0; let readCalls = 0;
  const adapter = runtimeCredential(runtimeConfig({}), { env: { ANTHROPIC_API_KEY: syntheticKey },
    keychainStatus: async () => { statusCalls++; return 'stored'; },
    readAnthropicKey: async () => { readCalls++; return 'synthetic-local-only'; } });
  assert.equal(await adapter.status(), 'stored'); assert.equal(readCalls, 0);
  assert.equal(await adapter.read(), 'synthetic-local-only'); assert.equal(statusCalls, 1); assert.equal(readCalls, 1);
});

test('hosted credential errors are generic and status never includes a credential', async () => {
  for (const key of [undefined, '', 'SECRET_TEST_VALUE', syntheticKey + '\n', 'sk-ant-' + 'x'.repeat(294)]) {
    const env = hosted({ APIFIT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: key });
    const adapter = runtimeCredential(runtimeConfig(env), { env, keychainStatus: () => assert.fail('Keychain must not be used'), readAnthropicKey: () => assert.fail('Keychain must not be used') });
    assert.equal(await adapter.status(), key === undefined || key === '' ? 'missing' : 'invalid');
    await assert.rejects(adapter.read(), error => error.code === 'AI_KEY_REQUIRED' && !error.message.includes('SECRET_TEST_VALUE') && !error.message.includes('sk-ant-'));
  }
});

test('hosted valid key is returned only by the private read method, with runtime rotation supported', async () => {
  const env = hosted({ APIFIT_AI_ENABLED: 'true', ANTHROPIC_API_KEY: syntheticKey });
  const adapter = runtimeCredential(runtimeConfig(env), { env });
  assert.equal(await adapter.status(), 'stored'); assert.equal(await adapter.read(), syntheticKey);
  delete env.ANTHROPIC_API_KEY;
  assert.equal(await adapter.status(), 'missing'); await assert.rejects(adapter.read(), { code: 'AI_KEY_REQUIRED' });
  assert.throws(() => runtimeCredential({ mode: 'local', aiEnabled: true, credentialMode: 'runtime-secret' }), /Invalid AI credential configuration/);
});
