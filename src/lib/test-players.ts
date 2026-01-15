// Test players that are excluded from leaderboards and don't affect ELO
export const TEST_PLAYER_NAMES = ["Testi 1", "Testi 2"];

export function isTestPlayer(playerName: string): boolean {
  return TEST_PLAYER_NAMES.includes(playerName);
}

export function isTestPlayerId(playerId: string, getPlayerName: (id: string) => string | undefined): boolean {
  const name = getPlayerName(playerId);
  return name ? isTestPlayer(name) : false;
}
