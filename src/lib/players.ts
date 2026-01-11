export interface Player {
  id: string;
  name: string;
  group: "talli" | "visitor";
  // Overall stats
  elo: number;
  wins: number;
  losses: number;
  legsWon: number;
  legsLost: number;
  // Game-specific ELO
  elo301: number;
  elo501: number;
  wins301: number;
  wins501: number;
  losses301: number;
  losses501: number;
  // Other stats
  highestCheckout: number;
  oneEighties: number;
  // Profile info
  club: string;
  entranceSong: string;
  favoritePlayer: string;
  dartsModel: string;
  createdAt: string;
}

const TALLI_PLAYERS: Omit<Player, "id" | "createdAt">[] = [
  { name: "Aku", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Doron", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Jori", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Riku", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Samppa", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Timi", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Mäksä", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Tumppi", group: "talli", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
];

const VISITOR_PLAYERS: Omit<Player, "id" | "createdAt">[] = [
  { name: "Mygy", group: "visitor", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
  { name: "Mäkki", group: "visitor", elo: 1000, wins: 0, losses: 0, legsWon: 0, legsLost: 0, elo301: 1000, elo501: 1000, wins301: 0, wins501: 0, losses301: 0, losses501: 0, highestCheckout: 0, oneEighties: 0, club: "", entranceSong: "", favoritePlayer: "", dartsModel: "" },
];

const STORAGE_KEY = "talli-darts-players";

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function getDefaultPlayers(): Player[] {
  const now = new Date().toISOString();
  return [
    ...TALLI_PLAYERS.map((p) => ({ ...p, id: generateId(), createdAt: now })),
    ...VISITOR_PLAYERS.map((p) => ({ ...p, id: generateId(), createdAt: now })),
  ];
}

// Migration: add new fields to existing players
function migratePlayer(player: Partial<Player>): Player {
  return {
    id: player.id || generateId(),
    name: player.name || "Unknown",
    group: player.group || "visitor",
    elo: player.elo ?? 1000,
    wins: player.wins ?? 0,
    losses: player.losses ?? 0,
    legsWon: player.legsWon ?? 0,
    legsLost: player.legsLost ?? 0,
    elo301: player.elo301 ?? player.elo ?? 1000,
    elo501: player.elo501 ?? player.elo ?? 1000,
    wins301: player.wins301 ?? 0,
    wins501: player.wins501 ?? 0,
    losses301: player.losses301 ?? 0,
    losses501: player.losses501 ?? 0,
    highestCheckout: player.highestCheckout ?? 0,
    oneEighties: player.oneEighties ?? 0,
    club: player.club ?? "",
    entranceSong: player.entranceSong ?? "",
    favoritePlayer: player.favoritePlayer ?? "",
    dartsModel: player.dartsModel ?? "",
    createdAt: player.createdAt || new Date().toISOString(),
  };
}

export function getPlayers(): Player[] {
  if (typeof window === "undefined") return [];

  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) {
    const defaults = getDefaultPlayers();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }

  // Migrate existing players to new schema
  const players = JSON.parse(stored).map(migratePlayer);
  return players;
}

export function savePlayers(players: Player[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
}

export function getPlayer(id: string): Player | undefined {
  return getPlayers().find((p) => p.id === id);
}

export function addPlayer(name: string, group: "talli" | "visitor" = "visitor"): Player {
  const players = getPlayers();
  const newPlayer: Player = {
    id: generateId(),
    name,
    group,
    elo: 1000,
    wins: 0,
    losses: 0,
    legsWon: 0,
    legsLost: 0,
    elo301: 1000,
    elo501: 1000,
    wins301: 0,
    wins501: 0,
    losses301: 0,
    losses501: 0,
    highestCheckout: 0,
    oneEighties: 0,
    club: "",
    entranceSong: "",
    favoritePlayer: "",
    dartsModel: "",
    createdAt: new Date().toISOString(),
  };

  players.push(newPlayer);
  savePlayers(players);
  return newPlayer;
}

export function updatePlayer(id: string, updates: Partial<Player>): void {
  const players = getPlayers();
  const index = players.findIndex((p) => p.id === id);
  if (index !== -1) {
    players[index] = { ...players[index], ...updates };
    savePlayers(players);
  }
}

export function deletePlayer(id: string): void {
  const players = getPlayers().filter((p) => p.id !== id);
  savePlayers(players);
}

export function getTalliPlayers(): Player[] {
  return getPlayers().filter((p) => p.group === "talli");
}

export function getVisitorPlayers(): Player[] {
  return getPlayers().filter((p) => p.group === "visitor");
}

/**
 * Reset all stats for all players (ELO, wins, losses, legs, 180s)
 * Keeps player profiles (name, club, etc.)
 */
export function resetAllStats(): void {
  const players = getPlayers();
  const resetPlayers = players.map((player) => ({
    ...player,
    elo: 1000,
    elo301: 1000,
    elo501: 1000,
    wins: 0,
    losses: 0,
    wins301: 0,
    losses301: 0,
    wins501: 0,
    losses501: 0,
    legsWon: 0,
    legsLost: 0,
    oneEighties: 0,
    highestCheckout: 0,
  }));
  savePlayers(resetPlayers);
}
