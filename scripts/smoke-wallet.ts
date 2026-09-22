import { getFlySmartAccountAddress, getUsdcBalance, getAvaxBalance } from '../lib/wallet';

const addr = await getFlySmartAccountAddress();
console.log('smart account address:', addr);
const usdc = await getUsdcBalance();
console.log('usdc balance:', usdc.formatted);
const avax = await getAvaxBalance();
console.log('avax balance:', avax.formatted);
