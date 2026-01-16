-- Tournament Mode Migration
-- Run this in your Supabase SQL Editor to enable tournament functionality

-- Create tournaments table
create table public.tournaments (
  id text primary key,
  name text not null,
  format text check (format in ('cup', 'round_robin')) not null,
  game_mode text check (game_mode in ('301', '501')) not null,
  player_count integer not null,
  bracket_size integer check (bracket_size in (4, 8, 16)) default null,
  group_count integer check (group_count in (2, 4)) default null,
  status text check (status in ('group_stage', 'knockout', 'completed')) default 'knockout' not null,
  winner_id text default null,
  second_place_id text default null,
  third_place_id text default null,
  bronze_match_enabled boolean default false not null,
  legs_config jsonb not null,
  groups jsonb default null,
  bracket jsonb default null,
  created_at timestamptz default now() not null,
  completed_at timestamptz default null
);

-- Add tournament_id to matches table
alter table public.matches add column if not exists tournament_id text default null;

-- Add tournament stats to players table
alter table public.players add column if not exists tournament_wins integer default 0 not null;
alter table public.players add column if not exists tournament_second integer default 0 not null;
alter table public.players add column if not exists tournament_third integer default 0 not null;

-- Enable RLS for tournaments
alter table public.tournaments enable row level security;

-- Allow all operations for everyone (no auth required)
create policy "Allow all for tournaments" on public.tournaments for all using (true) with check (true);

-- Enable realtime for tournaments
alter publication supabase_realtime add table public.tournaments;

-- Create index for tournament status
create index idx_tournaments_status on public.tournaments(status);
create index idx_tournaments_created_at on public.tournaments(created_at desc);
create index idx_matches_tournament_id on public.matches(tournament_id);
