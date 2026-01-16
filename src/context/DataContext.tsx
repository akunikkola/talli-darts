"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  Player,
  MatchResult,
  fetchPlayers,
  fetchPlayer,
  fetchMatches,
  createPlayer,
  updatePlayerDb,
  deletePlayerDb,
  createMatch,
  updateMatchDb,
  deleteMatchDb,
  resetAllPlayersStats,
  clearAllMatches,
  subscribeToPlayers,
  subscribeToMatches,
  initializeDefaultPlayers,
  uploadProfilePicture as uploadProfilePictureDb,
} from '@/lib/supabase-data';
import { calculateMatchElo } from '@/lib/elo';

interface DataContextType {
  // Data
  players: Player[];
  matches: MatchResult[];
  loading: boolean;
  initialLoadComplete: boolean;

  // Player operations
  getPlayer: (id: string) => Player | undefined;
  addPlayer: (name: string, group?: "talli" | "visitor") => Promise<Player | null>;
  updatePlayer: (id: string, updates: Partial<Player>) => Promise<boolean>;
  deletePlayer: (id: string) => Promise<boolean>;
  uploadProfilePicture: (playerId: string, file: File) => Promise<string | null>;

  // Match operations
  saveMatch: (match: Omit<MatchResult, 'id' | 'playedAt'>) => Promise<MatchResult | null>;
  updateMatch: (id: string, updates: Partial<MatchResult>) => Promise<boolean>;
  deleteMatchAndRevertStats: (id: string) => Promise<boolean>;

