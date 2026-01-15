"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
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
  haminas: number;
  sixtyPlus: number;
  eightyPlus: number;
  hundredPlus: number;
  doubleAttempts: number;
  doubleHits: number;
  // First 9 darts tracking
  legFirst9Total: number; // Running total of first 9 darts in current leg
  legFirst9Visits: number; // Number of visits counted in current leg's first 9 (max 3)
  allFirst9Totals: number[]; // Array of first 9 totals from each completed leg
}

// Check if a score is "on a double" (can finish with one dart)
function isOnDouble(remaining: number): boolean {
  // Even numbers 2-40 (D1-D20) or 50 (Bull)
  if (remaining === 50) return true;
  if (remaining >= 2 && remaining <= 40 && remaining % 2 === 0) return true;
  return false;
}

type DartMultiplier = "single" | "double" | "treble" | "bull" | "outer";

interface DartThrow {
  multiplier: DartMultiplier;
  value: number;  // 1-20 for single/double/treble, 50 for bull, 25 for outer
  score: number;  // Calculated: value * multiplier factor
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
  // Track highest checkout across all legs in the match (for backwards compatibility)
  matchHighestCheckout: number;
  // Track each player's highest checkout separately
  playerHighestCheckouts: number[];
  // Input mode: "round" for total score, "dart" for dart-by-dart
  inputMode: "round" | "dart";
  // Current turn's darts (max 3) in dart-by-dart mode
  currentDarts: DartThrow[];
  // Selected multiplier in dart-by-dart mode
  selectedMultiplier: DartMultiplier;
  // ELO changes after match ends (for ranked matches)
  eloChanges: { player1: number; player2: number } | null;
  // When the match started
  startedAt: string;
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
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showMatchStats, setShowMatchStats] = useState(false);
  // For tracking double attempts in visit mode
  const [pendingDoubleAttempts, setPendingDoubleAttempts] = useState<{
    playerIndex: number;
    wasCheckout: boolean;
    score: number;
    previousRemaining: number;
  } | null>(null);

  // Ref for horizontal scoreboard scrolling (3+ players)
  const scoreboardRef = useRef<HTMLDivElement>(null);
  const playerCardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll to current player when turn changes (for 3+ players)
  useEffect(() => {
    if (game && game.players.length > 2 && scoreboardRef.current) {
      const currentCard = playerCardRefs.current[game.currentPlayerIndex];
      if (currentCard) {
        currentCard.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      }
    }
  }, [game?.currentPlayerIndex, game?.players.length]);

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
        haminas: 0,
        sixtyPlus: 0,
        eightyPlus: 0,
        hundredPlus: 0,
        doubleAttempts: 0,
        doubleHits: 0,
        legFirst9Total: 0,
        legFirst9Visits: 0,
        allFirst9Totals: [],
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
      playerHighestCheckouts: gamePlayers.map(() => 0),
      inputMode: "round",
      currentDarts: [],
      selectedMultiplier: "single",
      eloChanges: null,
      startedAt: new Date().toISOString(),
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

  // Calculate effective remaining score (accounting for current darts in dart-by-dart mode)
  const getEffectiveRemaining = (playerIndex: number) => {
    const player = game.players[playerIndex];
    if (game.inputMode === "dart" && playerIndex === game.currentPlayerIndex) {
      const dartsTotal = game.currentDarts.reduce((sum, d) => sum + d.score, 0);
      return player.remaining - dartsTotal;
    }
    return player.remaining;
  };

  const effectiveRemaining = getEffectiveRemaining(game.currentPlayerIndex);
  const dartsRemainingInTurn = game.inputMode === "dart" ? 3 - game.currentDarts.length : 3;
  const checkout = getCheckoutSuggestion(effectiveRemaining, dartsRemainingInTurn);

  const getAverage = (player: GamePlayer) => {
    if (player.throws.length === 0) return "0.00";
    const total = player.throws.reduce((sum, t) => sum + t, 0);
    return (total / player.throws.length).toFixed(2);
  };

  // Calculate first 9 darts average (3 visits per leg, averaged across all legs)
  // includeCurrentLeg should be true when saving at match end (state update is async)
  const getFirst9Average = (player: GamePlayer, includeCurrentLeg: boolean = false) => {
    const totals = includeCurrentLeg
      ? [...player.allFirst9Totals, player.legFirst9Total]
      : player.allFirst9Totals;
    if (totals.length === 0) return 0;
    const sum = totals.reduce((a, b) => a + b, 0);
    // Average per leg, then divide by 3 visits to get per-visit average
    return sum / totals.length / 3;
  };

  const getDartsThrown = (player: GamePlayer) => player.throws.length * 3;

  const getPlayerColor = (index: number, isCurrent: boolean) => {
    // Non-current players get dark grey background
    if (!isCurrent) {
      return "bg-[#2a2a2a]";
    }
    // Current player gets their bright color
    const colors = [
      "bg-[#e85d3b]", // Orange
      "bg-[#f5a623]", // Yellow/Gold
      "bg-[#4ade80]", // Green
      "bg-[#3b82f6]", // Blue
      "bg-[#a855f7]", // Purple
      "bg-[#ec4899]", // Pink
    ];
    return colors[index % colors.length];
  };

  // Helper to round to 2 decimal places
  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  const saveMatchResult = async (winnerIndex: number, winnerLegs: number, loserLegs: number, checkoutScore: number, playerCheckouts: number[]) => {
    if (game.matchSaved || !game.isRanked || game.players.length !== 2) return;

    const winner = game.players[winnerIndex];
    const loser = game.players[winnerIndex === 0 ? 1 : 0];

    // Get stored players to access their current ELO values
    const winnerStored = getPlayer(winner.id);
    const loserStored = getPlayer(loser.id);

    if (!winnerStored || !loserStored) return;

    // Calculate game-specific ELO changes (301 or 501)
    const gameEloResult = calculateMatchElo(winner.elo, loser.elo, true);

    const winnerEloChange = gameEloResult.changeA;
    const loserEloChange = gameEloResult.changeB;

    // Get player checkouts from this match
    const winnerCheckout = playerCheckouts[winnerIndex] || 0;
    const loserCheckout = playerCheckouts[winnerIndex === 0 ? 1 : 0] || 0;

    // Calculate new game-specific ELO
    const newWinnerElo301 = mode === "301" ? gameEloResult.newEloA : winnerStored.elo301;
    const newWinnerElo501 = mode === "501" ? gameEloResult.newEloA : winnerStored.elo501;

    // Update winner stats
    const winnerUpdates: Record<string, number> = {
      wins: winnerStored.wins + 1,
      legsWon: winnerStored.legsWon + winnerLegs,
      legsLost: winnerStored.legsLost + loserLegs,
      oneEighties: winnerStored.oneEighties + winner.oneEighties,
      haminas: winnerStored.haminas + winner.haminas,
      // Overall ELO is the average of 301 and 501 ELOs
      elo: (newWinnerElo301 + newWinnerElo501) / 2,
    };

    // Update highest checkout if this match's checkout is higher
    if (winnerCheckout > winnerStored.highestCheckout) {
      winnerUpdates.highestCheckout = winnerCheckout;
    }

    if (mode === "301") {
      winnerUpdates.elo301 = gameEloResult.newEloA;
      winnerUpdates.wins301 = winnerStored.wins301 + 1;
    } else {
      winnerUpdates.elo501 = gameEloResult.newEloA;
      winnerUpdates.wins501 = winnerStored.wins501 + 1;
    }

    await updatePlayer(winner.id, winnerUpdates);

    // Calculate new game-specific ELO for loser
    const newLoserElo301 = mode === "301" ? gameEloResult.newEloB : loserStored.elo301;
    const newLoserElo501 = mode === "501" ? gameEloResult.newEloB : loserStored.elo501;

    // Update loser stats
    const loserUpdates: Record<string, number> = {
      losses: loserStored.losses + 1,
      legsWon: loserStored.legsWon + loserLegs,
      legsLost: loserStored.legsLost + winnerLegs,
      oneEighties: loserStored.oneEighties + loser.oneEighties,
      haminas: loserStored.haminas + loser.haminas,
      // Overall ELO is the average of 301 and 501 ELOs
      elo: (newLoserElo301 + newLoserElo501) / 2,
    };

    // Update highest checkout if this match's checkout is higher
    if (loserCheckout > loserStored.highestCheckout) {
      loserUpdates.highestCheckout = loserCheckout;
    }

    if (mode === "301") {
      loserUpdates.elo301 = gameEloResult.newEloB;
      loserUpdates.losses301 = loserStored.losses301 + 1;
    } else {
      loserUpdates.elo501 = gameEloResult.newEloB;
      loserUpdates.losses501 = loserStored.losses501 + 1;
    }

    await updatePlayer(loser.id, loserUpdates);

    // Save match with per-player checkouts
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
      player1EloStart: game.players[0].elo,
      player2EloStart: game.players[1].elo,
      player1Avg: parseFloat(getAverage(game.players[0])),
      player2Avg: parseFloat(getAverage(game.players[1])),
      player1OneEighties: game.players[0].oneEighties,
      player2OneEighties: game.players[1].oneEighties,
      highestCheckout: checkoutScore,
      player1HighestCheckout: playerCheckouts[0] || 0,
      player2HighestCheckout: playerCheckouts[1] || 0,
      playerCount: 2,
      player1Darts: getDartsThrown(game.players[0]),
      player2Darts: getDartsThrown(game.players[1]),
      player1SixtyPlus: game.players[0].sixtyPlus,
      player2SixtyPlus: game.players[1].sixtyPlus,
      player1EightyPlus: game.players[0].eightyPlus,
      player2EightyPlus: game.players[1].eightyPlus,
      player1HundredPlus: game.players[0].hundredPlus,
      player2HundredPlus: game.players[1].hundredPlus,
      player1DoubleAttempts: game.players[0].doubleAttempts,
      player2DoubleAttempts: game.players[1].doubleAttempts,
      player1DoubleHits: game.players[0].doubleHits,
      player2DoubleHits: game.players[1].doubleHits,
      startedAt: game.startedAt,
      player1First9Avg: getFirst9Average(game.players[0], true),
      player2First9Avg: getFirst9Average(game.players[1], true),
    });

    // Store ELO changes for display in winner popup
    setGame((prev) => prev ? {
      ...prev,
      matchSaved: true,
      eloChanges: { player1: winnerIndex === 0 ? winnerEloChange : loserEloChange, player2: winnerIndex === 1 ? winnerEloChange : loserEloChange }
    } : null);
  };

  const savePracticeMatch = async (winnerIndex: number, finalLegs: number[], checkoutScore: number, playerCheckouts: number[]) => {
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
        player1EloStart: game.players[0].elo,
        player2EloStart: game.players[1].elo,
        player1Avg: parseFloat(getAverage(game.players[0])),
        player2Avg: parseFloat(getAverage(game.players[1])),
        player1OneEighties: game.players[0].oneEighties,
        player2OneEighties: game.players[1].oneEighties,
        highestCheckout: checkoutScore,
        player1HighestCheckout: playerCheckouts[0] || 0,
        player2HighestCheckout: playerCheckouts[1] || 0,
        playerCount: 2,
        player1Darts: getDartsThrown(game.players[0]),
        player2Darts: getDartsThrown(game.players[1]),
        player1SixtyPlus: game.players[0].sixtyPlus,
        player2SixtyPlus: game.players[1].sixtyPlus,
        player1EightyPlus: game.players[0].eightyPlus,
        player2EightyPlus: game.players[1].eightyPlus,
        player1HundredPlus: game.players[0].hundredPlus,
        player2HundredPlus: game.players[1].hundredPlus,
        player1DoubleAttempts: game.players[0].doubleAttempts,
        player2DoubleAttempts: game.players[1].doubleAttempts,
        player1DoubleHits: game.players[0].doubleHits,
        player2DoubleHits: game.players[1].doubleHits,
        startedAt: game.startedAt,
        player1First9Avg: getFirst9Average(game.players[0]),
        player2First9Avg: getFirst9Average(game.players[1]),
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
        player1EloStart: winner.elo,
        player2EloStart: otherPlayers[0].elo,
        player1Avg: 0,
        player2Avg: 0,
        player1OneEighties: 0,
        player2OneEighties: 0,
        highestCheckout: checkoutScore,
        player1HighestCheckout: playerCheckouts[winnerIndex] || 0,
        player2HighestCheckout: 0,
        playerCount: playerCount,
        allPlayerNames: allPlayerNames,
        player1Darts: getDartsThrown(winner),
        player2Darts: 0,
        player1SixtyPlus: winner.sixtyPlus,
        player2SixtyPlus: 0,
        player1EightyPlus: winner.eightyPlus,
        player2EightyPlus: 0,
        player1HundredPlus: winner.hundredPlus,
        player2HundredPlus: 0,
        player1DoubleAttempts: winner.doubleAttempts,
        player2DoubleAttempts: 0,
        player1DoubleHits: winner.doubleHits,
        player2DoubleHits: 0,
        startedAt: game.startedAt,
        player1First9Avg: getFirst9Average(winner, true),
        player2First9Avg: 0,
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

    // Track the highest checkout across all legs in this match (for backwards compatibility)
    const newHighestCheckout = Math.max(game.matchHighestCheckout, legCheckout);

    // Track each player's highest checkout separately
    const newPlayerHighestCheckouts = [...game.playerHighestCheckouts];
    newPlayerHighestCheckouts[winnerIndex] = Math.max(newPlayerHighestCheckouts[winnerIndex], legCheckout);

    // Calculate final leg counts for saving
    const finalLegs = game.players.map((p, i) =>
      i === winnerIndex ? newLegsWon : p.legsWon
    );
    const loserIndex = winnerIndex === 0 ? 1 : 0;

    if (newLegsWon >= legsToWin) {
      // Match won! Save first 9 totals for all players
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = prev.players.map((p, i) => ({
          ...p,
          remaining: i === winnerIndex ? 0 : p.remaining,
          legsWon: i === winnerIndex ? newLegsWon : p.legsWon,
          // Save current leg's first 9 to the totals array
          allFirst9Totals: [...p.allFirst9Totals, p.legFirst9Total],
        }));
        return {
          ...prev,
          players: newPlayers,
          currentScore: "",
          gameOver: true,
          matchWinner: newPlayers[winnerIndex].name,
          pendingLegWin: null,
          matchHighestCheckout: newHighestCheckout,
          playerHighestCheckouts: newPlayerHighestCheckouts,
        };
      });

      // Save immediately with calculated values (not from state)
      // Pass both overall highest and per-player checkouts
      if (isRanked && game.players.length === 2) {
        saveMatchResult(winnerIndex, newLegsWon, finalLegs[loserIndex], newHighestCheckout, newPlayerHighestCheckouts);
      } else {
        savePracticeMatch(winnerIndex, finalLegs, newHighestCheckout, newPlayerHighestCheckouts);
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
          // Save current leg's first 9 and reset for new leg
          allFirst9Totals: [...p.allFirst9Totals, p.legFirst9Total],
          legFirst9Total: 0,
          legFirst9Visits: 0,
        }));

        return {
          ...prev,
          players: newPlayers,
          currentPlayerIndex: nextStarter,
          currentScore: "",
          pendingLegWin: null,
          currentLeg: nextLeg,
          matchHighestCheckout: newHighestCheckout,
          playerHighestCheckouts: newPlayerHighestCheckouts,
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

  const submitScore = (scoreValue: number, doubleAttempts?: number, doubleHits?: number) => {
    if (game.gameOver || game.pendingLegWin || pendingDoubleAttempts) return;

    const remaining = currentPlayer.remaining;
    const newRemaining = remaining - scoreValue;

    // In visit mode (no double stats passed), check if player was on a double
    // and we need to ask how many darts were thrown
    if (doubleAttempts === undefined && isOnDouble(remaining) && game.inputMode === "round") {
      // Show popup to ask how many darts were thrown
      setPendingDoubleAttempts({
        playerIndex: game.currentPlayerIndex,
        wasCheckout: newRemaining === 0,
        score: scoreValue,
        previousRemaining: remaining,
      });
      return;
    }

    const isBust = newRemaining < 0 || newRemaining === 1;

    if (isBust) {
      // In visit mode, if player was on a double before busting, ask about double attempts
      if (doubleAttempts === undefined && isOnDouble(remaining) && game.inputMode === "round") {
        setPendingDoubleAttempts({
          playerIndex: game.currentPlayerIndex,
          wasCheckout: false, // It's a bust, so no checkout
          score: -1, // Special value to indicate bust
          previousRemaining: remaining,
        });
        return;
      }

      // Update double attempts if provided (from popup or dart-by-dart)
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        const currentP = newPlayers[prev.currentPlayerIndex];
        newPlayers[prev.currentPlayerIndex] = {
          ...currentP,
          lastScore: null,
          doubleAttempts: currentP.doubleAttempts + (doubleAttempts || 0),
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
        const currentP = newPlayers[prev.currentPlayerIndex];
        // Track first 9 darts (first 3 visits per leg)
        const isFirst9 = currentP.legFirst9Visits < 3;
        newPlayers[prev.currentPlayerIndex] = {
          ...currentP,
          remaining: 0,
          throws: [...currentP.throws, scoreValue],
          lastScore: scoreValue,
          oneEighties: currentP.oneEighties + (scoreValue === 180 ? 1 : 0),
          haminas: currentP.haminas + (scoreValue === 26 ? 1 : 0),
          sixtyPlus: currentP.sixtyPlus + (scoreValue >= 60 ? 1 : 0),
          eightyPlus: currentP.eightyPlus + (scoreValue >= 80 ? 1 : 0),
          hundredPlus: currentP.hundredPlus + (scoreValue >= 100 ? 1 : 0),
          doubleAttempts: currentP.doubleAttempts + (doubleAttempts || 0),
          doubleHits: currentP.doubleHits + (doubleHits || 0),
          legFirst9Total: isFirst9 ? currentP.legFirst9Total + scoreValue : currentP.legFirst9Total,
          legFirst9Visits: isFirst9 ? currentP.legFirst9Visits + 1 : currentP.legFirst9Visits,
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
        const currentP = newPlayers[prev.currentPlayerIndex];
        // Track first 9 darts (first 3 visits per leg)
        const isFirst9 = currentP.legFirst9Visits < 3;
        newPlayers[prev.currentPlayerIndex] = {
          ...currentP,
          remaining: newRemaining,
          throws: [...currentP.throws, scoreValue],
          lastScore: scoreValue,
          oneEighties: currentP.oneEighties + (scoreValue === 180 ? 1 : 0),
          haminas: currentP.haminas + (scoreValue === 26 ? 1 : 0),
          sixtyPlus: currentP.sixtyPlus + (scoreValue >= 60 ? 1 : 0),
          eightyPlus: currentP.eightyPlus + (scoreValue >= 80 ? 1 : 0),
          hundredPlus: currentP.hundredPlus + (scoreValue >= 100 ? 1 : 0),
          doubleAttempts: currentP.doubleAttempts + (doubleAttempts || 0),
          doubleHits: currentP.doubleHits + (doubleHits || 0),
          legFirst9Total: isFirst9 ? currentP.legFirst9Total + scoreValue : currentP.legFirst9Total,
          legFirst9Visits: isFirst9 ? currentP.legFirst9Visits + 1 : currentP.legFirst9Visits,
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

  // Handle double attempts popup confirmation (visit mode)
  const confirmDoubleAttempts = (dartsThrown: number) => {
    if (!pendingDoubleAttempts || !game) return;

    const { wasCheckout, score } = pendingDoubleAttempts;
    const attempts = dartsThrown;
    const hits = wasCheckout ? 1 : 0;

    // Clear the popup first
    setPendingDoubleAttempts(null);

    // Handle bust case (score === -1)
    if (score === -1) {
      // Bust: update double attempts, record 0 throw, and move to next player
      setLastAction({
        playerIndex: game.currentPlayerIndex,
        score: 0,
        remaining: currentPlayer.remaining,
        lastScore: currentPlayer.lastScore,
      });

      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        const currentP = newPlayers[prev.currentPlayerIndex];
        // Track first 9 even for busts (counts as a visit with 0 score)
        const isFirst9 = currentP.legFirst9Visits < 3;
        newPlayers[prev.currentPlayerIndex] = {
          ...currentP,
          throws: [...currentP.throws, 0],
          lastScore: 0,
          doubleAttempts: currentP.doubleAttempts + attempts,
          legFirst9Total: currentP.legFirst9Total, // 0 added for bust
          legFirst9Visits: isFirst9 ? currentP.legFirst9Visits + 1 : currentP.legFirst9Visits,
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

    // Now submit the score with double stats
    submitScore(score, attempts, hits);
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
        haminas: undoPlayer.haminas - (lastThrow === 26 ? 1 : 0),
        sixtyPlus: undoPlayer.sixtyPlus - (lastThrow >= 60 ? 1 : 0),
        eightyPlus: undoPlayer.eightyPlus - (lastThrow >= 80 ? 1 : 0),
        hundredPlus: undoPlayer.hundredPlus - (lastThrow >= 100 ? 1 : 0),
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

  const handleBust = (doubleAttempts?: number) => {
    if (game?.gameOver || game?.pendingLegWin || pendingDoubleAttempts) return;

    // In visit mode, if player is on a double, ask about double attempts
    if (doubleAttempts === undefined && isOnDouble(currentPlayer.remaining) && game.inputMode === "round") {
      setPendingDoubleAttempts({
        playerIndex: game.currentPlayerIndex,
        wasCheckout: false,
        score: -1, // Special value for bust
        previousRemaining: currentPlayer.remaining,
      });
      return;
    }

    // Bust: Record 0 score, move to next player without changing remaining
    setLastAction({
      playerIndex: game.currentPlayerIndex,
      score: 0,
      remaining: currentPlayer.remaining,
      lastScore: currentPlayer.lastScore,
    });

    setGame((prev) => {
      if (!prev) return null;
      const newPlayers = [...prev.players];
      const currentP = newPlayers[prev.currentPlayerIndex];
      // Track first 9 even for busts (counts as a visit with 0 score)
      const isFirst9 = currentP.legFirst9Visits < 3;
      newPlayers[prev.currentPlayerIndex] = {
        ...currentP,
        throws: [...currentP.throws, 0],
        lastScore: 0,
        doubleAttempts: currentP.doubleAttempts + (doubleAttempts || 0),
        legFirst9Total: currentP.legFirst9Total, // 0 added for bust
        legFirst9Visits: isFirst9 ? currentP.legFirst9Visits + 1 : currentP.legFirst9Visits,
      };
      return {
        ...prev,
        players: newPlayers,
        currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
        currentScore: "",
      };
    });
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
      player.oneEighties = newThrows.filter(t => t === 180).length;

      // Update haminas count (26s)
      player.haminas = newThrows.filter(t => t === 26).length;

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

  // ============ DART-BY-DART MODE HANDLERS ============

  const getDartScore = (multiplier: DartMultiplier, value: number): number => {
    switch (multiplier) {
      case "single": return value;
      case "double": return value * 2;
      case "treble": return value * 3;
      case "bull": return 50;
      case "outer": return 25;
      default: return value;
    }
  };

  const formatDart = (dart: DartThrow): string => {
    switch (dart.multiplier) {
      case "single": return `${dart.value}`;
      case "double": return `D${dart.value}`;
      case "treble": return `T${dart.value}`;
      case "bull": return "Bull";
      case "outer": return "25";
      default: return `${dart.score}`;
    }
  };

  const getCurrentDartsTotal = (): number => {
    return game.currentDarts.reduce((sum, d) => sum + d.score, 0);
  };

  const handleModeToggle = (mode: "round" | "dart") => {
    if (game.gameOver || game.pendingLegWin) return;
    setGame((prev) => prev ? {
      ...prev,
      inputMode: mode,
      currentScore: "",
      currentDarts: [],
      selectedMultiplier: "single"
    } : null);
  };

  const handleMultiplierSelect = (multiplier: DartMultiplier) => {
    if (game.gameOver || game.pendingLegWin) return;
    setGame((prev) => prev ? { ...prev, selectedMultiplier: multiplier } : null);
  };

  const handleDartInput = (value: number) => {
    if (game.gameOver || game.pendingLegWin) return;
    if (game.currentDarts.length >= 3) return;

    // Handle bull (50) and outer (25) as direct score inputs
    let multiplier: DartMultiplier;
    let score: number;
    let dartValue: number;

    if (value === 50) {
      multiplier = "bull";
      score = 50;
      dartValue = 50;
    } else if (value === 25) {
      multiplier = "outer";
      score = 25;
      dartValue = 25;
    } else {
      multiplier = game.selectedMultiplier;
      score = getDartScore(multiplier, value);
      dartValue = value;
    }

    const newDart: DartThrow = { multiplier, value: dartValue, score };
    const newDarts = [...game.currentDarts, newDart];
    const total = newDarts.reduce((sum, d) => sum + d.score, 0);
    const newRemaining = currentPlayer.remaining - total;

    // Check for bust (less than 0 or equals 1)
    if (newRemaining < 0 || newRemaining === 1) {
      // Can't add this dart - would bust
      return;
    }

    // Check for checkout validity (must end on double)
    if (newRemaining === 0) {
      const lastDart = newDart;
      if (lastDart.multiplier !== "double" && lastDart.multiplier !== "bull") {
        // Invalid checkout - must end on double or bull
        return;
      }
    }

    setGame((prev) => prev ? { ...prev, currentDarts: newDarts } : null);
  };

  const handleDartMiss = () => {
    if (game.gameOver || game.pendingLegWin) return;
    if (game.currentDarts.length >= 3) return;

    const missDart: DartThrow = { multiplier: "single", value: 0, score: 0 };
    setGame((prev) => prev ? {
      ...prev,
      currentDarts: [...prev.currentDarts, missDart]
    } : null);
  };

  const handleDartUndo = () => {
    if (game.gameOver || game.pendingLegWin) return;
    if (game.currentDarts.length === 0) return;

    setGame((prev) => prev ? {
      ...prev,
      currentDarts: prev.currentDarts.slice(0, -1)
    } : null);
  };

  const handleDartSubmit = () => {
    if (game.gameOver || game.pendingLegWin) return;
    if (game.currentDarts.length === 0) return;

    const total = getCurrentDartsTotal();
    const newRemaining = currentPlayer.remaining - total;

    // Validate checkout (double-out)
    if (newRemaining === 0) {
      const lastDart = game.currentDarts[game.currentDarts.length - 1];
      if (lastDart.multiplier !== "double" && lastDart.multiplier !== "bull") {
        // Should not happen as we validate on input, but safety check
        return;
      }
    }

    // Calculate double attempts from the darts thrown
    let doubleAttempts = 0;
    let doubleHits = 0;
    let remainingBeforeDart = currentPlayer.remaining;

    for (let i = 0; i < game.currentDarts.length; i++) {
      const dart = game.currentDarts[i];
      if (isOnDouble(remainingBeforeDart)) {
        doubleAttempts++;
        // Check if this dart finished the leg
        if (remainingBeforeDart - dart.score === 0) {
          doubleHits++;
        }
      }
      remainingBeforeDart -= dart.score;
    }

    // Submit the total score using existing logic
    submitScore(total, doubleAttempts, doubleHits);

    // Reset darts for next turn
    setGame((prev) => prev ? {
      ...prev,
      currentDarts: [],
      selectedMultiplier: "single"
    } : null);
  };

  const handleDartBust = () => {
    if (game.gameOver || game.pendingLegWin) return;

    // Calculate double attempts from the darts thrown (all misses since we busted)
    let doubleAttempts = 0;
    let remainingBeforeDart = currentPlayer.remaining;

    for (const dart of game.currentDarts) {
      if (isOnDouble(remainingBeforeDart)) {
        doubleAttempts++;
      }
      remainingBeforeDart -= dart.score;
    }

    // Update player's double attempts (no hits since we busted)
    if (doubleAttempts > 0) {
      setGame((prev) => {
        if (!prev) return null;
        const newPlayers = [...prev.players];
        const currentP = newPlayers[prev.currentPlayerIndex];
        newPlayers[prev.currentPlayerIndex] = {
          ...currentP,
          doubleAttempts: currentP.doubleAttempts + doubleAttempts,
        };
        return { ...prev, players: newPlayers };
      });
    }

    // Record bust (0 score) and move to next player
    handleBust();

    // Reset darts
    setGame((prev) => prev ? {
      ...prev,
      currentDarts: [],
      selectedMultiplier: "single"
    } : null);
  };

  return (
    <div className="h-dvh flex flex-col bg-[#1a1a1a] select-none overflow-hidden">
      {/* Double Attempts Popup (visit mode) */}
      {pendingDoubleAttempts && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="text-center p-6 w-full max-w-xs">
            <h2 className="text-xl font-bold text-white mb-2">Darts at double?</h2>
            <p className="text-slate-400 text-sm mb-4">
              {pendingDoubleAttempts.wasCheckout ? "Nice checkout! " : ""}
              How many darts did you throw at a double?
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((num) => (
                <button
                  key={num}
                  onClick={() => confirmDoubleAttempts(num)}
                  className="py-4 bg-[#2a2a2a] hover:bg-[#3a3a3a] rounded-xl text-2xl font-bold text-white"
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
      {game.matchWinner && (() => {
        // Get full player data with profile pictures
        const player1Data = getPlayer(game.players[0].id);
        const player2Data = getPlayer(game.players[1].id);
        const player1Won = game.matchWinner === game.players[0].name;

        return (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-40 overflow-auto py-4">
          <div className="text-center px-4 w-full max-w-md">
            {/* Simple header when stats hidden */}
            {!showMatchStats && (
              <>
                <div className="text-6xl mb-4">🏆</div>
                <h2 className="text-4xl font-bold text-white mb-2">{game.matchWinner}</h2>
                <p className="text-xl text-[#4ade80] mb-2">Wins!</p>
                <p className="text-slate-400 mb-4">
                  {game.players.map(p => p.legsWon).join(" - ")}
                </p>
                {!game.isRanked && (
                  <p className="text-[#f5a623] text-sm mb-4">Practice match - ELO unchanged</p>
                )}
              </>
            )}

            {/* Match Stats Panel with player photos */}
            {showMatchStats && (
              <div className="bg-[#2a2a2a] rounded-2xl p-4 mb-4">
                {/* Player photos header - like match details page */}
                <div className="flex items-center justify-between mb-4">
                  {/* Player 1 */}
                  <div className="flex-1 text-center">
                    <div
                      className={`w-16 h-16 mx-auto rounded-lg overflow-hidden flex items-center justify-center text-2xl font-bold mb-2 ${
                        !player1Data?.profilePictureUrl ? (player1Won ? "bg-[#e85d3b]" : "bg-[#444]") : ""
                      }`}
                    >
                      {player1Data?.profilePictureUrl ? (
                        <Image
                          src={player1Data.profilePictureUrl}
                          alt={game.players[0].name}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-white">{game.players[0].name.charAt(0)}</span>
                      )}
                    </div>
                    <p className={`font-semibold text-sm ${player1Won ? "text-white" : "text-slate-400"}`}>
                      {game.players[0].name}
                    </p>
                    <p className="text-slate-500 text-xs">{game.players[0].elo.toFixed(2)} ELO</p>
                    {game.isRanked && game.eloChanges && (
                      <p className={`text-xs font-semibold ${game.eloChanges.player1 >= 0 ? "text-[#4ade80]" : "text-red-400"}`}>
                        {game.eloChanges.player1 >= 0 ? "+" : ""}{game.eloChanges.player1.toFixed(2)}
                      </p>
                    )}
                  </div>

                  {/* Score */}
                  <div className="px-3">
                    <p className="text-4xl font-bold text-white">
                      {game.players[0].legsWon} - {game.players[1].legsWon}
                    </p>
                    <p className="text-slate-500 text-xs mt-1">
                      {game.isRanked ? "Ranked" : "Practice"} • {game.gameMode}
                    </p>
                  </div>

                  {/* Player 2 */}
                  <div className="flex-1 text-center">
                    <div
                      className={`w-16 h-16 mx-auto rounded-lg overflow-hidden flex items-center justify-center text-2xl font-bold mb-2 ${
                        !player2Data?.profilePictureUrl ? (!player1Won ? "bg-[#f5a623]" : "bg-[#444]") : ""
                      }`}
                    >
                      {player2Data?.profilePictureUrl ? (
                        <Image
                          src={player2Data.profilePictureUrl}
                          alt={game.players[1].name}
                          width={64}
                          height={64}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <span className="text-white">{game.players[1].name.charAt(0)}</span>
                      )}
                    </div>
                    <p className={`font-semibold text-sm ${!player1Won ? "text-white" : "text-slate-400"}`}>
                      {game.players[1].name}
                    </p>
                    <p className="text-slate-500 text-xs">{game.players[1].elo.toFixed(2)} ELO</p>
                    {game.isRanked && game.eloChanges && (
                      <p className={`text-xs font-semibold ${game.eloChanges.player2 >= 0 ? "text-[#4ade80]" : "text-red-400"}`}>
                        {game.eloChanges.player2 >= 0 ? "+" : ""}{game.eloChanges.player2.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Match Statistics */}
                <h3 className="text-white font-bold text-left mb-3">Match Statistics</h3>

                <div className="space-y-3">
                  {/* Averages */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{getAverage(game.players[0])}</span>
                      <span className="text-slate-400 text-xs">Average</span>
                      <span className="text-white font-semibold">{getAverage(game.players[1])}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(parseFloat(getAverage(game.players[0])) / (parseFloat(getAverage(game.players[0])) + parseFloat(getAverage(game.players[1]))) * 100) || 50}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(parseFloat(getAverage(game.players[1])) / (parseFloat(getAverage(game.players[0])) + parseFloat(getAverage(game.players[1]))) * 100) || 50}%` }} />
                    </div>
                  </div>

                  {/* 100+ visits */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{game.players[0].hundredPlus}</span>
                      <span className="text-slate-400 text-xs">100+</span>
                      <span className="text-white font-semibold">{game.players[1].hundredPlus}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(game.players[0].hundredPlus / Math.max(1, game.players[0].hundredPlus + game.players[1].hundredPlus) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(game.players[1].hundredPlus / Math.max(1, game.players[0].hundredPlus + game.players[1].hundredPlus) * 100)}%` }} />
                    </div>
                  </div>

                  {/* 80+ visits */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{game.players[0].eightyPlus}</span>
                      <span className="text-slate-400 text-xs">80+</span>
                      <span className="text-white font-semibold">{game.players[1].eightyPlus}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(game.players[0].eightyPlus / Math.max(1, game.players[0].eightyPlus + game.players[1].eightyPlus) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(game.players[1].eightyPlus / Math.max(1, game.players[0].eightyPlus + game.players[1].eightyPlus) * 100)}%` }} />
                    </div>
                  </div>

                  {/* 60+ visits */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{game.players[0].sixtyPlus}</span>
                      <span className="text-slate-400 text-xs">60+</span>
                      <span className="text-white font-semibold">{game.players[1].sixtyPlus}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(game.players[0].sixtyPlus / Math.max(1, game.players[0].sixtyPlus + game.players[1].sixtyPlus) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(game.players[1].sixtyPlus / Math.max(1, game.players[0].sixtyPlus + game.players[1].sixtyPlus) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Doubles % */}
                  {(game.players[0].doubleAttempts > 0 || game.players[1].doubleAttempts > 0) && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white font-semibold">
                          {game.players[0].doubleAttempts > 0
                            ? `${Math.round(game.players[0].doubleHits / game.players[0].doubleAttempts * 100)}%`
                            : '-'}
                        </span>
                        <span className="text-slate-400 text-xs">Doubles</span>
                        <span className="text-white font-semibold">
                          {game.players[1].doubleAttempts > 0
                            ? `${Math.round(game.players[1].doubleHits / game.players[1].doubleAttempts * 100)}%`
                            : '-'}
                        </span>
                      </div>
                      <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                        <div className="bg-[#e85d3b]" style={{ width: `${(game.players[0].doubleAttempts > 0 ? game.players[0].doubleHits / game.players[0].doubleAttempts : 0) / Math.max(0.01, (game.players[0].doubleAttempts > 0 ? game.players[0].doubleHits / game.players[0].doubleAttempts : 0) + (game.players[1].doubleAttempts > 0 ? game.players[1].doubleHits / game.players[1].doubleAttempts : 0)) * 100}%` }} />
                        <div className="bg-[#f5a623]" style={{ width: `${(game.players[1].doubleAttempts > 0 ? game.players[1].doubleHits / game.players[1].doubleAttempts : 0) / Math.max(0.01, (game.players[0].doubleAttempts > 0 ? game.players[0].doubleHits / game.players[0].doubleAttempts : 0) + (game.players[1].doubleAttempts > 0 ? game.players[1].doubleHits / game.players[1].doubleAttempts : 0)) * 100}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Darts Thrown */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{getDartsThrown(game.players[0])}</span>
                      <span className="text-slate-400 text-xs">Darts</span>
                      <span className="text-white font-semibold">{getDartsThrown(game.players[1])}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(getDartsThrown(game.players[0]) / Math.max(1, getDartsThrown(game.players[0]) + getDartsThrown(game.players[1])) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(getDartsThrown(game.players[1]) / Math.max(1, getDartsThrown(game.players[0]) + getDartsThrown(game.players[1])) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Highest Checkout */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{game.playerHighestCheckouts[0] || 0}</span>
                      <span className="text-slate-400 text-xs">Highest Checkout</span>
                      <span className="text-white font-semibold">{game.playerHighestCheckouts[1] || 0}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${((game.playerHighestCheckouts[0] || 0) / Math.max(1, (game.playerHighestCheckouts[0] || 0) + (game.playerHighestCheckouts[1] || 0)) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${((game.playerHighestCheckouts[1] || 0) / Math.max(1, (game.playerHighestCheckouts[0] || 0) + (game.playerHighestCheckouts[1] || 0)) * 100)}%` }} />
                    </div>
                  </div>

                  {/* Legs Won */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-white font-semibold">{game.players[0].legsWon}</span>
                      <span className="text-slate-400 text-xs">Legs Won</span>
                      <span className="text-white font-semibold">{game.players[1].legsWon}</span>
                    </div>
                    <div className="h-2 bg-[#333] rounded-full overflow-hidden flex">
                      <div className="bg-[#e85d3b]" style={{ width: `${(game.players[0].legsWon / Math.max(1, game.players[0].legsWon + game.players[1].legsWon) * 100)}%` }} />
                      <div className="bg-[#f5a623]" style={{ width: `${(game.players[1].legsWon / Math.max(1, game.players[0].legsWon + game.players[1].legsWon) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {matchResultReady ? (
              <div className="space-y-3">
                <button
                  onClick={() => setShowMatchStats(!showMatchStats)}
                  className="w-full py-4 px-8 bg-[#3b82f6] hover:bg-[#2563eb] rounded-full text-xl font-semibold text-white"
                >
                  {showMatchStats ? "Hide Stats" : "Match Stats"}
                </button>
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
        );
      })()}

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
            <div className="p-4 border-b border-[#333]">
              <div className="flex items-center justify-between">
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
              <p className="text-slate-400 text-sm mt-1">Tap a score to edit it</p>
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
        {game.players.length <= 2 ? (
          // 2 players: side by side
          <div className="flex rounded-2xl overflow-hidden">
            {game.players.map((player, index) => {
              const displayRemaining = getEffectiveRemaining(index);
              return (
              <div
                key={player.id}
                className={`flex-1 p-3 ${getPlayerColor(index, game.currentPlayerIndex === index)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {game.currentPlayerIndex === index && <span className="w-2 h-2 rounded-full bg-white" />}
                  <span className="text-white font-medium truncate text-sm">{player.name}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-5xl font-bold text-white">
                    {displayRemaining}
                  </span>
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
                  <div className="flex justify-between text-white/80">
                    <span>Darts</span>
                    <span className="font-medium">{getDartsThrown(player)}</span>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        ) : (
          // 3+ players: horizontal scroll
          <div
            ref={scoreboardRef}
            className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {game.players.map((player, index) => {
              const displayRemaining = getEffectiveRemaining(index);
              return (
              <div
                key={player.id}
                ref={(el) => { playerCardRefs.current[index] = el; }}
                className={`flex-shrink-0 w-36 p-3 rounded-xl snap-center ${getPlayerColor(index, game.currentPlayerIndex === index)}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  {game.currentPlayerIndex === index && <span className="w-2 h-2 rounded-full bg-white" />}
                  <span className="text-white font-medium truncate text-sm">{player.name}</span>
                </div>
                <div className="flex items-start justify-between">
                  <span className="text-4xl font-bold text-white">
                    {displayRemaining}
                  </span>
                  <span className="bg-black/30 text-white text-xs font-bold w-6 h-6 rounded-lg flex items-center justify-center">
                    {player.legsWon}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-xs">
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
              );
            })}
          </div>
        )}
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

      {/* Mode Selector Popup */}
      {showModeSelector && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowModeSelector(false)}>
          <div className="bg-[#2a2a2a] rounded-2xl p-4 w-64" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-white font-bold text-center mb-4">Input Mode</h3>
            <div className="space-y-2">
              <button
                onClick={() => {
                  handleModeToggle("round");
                  setShowModeSelector(false);
                }}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center gap-3 ${
                  game.inputMode === "round"
                    ? "bg-[#4ade80] text-black"
                    : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Round Total
              </button>
              <button
                onClick={() => {
                  handleModeToggle("dart");
                  setShowModeSelector(false);
                }}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors flex items-center gap-3 ${
                  game.inputMode === "dart"
                    ? "bg-[#4ade80] text-black"
                    : "bg-[#1a1a1a] text-white hover:bg-[#333]"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="3" y="3" width="4" height="4" rx="0.5" />
                  <rect x="10" y="3" width="4" height="4" rx="0.5" />
                  <rect x="17" y="3" width="4" height="4" rx="0.5" />
                  <rect x="3" y="10" width="4" height="4" rx="0.5" />
                  <rect x="10" y="10" width="4" height="4" rx="0.5" />
                  <rect x="17" y="10" width="4" height="4" rx="0.5" />
                  <rect x="3" y="17" width="4" height="4" rx="0.5" />
                  <rect x="10" y="17" width="4" height="4" rx="0.5" />
                  <rect x="17" y="17" width="4" height="4" rx="0.5" />
                </svg>
                Dart by Dart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Round Mode: Row 1 - Mode Toggle, All Throws, Bust */}
      {game.inputMode === "round" && (
      <div className="px-4 mb-2">
        <div className="flex gap-2">
          {/* Mode Toggle */}
          <button
            onClick={() => setShowModeSelector(true)}
            className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] px-3 py-2 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Round</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {/* All Throws */}
          <button
            onClick={() => setShowThrowsHistory(true)}
            className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#333] text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            All throws
          </button>
          {/* Bust */}
          <button
            onClick={() => handleBust()}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-2 bg-[#e85d3b] hover:bg-[#d14d2b] disabled:opacity-50 text-white rounded-lg text-sm font-bold"
          >
            Bust
          </button>
        </div>
      </div>
      )}

      {/* Round Mode: Row 2 - Hamina, Hanko, 180 */}
      {game.inputMode === "round" && (
      <div className="px-4 mb-2">
        <div className="flex gap-2">
          <button
            onClick={() => handleQuickScore(26)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-1.5 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-lg font-medium"
          >
            26 <span className="text-slate-400 text-xs">Hamina</span>
          </button>
          <button
            onClick={() => handleQuickScore(29)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-1.5 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-lg font-medium"
          >
            29 <span className="text-slate-400 text-xs">Hanko</span>
          </button>
          <button
            onClick={() => handleQuickScore(180)}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-1.5 bg-[#f5a623] hover:bg-[#d98f1e] disabled:opacity-50 text-black rounded-lg font-bold"
          >
            180
          </button>
        </div>
      </div>
      )}

      {/* Dart Mode: Mode Toggle + All Throws */}
      {game.inputMode === "dart" && (
      <div className="px-4 mb-2">
        <div className="flex gap-2">
          <button
            onClick={() => setShowModeSelector(true)}
            className="flex items-center gap-2 bg-[#2a2a2a] hover:bg-[#333] px-3 py-2 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="3" y="3" width="4" height="4" rx="0.5" />
              <rect x="10" y="3" width="4" height="4" rx="0.5" />
              <rect x="17" y="3" width="4" height="4" rx="0.5" />
              <rect x="3" y="10" width="4" height="4" rx="0.5" />
              <rect x="10" y="10" width="4" height="4" rx="0.5" />
              <rect x="17" y="10" width="4" height="4" rx="0.5" />
              <rect x="3" y="17" width="4" height="4" rx="0.5" />
              <rect x="10" y="17" width="4" height="4" rx="0.5" />
              <rect x="17" y="17" width="4" height="4" rx="0.5" />
            </svg>
            <span className="text-sm font-medium">Dart</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <button
            onClick={() => setShowThrowsHistory(true)}
            className="flex-1 py-2 bg-[#2a2a2a] hover:bg-[#333] text-slate-400 hover:text-white rounded-lg text-sm font-medium transition-colors"
          >
            All throws
          </button>
        </div>
      </div>
      )}

      {/* Round Mode: Score Input */}
      {game.inputMode === "round" && (
      <div className="px-4 mb-3">
        <div className="bg-[#2a2a2a] rounded-full px-4 py-3">
          <span className={`text-lg ${game.currentScore ? "text-white" : "text-slate-500"}`}>
            {game.currentScore || "Enter score"}
          </span>
        </div>
      </div>
      )}

      {/* Round Mode: Number Pad */}
      {game.inputMode === "round" && (
      <div className="flex-1 min-h-0 px-4 pb-4">
        <div className="grid grid-cols-3 gap-2 h-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "clear", "0", "submit"].map((key) => (
            <button
              key={key}
              onClick={() => {
                if (key === "clear") {
                  setGame((prev) => prev ? { ...prev, currentScore: "" } : null);
                } else {
                  handleNumberPad(key);
                }
              }}
              disabled={game.gameOver || !!game.pendingLegWin || (key === "submit" && !game.currentScore)}
              className={`${
                key === "submit"
                  ? "bg-[#4ade80] hover:bg-[#22c55e] text-black"
                  : "bg-[#2a2a2a] hover:bg-[#333] active:bg-[#4ade80] active:text-black text-white"
              } rounded-lg flex items-center justify-center text-2xl font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {key === "clear" ? (
                <span className="text-xl font-bold">C</span>
              ) : key === "submit" ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                key
              )}
            </button>
          ))}
        </div>
      </div>
      )}

      {/* Dart Mode: Current Darts Display */}
      {game.inputMode === "dart" && (
      <div className="px-4 mb-1">
        <div className="bg-[#2a2a2a] rounded-xl p-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-slate-400 text-xs">Current Turn</span>
            <span className="text-white font-bold text-sm">
              Total: {getCurrentDartsTotal()}
            </span>
          </div>
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex-1 py-2 rounded-lg text-center font-bold text-sm ${
                  game.currentDarts[i]
                    ? "bg-[#4ade80] text-black"
                    : "bg-[#1a1a1a] text-slate-500"
                }`}
              >
                {game.currentDarts[i] ? formatDart(game.currentDarts[i]) : `-`}
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Dart Mode: Multiplier Selector */}
      {game.inputMode === "dart" && (
      <div className="px-4 mb-1">
        <div className="flex gap-1">
          {(["single", "double", "treble"] as DartMultiplier[]).map((mult) => (
            <button
              key={mult}
              onClick={() => handleMultiplierSelect(mult)}
              disabled={game.gameOver || !!game.pendingLegWin}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors ${
                game.selectedMultiplier === mult
                  ? mult === "double"
                    ? "bg-blue-500 text-white"
                    : mult === "treble"
                    ? "bg-purple-500 text-white"
                    : "bg-[#4ade80] text-black"
                  : "bg-[#2a2a2a] text-slate-400 hover:text-white"
              }`}
            >
              {mult.charAt(0).toUpperCase()}
            </button>
          ))}
          {/* Bull (50) - direct score button */}
          <button
            onClick={() => handleDartInput(50)}
            disabled={game.gameOver || !!game.pendingLegWin || game.currentDarts.length >= 3}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white"
          >
            Bull
          </button>
          {/* Outer (25) - direct score button */}
          <button
            onClick={() => handleDartInput(25)}
            disabled={game.gameOver || !!game.pendingLegWin || game.currentDarts.length >= 3}
            className="flex-1 py-1.5 rounded-lg text-xs font-bold uppercase transition-colors bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white"
          >
            25
          </button>
        </div>
      </div>
      )}

      {/* Dart Mode: Number Grid */}
      {game.inputMode === "dart" && (
      <div className="px-4 mb-1 flex-1 min-h-0">
        <div className="grid grid-cols-5 gap-1 h-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((num) => {
            const score = getDartScore(game.selectedMultiplier, num);
            const wouldBust = currentPlayer.remaining - getCurrentDartsTotal() - score < 0 ||
                              currentPlayer.remaining - getCurrentDartsTotal() - score === 1;
            const isCheckout = currentPlayer.remaining - getCurrentDartsTotal() - score === 0;
            const invalidCheckout = isCheckout && game.selectedMultiplier !== "double" && game.selectedMultiplier !== "bull";
            const isDisabled = game.gameOver || !!game.pendingLegWin || game.currentDarts.length >= 3 || wouldBust || invalidCheckout;

            return (
              <button
                key={num}
                onClick={() => handleDartInput(num)}
                disabled={isDisabled}
                className={`rounded-lg text-lg font-bold transition-colors ${
                  isDisabled
                    ? "bg-[#1a1a1a] text-slate-600 cursor-not-allowed"
                    : "bg-[#2a2a2a] text-white hover:bg-[#333] active:bg-[#4ade80] active:text-black"
                }`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
      )}

      {/* Dart Mode: Action Buttons */}
      {game.inputMode === "dart" && (
      <div className="px-4 pb-3">
        <div className="flex gap-2">
          <button
            onClick={handleDartUndo}
            disabled={game.gameOver || !!game.pendingLegWin || game.currentDarts.length === 0}
            className="flex-1 py-3 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
            </svg>
            Undo
          </button>
          <button
            onClick={handleDartMiss}
            disabled={game.gameOver || !!game.pendingLegWin || game.currentDarts.length >= 3}
            className="flex-1 py-3 bg-[#e85d3b] hover:bg-[#d14d2b] disabled:opacity-50 text-white rounded-xl text-xs font-bold"
          >
            Miss
          </button>
          <button
            onClick={handleDartBust}
            disabled={game.gameOver || !!game.pendingLegWin}
            className="flex-1 py-3 bg-[#f5a623] hover:bg-[#d98f1e] disabled:opacity-50 text-black rounded-xl text-xs font-bold"
          >
            Bust
          </button>
          <button
            onClick={handleDartSubmit}
            disabled={game.gameOver || !!game.pendingLegWin || game.currentDarts.length === 0}
            className="flex-1 py-3 bg-[#4ade80] hover:bg-[#22c55e] disabled:opacity-50 disabled:bg-[#2d5a3d] text-black rounded-xl text-xs font-bold"
          >
            Submit
          </button>
        </div>
      </div>
      )}
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
