"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useData } from "@/context/DataContext";
import { formatFinnishDateTime, calculateMatchDuration, formatDuration, type MatchResult } from "@/lib/supabase-data";
import { useState, useMemo } from "react";

type ViewTab = "stats" | "visits" | "h2h";

// Get player's recent form (last 5 matches, excluding current match)
function getRecentForm(matches: MatchResult[], playerId: string, excludeMatchId: string): boolean[] {
  const playerMatches = matches
    .filter((m) => m.id !== excludeMatchId && (m.player1Id === playerId || m.player2Id === playerId))
    .slice(0, 5);

  return playerMatches.map((m) => m.winnerId === playerId);
}

// Get H2H matches between two players (excluding current match)
function getH2HMatches(matches: MatchResult[], player1Id: string, player2Id: string, excludeMatchId: string): MatchResult[] {
  return matches.filter(
    (m) =>
      m.id !== excludeMatchId &&
      ((m.player1Id === player1Id && m.player2Id === player2Id) ||
        (m.player1Id === player2Id && m.player2Id === player1Id))
  );
}

// Stat comparison bar component
function StatBar({
  label,
  value1,
  value2,
  format = "number",
}: {
  label: string;
  value1: number;
  value2: number;
  format?: "number" | "decimal";
}) {
  const total = value1 + value2;
  const percent1 = total > 0 ? (value1 / total) * 100 : 50;
  const percent2 = total > 0 ? (value2 / total) * 100 : 50;

  const formatValue = (v: number) => {
    if (format === "decimal") return v.toFixed(2);
    return v.toString();
  };

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-white font-semibold">{formatValue(value1)}</span>
        <span className="text-slate-400 text-sm">{label}</span>
        <span className="text-white font-semibold">{formatValue(value2)}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-[#333]">
        <div
          className="bg-[#e85d3b] transition-all"
          style={{ width: `${percent1}%` }}
        />
        <div
          className="bg-[#f5a623] transition-all"
          style={{ width: `${percent2}%` }}
        />
      </div>
    </div>
  );
}

