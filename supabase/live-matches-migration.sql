-- Live matches table for spectator feature
-- Tracks in-progress matches for real-time spectating

create table public.live_matches (
  id text primary key,

  -- Player info
  player1_id text not null,
  player2_id text not null,
  player1_name text not null,
  player2_name text not null,

  -- Match settings
  game_mode text check (game_mode in ('301', '501')) not null,
  legs_to_win integer default 1 not null,
  is_ranked boolean default true not null,

  -- Live state
  player1_legs integer default 0 not null,
  player2_legs integer default 0 not null,
  player1_remaining integer not null,
  player2_remaining integer not null,
  current_player_index integer default 0 not null,
  current_leg integer default 1 not null,

  -- Live stats
  player1_avg numeric(10,2) default 0,
  player2_avg numeric(10,2) default 0,
  player1_one_eighties integer default 0,
  player2_one_eighties integer default 0,
  player1_double_attempts integer default 0,
  player2_double_attempts integer default 0,
  player1_double_hits integer default 0,
  player2_double_hits integer default 0,

  -- Throw history for detailed spectator view
  -- Format: { "legs": [{ "legNumber": 1, "starterId": 0, "winnerId": null, "throws": [{ "p1Rem": 501, "p2Rem": 501, "thrower": 0, "score": 60 }, ...] }] }
  throw_history jsonb default '{"legs": []}' not null,

  -- Status
  status text check (status in ('active', 'completed', 'abandoned')) default 'active',

  -- Optional tournament link
  tournament_id text,

  -- Timestamps
  started_at timestamptz default now() not null,
  last_updated_at timestamptz default now() not null
);

-- Enable RLS (permissive for now, same as other tables)
alter table public.live_matches enable row level security;
create policy "Allow all for live_matches" on public.live_matches for all using (true) with check (true);

-- Enable realtime for this table
alter publication supabase_realtime add table public.live_matches;

-- Indexes for efficient queries
create index idx_live_matches_status on public.live_matches(status);
create index idx_live_matches_last_updated on public.live_matches(last_updated_at desc);

-- ============================================
-- MIGRATION: Add double stats columns (if table already exists)
-- Run this if you already have the live_matches table
-- ============================================
-- alter table public.live_matches add column if not exists player1_double_attempts integer default 0;
-- alter table public.live_matches add column if not exists player2_double_attempts integer default 0;
-- alter table public.live_matches add column if not exists player1_double_hits integer default 0;
-- alter table public.live_matches add column if not exists player2_double_hits integer default 0;
