import { randomUUID } from 'node:crypto';
import { fail } from './errors.mjs';

export function validBudget(value) {
  return value?.version === 1 && Number.isSafeInteger(value.limitMicrousd) && value.limitMicrousd > 0 && Number.isSafeInteger(value.chargedMicrousd) && value.chargedMicrousd >= 0 && typeof value.halted === 'boolean';
}
const VALIDATE = `
local raw = redis.call('GET', KEYS[1])
if not raw then return -1 end
local ok, b = pcall(cjson.decode, raw)
if not ok or type(b) ~= 'table' or b.version ~= 1 or type(b.limitMicrousd) ~= 'number' or b.limitMicrousd <= 0 or b.limitMicrousd > 9007199254740991 or b.limitMicrousd ~= math.floor(b.limitMicrousd) or type(b.chargedMicrousd) ~= 'number' or b.chargedMicrousd < 0 or b.chargedMicrousd > 9007199254740991 or b.chargedMicrousd ~= math.floor(b.chargedMicrousd) or type(b.halted) ~= 'boolean' then return -1 end
`;
export const RESERVE_SCRIPT = VALIDATE + `
if redis.call('EXISTS', KEYS[2]) == 1 then return -1 end
local amount = tonumber(ARGV[1])
if b.halted or b.chargedMicrousd + amount > b.limitMicrousd then return 0 end
b.chargedMicrousd = b.chargedMicrousd + amount
redis.call('SET', KEYS[1], cjson.encode(b))
redis.call('SET', KEYS[2], ARGV[1])
return 1`;
export const SETTLE_SCRIPT = VALIDATE + `
local amount = tonumber(redis.call('GET', KEYS[2]))
if not amount then return -1 end
local actual = tonumber(ARGV[1])
b.chargedMicrousd = b.chargedMicrousd + actual - amount
if actual > amount or b.chargedMicrousd > b.limitMicrousd then b.halted = true end
redis.call('SET', KEYS[1], cjson.encode(b))
redis.call('DEL', KEYS[2])
return 1`;

// No automatic initialization, expiry, retries or per-deployment budget keys.
// A timed-out reservation remains charged; it must never be blindly retried.
export class SharedBudget {
  constructor(state) { this.state = state; }
  async reserve(amount) {
    if (!Number.isSafeInteger(amount) || amount <= 0) fail('AI_BUDGET_INVALID', 'Invalid AI request cost.', 503);
    const key = `reservation:${randomUUID()}`;
    const result = await this.state.eval(RESERVE_SCRIPT, ['budget', key], [amount]);
    if (result === 0) fail('AI_BUDGET_EXHAUSTED', 'The available AI allowance cannot cover this request. Keyword search is still available. No AI call was made.', 429);
    if (result !== 1) fail('AI_BUDGET_UNAVAILABLE', 'The shared spending ledger is missing or invalid. AI requests are stopped.', 503);
    let settled = false;
    return async actual => {
      if (settled) fail('AI_BUDGET_INVALID', 'AI usage was already recorded.', 503);
      settled = true;
      if (!Number.isSafeInteger(actual) || actual < 0) return;
      if (await this.state.eval(SETTLE_SCRIPT, ['budget', key], [actual]) !== 1) fail('AI_BUDGET_UNAVAILABLE', 'Usage could not be settled. The reservation remains charged.', 503);
    };
  }
  async status() {
    try {
      const value = JSON.parse(await this.state.get('budget'));
      if (!validBudget(value)) throw new Error();
      return { available: !value.halted, limitUsd: value.limitMicrousd / 1e6, chargedOrReservedUsd: value.chargedMicrousd / 1e6, remainingUsd: Math.max(0, value.limitMicrousd - value.chargedMicrousd) / 1e6 };
    } catch { return { available: false, limitUsd: null, remainingUsd: 0 }; }
  }
}
