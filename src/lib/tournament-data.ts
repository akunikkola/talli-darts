import { createClient } from "./supabase/client";
import type {
  Tournament,
  TournamentFormat,
  TournamentGroup,
  BracketMatch,
  GroupPlayer,
  GroupMatch,
  TournamentSetupData,
} from "@/types/tournament";
import type { Player } from "./supabase-data";

// Generate a random ID
function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// Database row type
interface DbTournament {
  id: string;
  name: string;
  format: "cup" | "round_robin";
  game_mode: "301" | "501";
  player_count: number;
  bracket_size: number | null;
  group_count: number | null;
  status: "group_stage" | "knockout" | "completed";
  winner_id: string | null;
  second_place_id: string | null;
  third_place_id: string | null;
  bronze_match_enabled: boolean;
  legs_config: {
    groupStage: number;
    quarterfinal: number;
    semifinal: number;
    final: number;
    bronze: number;
  };
  groups: TournamentGroup[] | null;
  bracket: BracketMatch[] | null;
  created_at: string;
  completed_at: string | null;
}

// Convert DB tournament to app tournament
function dbToTournament(db: DbTournament): Tournament {
  return {
    id: db.id,
    name: db.name,
    format: db.format,
    gameMode: db.game_mode,
    playerCount: db.player_count,
    bracketSize: db.bracket_size as 4 | 8 | 16 | null,
    groupCount: db.group_count as 2 | 4 | null,
    status: db.status,
    winnerId: db.winner_id,
    secondPlaceId: db.second_place_id,
    thirdPlaceId: db.third_place_id,
    bronzeMatchEnabled: db.bronze_match_enabled,
    legsConfig: db.legs_config,
    groups: db.groups,
    bracket: db.bracket,
    createdAt: db.created_at,
    completedAt: db.completed_at,
  };
}

// Convert app tournament to DB format
function tournamentToDb(tournament: Partial<Tournament> & { id: string }): DbTournament {
  return {
    id: tournament.id,
    name: tournament.name || "",
    format: tournament.format || "cup",
    game_mode: tournament.gameMode || "501",
    player_count: tournament.playerCount || 0,
    bracket_size: tournament.bracketSize || null,
    group_count: tournament.groupCount || null,
    status: tournament.status || "knockout",
    winner_id: tournament.winnerId || null,
    second_place_id: tournament.secondPlaceId || null,
    third_place_id: tournament.thirdPlaceId || null,
    bronze_match_enabled: tournament.bronzeMatchEnabled || false,
    legs_config: tournament.legsConfig || {
      groupStage: 1,
      quarterfinal: 1,
      semifinal: 2,
      final: 3,
      bronze: 1,
    },
    groups: tournament.groups || null,
    bracket: tournament.bracket || null,
    created_at: tournament.createdAt || new Date().toISOString(),
    completed_at: tournament.completedAt || null,
  };
}

