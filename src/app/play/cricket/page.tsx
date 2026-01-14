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
  marks: Record<CricketNumber, number>; // 0+ marks per number
  points: number;
  roundsWon: number;
}

// Action history for undo
interface HistoryEntry {
  playerIndex: number;
  number: CricketNumber;
  previousMarks: number;
  previousPoints: number;
}

function CricketGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlayer, saveMatch, loading: dataLoading } = useData();

  const [cricketPlayers, setCricketPlayers] = useState<PlayerState[]>([]);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showConfirmQuit, setShowConfirmQuit] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (dataLoading) return;

    const playerIds = searchParams.get("players")?.split(",") || [];

    const loadedPlayers: PlayerState[] = [];
    playerIds.forEach((id) => {
      const player = getPlayer(id);
      if (player) {
        loadedPlayers.push({
          player,
          marks: { 20: 0, 19: 0, 18: 0, 17: 0, 16: 0, 15: 0, 25: 0 },
          points: 0,
          roundsWon: 0,
        });
      }
    });

    if (loadedPlayers.length >= 2) {
      setCricketPlayers(loadedPlayers);
    }
  }, [searchParams, getPlayer, dataLoading]);

  // Check if a number is closed by all players
  const isClosedByAll = (number: CricketNumber) => {
    return cricketPlayers.every((p) => p.marks[number] >= 3);
  };

  // Check if a player has closed all numbers
  const hasClosedAll = (playerState: PlayerState) => {
    return CRICKET_NUMBERS.every((num) => playerState.marks[num] >= 3);
  };

  // Handle tapping on a player's mark area - adds 1 hit
  const handleMarkTap = (playerIndex: number, number: CricketNumber) => {
    if (gameOver) return;

    // Can only mark for current player
    if (playerIndex !== currentPlayerIndex) return;

    // Can't mark if closed by all
    if (isClosedByAll(number)) return;

    const newPlayers = [...cricketPlayers];
    const player = newPlayers[playerIndex];
    const currentMarks = player.marks[number];

    // Save state for undo
    setHistory([...history, {
      playerIndex,
      number,
      previousMarks: currentMarks,
      previousPoints: player.points,
    }]);

    // Add 1 mark
    player.marks[number] = currentMarks + 1;

    // Score points if player has closed (3+) and others haven't all closed
    if (currentMarks >= 3 && !isClosedByAll(number)) {
      const pointValue = number === 25 ? 25 : number;
      player.points += pointValue;
    }

    setCricketPlayers(newPlayers);

    // Check for winner
    if (hasClosedAll(player)) {
      const otherPlayers = newPlayers.filter((_, i) => i !== playerIndex);
      const hasHighestPoints = otherPlayers.every((p) => player.points >= p.points);

      if (hasHighestPoints) {
        setGameOver(true);
        setWinner(player.player);
      }
    }
  };

  // Undo last action
  const undo = () => {
    if (history.length === 0) return;

    const lastEntry = history[history.length - 1];
    const newPlayers = [...cricketPlayers];
    const player = newPlayers[lastEntry.playerIndex];

    player.marks[lastEntry.number] = lastEntry.previousMarks;
    player.points = lastEntry.previousPoints;

    setCricketPlayers(newPlayers);
    setHistory(history.slice(0, -1));
    setGameOver(false);
    setWinner(null);
  };

  // End game and save
  const finishGame = async () => {
    if (!winner) return;

    const winnerState = cricketPlayers.find((p) => p.player.id === winner.id);
    if (!winnerState) return;

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
      player1EloStart: cricketPlayers[0].player.elo,
      player2EloStart: cricketPlayers[1]?.player.elo || 1000,
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

  // Render mark indicator based on hit count
  const renderMark = (marks: number, isCurrentPlayer: boolean, isClosed: boolean) => {
    // If closed by all, show grey/muted
    if (isClosed) {
      return (
        <div className="w-16 h-10 flex items-center justify-center">
          <div className="w-12 h-1.5 rounded-full bg-[#555]" />
        </div>
      );
    }

    // 0 hits - empty pill
    if (marks === 0) {
      return (
        <div className="w-16 h-10 flex items-center justify-center">
          <div className="w-12 h-1.5 rounded-full bg-[#555]" />
        </div>
      );
    }

    // 1 hit - single slash
    if (marks === 1) {
      return (
        <div className="w-16 h-10 flex items-center justify-center">
          <svg viewBox="0 0 40 30" className="w-10 h-8">
            <line x1="10" y1="25" x2="30" y2="5" stroke="#e85d3b" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // 2 hits - X cross
    if (marks === 2) {
      return (
        <div className="w-16 h-10 flex items-center justify-center">
          <svg viewBox="0 0 40 30" className="w-10 h-8">
            <line x1="10" y1="25" x2="30" y2="5" stroke="#e85d3b" strokeWidth="4" strokeLinecap="round" />
            <line x1="10" y1="5" x2="30" y2="25" stroke="#e85d3b" strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // 3+ hits - X with circle (closed)
    return (
      <div className="w-16 h-10 flex items-center justify-center">
        <svg viewBox="0 0 40 30" className="w-10 h-8">
          <circle cx="20" cy="15" r="12" fill="none" stroke="#e85d3b" strokeWidth="3" />
          <line x1="12" y1="22" x2="28" y2="8" stroke="#e85d3b" strokeWidth="3" strokeLinecap="round" />
          <line x1="12" y1="8" x2="28" y2="22" stroke="#e85d3b" strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  };

  if (cricketPlayers.length < 2) {
    return (
      <div className="h-dvh bg-[#3a3a3c] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const player1 = cricketPlayers[0];
  const player2 = cricketPlayers[1];

  return (
    <div className="h-dvh bg-[#3a3a3c] flex flex-col select-none overflow-hidden">
      {/* Player Headers */}
      <div className="flex">
        {/* Player 1 */}
        <div className={`flex-1 pt-6 pb-4 text-center ${currentPlayerIndex === 0 ? "" : "opacity-60"}`}>
          <p className="text-[#8e8e93] text-sm">Rounds won: {player1.roundsWon}</p>
          <p className="text-white text-2xl font-semibold mt-1">{player1.player.name}</p>
          <p className="text-white text-6xl font-bold mt-2">{player1.points}</p>
        </div>
        {/* Player 2 */}
        <div className={`flex-1 pt-6 pb-4 text-center ${currentPlayerIndex === 1 ? "" : "opacity-60"}`}>
          <p className="text-[#8e8e93] text-sm">Rounds won: {player2.roundsWon}</p>
          <p className="text-white text-2xl font-semibold mt-1">{player2.player.name}</p>
          <p className="text-white text-6xl font-bold mt-2">{player2.points}</p>
        </div>
      </div>

      {/* Cricket Grid */}
      <div className="flex-1 flex flex-col justify-center px-4">
        {CRICKET_NUMBERS.map((num) => {
          const closedByAll = isClosedByAll(num);
          return (
            <div key={num} className="flex items-center py-2">
              {/* Player 1 mark - tappable */}
              <button
                onClick={() => handleMarkTap(0, num)}
                disabled={gameOver || currentPlayerIndex !== 0 || closedByAll}
                className="flex-1 flex justify-center items-center py-1 active:opacity-70 disabled:opacity-100"
              >
                {renderMark(player1.marks[num], currentPlayerIndex === 0, closedByAll)}
              </button>

              {/* Number in center */}
              <div className="w-16 text-center">
                <span className={`text-3xl font-light ${closedByAll ? "text-[#555]" : "text-[#8e8e93]"}`}>
                  {num === 25 ? "B" : num}
                </span>
              </div>

              {/* Player 2 mark - tappable */}
              <button
                onClick={() => handleMarkTap(1, num)}
                disabled={gameOver || currentPlayerIndex !== 1 || closedByAll}
                className="flex-1 flex justify-center items-center py-1 active:opacity-70 disabled:opacity-100"
              >
                {renderMark(player2.marks[num], currentPlayerIndex === 1, closedByAll)}
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom Controls */}
      <div className="flex justify-between items-center px-6 py-6">
        <button
          onClick={() => setShowConfirmQuit(true)}
          className="text-white text-lg font-medium"
        >
          Exit
        </button>

        {/* Next Player Button */}
        <button
          onClick={() => setCurrentPlayerIndex((currentPlayerIndex + 1) % 2)}
          className="px-6 py-2 bg-[#4ade80] rounded-full text-black font-semibold"
        >
          Next Player
        </button>

        <button
          onClick={undo}
          disabled={history.length === 0}
          className="text-white text-lg font-medium disabled:opacity-40"
        >
          Undo
        </button>
      </div>

      {/* Winner Modal */}
      {gameOver && winner && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm text-center">
            <div className="text-5xl mb-4">🏆</div>
            <h2 className="text-white font-bold text-3xl mb-2">
              {winner.name}
            </h2>
            <p className="text-[#4ade80] text-xl mb-2">Wins!</p>
            <p className="text-slate-400 mb-6">
              {cricketPlayers.find((p) => p.player.id === winner.id)?.points} points
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={undo}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Undo
              </button>
              <button
                onClick={finishGame}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Done
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
        <div className="h-dvh bg-[#3a3a3c] flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      }
    >
      <CricketGameContent />
    </Suspense>
  );
}
