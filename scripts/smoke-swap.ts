// Direct execution-path smoke test — bypasses the momentum-gated decision loop
// entirely and calls the exact same real functions app/api/tick/route.ts would call
// for a SWAP_TO_AVAX, with the real live USDC balance. Answers one question only:
// does submitSponsoredCalls() actually work — does SmoothSend sponsor the gas and does
// the LFJ swap land on-chain — independent of whether the RL/connectome pipeline would
// have chosen to trade right now.
import { parseUnits } from 'viem';
import { getUsdcBalance, submitSponsoredCalls, usdcAddress, usdcDecimals } from '../lib/wallet';
import { buildSwapUsdcToAvaxCalls } from '../lib/dex';
import { env } from '../lib/env';

const SAFETY_MARGIN = 0.99; // same margin app/api/tick/route.ts uses

const usdc = await getUsdcBalance();
const usdcValueUsd = Number(usdc.formatted);
console.log('usdc balance:', usdc.formatted);
if (usdcValueUsd <= 0) throw new Error('no USDC to swap');

const capUsd = Math.min(usdcValueUsd, env.WALLET_PER_TX_LIMIT) * SAFETY_MARGIN;
console.log('swap amount (USD):', capUsd);

const amountIn = parseUnits(capUsd.toFixed(usdcDecimals), usdcDecimals);
const { calls, minOut, quote } = await buildSwapUsdcToAvaxCalls(amountIn);
console.log('quoted amountOut (AVAX, raw):', quote.amounts[quote.amounts.length - 1].toString());
console.log('minOut after slippage (raw):', minOut.toString());
console.log('SIMULATE_ONLY:', env.SIMULATE_ONLY);

const result = await submitSponsoredCalls(calls, { mode: 'user-pays-erc20', feeToken: usdcAddress });
console.log('result:', result);