// Generate bracket for cup format
function generateCupBracket(
  players: Player[],
  bracketSize: 4 | 8 | 16,
  legsConfig: TournamentSetupData["legsConfig"],
  bronzeMatchEnabled: boolean,
  gameMode: "301" | "501"
): BracketMatch[] {
  // Sort players by game-mode specific ELO (descending)
  const sorted = [...players].sort((a, b) => {
    const eloA = gameMode === "301" ? a.elo301 : a.elo501;
    const eloB = gameMode === "301" ? b.elo301 : b.elo501;
    return eloB - eloA;
  });

  // Assign seeds
  const seeds: { player: Player | null; seed: number }[] = [];
  for (let i = 0; i < bracketSize; i++) {
    if (i < sorted.length) {
      seeds.push({ player: sorted[i], seed: i + 1 });
    } else {
      seeds.push({ player: null, seed: i + 1 });
    }
  }

  // Seeding patterns for proper bracket structure
  const seedingPatterns: Record<number, number[][]> = {
    4: [
      [1, 4],
      [2, 3],
    ],
    8: [
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ],
    16: [
      [1, 16],
      [8, 9],
      [5, 12],
      [4, 13],
      [3, 14],
      [6, 11],
      [7, 10],
      [2, 15],
    ],
  };

  const pattern = seedingPatterns[bracketSize];
  const matches: BracketMatch[] = [];

  // Calculate total rounds
  const totalRounds = Math.log2(bracketSize);

  // Create first round matches
  pattern.forEach((matchup, index) => {
    const seed1 = seeds.find((s) => s.seed === matchup[0])!;
    const seed2 = seeds.find((s) => s.seed === matchup[1])!;

    const legsToWin =
      totalRounds === 2
        ? legsConfig.semifinal // 4-player: first round is semifinal
        : totalRounds === 3
        ? legsConfig.quarterfinal // 8-player: first round is quarterfinal
        : legsConfig.quarterfinal; // 16-player: first round is round of 16

    // Check for walkover (BYE)
    const isWalkover = !seed1.player || !seed2.player;
    const walkoverWinner = seed1.player || seed2.player;

    matches.push({
      id: generateId(),
      round: 1,
      position: index,
      matchType: "regular",
      player1: seed1.player
        ? { id: seed1.player.id, name: seed1.player.name, seed: seed1.seed }
        : null,
      player2: seed2.player
        ? { id: seed2.player.id, name: seed2.player.name, seed: seed2.seed }
        : null,
      winnerId: isWalkover && walkoverWinner ? walkoverWinner.id : null,
      matchId: null,
      score: isWalkover ? { player1Legs: 0, player2Legs: 0 } : null,
      legsToWin,
      status: isWalkover ? "walkover" : seed1.player && seed2.player ? "ready" : "pending",
    });
  });

  // Create subsequent round matches (empty, to be filled as matches complete)
  for (let round = 2; round <= totalRounds; round++) {
    const matchesInRound = bracketSize / Math.pow(2, round);
    const isFinal = round === totalRounds;
    const isSemifinal = round === totalRounds - 1;

    const legsToWin = isFinal
      ? legsConfig.final
      : isSemifinal
      ? legsConfig.semifinal
      : legsConfig.quarterfinal;

    for (let pos = 0; pos < matchesInRound; pos++) {
      matches.push({
        id: generateId(),
        round,
        position: pos,
        matchType: "regular",
        player1: null,
        player2: null,
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin,
        status: "pending",
      });
    }
  }

  // Add bronze match if enabled
  if (bronzeMatchEnabled) {
    matches.push({
      id: generateId(),
      round: totalRounds, // Same round as final
      position: 1, // Position after final
      matchType: "bronze",
      player1: null,
      player2: null,
      winnerId: null,
      matchId: null,
      score: null,
      legsToWin: legsConfig.bronze,
      status: "pending",
    });
  }

  // Process walkovers to advance players
  return processWalkovers(matches);
}

// Process walkovers and advance players
function processWalkovers(matches: BracketMatch[]): BracketMatch[] {
  const updated = [...matches];
  let changed = true;

  while (changed) {
    changed = false;

    for (const match of updated) {
      if (match.status === "walkover" && match.winnerId) {
        // Find the next match this winner should advance to
        const nextRound = match.round + 1;
        const nextPosition = Math.floor(match.position / 2);
        const isPlayer1 = match.position % 2 === 0;

        const nextMatch = updated.find(
          (m) => m.round === nextRound && m.position === nextPosition && m.matchType === "regular"
        );

        if (nextMatch) {
          const winner = match.player1?.id === match.winnerId ? match.player1 : match.player2;

          if (winner) {
            if (isPlayer1 && !nextMatch.player1) {
              nextMatch.player1 = winner;
              changed = true;
            } else if (!isPlayer1 && !nextMatch.player2) {
              nextMatch.player2 = winner;
              changed = true;
            }

            // Check if next match is ready
            if (nextMatch.player1 && nextMatch.player2 && nextMatch.status === "pending") {
              nextMatch.status = "ready";
              changed = true;
            }
          }
        }
      }
    }
  }

  return updated;
}

