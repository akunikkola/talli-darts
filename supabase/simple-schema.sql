-- Talli Darts Simple Schema (No Auth Required)
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Drop existing tables if they exist (careful in production!)
drop table if exists public.matches cascade;
drop table if exists public.players cascade;

-- Players table
create table public.players (
  id text primary key,
  name text not null,
  "group" text check ("group" in ('talli', 'visitor')) default 'visitor' not null,
  elo numeric(10,2) default 1000.00 not null,
  elo301 numeric(10,2) default 1000.00 not null,
  elo501 numeric(10,2) default 1000.00 not null,
  wins integer default 0 not null,
  losses integer default 0 not null,
  wins301 integer default 0 not null,
  losses301 integer default 0 not null,
  wins501 integer default 0 not null,
  losses501 integer default 0 not null,
  legs_won integer default 0 not null,
  legs_lost integer default 0 not null,
  one_eighties integer default 0 not null,
  highest_checkout integer default 0 not null,
  club text default '' not null,
  entrance_song text default '' not null,
  favorite_player text default '' not null,
  darts_model text default '' not null,
  profile_picture_url text default null,
  archived_at timestamptz default null,
  created_at timestamptz default now() not null
);

-- Matches table
create table public.matches (
  id text primary key,
  player1_id text not null,
  player2_id text not null,
  player1_name text not null,
  player2_name text not null,
  winner_id text not null,
  winner_name text not null,
  player1_legs integer default 0 not null,
  player2_legs integer default 0 not null,
  player1_elo_change numeric(10,2) default 0 not null,
  player2_elo_change numeric(10,2) default 0 not null,
  player1_avg numeric(10,2) default 0 not null,
  player2_avg numeric(10,2) default 0 not null,
  player1_one_eighties integer default 0 not null,
  player2_one_eighties integer default 0 not null,
  game_mode text check (game_mode in ('301', '501', 'cricket')) not null,
  legs_to_win integer default 1 not null,
  is_ranked boolean default true not null,
  highest_checkout integer default 0 not null,
  player1_highest_checkout integer default 0 not null,
  player2_highest_checkout integer default 0 not null,
  played_at timestamptz default now() not null
);

-- Disable RLS for simplicity (this is a private friend group app)
alter table public.players enable row level security;
alter table public.matches enable row level security;

-- Allow all operations for everyone (no auth required)
create policy "Allow all for players" on public.players for all using (true) with check (true);
create policy "Allow all for matches" on public.matches for all using (true) with check (true);

-- Enable realtime for both tables
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.matches;

-- Create indexes for performance
create index idx_players_group on public.players("group");
create index idx_players_elo on public.players(elo desc);
create index idx_matches_played_at on public.matches(played_at desc);
create index idx_matches_is_ranked on public.matches(is_ranked);
