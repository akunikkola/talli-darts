import { createClient } from './supabase/client';
import type {
  LiveMatchState,
  LiveMatchRow,
  CreateLiveMatchInput,
  UpdateLiveMatchInput,
  ThrowHistory,
} from '@/types/live-match';

// Generate unique ID for live matches
function generateLiveMatchId(): string {
  return `live_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Convert database row to app format
function dbToLiveMatch(row: LiveMatchRow): LiveMatchState {
  return {
    id: row.id,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    player1Name: row.player1_name,
    player2Name: row.player2_name,
    gameMode: row.game_mode as "301" | "501",
    legsToWin: row.legs_to_win,
    isRanked: row.is_ranked,
    player1Legs: row.player1_legs,
    player2Legs: row.player2_legs,
    player1Remaining: row.player1_remaining,
    player2Remaining: row.player2_remaining,
    currentPlayerIndex: row.current_player_index,
    currentLeg: row.current_leg,
    player1Avg: row.player1_avg,
    player2Avg: row.player2_avg,
    player1OneEighties: row.player1_one_eighties,
    player2OneEighties: row.player2_one_eighties,
    throwHistory: row.throw_history || { legs: [] },
    status: row.status as "active" | "completed" | "abandoned",
    tournamentId: row.tournament_id || undefined,
    startedAt: row.started_at,
    lastUpdatedAt: row.last_updated_at,
  };
}

// Create a new live match
export async function createLiveMatch(
  input: CreateLiveMatchInput
): Promise<LiveMatchState | null> {
  const supabase = createClient();
  const id = generateLiveMatchId();

  // Initialize throw history with the first leg
  const initialHistory: ThrowHistory = {
    legs: [{
      legNumber: 1,
      starterId: input.currentPlayerIndex,
      winnerId: null,
      throws: [],
    }],
  };

  const row = {
    id,
    player1_id: input.player1Id,
    player2_id: input.player2Id,
    player1_name: input.player1Name,
    player2_name: input.player2Name,
    game_mode: input.gameMode,
    legs_to_win: input.legsToWin,
    is_ranked: input.isRanked,
    player1_legs: 0,
    player2_legs: 0,
    player1_remaining: input.startingScore,
    player2_remaining: input.startingScore,
    current_player_index: input.currentPlayerIndex,
    current_leg: 1,
    player1_avg: 0,
    player2_avg: 0,
    player1_one_eighties: 0,
    player2_one_eighties: 0,
    throw_history: initialHistory,
    status: 'active',
    tournament_id: input.tournamentId || null,
  };

  const { data, error } = await supabase
    .from('live_matches')
    .insert(row)
    .select()
    .single();

  if (error) {
    console.error('Error creating live match:', error);
    return null;
  }

  return data ? dbToLiveMatch(data as LiveMatchRow) : null;
}

// Update a live match
export async function updateLiveMatch(
  id: string,
  updates: UpdateLiveMatchInput
): Promise<boolean> {
  const supabase = createClient();

  const row: Record<string, unknown> = {
    last_updated_at: new Date().toISOString(),
  };

  if (updates.player1Legs !== undefined) row.player1_legs = updates.player1Legs;
  if (updates.player2Legs !== undefined) row.player2_legs = updates.player2Legs;
  if (updates.player1Remaining !== undefined) row.player1_remaining = updates.player1Remaining;
  if (updates.player2Remaining !== undefined) row.player2_remaining = updates.player2Remaining;
  if (updates.currentPlayerIndex !== undefined) row.current_player_index = updates.currentPlayerIndex;
  if (updates.currentLeg !== undefined) row.current_leg = updates.currentLeg;
  if (updates.player1Avg !== undefined) row.player1_avg = updates.player1Avg;
  if (updates.player2Avg !== undefined) row.player2_avg = updates.player2Avg;
  if (updates.player1OneEighties !== undefined) row.player1_one_eighties = updates.player1OneEighties;
  if (updates.player2OneEighties !== undefined) row.player2_one_eighties = updates.player2OneEighties;
  if (updates.throwHistory !== undefined) row.throw_history = updates.throwHistory;
  if (updates.status !== undefined) row.status = updates.status;

  const { error } = await supabase
    .from('live_matches')
    .update(row)
    .eq('id', id);

  if (error) {
    console.error('Error updating live match:', error);
    return false;
  }

  return true;
}

// Delete a live match
export async function deleteLiveMatch(id: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase
    .from('live_matches')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting live match:', error);
    return false;
  }

  return true;
}

// Fetch all active live matches
export async function fetchActiveLiveMatches(): Promise<LiveMatchState[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('live_matches')
    .select('*')
    .eq('status', 'active')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('Error fetching active live matches:', error);
    return [];
  }

  return (data || []).map((row) => dbToLiveMatch(row as LiveMatchRow));
}

// Fetch a single live match by ID
export async function fetchLiveMatch(id: string): Promise<LiveMatchState | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('live_matches')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null;
    }
    console.error('Error fetching live match:', error);
    return null;
  }

  return data ? dbToLiveMatch(data as LiveMatchRow) : null;
}

// Subscribe to all active live matches (for home page)
export function subscribeToLiveMatches(
  callback: (matches: LiveMatchState[]) => void
): () => void {
  const supabase = createClient();

  // Initial fetch
  fetchActiveLiveMatches().then(callback);

  // Subscribe to changes
  const channel = supabase
    .channel('live-matches-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_matches',
      },
      () => {
        // Re-fetch all active matches on any change
        fetchActiveLiveMatches().then(callback);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

// Subscribe to a single live match (for spectator page)
export function subscribeToLiveMatch(
  id: string,
  callback: (match: LiveMatchState | null) => void
): () => void {
  const supabase = createClient();

  // Initial fetch
  fetchLiveMatch(id).then(callback);

  // Subscribe to changes for this specific match
  const channel = supabase
    .channel(`live-match-${id}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'live_matches',
        filter: `id=eq.${id}`,
      },
      () => {
        // Re-fetch the match on any change
        fetchLiveMatch(id).then(callback);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
