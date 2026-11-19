import test from 'node:test';
import assert from 'node:assert/strict';
import { SharedBudget, validBudget } from '../server/shared-budget.mjs';

test('shared allowance reads its authorized limit rather than a hardcoded five dollars', async () => {
  const value = { version: 1, limitMicrousd: 25000000, chargedMicrousd: 4319000, halted: false };
  const budget = new SharedBudget({ get: async () => JSON.stringify(value) });
  assert.equal(validBudget(value), true);
  assert.deepEqual(await budget.status(), { available: true, limitUsd: 25, chargedOrReservedUsd: 4.319, remainingUsd: 20.681 });
  value.halted = true;
  assert.equal((await budget.status()).available, false);
  value.chargedMicrousd = 26000000;
  assert.equal((await budget.status()).remainingUsd, 0);
});

test('invalid limits fail closed instead of creating an unlimited allowance', async () => {
  for (const limitMicrousd of [undefined, null, 0, -1, 1.5, '25000000', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const value = { version: 1, limitMicrousd, chargedMicrousd: 0, halted: false };
    assert.equal(validBudget(value), false);
    assert.equal((await new SharedBudget({ get: async () => JSON.stringify(value) }).status()).available, false);
  }
});