// Generate groups for round-robin format
function generateRoundRobinGroups(
  players: Player[],
  groupCount: 2 | 4,
  legsConfig: TournamentSetupData["legsConfig"],
  gameMode: "301" | "501"
): TournamentGroup[] {
  // Sort players by game-mode specific ELO (descending)
  const sorted = [...players].sort((a, b) => {
    const eloA = gameMode === "301" ? a.elo301 : a.elo501;
    const eloB = gameMode === "301" ? b.elo301 : b.elo501;
    return eloB - eloA;
  });

  // Snake draft into groups
  const groups: TournamentGroup[] = Array.from({ length: groupCount }, (_, i) => ({
    id: generateId(),
    name: `Group ${String.fromCharCode(65 + i)}`,
    players: [],
    matches: [],
  }));

  sorted.forEach((player, index) => {
    const round = Math.floor(index / groupCount);
    const groupIndex =
      round % 2 === 0 ? index % groupCount : groupCount - 1 - (index % groupCount);

    groups[groupIndex].players.push({
      id: player.id,
      name: player.name,
      played: 0,
      won: 0,
      lost: 0,
      legsFor: 0,
      legsAgainst: 0,
      points: 0,
    });
  });

  // Generate matches for each group (round-robin)
  groups.forEach((group) => {
    const groupPlayers = group.players;
    const matches: GroupMatch[] = [];

    for (let i = 0; i < groupPlayers.length; i++) {
      for (let j = i + 1; j < groupPlayers.length; j++) {
        matches.push({
          id: generateId(),
          player1Id: groupPlayers[i].id,
          player2Id: groupPlayers[j].id,
          player1Name: groupPlayers[i].name,
          player2Name: groupPlayers[j].name,
          winnerId: null,
          score: null,
          matchId: null,
          status: "ready",
        });
      }
    }

    group.matches = matches;
  });

  return groups;
}

// Generate knockout bracket for round-robin (after group stage)
function generateRoundRobinKnockout(
  groupCount: 2 | 4,
  legsConfig: TournamentSetupData["legsConfig"],
  bronzeMatchEnabled: boolean
): BracketMatch[] {
  const matches: BracketMatch[] = [];

  if (groupCount === 2) {
    // 2 groups: A1 vs B2, B1 vs A2 → Final
    // Semifinals
    matches.push(
      {
        id: generateId(),
        round: 1,
        position: 0,
        matchType: "regular",
        player1: null, // A1
        player2: null, // B2
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.semifinal,
        status: "pending",
      },
      {
        id: generateId(),
        round: 1,
        position: 1,
        matchType: "regular",
        player1: null, // B1
        player2: null, // A2
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.semifinal,
        status: "pending",
      }
    );

    // Final
    matches.push({
      id: generateId(),
      round: 2,
      position: 0,
      matchType: "regular",
      player1: null,
      player2: null,
      winnerId: null,
      matchId: null,
      score: null,
      legsToWin: legsConfig.final,
      status: "pending",
    });

    // Bronze match
    if (bronzeMatchEnabled) {
      matches.push({
        id: generateId(),
        round: 2,
        position: 1,
        matchType: "bronze",
        player1: null,
        player2: null,
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.bronze,
        status: "pending",
      });
    }
  } else {
    // 4 groups: A1 vs B1, C1 vs D1 → Final
    // Semifinals
    matches.push(
      {
        id: generateId(),
        round: 1,
        position: 0,
        matchType: "regular",
        player1: null, // A1
        player2: null, // B1
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.semifinal,
        status: "pending",
      },
      {
        id: generateId(),
        round: 1,
        position: 1,
        matchType: "regular",
        player1: null, // C1
        player2: null, // D1
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.semifinal,
        status: "pending",
      }
    );

    // Final
    matches.push({
      id: generateId(),
      round: 2,
      position: 0,
      matchType: "regular",
      player1: null,
      player2: null,
      winnerId: null,
      matchId: null,
      score: null,
      legsToWin: legsConfig.final,
      status: "pending",
    });

    // Bronze match
    if (bronzeMatchEnabled) {
      matches.push({
        id: generateId(),
        round: 2,
        position: 1,
        matchType: "bronze",
        player1: null,
        player2: null,
        winnerId: null,
        matchId: null,
        score: null,
        legsToWin: legsConfig.bronze,
        status: "pending",
      });
    }
  }

  return matches;
}

// ============ TOURNAMENT API ============

