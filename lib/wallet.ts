import {
  createPublicClient, createWalletClient, http, formatUnits, type Address, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalanche, avalancheFuji } from 'viem/chains';
import {
  createSmoothSendAvaxClient, fetchAvaxAaPublicDefaults, predictSimpleAccountAddress,
  type AvaxSponsorshipMode,
} from '@smoothsend/sdk/avax';
import { env } from './env';

const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
] as const;

const isMainnet = env.WALLET_NETWORK === 'avalanche-mainnet';
const chain = isMainnet ? avalanche : avalancheFuji;
const sdkNetwork: 'testnet' | 'mainnet' = isMainnet ? 'mainnet' : 'testnet';
const usdcAddress: Address = isMainnet
  ? '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' // Avalanche mainnet USDC — chains/avax/bundler/src/config/supportedTokens.json
  : '0x5425890298aed601595a70AB815c96711a31Bc65'; // Fuji USDC — same file
const usdcDecimals = 6;

const account = privateKeyToAccount(env.PRIVATE_KEY);
const publicClient = createPublicClient({ chain, transport: http() });
const walletClient = createWalletClient({ account, chain, transport: http() });

const smoothsend = createSmoothSendAvaxClient({
  apiKey: env.SMOOTHSEND_API_KEY,
  network: sdkNetwork,
  publicClient,
  walletClient,
  ownerAddress: account.address,
});

let cachedSmartAccountAddress: Address | null = null;
export async function getFlySmartAccountAddress(): Promise<Address> {
  if (!cachedSmartAccountAddress) {
    const defaults = await fetchAvaxAaPublicDefaults();
    const factory = isMainnet ? defaults.simpleAccountFactoryMainnet : defaults.simpleAccountFactoryFuji;
    if (!factory) throw new Error(`[flyfi] could not resolve SimpleAccountFactory for ${sdkNetwork}`);
    cachedSmartAccountAddress = await predictSimpleAccountAddress({
      publicClient, factory, owner: account.address, salt: 0n,
    });
  }
  return cachedSmartAccountAddress;
}

export async function getUsdcBalance(): Promise<{ raw: bigint; formatted: string }> {
  const sender = await getFlySmartAccountAddress();
  const raw = await publicClient.readContract({
    address: usdcAddress, abi: ERC20_ABI, functionName: 'balanceOf', args: [sender],
  });
  return { raw, formatted: formatUnits(raw, usdcDecimals) };
}

export async function getAvaxBalance(): Promise<{ raw: bigint; formatted: string }> {
  const sender = await getFlySmartAccountAddress();
  const raw = await publicClient.getBalance({ address: sender });
  return { raw, formatted: formatUnits(raw, 18) };
}

export interface FlyCall { to: Address; data?: Hex; value?: bigint }

/**
 * Single chokepoint for every real on-chain action the fly takes (DEX swap calls,
 * vault sweep). SIMULATE_ONLY short-circuits here so no call site has to remember
 * to check it individually.
 */
export async function submitSponsoredCalls(
  calls: FlyCall[],
  opts?: { mode?: AvaxSponsorshipMode; feeToken?: Address },
): Promise<{ txHash: string; userOpHash: string; simulated: boolean }> {
  if (env.SIMULATE_ONLY) {
    console.log('[flyfi] SIMULATE_ONLY — skipping real submission', { calls, opts });
    return { txHash: '0xsimulated', userOpHash: '0xsimulated', simulated: true };
  }
  const mode = opts?.mode ?? 'user-pays-erc20';
  const result = await smoothsend.submitCalls({
    calls,
    mode,
    paymaster: opts?.feeToken ? { token: opts.feeToken, precheckBalance: true } : undefined,
    waitForReceipt: true,
  });
  return {
    txHash: result.transactionHash ?? result.userOpHash,
    userOpHash: result.userOpHash,
    simulated: false,
  };
}

export { publicClient, walletClient, account, usdcAddress, usdcDecimals, chain };
