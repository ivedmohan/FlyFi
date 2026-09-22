export type Position = 'AVAX' | 'USDC';
export type Action = 'SWAP_TO_AVAX' | 'SWAP_TO_USDC' | 'HOLD';
export const ACTIONS: Action[] = ['SWAP_TO_AVAX', 'SWAP_TO_USDC', 'HOLD'];

/** -2 strong down, -1 down, 0 flat, 1 up, 2 strong up */
export type MomentumBucket = -2 | -1 | 0 | 1 | 2;

export interface State {
  momentum: MomentumBucket;
  position: Position;
}

export function stateKey(s: State): string {
  return `${s.momentum}:${s.position}`;
}

/** Bucket a price % change (e.g. 0.02 = +2%) since the last tick into a momentum bucket. */
export function bucketMomentum(pctChange: number): MomentumBucket {
  if (pctChange <= -0.02) return -2;
  if (pctChange <= -0.005) return -1;
  if (pctChange < 0.005) return 0;
  if (pctChange < 0.02) return 1;
  return 2;
}

/** state key -> action -> Q value. Persistence is the caller's job (lib/db.ts). */
export type QTable = Record<string, Partial<Record<Action, number>>>;

function qValue(table: QTable, key: string, action: Action): number {
  return table[key]?.[action] ?? 0;
}

/** Can't swap into the position already held — that's just HOLD with extra fees. */
function validActions(position: Position): Action[] {
  return ACTIONS.filter((a) => {
    if (a === 'SWAP_TO_AVAX') return position !== 'AVAX';
    if (a === 'SWAP_TO_USDC') return position !== 'USDC';
    return true;
  });
}

export function chooseAction(
  table: QTable, state: State, epsilon: number, rand: () => number = Math.random,
): Action {
  const valid = validActions(state.position);
  if (rand() < epsilon) {
    return valid[Math.floor(rand() * valid.length)];
  }
  const key = stateKey(state);
  let best = valid[0];
  let bestQ = qValue(table, key, best);
  for (const a of valid.slice(1)) {
    const q = qValue(table, key, a);
    if (q > bestQ) {
      bestQ = q;
      best = a;
    }
  }
  return best;
}

/** Standard tabular Q-learning update. Returns a new table (does not mutate). */
export function updateQ(
  table: QTable, state: State, action: Action, reward: number, nextState: State,
  opts?: { alpha?: number; gamma?: number },
): QTable {
  const alpha = opts?.alpha ?? 0.3;
  const gamma = opts?.gamma ?? 0.9;
  const key = stateKey(state);
  const nextKey = stateKey(nextState);
  const nextMax = Math.max(...ACTIONS.map((a) => qValue(table, nextKey, a)));
  const current = qValue(table, key, action);
  const updated = current + alpha * (reward + gamma * nextMax - current);
  return { ...table, [key]: { ...table[key], [action]: updated } };
}

/** Exponential decay from `start` toward `min` as ticks accumulate. */
export function decayEpsilon(
  tickCount: number, opts?: { start?: number; min?: number; decay?: number },
): number {
  const start = opts?.start ?? 0.5;
  const min = opts?.min ?? 0.05;
  const decay = opts?.decay ?? 0.97;
  return Math.max(min, start * Math.pow(decay, tickCount));
}
