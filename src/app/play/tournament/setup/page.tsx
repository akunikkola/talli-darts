"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useData } from "@/context/DataContext";
import PlayerAvatar from "@/components/PlayerAvatar";
import { isTestPlayer } from "@/lib/test-players";
import { createTournament } from "@/lib/tournament-data";
import type { TournamentFormat, TournamentSetupData } from "@/types/tournament";

type Step = "format" | "gameMode" | "players" | "config" | "preview";

export default function TournamentSetupPage() {
  const router = useRouter();
  const { players, addPlayer } = useData();

  const [step, setStep] = useState<Step>("format");
  const [format, setFormat] = useState<TournamentFormat>("cup");
  const [name, setName] = useState("");
  const [gameMode, setGameMode] = useState<"301" | "501">("501");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [groupCount, setGroupCount] = useState<2 | 4>(2);
  const [bronzeMatch, setBronzeMatch] = useState(false);
  const [legsConfig, setLegsConfig] = useState({
    groupStage: 1,
    quarterfinal: 1,
    semifinal: 2,
    final: 3,
    bronze: 1,
  });
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Filter out test players and sort by ELO
  const availablePlayers = useMemo(() => {
    return players
      .filter((p) => !isTestPlayer(p.name))
      .sort((a, b) => {
        const avgA = (a.elo301 + a.elo501) / 2;
        const avgB = (b.elo301 + b.elo501) / 2;
        return avgB - avgA;
      });
  }, [players]);

  const selectedPlayers = useMemo(() => {
    return selectedPlayerIds
      .map((id) => availablePlayers.find((p) => p.id === id))
      .filter((p): p is NonNullable<typeof p> => p !== undefined);
  }, [selectedPlayerIds, availablePlayers]);

  // Calculate bracket size based on player count
  const bracketSize = useMemo(() => {
    const count = selectedPlayerIds.length;
    if (count <= 4) return 4;
    if (count <= 8) return 8;
    return 16;
  }, [selectedPlayerIds.length]);

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim() || isAddingPlayer) return;

    setIsAddingPlayer(true);
    try {
      const newPlayer = await addPlayer(newPlayerName.trim());
      if (newPlayer) {
        // Auto-select the newly added player
        setSelectedPlayerIds((prev) => [...prev, newPlayer.id]);
        setNewPlayerName("");
        setShowAddPlayer(false);
      }
    } catch (error) {
      console.error("Failed to add player:", error);
    } finally {
      setIsAddingPlayer(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case "format":
        return name.trim().length > 0;
      case "gameMode":
        return true;
      case "players":
        if (format === "cup") {
          return selectedPlayerIds.length >= 3;
        } else {
          return selectedPlayerIds.length >= 4;
        }
      case "config":
        return true;
      case "preview":
        return true;
      default:
        return false;
    }
  };

  const getMinPlayers = () => (format === "cup" ? 3 : 4);

  const nextStep = () => {
    switch (step) {
      case "format":
        setStep("gameMode");
        break;
      case "gameMode":
        setStep("players");
        break;
      case "players":
        setStep("config");
        break;
      case "config":
        setStep("preview");
        break;
      case "preview":
        handleStart();
        break;
    }
  };

  const prevStep = () => {
    switch (step) {
      case "gameMode":
        setStep("format");
        break;
      case "players":
        setStep("gameMode");
        break;
      case "config":
        setStep("players");
        break;
      case "preview":
        setStep("config");
        break;
    }
  };

  const handleStart = async () => {
    if (isCreating) return;

    setIsCreating(true);
    setCreateError("");

    const setupData: TournamentSetupData = {
      name: name.trim(),
      format,
      gameMode,
      playerIds: selectedPlayerIds,
      bracketSize: format === "cup" ? bracketSize : undefined,
      groupCount: format === "round_robin" ? groupCount : undefined,
      bronzeMatchEnabled: bronzeMatch,
      legsConfig,
    };

    try {
      const tournament = await createTournament(setupData, players);
      if (tournament) {
        router.push(`/play/tournament/${tournament.id}`);
      } else {
        setCreateError("Failed to create tournament. Please try again.");
      }
    } catch (error) {
      console.error("Error creating tournament:", error);
      setCreateError("An error occurred. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Generate bracket preview for cup format
  const generateBracketPreview = () => {
    const sorted = [...selectedPlayers];
    const seeds: { player: (typeof sorted)[0] | undefined; seed: number }[] = [];

    for (let i = 0; i < bracketSize; i++) {
      if (i < sorted.length) {
        seeds.push({ player: sorted[i], seed: i + 1 });
      } else {
        seeds.push({ player: undefined, seed: i + 1 });
      }
    }

    // Seeding pattern for bracket
    const matchups: { seed1: number; seed2: number }[] = [];
    if (bracketSize === 4) {
      matchups.push({ seed1: 1, seed2: 4 }, { seed1: 2, seed2: 3 });
    } else if (bracketSize === 8) {
      matchups.push(
        { seed1: 1, seed2: 8 },
        { seed1: 4, seed2: 5 },
        { seed1: 3, seed2: 6 },
        { seed1: 2, seed2: 7 }
      );
    } else {
      // 16-player bracket
      matchups.push(
        { seed1: 1, seed2: 16 },
        { seed1: 8, seed2: 9 },
        { seed1: 5, seed2: 12 },
        { seed1: 4, seed2: 13 },
        { seed1: 3, seed2: 14 },
        { seed1: 6, seed2: 11 },
        { seed1: 7, seed2: 10 },
        { seed1: 2, seed2: 15 }
      );
    }

    return matchups.map((m) => ({
      player1: seeds.find((s) => s.seed === m.seed1),
      player2: seeds.find((s) => s.seed === m.seed2),
    }));
  };

  // Generate group preview for round-robin format
  const generateGroupPreview = () => {
    const sorted = [...selectedPlayers];
    const groups: (typeof sorted[0])[][] = Array.from(
      { length: groupCount },
      () => []
    );

    // Snake draft by ELO
    sorted.forEach((player, index) => {
      const round = Math.floor(index / groupCount);
      const groupIndex =
        round % 2 === 0 ? index % groupCount : groupCount - 1 - (index % groupCount);
      groups[groupIndex].push(player);
    });

    return groups;
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] p-4">
      {/* Header */}
      <div className="flex items-center mb-6">
        <Link href="/" className="text-slate-400 hover:text-white mr-4">
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-white">Tournament Setup</h1>
      </div>

      {/* Progress indicator */}
      <div className="flex justify-center gap-2 mb-8">
        {["format", "gameMode", "players", "config", "preview"].map((s) => (
          <div
            key={s}
            className={`w-2 h-2 rounded-full ${
              s === step ? "bg-[#4ade80]" : "bg-[#333]"
            }`}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="mb-8">
        {step === "format" && (
          <div className="space-y-6">
            <div>
              <label className="text-white font-semibold mb-3 block">
                Tournament Format
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#2a2a2a] rounded-xl p-1">
                <button
                  onClick={() => setFormat("cup")}
                  className={`py-3 rounded-lg font-semibold transition-colors ${
                    format === "cup"
                      ? "bg-[#4ade80] text-black"
                      : "text-white hover:bg-[#333]"
                  }`}
                >
                  Cup
                </button>
                <button
                  onClick={() => setFormat("round_robin")}
                  className={`py-3 rounded-lg font-semibold transition-colors ${
                    format === "round_robin"
                      ? "bg-[#4ade80] text-black"
                      : "text-white hover:bg-[#333]"
                  }`}
                >
                  Round-Robin
                </button>
              </div>
              <p className="text-slate-500 text-sm mt-2">
                {format === "cup"
                  ? "Single-elimination bracket seeded by ELO"
                  : "Group stage, then knockout rounds"}
              </p>
            </div>

            <div>
              <label className="text-white font-semibold mb-3 block">
                Tournament Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Friday Night Cup"
                className="w-full px-4 py-3 bg-[#2a2a2a] text-white rounded-xl border border-[#333] focus:border-[#4ade80] focus:outline-none"
              />
            </div>
          </div>
        )}

        {step === "gameMode" && (
          <div>
            <label className="text-white font-semibold mb-3 block">
              Game Mode
            </label>
            <div className="grid grid-cols-2 gap-2 bg-[#2a2a2a] rounded-xl p-1">
              <button
                onClick={() => setGameMode("301")}
                className={`py-3 rounded-lg font-semibold transition-colors ${
                  gameMode === "301"
                    ? "bg-[#4ade80] text-black"
                    : "text-white hover:bg-[#333]"
                }`}
              >
                301
              </button>
              <button
                onClick={() => setGameMode("501")}
                className={`py-3 rounded-lg font-semibold transition-colors ${
                  gameMode === "501"
                    ? "bg-[#4ade80] text-black"
                    : "text-white hover:bg-[#333]"
                }`}
              >
                501
              </button>
            </div>
          </div>
        )}

        {step === "players" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-white font-semibold">
                Select Players ({selectedPlayerIds.length})
              </label>
              <span className="text-slate-500 text-sm">
                Min: {getMinPlayers()} players
              </span>
            </div>

            {/* Add Player Section */}
            {showAddPlayer ? (
              <div className="bg-[#2a2a2a] rounded-xl p-4 mb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder="Player name"
                    className="flex-1 px-4 py-2 bg-[#1a1a1a] text-white rounded-lg border border-[#333] focus:border-[#4ade80] focus:outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddPlayer();
                      if (e.key === "Escape") {
                        setShowAddPlayer(false);
                        setNewPlayerName("");
                      }
                    }}
                  />
                  <button
                    onClick={handleAddPlayer}
                    disabled={!newPlayerName.trim() || isAddingPlayer}
                    className="px-4 py-2 bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-[#333] disabled:text-slate-500 text-black font-semibold rounded-lg transition-colors"
                  >
                    {isAddingPlayer ? "..." : "Add"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddPlayer(false);
                      setNewPlayerName("");
                    }}
                    className="px-3 py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddPlayer(true)}
                className="w-full mb-3 py-3 bg-[#2a2a2a] hover:bg-[#333] text-slate-400 hover:text-white rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add New Player
              </button>
            )}

            <div className="bg-[#2a2a2a] rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
              {availablePlayers.map((player, index) => {
                const isSelected = selectedPlayerIds.includes(player.id);
                const avgElo = ((player.elo301 + player.elo501) / 2).toFixed(0);

                return (
                  <button
                    key={player.id}
                    onClick={() => togglePlayer(player.id)}
                    className={`w-full flex items-center px-4 py-3 border-b border-[#333] last:border-b-0 transition-colors ${
                      isSelected ? "bg-[#4ade80]/20" : "hover:bg-[#333]"
                    }`}
                  >
                    <span className="w-6 text-center text-slate-500 text-sm">
                      {index + 1}
                    </span>
                    <PlayerAvatar
                      name={player.name}
                      profilePictureUrl={player.profilePictureUrl}
                      size="sm"
                      className="ml-3"
                    />
                    <span className="flex-1 ml-3 text-white text-left">
                      {player.name}
                    </span>
                    <span className="text-slate-400 text-sm mr-3">
                      {avgElo} ELO
                    </span>
                    <div
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? "border-[#4ade80] bg-[#4ade80]"
                          : "border-[#444]"
                      }`}
                    >
                      {isSelected && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4 text-black"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === "config" && (
          <div className="space-y-6">
            {format === "round_robin" && (
              <div>
                <label className="text-white font-semibold mb-3 block">
                  Number of Groups
                </label>
                <div className="grid grid-cols-2 gap-2 bg-[#2a2a2a] rounded-xl p-1">
                  <button
                    onClick={() => setGroupCount(2)}
                    className={`py-3 rounded-lg font-semibold transition-colors ${
                      groupCount === 2
                        ? "bg-[#4ade80] text-black"
                        : "text-white hover:bg-[#333]"
                    }`}
                  >
                    2 Groups
                  </button>
                  <button
                    onClick={() => setGroupCount(4)}
                    className={`py-3 rounded-lg font-semibold transition-colors ${
                      groupCount === 4
                        ? "bg-[#4ade80] text-black"
                        : "text-white hover:bg-[#333]"
                    }`}
                  >
                    4 Groups
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <label className="text-white font-semibold block">
                Legs per Round
              </label>

              {format === "round_robin" && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Group Stage</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setLegsConfig((c) => ({
                          ...c,
                          groupStage: Math.max(1, c.groupStage - 1),
                        }))
                      }
                      className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                    >
                      -
                    </button>
                    <span className="text-white w-8 text-center">
                      {legsConfig.groupStage}
                    </span>
                    <button
                      onClick={() =>
                        setLegsConfig((c) => ({
                          ...c,
                          groupStage: Math.min(5, c.groupStage + 1),
                        }))
                      }
                      className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {format === "cup" && bracketSize >= 8 && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Quarterfinals</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() =>
                        setLegsConfig((c) => ({
                          ...c,
                          quarterfinal: Math.max(1, c.quarterfinal - 1),
                        }))
                      }
                      className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                    >
                      -
                    </button>
                    <span className="text-white w-8 text-center">
                      {legsConfig.quarterfinal}
                    </span>
                    <button
                      onClick={() =>
                        setLegsConfig((c) => ({
                          ...c,
                          quarterfinal: Math.min(5, c.quarterfinal + 1),
                        }))
                      }
                      className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Semifinals</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        semifinal: Math.max(1, c.semifinal - 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    -
                  </button>
                  <span className="text-white w-8 text-center">
                    {legsConfig.semifinal}
                  </span>
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        semifinal: Math.min(5, c.semifinal + 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-400">Final</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        final: Math.max(1, c.final - 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    -
                  </button>
                  <span className="text-white w-8 text-center">
                    {legsConfig.final}
                  </span>
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        final: Math.min(5, c.final + 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-[#333]">
              <div>
                <span className="text-white">Bronze Match</span>
                <p className="text-slate-500 text-sm">3rd place playoff</p>
              </div>
              <button
                onClick={() => setBronzeMatch(!bronzeMatch)}
                className={`w-12 h-7 rounded-full transition-colors ${
                  bronzeMatch ? "bg-[#4ade80]" : "bg-[#333]"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    bronzeMatch ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            {bronzeMatch && (
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Bronze Match Legs</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        bronze: Math.max(1, c.bronze - 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    -
                  </button>
                  <span className="text-white w-8 text-center">
                    {legsConfig.bronze}
                  </span>
                  <button
                    onClick={() =>
                      setLegsConfig((c) => ({
                        ...c,
                        bronze: Math.min(5, c.bronze + 1),
                      }))
                    }
                    className="w-8 h-8 rounded-full bg-[#333] text-white hover:bg-[#444]"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div>
            <div className="bg-[#2a2a2a] rounded-xl p-4 mb-6">
              <h3 className="text-white font-semibold mb-2">{name}</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="px-2 py-1 bg-[#333] text-slate-300 rounded">
                  {format === "cup" ? "Cup" : "Round-Robin"}
                </span>
                <span className="px-2 py-1 bg-[#333] text-slate-300 rounded">
                  {gameMode}
                </span>
                <span className="px-2 py-1 bg-[#333] text-slate-300 rounded">
                  {selectedPlayerIds.length} players
                </span>
                {format === "round_robin" && (
                  <span className="px-2 py-1 bg-[#333] text-slate-300 rounded">
                    {groupCount} groups
                  </span>
                )}
              </div>
            </div>

            {format === "cup" && (
              <div>
                <h3 className="text-white font-semibold mb-3">
                  First Round Matchups
                </h3>
                <div className="space-y-2">
                  {generateBracketPreview().map((matchup, index) => (
                    <div
                      key={index}
                      className="bg-[#2a2a2a] rounded-xl p-3 flex items-center"
                    >
                      <div className="flex-1 flex items-center">
                        {matchup.player1?.player ? (
                          <>
                            <span className="text-slate-500 text-sm w-6">
                              ({matchup.player1.seed})
                            </span>
                            <span className="text-white ml-2">
                              {matchup.player1.player.name}
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">BYE</span>
                        )}
                      </div>
                      <span className="text-slate-500 mx-3">vs</span>
                      <div className="flex-1 flex items-center justify-end">
                        {matchup.player2?.player ? (
                          <>
                            <span className="text-white mr-2">
                              {matchup.player2.player.name}
                            </span>
                            <span className="text-slate-500 text-sm w-6">
                              ({matchup.player2.seed})
                            </span>
                          </>
                        ) : (
                          <span className="text-slate-500">BYE</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {format === "round_robin" && (
              <div>
                <h3 className="text-white font-semibold mb-3">Groups</h3>
                <div className="grid grid-cols-2 gap-3">
                  {generateGroupPreview().map((group, groupIndex) => (
                    <div key={groupIndex} className="bg-[#2a2a2a] rounded-xl p-3">
                      <h4 className="text-slate-400 text-sm mb-2">
                        Group {String.fromCharCode(65 + groupIndex)}
                      </h4>
                      <div className="space-y-1">
                        {group.map((player, playerIndex) => (
                          <div
                            key={player?.id || playerIndex}
                            className="text-white text-sm"
                          >
                            {player?.name || "TBD"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {createError && (
              <p className="text-red-400 text-sm text-center mt-4">{createError}</p>
            )}
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex gap-3">
        {step !== "format" && (
          <button
            onClick={prevStep}
            className="flex-1 py-4 bg-[#2a2a2a] hover:bg-[#333] text-white rounded-xl transition-colors"
          >
            Back
          </button>
        )}
        <button
          onClick={nextStep}
          disabled={!canProceed() || isCreating}
          className={`flex-1 py-4 rounded-xl font-semibold transition-colors ${
            step === "preview"
              ? canProceed() && !isCreating
                ? "bg-[#4ade80] hover:bg-[#22c55e] text-black"
                : "bg-[#333] text-slate-500"
              : canProceed()
              ? "bg-[#2a2a2a] hover:bg-[#333] text-white"
              : "bg-[#333] text-slate-500"
          }`}
        >
          {step === "preview"
            ? isCreating
              ? "Creating..."
              : "Start Tournament"
            : "Next"}
        </button>
      </div>
    </div>
  );
}
