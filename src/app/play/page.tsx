"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPlayers, getTalliPlayers, getVisitorPlayers, addPlayer, type Player } from "@/lib/players";

export default function PlaySetup() {
  const router = useRouter();
  const [talliPlayers, setTalliPlayers] = useState<Player[]>([]);
  const [visitorPlayers, setVisitorPlayers] = useState<Player[]>([]);
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<"301" | "501">("501");
  const [legsToWin, setLegsToWin] = useState(1);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = () => {
    setTalliPlayers(getTalliPlayers());
    setVisitorPlayers(getVisitorPlayers());
  };

  const canStart = player1 && player2 && player1.id !== player2.id;

  const startGame = () => {
    if (!canStart) return;

    const params = new URLSearchParams({
      p1: player1.id,
      p2: player2.id,
      mode: gameMode,
      legs: legsToWin.toString(),
    });

    router.push(`/play/game?${params.toString()}`);
  };

  const handleAddPlayer = () => {
    if (!newPlayerName.trim()) return;

    addPlayer(newPlayerName.trim(), "visitor");
    setNewPlayerName("");
    setShowAddPlayer(false);
    loadPlayers();
  };

  const selectPlayer = (player: Player, slot: 1 | 2) => {
    if (slot === 1) {
      setPlayer1(player);
      // If player2 is the same, clear it
      if (player2?.id === player.id) setPlayer2(null);
    } else {
      setPlayer2(player);
      // If player1 is the same, clear it
      if (player1?.id === player.id) setPlayer1(null);
    }
  };

  const allPlayers = [...talliPlayers, ...visitorPlayers];

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/" className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="flex-1 text-center text-white font-bold text-xl">New Game</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Selected Players */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div
            className={`p-4 rounded-xl text-center ${
              player1 ? "bg-[#e85d3b]" : "bg-[#2a2a2a] border-2 border-dashed border-[#444]"
            }`}
          >
            <p className="text-white/60 text-xs mb-1">Player 1</p>
            <p className="text-white font-bold text-lg">{player1?.name || "Select"}</p>
            {player1 && (
              <p className="text-white/70 text-xs mt-1">ELO: {player1.elo.toFixed(2)}</p>
            )}
          </div>
          <div
            className={`p-4 rounded-xl text-center ${
              player2 ? "bg-[#f5a623]" : "bg-[#2a2a2a] border-2 border-dashed border-[#444]"
            }`}
          >
            <p className="text-white/60 text-xs mb-1">Player 2</p>
            <p className="text-white font-bold text-lg">{player2?.name || "Select"}</p>
            {player2 && (
              <p className="text-white/70 text-xs mt-1">ELO: {player2.elo.toFixed(2)}</p>
            )}
          </div>
        </div>

        {/* Player Selection */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold">Talli Darts</h2>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {talliPlayers.map((player) => {
              const isSelected1 = player1?.id === player.id;
              const isSelected2 = player2?.id === player.id;
              const isSelected = isSelected1 || isSelected2;

              return (
                <button
                  key={player.id}
                  onClick={() => {
                    if (isSelected1) {
                      setPlayer1(null);
                    } else if (isSelected2) {
                      setPlayer2(null);
                    } else if (!player1) {
                      selectPlayer(player, 1);
                    } else if (!player2) {
                      selectPlayer(player, 2);
                    } else {
                      selectPlayer(player, 2);
                    }
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors ${
                    isSelected1
                      ? "bg-[#e85d3b] text-white"
                      : isSelected2
                      ? "bg-[#f5a623] text-white"
                      : "bg-[#2a2a2a] text-white hover:bg-[#333]"
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
            <button
              onClick={() => setShowAddPlayer(true)}
              className="text-[#4ade80] text-sm"
            >
              + Add
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {visitorPlayers.map((player) => {
              const isSelected1 = player1?.id === player.id;
              const isSelected2 = player2?.id === player.id;

              return (
                <button
                  key={player.id}
                  onClick={() => {
                    if (isSelected1) {
                      setPlayer1(null);
                    } else if (isSelected2) {
                      setPlayer2(null);
                    } else if (!player1) {
                      selectPlayer(player, 1);
                    } else if (!player2) {
                      selectPlayer(player, 2);
                    } else {
                      selectPlayer(player, 2);
                    }
                  }}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors ${
                    isSelected1
                      ? "bg-[#e85d3b] text-white"
                      : isSelected2
                      ? "bg-[#f5a623] text-white"
                      : "bg-[#2a2a2a] text-white hover:bg-[#333]"
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
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setGameMode("301")}
              className={`py-4 rounded-xl text-xl font-semibold transition-colors ${
                gameMode === "301"
                  ? "bg-[#4ade80] text-black"
                  : "bg-[#2a2a2a] text-white"
              }`}
            >
              301
            </button>
            <button
              onClick={() => setGameMode("501")}
              className={`py-4 rounded-xl text-xl font-semibold transition-colors ${
                gameMode === "501"
                  ? "bg-[#4ade80] text-black"
                  : "bg-[#2a2a2a] text-white"
              }`}
            >
              501
            </button>
          </div>
        </div>

        {/* Legs to Win */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">First to</h2>
          <div className="grid grid-cols-5 gap-2">
            {[1, 2, 3, 4, 5].map((legs) => (
              <button
                key={legs}
                onClick={() => setLegsToWin(legs)}
                className={`py-3 rounded-xl text-lg font-semibold transition-colors ${
                  legsToWin === legs
                    ? "bg-[#4ade80] text-black"
                    : "bg-[#2a2a2a] text-white"
                }`}
              >
                {legs}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="p-4">
        <button
          onClick={startGame}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl text-xl font-semibold transition-colors ${
            canStart
              ? "bg-[#4ade80] hover:bg-[#22c55e] text-black"
              : "bg-[#333] text-slate-500 cursor-not-allowed"
          }`}
        >
          Start Game
        </button>
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
    </div>
  );
}
