import { getAvaxPriceUsd, buildSwapUsdcToAvaxCalls, buildSwapAvaxToUsdcCalls } from '../lib/dex';
import { parseUnits } from 'viem';

const price = await getAvaxPriceUsd();
console.log('AVAX price (USDC quote):', price);

const usdcIn = parseUnits('1', 6); // 1 USDC
const long = await buildSwapUsdcToAvaxCalls(usdcIn);
console.log('quote 1 USDC ->', long.quote.amounts[long.quote.amounts.length - 1], 'wei AVAX, minOut(after slippage):', long.minOut);
console.log('calls:', long.calls.length);

const avaxIn = parseUnits('0.05', 18); // 0.05 AVAX
const short = await buildSwapAvaxToUsdcCalls(avaxIn);
console.log('quote 0.05 AVAX ->', short.quote.amounts[short.quote.amounts.length - 1], 'raw USDC, minOut(after slippage):', short.minOut);
console.log('calls:', short.calls.length);
