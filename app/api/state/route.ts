import { NextResponse } from 'next/server';
import { getFlySmartAccountAddress, getUsdcBalance, getAvaxBalance } from '../../../lib/wallet';
import { getAvaxPriceUsd } from '../../../lib/dex';
import { getAvaxCandles } from '../../../lib/priceHistory';
import { getRecentTicks, getRealSwapCount, getTickCount } from '../../../lib/db';
import { env } from '../../../lib/env';
import type { Position } from '../../../lib/rl';

export async function GET() {
  const [address, usdc, avax, price, recentTicks, realSwapCount, candles, tickCount] = await Promise.all([
    getFlySmartAccountAddress(),
    getUsdcBalance(),
    getAvaxBalance(),
    getAvaxPriceUsd(),
    getRecentTicks(10),
    getRealSwapCount(),
    getAvaxCandles(),
    getTickCount(),
  ]);

  const usdcValueUsd = Number(usdc.formatted);
  const avaxValueUsd = Number(avax.formatted) * price;
  const portfolioValueUsd = usdcValueUsd + avaxValueUsd;
  const position: Position = avaxValueUsd >= usdcValueUsd ? 'AVAX' : 'USDC';

  const lastTick = recentTicks[0];
  const recentPnl = recentTicks.reduce((sum, t) => sum + t.reward, 0);

  return NextResponse.json({
    // Everything here is real — wallet/portfolio from live chain reads, decisions from
    // lib/db.ts (real Supabase once configured, an in-memory dev fallback until then),
    // candles from CoinGecko's public OHLC endpoint. "no ticks yet" just means
    // /api/tick hasn't run.
    dataSource: { wallet: 'live', decisions: 'live' },
    address,
    balances: { usdc: usdc.formatted, avax: avax.formatted },
    avaxPriceUsd: price,
    position,
    portfolioValueUsd,
    recentPnl,
    realSwapCount,
    tickCount,
    starving: portfolioValueUsd < env.STARVING_THRESHOLD_USD,
    lastAction: lastTick?.action ?? null,
    lastReward: lastTick?.reward ?? 0,
    lastDecisionSource: lastTick?.decision_source ?? null,
    momentumBucket: lastTick?.momentum_bucket ?? 0,
    // Real connectome read from the latest tick — null if that service isn't
    // configured/reachable, or no ticks have run yet. Whether it actually drove that
    // tick's action (vs. being overridden by the Q-table) is `lastDecisionSource` above.
    connectome: lastTick
      ? {
          action: lastTick.connectome_action,
          diffHz: lastTick.connectome_diff_hz,
          gateRate: lastTick.connectome_gate_rate,
        }
      : null,
    history: recentTicks.map((t) => ({
      timestamp: t.created_at,
      action: t.action,
      reward: t.reward,
      decisionSource: t.decision_source,
      txHash: t.tx_hash,
    })),
    candles,
  });
}
