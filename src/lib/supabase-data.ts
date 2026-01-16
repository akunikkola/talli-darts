import { createClient } from './supabase/client';

// Database row types
interface DbPlayer {
  id: string;
  name: string;
  group: 'talli' | 'visitor';
  elo: number;
  elo301: number;
  elo501: number;
  wins: number;
  losses: number;
  wins301: number;
  losses301: number;
  wins501: number;
  losses501: number;
  legs_won: number;
  legs_lost: number;
  one_eighties: number;
  haminas: number;
  highest_checkout: number;
  club: string;
  entrance_song: string;
  favorite_player: string;
  darts_model: string;
  profile_picture_url: string | null;
  archived_at: string | null;
  created_at: string;
}

interface DbMatch {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  winner_id: string;
  winner_name: string;
  player1_legs: number;
  player2_legs: number;
  player1_elo_change: number;
  player2_elo_change: number;
  player1_elo_start: number;
  player2_elo_start: number;
  player1_avg: number;
  player2_avg: number;
  player1_one_eighties: number;
  player2_one_eighties: number;
  game_mode: '301' | '501' | 'cricket';
  legs_to_win: number;
  is_ranked: boolean;
  highest_checkout: number;
  player1_highest_checkout: number;
  player2_highest_checkout: number;
  played_at: string;
  player_count: number;
  all_player_names: string | null;
  player1_darts: number | null;
  player2_darts: number | null;
  player1_sixty_plus: number | null;
  player2_sixty_plus: number | null;
  player1_eighty_plus: number | null;
  player2_eighty_plus: number | null;
  player1_hundred_plus: number | null;
  player2_hundred_plus: number | null;
  player1_double_attempts: number | null;
  player2_double_attempts: number | null;
  player1_double_hits: number | null;
  player2_double_hits: number | null;
  started_at: string | null;
  player1_first9_avg: number | null;
  player2_first9_avg: number | null;
  tournament_id: string | null;
}

// Player type that matches our app's interface
export interface Player {
  id: string;
  name: string;
  group: "talli" | "visitor";
  elo: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  elo301: number;
  elo501: number;
  wins301: number;
  wins501: number;
  losses301: number;
  losses501: number;
  highestCheckout: number;
  oneEighties: number;
  haminas: number;
  club: string;
  entranceSong: string;
  favoritePlayer: string;
  dartsModel: string;
  profilePictureUrl: string | null;
  archivedAt: string | null;
  createdAt: string;
}

// Match type that matches our app's interface
export interface MatchResult {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerId: string;
  winnerName: string;
  player1Legs: number;
  player2Legs: number;
  player1EloChange: number;
  player2EloChange: number;
  player1EloStart: number;
  player2EloStart: number;
  player1Avg: number;
  player2Avg: number;
  player1OneEighties: number;
  player2OneEighties: number;
  gameMode: "301" | "501" | "cricket";
  legsToWin: number;
  isRanked: boolean;
  highestCheckout: number;
  player1HighestCheckout: number;
  player2HighestCheckout: number;
  playedAt: string;
  playerCount: number; // Number of players (2 for 1v1, more for multi-player)
  allPlayerNames?: string; // Comma-separated names for multi-player matches
  player1Darts?: number; // Total darts thrown by player 1
  player2Darts?: number; // Total darts thrown by player 2
  player1SixtyPlus?: number; // 60+ visits by player 1
  player2SixtyPlus?: number; // 60+ visits by player 2
  player1EightyPlus?: number; // 80+ visits by player 1
  player2EightyPlus?: number; // 80+ visits by player 2
  player1HundredPlus?: number; // 100+ visits by player 1
  player2HundredPlus?: number; // 100+ visits by player 2
  player1DoubleAttempts?: number; // Double attempts by player 1
  player2DoubleAttempts?: number; // Double attempts by player 2
  player1DoubleHits?: number; // Double hits by player 1
  player2DoubleHits?: number; // Double hits by player 2
  startedAt?: string; // When the match started
  player1First9Avg?: number; // First 9 darts average for player 1
  player2First9Avg?: number; // First 9 darts average for player 2
  tournamentId?: string; // Tournament ID if this is a tournament match
}

