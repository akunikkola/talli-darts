"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { subscribeToLiveMatch } from "@/lib/live-match-data";
import type { LiveMatchState, LegData } from "@/types/live-match";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getCheckoutSuggestion } from "@/lib/darts";

type ViewTab = "live" | "throws";

export default function SpectatePage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;

  const [match, setMatch] = useState<LiveMatchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchEnded, setMatchEnded] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("live");

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

  // Get last throws from history
  const currentLeg = match.throwHistory.legs[match.throwHistory.legs.length - 1];
  const p1Throws = currentLeg?.throws.filter(t => t.thrower === 0) || [];
  const p2Throws = currentLeg?.throws.filter(t => t.thrower === 1) || [];
  const p1LastScore = p1Throws.length > 0 ? p1Throws[p1Throws.length - 1].score : null;
  const p2LastScore = p2Throws.length > 0 ? p2Throws[p2Throws.length - 1].score : null;

  // Get checkout suggestions
  const p1Checkout = match.player1Remaining <= 170 ? getCheckoutSuggestion(match.player1Remaining, 3) : null;
  const p2Checkout = match.player2Remaining <= 170 ? getCheckoutSuggestion(match.player2Remaining, 3) : null;

  // Calculate darts thrown (visits * 3)
  const p1DartsThrown = p1Throws.length * 3;
  const p2DartsThrown = p2Throws.length * 3;

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

      {/* Player Header with Score */}
      <div className="px-4 py-4 bg-[#2a2a2a]">
        <div className="flex items-center justify-between">
          {/* Player 1 */}
          <div className="flex items-center gap-3">
            <PlayerAvatar name={match.player1Name} profilePictureUrl={null} size="lg" />
            <div>
              <div className={`font-bold text-lg ${isPlayer1Turn ? "text-white" : "text-slate-400"}`}>
                {match.player1Name}
              </div>
              <div className="text-slate-500 text-sm">
                AVG: {match.player1Avg.toFixed(1)}
              </div>
            </div>
          </div>

          {/* Score */}
          <div className="text-center">
            <div className="text-5xl font-black tracking-tight">
              <span className={match.player1Legs > match.player2Legs ? "text-[#4ade80]" : "text-white"}>
                {match.player1Legs}
              </span>
              <span className="text-slate-600 mx-3">-</span>
              <span className={match.player2Legs > match.player1Legs ? "text-[#4ade80]" : "text-white"}>
                {match.player2Legs}
              </span>
            </div>
            <div className={`text-xs font-semibold mt-1 ${match.isRanked ? "text-[#4ade80]" : "text-[#f5a623]"}`}>
              {match.isRanked ? "Ranked" : "Practice"}
            </div>
          </div>

          {/* Player 2 */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`font-bold text-lg ${!isPlayer1Turn ? "text-white" : "text-slate-400"}`}>
                {match.player2Name}
              </div>
              <div className="text-slate-500 text-sm">
                AVG: {match.player2Avg.toFixed(1)}
              </div>
            </div>
            <PlayerAvatar name={match.player2Name} profilePictureUrl={null} size="lg" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[#222]">
        <button
          onClick={() => setActiveTab("live")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === "live"
              ? "text-[#4ade80] border-b-2 border-[#4ade80]"
              : "text-slate-500 hover:text-white"
          }`}
        >
          LIVE
        </button>
        <button
          onClick={() => setActiveTab("throws")}
          className={`flex-1 py-3 text-sm font-bold transition-colors ${
            activeTab === "throws"
              ? "text-[#4ade80] border-b-2 border-[#4ade80]"
              : "text-slate-500 hover:text-white"
          }`}
        >
          THROW BY THROW
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "live" ? (
          /* Live Scoreboard View */
          <div className="space-y-4">
            {/* Leg indicator */}
            <div className="text-center">
              <span className="text-slate-500 text-sm font-medium">Leg {match.currentLeg}</span>
            </div>

            {/* Main Score Cards */}
            <div className="grid grid-cols-2 gap-3">
              {/* Player 1 Card */}
              <div className={`bg-[#2a2a2a] rounded-2xl p-4 ${isPlayer1Turn ? "ring-2 ring-[#4ade80]" : ""}`}>
                {isPlayer1Turn && (
                  <div className="text-[#4ade80] text-xs font-bold text-center mb-2">THROWING</div>
                )}
                <div className={`text-6xl font-black text-center mb-3 ${isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
                  {match.player1Remaining}
                </div>

                {/* Checkout suggestion */}
                {p1Checkout && (
                  <div className="text-center mb-3">
                    <span className="text-[#f5a623] text-sm font-medium">{p1Checkout}</span>
                  </div>
                )}

                {/* Last score */}
                {p1LastScore !== null && (
                  <div className="text-center mb-3">
                    <span className="text-slate-500 text-xs">Last</span>
                    <div className={`text-2xl font-bold ${p1LastScore >= 100 ? "text-[#4ade80]" : "text-white"}`}>
                      {p1LastScore}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#1a1a1a] rounded-xl py-2">
                    <div className="text-slate-500 text-xs">180s</div>
                    <div className="text-white font-bold">{match.player1OneEighties}</div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl py-2">
                    <div className="text-slate-500 text-xs">Darts</div>
                    <div className="text-white font-bold">{p1DartsThrown}</div>
                  </div>
                </div>
              </div>

              {/* Player 2 Card */}
              <div className={`bg-[#2a2a2a] rounded-2xl p-4 ${!isPlayer1Turn ? "ring-2 ring-[#4ade80]" : ""}`}>
                {!isPlayer1Turn && (
                  <div className="text-[#4ade80] text-xs font-bold text-center mb-2">THROWING</div>
                )}
                <div className={`text-6xl font-black text-center mb-3 ${!isPlayer1Turn ? "text-[#4ade80]" : "text-white"}`}>
                  {match.player2Remaining}
                </div>

                {/* Checkout suggestion */}
                {p2Checkout && (
                  <div className="text-center mb-3">
                    <span className="text-[#f5a623] text-sm font-medium">{p2Checkout}</span>
                  </div>
                )}

                {/* Last score */}
                {p2LastScore !== null && (
                  <div className="text-center mb-3">
                    <span className="text-slate-500 text-xs">Last</span>
                    <div className={`text-2xl font-bold ${p2LastScore >= 100 ? "text-[#4ade80]" : "text-white"}`}>
                      {p2LastScore}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-[#1a1a1a] rounded-xl py-2">
                    <div className="text-slate-500 text-xs">180s</div>
                    <div className="text-white font-bold">{match.player2OneEighties}</div>
                  </div>
                  <div className="bg-[#1a1a1a] rounded-xl py-2">
                    <div className="text-slate-500 text-xs">Darts</div>
                    <div className="text-white font-bold">{p2DartsThrown}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Match Stats Summary */}
            <div className="bg-[#2a2a2a] rounded-2xl p-4">
              <h3 className="text-white font-bold text-sm mb-3">Match Stats</h3>
              <div className="space-y-2">
                <StatRow
                  label="Average"
                  p1Value={match.player1Avg.toFixed(1)}
                  p2Value={match.player2Avg.toFixed(1)}
                  highlight={match.player1Avg > match.player2Avg ? "p1" : match.player2Avg > match.player1Avg ? "p2" : null}
                />
                <StatRow
                  label="180s"
                  p1Value={match.player1OneEighties.toString()}
                  p2Value={match.player2OneEighties.toString()}
                  highlight={match.player1OneEighties > match.player2OneEighties ? "p1" : match.player2OneEighties > match.player1OneEighties ? "p2" : null}
                />
                <StatRow
                  label="Legs Won"
                  p1Value={match.player1Legs.toString()}
                  p2Value={match.player2Legs.toString()}
                  highlight={match.player1Legs > match.player2Legs ? "p1" : match.player2Legs > match.player1Legs ? "p2" : null}
                />
              </div>
            </div>
          </div>
        ) : (
          /* Throw by Throw View */
          <div>
            {match.throwHistory.legs.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No throws yet</p>
            ) : (
              <div className="space-y-4">
                {match.throwHistory.legs.map((leg, legIndex) => (
                  <LegSection
                    key={leg.legNumber}
                    leg={leg}
                    player1Name={match.player1Name}
                    player2Name={match.player2Name}
                    player1Legs={match.player1Legs}
                    player2Legs={match.player2Legs}
                    isCurrentLeg={legIndex === match.throwHistory.legs.length - 1 && leg.winnerId === null}
                    startingScore={match.gameMode === "501" ? 501 : 301}
                    legIndex={legIndex}
                    totalLegs={match.throwHistory.legs.length}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 text-center border-t border-[#333]">
        <p className="text-slate-600 text-xs">Spectating live match</p>
      </div>
    </div>
  );
}

// Stat row component
function StatRow({
  label,
  p1Value,
  p2Value,
  highlight
}: {
  label: string;
  p1Value: string;
  p2Value: string;
  highlight: "p1" | "p2" | null;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className={`font-bold ${highlight === "p1" ? "text-[#4ade80]" : "text-white"}`}>
        {p1Value}
      </span>
      <span className="text-slate-500">{label}</span>
      <span className={`font-bold ${highlight === "p2" ? "text-[#4ade80]" : "text-white"}`}>
        {p2Value}
      </span>
    </div>
  );
}

// Component for rendering a single leg's throws
function LegSection({
  leg,
  player1Name,
  player2Name,
  player1Legs,
  player2Legs,
  isCurrentLeg,
  startingScore,
  legIndex,
  totalLegs,
}: {
  leg: LegData;
  player1Name: string;
  player2Name: string;
  player1Legs: number;
  player2Legs: number;
  isCurrentLeg: boolean;
  startingScore: number;
  legIndex: number;
  totalLegs: number;
}) {
  // Calculate legs score at start of this leg
  const p1LegsAtStart = legIndex;
  const p2LegsAtStart = legIndex;

  // Actually calculate based on who won previous legs
  let p1Count = 0;
  let p2Count = 0;
  // This would need the full history, for now show current - assuming order

  const getScoreBadge = (score: number): "180" | "140+" | "100+" | null => {
    if (score === 180) return "180";
    if (score >= 140) return "140+";
    if (score >= 100) return "100+";
    return null;
  };

  return (
    <div className="bg-[#2a2a2a] rounded-2xl p-4">
      {/* Leg Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {leg.starterId === 0 && (
            <span className="text-[#4ade80] text-xs">●</span>
          )}
          <span className="text-slate-400 text-sm font-medium">Leg {leg.legNumber}</span>
          {leg.starterId === 1 && (
            <span className="text-[#4ade80] text-xs">●</span>
          )}
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

      {/* Throws */}
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
                <span className={isP1Throw ? "text-[#4ade80] font-bold" : "text-slate-400"}>
                  {throwEntry.p1Rem}
                </span>
                <span className="text-slate-600">:</span>
                <span className={!isP1Throw ? "text-[#4ade80] font-bold" : "text-slate-400"}>
                  {throwEntry.p2Rem}
                </span>
                {badge && (
                  <span className={`ml-1 px-1.5 py-0.5 text-xs font-bold rounded ${
                    badge === "180"
                      ? "bg-[#4ade80] text-black"
                      : badge === "140+"
                        ? "bg-[#f5a623] text-black"
                        : "bg-[#333] text-white"
                  }`}>
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
