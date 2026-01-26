"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { subscribeToLiveMatch } from "@/lib/live-match-data";
import { fetchPlayer, fetchMatches } from "@/lib/supabase-data";
import type { LiveMatchState, LegData, ThrowHistory } from "@/types/live-match";
import type { Player, MatchResult } from "@/lib/supabase-data";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getCheckoutSuggestion } from "@/lib/darts";

type ViewTab = "live" | "visits" | "h2h";

// Calculate stats from throw history
function calculateMatchStats(throwHistory: ThrowHistory, startingScore: number) {
  const stats = {
    player1: {
      totalScore: 0,
      visits: 0,
      darts: 0,
      sixtyPlus: 0,
      eightyPlus: 0,
      hundredPlus: 0,
      oneEighties: 0,
      highestCheckout: 0,
      first9Total: 0,
      first9Visits: 0,
      doubleAttempts: 0,
      doubleHits: 0,
    },
    player2: {
      totalScore: 0,
      visits: 0,
      darts: 0,
      sixtyPlus: 0,
      eightyPlus: 0,
      hundredPlus: 0,
      oneEighties: 0,
      highestCheckout: 0,
      first9Total: 0,
      first9Visits: 0,
      doubleAttempts: 0,
      doubleHits: 0,
    },
  };

  throwHistory.legs.forEach((leg) => {
    let p1VisitsInLeg = 0;
    let p2VisitsInLeg = 0;
    let prevP1Rem = startingScore;
    let prevP2Rem = startingScore;

    leg.throws.forEach((t, idx) => {
      const playerStats = t.thrower === 0 ? stats.player1 : stats.player2;
      const score = t.score;

      playerStats.totalScore += score;
      playerStats.visits += 1;
      playerStats.darts += 3;

      if (score >= 60) playerStats.sixtyPlus += 1;
      if (score >= 80) playerStats.eightyPlus += 1;
      if (score >= 100) playerStats.hundredPlus += 1;
      if (score === 180) playerStats.oneEighties += 1;

      // Track first 9 (first 3 visits per player per leg)
      if (t.thrower === 0) {
        if (p1VisitsInLeg < 3) {
          playerStats.first9Total += score;
          playerStats.first9Visits += 1;
        }
        p1VisitsInLeg += 1;

        // Track double attempts: any visit where remaining was ≤170 (possible checkout)
        if (prevP1Rem <= 170) {
          playerStats.doubleAttempts += 1;
        }

        // Check for checkout (remaining went to 0)
        if (t.p1Rem === 0 && prevP1Rem > 0) {
          const checkoutScore = prevP1Rem;
          if (checkoutScore > playerStats.highestCheckout) {
            playerStats.highestCheckout = checkoutScore;
          }
          playerStats.doubleHits += 1;
        }
        prevP1Rem = t.p1Rem;
      } else {
        if (p2VisitsInLeg < 3) {
          playerStats.first9Total += score;
          playerStats.first9Visits += 1;
        }
        p2VisitsInLeg += 1;

        // Track double attempts: any visit where remaining was ≤170 (possible checkout)
        if (prevP2Rem <= 170) {
          playerStats.doubleAttempts += 1;
        }

        if (t.p2Rem === 0 && prevP2Rem > 0) {
          const checkoutScore = prevP2Rem;
          if (checkoutScore > playerStats.highestCheckout) {
            playerStats.highestCheckout = checkoutScore;
          }
          playerStats.doubleHits += 1;
        }
        prevP2Rem = t.p2Rem;
      }
    });
  });

  return stats;
}

// Get current leg stats
function getCurrentLegStats(throwHistory: ThrowHistory) {
  const currentLeg = throwHistory.legs[throwHistory.legs.length - 1];
  if (!currentLeg) return { player1: { avg: 0, last: null, darts: 0 }, player2: { avg: 0, last: null, darts: 0 } };

  const p1Throws = currentLeg.throws.filter((t) => t.thrower === 0);
  const p2Throws = currentLeg.throws.filter((t) => t.thrower === 1);

  const p1Total = p1Throws.reduce((sum, t) => sum + t.score, 0);
  const p2Total = p2Throws.reduce((sum, t) => sum + t.score, 0);

  return {
    player1: {
      avg: p1Throws.length > 0 ? p1Total / p1Throws.length : 0,
      last: p1Throws.length > 0 ? p1Throws[p1Throws.length - 1].score : null,
      darts: p1Throws.length * 3,
    },
    player2: {
      avg: p2Throws.length > 0 ? p2Total / p2Throws.length : 0,
      last: p2Throws.length > 0 ? p2Throws[p2Throws.length - 1].score : null,
      darts: p2Throws.length * 3,
    },
  };
}

