"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useData } from "@/context/DataContext";
import type { Player } from "@/lib/supabase-data";

// Cricket numbers: 20, 19, 18, 17, 16, 15, Bull
const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 25] as const;
type CricketNumber = (typeof CRICKET_NUMBERS)[number];

interface PlayerState {
  player: Player;
  marks: Record<CricketNumber, number>; // 0-3 marks per number
  points: number;
  color: string;
}

// Type for tracking hits (including misses where number is null)
type TurnHit = { number: CricketNumber; multiplier: number } | { number: null; multiplier: 0 };

function CricketGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlayer, saveMatch, loading: dataLoading } = useData();

  const [cricketPlayers, setCricketPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [dartsThrown, setDartsThrown] = useState(0);
  const [currentTurnHits, setCurrentTurnHits] = useState<TurnHit[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showConfirmQuit, setShowConfirmQuit] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<CricketNumber | null>(null);

  const PLAYER_COLORS = [
    "bg-[#e85d3b]",
    "bg-[#f5a623]",
    "bg-[#4ade80]",
    "bg-[#3b82f6]",
    "bg-[#a855f7]",
    "bg-[#ec4899]",
  ];

  useEffect(() => {
    if (dataLoading) return;

    const playerIds = searchParams.get("players")?.split(",") || [];

    const loadedPlayers: PlayerState[] = [];
    playerIds.forEach((id, index) => {
      const player = getPlayer(id);
      if (player) {
        loadedPlayers.push({
          player,
          marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 },
          points: 0,
          color: PLAYER_COLORS[index % PLAYER_COLORS.length],
        });
      }
    });

    if (loadedPlayers.length >= 2) {
      setCricketPlayers(loadedPlayers);
    }
  }, [searchParams, getPlayer, dataLoading]);

  const currentPlayer = cricketPlayers[currentPlayerIndex];

  // Check if a player has closed all numbers
  const hasClosedAll = (playerState: PlayerState) => {
    return CRICKET_NUMBERS.every((num) => playerState.marks[num] >= 3);
  };

  // Check if a number is closed by all players
  const isClosedByAll = (number: CricketNumber) => {
    return cricketPlayers.every((p) => p.marks[number] >= 3);
  };

  // Handle hitting a number
  const hitNumber = (number: CricketNumber, multiplier: 1 | 2 | 3) => {
    if (gameOver || dartsThrown >= 3) return;

    const newPlayers = [...cricketPlayers];
    const player = newPlayers[currentPlayerIndex];
    const currentMarks = player.marks[number];
    const marksToAdd = multiplier;

    // Calculate how many marks go toward closing (max 3 total)
    const marksNeeded = Math.max(0, 3 - currentMarks);
    const closingMarks = Math.min(marksToAdd, marksNeeded);
    const scoringMarks = marksToAdd - closingMarks;

    // Add marks
    player.marks[number] = Math.min(3, currentMarks + marksToAdd);

    // Score points if number is closed by this player but not all others
    if (scoringMarks > 0 && !isClosedByAll(number)) {
      const pointValue = number === 25 ? 25 : number;
      player.points += pointValue * scoringMarks;
    }

    // Track this hit for the turn
    setCurrentTurnHits([...currentTurnHits, { number, multiplier }]);
    setDartsThrown(dartsThrown + 1);
    setCricketPlayers(newPlayers);
    setSelectedNumber(null);

    // Check for winner
    if (hasClosedAll(player)) {
      // Player closed all - check if they have highest points
      const otherPlayers = newPlayers.filter((_, i) => i !== currentPlayerIndex);
      const hasHighestPoints = otherPlayers.every((p) => player.points >= p.points);

      if (hasHighestPoints) {
        setGameOver(true);
        setWinner(player.player);
      }
    }
  };

  // Miss (no hit)
  const miss = () => {
    if (gameOver || dartsThrown >= 3) return;
    setDartsThrown(dartsThrown + 1);
    setCurrentTurnHits([...currentTurnHits, { number: null, multiplier: 0 }]);
  };

  // End turn
  const endTurn = () => {
    setCurrentPlayerIndex((currentPlayerIndex + 1) % cricketPlayers.length);
    setDartsThrown(0);
    setCurrentTurnHits([]);
  };

  // Undo last dart
  const undoLastDart = () => {
    if (currentTurnHits.length === 0) return;

    const lastHit = currentTurnHits[currentTurnHits.length - 1];
    const newPlayers = [...cricketPlayers];
    const player = newPlayers[currentPlayerIndex];

    if (lastHit.number !== null) {
      // Reverse the marks and points
      const prevMarks = player.marks[lastHit.number];
      const newMarks = Math.max(0, prevMarks - lastHit.multiplier);

      // Calculate points to remove
      const marksWereClosed = prevMarks >= 3;
      if (marksWereClosed && !isClosedByAll(lastHit.number)) {
        const scoringMarks = Math.min(lastHit.multiplier, prevMarks - 3 + lastHit.multiplier);
        const pointValue = lastHit.number === 25 ? 25 : lastHit.number;
        player.points = Math.max(0, player.points - pointValue * scoringMarks);
      }

      player.marks[lastHit.number] = newMarks;
      setCricketPlayers(newPlayers);
    }

    setCurrentTurnHits(currentTurnHits.slice(0, -1));
    setDartsThrown(Math.max(0, dartsThrown - 1));
    setGameOver(false);
    setWinner(null);
  };

  // End game and save
  const finishGame = async () => {
    if (!winner) return;

    // Find the winner's full state
    const winnerState = cricketPlayers.find((p) => p.player.id === winner.id);
    if (!winnerState) return;

    // Save match result
    await saveMatch({
      player1Id: cricketPlayers[0].player.id,
      player2Id: cricketPlayers[1]?.player.id || "",
      player1Name: cricketPlayers[0].player.name,
      player2Name: cricketPlayers[1]?.player.name || "",
      winnerId: winner.id,
      winnerName: winner.name,
      player1Legs: cricketPlayers[0].player.id === winner.id ? 1 : 0,
      player2Legs: cricketPlayers[1]?.player.id === winner.id ? 1 : 0,
      player1EloChange: 0,
      player2EloChange: 0,
      player1Avg: 0,
      player2Avg: 0,
      player1OneEighties: 0,
      player2OneEighties: 0,
      gameMode: "cricket",
      legsToWin: 1,
      isRanked: false,
      highestCheckout: 0,
      player1HighestCheckout: 0,
      player2HighestCheckout: 0,
      playerCount: cricketPlayers.length,
    });

    router.push("/");
  };

  // Render marks display (○, /, X, ⊗)
  const renderMarks = (marks: number) => {
    if (marks === 0) return <span className="text-slate-600">○</span>;
    if (marks === 1) return <span className="text-white">/</span>;
    if (marks === 2) return <span className="text-white">X</span>;
    return <span className="text-[#4ade80]">⊗</span>;
  };

  if (cricketPlayers.length < 2) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="py-2 px-4 flex items-center justify-between bg-[#222]">
        <button
          onClick={() => setShowConfirmQuit(true)}
          className="text-slate-400 p-2"
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
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h1 className="text-white font-bold text-lg">Cricket</h1>
        <div className="w-10" />
      </div>

      {/* Player Scores */}
      <div className="flex border-b border-[#333]">
        {cricketPlayers.map((p, index) => (
          <div
            key={p.player.id}
            className={`flex-1 p-3 text-center ${
              index === currentPlayerIndex ? p.color : "bg-[#2a2a2a]"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                index === currentPlayerIndex ? "text-white" : "text-slate-400"
              }`}
            >
              {p.player.name}
            </p>
            <p
              className={`text-2xl font-bold ${
                index === currentPlayerIndex ? "text-white" : "text-white"
              }`}
            >
              {p.points}
            </p>
          </div>
        ))}
      </div>

      {/* Scoreboard */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <tbody>
            {CRICKET_NUMBERS.map((num) => (
              <tr key={num} className="border-b border-[#333]">
                {/* Left player marks */}
                {cricketPlayers.slice(0, Math.ceil(cricketPlayers.length / 2)).map((p) => (
                  <td
                    key={`${p.player.id}-${num}`}
                    className="py-3 px-4 text-center text-xl"
                  >
                    {renderMarks(p.marks[num])}
                  </td>
                ))}

                {/* Number in center */}
                <td className="py-3 px-4 text-center">
                  <button
                    onClick={() =>
                      setSelectedNumber(selectedNumber === num ? null : num)
                    }
                    disabled={gameOver || dartsThrown >= 3}
                    className={`w-12 h-12 rounded-full text-xl font-bold transition-colors ${
                      selectedNumber === num
                        ? "bg-[#4ade80] text-black"
                        : isClosedByAll(num)
                        ? "bg-[#333] text-slate-500"
                        : "bg-[#444] text-white"
                    }`}
                  >
                    {num === 25 ? "B" : num}
                  </button>
                </td>

                {/* Right player marks */}
                {cricketPlayers.slice(Math.ceil(cricketPlayers.length / 2)).map((p) => (
                  <td
                    key={`${p.player.id}-${num}`}
                    className="py-3 px-4 text-center text-xl"
                  >
                    {renderMarks(p.marks[num])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Multiplier buttons when number selected */}
      {selectedNumber !== null && !gameOver && dartsThrown < 3 && (
        <div className="p-4 bg-[#222] border-t border-[#333]">
          <p className="text-slate-400 text-sm text-center mb-3">
            Hit {selectedNumber === 25 ? "Bull" : selectedNumber}:
          </p>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => hitNumber(selectedNumber, 1)}
              className="py-4 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl text-xl font-bold"
            >
              Single
            </button>
            <button
              onClick={() => hitNumber(selectedNumber, 2)}
              className="py-4 bg-[#f5a623] hover:bg-[#d98f1e] text-black rounded-xl text-xl font-bold"
            >
              Double
            </button>
            <button
              onClick={() => hitNumber(selectedNumber, 3)}
              disabled={selectedNumber === 25}
              className={`py-4 rounded-xl text-xl font-bold ${
                selectedNumber === 25
                  ? "bg-[#333] text-slate-500 cursor-not-allowed"
                  : "bg-[#e85d3b] hover:bg-[#d14a2a] text-white"
              }`}
            >
              Triple
            </button>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div className="p-4 bg-[#222] border-t border-[#333]">
        {/* Darts thrown indicator */}
        <div className="flex justify-center gap-2 mb-4">
          {[1, 2, 3].map((dart) => (
            <div
              key={dart}
              className={`w-3 h-3 rounded-full ${
                dart <= dartsThrown ? "bg-[#4ade80]" : "bg-[#444]"
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={undoLastDart}
            disabled={currentTurnHits.length === 0}
            className="py-3 bg-[#333] hover:bg-[#444] disabled:opacity-50 text-white rounded-xl font-semibold"
          >
            Undo
          </button>
          <button
            onClick={miss}
            disabled={gameOver || dartsThrown >= 3}
            className="py-3 bg-[#444] hover:bg-[#555] disabled:opacity-50 text-white rounded-xl font-semibold"
          >
            Miss
          </button>
          <button
            onClick={endTurn}
            disabled={dartsThrown === 0}
            className="py-3 bg-[#4ade80] hover:bg-[#22c55e] disabled:opacity-50 text-black rounded-xl font-semibold"
          >
            Next
          </button>
        </div>
      </div>

      {/* Winner Modal */}
      {gameOver && winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm text-center">
            <h2 className="text-[#4ade80] font-bold text-3xl mb-2">
              {winner.name} Wins!
            </h2>
            <p className="text-slate-400 mb-6">
              {cricketPlayers.find((p) => p.player.id === winner.id)?.points} points
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={undoLastDart}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Undo
              </button>
              <button
                onClick={finishGame}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Finish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Quit Modal */}
      {showConfirmQuit && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold text-xl mb-2">Quit Game?</h3>
            <p className="text-slate-400 mb-6">
              Progress will not be saved.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirmQuit(false)}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => router.push("/")}
                className="py-3 bg-[#e85d3b] hover:bg-[#d14a2a] text-white rounded-xl font-semibold"
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CricketGame() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      }
    >
      <CricketGameContent />
    </Suspense>
  );
}