export async function createTournament(
  setupData: TournamentSetupData,
  players: Player[]
): Promise<Tournament | null> {
  const supabase = createClient();

  const selectedPlayers = setupData.playerIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p !== undefined);

  let bracket: BracketMatch[] | null = null;
  let groups: TournamentGroup[] | null = null;
  let status: Tournament["status"] = "knockout";

  if (setupData.format === "cup") {
    bracket = generateCupBracket(
      selectedPlayers,
      setupData.bracketSize!,
      setupData.legsConfig,
      setupData.bronzeMatchEnabled,
      setupData.gameMode
    );
  } else {
    // Round-robin
    groups = generateRoundRobinGroups(
      selectedPlayers,
      setupData.groupCount!,
      setupData.legsConfig,
      setupData.gameMode
    );
    bracket = generateRoundRobinKnockout(
      setupData.groupCount!,
      setupData.legsConfig,
      setupData.bronzeMatchEnabled
    );
    status = "group_stage";
  }

  const tournament: Tournament = {
    id: generateId(),
    name: setupData.name,
    format: setupData.format,
    gameMode: setupData.gameMode,
    playerCount: selectedPlayers.length,
    bracketSize: setupData.format === "cup" ? setupData.bracketSize! : null,
    groupCount: setupData.format === "round_robin" ? setupData.groupCount! : null,
    status,
    winnerId: null,
    secondPlaceId: null,
    thirdPlaceId: null,
    bronzeMatchEnabled: setupData.bronzeMatchEnabled,
    legsConfig: setupData.legsConfig,
    groups,
    bracket,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  const dbTournament = tournamentToDb(tournament);

  const { data, error } = await supabase
    .from("tournaments")
    .insert(dbTournament)
    .select()
    .single();

  if (error) {
    console.error("Error creating tournament:", error);
    return null;
  }

  return data ? dbToTournament(data) : null;
}

export async function fetchTournament(id: string): Promise<Tournament | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching tournament:", error);
    return null;
  }

  return data ? dbToTournament(data) : null;
}

export async function fetchActiveTournament(): Promise<Tournament | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .neq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    // PGRST116 = no rows, 42P01 = table doesn't exist - both expected
    if (error.code !== "PGRST116" && error.code !== "42P01") {
      console.error("Error fetching active tournament:", error);
    }
    return null;
  }

  return data ? dbToTournament(data) : null;
}

export async function fetchTournaments(): Promise<Tournament[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    // Don't log if table doesn't exist or no data
    if (error.code !== '42P01' && error.code !== 'PGRST116') {
      console.error("Error fetching tournaments:", error);
    }
    return [];
  }

  return (data || []).map(dbToTournament);
}

export async function updateTournament(
  id: string,
  updates: Partial<Tournament>
): Promise<boolean> {
  const supabase = createClient();

  const dbUpdates: Partial<DbTournament> = {};
  if (updates.status !== undefined) dbUpdates.status = updates.status;
  if (updates.winnerId !== undefined) dbUpdates.winner_id = updates.winnerId;
  if (updates.secondPlaceId !== undefined) dbUpdates.second_place_id = updates.secondPlaceId;
  if (updates.thirdPlaceId !== undefined) dbUpdates.third_place_id = updates.thirdPlaceId;
  if (updates.groups !== undefined) dbUpdates.groups = updates.groups;
  if (updates.bracket !== undefined) dbUpdates.bracket = updates.bracket;
  if (updates.completedAt !== undefined) dbUpdates.completed_at = updates.completedAt;

  const { error } = await supabase.from("tournaments").update(dbUpdates).eq("id", id);

  if (error) {
    console.error("Error updating tournament:", error);
    return false;
  }

  return true;
}

export async function deleteTournament(id: string): Promise<boolean> {
  const supabase = createClient();

  const { error } = await supabase.from("tournaments").delete().eq("id", id);

  if (error) {
    console.error("Error deleting tournament:", error);
    return false;
  }

  return true;
}

