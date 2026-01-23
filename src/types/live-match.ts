// Live match state for real-time spectating

// Single throw entry in the history
export interface ThrowEntry {
  p1Rem: number;  // Player 1 remaining after this throw
  p2Rem: number;  // Player 2 remaining after this throw
  thrower: number; // 0 or 1 (which player threw)
  score: number;   // The score thrown
}

// A single leg's data
export interface LegData {
  legNumber: number;
  starterId: number;  // 0 or 1 (which player started this leg)
  winnerId: number | null;  // 0 or 1 when leg is won, null if in progress
  throws: ThrowEntry[];
}

// The full throw history
export interface ThrowHistory {
  legs: LegData[];
}

export interface LiveMatchState {
  id: string;

  // Player info
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;

  // Match settings
  gameMode: "301" | "501";
  legsToWin: number;
  isRanked: boolean;

  // Live state
  player1Legs: number;
  player2Legs: number;
  player1Remaining: number;
  player2Remaining: number;
  currentPlayerIndex: number;
  currentLeg: number;

  // Stats
  player1Avg: number;
  player2Avg: number;
  player1OneEighties: number;
  player2OneEighties: number;

  // Throw history for detailed view
  throwHistory: ThrowHistory;

  // Status
  status: "active" | "completed" | "abandoned";

  // Optional tournament link
  tournamentId?: string;

  // Timestamps
  startedAt: string;
  lastUpdatedAt: string;
}

// Database row format (snake_case)
export interface LiveMatchRow {
  id: string;
  player1_id: string;
  player2_id: string;
  player1_name: string;
  player2_name: string;
  game_mode: string;
  legs_to_win: number;
  is_ranked: boolean;
  player1_legs: number;
  player2_legs: number;
  player1_remaining: number;
  player2_remaining: number;
  current_player_index: number;
  current_leg: number;
  player1_avg: number;
  player2_avg: number;
  player1_one_eighties: number;
  player2_one_eighties: number;
  throw_history: ThrowHistory;
  status: string;
  tournament_id: string | null;
  started_at: string;
  last_updated_at: string;
}

// Input for creating a live match (without id and timestamps)
export interface CreateLiveMatchInput {
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  gameMode: "301" | "501";
  legsToWin: number;
  isRanked: boolean;
  startingScore: number;
  currentPlayerIndex: number;
  tournamentId?: string;
}

// Input for updating a live match
export interface UpdateLiveMatchInput {
  player1Legs?: number;
  player2Legs?: number;
  player1Remaining?: number;
  player2Remaining?: number;
  currentPlayerIndex?: number;
  currentLeg?: number;
  player1Avg?: number;
  player2Avg?: number;
  player1OneEighties?: number;
  player2OneEighties?: number;
  throwHistory?: ThrowHistory;
  status?: "active" | "completed" | "abandoned";
}
