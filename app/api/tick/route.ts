import { NextResponse } from 'next/server';
import { parseUnits } from 'viem';
import { getAvaxPriceUsd, buildSwapUsdcToAvaxCalls, buildSwapAvaxToUsdcCalls } from '../../../lib/dex';
import { getUsdcBalance, getAvaxBalance, submitSponsoredCalls, usdcAddress, usdcDecimals } from '../../../lib/wallet';
import { decideAction, updateQ, decayEpsilon, bucketMomentum, stateKey, type State, type Position } from '../../../lib/rl';
import { loadQTable, saveQTableEntry, recordTick, getRecentTicks, getTickCount } from '../../../lib/db';
import { getConnectomeRead } from '../../../lib/connectome';
import { env } from '../../../lib/env';

// The connectome read now gates the actual trade decision (not just a display field),
// and has measured as slow as ~14s on its shared host — well past Vercel's default 10s
// Hobby-plan function limit. Needs a Pro plan (or equivalent) to actually take effect;
// documented here so the reason isn't a mystery if a real deploy times out.
export const maxDuration = 60;

const AVAX_DECIMALS = 18;
// Leave a little headroom under the wallet balance / per-tx cap against rounding and
// dust-related reverts (exact-full-balance transfers are a common footgun).
const SAFETY_MARGIN = 0.99;
const MIN_TRADE_USD = 0.05;

// Vercel Cron sends `Authorization: Bearer ${CRON_SECRET}` automatically once
// CRON_SECRET is set as an env var on the project — this same header/secret doubles
// as the auth for a manual force-tick call (e.g. for the demo video).
function isAuthorized(req: Request): boolean {
  return req.headers.get('authorization') === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const [price, usdc, avax, qTable, recentTicks, tickCount] = await Promise.all([
    getAvaxPriceUsd(),
    getUsdcBalance(),
    getAvaxBalance(),
    loadQTable(),
    getRecentTicks(1),
    getTickCount(),
  ]);
  const lastTick = recentTicks[0];

  const usdcValueUsd = Number(usdc.formatted);
  const avaxValueUsd = Number(avax.formatted) * price;
  const portfolioValueUsd = usdcValueUsd + avaxValueUsd;
  const position: Position = avaxValueUsd >= usdcValueUsd ? 'AVAX' : 'USDC';

  const prevPrice = lastTick ? Number(lastTick.price_usd) : price;
  const pctChange = prevPrice > 0 ? (price - prevPrice) / prevPrice : 0;
  const state: State = { momentum: bucketMomentum(pctChange), position };

  // Delayed-reward Q-update: the reward for the PREVIOUS tick's action is only knowable
  // now (portfolio value moved between then and now), so update that (state, action)
  // pair using this tick's state as "next state" before picking this tick's own action.
  let table = qTable;
  let reward = 0;
  if (lastTick) {
    reward = portfolioValueUsd - Number(lastTick.portfolio_value_usd);
    const prevState: State = { momentum: lastTick.momentum_bucket as State['momentum'], position: lastTick.position };
    table = updateQ(table, prevState, lastTick.action, reward, state);
    const key = stateKey(prevState);
    await saveQTableEntry(key, table[key] ?? {});
  }

  const epsilon = decayEpsilon(tickCount);

  // The fly's real connectome (connectome-service/) proposes this tick's action from
  // the same momentum input. It drives the trade unless the Q-table has learned, from
  // real portfolio outcomes, that some other valid action has scored meaningfully
  // better in this exact state — see decideAction()'s doc comment in lib/rl.ts for the
  // full veto rule. Falls back to the Q-table's own epsilon-greedy pick whenever the
  // connectome is unavailable.
  const connectomeRead = await getConnectomeRead(state.momentum);
  const { action: chosenAction, source: decisionSource } = decideAction(
    table, state, epsilon, connectomeRead?.action ?? null,
  );

  // The size cap below can reject a trade as too small to be worth the fees. Per the
  // rule "a risk guard may reject an order, it must never choose a replacement trade"
  // (borrowed from stonkfly's AGENTS.md — same principle applies to Q-learning
  // bookkeeping): a rejected trade must be RECORDED as HOLD, not silently logged as the
  // swap that never happened, or the next tick's Q-update attributes its reward to an
  // action that never executed.
  let executedAction = chosenAction;
  let txHash: string | undefined;
  let simulated = env.SIMULATE_ONLY;

  if (chosenAction === 'SWAP_TO_AVAX') {
    const capUsd = Math.min(usdcValueUsd, env.WALLET_PER_TX_LIMIT) * SAFETY_MARGIN;
    if (capUsd >= MIN_TRADE_USD) {
      const amountIn = parseUnits(capUsd.toFixed(usdcDecimals), usdcDecimals);
      const { calls } = await buildSwapUsdcToAvaxCalls(amountIn);
      const result = await submitSponsoredCalls(calls, { mode: 'user-pays-erc20', feeToken: usdcAddress });
      txHash = result.txHash;
      simulated = result.simulated;
    } else {
      executedAction = 'HOLD';
    }
  } else if (chosenAction === 'SWAP_TO_USDC') {
    const capUsd = Math.min(avaxValueUsd, env.WALLET_PER_TX_LIMIT) * SAFETY_MARGIN;
    if (capUsd >= MIN_TRADE_USD) {
      const amountInAvax = capUsd / price;
      const amountIn = parseUnits(amountInAvax.toFixed(AVAX_DECIMALS), AVAX_DECIMALS);
      const { calls } = await buildSwapAvaxToUsdcCalls(amountIn);
      // Fee still taken in USDC even though the swap input is native AVAX — the wallet
      // needs a little standing USDC (or the swap's own output, settled in postOp) to
      // cover it. Worth confirming empirically on the first real (small) SWAP_TO_USDC tx.
      const result = await submitSponsoredCalls(calls, { mode: 'user-pays-erc20', feeToken: usdcAddress });
      txHash = result.txHash;
      simulated = result.simulated;
    } else {
      executedAction = 'HOLD';
    }
  }

  await recordTick({
    momentumBucket: state.momentum,
    position: state.position,
    action: executedAction,
    reward,
    priceUsd: price,
    portfolioValueUsd,
    usdcBalance: usdcValueUsd,
    avaxBalance: Number(avax.formatted),
    txHash,
    simulated,
    connectomeAction: connectomeRead?.action ?? null,
    connectomeDiffHz: connectomeRead?.meanDiffHz ?? null,
    connectomeGateRate: connectomeRead?.gateRate ?? null,
    decisionSource,
  });

  return NextResponse.json({
    state, chosenAction, executedAction, reward, price, portfolioValueUsd, txHash, simulated, epsilon, decisionSource,
    connectomeRead,
  });
}