// Convert DB player to app player
function dbToPlayer(db: DbPlayer): Player {
  return {
    id: db.id,
    name: db.name,
    group: db.group,
    elo: db.elo,
    wins: db.wins,
    losses: db.losses,
    legsWon: db.legs_won,
    legsLost: db.legs_lost,
    elo301: db.elo301,
    elo501: db.elo501,
    wins301: db.wins301,
    wins501: db.wins501,
    losses301: db.losses301,
    losses501: db.losses501,
    highestCheckout: db.highest_checkout,
    oneEighties: db.one_eighties,
    haminas: db.haminas || 0,
    club: db.club,
    entranceSong: db.entrance_song,
    favoritePlayer: db.favorite_player,
    dartsModel: db.darts_model,
    profilePictureUrl: db.profile_picture_url,
    archivedAt: db.archived_at,
    createdAt: db.created_at,
  };
}

// Convert app player to DB format for insert/update
function playerToDb(player: Partial<Player>): Partial<DbPlayer> {
  const result: Record<string, unknown> = {};
  if (player.id !== undefined) result.id = player.id;
  if (player.name !== undefined) result.name = player.name;
  if (player.group !== undefined) result.group = player.group;
  if (player.elo !== undefined) result.elo = player.elo;
  if (player.wins !== undefined) result.wins = player.wins;
  if (player.losses !== undefined) result.losses = player.losses;
  if (player.legsWon !== undefined) result.legs_won = player.legsWon;
  if (player.legsLost !== undefined) result.legs_lost = player.legsLost;
  if (player.elo301 !== undefined) result.elo301 = player.elo301;
  if (player.elo501 !== undefined) result.elo501 = player.elo501;
  if (player.wins301 !== undefined) result.wins301 = player.wins301;
  if (player.wins501 !== undefined) result.wins501 = player.wins501;
  if (player.losses301 !== undefined) result.losses301 = player.losses301;
  if (player.losses501 !== undefined) result.losses501 = player.losses501;
  if (player.highestCheckout !== undefined) result.highest_checkout = player.highestCheckout;
  if (player.oneEighties !== undefined) result.one_eighties = player.oneEighties;
  if (player.haminas !== undefined) result.haminas = player.haminas;
  if (player.club !== undefined) result.club = player.club;
  if (player.entranceSong !== undefined) result.entrance_song = player.entranceSong;
  if (player.favoritePlayer !== undefined) result.favorite_player = player.favoritePlayer;
  if (player.dartsModel !== undefined) result.darts_model = player.dartsModel;
  if (player.profilePictureUrl !== undefined) result.profile_picture_url = player.profilePictureUrl;
  if (player.archivedAt !== undefined) result.archived_at = player.archivedAt;
  if (player.createdAt !== undefined) result.created_at = player.createdAt;
  return result as Partial<DbPlayer>;
}

// Convert DB match to app match
function dbToMatch(db: DbMatch): MatchResult {
  return {
    id: db.id,
    player1Id: db.player1_id,
    player2Id: db.player2_id,
    player1Name: db.player1_name,
    player2Name: db.player2_name,
    winnerId: db.winner_id,
    winnerName: db.winner_name,
    player1Legs: db.player1_legs,
    player2Legs: db.player2_legs,
    player1EloChange: db.player1_elo_change,
    player2EloChange: db.player2_elo_change,
    player1EloStart: db.player1_elo_start || 1000,
    player2EloStart: db.player2_elo_start || 1000,
    player1Avg: db.player1_avg,
    player2Avg: db.player2_avg,
    player1OneEighties: db.player1_one_eighties,
    player2OneEighties: db.player2_one_eighties,
    gameMode: db.game_mode,
    legsToWin: db.legs_to_win,
    isRanked: db.is_ranked,
    highestCheckout: db.highest_checkout,
    player1HighestCheckout: db.player1_highest_checkout || 0,
    player2HighestCheckout: db.player2_highest_checkout || 0,
    playedAt: db.played_at,
    playerCount: db.player_count || 2,
    allPlayerNames: db.all_player_names || undefined,
    player1Darts: db.player1_darts || undefined,
    player2Darts: db.player2_darts || undefined,
    player1SixtyPlus: db.player1_sixty_plus || undefined,
    player2SixtyPlus: db.player2_sixty_plus || undefined,
    player1EightyPlus: db.player1_eighty_plus || undefined,
    player2EightyPlus: db.player2_eighty_plus || undefined,
    player1HundredPlus: db.player1_hundred_plus || undefined,
    player2HundredPlus: db.player2_hundred_plus || undefined,
    player1DoubleAttempts: db.player1_double_attempts || undefined,
    player2DoubleAttempts: db.player2_double_attempts || undefined,
    player1DoubleHits: db.player1_double_hits || undefined,
    player2DoubleHits: db.player2_double_hits || undefined,
    startedAt: db.started_at || undefined,
    player1First9Avg: db.player1_first9_avg || undefined,
    player2First9Avg: db.player2_first9_avg || undefined,
    tournamentId: db.tournament_id || undefined,
  };
}

