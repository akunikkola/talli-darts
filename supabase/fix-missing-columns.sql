-- Fix missing columns in Talli Darts database
-- Run this in your Supabase SQL Editor to fix the stats not updating issue

-- Add missing haminas column to players table
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS haminas integer DEFAULT 0 NOT NULL;

-- Add missing columns to matches table (for detailed stats tracking)
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_elo_start numeric(10,2) DEFAULT 1000;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_elo_start numeric(10,2) DEFAULT 1000;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_darts integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_darts integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_sixty_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_sixty_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_eighty_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_eighty_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_hundred_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_hundred_plus integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_double_attempts integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_double_attempts integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_double_hits integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_double_hits integer DEFAULT 0;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player1_first9_avg numeric(10,2);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player2_first9_avg numeric(10,2);
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS player_count integer DEFAULT 2;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS all_player_names text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS tournament_id text;

-- =============================================
-- Fix stats for Doron vs Mygy match (23.01.2026)
-- Doron won 1-0 in 301, ELO change: +20.61 / -20.61
-- =============================================

-- Update Doron's stats (winner)
UPDATE public.players SET
  wins = wins + 1,
  wins301 = wins301 + 1,
  legs_won = legs_won + 1,
  elo = elo + 20.61,
  elo301 = elo301 + 20.61
WHERE name = 'Doron';

-- Update Mygy's stats (loser)
UPDATE public.players SET
  losses = losses + 1,
  losses301 = losses301 + 1,
  legs_lost = legs_lost + 1,
  elo = elo - 20.61,
  elo301 = elo301 - 20.61
WHERE name = 'Mygy';

-- Verify the fix worked
SELECT name, elo, elo301, wins, losses, wins301, losses301, legs_won, legs_lost
FROM public.players
WHERE name IN ('Doron', 'Mygy');
