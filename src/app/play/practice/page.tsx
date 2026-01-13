"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import type { Player } from "@/lib/supabase-data";

export default function PracticeSetup() {
  const router = useRouter();
  const { players, loading, addPlayer } = useData();
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [gameMode, setGameMode] = useState<"301" | "501" | "cricket">("501");
  const [legsToWin, setLegsToWin] = useState(3);
  const [customLegs, setCustomLegs] = useState("");
  const [starterIndex, setStarterIndex] = useState(0);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  const allPlayers = [...players].sort((a, b) => a.name.localeCompare(b.name));
  const talliPlayers = allPlayers.filter(p => p.group === "talli");
  const visitorPlayers = allPlayers.filter(p => p.group === "visitor");

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const canStart = selectedPlayers.length >= 2 && legsToWin > 0;

  const startGame = () => {
    if (!canStart) return;

    // Reorder players so starter is first
    const reorderedPlayers = [
      selectedPlayers[starterIndex],
      ...selectedPlayers.filter((_, i) => i !== starterIndex),
    ];

    const playerIds = reorderedPlayers.map(p => p.id).join(",");

    const params = new URLSearchParams({
      players: playerIds,
      mode: gameMode,
      legs: legsToWin.toString(),
      ranked: "false",
    });

    if (gameMode === "cricket") {
      router.push(`/play/cricket?${params.toString()}`);
    } else {
      router.push(`/play/game?${params.toString()}`);
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    await addPlayer(newPlayerName.trim(), "visitor");
    setNewPlayerName("");
    setShowAddPlayer(false);
  };

  const togglePlayer = (player: Player) => {
    const index = selectedPlayers.findIndex(p => p.id === player.id);
    if (index !== -1) {
      // Remove player
      const newSelected = selectedPlayers.filter(p => p.id !== player.id);
      setSelectedPlayers(newSelected);
      // Adjust starter index if needed
      if (starterIndex >= newSelected.length) {
        setStarterIndex(Math.max(0, newSelected.length - 1));
      }
    } else if (selectedPlayers.length < 6) {
      // Add player
      setSelectedPlayers([...selectedPlayers, player]);
    }
  };

  const getPlayerColor = (index: number) => {
    const colors = [
      "bg-[#e85d3b]", // Red-orange
      "bg-[#f5a623]", // Orange
      "bg-[#4ade80]", // Green
      "bg-[#3b82f6]", // Blue
      "bg-[#a855f7]", // Purple
      "bg-[#ec4899]", // Pink
    ];
    return colors[index % colors.length];
  };

  const handleLegsChange = (value: string) => {
    setCustomLegs(value);
    const num = parseInt(value);
    if (!isNaN(num) && num > 0 && num <= 99) {
      setLegsToWin(num);
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">Practice Match</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Selected Players */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-white font-semibold">Selected Players ({selectedPlayers.length}/6)</h2>
            {selectedPlayers.length >= 2 && (
              <span className="text-slate-400 text-xs">Tap to set starter</span>
            )}
          </div>
          {selectedPlayers.length === 0 ? (
            <div className="bg-[#2a2a2a] border-2 border-dashed border-[#444] rounded-xl p-4 text-center">
              <p className="text-slate-500">Select 2-6 players below</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedPlayers.map((player, index) => (
                <button
                  key={player.id}
                  onClick={() => setStarterIndex(index)}
                  className={`px-4 py-2 rounded-xl text-white font-medium ${getPlayerColor(index)} ${
                    starterIndex === index ? "ring-2 ring-white" : ""
                  }`}
                >
                  {player.name}
                  {starterIndex === index && " ▶"}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Player Selection */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">Talli Darts</h2>
          <div className="grid grid-cols-4 gap-2">
            {talliPlayers.map((player) => {
              const selectedIndex = selectedPlayers.findIndex(p => p.id === player.id);
              const isSelected = selectedIndex !== -1;
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player)}
                  disabled={!isSelected && selectedPlayers.length >= 6}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors truncate ${
                    isSelected
                      ? `${getPlayerColor(selectedIndex)} text-white`
                      : "bg-[#2a2a2a] text-white hover:bg-[#333] disabled:opacity-50"
                  }`}
                >
                  {player.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Visitors</h2>
            <button onClick={() => setShowAddPlayer(true)} className="text-[#4ade80] text-sm">
              + Add
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visitorPlayers.map((player) => {
              const selectedIndex = selectedPlayers.findIndex(p => p.id === player.id);
              const isSelected = selectedIndex !== -1;
              return (
                <button
                  key={player.id}
                  onClick={() => togglePlayer(player)}
                  disabled={!isSelected && selectedPlayers.length >= 6}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors truncate ${
                    isSelected
                      ? `${getPlayerColor(selectedIndex)} text-white`
                      : "bg-[#2a2a2a] text-white hover:bg-[#333] disabled:opacity-50"
                  }`}
                >
                  {player.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Game Mode */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">Game Mode</h2>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => setGameMode("301")}
              className={`py-4 rounded-xl text-lg font-semibold transition-colors ${
                gameMode === "301" ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
              }`}
            >
              301
            </button>
            <button
              onClick={() => setGameMode("501")}
              className={`py-4 rounded-xl text-lg font-semibold transition-colors ${
                gameMode === "501" ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
              }`}
            >
              501
            </button>
            <button
              onClick={() => setGameMode("cricket")}
              className={`py-4 rounded-xl text-lg font-semibold transition-colors ${
                gameMode === "cricket" ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
              }`}
            >
              Cricket
            </button>
          </div>
        </div>

        {/* Best to (Legs) - only for non-cricket */}
        {gameMode !== "cricket" && (
          <div className="mb-6">
            <h2 className="text-white font-semibold mb-3">Best to</h2>
            <div className="flex gap-2 mb-3">
              {[1, 2, 3, 5, 7].map((legs) => (
                <button
                  key={legs}
                  onClick={() => {
                    setLegsToWin(legs);
                    setCustomLegs("");
                  }}
                  className={`flex-1 py-3 rounded-xl text-lg font-semibold transition-colors ${
                    legsToWin === legs && !customLegs ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
                  }`}
                >
                  {legs}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm">Or custom:</span>
              <input
                type="number"
                min="1"
                max="99"
                value={customLegs}
                onChange={(e) => handleLegsChange(e.target.value)}
                placeholder="Legs"
                className="flex-1 px-4 py-2 bg-[#2a2a2a] rounded-xl text-white text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
              />
            </div>
          </div>
        )}

        {gameMode === "cricket" && (
          <div className="mb-6 bg-[#2a2a2a] rounded-xl p-4">
            <p className="text-slate-400 text-sm">
              Cricket: Close numbers 15-20 and Bull by hitting them 3 times.
              Once closed, you can score points on them until opponent closes.
              Highest points when all numbers closed wins!
            </p>
          </div>
        )}
      </div>

      {/* Start Button */}
      <div className="p-4">
        <button
          onClick={startGame}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl text-xl font-semibold transition-colors ${
            canStart ? "bg-[#f5a623] hover:bg-[#d98f1e] text-black" : "bg-[#333] text-slate-500 cursor-not-allowed"
          }`}
        >
          Start Practice Match
        </button>
        <p className="text-slate-500 text-xs text-center mt-2">
          Practice matches don&apos;t affect ELO rankings
        </p>
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
                onClick={() => { setShowAddPlayer(false); setNewPlayerName(""); }}
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
    </div>
  );
}
