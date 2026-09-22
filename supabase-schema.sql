-- Run this once in the Supabase project's SQL editor.

create table if not exists ticks (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  momentum_bucket smallint not null,
  position text not null check (position in ('AVAX', 'USDC')),
  action text not null check (action in ('SWAP_TO_AVAX', 'SWAP_TO_USDC', 'HOLD')),
  reward double precision not null,
  price_usd double precision not null,
  portfolio_value_usd double precision not null,
  usdc_balance double precision not null,
  avax_balance double precision not null,
  tx_hash text,
  simulated boolean not null default true,
  -- Real connectome's display-only read on the same momentum input (connectome-service/,
  -- a separate Python deploy). Null when that service isn't configured/reachable.
  -- Never influences `action` above.
  connectome_action text check (connectome_action in ('SWAP_TO_AVAX', 'SWAP_TO_USDC', 'HOLD')),
  connectome_diff_hz double precision,
  connectome_gate_rate double precision
);

create index if not exists ticks_created_at_idx on ticks (created_at desc);

-- One row per RL state, actions stored as a jsonb map (Action -> Q value).
create table if not exists q_table (
  state_key text primary key,
  actions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Small mutable knobs (e.g. tick_count for epsilon decay) — key/value, not schema-critical.
create table if not exists config (
  key text primary key,
  value jsonb not null
);
