/**
 * Elo Rating System for Talli Darts
 *
 * - Starting rating: 1000.00
 * - K-factor: 32
 * - Rating precision: 2 decimal places
 * - Zero-sum system: Points gained by winner = points lost by loser
 */

const K_FACTOR = 32;
const DEFAULT_ELO = 1000.0;

/**
 * Round a number to 2 decimal places
 */
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Calculate expected score (probability of winning) for a player
 * Formula: E_a = 1 / (1 + 10^((R_b - R_a) / 400))
 */
export function calculateExpectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate new Elo rating after a match
 * Formula: R_new = R_old + K × (S - E)
 * where S = 1 for win, 0 for loss
 *
 * Returns the new rating rounded to 2 decimal places
 */
export function calculateNewElo(
  playerElo: number,
  opponentElo: number,
  won: boolean
): number {
  const expectedScore = calculateExpectedScore(playerElo, opponentElo);
  const actualScore = won ? 1 : 0;
  const newElo = playerElo + K_FACTOR * (actualScore - expectedScore);
  return roundTo2Decimals(newElo);
}

/**
 * Calculate new ratings for both players after a match
 * Returns both new ratings and the ELO changes
 *
 * This is a zero-sum system: winner gains exactly what loser loses
 */
export function calculateMatchElo(
  playerAElo: number,
  playerBElo: number,
  winnerIsA: boolean
): {
  newEloA: number;
  newEloB: number;
  changeA: number;
  changeB: number;
} {
  // Calculate expected scores
  const expectedA = calculateExpectedScore(playerAElo, playerBElo);
  const expectedB = 1 - expectedA;

  // Actual scores
  const scoreA = winnerIsA ? 1 : 0;
  const scoreB = winnerIsA ? 0 : 1;

  // Calculate new ratings
  const newEloA = roundTo2Decimals(playerAElo + K_FACTOR * (scoreA - expectedA));
  const newEloB = roundTo2Decimals(playerBElo + K_FACTOR * (scoreB - expectedB));

  return {
    newEloA,
    newEloB,
    changeA: roundTo2Decimals(newEloA - playerAElo),
    changeB: roundTo2Decimals(newEloB - playerBElo),
  };
}

/**
 * Calculate ELO changes for a multiplayer free-for-all match
 * Each player's rating is calculated against each opponent
 */
export function calculateMultiplayerElo(
  players: { id: string; elo: number }[],
  winnerId: string
): { id: string; newElo: number; change: number }[] {
  return players.map((player) => {
    let totalChange = 0;

    // Calculate ELO change against each opponent
    for (const opponent of players) {
      if (opponent.id === player.id) continue;

      const won = player.id === winnerId;
      const expectedScore = calculateExpectedScore(player.elo, opponent.elo);
      const actualScore = won ? 1 : 0;
      totalChange += K_FACTOR * (actualScore - expectedScore);
    }

    // Average the change across opponents
    const avgChange = roundTo2Decimals(totalChange / (players.length - 1));
    const newElo = roundTo2Decimals(player.elo + avgChange);

    return {
      id: player.id,
      newElo,
      change: avgChange,
    };
  });
}

export { DEFAULT_ELO, K_FACTOR };
