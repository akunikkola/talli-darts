export type TournamentFormat = "cup" | "round_robin";
export type TournamentStatus = "group_stage" | "knockout" | "completed";

export interface Tournament {
  id: string;
  name: string;
  format: TournamentFormat;
  gameMode: "301" | "501";
  playerCount: number;
  bracketSize: 4 | 8 | 16 | null; // For cup format
  groupCount: 2 | 4 | null; // For round-robin format
  status: TournamentStatus;
  winnerId: string | null;
  secondPlaceId: string | null;
  thirdPlaceId: string | null;
  bronzeMatchEnabled: boolean;
  legsConfig: {
    groupStage: number;
    quarterfinal: number;
    semifinal: number;
    final: number;
    bronze: number;
  };
  groups: TournamentGroup[] | null; // For round-robin
  bracket: BracketMatch[] | null; // Knockout matches
  createdAt: string;
  completedAt: string | null;
}

// For round-robin group stage
export interface TournamentGroup {
  id: string;
  name: string; // "Group A", "Group B"
  players: GroupPlayer[];
  matches: GroupMatch[];
}

export interface GroupPlayer {
  id: string;
  name: string;
  played: number;
  won: number;
  lost: number;
  legsFor: number;
  legsAgainst: number;
  points: number; // 2 for win, 0 for loss
}

export interface GroupMatch {
  id: string;
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
  winnerId: string | null;
  score: { player1Legs: number; player2Legs: number } | null;
  matchId: string | null; // Links to played match
  status: "pending" | "ready" | "completed";
}

// For knockout stage (both formats)
export interface BracketMatch {
  id: string;
  round: number; // 1=quarterfinal, 2=semifinal, 3=final (varies by bracket size)
  position: number;
  matchType: "regular" | "bronze";
  player1: { id: string; name: string; seed?: number } | null;
  player2: { id: string; name: string; seed?: number } | null;
  winnerId: string | null;
  matchId: string | null;
  score: { player1Legs: number; player2Legs: number } | null;
  legsToWin: number;
  status: "pending" | "ready" | "completed" | "walkover";
}

// Setup wizard types
export interface TournamentSetupData {
  name: string;
  format: TournamentFormat;
  gameMode: "301" | "501";
  playerIds: string[];
  bracketSize?: 4 | 8 | 16;
  groupCount?: 2 | 4;
  bronzeMatchEnabled: boolean;
  legsConfig: {
    groupStage: number;
    quarterfinal: number;
    semifinal: number;
    final: number;
    bronze: number;
  };
}