  // Bulk operations
  resetAllStats: () => Promise<boolean>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | null>(null);

const MIN_LOADING_TIME = 1200; // 1.2 seconds minimum loading screen

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Minimum loading time timer - runs once when app starts
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, MIN_LOADING_TIME);
    return () => clearTimeout(timer);
  }, []);

  // Initial load is complete when both data is loaded AND minimum time has passed
  const initialLoadComplete = dataLoaded && minTimeElapsed;

  // Initialize and subscribe to real-time updates
  useEffect(() => {
    let unsubPlayers: (() => void) | null = null;
    let unsubMatches: (() => void) | null = null;

    const init = async () => {
      // Initialize default players if needed
      await initializeDefaultPlayers();

      // Subscribe to real-time updates
      unsubPlayers = subscribeToPlayers((data) => {
        // Deduplicate players by name (keep first occurrence, which has stats)
        const uniquePlayers = data.filter((player, index, self) =>
          index === self.findIndex(p => p.name === player.name)
        );
        setPlayers(uniquePlayers);
        setLoading(false);
        setDataLoaded(true);
      });

      unsubMatches = subscribeToMatches((data) => {
        setMatches(data);
      });
    };

    init();

    return () => {
      if (unsubPlayers) unsubPlayers();
      if (unsubMatches) unsubMatches();
    };
  }, []);

  const getPlayer = useCallback((id: string) => {
    return players.find(p => p.id === id);
  }, [players]);

  const addPlayer = useCallback(async (name: string, group: "talli" | "visitor" = "visitor") => {
    return createPlayer(name, group);
  }, []);

  const updatePlayer = useCallback(async (id: string, updates: Partial<Player>) => {
    return updatePlayerDb(id, updates);
  }, []);

  const deletePlayerFn = useCallback(async (id: string) => {
    return deletePlayerDb(id);
  }, []);

  const uploadProfilePicture = useCallback(async (playerId: string, file: File) => {
    return uploadProfilePictureDb(playerId, file);
  }, []);

  const saveMatch = useCallback(async (match: Omit<MatchResult, 'id' | 'playedAt'>) => {
    return createMatch(match);
  }, []);

  const updateMatch = useCallback(async (id: string, updates: Partial<MatchResult>) => {
    return updateMatchDb(id, updates);
  }, []);

  // Helper to round to 2 decimal places
  const roundTo2 = (n: number) => Math.round(n * 100) / 100;

  const deleteMatchAndRevertStats = useCallback(async (id: string) => {
    const match = matches.find(m => m.id === id);
    if (!match) return false;

    // Revert stats for ranked matches
    if (match.isRanked) {
      const player1 = players.find(p => p.id === match.player1Id);
      const player2 = players.find(p => p.id === match.player2Id);

      if (player1) {
        const isWinner = match.winnerId === match.player1Id;
        const updates: Partial<Player> = {
          elo: roundTo2(player1.elo - match.player1EloChange),
          wins: isWinner ? Math.max(0, player1.wins - 1) : player1.wins,
          losses: !isWinner ? Math.max(0, player1.losses - 1) : player1.losses,
          legsWon: Math.max(0, player1.legsWon - match.player1Legs),
          legsLost: Math.max(0, player1.legsLost - match.player2Legs),
          oneEighties: Math.max(0, player1.oneEighties - match.player1OneEighties),
        };

        if (match.gameMode === "301") {
          updates.elo301 = roundTo2(player1.elo301 - match.player1EloChange);
          updates.wins301 = isWinner ? Math.max(0, player1.wins301 - 1) : player1.wins301;
          updates.losses301 = !isWinner ? Math.max(0, player1.losses301 - 1) : player1.losses301;
        } else if (match.gameMode === "501") {
          updates.elo501 = roundTo2(player1.elo501 - match.player1EloChange);
          updates.wins501 = isWinner ? Math.max(0, player1.wins501 - 1) : player1.wins501;
          updates.losses501 = !isWinner ? Math.max(0, player1.losses501 - 1) : player1.losses501;
        }

        await updatePlayerDb(match.player1Id, updates);
      }

      if (player2) {
        const isWinner = match.winnerId === match.player2Id;
        const updates: Partial<Player> = {
          elo: roundTo2(player2.elo - match.player2EloChange),
          wins: isWinner ? Math.max(0, player2.wins - 1) : player2.wins,
          losses: !isWinner ? Math.max(0, player2.losses - 1) : player2.losses,
          legsWon: Math.max(0, player2.legsWon - match.player2Legs),
          legsLost: Math.max(0, player2.legsLost - match.player1Legs),
          oneEighties: Math.max(0, player2.oneEighties - match.player2OneEighties),
        };

        if (match.gameMode === "301") {
          updates.elo301 = roundTo2(player2.elo301 - match.player2EloChange);
          updates.wins301 = isWinner ? Math.max(0, player2.wins301 - 1) : player2.wins301;
          updates.losses301 = !isWinner ? Math.max(0, player2.losses301 - 1) : player2.losses301;
        } else if (match.gameMode === "501") {
          updates.elo501 = roundTo2(player2.elo501 - match.player2EloChange);
          updates.wins501 = isWinner ? Math.max(0, player2.wins501 - 1) : player2.wins501;
          updates.losses501 = !isWinner ? Math.max(0, player2.losses501 - 1) : player2.losses501;
        }

        await updatePlayerDb(match.player2Id, updates);
      }
    }

    return deleteMatchDb(id);
  }, [matches, players]);

  const resetAllStats = useCallback(async () => {
    const statsReset = await resetAllPlayersStats();
    const matchesCleared = await clearAllMatches();
    return statsReset && matchesCleared;
  }, []);

  const refreshData = useCallback(async () => {
    setLoading(true);
    const [playersData, matchesData] = await Promise.all([
      fetchPlayers(),
      fetchMatches(),
    ]);
    setPlayers(playersData);
    setMatches(matchesData);
    setLoading(false);
  }, []);

  return (
    <DataContext.Provider
      value={{
        players,
        matches,
        loading,
        initialLoadComplete,
        getPlayer,
        addPlayer,
        updatePlayer,
        deletePlayer: deletePlayerFn,
        uploadProfilePicture,
        saveMatch,
        updateMatch,
        deleteMatchAndRevertStats,
        resetAllStats,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
