"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import type { Player } from "@/lib/supabase-data";

interface Stats {
  totalMatches: number;
  rankedMatches: number;
  practiceMatches: number;
  totalLegs: number;
  rankedLegs: number;
  practiceLegs: number;
  total180s: number;
  totalHaminas: number;
  mostWins: Player | null;
  highest180s: Player | null;
  highestHaminas: Player | null;
  highestRankingEver: { player: Player; elo: number } | null;
  biggestRivalry: { player1: string; player2: string; matches: number } | null;
  practiceMostPlayed: { name: string; count: number } | null;
}

export default function StatsPage() {
  const { players, matches, loading } = useData();

  const stats: Stats = useMemo(() => {
    // Separate ranked and practice matches
    const rankedMatchesList = matches.filter(m => m.isRanked);
    const practiceMatchesList = matches.filter(m => !m.isRanked);

    // Calculate stats
    const totalMatches = matches.length;
    const rankedMatches = rankedMatchesList.length;
    const practiceMatches = practiceMatchesList.length;
    const totalLegs = matches.reduce((sum, m) => sum + m.player1Legs + m.player2Legs, 0);
    const rankedLegs = rankedMatchesList.reduce((sum, m) => sum + m.player1Legs + m.player2Legs, 0);
    const practiceLegs = practiceMatchesList.reduce((sum, m) => sum + m.player1Legs + m.player2Legs, 0);
    const total180s = players.reduce((sum, p) => sum + p.oneEighties, 0);
    const totalHaminas = players.reduce((sum, p) => sum + p.haminas, 0);

    // Calculate average ELO from 301 and 501 ratings
    const getAverageElo = (p: typeof players[0]) => (p.elo301 + p.elo501) / 2;

    // Find leaders
    const sortedByWins = [...players].sort((a, b) => b.wins - a.wins);
    const sortedBy180s = [...players].sort((a, b) => b.oneEighties - a.oneEighties);
    const sortedByHaminas = [...players].sort((a, b) => b.haminas - a.haminas);

    // Find highest ranking ever from match history (ELO at start + change for winners)
    let highestRankingEver: { player: Player; elo: number } | null = null;
    let maxEloEver = 0;

    // Check all matches to find the highest ELO any player has reached
    rankedMatchesList.forEach((match) => {
      // Calculate ELO after match for player 1
      const p1EloAfter = match.player1EloStart + match.player1EloChange;
      // Calculate ELO after match for player 2
      const p2EloAfter = match.player2EloStart + match.player2EloChange;

      if (p1EloAfter > maxEloEver) {
        maxEloEver = p1EloAfter;
        const player = players.find(p => p.id === match.player1Id);
        if (player) {
          highestRankingEver = { player, elo: p1EloAfter };
        }
      }
      if (p2EloAfter > maxEloEver) {
        maxEloEver = p2EloAfter;
        const player = players.find(p => p.id === match.player2Id);
        if (player) {
          highestRankingEver = { player, elo: p2EloAfter };
        }
      }
    });

    // Find biggest rivalry (ranked matches only)
    const rivalries: Record<string, number> = {};
    rankedMatchesList.forEach((match) => {
      const key = [match.player1Name, match.player2Name].sort().join(" vs ");
      rivalries[key] = (rivalries[key] || 0) + 1;
    });

    let biggestRivalry: { player1: string; player2: string; matches: number } | null = null;
    let maxMatches = 0;
    Object.entries(rivalries).forEach(([key, count]) => {
      if (count > maxMatches) {
        maxMatches = count;
        const [p1, p2] = key.split(" vs ");
        biggestRivalry = { player1: p1, player2: p2, matches: count };
      }
    });

    // Find who plays practice matches most
    const practicePlayerCount: Record<string, number> = {};
    practiceMatchesList.forEach((match) => {
      practicePlayerCount[match.player1Name] = (practicePlayerCount[match.player1Name] || 0) + 1;
      practicePlayerCount[match.player2Name] = (practicePlayerCount[match.player2Name] || 0) + 1;
    });

    let practiceMostPlayed: { name: string; count: number } | null = null;
    let maxPractice = 0;
    Object.entries(practicePlayerCount).forEach(([name, count]) => {
      if (count > maxPractice) {
        maxPractice = count;
        practiceMostPlayed = { name, count };
      }
    });

    return {
      totalMatches,
      rankedMatches,
      practiceMatches,
      totalLegs,
      rankedLegs,
      practiceLegs,
      total180s,
      totalHaminas,
      mostWins: sortedByWins[0]?.wins > 0 ? sortedByWins[0] : null,
      highest180s: sortedBy180s[0]?.oneEighties > 0 ? sortedBy180s[0] : null,
      highestHaminas: sortedByHaminas[0]?.haminas > 0 ? sortedByHaminas[0] : null,
      highestRankingEver,
      biggestRivalry: maxMatches > 1 ? biggestRivalry : null,
      practiceMostPlayed: maxPractice > 0 ? practiceMostPlayed : null,
    };
  }, [players, matches]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

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
        <h1 className="flex-1 text-center text-white font-bold text-xl">Stats v2</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 space-y-4">
        {/* Overall Stats */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Total Matches" value={stats.totalMatches} />
          <StatCard label="Total Legs" value={stats.totalLegs} />
          <StatCard label="180s" value={stats.total180s} />
          <StatCard label="Haminas (26)" value={stats.totalHaminas} />
        </div>

        {/* Ranked vs Practice breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#2a2a2a] rounded-xl p-4">
            <p className="text-[#4ade80] text-sm font-medium">Ranked</p>
            <p className="text-white text-xl font-bold">{stats.rankedMatches} matches</p>
            <p className="text-slate-500 text-xs">{stats.rankedLegs} legs played</p>
          </div>
          <div className="bg-[#2a2a2a] rounded-xl p-4">
            <p className="text-[#f5a623] text-sm font-medium">Practice</p>
            <p className="text-white text-xl font-bold">{stats.practiceMatches} matches</p>
            <p className="text-slate-500 text-xs">{stats.practiceLegs} legs played</p>
          </div>
        </div>

        {/* Leaders */}
        <div className="space-y-3">
          <h2 className="text-white font-semibold">Leaders</h2>

          {stats.highestRankingEver && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">All-time Highest Ranking</p>
                <p className="text-white font-semibold">{stats.highestRankingEver.player.name}</p>
              </div>
              <span className="text-[#4ade80] text-2xl font-bold">{stats.highestRankingEver.elo.toFixed(0)}</span>
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

          {stats.highestHaminas && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Most Haminas (26)</p>
                <p className="text-white font-semibold">{stats.highestHaminas.name}</p>
              </div>
              <span className="text-red-400 text-2xl font-bold">{stats.highestHaminas.haminas}</span>
            </div>
          )}

          {stats.biggestRivalry && (
            <div className="bg-[#2a2a2a] rounded-xl p-4">
              <p className="text-slate-400 text-sm mb-1">Biggest Rivalry</p>
              <p className="text-white font-semibold">
                {stats.biggestRivalry.player1} vs {stats.biggestRivalry.player2}
              </p>
              <p className="text-slate-500 text-sm">{stats.biggestRivalry.matches} ranked matches</p>
            </div>
          )}

          {stats.practiceMostPlayed && (
            <div className="bg-[#2a2a2a] rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-[#f5a623] text-sm">Practice Champion</p>
                <p className="text-white font-semibold">{stats.practiceMostPlayed.name}</p>
              </div>
              <span className="text-white text-xl font-bold">{stats.practiceMostPlayed.count} games</span>
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
      </div>
    </div>
  );
}
