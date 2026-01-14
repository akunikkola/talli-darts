"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useCallback } from "react";
import { useData } from "@/context/DataContext";
import type { Player } from "@/lib/supabase-data";
import PlayerAvatar from "@/components/PlayerAvatar";

type RankingType = "overall" | "301" | "501";
type MatchFilterType = "all" | "ranked" | "practice";

// Calculate average ELO from 301 and 501 ratings
const getAverageElo = (player: { elo301: number; elo501: number }) => {
  return (player.elo301 + player.elo501) / 2;
};

// Get the start of the current week (Monday 00:00) in Finnish time
const getWeekStart = () => {
  const now = new Date();
  // Convert to Finnish time (Europe/Helsinki)
  const finnishTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
  const day = finnishTime.getDay();
  // Adjust so Monday = 0, Sunday = 6
  const daysFromMonday = day === 0 ? 6 : day - 1;
  finnishTime.setDate(finnishTime.getDate() - daysFromMonday);
  finnishTime.setHours(0, 0, 0, 0);
  return finnishTime;
};

export default function Home() {
  const { players, matches, loading, refreshData } = useData();
  const [rankingType, setRankingType] = useState<RankingType>("overall");
  const [matchFilter, setMatchFilter] = useState<MatchFilterType>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isPulling = useRef(false);

  const PULL_THRESHOLD = 80;

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [refreshData, isRefreshing]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      const touchY = e.touches[0].clientY;
      const distance = Math.max(0, touchY - touchStartY.current);
      // Apply resistance
      setPullDistance(Math.min(distance * 0.5, PULL_THRESHOLD * 1.5));
    }
  }, [isRefreshing]);

  const handleTouchEnd = useCallback(() => {
    if (pullDistance >= PULL_THRESHOLD) {
      handleRefresh();
    } else {
      setPullDistance(0);
    }
    isPulling.current = false;
  }, [pullDistance, handleRefresh]);

  const getElo = (player: Player) => {
    switch (rankingType) {
      case "301":
        return player.elo301;
      case "501":
        return player.elo501;
      default:
        return getAverageElo(player);
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

  const topPlayers = useMemo(() => {
    const sorted = [...players];
    switch (rankingType) {
      case "301":
        return sorted.sort((a, b) => b.elo301 - a.elo301).slice(0, 5);
      case "501":
        return sorted.sort((a, b) => b.elo501 - a.elo501).slice(0, 5);
      default:
        return sorted.sort((a, b) => getAverageElo(b) - getAverageElo(a)).slice(0, 5);
    }
  }, [players, rankingType]);

  const recentMatches = useMemo(() => {
    let filtered = matches;
    if (matchFilter === "ranked") {
      filtered = matches.filter(m => m.isRanked);
    } else if (matchFilter === "practice") {
      filtered = matches.filter(m => !m.isRanked);
    }
    return filtered.slice(0, 5);
  }, [matches, matchFilter]);

  // Get weekly highest checkouts - now includes both players' checkouts separately
  const weeklyCheckouts = useMemo(() => {
    const weekStart = getWeekStart();
    const checkoutEntries: { playerName: string; checkout: number; playedAt: string; matchId: string }[] = [];

    matches.forEach(m => {
      const matchDate = new Date(m.playedAt);
      if (matchDate >= weekStart) {
        // Add player 1's checkout if > 0
        if (m.player1HighestCheckout > 0) {
          checkoutEntries.push({
            playerName: m.player1Name,
            checkout: m.player1HighestCheckout,
            playedAt: m.playedAt,
            matchId: m.id + '-p1',
          });
        }
        // Add player 2's checkout if > 0
        if (m.player2HighestCheckout > 0) {
          checkoutEntries.push({
            playerName: m.player2Name,
            checkout: m.player2HighestCheckout,
            playedAt: m.playedAt,
            matchId: m.id + '-p2',
          });
        }
        // Fallback to old highestCheckout field for backwards compatibility
        if (m.player1HighestCheckout === 0 && m.player2HighestCheckout === 0 && m.highestCheckout > 0) {
          checkoutEntries.push({
            playerName: m.winnerName,
            checkout: m.highestCheckout,
            playedAt: m.playedAt,
            matchId: m.id,
          });
        }
      }
    });

    return checkoutEntries
      .sort((a, b) => b.checkout - a.checkout)
      .slice(0, 3);
  }, [matches]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-[#1a1a1a] p-4 overflow-auto relative"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull to refresh indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="flex justify-center items-center transition-all duration-200"
          style={{ height: isRefreshing ? 50 : pullDistance }}
        >
          <div className={`${isRefreshing ? 'animate-spin' : ''}`}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-[#4ade80]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              style={{
                transform: isRefreshing ? 'none' : `rotate(${pullDistance * 3}deg)`,
                opacity: Math.min(pullDistance / PULL_THRESHOLD, 1)
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      )}

      {/* Refresh button - top right */}
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="absolute right-4 top-4 p-2 text-slate-400 hover:text-white disabled:opacity-50 transition-colors z-10"
        title="Refresh"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`h-6 w-6 ${isRefreshing ? 'animate-spin' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>

      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-4xl font-bold text-white">Talli Darts</h1>
        <p className="text-slate-400 mt-1">Who do you think you are? I am!</p>
        <p className="text-slate-600 text-xs mt-1">v2.3</p>
      </div>

      {/* Match Type Buttons */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/play/ranking"
          className="py-5 bg-[#4ade80] hover:bg-[#22c55e] text-black text-center rounded-2xl transition-colors"
        >
          <span className="text-lg font-bold block">Official Match</span>
          <span className="text-sm opacity-70">1v1 • For the record</span>
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
        {/* Ranking Type Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-[#2a2a2a] rounded-xl p-1 mb-3">
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
        <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
          {topPlayers.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No players yet</p>
          ) : (
            topPlayers.map((player, index) => (
              <Link
                key={player.id}
                href={`/players/${player.id}`}
                className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0 hover:bg-[#333] transition-colors"
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
                <PlayerAvatar
                  name={player.name}
                  profilePictureUrl={player.profilePictureUrl}
                  size="sm"
                  className="ml-3"
                />
                <div className="flex-1 ml-3 flex items-center gap-2">
                  <span className="text-white">{player.name}</span>
                  {player.club && (
                    <span className="text-xs bg-[#4ade80]/20 text-[#4ade80] px-2 py-0.5 rounded-full">
                      {player.club}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 text-sm mr-4">
                  {getWins(player)}W - {getLosses(player)}L
                </span>
                <span className="text-[#4ade80] font-semibold">{getElo(player).toFixed(2)}</span>
              </Link>
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
        {/* Match Filter Tabs */}
        <div className="grid grid-cols-3 gap-2 bg-[#2a2a2a] rounded-xl p-1 mb-3">
          <button
            onClick={() => setMatchFilter("all")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              matchFilter === "all"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setMatchFilter("ranked")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              matchFilter === "ranked"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Ranked
          </button>
          <button
            onClick={() => setMatchFilter("practice")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              matchFilter === "practice"
                ? "bg-[#f5a623] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Practice
          </button>
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
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="block px-4 py-3 border-b border-[#333] last:border-b-0 hover:bg-[#333] transition-colors"
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
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Weekly Highest Checkouts */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Checkouts This Week</h2>
          <Link href="/checkouts" className="text-[#4ade80] text-sm">
            See all
          </Link>
        </div>
        <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
          {weeklyCheckouts.length === 0 ? (
            <p className="text-slate-500 text-center py-4">No checkouts this week</p>
          ) : (
            weeklyCheckouts.map((entry, index) => (
              <div
                key={entry.matchId}
                className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0"
              >
                <span
                  className={`w-6 text-center font-bold ${
                    index === 0
                      ? "text-yellow-400"
                      : index === 1
                      ? "text-slate-300"
                      : "text-amber-600"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="flex-1 ml-3">
                  <span className="text-white font-medium">{entry.playerName}</span>
                  <span className="text-slate-500 text-xs ml-2">
                    {new Date(entry.playedAt).toLocaleDateString("fi-FI", { weekday: "short" })}
                  </span>
                </div>
                <span className="text-[#4ade80] font-bold text-lg">{entry.checkout}</span>
              </div>
            ))
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
