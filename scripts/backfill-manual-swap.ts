// One-off backfill for the real swap executed via scripts/smoke-swap.ts, which
// bypassed app/api/tick/route.ts (and so never called recordTick()). Numbers below are
// the real on-chain values, not estimates:
//   tx: 0xaae4882f3335d57e1e10ad7979d92fea93f8dd8baff6cfa0bf04b8606cf52cf7
//   swapped 0.099 USDC -> 0.008908214741113908 AVAX
// priceUsd/portfolioValueUsd below use the swap's own effective execution rate
// (usdcIn / avaxOut), not a later market price — the swap itself was value-conserving
// (no fee pulled from the balance), so that's the honest "price" for this row rather
// than introducing unrelated market drift into the reward.
import { recordTick } from '../lib/db';

const EFFECTIVE_PRICE = 0.099 / 0.008908214741113908;

await recordTick({
  momentumBucket: 0, // not captured live by smoke-swap.ts — 0 matches the real reading
                      // from the ticks immediately before and after this trade
  position: 'USDC', // pre-trade position
  action: 'SWAP_TO_AVAX',
  reward: 0, // value-conserving at the execution price — see note above
  priceUsd: EFFECTIVE_PRICE,
  portfolioValueUsd: 0.001 + 0.008908214741113908 * EFFECTIVE_PRICE,
  usdcBalance: 0.001,
  avaxBalance: 0.008908214741113908,
  txHash: '0xaae4882f3335d57e1e10ad7979d92fea93f8dd8baff6cfa0bf04b8606cf52cf7',
  simulated: false,
  connectomeAction: null,
  connectomeDiffHz: null,
  connectomeGateRate: null,
  decisionSource: 'manual',
});

console.log('backfilled.');
