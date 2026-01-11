"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayers, type Player } from "@/lib/players";

type RankingType = "overall" | "301" | "501";

export default function Leaderboard() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [rankingType, setRankingType] = useState<RankingType>("overall");

  useEffect(() => {
    setPlayers(getPlayers());
  }, []);

  const getSortedPlayers = () => {
    const sorted = [...players];
    switch (rankingType) {
      case "301":
        return sorted.sort((a, b) => b.elo301 - a.elo301);
      case "501":
        return sorted.sort((a, b) => b.elo501 - a.elo501);
      default:
        return sorted.sort((a, b) => b.elo - a.elo);
    }
  };

  const getElo = (player: Player) => {
    switch (rankingType) {
      case "301":
        return player.elo301;
      case "501":
        return player.elo501;
      default:
        return player.elo;
    }
  };

  const getWins = (player: Player) => {
    switch (rankingType) {
      case "301":
        return player.wins301;
      case "501":
        return player.wins501;
      default:
        return player.wins;
    }
  };

  const getLosses = (player: Player) => {
    switch (rankingType) {
      case "301":
        return player.losses301;
      case "501":
        return player.losses501;
      default:
        return player.losses;
    }
  };

  const sortedPlayers = getSortedPlayers();

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">Leaderboard</h1>
        <div className="w-10" />
      </div>

      {/* Ranking Type Tabs */}
      <div className="px-4 mb-4">
        <div className="grid grid-cols-3 gap-2 bg-[#2a2a2a] rounded-xl p-1">
          <button
            onClick={() => setRankingType("overall")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              rankingType === "overall"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Overall
          </button>
          <button
            onClick={() => setRankingType("301")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              rankingType === "301"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            301
          </button>
          <button
            onClick={() => setRankingType("501")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              rankingType === "501"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            501
          </button>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="px-4">
        <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
          {sortedPlayers.map((player, index) => (
            <div
              key={player.id}
              className="flex items-center px-4 py-4 border-b border-[#333] last:border-b-0"
            >
              <span
                className={`w-8 text-center font-bold text-lg ${
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
              <div className="flex-1 ml-3">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">{player.name}</span>
                  {player.club && (
                    <span className="text-xs bg-[#4ade80]/20 text-[#4ade80] px-2 py-0.5 rounded-full">
                      {player.club}
                    </span>
                  )}
                </div>
                <div className="flex gap-3 text-xs text-slate-500">
                  <span>{getWins(player)}W - {getLosses(player)}L</span>
                  {rankingType === "overall" && player.oneEighties > 0 && (
                    <span className="text-amber-400">{player.oneEighties}x 180</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[#4ade80] font-bold text-xl">{getElo(player).toFixed(2)}</span>
                <p className="text-slate-500 text-xs">ELO</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
