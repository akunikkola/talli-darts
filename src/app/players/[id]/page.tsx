"use client";

import { useState, useEffect, use, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useData } from "@/context/DataContext";
import type { Player, MatchResult } from "@/lib/supabase-data";
import { fetchTournaments } from "@/lib/tournament-data";
import type { Tournament } from "@/types/tournament";

export default function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { players, matches, getPlayer, updatePlayer, uploadProfilePicture, loading } = useData();
  const [player, setPlayer] = useState<Player | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [entranceSong, setEntranceSong] = useState("");
  const [favoritePlayer, setFavoritePlayer] = useState("");
  const [dartsModel, setDartsModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [tournamentFilter, setTournamentFilter] = useState<"all" | "301" | "501">("all");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const p = getPlayer(id);
    if (p) {
      setPlayer(p);
      setName(p.name);
      setClub(p.club || "");
      setEntranceSong(p.entranceSong || "");
      setFavoritePlayer(p.favoritePlayer || "");
      setDartsModel(p.dartsModel || "");
    }
  }, [id, getPlayer, loading]);

  // Fetch tournaments
  useEffect(() => {
    fetchTournaments().then(setTournaments);
  }, []);

  // Get player's matches
  const playerMatches = useMemo(() => {
    if (!player) return [];
    return matches
      .filter(m => m.player1Id === player.id || m.player2Id === player.id)
      .slice(0, 20); // Last 20 matches
  }, [matches, player]);

  // Calculate ranking position
  const ranking = useMemo(() => {
    if (!player) return { overall: 0, elo301: 0, elo501: 0 };
    const sortedByOverall = [...players].sort((a, b) =>
      ((b.elo301 + b.elo501) / 2) - ((a.elo301 + a.elo501) / 2)
    );
    const sortedBy301 = [...players].sort((a, b) => b.elo301 - a.elo301);
    const sortedBy501 = [...players].sort((a, b) => b.elo501 - a.elo501);

    return {
      overall: sortedByOverall.findIndex(p => p.id === player.id) + 1,
      elo301: sortedBy301.findIndex(p => p.id === player.id) + 1,
      elo501: sortedBy501.findIndex(p => p.id === player.id) + 1,
    };
  }, [players, player]);

  // Calculate win rate
  const winRate = useMemo(() => {
    if (!player || (player.wins + player.losses) === 0) return 0;
    return Math.round((player.wins / (player.wins + player.losses)) * 100);
  }, [player]);

  // Calculate averages and visit stats from matches (excluding cricket - it uses different stats)
  const matchStats = useMemo(() => {
    if (!player) return { avg: 0, first9Avg: 0, sixtyPlus: 0, eightyPlus: 0, hundredPlus: 0, matchCount: 0, dartsThrown: 0, doublesPercent: 0 };

    // Filter out cricket matches - they store points in avg field, not actual averages
    const nonCricketMatches = playerMatches.filter(m => m.gameMode !== "cricket");

    let totalAvg = 0;
    let totalFirst9Avg = 0;
    let avgCount = 0;
    let first9Count = 0;
    let sixtyPlus = 0;
    let eightyPlus = 0;
    let hundredPlus = 0;
    let dartsThrown = 0;
    let doubleAttempts = 0;
    let doubleHits = 0;

    nonCricketMatches.forEach(match => {
      const isPlayer1 = match.player1Id === player.id;
      const avg = isPlayer1 ? match.player1Avg : match.player2Avg;
      const first9 = isPlayer1 ? match.player1First9Avg : match.player2First9Avg;
      const sixty = isPlayer1 ? match.player1SixtyPlus : match.player2SixtyPlus;
      const eighty = isPlayer1 ? match.player1EightyPlus : match.player2EightyPlus;
      const hundred = isPlayer1 ? match.player1HundredPlus : match.player2HundredPlus;
      const darts = isPlayer1 ? match.player1Darts : match.player2Darts;
      const attempts = isPlayer1 ? match.player1DoubleAttempts : match.player2DoubleAttempts;
      const hits = isPlayer1 ? match.player1DoubleHits : match.player2DoubleHits;

      if (avg && avg > 0) {
        totalAvg += avg;
        avgCount++;
      }
      if (first9 && first9 > 0) {
        totalFirst9Avg += first9;
        first9Count++;
      }
      sixtyPlus += sixty || 0;
      eightyPlus += eighty || 0;
      hundredPlus += hundred || 0;
      dartsThrown += darts || 0;
      doubleAttempts += attempts || 0;
      doubleHits += hits || 0;
    });

    return {
      avg: avgCount > 0 ? totalAvg / avgCount : 0,
      first9Avg: first9Count > 0 ? totalFirst9Avg / first9Count : 0,
      sixtyPlus,
      eightyPlus,
      hundredPlus,
      matchCount: nonCricketMatches.length,
      dartsThrown,
      doublesPercent: doubleAttempts > 0 ? (doubleHits / doubleAttempts) * 100 : 0,
    };
  }, [player, playerMatches]);

  // Calculate cricket stats
  const cricketStats = useMemo(() => {
    if (!player) return { wins: 0, losses: 0, played: 0, winRate: 0 };

    const cricketMatches = matches.filter(m =>
      m.gameMode === "cricket" &&
      (m.player1Id === player.id || m.player2Id === player.id)
    );

    const wins = cricketMatches.filter(m => m.winnerId === player.id).length;
    const played = cricketMatches.length;
    const losses = played - wins;
    const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;

    return { wins, losses, played, winRate };
  }, [player, matches]);

  // Get player's tournament history
  const playerTournaments = useMemo(() => {
    if (!player) return [];
    return tournaments.filter(t => {
      // Check if player is in bracket
      const inBracket = t.bracket?.some(m =>
        m.player1?.id === player.id || m.player2?.id === player.id
      );
      // Check if player is in groups
      const inGroups = t.groups?.some(g =>
        g.players.some(p => p.id === player.id)
      );
      return inBracket || inGroups;
    });
  }, [player, tournaments]);

  // Filter tournaments by game mode
  const filteredTournaments = useMemo(() => {
    if (tournamentFilter === "all") return playerTournaments;
    return playerTournaments.filter(t => t.gameMode === tournamentFilter);
  }, [playerTournaments, tournamentFilter]);

  // Calculate tournament trophies
  const trophies = useMemo(() => {
    if (!player) return { gold: 0, silver: 0, bronze: 0 };
    return {
      gold: tournaments.filter(t => t.winnerId === player.id).length,
      silver: tournaments.filter(t => t.secondPlaceId === player.id).length,
      bronze: tournaments.filter(t => t.thirdPlaceId === player.id).length,
    };
  }, [player, tournaments]);

  const handleSave = async () => {
    if (!player || !name.trim()) return;

    setIsSaving(true);
    await updatePlayer(player.id, {
      name: name.trim(),
      club: club.trim(),
      entranceSong: entranceSong.trim(),
      favoritePlayer: favoritePlayer.trim(),
      dartsModel: dartsModel.trim(),
    });

    setPlayer(prev => prev ? { ...prev, name: name.trim(), club: club.trim() } : null);
    setShowEditModal(false);
    setIsSaving(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !player) return;

    setIsUploadingImage(true);
    const url = await uploadProfilePicture(player.id, file);
    if (url) {
      setPlayer(prev => prev ? { ...prev, profilePictureUrl: url } : null);
    }
    setIsUploadingImage(false);

    // Reset the input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatDateTime = (match: MatchResult) => {
    // Use startedAt if available, otherwise fall back to playedAt
    const date = match.startedAt ? new Date(match.startedAt) : new Date(match.playedAt);
    const dateStr = date.toLocaleDateString("fi-FI", { day: "2-digit", month: "2-digit" });
    const timeStr = date.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" });
    return `${dateStr} ${timeStr}`;
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a]">
      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
          <div className="bg-[#2a2a2a] rounded-2xl w-full max-w-md max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-[#333] flex items-center justify-between">
              <h3 className="text-white font-bold text-lg">Edit Profile</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-slate-400 text-sm mb-2">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Club</label>
                <input
                  type="text"
                  value={club}
                  onChange={(e) => setClub(e.target.value)}
                  placeholder="e.g., Talli Darts"
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Entrance Song</label>
                <input
                  type="text"
                  value={entranceSong}
                  onChange={(e) => setEntranceSong(e.target.value)}
                  placeholder="e.g., Eye of the Tiger"
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Favorite Player</label>
                <input
                  type="text"
                  value={favoritePlayer}
                  onChange={(e) => setFavoritePlayer(e.target.value)}
                  placeholder="e.g., Michael van Gerwen"
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
                />
              </div>
              <div>
                <label className="block text-slate-400 text-sm mb-2">Darts Model</label>
                <input
                  type="text"
                  value={dartsModel}
                  onChange={(e) => setDartsModel(e.target.value)}
                  placeholder="e.g., Target Power 9Five"
                  className="w-full px-4 py-3 bg-[#1a1a1a] rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
                />
              </div>
            </div>
            <div className="p-4 border-t border-[#333]">
              <button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="w-full py-3 bg-[#4ade80] hover:bg-[#22c55e] disabled:bg-[#333] text-black disabled:text-slate-500 rounded-xl font-semibold"
              >
                {isSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="py-4 px-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="text-slate-400 p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-white font-bold text-xl">Player Profile</h1>
        <button onClick={() => setShowEditModal(true)} className="text-slate-400 hover:text-white p-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />

      {/* Player Header */}
      <div className="px-4 pb-4">
        <div className="bg-[#2a2a2a] rounded-2xl p-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingImage}
              className="relative w-20 h-20 rounded-lg overflow-hidden group"
            >
              {player.profilePictureUrl ? (
                <Image
                  src={player.profilePictureUrl}
                  alt={player.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#4ade80] flex items-center justify-center text-3xl font-bold text-black">
                  {player.name.charAt(0)}
                </div>
              )}
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {isUploadingImage ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </div>
            </button>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{player.name}</h2>
              {player.club && (
                <p className="text-[#4ade80] text-sm">{player.club}</p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-slate-400 text-sm">#{ranking.overall} Overall</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="px-4 pb-4">
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-[#2a2a2a] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{player.elo.toFixed(0)}</p>
            <p className="text-xs text-slate-400">ELO</p>
          </div>
          <div className="bg-[#2a2a2a] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#4ade80]">{player.wins}</p>
            <p className="text-xs text-slate-400">Wins</p>
          </div>
          <div className="bg-[#2a2a2a] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-[#e85d3b]">{player.losses}</p>
            <p className="text-xs text-slate-400">Losses</p>
          </div>
          <div className="bg-[#2a2a2a] rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-white">{winRate}%</p>
            <p className="text-xs text-slate-400">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Detailed Stats */}
      <div className="px-4 pb-4">
        <div className="bg-[#2a2a2a] rounded-xl p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">301 ELO</span>
              <span className="text-white font-semibold">{player.elo301.toFixed(2)} <span className="text-slate-500 text-xs">#{ranking.elo301}</span></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">501 ELO</span>
              <span className="text-white font-semibold">{player.elo501.toFixed(2)} <span className="text-slate-500 text-xs">#{ranking.elo501}</span></span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">180s</span>
              <span className="text-[#f5a623] font-semibold">{player.oneEighties}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Best Checkout</span>
              <span className="text-[#f5a623] font-semibold">{player.highestCheckout || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Legs Won</span>
              <span className="text-white font-semibold">{player.legsWon}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Legs Lost</span>
              <span className="text-white font-semibold">{player.legsLost}</span>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#333] my-4" />

          {/* Averages & Visits */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Avg</span>
              <span className="text-white font-semibold">{matchStats.avg > 0 ? matchStats.avg.toFixed(1) : "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">First 9 Avg</span>
              <span className="text-white font-semibold">{matchStats.first9Avg > 0 ? matchStats.first9Avg.toFixed(1) : "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Doubles%</span>
              <span className="text-white font-semibold">{matchStats.doublesPercent > 0 ? matchStats.doublesPercent.toFixed(1) + "%" : "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Darts</span>
              <span className="text-white font-semibold">{matchStats.dartsThrown || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">100+</span>
              <span className="text-white font-semibold">{matchStats.hundredPlus || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">80+</span>
              <span className="text-white font-semibold">{matchStats.eightyPlus || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">60+</span>
              <span className="text-white font-semibold">{matchStats.sixtyPlus || "-"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm">Matches</span>
              <span className="text-white font-semibold">{matchStats.matchCount}</span>
            </div>
          </div>

          {/* Cricket Stats - only show if player has cricket matches */}
          {cricketStats.played > 0 && (
            <>
              <div className="border-t border-[#333] my-4" />
              <p className="text-slate-400 text-xs mb-3 uppercase tracking-wide">Cricket</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Wins</span>
                  <span className="text-[#4ade80] font-semibold">{cricketStats.wins}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Losses</span>
                  <span className="text-[#e85d3b] font-semibold">{cricketStats.losses}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Win Rate</span>
                  <span className="text-white font-semibold">{cricketStats.winRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">Played</span>
                  <span className="text-white font-semibold">{cricketStats.played}</span>
                </div>
              </div>
            </>
          )}

          {/* Divider */}
          <div className="border-t border-[#333] my-4" />

          {/* Trophies */}
          <div className="flex justify-around items-center">
            <div className="text-center">
              <div className="text-2xl">🥇</div>
              <p className="text-white font-bold text-lg">{trophies.gold}</p>
              <p className="text-slate-500 text-xs">1st</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">🥈</div>
              <p className="text-white font-bold text-lg">{trophies.silver}</p>
              <p className="text-slate-500 text-xs">2nd</p>
            </div>
            <div className="text-center">
              <div className="text-2xl">🥉</div>
              <p className="text-white font-bold text-lg">{trophies.bronze}</p>
              <p className="text-slate-500 text-xs">3rd</p>
            </div>
          </div>
        </div>
      </div>

      {/* Match History */}
      <div className="px-4 pb-4">
        <h3 className="text-white font-semibold mb-3">Match History</h3>
        {playerMatches.length === 0 ? (
          <div className="bg-[#2a2a2a] rounded-xl p-6 text-center">
            <p className="text-slate-500">No matches played yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {playerMatches.map((match) => {
              const isPlayer1 = match.player1Id === player.id;
              const isWinner = match.winnerId === player.id;
              const opponent = isPlayer1 ? match.player2Name : match.player1Name;
              const playerLegs = isPlayer1 ? match.player1Legs : match.player2Legs;
              const opponentLegs = isPlayer1 ? match.player2Legs : match.player1Legs;
              const eloChange = isPlayer1 ? match.player1EloChange : match.player2EloChange;

              return (
                <Link
                  key={match.id}
                  href={`/matches/${match.id}`}
                  className="block bg-[#2a2a2a] rounded-xl p-3 hover:bg-[#333] transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-20 text-slate-500 text-xs" suppressHydrationWarning>
                      {formatDateTime(match)}
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-white font-medium">{player.name}</span>
                      <span className="text-slate-500 text-sm">vs</span>
                      <span className="text-slate-400">{opponent}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold">
                        {playerLegs} - {opponentLegs}
                      </span>
                      <span
                        className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold ${
                          isWinner
                            ? "bg-[#4ade80] text-black"
                            : "bg-[#e85d3b] text-white"
                        }`}
                      >
                        {isWinner ? "W" : "L"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-1 ml-20">
                    <span className="text-xs text-slate-500">{match.gameMode}</span>
                    <span className="text-xs text-slate-600">•</span>
                    <span className={`text-xs ${match.isRanked ? "text-[#4ade80]" : "text-[#f5a623]"}`}>
                      {match.isRanked ? "Ranked" : "Practice"}
                    </span>
                    {match.isRanked && (
                      <>
                        <span className="text-xs text-slate-600">•</span>
                        <span className={`text-xs font-medium ${eloChange >= 0 ? "text-[#4ade80]" : "text-red-400"}`}>
                          {eloChange >= 0 ? "+" : ""}{eloChange.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Tournament History */}
      <div className="px-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-semibold">Tournament History</h3>
          {playerTournaments.length > 0 && (
            <div className="flex gap-1 bg-[#2a2a2a] rounded-lg p-1">
              {(["all", "301", "501"] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setTournamentFilter(filter)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    tournamentFilter === filter
                      ? "bg-[#4ade80] text-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {filter === "all" ? "All" : filter}
                </button>
              ))}
            </div>
          )}
        </div>
        {filteredTournaments.length === 0 ? (
          <div className="bg-[#2a2a2a] rounded-xl p-6 text-center">
            <p className="text-slate-500">
              {playerTournaments.length === 0
                ? "No tournaments played yet"
                : `No ${tournamentFilter} tournaments`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTournaments.map((tournament) => {
              const isWinner = tournament.winnerId === player.id;
              const isSecond = tournament.secondPlaceId === player.id;
              const isThird = tournament.thirdPlaceId === player.id;
              const placement = isWinner ? "1st" : isSecond ? "2nd" : isThird ? "3rd" : "-";
              const trophy = isWinner ? "🥇" : isSecond ? "🥈" : isThird ? "🥉" : "";

              return (
                <Link
                  key={tournament.id}
                  href={`/play/tournament/${tournament.id}`}
                  className="block bg-[#2a2a2a] rounded-xl p-3 hover:bg-[#333] transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{tournament.name}</span>
                        {trophy && <span>{trophy}</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-slate-500">{tournament.gameMode}</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500 capitalize">{tournament.format.replace("_", "-")}</span>
                        <span className="text-xs text-slate-600">•</span>
                        <span className="text-xs text-slate-500">{tournament.playerCount} players</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        isWinner ? "text-[#f5a623]" : isSecond ? "text-slate-300" : isThird ? "text-[#cd7f32]" : "text-slate-500"
                      }`}>
                        {placement}
                      </span>
                      <p className="text-xs text-slate-500 mt-1">
                        {tournament.status === "completed" ? "Completed" : "In Progress"}
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
