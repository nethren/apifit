import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { publicUrl, isPublicAddress, resolvePublic, pinnedLookup, fetchDocument, requestPinned } from '../server/safe-fetch.mjs';

const resolver = async () => [{ address: '93.184.216.34', family: 4 }];
for (const url of ['http://example.com', 'https://localhost', 'https://127.0.0.1', 'https://2130706433', 'https://0x7f000001', 'https://169.254.169.254', 'https://10.2.3.4', 'https://[::1]', 'https://example.com:444', 'https://user:pass@example.com', 'https://example.com/?api_key=secret', 'https://example.com/?access_token=secret', 'https://example.com/?X-Amz-Signature=secret', 'file:///etc/passwd', 'https://service.internal', 'https://localhost.']) {
  test(`rejects unsafe URL: ${url.replace(/secret|pass/g, 'redacted')}`, () => assert.throws(() => publicUrl(url)));
}
test('allows ordinary HTTPS docs without fragments', () => assert.equal(publicUrl('https://docs.example.com/path#section').href, 'https://docs.example.com/path'));
test('rejects special-use ranges and IPv6', () => {
  for (const ip of ['0.0.0.0', '127.1.1.1', '192.168.1.1', '172.16.1.1', '169.254.1.1', '100.64.0.1', '224.0.0.1', '198.18.0.1', '192.0.2.1', '255.255.255.255', '::ffff:127.0.0.1', '2001:db8::1']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});
test('rejects DNS containing any private address', async () => {
  await assert.rejects(resolvePublic(new URL('https://example.com'), async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), { code: 'UNSAFE_ADDRESS' });
});
test('DNS result is pinned for both lookup signatures', () => {
  const record = { address: '8.8.8.8', family: 4 };
  pinnedLookup(record)('example.com', {}, (error, ip, family) => { assert.equal(error, null); assert.equal(ip, record.address); assert.equal(family, 4); });
  pinnedLookup(record)('example.com', { all: true }, (error, entries) => { assert.equal(error, null); assert.deepEqual(entries, [record]); });
});
test('redirect to a private destination is never fetched', async () => {
  let calls = 0;
  await assert.rejects(fetchDocument('https://example.com', { resolver, transport: async () => { calls++; return { location: 'https://127.0.0.1/internal' }; } }), { code: 'UNSAFE_ADDRESS' });
  assert.equal(calls, 1);
});
test('DNS is rechecked at each redirect and original hostname is preserved', async () => {
  const hosts = []; const lookups = [];
  const result = await fetchDocument('https://example.com', { resolver: async host => { lookups.push(host); return resolver(); }, transport: async (url, record) => {
    assert.equal(record.address, '93.184.216.34'); hosts.push(url.hostname);
    return hosts.length === 1 ? { location: 'https://docs.example.com/spec' } : { text: '{}', contentType: 'application/json' };
  } });
  assert.deepEqual(lookups, ['example.com', 'docs.example.com']); assert.deepEqual(hosts, lookups); assert.equal(result.url, 'https://docs.example.com/spec');
});
test('redirect loops are bounded', async () => {
  let calls = 0;
  await assert.rejects(fetchDocument('https://example.com', { resolver, transport: async () => { calls++; return { location: '/again' }; } }), { code: 'TOO_MANY_REDIRECTS' });
  assert.equal(calls, 4);
});
test('DNS failure and raw network errors do not leak internals', async () => {
  await assert.rejects(fetchDocument('https://example.com', { resolver: async () => { throw new Error('private value'); } }), { code: 'DNS_UNAVAILABLE' });
  await assert.rejects(fetchDocument('https://example.com', { resolver, transport: async () => { throw new Error('private value'); } }), error => error.code === 'FETCH_UNAVAILABLE' && !error.message.includes('private value'));
});
test('cancellation terminates waiting for DNS', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10);
  await assert.rejects(fetchDocument('https://example.com', { signal: controller.signal, resolver: () => new Promise(() => {}) }), { code: 'FETCH_TIMEOUT' });
  clearTimeout(timer);
});
function fakeRequest({ headers = {}, status = 200, chunks = ['{}'] }, inspect = () => {}) {
  return (url, options, callback) => {
    inspect(url, options);
    const request = new EventEmitter();
    request.end = () => {
      const response = Readable.from(chunks.map(chunk => Buffer.from(chunk)));
      response.headers = headers; response.statusCode = status;
      callback(response);
    };
    return request;
  };
}
test('transport enforces declared and streamed byte limits', async () => {
  const args = [new URL('https://example.com'), { address: '8.8.8.8', family: 4 }];
  for (const fixture of [{ headers: { 'content-length': '10' } }, { chunks: ['123', '456'] }]) {
    await assert.rejects(requestPinned(...args, { maxBytes: 4, request: fakeRequest(fixture) }), { code: 'DOCUMENT_TOO_LARGE' });
  }
});
test('transport disallows compression and non-success status, uses GET and no shared connection', async () => {
  const args = [new URL('https://example.com'), { address: '8.8.8.8', family: 4 }];
  await assert.rejects(requestPinned(...args, { maxBytes: 100, request: fakeRequest({ headers: { 'content-encoding': 'gzip' } }) }), { code: 'ENCODING_UNSUPPORTED' });
  await assert.rejects(requestPinned(...args, { maxBytes: 100, request: fakeRequest({ status: 403 }) }), { code: 'UPSTREAM_STATUS' });
  const result = await requestPinned(...args, { maxBytes: 100, request: fakeRequest({}, (url, options) => { assert.equal(url.hostname, 'example.com'); assert.equal(options.agent, false); assert.equal(options.method, 'GET'); assert.equal(options.headers['Accept-Encoding'], 'identity'); }) });
  assert.equal(result.text, '{}');
});
test('redirects without destinations fail explicitly', async () => {
  await assert.rejects(fetchDocument('https://example.com', { resolver, transport: async () => ({ status: 302 }) }), { code: 'INVALID_REDIRECT' });
});
