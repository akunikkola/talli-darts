"use client";

import Link from "next/link";
import { useData } from "@/context/DataContext";

// Calculate average ELO from 301 and 501 ratings
const getAverageElo = (player: { elo301: number; elo501: number }) => {
  return (player.elo301 + player.elo501) / 2;
};

export default function Home() {
  const { players, matches, loading } = useData();

  const topPlayers = [...players].sort((a, b) => getAverageElo(b) - getAverageElo(a)).slice(0, 5);
  const recentMatches = matches.slice(0, 5);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold text-white">Talli Darts</h1>
        <p className="text-slate-400 mt-1">ELO Tracker</p>
      </div>

      {/* Match Type Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/play/ranking"
          className="py-5 bg-[#4ade80] hover:bg-[#22c55e] text-black text-center rounded-2xl transition-colors"
        >
          <span className="text-lg font-bold block">Ranking Match</span>
          <span className="text-sm opacity-70">1v1 • ELO counted</span>
        </Link>
        <Link
          href="/play/practice"
          className="py-5 bg-[#f5a623] hover:bg-[#d98f1e] text-black text-center rounded-2xl transition-colors"
        >
          <span className="text-lg font-bold block">Practice Match</span>
          <span className="text-sm opacity-70">2-6 players</span>
        </Link>
      </div>

      {/* Top Players */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Leaderboard</h2>
          <Link href="/leaderboard" className="text-[#4ade80] text-sm">
            See all
          </Link>
        </div>
        <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
          {topPlayers.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No players yet</p>
          ) : (
            topPlayers.map((player, index) => (
              <div
                key={player.id}
                className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0"
              >
                <span
                  className={`w-6 text-center font-bold ${
                    index === 0
                      ? "text-yellow-400"
                      : index === 1
                      ? "text-slate-300"
                      : index === 2
                      ? "text-amber-600"
                      : "text-slate-500"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1 ml-3 flex items-center gap-2">
                  <span className="text-white">{player.name}</span>
                  {player.club && (
                    <span className="text-xs bg-[#4ade80]/20 text-[#4ade80] px-2 py-0.5 rounded-full">
                      {player.club}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-sm mr-4">
                  {player.wins}W - {player.losses}L
                </span>
                <span className="text-[#4ade80] font-semibold">{getAverageElo(player).toFixed(0)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Matches */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Recent Matches</h2>
          <Link href="/matches" className="text-[#4ade80] text-sm">
            See all
          </Link>
        </div>
        <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
          {recentMatches.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No matches yet</p>
          ) : (
            recentMatches.map((match) => {
              const isMultiPlayer = match.playerCount > 2;
              const otherPlayersCount = isMultiPlayer ? match.playerCount - 1 : 0;
              // For multi-player: player1 is winner, player2Name contains all other players
              const player2Display = isMultiPlayer
                ? `${match.player2Name.split(', ')[0]}+${otherPlayersCount - 1}`
                : match.player2Name;

              return (
                <div
                  key={match.id}
                  className="px-4 py-3 border-b border-[#333] last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          match.winnerId === match.player1Id
                            ? "text-white font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {match.player1Name}
                      </span>
                      <span className="text-slate-500">vs</span>
                      <span
                        className={
                          match.winnerId === match.player2Id
                            ? "text-white font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {player2Display}
                      </span>
                    </div>
                    <span className="text-slate-500 text-sm">
                      {match.player1Legs} - {match.player2Legs}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                    <span>{match.gameMode}</span>
                    <span>•</span>
                    <span className={match.isRanked ? "text-[#4ade80]" : "text-[#f5a623]"}>
                      {match.isRanked ? "Ranked" : "Practice"}
                    </span>
                    {isMultiPlayer && (
                      <>
                        <span>•</span>
                        <span className="text-slate-400">{match.playerCount} players</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{new Date(match.playedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/players"
          className="py-4 bg-[#2a2a2a] hover:bg-[#333] text-white text-center rounded-xl transition-colors"
        >
          Players
        </Link>
        <Link
          href="/stats"
          className="py-4 bg-[#2a2a2a] hover:bg-[#333] text-white text-center rounded-xl transition-colors"
        >
          Stats
        </Link>
      </div>
    </div>
  );
}
