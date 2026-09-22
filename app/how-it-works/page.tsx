import Link from 'next/link';

export const metadata = {
  title: 'How it works · FlyFi',
};

const VISUAL_PURPLE = '#a78bfa';
const MOTOR_GREEN = '#22c55e';
const NEURON_CLOUD: Array<[number, number]> = Array.from({ length: 22 }, (_, i) => {
  const angle = (i * 137.5 * Math.PI) / 180;
  const radius = 6 + (i % 8) * 5.2;
  const cx = 60 + radius * Math.cos(angle) * 0.95;
  const cy = 50 + radius * Math.sin(angle) * 1.1;
  return [cx, cy];
});

export default function HowItWorks() {
  return (
    <main className="min-h-screen px-4 py-8 font-mono sm:py-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <Link href="/" className="text-[11px] text-gray-500 transition hover:text-accent-cyan">
          ← back to the fly
        </Link>

        <header className="space-y-3">
          <h1 className="font-pixel text-2xl leading-tight text-gray-100 sm:text-3xl">
            HOW IT WORKS<span className="text-accent-cyan">.</span>
          </h1>
          <p className="max-w-2xl text-sm text-gray-400">
            A real 166,700-neuron fly connectome proposes every trade. A small Q-table can
            veto it &mdash; but only once it has learned, from real outcomes, that the
            brain is wrong here.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            index="01 / INPUT"
            corner="AVAX · USDC"
            heading="The fly reads the market."
            body={
              <>
                Every tick, <Code>lib/dex.ts</Code> asks LFJ V2.2&rsquo;s on-chain quoter for a
                live AVAX/USDC price on Avalanche mainnet &mdash; the same quote the swap would
                execute at, not a separate price feed. The % change since the last tick is
                bucketed into one of <B>5 momentum buckets</B> (strong down / down / flat / up /
                strong up).
              </>
            }
          >
            <MomentumDiagram />
          </Panel>

          <Panel
            index="02 / CONNECTOME"
            corner="166,700 NEURONS · PROPOSES"
            heading="The real fly brain proposes a trade."
            body={
              <>
                That momentum bucket stimulates real neurons in a separately-hosted service
                running <B>fly.ai&rsquo;s</B> <Code>flybrain</Code> package &mdash; the actual
                MaleCNS v1.0 connectome (a pump stimulates <Code>LC10a</Code>; a drop stimulates{' '}
                <Code>LC4</Code>/<Code>LPLC2</Code>). After 50 simulated steps, one identified
                neuron pair (<Code>DNp20</Code> L/R), gated by a confidence neuron (
                <Code>DNpe017</Code>), gives an action &mdash; averaged over 8 trials since 1&ndash;2
                real neurons alone is noisy.
              </>
            }
          >
            <ConnectomeDiagram />
          </Panel>

          <Panel
            index="03 / Q-LEARNING"
            corner="10 STATES · VETO ONLY"
            heading="The Q-table can veto it."
            body={
              <>
                State is <Code>(momentum bucket, position)</Code>. The connectome&rsquo;s pick
                goes through <B>unless</B> the table has learned &mdash; from real portfolio
                outcomes, via the Bellman update below &mdash; that some other valid action has
                scored meaningfully better (<Code>&gt; 0.05</Code>) in this exact state. Early on,
                with an empty table, the brain drives almost everything.
              </>
            }
          >
            <QTableDiagram />
          </Panel>

          <Panel
            index="04 / EXECUTION"
            corner="LFJ V2.2 · GASLESS"
            heading="A decision can become a swap."
            body={
              <>
                Whichever action wins &mdash; brain or table &mdash; is checked against{' '}
                <Code>WALLET_PER_TX_LIMIT</Code> / <Code>WALLET_DAILY_LIMIT</Code> before
                anything is sent. If it clears, the swap executes on LFJ&rsquo;s router,
                gaslessly, through SmoothSend&rsquo;s ERC-4337 paymaster. A trade rejected for
                being too small is recorded as <Code>HOLD</Code>, never as the action that never
                happened.
              </>
            }
          >
            <ExecutionDiagram />
          </Panel>
        </div>

        <Panel
          index="05 / FEEDBACK"
          corner="DELAYED REWARD · WHO DROVE IT"
          heading="The outcome updates the table — and only the table."
          wide
          body={
            <>
              Reward is the portfolio&rsquo;s USD value delta since the previous tick &mdash;
              real profit or real loss, computed from the same DEX quote. It&rsquo;s applied one
              tick late, to the <B>previous</B> state/action pair, via the standard Bellman
              update (<Code>α=0.3, γ=0.9</Code>) &mdash; regardless of whether the brain or the
              table chose that action. That&rsquo;s how the table&rsquo;s veto power grows over
              time: it&rsquo;s built entirely from real trade outcomes, never from agreeing or
              disagreeing with the connectome. Every tick on the main page shows which one
              actually drove it &mdash; <span className="text-gray-200">🧠 brain drove it</span> or{' '}
              <span className="text-gray-200">📊 table drove it</span> &mdash; so you can watch
              the balance of power shift as the table learns.
            </>
          }
        >
          <FeedbackDiagram />
        </Panel>

        <div className="glass flex flex-col gap-3 rounded-xl border-l-2 border-accent-cyan/60 border-y border-r border-white/10 p-5 sm:flex-row sm:items-start">
          <span className="text-lg leading-none text-accent-cyan">?</span>
          <div className="space-y-2 text-xs leading-relaxed text-gray-400">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">
              A confident brain isn&rsquo;t a proven edge.
            </p>
            <p>
              The connectome reading is real neuron activity, not a simulation of one &mdash;
              but fly.ai&rsquo;s own published research found this general approach
              didn&rsquo;t reliably beat a non-learning baseline, and our own multi-trial testing
              found the same. Letting it drive most trades anyway is a deliberate choice for a
              project that&rsquo;s explicitly more interested in running a genuine biological
              simulation live than in squeezing out an edge.
            </p>
            <p>
              The 0.05 veto margin is a simple, honestly-undertuned judgment call, not a
              calibrated risk model. The Q-table is ten states wide &mdash; transparent and
              auditable, not a claim of sophistication. Nothing here is investment advice.
            </p>
          </div>
        </div>

        <div className="flex justify-center pb-4">
          <Link
            href="/"
            className="rounded-lg border border-dopamine/40 bg-dopamine/10 px-4 py-2 text-[11px] font-semibold text-dopamine transition hover:bg-dopamine/20"
          >
            back to the fly →
          </Link>
        </div>
      </div>
    </main>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-white/5 px-1 py-0.5 text-[0.85em] text-accent-cyan">{children}</code>;
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-gray-200">{children}</span>;
}

function Panel({
  index, corner, heading, body, children, wide,
}: {
  index: string; corner: string; heading: string; body: React.ReactNode; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className={`glass flex flex-col rounded-xl border border-white/10 p-5 shadow-xl ${wide ? 'lg:flex-row lg:gap-6' : ''}`}>
      <div className={wide ? 'lg:w-2/5' : ''}>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-widest text-gray-500">{index}</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-600">{corner}</span>
        </div>
        <div className="mt-3 flex h-36 items-center justify-center rounded-lg border border-white/5 bg-black/20 p-3">
          {children}
        </div>
      </div>
      <div className={wide ? 'mt-4 lg:mt-0 lg:w-3/5' : 'mt-4'}>
        <p className="text-sm font-semibold text-gray-100">{heading}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-gray-400">{body}</p>
      </div>
    </div>
  );
}

function MomentumDiagram() {
  const buckets = [-2, -1, 0, 1, 2];
  return (
    <svg viewBox="0 0 220 100" className="w-full max-w-[220px]">
      <polyline
        points="4,50 30,58 55,44 80,60 105,30 130,38 155,20 180,34 210,16"
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.5"
        opacity="0.8"
      />
      {buckets.map((b, i) => (
        <g key={b} transform={`translate(${34 + i * 38}, 78)`}>
          <rect
            width="18"
            height="18"
            rx="3"
            fill={b === 1 ? '#06b6d4' : 'rgba(255,255,255,0.06)'}
            stroke={b === 1 ? '#06b6d4' : 'rgba(255,255,255,0.15)'}
          />
          <text x="9" y="12" textAnchor="middle" fontSize="8" fill={b === 1 ? '#05070a' : '#64748b'}>
            {b}
          </text>
        </g>
      ))}
    </svg>
  );
}

function QTableDiagram() {
  const rows = [-2, -1, 0, 1, 2];
  const cols = ['SWAP→AVAX', 'SWAP→USDC', 'HOLD'];
  return (
    <svg viewBox="0 0 180 110" className="w-full max-w-[200px]">
      {rows.map((r, ri) =>
        cols.map((_, ci) => {
          const hot = ri === 3 && ci === 0;
          return (
            <rect
              key={`${ri}-${ci}`}
              x={30 + ci * 46}
              y={4 + ri * 20}
              width="42"
              height="16"
              rx="2"
              fill={hot ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.05)'}
              stroke={hot ? '#22c55e' : 'rgba(255,255,255,0.12)'}
            />
          );
        }),
      )}
      {rows.map((r, ri) => (
        <text key={r} x="0" y={16 + ri * 20} fontSize="8" fill="#64748b">
          {r}
        </text>
      ))}
    </svg>
  );
}

function ExecutionDiagram() {
  return (
    <svg viewBox="0 0 220 100" className="w-full max-w-[220px]">
      {[
        { x: 4, label: 'ACTION' },
        { x: 76, label: 'LIMIT CHECK' },
        { x: 148, label: 'SMOOTHSEND' },
      ].map((b, i) => (
        <g key={b.label}>
          <rect x={b.x} y="30" width="66" height="30" rx="4" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.15)" />
          <text x={b.x + 33} y="49" textAnchor="middle" fontSize="7.5" fill="#94a3b8">
            {b.label}
          </text>
          {i < 2 && (
            <line x1={b.x + 66} y1="45" x2={b.x + 76} y2="45" stroke="#22c55e" strokeWidth="1.5" markerEnd="url(#arrow)" />
          )}
        </g>
      ))}
      <defs>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#22c55e" />
        </marker>
      </defs>
      <text x="110" y="82" textAnchor="middle" fontSize="7" fill="#4b5563">
        LFJ V2.2 · AVALANCHE C-CHAIN
      </text>
    </svg>
  );
}

