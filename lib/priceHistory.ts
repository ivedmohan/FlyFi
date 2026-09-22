export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

// Real public OHLC data (CoinGecko, no API key needed) for the chart's historical
// context — separate from our own on-chain tick data, which is spot-price snapshots,
// not candles. Cached module-side (5 min TTL) to stay well under the free-tier rate
// limit even though /api/state itself is polled every 5s.
const CACHE_TTL_MS = 5 * 60_000;
let cache: { candles: Candle[]; fetchedAt: number } | null = null;

export async function getAvaxCandles(): Promise<Candle[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) return cache.candles;

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/coins/avalanche-2/ohlc?vs_currency=usd&days=1');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = (await res.json()) as Array<[number, number, number, number, number]>;
    const candles: Candle[] = raw.map(([t, o, h, l, c]) => ({ t, o, h, l, c }));
    cache = { candles, fetchedAt: Date.now() };
    return candles;
  } catch (e) {
    console.warn('[flyfi/priceHistory] CoinGecko fetch failed, serving stale/empty:', e);
    return cache?.candles ?? [];
  }
}
