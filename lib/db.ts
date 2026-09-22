import { createClient } from '@supabase/supabase-js';
import type { QTable, Action, Position, DecisionSource } from './rl';

export interface TickRecord {
  momentumBucket: number;
  position: Position;
  action: Action;
  reward: number;
  priceUsd: number;
  portfolioValueUsd: number;
  usdcBalance: number;
  avaxBalance: number;
  txHash?: string;
  simulated: boolean;
  // Real connectome's read on the same momentum input — null when the service isn't
  // configured/reachable. `decisionSource` says whether this tick's `action` actually
  // came from the connectome or was a Q-table override/fallback — see decideAction()
  // in lib/rl.ts.
  connectomeAction?: Action | null;
  connectomeDiffHz?: number | null;
  connectomeGateRate?: number | null;
  decisionSource: DecisionSource;
}

interface TickRow {
  created_at: string;
  momentum_bucket: number;
  position: Position;
  action: Action;
  reward: number;
  price_usd: number;
  portfolio_value_usd: number;
  usdc_balance: number;
  avax_balance: number;
  tx_hash: string | null;
  simulated: boolean;
  connectome_action: Action | null;
  connectome_diff_hz: number | null;
  connectome_gate_rate: number | null;
  decision_source: DecisionSource | null;
}

const hasSupabase = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

// Server-only: uses the service role key (never expose this to the client), so there's
// no need for RLS policies — every read/write here happens from our own API routes.
const supabase = hasSupabase
  ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  : null;

// Dev-only in-memory fallback so the tick loop is testable before a real Supabase
// project exists. Resets on every server restart — never used once SUPABASE_URL is set.
let memQTable: QTable = {};
let memTicks: TickRow[] = [];
if (!hasSupabase) {
  console.warn('[flyfi/db] SUPABASE_URL not set — using in-memory store (dev only, state resets on restart)');
}

export async function loadQTable(): Promise<QTable> {
  if (!supabase) return memQTable;
  const { data, error } = await supabase.from('q_table').select('state_key, actions');
  if (error) throw new Error(`[flyfi/db] loadQTable failed: ${error.message}`);
  const table: QTable = {};
  for (const row of data ?? []) table[row.state_key as string] = (row.actions as QTable[string]) ?? {};
  return table;
}

export async function saveQTableEntry(stateKey: string, actions: QTable[string]): Promise<void> {
  if (!supabase) {
    memQTable = { ...memQTable, [stateKey]: actions };
    return;
  }
  const { error } = await supabase
    .from('q_table')
    .upsert({ state_key: stateKey, actions, updated_at: new Date().toISOString() });
  if (error) throw new Error(`[flyfi/db] saveQTableEntry failed: ${error.message}`);
}

export async function recordTick(t: TickRecord): Promise<void> {
  if (!supabase) {
    memTicks.unshift({
      created_at: new Date().toISOString(),
      momentum_bucket: t.momentumBucket,
      position: t.position,
      action: t.action,
      reward: t.reward,
      price_usd: t.priceUsd,
      portfolio_value_usd: t.portfolioValueUsd,
      usdc_balance: t.usdcBalance,
      avax_balance: t.avaxBalance,
      tx_hash: t.txHash ?? null,
      simulated: t.simulated,
      connectome_action: t.connectomeAction ?? null,
      connectome_diff_hz: t.connectomeDiffHz ?? null,
      connectome_gate_rate: t.connectomeGateRate ?? null,
      decision_source: t.decisionSource,
    });
    memTicks = memTicks.slice(0, 500);
    return;
  }
  const { error } = await supabase.from('ticks').insert({
    momentum_bucket: t.momentumBucket,
    position: t.position,
    action: t.action,
    reward: t.reward,
    price_usd: t.priceUsd,
    portfolio_value_usd: t.portfolioValueUsd,
    usdc_balance: t.usdcBalance,
    avax_balance: t.avaxBalance,
    tx_hash: t.txHash ?? null,
    simulated: t.simulated,
    connectome_action: t.connectomeAction ?? null,
    connectome_diff_hz: t.connectomeDiffHz ?? null,
    connectome_gate_rate: t.connectomeGateRate ?? null,
    decision_source: t.decisionSource,
  });
  if (error) throw new Error(`[flyfi/db] recordTick failed: ${error.message}`);
}

export async function getRecentTicks(limit = 20): Promise<TickRow[]> {
  if (!supabase) return memTicks.slice(0, limit);
  const { data, error } = await supabase
    .from('ticks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[flyfi/db] getRecentTicks failed: ${error.message}`);
  return (data ?? []) as TickRow[];
}

export async function getTickCount(): Promise<number> {
  if (!supabase) return memTicks.length;
  const { count, error } = await supabase.from('ticks').select('*', { count: 'exact', head: true });
  if (error) throw new Error(`[flyfi/db] getTickCount failed: ${error.message}`);
  return count ?? 0;
}

/** Real (non-simulated) on-chain swaps only — for an honest "gasless swaps" counter. */
export async function getRealSwapCount(): Promise<number> {
  if (!supabase) return memTicks.filter((t) => !t.simulated && t.tx_hash).length;
  const { count, error } = await supabase
    .from('ticks')
    .select('*', { count: 'exact', head: true })
    .eq('simulated', false)
    .not('tx_hash', 'is', null);
  if (error) throw new Error(`[flyfi/db] getRealSwapCount failed: ${error.message}`);
  return count ?? 0;
}
