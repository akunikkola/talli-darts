"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  fetchTournament,
  subscribeToTournament,
  deleteTournament,
} from "@/lib/tournament-data";
import type { Tournament, BracketMatch, TournamentGroup } from "@/types/tournament";

type ViewMode = "bracket" | "groups";

export default function TournamentViewPage() {
  const params = useParams();
  const router = useRouter();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("bracket");
  const [selectedGroup, setSelectedGroup] = useState(0);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [starterSelection, setStarterSelection] = useState<{
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    matchType: "bracket" | "group";
    matchId: string;
    groupId?: string;
    legsToWin: number;
  } | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeToTournament(tournamentId, (t) => {
      setTournament(t);
      setLoading(false);

      // Set initial view mode based on tournament status
      if (t && t.format === "round_robin" && t.status === "group_stage") {
        setViewMode("groups");
      }
    });

    return unsubscribe;
  }, [tournamentId]);

  const handleDelete = async () => {
    const success = await deleteTournament(tournamentId);
    if (success) {
      router.push("/");
    }
  };

  const handlePlayMatch = (match: BracketMatch) => {
    if (!tournament || !match.player1 || !match.player2) return;

    // Show starter selection modal
    setStarterSelection({
      player1: { id: match.player1.id, name: match.player1.name },
      player2: { id: match.player2.id, name: match.player2.name },
      matchType: "bracket",
      matchId: match.id,
      legsToWin: match.legsToWin,
    });
  };

  const handlePlayGroupMatch = (group: TournamentGroup, matchId: string) => {
    if (!tournament) return;

    const match = group.matches.find((m) => m.id === matchId);
    if (!match) return;

    // Show starter selection modal
    setStarterSelection({
      player1: { id: match.player1Id, name: match.player1Name },
      player2: { id: match.player2Id, name: match.player2Name },
      matchType: "group",
      matchId: match.id,
      groupId: group.id,
      legsToWin: tournament.legsConfig.groupStage,
    });
  };

  const handleStartMatch = (starterId: string) => {
    if (!tournament || !starterSelection) return;

    const searchParams = new URLSearchParams({
      p1: starterSelection.player1.id,
      p2: starterSelection.player2.id,
      mode: tournament.gameMode,
      legs: starterSelection.legsToWin.toString(),
      ranked: "true",
      tournamentId: tournament.id,
      tournamentMatchId: starterSelection.matchId,
      tournamentMatchType: starterSelection.matchType,
      starter: starterId,
    });

    if (starterSelection.matchType === "group" && starterSelection.groupId) {
      searchParams.set("tournamentGroupId", starterSelection.groupId);
    }

    setStarterSelection(null);
    router.push(`/play/game?${searchParams.toString()}`);
  };

  // Organize bracket by rounds
  const bracketByRound = useMemo(() => {
    if (!tournament?.bracket) return {};

    const rounds: Record<number, BracketMatch[]> = {};
    tournament.bracket.forEach((match) => {
      if (!rounds[match.round]) {
        rounds[match.round] = [];
      }
      rounds[match.round].push(match);
    });

    // Sort matches by position within each round
    Object.keys(rounds).forEach((round) => {
      rounds[Number(round)].sort((a, b) => a.position - b.position);
    });

    return rounds;
  }, [tournament?.bracket]);

  const getRoundName = (round: number, totalRounds: number) => {
    if (totalRounds === 2) {
      return round === 1 ? "Semifinals" : "Final";
    } else if (totalRounds === 3) {
      if (round === 1) return "Quarterfinals";
      if (round === 2) return "Semifinals";
      return "Final";
    } else {
      if (round === 1) return "Round of 16";
      if (round === 2) return "Quarterfinals";
      if (round === 3) return "Semifinals";
      return "Final";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white">Loading tournament...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] p-4">
        <div className="text-center py-12">
          <p className="text-slate-400 mb-4">Tournament not found</p>
          <Link href="/" className="text-[#4ade80]">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const totalRounds = Math.max(
    ...Object.keys(bracketByRound).map(Number),
    1
  );

  const regularMatches = tournament.bracket?.filter(
    (m) => m.matchType === "regular"
  ) || [];
  const bronzeMatch = tournament.bracket?.find((m) => m.matchType === "bronze");

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Link href="/" className="text-slate-400 hover:text-white mr-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-white">{tournament.name}</h1>
            <div className="flex gap-2 text-xs text-slate-500">
              <span>{tournament.format === "cup" ? "Cup" : "Round-Robin"}</span>
              <span>-</span>
              <span>{tournament.gameMode}</span>
              <span>-</span>
              <span>{tournament.playerCount} players</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="p-2 text-slate-400 hover:text-red-400"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Status Banner */}
      {tournament.status === "completed" && (
        <div className="bg-[#4ade80]/20 border border-[#4ade80]/30 rounded-xl p-4 mb-4">
          <div className="text-center">
            <p className="text-[#4ade80] font-semibold mb-1">Tournament Complete!</p>
            {tournament.winnerId && (
              <p className="text-white">
                Winner:{" "}
                {tournament.bracket?.find(
                  (m) => m.matchType === "regular" && m.round === totalRounds
                )?.player1?.id === tournament.winnerId
                  ? tournament.bracket?.find(
                      (m) => m.matchType === "regular" && m.round === totalRounds
                    )?.player1?.name
                  : tournament.bracket?.find(
                      (m) => m.matchType === "regular" && m.round === totalRounds
                    )?.player2?.name}
              </p>
            )}
          </div>
        </div>
      )}

      {/* View Mode Tabs (for round-robin) */}
      {tournament.format === "round_robin" && (
        <div className="grid grid-cols-2 gap-2 bg-[#2a2a2a] rounded-xl p-1 mb-4">
          <button
            onClick={() => setViewMode("groups")}
            className={`py-2 rounded-lg font-semibold transition-colors ${
              viewMode === "groups"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Groups
          </button>
          <button
            onClick={() => setViewMode("bracket")}
            className={`py-2 rounded-lg font-semibold transition-colors ${
              viewMode === "bracket"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Knockout
          </button>
        </div>
      )}

      {/* Groups View */}
      {viewMode === "groups" && tournament.groups && (
        <div>
          {/* Group Tabs */}
          <div
            className={`grid gap-2 bg-[#2a2a2a] rounded-xl p-1 mb-4`}
            style={{
              gridTemplateColumns: `repeat(${tournament.groups.length}, 1fr)`,
            }}
          >
            {tournament.groups.map((group, index) => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(index)}
                className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
                  selectedGroup === index
                    ? "bg-[#4ade80] text-black"
                    : "text-white hover:bg-[#333]"
                }`}
              >
                {group.name}
              </button>
            ))}
          </div>

          {/* Group Standings */}
          <div className="bg-[#2a2a2a] rounded-xl overflow-hidden mb-4">
            <div className="grid grid-cols-7 gap-2 px-4 py-2 text-xs text-slate-500 border-b border-[#333]">
              <div className="col-span-2">Player</div>
              <div className="text-center">P</div>
              <div className="text-center">W</div>
              <div className="text-center">L</div>
              <div className="text-center">+/-</div>
              <div className="text-center">Pts</div>
            </div>
            {[...tournament.groups[selectedGroup].players]
              .sort((a, b) => {
                if (b.points !== a.points) return b.points - a.points;
                return b.legsFor - b.legsAgainst - (a.legsFor - a.legsAgainst);
              })
              .map((player, index) => (
                <div
                  key={player.id}
                  className={`grid grid-cols-7 gap-2 px-4 py-3 border-b border-[#333] last:border-b-0 ${
                    index < (tournament.groupCount === 2 ? 2 : 1)
                      ? "bg-[#4ade80]/10"
                      : ""
                  }`}
                >
                  <div className="col-span-2 text-white truncate">
                    {player.name}
                  </div>
                  <div className="text-center text-slate-400">{player.played}</div>
                  <div className="text-center text-slate-400">{player.won}</div>
                  <div className="text-center text-slate-400">{player.lost}</div>
                  <div className="text-center text-slate-400">
                    {player.legsFor - player.legsAgainst > 0 ? "+" : ""}
                    {player.legsFor - player.legsAgainst}
                  </div>
                  <div className="text-center text-[#4ade80] font-semibold">
                    {player.points}
                  </div>
                </div>
              ))}
          </div>

          {/* Group Matches */}
          <h3 className="text-white font-semibold mb-3">Matches</h3>
          <div className="space-y-2">
            {tournament.groups[selectedGroup].matches.map((match) => {
              const isClickable = match.status === "completed" && match.matchId;
              const statusClass = match.status === "ready"
                ? "border-l-4 border-[#4ade80]"
                : match.status === "completed"
                ? "hover:bg-[#333] transition-colors"
                : "";

              const matchContent = (
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span
                      className={
                        match.winnerId === match.player1Id
                          ? "text-white font-semibold"
                          : "text-slate-400"
                      }
                    >
                      {match.player1Name}
                    </span>
                    <span className="text-slate-500 mx-2">vs</span>
                    <span
                      className={
                        match.winnerId === match.player2Id
                          ? "text-white font-semibold"
                          : "text-slate-400"
                      }
                    >
                      {match.player2Name}
                    </span>
                  </div>
                  {match.status === "completed" && match.score && (
                    <span className="text-slate-400 text-sm">
                      {match.score.player1Legs} - {match.score.player2Legs}
                    </span>
                  )}
                  {match.status === "ready" && (
                    <button
                      onClick={() =>
                        handlePlayGroupMatch(
                          tournament.groups![selectedGroup],
                          match.id
                        )
                      }
                      className="px-4 py-1 bg-[#4ade80] hover:bg-[#22c55e] text-black text-sm font-semibold rounded-lg"
                    >
                      Play
                    </button>
                  )}
                </div>
              );

              if (isClickable) {
                return (
                  <Link
                    key={match.id}
                    href={`/matches/${match.matchId}`}
                    className={`block bg-[#2a2a2a] rounded-xl p-3 ${statusClass}`}
                  >
                    {matchContent}
                  </Link>
                );
              }

              return (
                <div
                  key={match.id}
                  className={`bg-[#2a2a2a] rounded-xl p-3 ${statusClass}`}
                >
                  {matchContent}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bracket View */}
      {viewMode === "bracket" && (
        <div>
          {Object.keys(bracketByRound)
            .map(Number)
            .sort((a, b) => a - b)
            .map((round) => {
              const matches = bracketByRound[round].filter(
                (m) => m.matchType === "regular"
              );
              if (matches.length === 0) return null;

              return (
                <div key={round} className="mb-6">
                  <h3 className="text-white font-semibold mb-3">
                    {getRoundName(round, totalRounds)}
                  </h3>
                  <div className="space-y-2">
                    {matches.map((match) => (
                      <BracketMatchCard
                        key={match.id}
                        match={match}
                        onPlay={() => handlePlayMatch(match)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

          {/* Bronze Match */}
          {bronzeMatch && (
            <div className="mb-6">
              <h3 className="text-white font-semibold mb-3">Bronze Match</h3>
              <BracketMatchCard
                match={bronzeMatch}
                onPlay={() => handlePlayMatch(bronzeMatch)}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2a2a2a] rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-2">
              Delete Tournament?
            </h3>
            <p className="text-slate-400 mb-6">
              This will permanently delete the tournament and all its data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-3 bg-[#333] hover:bg-[#444] text-white rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Starter Selection Modal */}
      {starterSelection && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[#2a2a2a] rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-white font-semibold text-lg mb-2 text-center">
              Who throws first?
            </h3>
            <p className="text-slate-400 text-sm mb-6 text-center">
              The starter will alternate each leg
            </p>
            <div className="space-y-3">
              <button
                onClick={() => handleStartMatch(starterSelection.player1.id)}
                className="w-full py-4 bg-[#333] hover:bg-[#444] text-white rounded-xl font-semibold text-lg transition-colors"
              >
                {starterSelection.player1.name}
              </button>
              <button
                onClick={() => handleStartMatch(starterSelection.player2.id)}
                className="w-full py-4 bg-[#333] hover:bg-[#444] text-white rounded-xl font-semibold text-lg transition-colors"
              >
                {starterSelection.player2.name}
              </button>
            </div>
            <button
              onClick={() => setStarterSelection(null)}
              className="w-full mt-4 py-2 text-slate-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Bracket Match Card Component
function BracketMatchCard({
  match,
  onPlay,
}: {
  match: BracketMatch;
  onPlay: () => void;
}) {
  const getStatusColor = () => {
    switch (match.status) {
      case "ready":
        return "border-l-4 border-[#4ade80]";
      case "completed":
        return "hover:bg-[#333] transition-colors";
      case "walkover":
        return "opacity-60";
      default:
        return "opacity-50";
    }
  };

  const isClickable = match.status === "completed" && match.matchId;

  const content = (
    <>
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1">
          {/* Player 1 */}
          <div className="flex items-center">
            {match.player1 ? (
              <>
                {match.player1.seed && (
                  <span className="text-slate-500 text-sm w-6">
                    ({match.player1.seed})
                  </span>
                )}
                <span
                  className={`${
                    match.winnerId === match.player1.id
                      ? "text-white font-semibold"
                      : match.winnerId
                      ? "text-slate-500"
                      : "text-white"
                  } ${!match.player1.seed ? "ml-6" : ""}`}
                >
                  {match.player1.name}
                </span>
              </>
            ) : (
              <span className="text-slate-500 ml-6">TBD</span>
            )}
          </div>
          {/* Player 2 */}
          <div className="flex items-center">
            {match.player2 ? (
              <>
                {match.player2.seed && (
                  <span className="text-slate-500 text-sm w-6">
                    ({match.player2.seed})
                  </span>
                )}
                <span
                  className={`${
                    match.winnerId === match.player2.id
                      ? "text-white font-semibold"
                      : match.winnerId
                      ? "text-slate-500"
                      : "text-white"
                  } ${!match.player2.seed ? "ml-6" : ""}`}
                >
                  {match.player2.name}
                </span>
              </>
            ) : (
              <span className="text-slate-500 ml-6">TBD</span>
            )}
          </div>
        </div>

        {/* Score or Play Button */}
        <div className="ml-4">
          {match.status === "completed" && match.score && (
            <div className="text-right">
              <div
                className={
                  match.winnerId === match.player1?.id
                    ? "text-white font-semibold"
                    : "text-slate-500"
                }
              >
                {match.score.player1Legs}
              </div>
              <div
                className={
                  match.winnerId === match.player2?.id
                    ? "text-white font-semibold"
                    : "text-slate-500"
                }
              >
                {match.score.player2Legs}
              </div>
            </div>
          )}
          {match.status === "walkover" && (
            <span className="text-slate-500 text-sm">W/O</span>
          )}
          {match.status === "ready" && (
            <button
              onClick={onPlay}
              className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] text-black text-sm font-semibold rounded-lg"
            >
              Play
            </button>
          )}
        </div>
      </div>

      {/* Best of info */}
      <div className="text-xs text-slate-500 mt-2">
        Best of {match.legsToWin * 2 - 1}
      </div>
    </>
  );

  if (isClickable) {
    return (
      <Link
        href={`/matches/${match.matchId}`}
        className={`block bg-[#2a2a2a] rounded-xl p-3 ${getStatusColor()}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={`bg-[#2a2a2a] rounded-xl p-3 ${getStatusColor()}`}>
      {content}
    </div>
  );
}