// Subscribe to tournament changes
export function subscribeToTournament(
  id: string,
  callback: (tournament: Tournament | null) => void
) {
  const supabase = createClient();

  // Initial fetch
  fetchTournament(id).then(callback);

  // Subscribe to changes
  const channel = supabase
    .channel(`tournament-${id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "tournaments",
        filter: `id=eq.${id}`,
      },
      () => {
        fetchTournament(id).then(callback);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Update bracket match result
export async function updateBracketMatch(
  tournamentId: string,
  matchId: string,
  winnerId: string,
  score: { player1Legs: number; player2Legs: number },
  regularMatchId: string
): Promise<boolean> {
  const tournament = await fetchTournament(tournamentId);
  if (!tournament || !tournament.bracket) return false;

  const matchIndex = tournament.bracket.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return false;

  const match = tournament.bracket[matchIndex];
  const updatedBracket = [...tournament.bracket];

  // Update the match
  updatedBracket[matchIndex] = {
    ...match,
    winnerId,
    score,
    matchId: regularMatchId,
    status: "completed",
  };

  // Find loser for bronze match tracking
  const loserId = match.player1?.id === winnerId ? match.player2?.id : match.player1?.id;
  const loser = match.player1?.id === winnerId ? match.player2 : match.player1;

  // Advance winner to next round
  const totalRounds = Math.max(...tournament.bracket.map((m) => m.round));
  const nextRound = match.round + 1;
  const nextPosition = Math.floor(match.position / 2);
  const isPlayer1 = match.position % 2 === 0;

  if (match.matchType === "regular" && nextRound <= totalRounds) {
    const nextMatch = updatedBracket.find(
      (m) => m.round === nextRound && m.position === nextPosition && m.matchType === "regular"
    );

    if (nextMatch) {
      const winner = match.player1?.id === winnerId ? match.player1 : match.player2;
      const nextMatchIndex = updatedBracket.indexOf(nextMatch);

      if (isPlayer1) {
        updatedBracket[nextMatchIndex] = { ...nextMatch, player1: winner };
      } else {
        updatedBracket[nextMatchIndex] = { ...nextMatch, player2: winner };
      }

      // Check if next match is ready
      const updatedNext = updatedBracket[nextMatchIndex];
      if (updatedNext.player1 && updatedNext.player2 && updatedNext.status === "pending") {
        updatedBracket[nextMatchIndex] = { ...updatedNext, status: "ready" };
      }
    }

    // Handle bronze match - semifinal losers
    if (tournament.bronzeMatchEnabled && match.round === totalRounds - 1) {
      const bronzeMatch = updatedBracket.find((m) => m.matchType === "bronze");
      if (bronzeMatch && loser) {
        const bronzeIndex = updatedBracket.indexOf(bronzeMatch);
        if (match.position === 0) {
          updatedBracket[bronzeIndex] = { ...bronzeMatch, player1: loser };
        } else {
          updatedBracket[bronzeIndex] = { ...bronzeMatch, player2: loser };
        }

        // Check if bronze match is ready
        const updatedBronze = updatedBracket[bronzeIndex];
        if (updatedBronze.player1 && updatedBronze.player2 && updatedBronze.status === "pending") {
          updatedBracket[bronzeIndex] = { ...updatedBronze, status: "ready" };
        }
      }
    }
  }

  // Check if tournament is complete
  const finalMatch = updatedBracket.find(
    (m) => m.round === totalRounds && m.matchType === "regular"
  );
  const bronzeMatch = updatedBracket.find((m) => m.matchType === "bronze");

  let tournamentComplete = finalMatch?.status === "completed";
  if (tournament.bronzeMatchEnabled && bronzeMatch) {
    tournamentComplete = tournamentComplete && bronzeMatch.status === "completed";
  }

  const updates: Partial<Tournament> = { bracket: updatedBracket };

  if (tournamentComplete) {
    updates.status = "completed";
    updates.completedAt = new Date().toISOString();
    updates.winnerId = finalMatch?.winnerId || null;

    // Second place is the final loser
    if (finalMatch) {
      updates.secondPlaceId =
        finalMatch.player1?.id === finalMatch.winnerId
          ? finalMatch.player2?.id || null
          : finalMatch.player1?.id || null;
    }

    // Third place from bronze match
    if (bronzeMatch?.winnerId) {
      updates.thirdPlaceId = bronzeMatch.winnerId;
    }
  }

  return updateTournament(tournamentId, updates);
}

// Update group match result
export async function updateGroupMatch(
  tournamentId: string,
  groupId: string,
  matchId: string,
  winnerId: string,
  score: { player1Legs: number; player2Legs: number },
  regularMatchId: string
): Promise<boolean> {
  const tournament = await fetchTournament(tournamentId);
  if (!tournament || !tournament.groups) return false;

  const groupIndex = tournament.groups.findIndex((g) => g.id === groupId);
  if (groupIndex === -1) return false;

  const group = tournament.groups[groupIndex];
  const matchIndex = group.matches.findIndex((m) => m.id === matchId);
  if (matchIndex === -1) return false;

  const match = group.matches[matchIndex];
  const updatedGroups = [...tournament.groups];
  const updatedGroup = { ...group };

  // Update the match
  updatedGroup.matches = [...group.matches];
  updatedGroup.matches[matchIndex] = {
    ...match,
    winnerId,
    score,
    matchId: regularMatchId,
    status: "completed",
  };

  // Update player standings
  updatedGroup.players = group.players.map((p) => {
    if (p.id === match.player1Id) {
      const isWinner = winnerId === match.player1Id;
      return {
        ...p,
        played: p.played + 1,
        won: p.won + (isWinner ? 1 : 0),
        lost: p.lost + (isWinner ? 0 : 1),
        legsFor: p.legsFor + score.player1Legs,
        legsAgainst: p.legsAgainst + score.player2Legs,
        points: p.points + (isWinner ? 2 : 0),
      };
    }
    if (p.id === match.player2Id) {
      const isWinner = winnerId === match.player2Id;
      return {
        ...p,
        played: p.played + 1,
        won: p.won + (isWinner ? 1 : 0),
        lost: p.lost + (isWinner ? 0 : 1),
        legsFor: p.legsFor + score.player2Legs,
        legsAgainst: p.legsAgainst + score.player1Legs,
        points: p.points + (isWinner ? 2 : 0),
      };
    }
    return p;
  });

  updatedGroups[groupIndex] = updatedGroup;

  // Check if all group matches are complete
  const allGroupsComplete = updatedGroups.every((g) =>
    g.matches.every((m) => m.status === "completed")
  );

  const updates: Partial<Tournament> = { groups: updatedGroups };

  if (allGroupsComplete && tournament.bracket) {
    // Populate knockout bracket with group winners
    const updatedBracket = [...tournament.bracket];

    if (tournament.groupCount === 2) {
      // A1 vs B2, B1 vs A2
      const groupA = updatedGroups[0];
      const groupB = updatedGroups[1];

      const sortedA = [...groupA.players].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.legsFor - b.legsAgainst - (a.legsFor - a.legsAgainst);
      });
      const sortedB = [...groupB.players].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.legsFor - b.legsAgainst - (a.legsFor - a.legsAgainst);
      });

      const A1 = { id: sortedA[0].id, name: sortedA[0].name };
      const A2 = { id: sortedA[1].id, name: sortedA[1].name };
      const B1 = { id: sortedB[0].id, name: sortedB[0].name };
      const B2 = { id: sortedB[1].id, name: sortedB[1].name };

      // SF1: A1 vs B2
      const sf1Index = updatedBracket.findIndex((m) => m.round === 1 && m.position === 0);
      if (sf1Index !== -1) {
        updatedBracket[sf1Index] = {
          ...updatedBracket[sf1Index],
          player1: A1,
          player2: B2,
          status: "ready",
        };
      }

      // SF2: B1 vs A2
      const sf2Index = updatedBracket.findIndex((m) => m.round === 1 && m.position === 1);
      if (sf2Index !== -1) {
        updatedBracket[sf2Index] = {
          ...updatedBracket[sf2Index],
          player1: B1,
          player2: A2,
          status: "ready",
        };
      }
    } else {
      // 4 groups: A1 vs B1, C1 vs D1
      const groupWinners = updatedGroups.map((g) => {
        const sorted = [...g.players].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          return b.legsFor - b.legsAgainst - (a.legsFor - a.legsAgainst);
        });
        return { id: sorted[0].id, name: sorted[0].name };
      });

      // SF1: A1 vs B1
      const sf1Index = updatedBracket.findIndex((m) => m.round === 1 && m.position === 0);
      if (sf1Index !== -1) {
        updatedBracket[sf1Index] = {
          ...updatedBracket[sf1Index],
          player1: groupWinners[0],
          player2: groupWinners[1],
          status: "ready",
        };
      }

      // SF2: C1 vs D1
      const sf2Index = updatedBracket.findIndex((m) => m.round === 1 && m.position === 1);
      if (sf2Index !== -1) {
        updatedBracket[sf2Index] = {
          ...updatedBracket[sf2Index],
          player1: groupWinners[2],
          player2: groupWinners[3],
          status: "ready",
        };
      }
    }

    updates.bracket = updatedBracket;
    updates.status = "knockout";
  }

  return updateTournament(tournamentId, updates);
}