// Convert app match to DB format for insert
function matchToDb(match: Partial<MatchResult> & { id: string }): Partial<DbMatch> & { id: string } {
  return {
    id: match.id,
    player1_id: match.player1Id || '',
    player2_id: match.player2Id || '',
    player1_name: match.player1Name || '',
    player2_name: match.player2Name || '',
    winner_id: match.winnerId || '',
    winner_name: match.winnerName || '',
    player1_legs: match.player1Legs || 0,
    player2_legs: match.player2Legs || 0,
    player1_elo_change: match.player1EloChange || 0,
    player2_elo_change: match.player2EloChange || 0,
    player1_elo_start: match.player1EloStart || 1000,
    player2_elo_start: match.player2EloStart || 1000,
    player1_avg: match.player1Avg || 0,
    player2_avg: match.player2Avg || 0,
    player1_one_eighties: match.player1OneEighties || 0,
    player2_one_eighties: match.player2OneEighties || 0,
    game_mode: match.gameMode || '501',
    legs_to_win: match.legsToWin || 1,
    is_ranked: match.isRanked ?? true,
    highest_checkout: match.highestCheckout || 0,
    player1_highest_checkout: match.player1HighestCheckout || 0,
    player2_highest_checkout: match.player2HighestCheckout || 0,
    played_at: match.playedAt || new Date().toISOString(),
    player_count: match.playerCount || 2,
    all_player_names: match.allPlayerNames || null,
    player1_darts: match.player1Darts || null,
    player2_darts: match.player2Darts || null,
    player1_sixty_plus: match.player1SixtyPlus || null,
    player2_sixty_plus: match.player2SixtyPlus || null,
    player1_eighty_plus: match.player1EightyPlus || null,
    player2_eighty_plus: match.player2EightyPlus || null,
    player1_hundred_plus: match.player1HundredPlus || null,
    player2_hundred_plus: match.player2HundredPlus || null,
    player1_double_attempts: match.player1DoubleAttempts || null,
    player2_double_attempts: match.player2DoubleAttempts || null,
    player1_double_hits: match.player1DoubleHits || null,
    player2_double_hits: match.player2DoubleHits || null,
    started_at: match.startedAt || null,
    player1_first9_avg: match.player1First9Avg ?? null,
    player2_first9_avg: match.player2First9Avg ?? null,
    // Only include tournament_id if it has a value (column may not exist in older schemas)
    ...(match.tournamentId ? { tournament_id: match.tournamentId } : {}),
  };
}

// Generate a random ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Default players to initialize
const DEFAULT_TALLI_PLAYERS = [
  "Aku", "Doron", "Jori", "Riku", "Samppa", "Timi", "Mäksä", "Tumppi"
];
const DEFAULT_VISITOR_PLAYERS = ["Mygy", "Mäkki"];

// ============ PLAYERS API ============

export async function fetchPlayers(): Promise<Player[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .is('archived_at', null)  // Only fetch non-archived players
    .order('elo', { ascending: false });

  if (error) {
    console.error('Error fetching players:', error);
    return [];
  }

  return (data || []).map(dbToPlayer);
}

export async function fetchPlayer(id: string): Promise<Player | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching player:', error);
    return null;
  }

  return data ? dbToPlayer(data) : null;
}

