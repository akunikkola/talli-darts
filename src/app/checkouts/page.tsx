"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/context/DataContext";
import { formatFinnishDateTime, getFinnishWeekday } from "@/lib/supabase-data";

interface CheckoutEntry {
  playerName: string;
  checkout: number;
  playedAt: string;
  matchId: string;
  opponent: string;
}

// Get the start of the current week (Monday 00:00) in Finnish time
const getWeekStart = () => {
  const now = new Date();
  const finnishTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
  const day = finnishTime.getDay();
  const daysFromMonday = day === 0 ? 6 : day - 1;
  finnishTime.setDate(finnishTime.getDate() - daysFromMonday);
  finnishTime.setHours(0, 0, 0, 0);
  return finnishTime;
};

export default function CheckoutsPage() {
  const { matches, loading } = useData();

  const weekStart = useMemo(() => getWeekStart(), []);

  // Extract all checkout entries from matches (both players' checkouts)
  const allCheckouts = useMemo(() => {
    const entries: CheckoutEntry[] = [];

    matches.forEach(m => {
      // Add player 1's checkout if > 0
      if (m.player1HighestCheckout > 0) {
        entries.push({
          playerName: m.player1Name,
          checkout: m.player1HighestCheckout,
          playedAt: m.playedAt,
          matchId: m.id + '-p1',
          opponent: m.player2Name,
        });
      }
      // Add player 2's checkout if > 0
      if (m.player2HighestCheckout > 0) {
        entries.push({
          playerName: m.player2Name,
          checkout: m.player2HighestCheckout,
          playedAt: m.playedAt,
          matchId: m.id + '-p2',
          opponent: m.player1Name,
        });
      }
      // Fallback to old highestCheckout field for backwards compatibility
      if (m.player1HighestCheckout === 0 && m.player2HighestCheckout === 0 && m.highestCheckout > 0) {
        entries.push({
          playerName: m.winnerName,
          checkout: m.highestCheckout,
          playedAt: m.playedAt,
          matchId: m.id,
          opponent: m.player1Name === m.winnerName ? m.player2Name : m.player1Name,
        });
      }
    });

    return entries.sort((a, b) => b.checkout - a.checkout);
  }, [matches]);

  // This week's checkouts
  const weeklyCheckouts = useMemo(() => {
    return allCheckouts.filter(entry => new Date(entry.playedAt) >= weekStart);
  }, [allCheckouts, weekStart]);

  // All-time checkouts (excluding this week)
  const allTimeCheckouts = useMemo(() => {
    return allCheckouts.filter(entry => new Date(entry.playedAt) < weekStart);
  }, [allCheckouts, weekStart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const weekday = getFinnishWeekday(dateString);
    const date = formatFinnishDateTime(dateString, { showRelative: false, showTime: false });
    return `${weekday} ${date}`;
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">Checkouts</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 pb-4">
        {/* This Week */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">This Week</h2>
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
                    className={`w-8 text-center font-bold ${
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
                    <span className="text-white font-medium">{entry.playerName}</span>
                    <span className="text-slate-500 text-xs block">
                      vs {entry.opponent}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#4ade80] font-bold text-xl">{entry.checkout}</span>
                    <span className="text-slate-500 text-xs block">{formatDate(entry.playedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* All-Time */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">All-Time History</h2>
          <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
            {allTimeCheckouts.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No previous checkouts</p>
            ) : (
              allTimeCheckouts.map((entry, index) => (
                <div
                  key={entry.matchId}
                  className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0"
                >
                  <span className="w-8 text-center font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="flex-1 ml-3">
                    <span className="text-white font-medium">{entry.playerName}</span>
                    <span className="text-slate-500 text-xs block">
                      vs {entry.opponent}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold text-xl">{entry.checkout}</span>
                    <span className="text-slate-500 text-xs block">{formatDate(entry.playedAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
