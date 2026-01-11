export interface MatchResult {
  id: string;
  // For 1v1 matches (backwards compatible)
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
  player1Avg: number;
  player2Avg: number;
  player1OneEighties: number;
  player2OneEighties: number;
  // For multi-player practice matches
  players?: { id: string; name: string; legs: number; avg: number }[];
  // Match details
  gameMode: "301" | "501" | "cricket";
  legsToWin: number;
  isRanked: boolean;
  highestCheckout: number;
  playedAt: string;
}

const STORAGE_KEY = "talli-darts-matches";

function migrateMatch(match: Partial<MatchResult>): MatchResult {
  return {
    id: match.id || Math.random().toString(36).substring(2, 9),
    player1Id: match.player1Id || "",
    player2Id: match.player2Id || "",
    player1Name: match.player1Name || "Unknown",
    player2Name: match.player2Name || "Unknown",
    winnerId: match.winnerId || "",
    winnerName: match.winnerName || "Unknown",
    player1Legs: match.player1Legs ?? 0,
    player2Legs: match.player2Legs ?? 0,
    player1EloChange: match.player1EloChange ?? 0,
    player2EloChange: match.player2EloChange ?? 0,
    player1Avg: match.player1Avg ?? 0,
    player2Avg: match.player2Avg ?? 0,
    player1OneEighties: match.player1OneEighties ?? 0,
    player2OneEighties: match.player2OneEighties ?? 0,
    players: match.players,
    gameMode: match.gameMode || "501",
    legsToWin: match.legsToWin ?? 1,
    isRanked: match.isRanked ?? true,
    highestCheckout: match.highestCheckout ?? 0,
    playedAt: match.playedAt || new Date().toISOString(),
  };
}

export function getMatches(): MatchResult[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];

  return JSON.parse(stored).map(migrateMatch);
}

export function saveMatch(match: Omit<MatchResult, "id" | "playedAt">): MatchResult {
  const matches = getMatches();
  const newMatch: MatchResult = {
    ...match,
    id: Math.random().toString(36).substring(2, 9),
    playedAt: new Date().toISOString(),
  };

  matches.unshift(newMatch);

  // Keep only last 200 matches
  if (matches.length > 200) {
    matches.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  return newMatch;
}

export function getRecentMatches(limit: number = 10): MatchResult[] {
  return getMatches().slice(0, limit);
}

export function getPlayerMatches(playerId: string): MatchResult[] {
  return getMatches().filter(
    (m) => m.player1Id === playerId || m.player2Id === playerId ||
           m.players?.some(p => p.id === playerId)
  );
}

export function getRankedMatches(): MatchResult[] {
  return getMatches().filter((m) => m.isRanked);
}

export function getPracticeMatches(): MatchResult[] {
  return getMatches().filter((m) => !m.isRanked);
}

export function clearMatches(): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
}

export function updateMatch(id: string, updates: Partial<MatchResult>): void {
  const matches = getMatches();
  const index = matches.findIndex((m) => m.id === id);
  if (index !== -1) {
    matches[index] = { ...matches[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  }
}

export function deleteMatch(id: string): void {
  const matches = getMatches().filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
}

/**
 * Delete a match and revert all related player stats
 * This reverses: ELO changes, wins/losses, legs, 180s
 */
export function deleteMatchAndRevertStats(
  id: string,
  getPlayer: (id: string) => {
    id: string;
    elo: number;
    elo301: number;
    elo501: number;
    wins: number;
    losses: number;
    wins301: number;
    losses301: number;
    wins501: number;
    losses501: number;
    legsWon: number;
    legsLost: number;
    oneEighties: number;
  } | undefined,
  updatePlayer: (id: string, updates: Record<string, number>) => void
): boolean {
  const matches = getMatches();
  const match = matches.find((m) => m.id === id);

  if (!match) return false;

  // Only revert stats for ranked matches (they're the only ones that affect ELO)
  if (match.isRanked) {
    const player1 = getPlayer(match.player1Id);
    const player2 = getPlayer(match.player2Id);

    if (player1) {
      const isWinner = match.winnerId === match.player1Id;
      const updates: Record<string, number> = {
        // Revert ELO change
        elo: roundTo2(player1.elo - match.player1EloChange),
        // Revert wins/losses
        wins: isWinner ? Math.max(0, player1.wins - 1) : player1.wins,
        losses: !isWinner ? Math.max(0, player1.losses - 1) : player1.losses,
        // Revert legs
        legsWon: Math.max(0, player1.legsWon - match.player1Legs),
        legsLost: Math.max(0, player1.legsLost - match.player2Legs),
        // Revert 180s
        oneEighties: Math.max(0, player1.oneEighties - match.player1OneEighties),
      };

      // Revert game-specific ELO and wins/losses
      if (match.gameMode === "301") {
        updates.elo301 = roundTo2(player1.elo301 - match.player1EloChange);
        updates.wins301 = isWinner ? Math.max(0, player1.wins301 - 1) : player1.wins301;
        updates.losses301 = !isWinner ? Math.max(0, player1.losses301 - 1) : player1.losses301;
      } else if (match.gameMode === "501") {
        updates.elo501 = roundTo2(player1.elo501 - match.player1EloChange);
        updates.wins501 = isWinner ? Math.max(0, player1.wins501 - 1) : player1.wins501;
        updates.losses501 = !isWinner ? Math.max(0, player1.losses501 - 1) : player1.losses501;
      }

      updatePlayer(match.player1Id, updates);
    }

    if (player2) {
      const isWinner = match.winnerId === match.player2Id;
      const updates: Record<string, number> = {
        // Revert ELO change
        elo: roundTo2(player2.elo - match.player2EloChange),
        // Revert wins/losses
        wins: isWinner ? Math.max(0, player2.wins - 1) : player2.wins,
        losses: !isWinner ? Math.max(0, player2.losses - 1) : player2.losses,
        // Revert legs
        legsWon: Math.max(0, player2.legsWon - match.player2Legs),
        legsLost: Math.max(0, player2.legsLost - match.player1Legs),
        // Revert 180s
        oneEighties: Math.max(0, player2.oneEighties - match.player2OneEighties),
      };

      // Revert game-specific ELO and wins/losses
      if (match.gameMode === "301") {
        updates.elo301 = roundTo2(player2.elo301 - match.player2EloChange);
        updates.wins301 = isWinner ? Math.max(0, player2.wins301 - 1) : player2.wins301;
        updates.losses301 = !isWinner ? Math.max(0, player2.losses301 - 1) : player2.losses301;
      } else if (match.gameMode === "501") {
        updates.elo501 = roundTo2(player2.elo501 - match.player2EloChange);
        updates.wins501 = isWinner ? Math.max(0, player2.wins501 - 1) : player2.wins501;
        updates.losses501 = !isWinner ? Math.max(0, player2.losses501 - 1) : player2.losses501;
      }

      updatePlayer(match.player2Id, updates);
    }
  }

  // Delete the match
  const remainingMatches = matches.filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remainingMatches));
  return true;
}

// Helper function for rounding
function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function addManualMatch(match: Omit<MatchResult, "id" | "playedAt"> & { playedAt?: string }): MatchResult {
  const matches = getMatches();
  const newMatch: MatchResult = {
    ...match,
    id: Math.random().toString(36).substring(2, 9),
    playedAt: match.playedAt || new Date().toISOString(),
  };

  matches.unshift(newMatch);

  if (matches.length > 200) {
    matches.pop();
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(matches));
  return newMatch;
}
