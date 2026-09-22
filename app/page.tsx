'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import QRCode from 'qrcode';

const FlyDeskScene = dynamic(() => import('../components/FlyDeskScene'), {
  ssr: false,
  loading: () => <div className="flex h-48 items-center justify-center text-[11px] text-gray-600">loading scene…</div>,
});

interface Tick {
  timestamp: string;
  action: string;
  reward: number;
}

interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

interface FlyState {
  dataSource: { wallet: 'live' | 'mock'; decisions: 'live' | 'mock' };
  address: string;
  balances: { usdc: string; avax: string };
  avaxPriceUsd: number;
  position: 'AVAX' | 'USDC';
  lastAction: string | null;
  lastReward: number;
  momentumBucket: number;
  portfolioValueUsd: number;
  vaultSweptUsd: number;
  realSwapCount: number;
  tickCount: number;
  recentPnl: number;
  starving: boolean;
  history: Tick[];
  candles: Candle[];
  connectome: { action: string | null; diffHz: number | null; gateRate: number | null } | null;
}

const POLL_MS = 5000;
const DOPAMINE_THRESHOLD = 0.1;
const SHOCK_THRESHOLD = -0.1;
// Real, publicly documented scale of the MaleCNS v1.0 connectome (Janelia FlyEM et
// al., Sept 2026) that fly.ai and this project's narrative are built on — not a stat
// about our own system, shown as sourced flavor context next to the brain visual.
const CONNECTOME_NEURON_COUNT = 166_700;

type Mood = 'dopamine' | 'shock' | 'starving' | 'idle';

function moodOf(state: FlyState): Mood {
  if (state.starving) return 'starving';
  if (state.lastReward > DOPAMINE_THRESHOLD) return 'dopamine';
  if (state.lastReward < SHOCK_THRESHOLD) return 'shock';
  return 'idle';
}

function moodColor(mood: Mood): string {
  if (mood === 'dopamine') return '#22c55e';
  if (mood === 'shock') return '#ef4444';
  if (mood === 'starving') return '#4b5563';
  return '#06b6d4';
}

function moodToTradeStatus(mood: Mood): 'idle' | 'profit' | 'loss' {
  if (mood === 'dopamine') return 'profit';
  if (mood === 'shock') return 'loss';
  return 'idle';
}

