"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPlayers, resetAllStats, type Player } from "@/lib/players";
import { getMatches, clearMatches, type MatchResult } from "@/lib/matches";

interface Stats {
  totalMatches: number;
  totalLegs: number;
  total180s: number;
  mostWins: Player | null;
  highest180s: Player | null;
  highestElo: Player | null;
  biggestRivalry: { player1: string; player2: string; matches: number } | null;
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats>({
    totalMatches: 0,
    totalLegs: 0,
    total180s: 0,
    mostWins: null,
    highest180s: null,
    highestElo: null,
    biggestRivalry: null,
  });
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const loadStats = () => {
    const players = getPlayers();
    const matches = getMatches();

    // Calculate stats
    const totalMatches = matches.length;
    const totalLegs = matches.reduce((sum, m) => sum + m.player1Legs + m.player2Legs, 0);
    const total180s = players.reduce((sum, p) => sum + p.oneEighties, 0);

    // Find leaders
    const sortedByWins = [...players].sort((a, b) => b.wins - a.wins);
    const sortedBy180s = [...players].sort((a, b) => b.oneEighties - a.oneEighties);
    const sortedByElo = [...players].sort((a, b) => b.elo - a.elo);

    // Find biggest rivalry
    const rivalries: Record<string, number> = {};
    matches.forEach((match) => {
      const key = [match.player1Name, match.player2Name].sort().join(" vs ");
      rivalries[key] = (rivalries[key] || 0) + 1;
    });

    let biggestRivalry = null;
    let maxMatches = 0;
    Object.entries(rivalries).forEach(([key, count]) => {
      if (count > maxMatches) {
        maxMatches = count;
        const [p1, p2] = key.split(" vs ");
        biggestRivalry = { player1: p1, player2: p2, matches: count };
      }
    });

    setStats({
      totalMatches,
      totalLegs,
      total180s,
      mostWins: sortedByWins[0]?.wins > 0 ? sortedByWins[0] : null,
      highest180s: sortedBy180s[0]?.oneEighties > 0 ? sortedBy180s[0] : null,
      highestElo: sortedByElo[0] || null,
      biggestRivalry: maxMatches > 1 ? biggestRivalry : null,
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleResetAll = () => {
    resetAllStats();
    clearMatches();
    setShowResetConfirm(false);
    loadStats();
  };

  const StatCard = ({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) => (
    <div className="bg-[#2a2a2a] rounded-xl p-4">
      <p className="text-slate-400 text-sm">{label}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {subtext && <p className="text-slate-500 text-xs mt-1">{subtext}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">Stats</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Matches" value={stats.totalMatches} />
          <StatCard label="Legs" value={stats.totalLegs} />
          <StatCard label="180s" value={stats.total180s} />
        </div>

        {/* Leaders */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold">Leaders</h2>

          {stats.highestElo && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Highest ELO</p>
                <p className="text-white font-semibold">{stats.highestElo.name}</p>
              </div>
              <span className="text-[#4ade80] text-2xl font-bold">{stats.highestElo.elo.toFixed(2)}</span>
            </div>
          )}

          {stats.mostWins && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Most Wins</p>
                <p className="text-white font-semibold">{stats.mostWins.name}</p>
              </div>
              <span className="text-white text-2xl font-bold">{stats.mostWins.wins}</span>
            </div>
          )}

          {stats.highest180s && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Most 180s</p>
                <p className="text-white font-semibold">{stats.highest180s.name}</p>
              </div>
              <span className="text-amber-400 text-2xl font-bold">{stats.highest180s.oneEighties}</span>
            </div>
          )}

          {stats.biggestRivalry && (
            <div className="bg-[#2a2a2a] rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Biggest Rivalry</p>
              <p className="text-white font-semibold">
                {stats.biggestRivalry.player1} vs {stats.biggestRivalry.player2}
              </p>
              <p className="text-slate-500 text-sm">{stats.biggestRivalry.matches} matches</p>
            </div>
          )}
        </div>

        {stats.totalMatches === 0 && (
          <div className="bg-[#2a2a2a] rounded-xl p-8 text-center">
            <p className="text-slate-500">Play some matches to see stats!</p>
            <Link href="/play" className="text-[#4ade80] text-sm mt-2 inline-block">
              Start a game
            </Link>
          </div>
        )}

        {/* Reset All Stats Button */}
        <div className="pt-8 pb-4">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="w-full py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-xl font-semibold transition-colors"
          >
            Reset All Stats
          </button>
          <p className="text-slate-500 text-xs text-center mt-2">
            Resets all ELO to 1000 and clears match history
          </p>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-2">Reset All Stats?</h3>
            <p className="text-slate-400 mb-2">
              This will:
            </p>
            <ul className="text-slate-400 text-sm mb-4 space-y-1">
              <li>• Reset all players to 1000 ELO</li>
              <li>• Clear all wins, losses, and legs</li>
              <li>• Clear all 180s and checkouts</li>
              <li>• Delete all match history</li>
            </ul>
            <p className="text-amber-400 text-sm mb-4">
              This action cannot be undone!
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleResetAll}
                className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
