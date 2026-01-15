"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useData } from "@/context/DataContext";
import type { Player } from "@/lib/supabase-data";

export default function Players() {
  const router = useRouter();
  const { players, loading, addPlayer, deletePlayer } = useData();
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [showConfirmDelete, setShowConfirmDelete] = useState<Player | null>(null);

  const talliPlayers = players.filter(p => p.group === "talli").sort((a, b) => b.elo - a.elo);
  const visitorPlayers = players.filter(p => p.group === "visitor").sort((a, b) => b.elo - a.elo);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    await addPlayer(newPlayerName.trim(), "visitor");
    setNewPlayerName("");
    setShowAddPlayer(false);
  };

  const handleDeletePlayer = async (player: Player) => {
    await deletePlayer(player.id);
    setShowConfirmDelete(null);
  };

  const PlayerCard = ({ player, canDelete }: { player: Player; canDelete: boolean }) => (
    <div className="flex items-center px-4 py-3 border-b border-[#333] last:border-b-0">
      <button
        onClick={() => router.push(`/players/${player.id}`)}
        className="flex-1 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{player.name}</span>
        </div>
        <div className="flex gap-3 text-xs text-slate-500">
          <span>{player.wins}W - {player.losses}L</span>
          <span>301: {player.elo301.toFixed(2)}</span>
          <span>501: {player.elo501.toFixed(2)}</span>
        </div>
      </button>
      <button
        onClick={() => router.push(`/players/${player.id}`)}
        className="text-slate-400 hover:text-white p-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      </button>
      {canDelete && (
        <button
          onClick={() => setShowConfirmDelete(player)}
          className="text-red-400 hover:text-red-300 p-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
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
        <h1 className="flex-1 text-center text-white font-bold text-xl">Players</h1>
        <div className="w-10" />
      </div>

      <div className="px-4 space-y-6">
        {/* Talli Darts Players */}
        <div>
          <h2 className="text-white font-semibold mb-3">Talli Darts</h2>
          <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
            {talliPlayers.map((player) => (
              <PlayerCard key={player.id} player={player} canDelete={false} />
            ))}
          </div>
        </div>

        {/* Visitor Players */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Visitors</h2>
            <button
              onClick={() => setShowAddPlayer(true)}
              className="text-[#4ade80] text-sm font-medium"
            >
              + Add Player
            </button>
          </div>
          <div className="bg-[#2a2a2a] rounded-xl overflow-hidden">
            {visitorPlayers.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No visitors yet</p>
            ) : (
              visitorPlayers.map((player) => (
                <PlayerCard key={player.id} player={player} canDelete={true} />
              ))
            )}
          </div>
        </div>

      </div>

      {/* Add Player Modal */}
      {showAddPlayer && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-4">Add Visitor</h3>
            <input
              type="text"
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              placeholder="Enter name"
              autoFocus
              className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80] mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowAddPlayer(false);
                  setNewPlayerName("");
                }}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPlayer}
                disabled={!newPlayerName.trim()}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-[#333] text-black disabled:text-slate-500 rounded-xl font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm">
            <h3 className="text-white font-bold text-xl mb-2">Delete Player</h3>
            <p className="text-slate-400 mb-6">
              Are you sure you want to delete {showConfirmDelete.name}? This will remove all their stats.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirmDelete(null)}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeletePlayer(showConfirmDelete)}
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
