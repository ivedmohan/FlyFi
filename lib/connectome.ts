import { env } from './env';
import type { MomentumBucket, Action } from './rl';

export interface ConnectomeRead {
  action: Action;
  meanDiffHz: number;
  gateRate: number;
  trials: number;
  elapsedS: number;
}

/**
 * Calls the connectome-service (real MaleCNS connectome, separate Python/FastAPI deploy
 * — see connectome-service/) for a display/comparison-only read on the same momentum
 * input the Q-learner sees. Never used to execute a trade. Soft-fails to null on any
 * error (not configured, unreachable, timeout) — this is a bonus signal, not something
 * the tick loop should ever break over.
 */
export async function getConnectomeRead(momentumBucket: MomentumBucket): Promise<ConnectomeRead | null> {
  const url = env.CONNECTOME_SERVICE_URL;
  if (!url) return null;

  try {
    const controller = new AbortController();
    // 20s: measured a real 14.37s response from the actual hosted service on a cold
    // start (shared VM, other services running) — 5s was cutting off real, valid
    // responses, not just genuinely-dead ones.
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(`${url.replace(/\/$/, '')}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(env.CONNECTOME_SECRET ? { Authorization: `Bearer ${env.CONNECTOME_SECRET}` } : {}),
      },
      body: JSON.stringify({ momentum_bucket: momentumBucket }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      action: data.action,
      meanDiffHz: data.mean_diff_hz,
      gateRate: data.gate_rate,
      trials: data.trials,
      elapsedS: data.elapsed_s,
    };
  } catch (e) {
    console.warn('[flyfi/connectome] read failed, skipping:', e);
    return null;
  }
}
