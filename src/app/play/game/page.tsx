"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getCheckoutSuggestion } from "@/lib/darts";
import { calculateMatchElo } from "@/lib/elo";
import { useData } from "@/context/DataContext";

interface GamePlayer {
  id: string;
  name: string;
  elo: number;
  remaining: number;
  legsWon: number;
  throws: number[];
  lastScore: number | null;
  oneEighties: number;
}

interface GameState {
  players: GamePlayer[];
  currentPlayerIndex: number;
  startingScore: number;
  legsToWin: number;
  gameMode: "301" | "501";
  isRanked: boolean;
  currentScore: string;
  gameOver: boolean;
  matchWinner: string | null;
  matchSaved: boolean;
  // For leg win confirmation
  pendingLegWin: { winnerIndex: number; winnerName: string } | null;
  // Track current leg number (1-indexed) to alternate starters
  currentLeg: number;
  // Track highest checkout across all legs in the match
  matchHighestCheckout: number;
}

function GameContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getPlayer, updatePlayer, saveMatch, loading: dataLoading } = useData();

  // Support both 1v1 (p1, p2) and multi-player (players)
  const p1Id = searchParams.get("p1");
  const p2Id = searchParams.get("p2");
  const playersParam = searchParams.get("players");
  const mode = (searchParams.get("mode") || "501") as "301" | "501";
  const legsToWin = parseInt(searchParams.get("legs") || "3");
  const isRanked = searchParams.get("ranked") === "true";
  const startingScore = mode === "301" ? 301 : 501;

  const [game, setGame] = useState<GameState | null>(null);
  const [lastAction, setLastAction] = useState<{
    playerIndex: number;
    score: number;
    remaining: number;
    lastScore: number | null;
  } | null>(null);
  const [showConfirmLeave, setShowConfirmLeave] = useState(false);
  const [showThrowsHistory, setShowThrowsHistory] = useState(false);
  // Prevent ghost clicks on match winner overlay
  const [matchResultReady, setMatchResultReady] = useState(false);
  const [editingThrow, setEditingThrow] = useState<{
    playerIndex: number;
    throwIndex: number;
    currentValue: number;
  } | null>(null);
  const [editThrowValue, setEditThrowValue] = useState("");

  useEffect(() => {
    // Only initialize the game once - don't re-run when player data updates
    if (dataLoading || game) return;

    let playerIds: string[] = [];

    if (playersParam) {
      playerIds = playersParam.split(",");
    } else if (p1Id && p2Id) {
      playerIds = [p1Id, p2Id];
    }

    if (playerIds.length < 2) {
      router.push("/");
      return;
    }

    const gamePlayers: GamePlayer[] = playerIds.map(id => {
      const p = getPlayer(id);
      if (!p) return null;
      return {
        id: p.id,
        name: p.name,
        elo: mode === "301" ? p.elo301 : p.elo501,
        remaining: startingScore,
        legsWon: 0,
        throws: [],
        lastScore: null,
        oneEighties: 0,
      };
    }).filter(Boolean) as GamePlayer[];

    if (gamePlayers.length < 2) {
      router.push("/");
      return;
    }

    setGame({
      players: gamePlayers,
      currentPlayerIndex: 0,
      startingScore,
      legsToWin,
      gameMode: mode,
      isRanked,
      currentScore: "",
      gameOver: false,
      matchWinner: null,
      matchSaved: false,
      pendingLegWin: null,
      currentLeg: 1,
      matchHighestCheckout: 0,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataLoading]);

  // Delay before match winner buttons become interactive (prevents ghost clicks)
  useEffect(() => {
    if (game?.matchWinner) {
      setMatchResultReady(false);
      const timer = setTimeout(() => setMatchResultReady(true), 800);
      return () => clearTimeout(timer);
    }
  }, [game?.matchWinner]);

  if (!game) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  const currentPlayer = game.players[game.currentPlayerIndex];
  const checkout = getCheckoutSuggestion(currentPlayer.remaining);

  const getAverage = (player: GamePlayer) => {
    if (player.throws.length === 0) return "0.00";
    const total = player.throws.reduce((sum, t) => sum + t, 0);
    return (total / player.throws.length).toFixed(2);
  };

  const getDartsThrown = (player: GamePlayer) => player.throws.length * 3;

  const getPlayerColor = (index: number, isCurrent: boolean) => {
    const colors = [
      { active: "bg-[#e85d3b]", inactive: "bg-[#c94d2e]" },
      { active: "bg-[#f5a623]", inactive: "bg-[#d98f1e]" },
      { active: "bg-[#4ade80]", inactive: "bg-[#22c55e]" },
      { active: "bg-[#3b82f6]", inactive: "bg-[#2563eb]" },
      { active: "bg-[#a855f7]", inactive: "bg-[#9333ea]" },
      { active: "bg-[#ec4899]", inactive: "bg-[#db2777]" },
    ];
    return isCurrent ? colors[index % colors.length].active : colors[index % colors.length].inactive;
  };

  // Helper to round to 2 decimal places
  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  const saveMatchResult = async (winnerIndex: number, winnerLegs: number, loserLegs: number, checkoutScore: number) => {
    if (game.matchSaved || !game.isRanked || game.players.length !== 2) return;

    const winner = game.players[winnerIndex];
    const loser = game.players[winnerIndex === 0 ? 1 : 0];

    // Get stored players to access their current ELO values
    const winnerStored = getPlayer(winner.id);
    const loserStored = getPlayer(loser.id);

    if (!winnerStored || !loserStored) return;

    // Calculate game-specific ELO changes (301 or 501)
    const gameEloResult = calculateMatchElo(winner.elo, loser.elo, true);

    // Calculate overall ELO changes independently using overall ELO values
    const overallEloResult = calculateMatchElo(winnerStored.elo, loserStored.elo, true);

    const winnerEloChange = overallEloResult.changeA;
    const loserEloChange = overallEloResult.changeB;

    // Update winner stats
    const winnerUpdates: Record<string, number> = {
      wins: winnerStored.wins + 1,
      legsWon: winnerStored.legsWon + winner.legsWon,
      legsLost: winnerStored.legsLost + loser.legsWon,
      oneEighties: winnerStored.oneEighties + winner.oneEighties,
      // Overall ELO is calculated independently
      elo: overallEloResult.newEloA,
    };

    if (mode === "301") {
      winnerUpdates.elo301 = gameEloResult.newEloA;
      winnerUpdates.wins301 = winnerStored.wins301 + 1;
    } else {
      winnerUpdates.elo501 = gameEloResult.newEloA;
      winnerUpdates.wins501 = winnerStored.wins501 + 1;
    }

    await updatePlayer(winner.id, winnerUpdates);

    // Update loser stats
    const loserUpdates: Record<string, number> = {
      losses: loserStored.losses + 1,
      legsWon: loserStored.legsWon + loser.legsWon,
      legsLost: loserStored.legsLost + winner.legsWon,
      oneEighties: loserStored.oneEighties + loser.oneEighties,
      // Overall ELO is calculated independently
      elo: overallEloResult.newEloB,
    };

    if (mode === "301") {
      loserUpdates.elo301 = gameEloResult.newEloB;
      loserUpdates.losses301 = loserStored.losses301 + 1;
    } else {
      loserUpdates.elo501 = gameEloResult.newEloB;
      loserUpdates.losses501 = loserStored.losses501 + 1;
    }

    await updatePlayer(loser.id, loserUpdates);

    // Save match
    await saveMatch({
      player1Id: game.players[0].id,
      player2Id: game.players[1].id,
      player1Name: game.players[0].name,
      player2Name: game.players[1].name,
      winnerId: winner.id,
      winnerName: winner.name,
      gameMode: game.gameMode,
      player1Legs: winnerIndex === 0 ? winnerLegs : loserLegs,
      player2Legs: winnerIndex === 1 ? winnerLegs : loserLegs,
      legsToWin: game.legsToWin,
      isRanked: true,
      player1EloChange: winnerIndex === 0 ? winnerEloChange : loserEloChange,
      player2EloChange: winnerIndex === 1 ? winnerEloChange : loserEloChange,
      player1Avg: parseFloat(getAverage(game.players[0])),
      player2Avg: parseFloat(getAverage(game.players[1])),
      player1OneEighties: game.players[0].oneEighties,
      player2OneEighties: game.players[1].oneEighties,
      highestCheckout: checkoutScore,
      playerCount: 2,
    });

    setGame((prev) => prev ? { ...prev, matchSaved: true } : null);
  };

  const savePracticeMatch = async (winnerIndex: number, finalLegs: number[], checkoutScore: number) => {
    if (game.matchSaved) return;

    const winner = game.players[winnerIndex];
    const allPlayerNames = game.players.map(p => p.name).join(', ');
    const playerCount = game.players.length;

    if (playerCount === 2) {
      // Standard 2-player practice match
      await saveMatch({
        player1Id: game.players[0].id,
        player2Id: game.players[1].id,
        player1Name: game.players[0].name,
        player2Name: game.players[1].name,
        winnerId: winner.id,
        winnerName: winner.name,
        gameMode: game.gameMode,
        player1Legs: finalLegs[0],
        player2Legs: finalLegs[1],
        legsToWin: game.legsToWin,
        isRanked: false,
        player1EloChange: 0,
        player2EloChange: 0,
        player1Avg: parseFloat(getAverage(game.players[0])),
        player2Avg: parseFloat(getAverage(game.players[1])),
        player1OneEighties: game.players[0].oneEighties,
        player2OneEighties: game.players[1].oneEighties,
        highestCheckout: checkoutScore,
        playerCount: 2,
      });
    } else {
      // Multi-player match (3+ players) - store all player names
      const otherPlayers = game.players.filter((_, i) => i !== winnerIndex);
      await saveMatch({
        player1Id: winner.id,
        player2Id: otherPlayers[0].id,
        player1Name: winner.name,
        player2Name: otherPlayers.map(p => p.name).join(', '),
        winnerId: winner.id,
        winnerName: winner.name,
        gameMode: game.gameMode,
        player1Legs: finalLegs[winnerIndex],
        player2Legs: 0,
        legsToWin: game.legsToWin,
        isRanked: false,
        player1EloChange: 0,
        player2EloChange: 0,
        player1Avg: 0,
        player2Avg: 0,
        player1OneEighties: 0,
        player2OneEighties: 0,
        highestCheckout: checkoutScore,
        playerCount: playerCount,
        allPlayerNames: allPlayerNames,
      });
    }

    setGame((prev) => prev ? { ...prev, matchSaved: true } : null);
  };

  const confirmLegWin = () => {
    if (!game.pendingLegWin) return;

    const { winnerIndex } = game.pendingLegWin;
    const newLegsWon = game.players[winnerIndex].legsWon + 1;

    // Get the checkout score (the score that won the leg)
    const legCheckout = game.players[winnerIndex].lastScore || 0;

    // Track the highest checkout across all legs in this match
    const newHighestCheckout = Math.max(game.matchHighestCheckout, legCheckout);

    // Calculate final leg counts for saving
    const finalLegs = game.players.map((p, i) =>
      i === winnerIndex ? newLegsWon : p.legsWon
    );
    const loserIndex = winnerIndex === 0 ? 1 : 0;

    if (newLegsWon >= legsToWin) {
      // Match won!
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        newPlayers[winnerIndex] = {
          ...newPlayers[winnerIndex],
          remaining: 0,
          legsWon: newLegsWon,
        };
        return {
          ...prev,
          players: newPlayers,
          currentScore: "",
          gameOver: true,
          matchWinner: newPlayers[winnerIndex].name,
          pendingLegWin: null,
          matchHighestCheckout: newHighestCheckout,
        };
      });

      // Save immediately with calculated values (not from state)
      // Use the highest checkout across all legs, not just the final leg
      if (isRanked && game.players.length === 2) {
        saveMatchResult(winnerIndex, newLegsWon, finalLegs[loserIndex], newHighestCheckout);
      } else {
        savePracticeMatch(winnerIndex, finalLegs, newHighestCheckout);
      }
    } else {
      // Start new leg - alternate the starter
      const nextLeg = game.currentLeg + 1;
      // Leg 1: player 0 starts, Leg 2: player 1 starts, Leg 3: player 0 starts, etc.
      const nextStarter = (nextLeg - 1) % game.players.length;

      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = prev.players.map((p, i) => ({
          ...p,
          remaining: startingScore,
          throws: [],
          lastScore: null,
          legsWon: i === winnerIndex ? newLegsWon : p.legsWon,
        }));

        return {
          ...prev,
          players: newPlayers,
          currentPlayerIndex: nextStarter,
          currentScore: "",
          pendingLegWin: null,
          currentLeg: nextLeg,
          matchHighestCheckout: newHighestCheckout,
        };
      });
      setLastAction(null);
    }
  };

  const cancelLegWin = () => {
    // Undo the checkout
    if (lastAction) {
      handleUndo();
    }
    setGame((prev) => prev ? { ...prev, pendingLegWin: null } : null);
  };

  const submitScore = (scoreValue: number) => {
    if (game.gameOver || game.pendingLegWin) return;

    const remaining = currentPlayer.remaining;
    const newRemaining = remaining - scoreValue;

    const isBust = newRemaining < 0 || newRemaining === 1;

    if (isBust) {
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = {
          ...newPlayers[prev.currentPlayerIndex],
          lastScore: null,
        };
        return {
          ...prev,
          players: newPlayers,
          currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
          currentScore: "",
        };
      });
      return;
    }

    setLastAction({
      playerIndex: game.currentPlayerIndex,
      score: scoreValue,
      remaining: remaining,
      lastScore: currentPlayer.lastScore,
    });

    if (newRemaining === 0) {
      // Leg won - show confirmation
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = {
          ...newPlayers[prev.currentPlayerIndex],
          remaining: 0,
          throws: [...newPlayers[prev.currentPlayerIndex].throws, scoreValue],
          lastScore: scoreValue,
          oneEighties: newPlayers[prev.currentPlayerIndex].oneEighties + (scoreValue === 180 ? 1 : 0),
        };
        return {
          ...prev,
          players: newPlayers,
          currentScore: "",
          pendingLegWin: {
            winnerIndex: prev.currentPlayerIndex,
            winnerName: newPlayers[prev.currentPlayerIndex].name,
          },
        };
      });
    } else {
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = {
          ...newPlayers[prev.currentPlayerIndex],
          remaining: newRemaining,
          throws: [...newPlayers[prev.currentPlayerIndex].throws, scoreValue],
          lastScore: scoreValue,
          oneEighties: newPlayers[prev.currentPlayerIndex].oneEighties + (scoreValue === 180 ? 1 : 0),
        };

        return {
          ...prev,
          players: newPlayers,
          currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
          currentScore: "",
        };
      });
    }
  };

  const handleNumberPad = (key: string) => {
    if (key === "undo") {
      handleUndo();
    } else if (key === "submit") {
      const score = parseInt(game.currentScore) || 0;
      if (score >= 0 && score <= 180) {
        submitScore(score);
      }
    } else {
      const newScore = game.currentScore + key;
      if (parseInt(newScore) <= 180) {
        setGame((prev) => prev ? { ...prev, currentScore: newScore } : null);
      }
    }
  };

  const handleUndo = () => {
    if (!lastAction || game.pendingLegWin) return;

    setGame((prev) => {
      if (!prev) return null;
      const newPlayers = [...prev.players];
      const undoPlayer = newPlayers[lastAction.playerIndex];
      const lastThrow = undoPlayer.throws[undoPlayer.throws.length - 1];

      newPlayers[lastAction.playerIndex] = {
        ...undoPlayer,
        remaining: lastAction.remaining,
        throws: undoPlayer.throws.slice(0, -1),
        lastScore: lastAction.lastScore,
        oneEighties: undoPlayer.oneEighties - (lastThrow === 180 ? 1 : 0),
      };

      return {
        ...prev,
        players: newPlayers,
        currentPlayerIndex: lastAction.playerIndex,
        currentScore: "",
      };
    });

    setLastAction(null);
  };

  const handleNewGame = () => router.push("/");
  const handleRematch = () => {
    window.location.reload();
  };

  const handleLeaveClick = () => {
    // If game is over, go directly home
    if (game?.gameOver) {
      handleNewGame();
    } else {
      // Show confirmation
      setShowConfirmLeave(true);
    }
  };

  const handleQuickScore = (score: number) => {
    if (game?.gameOver || game?.pendingLegWin) return;
    submitScore(score);
  };

  const openEditThrow = (playerIndex: number, throwIndex: number, currentValue: number) => {
    setEditingThrow({ playerIndex, throwIndex, currentValue });
    setEditThrowValue(currentValue.toString());
  };

  const handleSaveEditThrow = () => {
    if (!editingThrow || !game) return;

    const newValue = parseInt(editThrowValue) || 0;
    if (newValue < 0 || newValue > 180) return;

    const { playerIndex, throwIndex, currentValue } = editingThrow;
    const diff = newValue - currentValue;

    setGame((prev) => {
      if (!prev) return null;
      const newPlayers = [...prev.players];
      const player = { ...newPlayers[playerIndex] };

      // Update the throw value
      const newThrows = [...player.throws];
      newThrows[throwIndex] = newValue;
      player.throws = newThrows;

      // Recalculate remaining score from scratch
      const totalThrown = newThrows.reduce((sum, t) => sum + t, 0);
      player.remaining = startingScore - totalThrown;

      // Update 180 count
      const old180s = player.throws.filter(t => t === 180).length;
      player.oneEighties = newThrows.filter(t => t === 180).length;

      // Update last score if this was the last throw
      if (throwIndex === newThrows.length - 1) {
        player.lastScore = newValue;
      }

      newPlayers[playerIndex] = player;
      return { ...prev, players: newPlayers };
    });

    setEditingThrow(null);
    setEditThrowValue("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#1a1a1a] select-none">
      {/* Leg Win Confirmation */}
      {game.pendingLegWin && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-8">
            <div className="text-5xl mb-4">🎯</div>
            <h2 className="text-3xl font-bold text-white mb-2">{game.pendingLegWin.winnerName}</h2>
            <p className="text-xl text-[#4ade80] mb-8">wins the leg!</p>
            <div className="space-y-3">
              <button
                onClick={confirmLegWin}
                className="w-full py-4 px-8 bg-[#4ade80] hover:bg-[#22c55e] rounded-full text-xl font-semibold text-black"
              >
                {game.players[game.pendingLegWin.winnerIndex].legsWon + 1 >= legsToWin
                  ? "Finish Match"
                  : "Start Next Leg"}
              </button>
              <button
                onClick={cancelLegWin}
                className="w-full py-4 px-8 bg-slate-700 hover:bg-slate-600 rounded-full text-lg font-semibold text-white"
              >
                Go Back (Wrong Score)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Winner Overlay */}
      {game.matchWinner && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-40">
          <div className="text-center p-8">
            <div className="text-6xl mb-4">🏆</div>
            <h2 className="text-4xl font-bold text-white mb-2">{game.matchWinner}</h2>
            <p className="text-xl text-[#4ade80] mb-2">Wins!</p>
            <p className="text-slate-400 mb-2">
              {game.players.map(p => p.legsWon).join(" - ")}
            </p>
            {!game.isRanked && (
              <p className="text-[#f5a623] text-sm mb-6">Practice match - ELO unchanged</p>
            )}
            {matchResultReady ? (
              <div className="space-y-3">
                <button
                  onClick={handleNewGame}
                  className="w-full py-4 px-8 bg-[#4ade80] hover:bg-[#22c55e] rounded-full text-xl font-semibold text-black"
                >
                  Done
                </button>
                <button
                  onClick={handleRematch}
                  className="w-full py-4 px-8 bg-slate-700 hover:bg-slate-600 rounded-full text-xl font-semibold text-white"
                >
                  Rematch
                </button>
              </div>
            ) : (
              <p className="text-slate-500 text-sm mt-4">Saving match...</p>
            )}
          </div>
        </div>
      )}

      {/* Confirm Leave Modal */}
      {showConfirmLeave && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-8 max-w-sm">
            <h2 className="text-2xl font-bold text-white mb-2">Leave Match?</h2>
            <p className="text-slate-400 mb-6">
              The current match will not be saved and all progress will be lost.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => setShowConfirmLeave(false)}
                className="w-full py-4 px-8 bg-[#4ade80] hover:bg-[#22c55e] rounded-full text-xl font-semibold text-black"
              >
                Continue Playing
              </button>
              <button
                onClick={handleNewGame}
                className="w-full py-4 px-8 bg-slate-700 hover:bg-slate-600 rounded-full text-lg font-semibold text-white"
              >
                Leave Match
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Throws History Modal */}
      {showThrowsHistory && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-[#333] flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">All Throws</h3>
              <button
                onClick={() => setShowThrowsHistory(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {game.players.map((player, playerIndex) => (
                <div key={player.id} className="mb-4 last:mb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getPlayerColor(playerIndex, true).replace('bg-', 'bg-')}`} />
                    <span className="text-white font-semibold">{player.name}</span>
                    <span className="text-slate-400 text-sm">({player.throws.length} throws)</span>
                  </div>
                  {player.throws.length === 0 ? (
                    <p className="text-slate-500 text-sm pl-5">No throws yet</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pl-5">
                      {player.throws.map((score, throwIndex) => (
                        <button
                          key={throwIndex}
                          onClick={() => openEditThrow(playerIndex, throwIndex, score)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                            score === 180
                              ? "bg-[#f5a623] text-black"
                              : score >= 100
                              ? "bg-[#4ade80]/20 text-[#4ade80]"
                              : "bg-[#333] text-white"
                          } hover:ring-2 hover:ring-white/50`}
                        >
                          {score}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-[#333]">
              <button
                onClick={() => setShowThrowsHistory(false)}
                className="w-full py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Throw Modal */}
      {editingThrow && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl p-6 w-full max-w-xs">
            <h3 className="text-white font-bold text-lg mb-4">Edit Throw</h3>
            <p className="text-slate-400 text-sm mb-3">
              {game.players[editingThrow.playerIndex].name} - Throw #{editingThrow.throwIndex + 1}
            </p>
            <input
              type="number"
              min="0"
              max="180"
              value={editThrowValue}
              onChange={(e) => setEditThrowValue(e.target.value)}
              autoFocus
              className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-[#4ade80] mb-4"
            />
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setEditingThrow(null);
                  setEditThrowValue("");
                }}
                className="py-3 bg-[#444] hover:bg-[#555] text-white rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditThrow}
                className="py-3 bg-[#4ade80] hover:bg-[#22c55e] text-black rounded-xl font-semibold"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="py-3 px-4 flex items-center justify-between">
        <button onClick={handleLeaveClick} className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <h1 className="text-white font-bold tracking-wide">
            BEST TO {legsToWin}
          </h1>
          <p className={`text-xs ${game.isRanked ? "text-[#4ade80]" : "text-[#f5a623]"}`}>
            {game.isRanked ? "Ranked" : "Practice"} • {game.gameMode}
          </p>
        </div>
        <div className="w-10" />
      </div>

      {/* Player Cards */}
      <div className="px-4 mb-3">
        <div className={`flex rounded-2xl overflow-hidden ${game.players.length > 2 ? "flex-wrap gap-1" : ""}`}>
          {game.players.map((player, index) => (
            <div
              key={player.id}
              className={`${game.players.length <= 2 ? "flex-1" : "flex-1 min-w-[48%]"} p-3 ${getPlayerColor(index, game.currentPlayerIndex === index)}`}
            >
              <div className="flex items-center gap-2 mb-1">
                {game.currentPlayerIndex === index && <span className="w-2 h-2 rounded-full bg-white" />}
                <span className="text-white font-medium truncate text-sm">{player.name}</span>
              </div>
              <div className="flex items-start justify-between">
                <span className="text-5xl font-bold text-white">{player.remaining}</span>
                <span className="bg-black/30 text-white text-sm font-bold w-7 h-7 rounded-lg flex items-center justify-center">
                  {player.legsWon}
                </span>
              </div>
              <div className="mt-2 space-y-0.5 text-xs">
                <div className="flex justify-between text-white/80">
                  <span>Avg</span>
                  <span className="font-medium">{getAverage(player)}</span>
                </div>
                <div className="flex justify-between text-white/80">
                  <span>Last</span>
                  <span className="font-medium">{player.lastScore ?? "-"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="px-4 mb-2">
        <p className="text-[#4ade80] font-bold text-lg uppercase tracking-wide">
          {currentPlayer.name}&apos;s turn!
        </p>
      </div>

      {/* Checkout Hint */}
      {checkout && (
        <div className="px-4 mb-2">
          <p className="text-amber-400 text-sm">
            Checkout: <span className="font-semibold">{checkout.join(" → ")}</span>
          </p>
        </div>
      )}

      {/* Quick Score Buttons & All Throws */}
      <div className="px-4 mb-2">
        <div className="flex gap-2">
          <button
            onClick={() => handleQuickScore(26)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            26 <span className="text-slate-400 text-xs">Hamina</span>
          </button>
          <button
            onClick={() => handleQuickScore(29)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-lg text-sm font-medium"
          >
            29 <span className="text-slate-400 text-xs">VIP</span>
          </button>
          <button
            onClick={() => handleQuickScore(180)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-2 bg-[#f5a623] hover:bg-[#d98f1e] disabled:opacity-50 text-black rounded-lg text-sm font-bold"
          >
            180
          </button>
          <button
            onClick={() => setShowThrowsHistory(true)}
            className="px-3 py-2 bg-[#2a2a2a] hover:bg-[#333] text-slate-400 rounded-lg text-xs"
          >
            All throws
          </button>
        </div>
      </div>

      {/* Score Input */}
      <div className="px-4 mb-3">
        <div className="flex bg-[#2a2a2a] rounded-full overflow-hidden">
          <div className="flex-1 flex items-center px-4">
            <span className={`text-lg ${game.currentScore ? "text-white" : "text-slate-500"}`}>
              {game.currentScore || "Enter score"}
            </span>
          </div>
          <button
            onClick={() => handleNumberPad("submit")}
            disabled={!game.currentScore || !!game.pendingLegWin}
            className="bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-[#2d5a3d] px-8 py-3 text-black font-semibold transition-colors"
          >
            Submit
          </button>
        </div>
      </div>

      {/* Number Pad */}
      <div className="flex-1 px-4 pb-4">
        <div className="grid grid-cols-3 gap-[1px] bg-[#333] h-full rounded-xl overflow-hidden">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "undo", "0", "clear"].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === "clear") {
                  setGame((prev) => prev ? { ...prev, currentScore: "" } : null);
                } else {
                  handleNumberPad(key);
                }
              }}
              disabled={game.gameOver || !!game.pendingLegWin}
              className="bg-[#1a1a1a] hover:bg-[#2a2a2a] active:bg-[#333] flex items-center justify-center text-3xl font-light text-white transition-colors disabled:opacity-50"
            >
              {key === "undo" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
                </svg>
              ) : key === "clear" ? (
                <span className="text-xl">C</span>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Game() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      }
    >
      <GameContent />
    </Suspense>
  );
}
