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
  color: string;
}

// Action history for undo
interface HistoryEntry {
  playerIndex: number;
  number: CricketNumber;
  previousMarks: number;
  previousPoints: number;
}

const PLAYER_COLORS = [
  { bg: "bg-[#e85d3b]", text: "text-[#e85d3b]", mark: "#e85d3b" },
  { bg: "bg-[#f5a623]", text: "text-[#f5a623]", mark: "#f5a623" },
  { bg: "bg-[#4ade80]", text: "text-[#4ade80]", mark: "#4ade80" },
  { bg: "bg-[#3b82f6]", text: "text-[#3b82f6]", mark: "#3b82f6" },
];

function CricketGameContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { getPlayer, saveMatch, loading: dataLoading } = useData();

  const [cricketPlayers, setCricketPlayers] = useState<PlayerState[]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [showConfirmQuit, setShowConfirmQuit] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

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
          roundsWon: 0,
          color: PLAYER_COLORS[index % PLAYER_COLORS.length].mark,
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
  const renderMark = (marks: number, color: string, isClosed: boolean) => {
    // If closed by all, show muted
    if (isClosed && marks < 3) {
      return (
        <div className="w-14 h-10 flex items-center justify-center">
          <div className="w-10 h-1 rounded-full bg-[#444]" />
        </div>
      );
    }

    // 0 hits - empty pill
    if (marks === 0) {
      return (
        <div className="w-14 h-10 flex items-center justify-center">
          <div className="w-10 h-1 rounded-full bg-[#444]" />
        </div>
      );
    }

    // 1 hit - single slash
    if (marks === 1) {
      return (
        <div className="w-14 h-10 flex items-center justify-center">
          <svg viewBox="0 0 40 30" className="w-9 h-7">
            <line x1="10" y1="24" x2="30" y2="6" stroke={color} strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // 2 hits - X cross
    if (marks === 2) {
      return (
        <div className="w-14 h-10 flex items-center justify-center">
          <svg viewBox="0 0 40 30" className="w-9 h-7">
            <line x1="10" y1="24" x2="30" y2="6" stroke={color} strokeWidth="4" strokeLinecap="round" />
            <line x1="10" y1="6" x2="30" y2="24" stroke={color} strokeWidth="4" strokeLinecap="round" />
          </svg>
        </div>
      );
    }

    // 3+ hits - X with circle (closed)
    return (
      <div className="w-14 h-10 flex items-center justify-center">
        <svg viewBox="0 0 40 30" className="w-9 h-7">
          <circle cx="20" cy="15" r="11" fill="none" stroke={color} strokeWidth="2.5" />
          <line x1="12" y1="21" x2="28" y2="9" stroke={color} strokeWidth="3" strokeLinecap="round" />
          <line x1="12" y1="9" x2="28" y2="21" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </svg>
      </div>
    );
  };

  if (cricketPlayers.length < 2) {
    return (
      <div className="h-dvh bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const player1 = cricketPlayers[0];
  const player2 = cricketPlayers[1];

  return (
    <div className="h-dvh bg-[#1a1a1a] flex flex-col select-none overflow-hidden">
      {/* Header */}
      <div className="py-3 px-4 flex items-center justify-between">
        <button
          onClick={() => setShowConfirmQuit(true)}
          className="text-slate-400 p-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-white font-bold tracking-wide">CRICKET</h1>
          <p className="text-[#f5a623] text-xs">Practice</p>
        </div>
        <button
          onClick={undo}
          disabled={history.length === 0}
          className="text-slate-400 p-2 disabled:opacity-30"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
          </svg>
        </button>
      </div>

      {/* Player Score Cards */}
      <div className="px-4 mb-3">
        <div className="flex rounded-2xl overflow-hidden">
          {/* Player 1 */}
          <div className={`flex-1 p-3 ${PLAYER_COLORS[0].bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-medium truncate text-sm">{player1.player.name}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-5xl font-bold text-white">{player1.points}</span>
              <span className="bg-black/30 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">
                {player1.roundsWon}
              </span>
            </div>
          </div>
          {/* Player 2 */}
          <div className={`flex-1 p-3 ${PLAYER_COLORS[1].bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-white font-medium truncate text-sm">{player2.player.name}</span>
            </div>
            <div className="flex items-start justify-between">
              <span className="text-5xl font-bold text-white">{player2.points}</span>
              <span className="bg-black/30 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">
                {player2.roundsWon}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Cricket Grid */}
      <div className="flex-1 px-4">
        <div className="bg-[#2a2a2a] rounded-2xl p-3 h-full flex flex-col justify-around">
          {CRICKET_NUMBERS.map((num) => {
            const closedByAll = isClosedByAll(num);
            return (
              <div key={num} className="flex items-center">
                {/* Player 1 mark - tappable */}
                <button
                  onClick={() => handleMarkTap(0, num)}
                  disabled={gameOver || closedByAll}
                  className="flex-1 flex justify-center items-center py-1 active:scale-95 transition-transform disabled:active:scale-100"
                >
                  {renderMark(player1.marks[num], player1.color, closedByAll)}
                </button>

                {/* Number in center */}
                <div className="w-14 text-center">
                  <span className={`text-2xl font-bold ${closedByAll ? "text-[#444]" : "text-white"}`}>
                    {num === 25 ? "B" : num}
                  </span>
                </div>

                {/* Player 2 mark - tappable */}
                <button
                  onClick={() => handleMarkTap(1, num)}
                  disabled={gameOver || closedByAll}
                  className="flex-1 flex justify-center items-center py-1 active:scale-95 transition-transform disabled:active:scale-100"
                >
                  {renderMark(player2.marks[num], player2.color, closedByAll)}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-4">
        <p className="text-slate-500 text-xs text-center">
          Tap marks to score • Double tap for doubles • Triple tap for triples
        </p>
      </div>

      {/* Winner Modal */}
      {gameOver && winner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
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
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold"
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
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-sm text-center">
            <h3 className="text-white font-bold text-xl mb-2">Leave Game?</h3>
            <p className="text-slate-400 mb-6">
              Progress will not be saved.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setShowConfirmQuit(false)}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Continue
              </button>
              <button
                onClick={() => router.push("/")}
                className="py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold"
              >
                Leave
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
        <div className="h-dvh bg-[#1a1a1a] flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      }
    >
      <CricketGameContent />
    </Suspense>
  );
}