function actionIcon(action: string) {
  if (action === 'SWAP_TO_AVAX') return '📈';
  if (action === 'SWAP_TO_USDC') return '📉';
  return '⏸️';
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function momentumLabel(m: number) {
  if (m >= 2) return '↑↑ strong up';
  if (m === 1) return '↑ up';
  if (m === 0) return '· flat';
  if (m === -1) return '↓ down';
  return '↓↓ strong down';
}

export default function Home() {
  const [state, setState] = useState<FlyState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as FlyState;
        if (!cancelled) {
          setState(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="glass rounded-xl border border-shock/40 px-6 py-4 text-center">
          <p className="text-sm text-shock">Failed to reach the fly</p>
          <p className="mt-1 text-xs text-gray-500">{error}</p>
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-500 animate-pulse-slow">🪰 waking up…</p>
      </main>
    );
  }

  const mood = moodOf(state);

  return (
    <main className="min-h-screen px-4 py-8 font-mono sm:py-10">
      <div className="mx-auto max-w-6xl space-y-4">
        <header className="flex flex-col items-center justify-between gap-3 border-b border-white/5 pb-4 sm:flex-row">
          <h1 className="font-pixel text-lg leading-none text-gray-100">
            🪰 FLY<span className="text-accent-cyan">FI</span>
          </h1>
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-gray-400">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                state.dataSource.wallet === 'live' ? 'bg-dopamine' : 'bg-gray-500'
              } animate-pulse-slow`}
            />
            FLY-01 · {CONNECTOME_NEURON_COUNT.toLocaleString()} NEURONS ·{' '}
            {state.dataSource.wallet === 'live' ? 'ONLINE' : 'MOCK'}
          </div>
        </header>

        {state.starving && (
          <div className="animate-pulse-slow rounded-xl border border-shock bg-shock/15 p-4 text-center shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <p className="text-sm font-bold tracking-wide text-shock">⚠ FEED THE FLY</p>
            <p className="mt-1 text-[11px] text-gray-300">balance critical — send AVAX or USDC to revive it</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <FlyExeWindow state={state} mood={mood} />
          </div>
          <div className="lg:col-span-2">
            <StashPanel state={state} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ChartPanel candles={state.candles} price={state.avaxPriceUsd} />
          <BrainVisual
            mood={mood}
            reward={state.lastReward}
            momentumBucket={state.momentumBucket}
            acting={state.lastAction != null && state.lastAction !== 'HOLD'}
            connectome={state.connectome}
          />
          <div className="flex flex-col gap-4">
            <VaultWidget state={state} />
            {!state.starving && <AddressCard address={state.address} />}
          </div>
        </div>

        <footer className="pt-2 text-center text-[10px] text-gray-700">
          gas sponsored by SmoothSend · swaps via LFJ on Avalanche C-Chain · AVAX/USD candles via CoinGecko
        </footer>
      </div>
    </main>
  );
}

function FlyExeWindow({ state, mood }: { state: FlyState; mood: Mood }) {
  const tradeStatus = moodToTradeStatus(mood);
  return (
    <div className="glass overflow-hidden rounded-xl border border-white/10 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2">
        <p className="flex items-center gap-2 text-[11px] text-gray-300">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: moodColor(mood) }} />
          FLY.EXE
        </p>
        <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-gray-500">
          {state.dataSource.decisions === 'live' ? 'LIVE' : 'SIM'}
        </span>
      </div>

      <div className="relative">
        <FlyDeskScene tradeStatus={tradeStatus} candles={state.candles} price={state.avaxPriceUsd} className="h-80 sm:h-[28rem]" />
        <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] text-gray-500">drag to orbit</span>
      </div>

      <div className="grid grid-cols-2 gap-px border-t border-white/10 bg-white/5 sm:grid-cols-4">
        <StatsFooterCell label="neurons" value={CONNECTOME_NEURON_COUNT.toLocaleString()} />
        <StatsFooterCell label="ticks" value={state.tickCount.toLocaleString()} />
        <StatsFooterCell label="real swaps" value={state.realSwapCount.toLocaleString()} />
        <StatsFooterCell label="momentum" value={momentumLabel(state.momentumBucket)} />
      </div>
    </div>
  );
}

function StatsFooterCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-gray-100">{value}</p>
    </div>
  );
}

function StashPanel({ state }: { state: FlyState }) {
  const [tab, setTab] = useState<'trades' | 'decisions'>('trades');
  const rows = tab === 'trades' ? state.history.filter((h) => h.action !== 'HOLD') : state.history;

  return (
    <div className="glass flex h-full flex-col rounded-xl border border-white/10 p-4 shadow-xl">
      <p className="font-pixel text-[10px] text-gray-300">THE STASH</p>

      <p className="mt-4 text-[10px] uppercase tracking-wide text-gray-500">total value</p>
      <p className="font-pixel text-3xl text-gray-100">${state.portfolioValueUsd.toFixed(2)}</p>
      <p className={`mt-1 text-xs font-medium ${state.recentPnl >= 0 ? 'text-dopamine' : 'text-shock'}`}>
        {state.recentPnl >= 0 ? '+' : ''}
        {state.recentPnl.toFixed(2)} <span className="text-gray-600">(last {state.history.length} ticks)</span>
      </p>

      <p className="mb-2 mt-4 text-[10px] uppercase tracking-wide text-gray-500">currently holding</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-white/10 p-2.5">
          <p className="text-[10px] text-gray-500">USDC</p>
          <p className="mt-1 text-sm font-semibold text-gray-100">${state.balances.usdc}</p>
        </div>
        <div
          className={`rounded-lg border p-2.5 ${state.position === 'AVAX' ? 'border-accent-cyan/60' : 'border-white/10'}`}
        >
          <p className="text-[10px] text-gray-500">AVAX · ${state.avaxPriceUsd.toFixed(2)}</p>
          <p className="mt-1 text-sm font-semibold text-gray-100">{state.balances.avax}</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2 text-[11px]">
        <button
          onClick={() => setTab('trades')}
          className={`rounded px-2 py-1 ${tab === 'trades' ? 'bg-dopamine/20 text-dopamine' : 'text-gray-500'}`}
        >
          TRADES {state.history.filter((h) => h.action !== 'HOLD').length}
        </button>
        <button
          onClick={() => setTab('decisions')}
          className={`rounded px-2 py-1 ${tab === 'decisions' ? 'bg-dopamine/20 text-dopamine' : 'text-gray-500'}`}
        >
          DECISIONS {state.history.length}
        </button>
      </div>

      <div className="mt-2 flex-1 overflow-y-auto">
        {rows.length === 0 && <p className="mt-2 text-xs text-gray-600">no ticks yet — trigger /api/tick to start</p>}
        <ul className="divide-y divide-white/5">
          {rows.map((h, i) => (
            <li key={i} className="flex items-center justify-between py-2 text-xs first:pt-0">
              <span className="text-gray-500">{new Date(h.timestamp).toLocaleTimeString()}</span>
              <span className="text-gray-300">
                {actionIcon(h.action)} {h.action}
              </span>
              <span className={`font-medium ${h.reward >= 0 ? 'text-dopamine' : 'text-shock'}`}>
                {h.reward > 0 ? '+' : ''}
                {h.reward.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ChartPanel({ candles, price }: { candles: Candle[]; price: number }) {
  return (
    <div className="glass flex flex-col rounded-xl border border-white/10 p-4 shadow-xl">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="panel-label text-accent-cyan">AVAX / USD</p>
        <p className="text-sm text-gray-200">${price.toFixed(2)}</p>
      </div>
      <div className="flex-1">
        <CandlestickChart candles={candles} />
      </div>
    </div>
  );
}

function CandlestickChart({ candles }: { candles: Candle[] }) {
  if (candles.length === 0) {
    return <p className="flex h-40 items-center justify-center text-[11px] text-gray-600">chart unavailable</p>;
  }
  const w = 280;
  const h = 160;
  const pad = 4;
  const max = Math.max(...candles.map((c) => c.h));
  const min = Math.min(...candles.map((c) => c.l));
  const range = max - min || 1;
  const slot = w / candles.length;
  const bodyWidth = Math.max(1, slot * 0.55);
  const y = (v: number) => pad + (1 - (v - min) / range) * (h - pad * 2);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full">
      {Array.from({ length: 4 }, (_, i) => (
        <line key={i} x1={0} y1={(h / 4) * i} x2={w} y2={(h / 4) * i} stroke="#ffffff" strokeOpacity="0.04" />
      ))}
      {candles.map((c, i) => {
        const x = i * slot + slot / 2;
        const up = c.c >= c.o;
        const color = up ? '#22c55e' : '#ef4444';
        const bodyTop = y(Math.max(c.o, c.c));
        const bodyBottom = y(Math.min(c.o, c.c));
        return (
          <g key={i}>
            <line x1={x} y1={y(c.h)} x2={x} y2={y(c.l)} stroke={color} strokeWidth="1" />
            <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={Math.max(1, bodyBottom - bodyTop)} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}

// Original abstract connectome illustration — a deterministic golden-angle spiral
// scatter of dots inside an oval outline, evoking a dense neuron cloud without being
// any specific character or copying any reference image. Split into two anatomical
// clusters using the real Janelia/Google MaleCNS color convention (purple = visual
// neurons, green = motor neurons) — upper cloud reacts to price momentum ("what the
// eyes see"), lower cloud reacts to whether the fly actually acted ("motor output").
const NEURON_CLOUD: Array<[number, number]> = Array.from({ length: 34 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const radius = 8 + (i % 12) * 6.5;
  const cx = 100 + radius * Math.cos(angle) * 0.95;
  const cy = 86 + radius * Math.sin(angle) * 1.15;
  return [cx, cy];
});
const VISUAL_PURPLE = '#a78bfa';
const MOTOR_GREEN = '#22c55e';

function BrainVisual({
  mood, reward, momentumBucket, acting, connectome,
}: {
  mood: Mood; reward: number; momentumBucket: number; acting: boolean;
  connectome: { action: string | null; diffHz: number | null; gateRate: number | null } | null;
}) {
  const ambient = moodColor(mood);
  return (
    <div className="glass relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/10 p-5 shadow-xl">
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: `radial-gradient(16rem 12rem at 50% 45%, ${ambient}33, transparent)` }}
      />
      <p className="panel-label relative self-start" style={{ color: ambient }}>
        FLY CNS · CONNECTOME
      </p>
      <svg viewBox="0 0 200 172" className="relative mt-1 w-full max-w-[220px]">
        <defs>
          <filter id="brain-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M100 8 C 42 8 16 52 26 92 C 33 128 60 154 100 160 C 140 154 167 128 174 92 C 184 52 158 8 100 8 Z"
          fill="none"
          stroke={ambient}
          strokeOpacity="0.3"
          strokeWidth="1.5"
        />
        {NEURON_CLOUD.map(([x, y], i) => {
          const isVisual = y < 86;
          const color = isVisual ? VISUAL_PURPLE : MOTOR_GREEN;
          const active = isVisual ? momentumBucket !== 0 : acting;
          const spiking = active && i % 3 === 0;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={spiking ? 3.4 : 1.6}
              fill={color}
              opacity={spiking ? 0.95 : 0.5}
              filter={spiking ? 'url(#brain-glow)' : undefined}
              className={spiking ? 'animate-node-pulse' : undefined}
            />
          );
        })}
      </svg>
      <div className="relative mt-2 flex w-full max-w-[220px] items-center justify-between text-[10px]">
        <span style={{ color: VISUAL_PURPLE }}>● visual</span>
        <span className="text-gray-600">{CONNECTOME_NEURON_COUNT.toLocaleString()} mapped</span>
        <span style={{ color: MOTOR_GREEN }}>● motor</span>
      </div>
      <p className="relative mt-1 text-[10px]" style={{ color: ambient }}>
        DOPAMINE {reward >= 0 ? '+' : ''}
        {reward.toFixed(2)}
      </p>
      <div className="relative mt-2 w-full max-w-[220px] border-t border-white/10 pt-2 text-center">
        {connectome ? (
          <>
            <p className="text-[10px] text-gray-400">
              real brain read: <span className="text-gray-200">{connectome.action}</span>
            </p>
            <p className="text-[9px] text-gray-600">
              Δ{connectome.diffHz?.toFixed(2)}Hz · gate {((connectome.gateRate ?? 0) * 100).toFixed(0)}%
              — display only, noisy signal (166,700 real neurons, not a vote)
            </p>
          </>
        ) : (
          <p className="text-[9px] text-gray-700">connectome service not connected</p>
        )}
      </div>
    </div>
  );
}

function VaultWidget({ state }: { state: FlyState }) {
  return (
    <div className="glass flex-1 rounded-xl border border-white/10 p-4 shadow-xl">
      <p className="panel-label text-accent-cyan">SMOOTHSEND VAULT</p>
      <p className="mt-2 text-2xl font-bold text-gray-100">${state.vaultSweptUsd.toFixed(2)}</p>
      <p className="mt-1 text-[11px] text-gray-500">
        USDC swept gaslessly · {state.realSwapCount} real swap{state.realSwapCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function AddressCard({ address }: { address: string }) {
  return (
    <div className="glass flex-1 rounded-xl border border-white/10 p-4 text-center shadow-xl">
      <p className="panel-label justify-center text-gray-500">WALLET</p>
      <div className="mt-3 flex justify-center">
        <AddressQr value={address} />
      </div>
      <p className="mt-2 text-[10px] text-gray-400">{shortAddr(address)}</p>
    </div>
  );
}

function AddressQr({ value }: { value: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value, { width: 120, margin: 1, color: { dark: '#e5e7eb', light: '#00000000' } })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!dataUrl) {
    return <div className="h-[120px] w-[120px] animate-pulse-slow rounded-lg bg-white/5" />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={dataUrl} alt="wallet address QR" className="h-[120px] w-[120px] rounded-lg" />;
}

