"use client";

import Link from "next/link";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import type { MatchResult, Player } from "@/lib/supabase-data";

export default function Matches() {
  const { matches, players, loading, updateMatch, deleteMatchAndRevertStats, saveMatch } = useData();
  const [editingMatch, setEditingMatch] = useState<MatchResult | null>(null);
  const [showAddMatch, setShowAddMatch] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState<MatchResult | null>(null);

  // Form state for editing
  const [editPlayer1Legs, setEditPlayer1Legs] = useState(0);
  const [editPlayer2Legs, setEditPlayer2Legs] = useState(0);
  const [editWinnerId, setEditWinnerId] = useState("");

  // Form state for adding new match
  const [newPlayer1Id, setNewPlayer1Id] = useState("");
  const [newPlayer2Id, setNewPlayer2Id] = useState("");
  const [newPlayer1Legs, setNewPlayer1Legs] = useState(0);
  const [newPlayer2Legs, setNewPlayer2Legs] = useState(0);
  const [newGameMode, setNewGameMode] = useState<"301" | "501" | "cricket">("501");
  const [newIsRanked, setNewIsRanked] = useState(false);

  const sortedPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const openEditModal = (match: MatchResult) => {
    setEditingMatch(match);
    setEditPlayer1Legs(match.player1Legs);
    setEditPlayer2Legs(match.player2Legs);
    setEditWinnerId(match.winnerId);
  };

  const handleSaveEdit = async () => {
    if (!editingMatch) return;

    const winner = editWinnerId === editingMatch.player1Id
      ? { id: editingMatch.player1Id, name: editingMatch.player1Name }
      : { id: editingMatch.player2Id, name: editingMatch.player2Name };

    await updateMatch(editingMatch.id, {
      player1Legs: editPlayer1Legs,
      player2Legs: editPlayer2Legs,
      winnerId: winner.id,
      winnerName: winner.name,
    });

    setEditingMatch(null);
  };

  const handleDeleteMatch = async () => {
    if (!showConfirmDelete) return;
    // Delete match and revert all related stats (ELO, wins, losses, legs, 180s)
    await deleteMatchAndRevertStats(showConfirmDelete.id);
    setShowConfirmDelete(null);
    setEditingMatch(null);
  };

  const openAddModal = () => {
    setShowAddMatch(true);
    setNewPlayer1Id("");
    setNewPlayer2Id("");
    setNewPlayer1Legs(0);
    setNewPlayer2Legs(0);
    setNewGameMode("501");
    setNewIsRanked(false);
  };

  const handleAddMatch = async () => {
    if (!newPlayer1Id || !newPlayer2Id || newPlayer1Id === newPlayer2Id) return;

    const player1 = sortedPlayers.find(p => p.id === newPlayer1Id);
    const player2 = sortedPlayers.find(p => p.id === newPlayer2Id);
    if (!player1 || !player2) return;

    // Determine winner based on legs
    const winnerId = newPlayer1Legs > newPlayer2Legs ? player1.id : player2.id;
    const winnerName = newPlayer1Legs > newPlayer2Legs ? player1.name : player2.name;

    await saveMatch({
      player1Id: player1.id,
      player2Id: player2.id,
      player1Name: player1.name,
      player2Name: player2.name,
      winnerId,
      winnerName,
      player1Legs: newPlayer1Legs,
      player2Legs: newPlayer2Legs,
      player1EloChange: 0,
      player2EloChange: 0,
      player1Avg: 0,
      player2Avg: 0,
      player1OneEighties: 0,
      player2OneEighties: 0,
      gameMode: newGameMode,
      legsToWin: Math.max(newPlayer1Legs, newPlayer2Legs),
      isRanked: newIsRanked,
      highestCheckout: 0,
      player1HighestCheckout: 0,
      player2HighestCheckout: 0,
      playerCount: 2,
    });

    setShowAddMatch(false);
  };

  const canAddMatch = newPlayer1Id && newPlayer2Id && newPlayer1Id !== newPlayer2Id && (newPlayer1Legs > 0 || newPlayer2Legs > 0);

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">Match History</h1>
        <button onClick={openAddModal} className="text-[#4ade80] p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <div className="px-4 pb-4">
        {matches.length === 0 ? (
          <div className="bg-[#2a2a2a] rounded-xl p-8 text-center">
            <p className="text-slate-500">No matches played yet</p>
            <button onClick={openAddModal} className="text-[#4ade80] text-sm mt-2">
              Add a match manually
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {matches.map((match) => {
              const isMultiPlayer = match.playerCount > 2;
              const otherPlayersCount = isMultiPlayer ? match.playerCount - 1 : 0;
              // For multi-player: player1 is winner, player2Name contains all other players
              const player2Display = isMultiPlayer
                ? `${match.player2Name.split(', ')[0]}+${otherPlayersCount - 1}`
                : match.player2Name;

              return (
                <div key={match.id} className="bg-[#2a2a2a] rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{match.gameMode}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        match.isRanked ? "bg-[#4ade80]/20 text-[#4ade80]" : "bg-[#f5a623]/20 text-[#f5a623]"
                      }`}>
                        {match.isRanked ? "Ranked" : "Practice"}
                      </span>
                      {isMultiPlayer && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-600/30 text-slate-400">
                          {match.playerCount} players
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 text-sm">{formatDate(match.playedAt)}</span>
                      <button
                        onClick={() => openEditModal(match)}
                        className="text-slate-400 hover:text-white p-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-semibold ${
                            match.winnerId === match.player1Id ? "text-white" : "text-slate-400"
                          }`}
                        >
                          {match.player1Name}
                        </span>
                        {match.winnerId === match.player1Id && (
                          <span className="text-xs text-[#4ade80]">WIN</span>
                        )}
                      </div>
                      {match.isRanked && (
                        <div className="text-xs text-slate-500 mt-1">
                          Avg: {match.player1Avg.toFixed(1)} •{" "}
                          <span className={match.player1EloChange >= 0 ? "text-green-400" : "text-red-400"}>
                            {match.player1EloChange >= 0 ? "+" : ""}{match.player1EloChange}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="px-4">
                      <span className="text-2xl font-bold text-white">
                        {match.player1Legs} - {match.player2Legs}
                      </span>
                    </div>

                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {match.winnerId === match.player2Id && (
                          <span className="text-xs text-[#4ade80]">WIN</span>
                        )}
                        <span
                          className={`font-semibold ${
                            match.winnerId === match.player2Id ? "text-white" : "text-slate-400"
                          }`}
                        >
                          {player2Display}
                        </span>
                      </div>
                      {match.isRanked && (
                        <div className="text-xs text-slate-500 mt-1">
                          <span className={match.player2EloChange >= 0 ? "text-green-400" : "text-red-400"}>
                            {match.player2EloChange >= 0 ? "+" : ""}{match.player2EloChange}
                          </span>{" "}
                          • Avg: {match.player2Avg.toFixed(1)}
                        </div>
                      )}
                      {isMultiPlayer && match.allPlayerNames && (
                        <div className="text-xs text-slate-500 mt-1">
                          All: {match.allPlayerNames}
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Show checkouts if recorded */}
                  {(match.player1HighestCheckout > 0 || match.player2HighestCheckout > 0) && (
                    <div className="mt-2 pt-2 border-t border-[#333] flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">{match.player1Name.split(' ')[0]}:</span>
                        <span className={match.player1HighestCheckout > 0 ? "text-[#4ade80] font-bold" : "text-slate-600"}>
                          {match.player1HighestCheckout > 0 ? match.player1HighestCheckout : "-"}
                        </span>
                      </div>
                      <span className="text-slate-600">Checkouts</span>
                      <div className="flex items-center gap-1">
                        <span className={match.player2HighestCheckout > 0 ? "text-[#4ade80] font-bold" : "text-slate-600"}>
                          {match.player2HighestCheckout > 0 ? match.player2HighestCheckout : "-"}
                        </span>
                        <span className="text-slate-500">:{match.player2Name.split(' ')[0]}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Match Modal */}
      {editingMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-4">Edit Match</h3>

            <div className="space-y-4">
              {/* Score */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Score</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-white text-sm mb-1">{editingMatch.player1Name}</p>
                    <input
                      type="number"
                      min="0"
                      value={editPlayer1Legs}
                      onChange={(e) => setEditPlayer1Legs(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                    />
                  </div>
                  <span className="text-slate-500 text-2xl">-</span>
                  <div className="flex-1 text-center">
                    <p className="text-white text-sm mb-1">{editingMatch.player2Name}</p>
                    <input
                      type="number"
                      min="0"
                      value={editPlayer2Legs}
                      onChange={(e) => setEditPlayer2Legs(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                    />
                  </div>
                </div>
              </div>

              {/* Winner Selection */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Winner</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setEditWinnerId(editingMatch.player1Id)}
                    className={`py-3 rounded-xl font-semibold transition-colors ${
                      editWinnerId === editingMatch.player1Id
                        ? "bg-[#4ade80] text-black"
                        : "bg-[#1a1a1a] text-white"
                    }`}
                  >
                    {editingMatch.player1Name}
                  </button>
                  <button
                    onClick={() => setEditWinnerId(editingMatch.player2Id)}
                    className={`py-3 rounded-xl font-semibold transition-colors ${
                      editWinnerId === editingMatch.player2Id
                        ? "bg-[#4ade80] text-black"
                        : "bg-[#1a1a1a] text-white"
                    }`}
                  >
                    {editingMatch.player2Name}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mt-6">
              <button
                onClick={() => setShowConfirmDelete(editingMatch)}
                className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
              >
                Delete
              </button>
              <button
                onClick={() => setEditingMatch(null)}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Match Modal */}
      {showAddMatch && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-auto">
            <h3 className="text-white font-bold text-xl mb-4">Add Match</h3>

            <div className="space-y-4">
              {/* Player 1 */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Player 1</label>
                <select
                  value={newPlayer1Id}
                  onChange={(e) => setNewPlayer1Id(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                >
                  <option value="">Select player</option>
                  {sortedPlayers.map(p => (
                    <option key={p.id} value={p.id} disabled={p.id === newPlayer2Id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Player 2 */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Player 2</label>
                <select
                  value={newPlayer2Id}
                  onChange={(e) => setNewPlayer2Id(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                >
                  <option value="">Select player</option>
                  {sortedPlayers.map(p => (
                    <option key={p.id} value={p.id} disabled={p.id === newPlayer1Id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Score */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Score (Legs)</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 text-center">
                    <p className="text-white text-sm mb-1">
                      {newPlayer1Id ? sortedPlayers.find(p => p.id === newPlayer1Id)?.name : "P1"}
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={newPlayer1Legs}
                      onChange={(e) => setNewPlayer1Legs(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                    />
                  </div>
                  <span className="text-slate-500 text-2xl">-</span>
                  <div className="flex-1 text-center">
                    <p className="text-white text-sm mb-1">
                      {newPlayer2Id ? sortedPlayers.find(p => p.id === newPlayer2Id)?.name : "P2"}
                    </p>
                    <input
                      type="number"
                      min="0"
                      value={newPlayer2Legs}
                      onChange={(e) => setNewPlayer2Legs(parseInt(e.target.value) || 0)}
                      className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                    />
                  </div>
                </div>
              </div>

              {/* Game Mode */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Game Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["301", "501", "cricket"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setNewGameMode(mode)}
                      className={`py-2 rounded-xl font-semibold transition-colors ${
                        newGameMode === mode
                          ? "bg-[#4ade80] text-black"
                          : "bg-[#1a1a1a] text-white"
                      }`}
                    >
                      {mode === "cricket" ? "Cricket" : mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Match Type */}
              <div>
                <label className="block text-slate-400 text-sm mb-2">Match Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setNewIsRanked(false)}
                    className={`py-2 rounded-xl font-semibold transition-colors ${
                      !newIsRanked
                        ? "bg-[#f5a623] text-black"
                        : "bg-[#1a1a1a] text-white"
                    }`}
                  >
                    Practice
                  </button>
                  <button
                    onClick={() => setNewIsRanked(true)}
                    className={`py-2 rounded-xl font-semibold transition-colors ${
                      newIsRanked
                        ? "bg-[#4ade80] text-black"
                        : "bg-[#1a1a1a] text-white"
                    }`}
                  >
                    Ranked
                  </button>
                </div>
                {newIsRanked && (
                  <p className="text-amber-400 text-xs mt-2">
                    Note: Manual ranked matches don&apos;t affect ELO
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setShowAddMatch(false)}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMatch}
                disabled={!canAddMatch}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-[#333] text-black disabled:text-slate-500 rounded-xl font-semibold"
              >
                Add Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-2">Delete Match?</h3>
            <p className="text-slate-400 mb-2">
              {showConfirmDelete.player1Name} vs {showConfirmDelete.player2Name} ({showConfirmDelete.player1Legs}-{showConfirmDelete.player2Legs})
            </p>
            {showConfirmDelete.isRanked && (
              <p className="text-amber-400 text-sm mb-4">
                This will also revert ELO changes, wins/losses, and all stats from this match.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 mt-4">
              <button
                onClick={() => {
                  setShowConfirmDelete(null);
                  setEditingMatch(null);
                }}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteMatch}
                className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
