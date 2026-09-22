import { encodeFunctionData, formatUnits, parseUnits, type Address, type Hex } from 'viem';
import { publicClient, usdcAddress, usdcDecimals, getFlySmartAccountAddress, type FlyCall } from './wallet';

// LFJ (Trader Joe) V2.2 on Avalanche C-Chain mainnet.
// Addresses pulled from developers.lfj.gg/deployment-addresses/avalanche and cross-checked
// against Snowtrace — see the build plan's Safety section. WAVAX confirmed via Snowtrace.
export const LB_ROUTER: Address = '0x18556DA13313f3532c54711497A8FedAC273220E';
export const LB_QUOTER: Address = '0x9A550a522BBaDFB69019b0432800Ed17855A51C3';
export const WAVAX: Address = '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7';

const AVAX_DECIMALS = 18;
const DEFAULT_SLIPPAGE_BPS = 150n; // 1.5%
const DEADLINE_SECONDS = 5 * 60;

// Solidity interfaces verified against github.com/traderjoe-xyz/joe-v2 (main):
// src/interfaces/ILBRouter.sol and src/LBQuoter.sol — see the build plan's dex research.
const LB_QUOTER_ABI = [
  {
    name: 'findBestPathFromAmountIn', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'route', type: 'address[]' }, { name: 'amountIn', type: 'uint128' }],
    outputs: [{
      name: 'quote', type: 'tuple',
      components: [
        { name: 'route', type: 'address[]' },
        { name: 'pairs', type: 'address[]' },
        { name: 'binSteps', type: 'uint256[]' },
        { name: 'versions', type: 'uint8[]' },
        { name: 'amounts', type: 'uint128[]' },
        { name: 'virtualAmountsWithoutSlippage', type: 'uint128[]' },
        { name: 'fees', type: 'uint128[]' },
      ],
    }],
  },
] as const;

const LB_ROUTER_ABI = [
  {
    name: 'swapExactTokensForNATIVE', type: 'function', stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinNATIVE', type: 'uint256' },
      { name: 'path', type: 'tuple', components: [
        { name: 'pairBinSteps', type: 'uint256[]' },
        { name: 'versions', type: 'uint8[]' },
        { name: 'tokenPath', type: 'address[]' },
      ] },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'swapExactNATIVEForTokens', type: 'function', stateMutability: 'payable',
    inputs: [
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'tuple', components: [
        { name: 'pairBinSteps', type: 'uint256[]' },
        { name: 'versions', type: 'uint8[]' },
        { name: 'tokenPath', type: 'address[]' },
      ] },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const ERC20_APPROVE_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
] as const;

export interface LbQuote {
  route: readonly Address[];
  pairs: readonly Address[];
  binSteps: readonly bigint[];
  versions: readonly number[];
  amounts: readonly bigint[]; // [amountIn, ...intermediate, amountOut]
  fees: readonly bigint[];
}

export async function getQuote(route: Address[], amountIn: bigint): Promise<LbQuote> {
  const quote = await publicClient.readContract({
    address: LB_QUOTER, abi: LB_QUOTER_ABI, functionName: 'findBestPathFromAmountIn',
    args: [route, amountIn],
  });
  if (quote.amounts.length === 0 || quote.amounts[quote.amounts.length - 1] === 0n) {
    throw new Error(`[flyfi/dex] no route/liquidity found for ${route.join(' -> ')}`);
  }
  return quote;
}

/** Price of 1 AVAX in USDC, from a live on-chain quote (not a separate price API). */
export async function getAvaxPriceUsd(): Promise<number> {
  const quote = await getQuote([WAVAX, usdcAddress], parseUnits('1', AVAX_DECIMALS));
  const amountOut = quote.amounts[quote.amounts.length - 1];
  return Number(formatUnits(amountOut, usdcDecimals));
}

function applySlippage(amountOut: bigint, slippageBps: bigint): bigint {
  return (amountOut * (10_000n - slippageBps)) / 10_000n;
}

function deadline(): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECONDS);
}

/** USDC -> native AVAX ("long"). Returns approve + swap calls plus the quote used. */
export async function buildSwapUsdcToAvaxCalls(
  usdcAmountIn: bigint, slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): Promise<{ calls: FlyCall[]; quote: LbQuote; minOut: bigint }> {
  const [quote, to] = await Promise.all([
    getQuote([usdcAddress, WAVAX], usdcAmountIn),
    getFlySmartAccountAddress(),
  ]);
  const amountOut = quote.amounts[quote.amounts.length - 1];
  const minOut = applySlippage(amountOut, slippageBps);

  const approveData: Hex = encodeFunctionData({
    abi: ERC20_APPROVE_ABI, functionName: 'approve', args: [LB_ROUTER, usdcAmountIn],
  });
  const swapData: Hex = encodeFunctionData({
    abi: LB_ROUTER_ABI, functionName: 'swapExactTokensForNATIVE',
    args: [
      usdcAmountIn, minOut,
      { pairBinSteps: quote.binSteps, versions: quote.versions, tokenPath: quote.route },
      to, deadline(),
    ],
  });

  return {
    calls: [
      { to: usdcAddress, data: approveData },
      { to: LB_ROUTER, data: swapData },
    ],
    quote, minOut,
  };
}

/** Native AVAX -> USDC ("short"). Single call, value carries the AVAX amount in. */
export async function buildSwapAvaxToUsdcCalls(
  avaxAmountIn: bigint, slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): Promise<{ calls: FlyCall[]; quote: LbQuote; minOut: bigint }> {
  const [quote, to] = await Promise.all([
    getQuote([WAVAX, usdcAddress], avaxAmountIn),
    getFlySmartAccountAddress(),
  ]);
  const amountOut = quote.amounts[quote.amounts.length - 1];
  const minOut = applySlippage(amountOut, slippageBps);

  const swapData: Hex = encodeFunctionData({
    abi: LB_ROUTER_ABI, functionName: 'swapExactNATIVEForTokens',
    args: [
      minOut,
      { pairBinSteps: quote.binSteps, versions: quote.versions, tokenPath: quote.route },
      to, deadline(),
    ],
  });

  return {
    calls: [{ to: LB_ROUTER, data: swapData, value: avaxAmountIn }],
    quote, minOut,
  };
}