export async function createPlayer(name: string, group: "talli" | "visitor" = "visitor"): Promise<Player | null> {
  const supabase = createClient();
  const newPlayer = {
    id: generateId(),
    name,
    group,
    elo: 1000,
    elo301: 1000,
    elo501: 1000,
    wins: 0,
    losses: 0,
    wins301: 0,
    losses301: 0,
    wins501: 0,
    losses501: 0,
    legs_won: 0,
    legs_lost: 0,
    one_eighties: 0,
    highest_checkout: 0,
    club: '',
    entrance_song: '',
    favorite_player: '',
    darts_model: '',
  };

  const { data, error } = await supabase
    .from('players')
    .insert(newPlayer)
    .select()
    .single();

  if (error) {
    console.error('Error creating player:', error);
    return null;
  }

  return data ? dbToPlayer(data) : null;
}

export async function updatePlayerDb(id: string, updates: Partial<Player>): Promise<boolean> {
  const supabase = createClient();
  const dbUpdates = playerToDb(updates);

  const { error } = await supabase
    .from('players')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('Error updating player:', error);
    return false;
  }

  // If name was changed, update all match records with this player
  if (updates.name) {
    const newName = updates.name;

    // Update matches where this player is player1
    await supabase
      .from('matches')
      .update({ player1_name: newName })
      .eq('player1_id', id);

    // Update matches where this player is player2
    await supabase
      .from('matches')
      .update({ player2_name: newName })
      .eq('player2_id', id);

    // Update matches where this player is the winner
    await supabase
      .from('matches')
      .update({ winner_name: newName })
      .eq('winner_id', id);
  }

  return true;
}

export async function deletePlayerDb(id: string): Promise<boolean> {
  // Soft delete: archive the player instead of deleting
  const supabase = createClient();
  const { error } = await supabase
    .from('players')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Error archiving player:', error);
    return false;
  }

  return true;
}

// Restore an archived player
export async function restorePlayerDb(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('players')
    .update({ archived_at: null })
    .eq('id', id);

  if (error) {
    console.error('Error restoring player:', error);
    return false;
  }

  return true;
}

// Fetch archived players (for admin purposes)
export async function fetchArchivedPlayers(): Promise<Player[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false });

  if (error) {
    console.error('Error fetching archived players:', error);
    return [];
  }

  return (data || []).map(dbToPlayer);
}

export async function resetAllPlayersStats(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('players')
    .update({
      elo: 1000,
      elo301: 1000,
      elo501: 1000,
      wins: 0,
      losses: 0,
      wins301: 0,
      losses301: 0,
      wins501: 0,
      losses501: 0,
      legs_won: 0,
      legs_lost: 0,
      one_eighties: 0,
      highest_checkout: 0,
    })
    .neq('id', ''); // Update all rows

  if (error) {
    console.error('Error resetting players:', error);
    return false;
  }

  return true;
}

export async function initializeDefaultPlayers(): Promise<void> {
  const supabase = createClient();

  // Check if any Talli players exist (more specific check to avoid duplicates)
  const { data: existing } = await supabase
    .from('players')
    .select('name')
    .eq('group', 'talli')
    .limit(1);
  if (existing && existing.length > 0) {
    return; // Players already initialized
  }

  // Create default players
  const allPlayers = [
    ...DEFAULT_TALLI_PLAYERS.map(name => ({
      id: generateId(),
      name,
      group: 'talli' as const,
      elo: 1000,
      elo301: 1000,
      elo501: 1000,
      wins: 0,
      losses: 0,
      wins301: 0,
      losses301: 0,
      wins501: 0,
      losses501: 0,
      legs_won: 0,
      legs_lost: 0,
      one_eighties: 0,
      highest_checkout: 0,
      club: '',
      entrance_song: '',
      favorite_player: '',
      darts_model: '',
    })),
    ...DEFAULT_VISITOR_PLAYERS.map(name => ({
      id: generateId(),
      name,
      group: 'visitor' as const,
      elo: 1000,
      elo301: 1000,
      elo501: 1000,
      wins: 0,
      losses: 0,
      wins301: 0,
      losses301: 0,
      wins501: 0,
      losses501: 0,
      legs_won: 0,
      legs_lost: 0,
      one_eighties: 0,
      highest_checkout: 0,
      club: '',
      entrance_song: '',
      favorite_player: '',
      darts_model: '',
    })),
  ];

  const { error } = await supabase.from('players').insert(allPlayers);
  if (error) {
    console.error('Error initializing default players:', error);
  }
}

// ============ MATCHES API ============

