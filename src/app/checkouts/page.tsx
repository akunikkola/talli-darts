"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useData } from "@/context/DataContext";

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

  // All checkouts sorted by score (highest first)
  const allCheckouts = useMemo(() => {
    return matches
      .filter(m => m.highestCheckout > 0)
      .sort((a, b) => b.highestCheckout - a.highestCheckout);
  }, [matches]);

  // This week's checkouts
  const weeklyCheckouts = useMemo(() => {
    return allCheckouts.filter(m => new Date(m.playedAt) >= weekStart);
  }, [allCheckouts, weekStart]);

  // All-time checkouts (excluding this week)
  const allTimeCheckouts = useMemo(() => {
    return allCheckouts.filter(m => new Date(m.playedAt) < weekStart);
  }, [allCheckouts, weekStart]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fi-FI", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
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
              weeklyCheckouts.map((match, index) => (
                <div
                  key={match.id}
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
                    <span className="text-white font-medium">{match.winnerName}</span>
                    <span className="text-slate-500 text-xs block">
                      vs {match.player1Name === match.winnerName ? match.player2Name : match.player1Name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[#4ade80] font-bold text-xl">{match.highestCheckout}</span>
                    <span className="text-slate-500 text-xs block">{formatDate(match.playedAt)}</span>
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
              allTimeCheckouts.map((match, index) => (
                <div
                  key={match.id}
                  className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0"
                >
                  <span className="w-8 text-center font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="flex-1 ml-3">
                    <span className="text-white font-medium">{match.winnerName}</span>
                    <span className="text-slate-500 text-xs block">
                      vs {match.player1Name === match.winnerName ? match.player2Name : match.player1Name}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-bold text-xl">{match.highestCheckout}</span>
                    <span className="text-slate-500 text-xs block">{formatDate(match.playedAt)}</span>
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