// Get player's recent form (last 5 matches)
function getRecentForm(matches: MatchResult[], playerId: string): boolean[] {
  const playerMatches = matches
    .filter((m) => m.player1Id === playerId || m.player2Id === playerId)
    .slice(0, 5);

  return playerMatches.map((m) => m.winnerId === playerId);
}

// Get H2H matches between two players
function getH2HMatches(matches: MatchResult[], player1Id: string, player2Id: string): MatchResult[] {
  return matches.filter(
    (m) =>
      (m.player1Id === player1Id && m.player2Id === player2Id) ||
      (m.player1Id === player2Id && m.player2Id === player1Id)
  );
}

export default function SpectatePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<LiveMatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchEnded, setMatchEnded] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("live");

  // Player data fetched separately
  const [player1Data, setPlayer1Data] = useState<Player | null>(null);
  const [player2Data, setPlayer2Data] = useState<Player | null>(null);
  const [allMatches, setAllMatches] = useState<MatchResult[]>([]);

  // Subscribe to live match
  useEffect(() => {
    const unsubscribe = subscribeToLiveMatch(matchId, (m) => {
      if (m === null && !loading) {
        setMatchEnded(true);
        setTimeout(() => router.push("/"), 3000);
      } else {
        setMatch(m);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [matchId, router, loading]);

  // Fetch player data and match history
  useEffect(() => {
    if (!match) return;

    const loadData = async () => {
      const [p1, p2, matches] = await Promise.all([
        fetchPlayer(match.player1Id),
        fetchPlayer(match.player2Id),
        fetchMatches(),
      ]);
      setPlayer1Data(p1);
      setPlayer2Data(p2);
      setAllMatches(matches);
    };

    loadData();
  }, [match?.player1Id, match?.player2Id]);

  // Compute stats
  const matchStats = useMemo(() => {
    if (!match) return null;
    const startingScore = match.gameMode === "501" ? 501 : 301;
    return calculateMatchStats(match.throwHistory, startingScore);
  }, [match]);

  const currentLegStats = useMemo(() => {
    if (!match) return null;
    return getCurrentLegStats(match.throwHistory);
  }, [match]);

  const player1Form = useMemo(() => {
    if (!match) return [];
    return getRecentForm(allMatches, match.player1Id);
  }, [allMatches, match?.player1Id]);

  const player2Form = useMemo(() => {
    if (!match) return [];
    return getRecentForm(allMatches, match.player2Id);
  }, [allMatches, match?.player2Id]);

  const h2hMatches = useMemo(() => {
    if (!match) return [];
    return getH2HMatches(allMatches, match.player1Id, match.player2Id);
  }, [allMatches, match?.player1Id, match?.player2Id]);

  const h2hRecord = useMemo(() => {
    let p1Wins = 0;
    let p2Wins = 0;
    h2hMatches.forEach((m) => {
      if (m.winnerId === match?.player1Id) p1Wins++;
      else if (m.winnerId === match?.player2Id) p2Wins++;
    });
    return { p1Wins, p2Wins };
  }, [h2hMatches, match?.player1Id, match?.player2Id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <div className="text-white text-lg">Loading match...</div>
      </div>
    );
  }

  if (matchEnded || !match) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center gap-4 p-4">
        <div className="text-5xl mb-4">🎯</div>
        <div className="text-white text-2xl font-bold">Match Ended</div>
        <p className="text-slate-400">Redirecting to home...</p>
        <Link
          href="/"
          className="mt-4 px-6 py-3 bg-[#4ade80] hover:bg-[#22c55e] rounded-xl font-semibold text-black transition-colors"
        >
          Go Home
        </Link>
      </div>
    );
  }

  const isPlayer1Turn = match.currentPlayerIndex === 0;
  const p1Elo = player1Data?.elo ?? 1000;
  const p2Elo = player2Data?.elo ?? 1000;
  const startingScore = match.gameMode === "501" ? 501 : 301;

  // Compute averages
  const p1Avg = matchStats && matchStats.player1.visits > 0
    ? matchStats.player1.totalScore / matchStats.player1.visits
    : 0;
  const p2Avg = matchStats && matchStats.player2.visits > 0
    ? matchStats.player2.totalScore / matchStats.player2.visits
    : 0;

  const p1First9Avg = matchStats && matchStats.player1.first9Visits > 0
    ? matchStats.player1.first9Total / matchStats.player1.first9Visits
    : 0;
  const p2First9Avg = matchStats && matchStats.player2.first9Visits > 0
    ? matchStats.player2.first9Total / matchStats.player2.first9Visits
    : 0;

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Link href="/" className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-400 text-sm font-bold uppercase tracking-wide">Live</span>
        </div>
        <div className="text-slate-400 text-sm font-medium">
          {match.gameMode} • Bo{match.legsToWin * 2 - 1}
        </div>
      </div>

      {/* Player Header Section - Fixed across tabs */}
      <div className="px-4 pt-4">
        <div className="flex items-start justify-between">
          {/* Player 1 */}
          <div className="flex flex-col items-center w-24">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#2a2a2a]">
              {player1Data?.profilePictureUrl ? (
                <Image
                  src={player1Data.profilePictureUrl}
                  alt={match.player1Name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-black bg-[#4ade80]">
                  {match.player1Name.charAt(0)}
                </div>
              )}
            </div>
            <div className={`text-sm font-bold mt-2 ${isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
              {match.player1Name}
            </div>
            <div className="text-slate-500 text-xs">{p1Elo.toFixed(2)} ELO</div>
            {/* Form indicator */}
            <div className="flex gap-1 mt-1">
              {player1Form.map((won, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${won ? "bg-[#4ade80]" : "bg-red-500"}`}
                />
              ))}
              {player1Form.length === 0 && <div className="text-slate-600 text-xs">No history</div>}
            </div>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center">
            <div className="text-5xl font-black tracking-tight">
              <span className={match.player1Legs > match.player2Legs ? "text-[#4ade80]" : "text-white"}>
                {match.player1Legs}
              </span>
              <span className="text-slate-600 mx-3">-</span>
              <span className={match.player2Legs > match.player1Legs ? "text-[#4ade80]" : "text-white"}>
                {match.player2Legs}
              </span>
            </div>
            <div className="text-slate-400 text-xs mt-1">
              {match.isRanked ? "Ranked" : "Practice"} • Bo{match.legsToWin * 2 - 1} • {match.gameMode}
            </div>
            <div className="text-slate-500 text-sm mt-1 font-medium">LEG {match.currentLeg}</div>
          </div>

          {/* Player 2 */}
          <div className="flex flex-col items-center w-24">
            <div className="w-16 h-16 rounded-xl overflow-hidden bg-[#2a2a2a]">
              {player2Data?.profilePictureUrl ? (
                <Image
                  src={player2Data.profilePictureUrl}
                  alt={match.player2Name}
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-black bg-[#4ade80]">
                  {match.player2Name.charAt(0)}
                </div>
              )}
            </div>
            <div className={`text-sm font-bold mt-2 ${!isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
              {match.player2Name}
            </div>
            <div className="text-slate-500 text-xs">{p2Elo.toFixed(2)} ELO</div>
            {/* Form indicator */}
            <div className="flex gap-1 mt-1">
              {player2Form.map((won, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${won ? "bg-[#4ade80]" : "bg-red-500"}`}
                />
              ))}
              {player2Form.length === 0 && <div className="text-slate-600 text-xs">No history</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-1.5">
        <div className="grid grid-cols-3 gap-2 bg-[#2a2a2a] rounded-xl p-1">
          <button
            onClick={() => setActiveTab("live")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "live"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Live
          </button>
          <button
            onClick={() => setActiveTab("visits")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "visits"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Visits
          </button>
          <button
            onClick={() => setActiveTab("h2h")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "h2h"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            H2H
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "live" && (
          <LiveTab
            match={match}
            matchStats={matchStats}
            currentLegStats={currentLegStats}
            p1Avg={p1Avg}
            p2Avg={p2Avg}
            p1First9Avg={p1First9Avg}
            p2First9Avg={p2First9Avg}
            startingScore={startingScore}
          />
        )}
        {activeTab === "visits" && (
          <VisitsTab match={match} />
        )}
        {activeTab === "h2h" && (
          <H2HTab
            h2hMatches={h2hMatches}
            h2hRecord={h2hRecord}
            player1Id={match.player1Id}
            player2Id={match.player2Id}
            player1Name={match.player1Name}
            player2Name={match.player2Name}
          />
        )}
      </div>
    </div>
  );
}

// Live Tab Component
function LiveTab({
  match,
  matchStats,
  currentLegStats,
  p1Avg,
  p2Avg,
  p1First9Avg,
  p2First9Avg,
  startingScore,
}: {
  match: LiveMatchState;
  matchStats: ReturnType<typeof calculateMatchStats> | null;
  currentLegStats: ReturnType<typeof getCurrentLegStats> | null;
  p1Avg: number;
  p2Avg: number;
  p1First9Avg: number;
  p2First9Avg: number;
  startingScore: number;
}) {
  const isPlayer1Turn = match.currentPlayerIndex === 0;
  const p1Checkout = match.player1Remaining <= 170 ? getCheckoutSuggestion(match.player1Remaining, 3) : null;
  const p2Checkout = match.player2Remaining <= 170 ? getCheckoutSuggestion(match.player2Remaining, 3) : null;

  return (
    <div className="space-y-4">
      {/* Score Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Player 1 Card */}
        <div className={`rounded-2xl p-4 ${isPlayer1Turn ? "bg-[#2d3a2d] ring-2 ring-[#4ade80]" : "bg-[#2a2a2a]"}`}>
          <div className="flex items-start justify-between mb-2">
            <div className={`text-5xl font-black ${isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
              {match.player1Remaining}
            </div>
            {isPlayer1Turn && (
              <Image src="/darts-icon.svg" alt="Throwing" width={24} height={24} className="opacity-60" />
            )}
          </div>
          {p1Checkout && (
            <div className="text-[#f5a623] text-sm font-medium mb-2">{p1Checkout}</div>
          )}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Avg</span>
              <span className="text-white">{currentLegStats?.player1.avg.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last</span>
              <span className="text-white">{currentLegStats?.player1.last ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Darts</span>
              <span className="text-white">{currentLegStats?.player1.darts ?? 0}</span>
            </div>
          </div>
        </div>

        {/* Player 2 Card */}
        <div className={`rounded-2xl p-4 ${!isPlayer1Turn ? "bg-[#2d3a2d] ring-2 ring-[#4ade80]" : "bg-[#2a2a2a]"}`}>
          <div className="flex items-start justify-between mb-2">
            <div className={`text-5xl font-black ${!isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
              {match.player2Remaining}
            </div>
            {!isPlayer1Turn && (
              <Image src="/darts-icon.svg" alt="Throwing" width={24} height={24} className="opacity-60" />
            )}
          </div>
          {p2Checkout && (
            <div className="text-[#f5a623] text-sm font-medium mb-2">{p2Checkout}</div>
          )}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Avg</span>
              <span className="text-white">{currentLegStats?.player2.avg.toFixed(2) ?? "0.00"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last</span>
              <span className="text-white">{currentLegStats?.player2.last ?? "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Darts</span>
              <span className="text-white">{currentLegStats?.player2.darts ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Match Stats with Comparison Bars */}
      <div className="space-y-3">
        <StatComparisonRow label="Average" p1Value={p1Avg} p2Value={p2Avg} format="decimal" />
        <StatComparisonRow label="First 9 Avg" p1Value={p1First9Avg} p2Value={p2First9Avg} format="decimal" />
        <StatComparisonRow label="100+" p1Value={matchStats?.player1.hundredPlus ?? 0} p2Value={matchStats?.player2.hundredPlus ?? 0} />
        <StatComparisonRow label="80+" p1Value={matchStats?.player1.eightyPlus ?? 0} p2Value={matchStats?.player2.eightyPlus ?? 0} />
        <StatComparisonRow label="60+" p1Value={matchStats?.player1.sixtyPlus ?? 0} p2Value={matchStats?.player2.sixtyPlus ?? 0} />
        <StatComparisonRow
          label="Doubles"
          p1Value={match.player1DoubleAttempts > 0 ? (match.player1DoubleHits / match.player1DoubleAttempts * 100) : 0}
          p2Value={match.player2DoubleAttempts > 0 ? (match.player2DoubleHits / match.player2DoubleAttempts * 100) : 0}
          format="percent"
        />
        <StatComparisonRow label="Darts" p1Value={matchStats?.player1.darts ?? 0} p2Value={matchStats?.player2.darts ?? 0} />
        <StatComparisonRow label="Highest Checkout" p1Value={matchStats?.player1.highestCheckout ?? 0} p2Value={matchStats?.player2.highestCheckout ?? 0} />
      </div>
    </div>
  );
}

// Stat Comparison Row with progress bars
function StatComparisonRow({
  label,
  p1Value,
  p2Value,
  format = "integer",
}: {
  label: string;
  p1Value: number;
  p2Value: number;
  format?: "integer" | "decimal" | "percent";
}) {
  const maxValue = Math.max(p1Value, p2Value, 1);
  const p1Width = (p1Value / maxValue) * 100;
  const p2Width = (p2Value / maxValue) * 100;

  const formatValue = (v: number) => {
    if (format === "decimal") return v.toFixed(2);
    if (format === "percent") return `${Math.round(v)}%`;
    return Math.round(v).toString();
  };

  const p1Better = p1Value > p2Value;
  const p2Better = p2Value > p1Value;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className={`font-bold ${p1Better ? "text-white" : "text-slate-400"}`}>{formatValue(p1Value)}</span>
        <span className="text-slate-500">{label}</span>
        <span className={`font-bold ${p2Better ? "text-white" : "text-slate-400"}`}>{formatValue(p2Value)}</span>
      </div>
      <div className="flex gap-1 h-1.5">
        <div className="flex-1 flex justify-end">
          <div
            className={`h-full rounded-full ${p1Better ? "bg-[#f5a623]" : "bg-[#f5a623]/50"}`}
            style={{ width: `${p1Width}%` }}
          />
        </div>
        <div className="flex-1">
          <div
            className={`h-full rounded-full ${p2Better ? "bg-[#4ade80]" : "bg-[#4ade80]/50"}`}
            style={{ width: `${p2Width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Visits Tab Component (throw by throw)
function VisitsTab({ match }: { match: LiveMatchState }) {
  const startingScore = match.gameMode === "501" ? 501 : 301;

  if (match.throwHistory.legs.length === 0) {
    return <p className="text-slate-500 text-center py-8">No throws yet</p>;
  }

  return (
    <div className="space-y-4">
      {match.throwHistory.legs.map((leg, legIndex) => (
        <LegSection
          key={leg.legNumber}
          leg={leg}
          player1Name={match.player1Name}
          player2Name={match.player2Name}
          isCurrentLeg={legIndex === match.throwHistory.legs.length - 1 && leg.winnerId === null}
          startingScore={startingScore}
        />
      ))}
    </div>
  );
}

// Leg Section for Visits tab
function LegSection({
  leg,
  player1Name,
  player2Name,
  isCurrentLeg,
  startingScore,
}: {
  leg: LegData;
  player1Name: string;
  player2Name: string;
  isCurrentLeg: boolean;
  startingScore: number;
}) {
  const getScoreBadge = (score: number): "180" | "140+" | "100+" | null => {
    if (score === 180) return "180";
    if (score >= 140) return "140+";
    if (score >= 100) return "100+";
    return null;
  };

  return (
    <div className="bg-[#2a2a2a] rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {leg.starterId === 0 && <span className="text-[#4ade80] text-xs">●</span>}
          <span className="text-slate-400 text-sm font-medium">Leg {leg.legNumber}</span>
          {leg.starterId === 1 && <span className="text-[#4ade80] text-xs">●</span>}
        </div>

        {!isCurrentLeg && leg.winnerId !== null && (
          <span className="px-2 py-1 bg-[#4ade80]/20 text-[#4ade80] text-xs font-bold rounded-lg">
            {leg.winnerId === 0 ? player1Name : player2Name}
          </span>
        )}

        {isCurrentLeg && (
          <span className="px-2 py-1 bg-[#f5a623]/20 text-[#f5a623] text-xs font-bold rounded-lg">
            In Progress
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {leg.throws.length === 0 ? (
          <span className="text-slate-600 text-sm">Waiting for first throw...</span>
        ) : (
          leg.throws.map((throwEntry, idx) => {
            const badge = getScoreBadge(throwEntry.score);
            const isP1Throw = throwEntry.thrower === 0;

            return (
              <div
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-[#1a1a1a] rounded-lg text-sm"
              >
                <span className={isP1Throw ? "text-[#f5a623] font-bold" : "text-slate-400"}>
                  {throwEntry.p1Rem}
                </span>
                <span className="text-slate-600">:</span>
                <span className={!isP1Throw ? "text-[#4ade80] font-bold" : "text-slate-400"}>
                  {throwEntry.p2Rem}
                </span>
                {badge && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-xs font-bold rounded ${
                      badge === "180"
                        ? "bg-[#4ade80] text-black"
                        : badge === "140+"
                        ? "bg-[#f5a623] text-black"
                        : "bg-[#333] text-white"
                    }`}
                  >
                    {badge}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// H2H Tab Component
function H2HTab({
  h2hMatches,
  h2hRecord,
  player1Id,
  player2Id,
  player1Name,
  player2Name,
}: {
  h2hMatches: MatchResult[];
  h2hRecord: { p1Wins: number; p2Wins: number };
  player1Id: string;
  player2Id: string;
  player1Name: string;
  player2Name: string;
}) {
  if (h2hMatches.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-slate-500">No previous matches between these players</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* H2H Record */}
      <div className="bg-[#2a2a2a] rounded-2xl p-4">
        <h3 className="text-white font-bold text-sm mb-3 text-center">Head to Head Record</h3>
        <div className="flex items-center justify-center gap-4">
          <div className="text-center">
            <div className={`text-3xl font-black ${h2hRecord.p1Wins > h2hRecord.p2Wins ? "text-[#4ade80]" : "text-white"}`}>
              {h2hRecord.p1Wins}
            </div>
            <div className="text-slate-500 text-xs">{player1Name}</div>
          </div>
          <div className="text-slate-600 text-xl">-</div>
          <div className="text-center">
            <div className={`text-3xl font-black ${h2hRecord.p2Wins > h2hRecord.p1Wins ? "text-[#4ade80]" : "text-white"}`}>
              {h2hRecord.p2Wins}
            </div>
            <div className="text-slate-500 text-xs">{player2Name}</div>
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="space-y-2">
        <h3 className="text-slate-400 text-sm font-medium">Previous Matches</h3>
        {h2hMatches.slice(0, 10).map((match) => {
          const isP1First = match.player1Id === player1Id;
          const p1Legs = isP1First ? match.player1Legs : match.player2Legs;
          const p2Legs = isP1First ? match.player2Legs : match.player1Legs;
          const p1Won = match.winnerId === player1Id;
          const date = new Date(match.playedAt);

          return (
            <div key={match.id} className="bg-[#2a2a2a] rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-1 h-8 rounded-full ${p1Won ? "bg-[#f5a623]" : "bg-[#4ade80]"}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${p1Won ? "text-white" : "text-slate-400"}`}>{player1Name}</span>
                    <span className="text-white font-bold">{p1Legs} - {p2Legs}</span>
                    <span className={`font-bold ${!p1Won ? "text-white" : "text-slate-400"}`}>{player2Name}</span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {match.gameMode} • {match.isRanked ? "Ranked" : "Practice"}
                  </div>
                </div>
              </div>
              <div className="text-slate-500 text-xs">
                {date.toLocaleDateString("fi-FI")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
