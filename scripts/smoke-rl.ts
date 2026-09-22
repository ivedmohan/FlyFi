import { chooseAction, updateQ, decayEpsilon, bucketMomentum, type QTable, type State } from '../lib/rl';

// position=AVAX should never choose SWAP_TO_AVAX (already there)
let table: QTable = {};
const s: State = { momentum: 1, position: 'AVAX' };
for (let i = 0; i < 20; i++) {
  const a = chooseAction(table, s, 0.5);
  if (a === 'SWAP_TO_AVAX') throw new Error('FAIL: chose invalid action SWAP_TO_AVAX while already AVAX');
}
console.log('PASS: valid-action filtering');

// repeated positive reward for SWAP_TO_USDC from this state should make greedy policy prefer it
const next: State = { momentum: 0, position: 'USDC' };
for (let i = 0; i < 200; i++) {
  table = updateQ(table, s, 'SWAP_TO_USDC', 1, next);
  table = updateQ(table, s, 'HOLD', -0.2, s);
}
const greedy = chooseAction(table, s, 0); // epsilon=0, pure greedy
console.log('Q(SWAP_TO_USDC)=', table[`${s.momentum}:${s.position}`]?.SWAP_TO_USDC);
console.log('Q(HOLD)=', table[`${s.momentum}:${s.position}`]?.HOLD);
if (greedy !== 'SWAP_TO_USDC') throw new Error(`FAIL: expected greedy pick SWAP_TO_USDC, got ${greedy}`);
console.log('PASS: Q-learning converges toward rewarded action');

console.log('bucketMomentum(-0.03)=', bucketMomentum(-0.03));
console.log('bucketMomentum(0.001)=', bucketMomentum(0.001));
console.log('bucketMomentum(0.03)=', bucketMomentum(0.03));
console.log('decayEpsilon(0)=', decayEpsilon(0), 'decayEpsilon(100)=', decayEpsilon(100));
