function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[flyfi] missing required env var: ${name}`);
  return v;
}

export const env = {
  get SMOOTHSEND_API_KEY() {
    return required('SMOOTHSEND_API_KEY');
  },
  get PRIVATE_KEY() {
    return required('PRIVATE_KEY') as `0x${string}`;
  },
  get WALLET_NETWORK(): 'avalanche-fuji' | 'avalanche-mainnet' {
    const v = process.env.WALLET_NETWORK ?? 'avalanche-mainnet';
    if (v !== 'avalanche-fuji' && v !== 'avalanche-mainnet') {
      throw new Error(`[flyfi] WALLET_NETWORK must be avalanche-fuji or avalanche-mainnet, got: ${v}`);
    }
    return v;
  },
  get WALLET_DAILY_LIMIT(): number {
    return Number(process.env.WALLET_DAILY_LIMIT ?? '5');
  },
  get WALLET_PER_TX_LIMIT(): number {
    return Number(process.env.WALLET_PER_TX_LIMIT ?? '2');
  },
  get SIMULATE_ONLY(): boolean {
    return (process.env.SIMULATE_ONLY ?? 'true') !== 'false';
  },
  get STARVING_THRESHOLD_USD(): number {
    return Number(process.env.STARVING_THRESHOLD_USD ?? '1');
  },
  get SUPABASE_URL() {
    return required('SUPABASE_URL');
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return required('SUPABASE_SERVICE_ROLE_KEY');
  },
  get CRON_SECRET() {
    return required('CRON_SECRET');
  },
  // Optional, not required(): the connectome service is a separate deploy (a Hugging
  // Face Space) that may not exist yet. Unset just means that feature is skipped.
  get CONNECTOME_SERVICE_URL(): string | undefined {
    return process.env.CONNECTOME_SERVICE_URL;
  },
  get CONNECTOME_SECRET(): string | undefined {
    return process.env.CONNECTOME_SECRET;
  },
};
