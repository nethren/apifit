import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { RedisState } from '../server/shared-state.mjs';

const execute = promisify(execFile);
export const redisEnabled = Boolean(process.env.APIFIT_TEST_REDIS_CLI);
// A real isolated Redis, not a JavaScript imitation of Lua atomicity. Only
// synthetic fixtures are written. Every test uses a unique namespace.
export function testState() {
  const cli = process.env.APIFIT_TEST_REDIS_CLI;
  const port = process.env.APIFIT_TEST_REDIS_PORT || '16379';
  if (!cli || !/^\d{4,5}$/.test(port)) throw new Error('Configure a local Redis test server.');
  return new RedisState({ url: 'https://apifit-test.upstash.io', token: 'synthetic-test-token', prefix: `{apifit-test-${randomUUID()}}:`,
    fetcher: async (_url, options) => {
      const command = JSON.parse(options.body);
      const { stdout } = await execute(cli, ['-h', '127.0.0.1', '-p', port, '--json', ...command.map(String)], { maxBuffer: 8 * 1024 * 1024 });
      return Response.json({ result: JSON.parse(stdout) });
    },
  });
}
