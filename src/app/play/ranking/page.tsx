"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPlayers, getTalliPlayers, getVisitorPlayers, addPlayer, type Player } from "@/lib/players";

export default function RankingSetup() {
  const router = useRouter();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [player1, setPlayer1] = useState<Player | null>(null);
  const [player2, setPlayer2] = useState<Player | null>(null);
  const [gameMode, setGameMode] = useState<"301" | "501">("501");
  const [legsToWin, setLegsToWin] = useState(3);
  const [customLegs, setCustomLegs] = useState("");
  const [starterIndex, setStarterIndex] = useState<0 | 1>(0);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = () => {
    const players = getPlayers().sort((a, b) => a.name.localeCompare(b.name));
    setAllPlayers(players);
  };

  const talliPlayers = allPlayers.filter(p => p.group === "talli");
  const visitorPlayers = allPlayers.filter(p => p.group === "visitor");

  const canStart = player1 && player2 && player1.id !== player2.id && legsToWin > 0;

  const startGame = () => {
    if (!canStart) return;

    // Reorder players so starter is first
    const p1 = starterIndex === 0 ? player1 : player2;
    const p2 = starterIndex === 0 ? player2 : player1;

    const params = new URLSearchParams({
      p1: p1!.id,
      p2: p2!.id,
      mode: gameMode,
      legs: legsToWin.toString(),
      ranked: "true",
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

  const selectPlayer = (player: Player) => {
    if (player1?.id === player.id) {
      setPlayer1(null);
    } else if (player2?.id === player.id) {
      setPlayer2(null);
    } else if (!player1) {
      setPlayer1(player);
    } else if (!player2) {
      setPlayer2(player);
    } else {
      setPlayer2(player);
    }
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
        <h1 className="flex-1 text-center text-white font-bold text-xl">Ranking Match</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Selected Players & Who Starts */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            onClick={() => player1 && setStarterIndex(0)}
            className={`p-4 rounded-xl text-center transition-all ${
              player1 ? "bg-[#e85d3b]" : "bg-[#2a2a2a] border-2 border-dashed border-[#444]"
            } ${starterIndex === 0 && player1 ? "ring-2 ring-white" : ""}`}
          >
            <p className="text-white/60 text-xs mb-1">Player 1</p>
            <p className="text-white font-bold text-lg">{player1?.name || "Select"}</p>
            {player1 && (
              <>
                <p className="text-white/70 text-xs mt-1">ELO: {player1.elo.toFixed(2)}</p>
                {starterIndex === 0 && (
                  <p className="text-white text-xs mt-1 font-semibold">▶ Starts</p>
                )}
              </>
            )}
          </button>
          <button
            onClick={() => player2 && setStarterIndex(1)}
            className={`p-4 rounded-xl text-center transition-all ${
              player2 ? "bg-[#f5a623]" : "bg-[#2a2a2a] border-2 border-dashed border-[#444]"
            } ${starterIndex === 1 && player2 ? "ring-2 ring-white" : ""}`}
          >
            <p className="text-white/60 text-xs mb-1">Player 2</p>
            <p className="text-white font-bold text-lg">{player2?.name || "Select"}</p>
            {player2 && (
              <>
                <p className="text-white/70 text-xs mt-1">ELO: {player2.elo.toFixed(2)}</p>
                {starterIndex === 1 && (
                  <p className="text-white text-xs mt-1 font-semibold">▶ Starts</p>
                )}
              </>
            )}
          </button>
        </div>

        {player1 && player2 && (
          <p className="text-slate-400 text-xs text-center mb-4">
            Tap a player card to select who starts first
          </p>
        )}

        {/* Player Selection */}
        <div className="mb-6">
          <h2 className="text-white font-semibold mb-3">Talli Darts</h2>
          <div className="grid grid-cols-4 gap-2">
            {talliPlayers.map((player) => {
              const isP1 = player1?.id === player.id;
              const isP2 = player2?.id === player.id;
              return (
                <button
                  key={player.id}
                  onClick={() => selectPlayer(player)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors ${
                    isP1 ? "bg-[#e85d3b] text-white" :
                    isP2 ? "bg-[#f5a623] text-white" :
                    "bg-[#2a2a2a] text-white hover:bg-[#333]"
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
              const isP1 = player1?.id === player.id;
              const isP2 = player2?.id === player.id;
              return (
                <button
                  key={player.id}
                  onClick={() => selectPlayer(player)}
                  className={`py-3 px-2 rounded-xl text-sm font-medium transition-colors ${
                    isP1 ? "bg-[#e85d3b] text-white" :
                    isP2 ? "bg-[#f5a623] text-white" :
                    "bg-[#2a2a2a] text-white hover:bg-[#333]"
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
                gameMode === "301" ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
              }`}
            >
              301
            </button>
            <button
              onClick={() => setGameMode("501")}
              className={`py-4 rounded-xl text-xl font-semibold transition-colors ${
                gameMode === "501" ? "bg-[#4ade80] text-black" : "bg-[#2a2a2a] text-white"
              }`}
            >
              501
            </button>
          </div>
        </div>

        {/* Best to (Legs) */}
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
      </div>

      {/* Start Button */}
      <div className="p-4">
        <button
          onClick={startGame}
          disabled={!canStart}
          className={`w-full py-4 rounded-xl text-xl font-semibold transition-colors ${
            canStart ? "bg-[#4ade80] hover:bg-[#22c55e] text-black" : "bg-[#333] text-slate-500 cursor-not-allowed"
          }`}
        >
          Start Ranking Match
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
