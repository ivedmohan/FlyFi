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
export function validActions(position: Position): Action[] {
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

export type DecisionSource = 'connectome' | 'qtable';

// How much better the Q-table's best alternative has to look, in learned Q-value terms,
// before it's allowed to override the connectome's proposed action. Not empirically
// tuned — a deliberately simple, honestly-documented judgment call (this is a fun
// project, not a calibrated risk model): small enough that the connectome actually gets
// to drive most of the time, large enough that a state the Q-table has real, repeated,
// bad experience with won't get overridden by a single noisy brain reading.
const VETO_MARGIN = 0.05;

/**
 * The fly's real connectome (see connectome-service/) proposes an action from the same
 * momentum input the Q-learner sees. It drives the trade UNLESS the Q-table has learned
 * — from real portfolio outcomes, via updateQ() — that some other valid action has
 * scored meaningfully better in this exact state. That's the whole "brain trades, table
 * is the safety net" design: the connectome is the default driver, not a suggestion the
 * table takes or leaves, but it can be overruled by the table's own track record.
 *
 * Falls back to the Q-table's own (still epsilon-greedy, still exploring/learning) pick
 * whenever the connectome is unavailable (null — service down/unreachable/timed out) or
 * proposes an action that isn't valid from the current position (e.g. it suggests
 * SWAP_TO_AVAX while already holding AVAX).
 */
export function decideAction(
  table: QTable, state: State, epsilon: number,
  connectomeAction: Action | null, rand: () => number = Math.random,
): { action: Action; source: DecisionSource } {
  const valid = validActions(state.position);
  const qSuggestion = chooseAction(table, state, epsilon, rand);

  if (connectomeAction && valid.includes(connectomeAction)) {
    const key = stateKey(state);
    const connQ = qValue(table, key, connectomeAction);
    const alternatives = valid.filter((a) => a !== connectomeAction);
    const bestAltQ = alternatives.length > 0 ? Math.max(...alternatives.map((a) => qValue(table, key, a))) : -Infinity;
    const vetoed = bestAltQ - connQ > VETO_MARGIN;
    if (!vetoed) {
      return { action: connectomeAction, source: 'connectome' };
    }
  }
  return { action: qSuggestion, source: 'qtable' };
}