export default function MatchDetail() {
  const params = useParams();
  const router = useRouter();
  const { matches, players, deleteMatchAndRevertStats, loading } = useData();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewTab>("stats");

  const matchId = params.id as string;
  const match = matches.find((m) => m.id === matchId);

  // Get player data for profile pictures
  const player1 = match ? players.find((p) => p.id === match.player1Id) : null;
  const player2 = match ? players.find((p) => p.id === match.player2Id) : null;

  // Form indicators (last 5 matches before this one)
  const player1Form = useMemo(() => {
    if (!match) return [];
    return getRecentForm(matches, match.player1Id, match.id);
  }, [matches, match]);

  const player2Form = useMemo(() => {
    if (!match) return [];
    return getRecentForm(matches, match.player2Id, match.id);
  }, [matches, match]);

  // H2H data
  const h2hMatches = useMemo(() => {
    if (!match) return [];
    return getH2HMatches(matches, match.player1Id, match.player2Id, match.id);
  }, [matches, match]);

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
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4">
        <p className="text-white text-xl mb-4">Match not found</p>
        <Link href="/matches" className="text-[#4ade80]">
          Back to matches
        </Link>
      </div>
    );
  }

  const handleDelete = async () => {
    setDeleting(true);
    const success = await deleteMatchAndRevertStats(match.id);
    if (success) {
      router.push("/matches");
    } else {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Use startedAt if available, otherwise fall back to playedAt
  const timestamp = match.startedAt || match.playedAt;
  const formattedDate = formatFinnishDateTime(timestamp, { showRelative: false, showTime: false, showYear: true });
  const formattedTime = formatFinnishDateTime(timestamp, { showRelative: false, showTime: true }).split(' ').pop() || '';

  // Calculate duration if we have both start and end times
  const durationMinutes = calculateMatchDuration(match.startedAt, match.playedAt);
  const formattedDuration = formatDuration(durationMinutes);

  const player1Won = match.winnerId === match.player1Id;

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-2">Delete Match?</h3>
            <p className="text-slate-400 mb-4">
              This will permanently delete this match
              {match.isRanked && " and revert all ELO changes"}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="py-4 px-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-slate-400 p-2">
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
        </button>
        <div className="text-center">
          <p className="text-slate-400 text-sm">
            {formattedDate} {formattedTime}
            {formattedDuration && ` • ${formattedDuration}`}
          </p>
        </div>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-slate-400 hover:text-red-500 p-2"
        >
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Score Header */}
      <div className="px-4">
        <div className="bg-[#2a2a2a] rounded-2xl p-4">
          <div className="flex items-center">
            {/* Player 1 */}
            <Link href={`/players/${match.player1Id}`} className="text-center group w-20 flex-shrink-0">
              <div
                className={`w-16 h-16 mx-auto rounded-lg overflow-hidden flex items-center justify-center text-2xl font-bold mb-2 group-hover:ring-2 group-hover:ring-[#4ade80] transition-all ${
                  !player1?.profilePictureUrl ? (player1Won ? "bg-[#e85d3b]" : "bg-[#444]") : ""
                }`}
              >
                {player1?.profilePictureUrl ? (
                  <Image
                    src={player1.profilePictureUrl}
                    alt={match.player1Name}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  match.player1Name.charAt(0)
                )}
              </div>
              <p
                className={`font-semibold group-hover:text-[#4ade80] transition-colors ${
                  player1Won ? "text-white" : "text-slate-400"
                }`}
              >
                {match.player1Name}
              </p>
              <p className="text-slate-500 text-xs">
                {match.player1EloStart.toFixed(2)} ELO
              </p>
              {match.isRanked && (
                <p
                  className={`text-xs ${
                    match.player1EloChange >= 0
                      ? "text-[#4ade80]"
                      : "text-red-400"
                  }`}
                >
                  {match.player1EloChange >= 0 ? "+" : ""}
                  {match.player1EloChange.toFixed(2)}
                </p>
              )}
              {/* Form indicator */}
              <div className="flex gap-1 mt-1 justify-center">
                {player1Form.length > 0 ? (
                  player1Form.map((won, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${won ? "bg-[#4ade80]" : "bg-red-500"}`}
                    />
                  ))
                ) : (
                  <span className="text-slate-600 text-xs">-</span>
                )}
              </div>
            </Link>

            {/* Score */}
            <div className="flex-1 text-center px-2">
              <p className="text-5xl font-bold text-white whitespace-nowrap">
                {match.player1Legs} - {match.player2Legs}
              </p>
              <p className="text-slate-500 text-sm mt-1">
                {match.isRanked ? "Ranked" : "Practice"} • {match.gameMode}
                {match.tournamentId && <span className="text-purple-400"> • Tournament</span>}
              </p>
            </div>

            {/* Player 2 */}
            <Link href={`/players/${match.player2Id}`} className="text-center group w-20 flex-shrink-0">
              <div
                className={`w-16 h-16 mx-auto rounded-lg overflow-hidden flex items-center justify-center text-2xl font-bold mb-2 group-hover:ring-2 group-hover:ring-[#4ade80] transition-all ${
                  !player2?.profilePictureUrl ? (!player1Won ? "bg-[#f5a623]" : "bg-[#444]") : ""
                }`}
              >
                {player2?.profilePictureUrl ? (
                  <Image
                    src={player2.profilePictureUrl}
                    alt={match.player2Name}
                    width={64}
                    height={64}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  match.player2Name.charAt(0)
                )}
              </div>
              <p
                className={`font-semibold group-hover:text-[#4ade80] transition-colors ${
                  !player1Won ? "text-white" : "text-slate-400"
                }`}
              >
                {match.player2Name}
              </p>
              <p className="text-slate-500 text-xs">
                {match.player2EloStart.toFixed(2)} ELO
              </p>
              {match.isRanked && (
                <p
                  className={`text-xs ${
                    match.player2EloChange >= 0
                      ? "text-[#4ade80]"
                      : "text-red-400"
                  }`}
                >
                  {match.player2EloChange >= 0 ? "+" : ""}
                  {match.player2EloChange.toFixed(2)}
                </p>
              )}
              {/* Form indicator */}
              <div className="flex gap-1 mt-1 justify-center">
                {player2Form.length > 0 ? (
                  player2Form.map((won, i) => (
                    <div
                      key={i}
                      className={`w-2 h-2 rounded-full ${won ? "bg-[#4ade80]" : "bg-red-500"}`}
                    />
                  ))
                ) : (
                  <span className="text-slate-600 text-xs">-</span>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-1.5">
        <div className="grid grid-cols-3 gap-2 bg-[#2a2a2a] rounded-xl p-1">
          <button
            onClick={() => setActiveTab("stats")}
            className={`py-2 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === "stats"
                ? "bg-[#4ade80] text-black"
                : "text-white hover:bg-[#333]"
            }`}
          >
            Stats
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

      {/* Tab Content */}
      {activeTab === "stats" && (
        <>
          {/* Statistics */}
          <div className="px-4 pb-6">
            {match.gameMode === "cricket" ? (
          // Cricket-specific stats
          <div className="bg-[#2a2a2a] rounded-2xl p-4">
            <StatBar
              label="Points"
              value1={match.player1Avg}
              value2={match.player2Avg}
            />
            {/* Multi-player scores for cricket */}
            {match.playerCount > 2 && match.allPlayerNames && (
              <div className="mt-4 pt-4 border-t border-[#333]">
                <p className="text-slate-400 text-sm mb-3">All Players</p>
                <div className="space-y-2">
                  {match.allPlayerNames.split(',').map((entry, i) => {
                    const [name, points] = entry.split(':');
                    const isWinner = name === match.winnerName;
                    return (
                      <div key={i} className="flex justify-between items-center">
                        <span className={`${isWinner ? "text-white font-semibold" : "text-slate-400"}`}>
                          {name}
                          {isWinner && <span className="text-[#4ade80] text-xs ml-2">WIN</span>}
                        </span>
                        <span className={`font-semibold ${isWinner ? "text-[#4ade80]" : "text-slate-400"}`}>
                          {points} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          // 301/501 stats
          <div className="bg-[#2a2a2a] rounded-2xl p-4">
            <StatBar
              label="Average"
              value1={match.player1Avg}
              value2={match.player2Avg}
              format="decimal"
            />

            {/* First 9 Average - only show if data exists */}
            {(match.player1First9Avg || match.player2First9Avg) && (
              <StatBar
                label="First 9 Avg"
                value1={match.player1First9Avg || 0}
                value2={match.player2First9Avg || 0}
                format="decimal"
              />
            )}

            <StatBar
              label="100+"
              value1={match.player1HundredPlus || 0}
              value2={match.player2HundredPlus || 0}
            />

            <StatBar
              label="80+"
              value1={match.player1EightyPlus || 0}
              value2={match.player2EightyPlus || 0}
            />

            <StatBar
              label="60+"
              value1={match.player1SixtyPlus || 0}
              value2={match.player2SixtyPlus || 0}
            />

            {/* Doubles % - custom display since we need percentages */}
            {((match.player1DoubleAttempts && match.player1DoubleAttempts > 0) ||
              (match.player2DoubleAttempts && match.player2DoubleAttempts > 0)) && (
              <div className="mb-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-white font-semibold w-12">
                    {match.player1DoubleAttempts && match.player1DoubleAttempts > 0
                      ? `${Math.round((match.player1DoubleHits || 0) / match.player1DoubleAttempts * 100)}%`
                      : '-'}
                  </span>
                  <span className="text-slate-400 text-sm flex-1 text-center">Doubles</span>
                  <span className="text-white font-semibold w-12 text-right">
                    {match.player2DoubleAttempts && match.player2DoubleAttempts > 0
                      ? `${Math.round((match.player2DoubleHits || 0) / match.player2DoubleAttempts * 100)}%`
                      : '-'}
                  </span>
                </div>
                <div className="flex h-2 rounded-full overflow-hidden bg-[#333]">
                  <div
                    className="bg-[#e85d3b] transition-all"
                    style={{
                      width: `${(() => {
                        const p1Pct = match.player1DoubleAttempts && match.player1DoubleAttempts > 0
                          ? (match.player1DoubleHits || 0) / match.player1DoubleAttempts : 0;
                        const p2Pct = match.player2DoubleAttempts && match.player2DoubleAttempts > 0
                          ? (match.player2DoubleHits || 0) / match.player2DoubleAttempts : 0;
                        const total = p1Pct + p2Pct;
                        return total > 0 ? (p1Pct / total * 100) : 50;
                      })()}%`
                    }}
                  />
                  <div
                    className="bg-[#f5a623] transition-all"
                    style={{
                      width: `${(() => {
                        const p1Pct = match.player1DoubleAttempts && match.player1DoubleAttempts > 0
                          ? (match.player1DoubleHits || 0) / match.player1DoubleAttempts : 0;
                        const p2Pct = match.player2DoubleAttempts && match.player2DoubleAttempts > 0
                          ? (match.player2DoubleHits || 0) / match.player2DoubleAttempts : 0;
                        const total = p1Pct + p2Pct;
                        return total > 0 ? (p2Pct / total * 100) : 50;
                      })()}%`
                    }}
                  />
                </div>
              </div>
            )}

            {(match.player1Darts || match.player2Darts) && (
              <StatBar
                label="Darts"
                value1={match.player1Darts || 0}
                value2={match.player2Darts || 0}
              />
            )}

            <StatBar
              label="Highest Checkout"
              value1={match.player1HighestCheckout}
              value2={match.player2HighestCheckout}
            />

            <StatBar
              label="Legs Won"
              value1={match.player1Legs}
              value2={match.player2Legs}
            />
          </div>
        )}
      </div>

      {/* Match Info */}
      <div className="px-4 pb-6">
        <h2 className="text-white font-semibold mb-4">Match Info</h2>
        <div className="bg-[#2a2a2a] rounded-2xl p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-400">Game Mode</span>
            <span className="text-white">{match.gameMode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Best to</span>
            <span className="text-white">{match.legsToWin} legs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Type</span>
            <span className={match.isRanked ? "text-[#4ade80]" : "text-[#f5a623]"}>
              {match.isRanked ? "Ranked" : "Practice"}
            </span>
          </div>
          {match.tournamentId && (
            <div className="flex justify-between">
              <span className="text-slate-400">Tournament</span>
              <Link href={`/play/tournament/${match.tournamentId}`} className="text-purple-400 hover:text-purple-300">
                View Tournament
              </Link>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-400">Winner</span>
            <span className="text-white font-semibold">{match.winnerName}</span>
          </div>
        </div>
      </div>
        </>
      )}

      {/* Visits Tab */}
      {activeTab === "visits" && (
        <div className="px-4 pb-6">
          <div className="bg-[#2a2a2a] rounded-2xl p-8 text-center">
            <div className="text-4xl mb-4">🎯</div>
            <p className="text-slate-400 mb-2">Visit data not available</p>
            <p className="text-slate-500 text-sm">
              Throw-by-throw history is only available for live matches.
            </p>
          </div>
        </div>
      )}

      {/* H2H Tab */}
      {activeTab === "h2h" && (
        <div className="px-4 pb-6">
          {h2hMatches.length === 0 ? (
            <div className="bg-[#2a2a2a] rounded-2xl p-4">
              <p className="text-slate-500 text-center">No previous matches between these players</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* H2H Record */}
              <div className="bg-[#2a2a2a] rounded-2xl p-4">
                <div className="flex items-center justify-center gap-6">
                  <div className="text-center">
                    <div className={`text-3xl font-black ${h2hRecord.p1Wins > h2hRecord.p2Wins ? "text-[#4ade80]" : "text-white"}`}>
                      {h2hRecord.p1Wins}
                    </div>
                    <div className="text-slate-500 text-xs">{match.player1Name}</div>
                  </div>
                  <div className="text-slate-600 text-xl">-</div>
                  <div className="text-center">
                    <div className={`text-3xl font-black ${h2hRecord.p2Wins > h2hRecord.p1Wins ? "text-[#4ade80]" : "text-white"}`}>
                      {h2hRecord.p2Wins}
                    </div>
                    <div className="text-slate-500 text-xs">{match.player2Name}</div>
                  </div>
                </div>
              </div>

              {/* Previous Matches */}
              <div className="space-y-2">
                {h2hMatches.slice(0, 10).map((h2hMatch) => {
                  const isP1First = h2hMatch.player1Id === match.player1Id;
                  const p1Legs = isP1First ? h2hMatch.player1Legs : h2hMatch.player2Legs;
                  const p2Legs = isP1First ? h2hMatch.player2Legs : h2hMatch.player1Legs;
                  const p1Won = h2hMatch.winnerId === match.player1Id;
                  const date = new Date(h2hMatch.playedAt);

                  return (
                    <Link
                      key={h2hMatch.id}
                      href={`/matches/${h2hMatch.id}`}
                      className="block bg-[#2a2a2a] hover:bg-[#333] rounded-xl p-3 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-1 h-8 rounded-full ${p1Won ? "bg-[#e85d3b]" : "bg-[#f5a623]"}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`font-semibold ${p1Won ? "text-white" : "text-slate-400"}`}>
                                {match.player1Name}
                              </span>
                              <span className="text-white font-bold">{p1Legs} - {p2Legs}</span>
                              <span className={`font-semibold ${!p1Won ? "text-white" : "text-slate-400"}`}>
                                {match.player2Name}
                              </span>
                            </div>
                            <div className="text-slate-500 text-xs">
                              {h2hMatch.gameMode} • {h2hMatch.isRanked ? "Ranked" : "Practice"}
                            </div>
                          </div>
                        </div>
                        <div className="text-slate-500 text-xs">
                          {date.toLocaleDateString("fi-FI")}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