export async function fetchMatches(): Promise<MatchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('played_at', { ascending: false });

  if (error) {
    console.error('Error fetching matches:', error);
    return [];
  }

  return (data || []).map(dbToMatch);
}

export async function fetchRecentMatches(limit: number = 10): Promise<MatchResult[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('matches')
    .select('*')
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent matches:', error);
    return [];
  }

  return (data || []).map(dbToMatch);
}

export async function createMatch(match: Omit<MatchResult, 'id' | 'playedAt'>): Promise<MatchResult | null> {
  const supabase = createClient();
  const newMatch = matchToDb({
    ...match,
    id: generateId(),
    playedAt: new Date().toISOString(),
  });

  const { data, error } = await supabase
    .from('matches')
    .insert(newMatch)
    .select()
    .single();

  if (error) {
    console.error('Error creating match:', error);
    console.error('Match data that failed:', JSON.stringify(newMatch, null, 2));
    return null;
  }

  return data ? dbToMatch(data) : null;
}

export async function updateMatchDb(id: string, updates: Partial<MatchResult>): Promise<boolean> {
  const supabase = createClient();

  // Convert updates to DB format
  const dbUpdates: Record<string, unknown> = {};
  if (updates.player1Legs !== undefined) dbUpdates.player1_legs = updates.player1Legs;
  if (updates.player2Legs !== undefined) dbUpdates.player2_legs = updates.player2Legs;
  if (updates.winnerId !== undefined) dbUpdates.winner_id = updates.winnerId;
  if (updates.winnerName !== undefined) dbUpdates.winner_name = updates.winnerName;

  const { error } = await supabase
    .from('matches')
    .update(dbUpdates)
    .eq('id', id);

  if (error) {
    console.error('Error updating match:', error);
    return false;
  }

  return true;
}

export async function deleteMatchDb(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting match:', error);
    return false;
  }

  return true;
}

export async function clearAllMatches(): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('matches')
    .delete()
    .neq('id', ''); // Delete all rows

  if (error) {
    console.error('Error clearing matches:', error);
    return false;
  }

  return true;
}

// ============ PROFILE PICTURE UPLOAD ============

export async function uploadProfilePicture(playerId: string, file: File): Promise<string | null> {
  const supabase = createClient();

  // Create a unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `${playerId}-${Date.now()}.${fileExt}`;
  const filePath = `avatars/${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    console.error('Error uploading profile picture:', uploadError);
    return null;
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  // Update the player's profile_picture_url
  const { error: updateError } = await supabase
    .from('players')
    .update({ profile_picture_url: publicUrl })
    .eq('id', playerId);

  if (updateError) {
    console.error('Error updating player profile picture URL:', updateError);
    return null;
  }

  return publicUrl;
}

export async function deleteProfilePicture(playerId: string, currentUrl: string): Promise<boolean> {
  const supabase = createClient();

  // Extract the file path from the URL
  const urlParts = currentUrl.split('/avatars/');
  if (urlParts.length < 2) return false;

  const filePath = `avatars/${urlParts[1]}`;

  // Delete from storage
  const { error: deleteError } = await supabase.storage
    .from('avatars')
    .remove([filePath]);

  if (deleteError) {
    console.error('Error deleting profile picture:', deleteError);
  }

  // Clear the player's profile_picture_url
  const { error: updateError } = await supabase
    .from('players')
    .update({ profile_picture_url: null })
    .eq('id', playerId);

  if (updateError) {
    console.error('Error clearing player profile picture URL:', updateError);
    return false;
  }

  return true;
}

// ============ REAL-TIME SUBSCRIPTIONS ============

export function subscribeToPlayers(callback: (players: Player[]) => void) {
  const supabase = createClient();

  // Initial fetch
  fetchPlayers().then(callback);

  // Subscribe to changes
  const channel = supabase
    .channel('players-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'players' },
      () => {
        // Re-fetch all players on any change
        fetchPlayers().then(callback);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToMatches(callback: (matches: MatchResult[]) => void) {
  const supabase = createClient();

  // Initial fetch
  fetchMatches().then(callback);

  // Subscribe to changes
  const channel = supabase
    .channel('matches-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'matches' },
      () => {
        // Re-fetch all matches on any change
        fetchMatches().then(callback);
      }
    )
    .subscribe();

  // Return unsubscribe function
  return () => {
    supabase.removeChannel(channel);
  };
}
