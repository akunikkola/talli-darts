"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useData } from "@/context/DataContext";
import { useState } from "react";

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

  const matchId = params.id as string;
  const match = matches.find((m) => m.id === matchId);

  // Get player data for profile pictures
  const player1 = match ? players.find((p) => p.id === match.player1Id) : null;
  const player2 = match ? players.find((p) => p.id === match.player2Id) : null;

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

  const matchDate = new Date(match.playedAt);
  const formattedDate = matchDate.toLocaleDateString("fi-FI", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedTime = matchDate.toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <div className="px-4 pb-6">
        <div className="bg-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center justify-between">
            {/* Player 1 */}
            <Link href={`/players/${match.player1Id}`} className="flex-1 text-center group">
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
                {match.player1EloStart.toFixed(0)} ELO
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
            </Link>

            {/* Score */}
            <div className="px-4">
              <p className="text-5xl font-bold text-white">
                {match.player1Legs} - {match.player2Legs}
              </p>
              <p className="text-center text-slate-500 text-sm mt-1">
                {match.isRanked ? "Ranked" : "Practice"} • {match.gameMode}
              </p>
            </div>

            {/* Player 2 */}
            <Link href={`/players/${match.player2Id}`} className="flex-1 text-center group">
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
                {match.player2EloStart.toFixed(0)} ELO
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
            </Link>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="px-4 pb-6">
        <h2 className="text-white font-semibold mb-4">Match Statistics</h2>
        <div className="bg-[#2a2a2a] rounded-2xl p-4">
          <StatBar
            label="Average"
            value1={match.player1Avg}
            value2={match.player2Avg}
            format="decimal"
          />

          <StatBar
            label="180s"
            value1={match.player1OneEighties}
            value2={match.player2OneEighties}
          />

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
          <div className="flex justify-between">
            <span className="text-slate-400">Winner</span>
            <span className="text-white font-semibold">{match.winnerName}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