function FeedbackDiagram() {
  return (
    <svg viewBox="0 0 220 100" className="w-full max-w-[220px]">
      <polyline points="10,60 50,60 65,30 90,75 115,45 220,45" fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.4" />
      <path
        d="M 40 78 C 40 20, 180 20, 180 78"
        fill="none"
        stroke="#06b6d4"
        strokeWidth="1.3"
        strokeDasharray="3 3"
        markerEnd="url(#loop)"
      />
      <defs>
        <marker id="loop" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#06b6d4" />
        </marker>
      </defs>
      <text x="40" y="90" textAnchor="middle" fontSize="7" fill="#22c55e">
        reward
      </text>
      <text x="180" y="90" textAnchor="middle" fontSize="7" fill="#06b6d4">
        Q-update
      </text>
    </svg>
  );
}

function ConnectomeDiagram() {
  return (
    <svg viewBox="0 0 120 100" className="w-full max-w-[160px]">
      <path
        d="M60 6 C 26 6 10 30 16 54 C 20 76 36 90 60 94 C 84 90 100 76 104 54 C 110 30 94 6 60 6 Z"
        fill="none"
        stroke="#06b6d4"
        strokeOpacity="0.3"
        strokeWidth="1.2"
      />
      {NEURON_CLOUD.map(([x, y], i) => {
        const isVisual = y < 50;
        const color = isVisual ? VISUAL_PURPLE : MOTOR_GREEN;
        return <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 2.2 : 1.2} fill={color} opacity={i % 4 === 0 ? 0.9 : 0.45} />;
      })}
    </svg>
  );
}
