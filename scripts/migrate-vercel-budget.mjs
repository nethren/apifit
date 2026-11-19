import { fileURLToPath } from 'node:url';
import { AiBudget } from '../server/ai-budget.mjs';
import { RedisState } from '../server/shared-state.mjs';
import { SharedBudget, validBudget } from '../server/shared-budget.mjs';

// Explicit, one-way handover. Never reads or prints the Anthropic credential.
// Transport credentials come from the operator environment, not CLI arguments.
if (process.argv.slice(2).join(' ') !== '--local-ai-stopped') {
  console.error('Stop local AI and hosted AI first. Then run this script with --local-ai-stopped. Existing spending is preserved; local AI will remain halted.');
  process.exitCode = 1;
} else {
  try {
    const state = new RedisState({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN });
    if (await state.get('budget') !== null) throw new Error('A shared ledger already exists; never overwrite it.');
    const local = new AiBudget(fileURLToPath(new URL('../.local/ai-budget.json', import.meta.url)));
    const source = await local.transaction(value => {
      if (!validBudget(value) || value.halted || value.migratedTo) throw new Error('Local ledger is halted, migrated or invalid; manual review is required.');
      const existing = { ...value };
      value.halted = true; value.migratedTo = 'shared-vercel-ledger';
      return existing;
    });
    // SET NX refuses replacement. If the network response is ambiguous, local
    // remains stopped and no automatic retry or rollback creates two owners.
    if (await state.setNew('budget', JSON.stringify(source)) !== 'OK') throw new Error('Shared ledger creation was not confirmed.');
    const status = await new SharedBudget(state).status();
    if (!status.available || status.chargedOrReservedUsd !== source.chargedMicrousd / 1e6) throw new Error('Shared ledger verification failed.');
    console.log(`Ledger handover verified. Existing charged/reserved usage: US$${status.chargedOrReservedUsd.toFixed(6)}. Local AI remains halted. Hosted AI has not been enabled.`);
  } catch {
    console.error('Handover stopped. Do not enable either AI host or reset a ledger. Review local/shared ledger state privately; local may already be halted and the remote write may have completed. No secret values were printed.');
    process.exitCode = 1;
  }
}
