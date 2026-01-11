"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getPlayer, updatePlayer, type Player } from "@/lib/players";

export default function EditPlayer({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const [player, setPlayer] = useState<Player | null>(null);
  const [name, setName] = useState("");
  const [club, setClub] = useState("");
  const [entranceSong, setEntranceSong] = useState("");
  const [favoritePlayer, setFavoritePlayer] = useState("");
  const [dartsModel, setDartsModel] = useState("");
  const [isSaving, setIsSaving] = useState(false);

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
  }, [id]);

  const handleSave = () => {
    if (!player || !name.trim()) return;

    setIsSaving(true);
    updatePlayer(player.id, {
      name: name.trim(),
      club: club.trim(),
      entranceSong: entranceSong.trim(),
      favoritePlayer: favoritePlayer.trim(),
      dartsModel: dartsModel.trim(),
    });

    router.push("/players");
  };

  if (!player) {
    return (
      <div className="min-h-screen bg-[#1a1a1a] flex items-center justify-center">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col">
      {/* Header */}
      <div className="py-4 px-4 flex items-center">
        <Link href="/players" className="text-slate-400 p-2">
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
        <h1 className="flex-1 text-center text-white font-bold text-xl">
          Edit Player
        </h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-auto px-4 pb-4">
        {/* Player Stats (Read Only) */}
        <div className="bg-[#2a2a2a] rounded-xl p-4 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{player.elo.toFixed(2)}</p>
              <p className="text-xs text-slate-400">Overall ELO</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#4ade80]">{player.wins}</p>
              <p className="text-xs text-slate-400">Wins</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-[#e85d3b]">{player.losses}</p>
              <p className="text-xs text-slate-400">Losses</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 text-center">
            <div>
              <p className="text-lg font-bold text-white">{player.elo301.toFixed(2)}</p>
              <p className="text-xs text-slate-400">301 ELO</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{player.elo501.toFixed(2)}</p>
              <p className="text-xs text-slate-400">501 ELO</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4 text-center">
            <div>
              <p className="text-lg font-bold text-[#f5a623]">
                {player.highestCheckout || "-"}
              </p>
              <p className="text-xs text-slate-400">Highest Checkout</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#f5a623]">
                {player.oneEighties}
              </p>
              <p className="text-xs text-slate-400">180s</p>
            </div>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-slate-400 text-sm mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-[#2a2a2a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80]"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">Club</label>
            <input
              type="text"
              value={club}
              onChange={(e) => setClub(e.target.value)}
              placeholder="e.g., Talli Darts"
              className="w-full px-4 py-3 bg-[#2a2a2a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">
              Entrance Song
            </label>
            <input
              type="text"
              value={entranceSong}
              onChange={(e) => setEntranceSong(e.target.value)}
              placeholder="e.g., Eye of the Tiger"
              className="w-full px-4 py-3 bg-[#2a2a2a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">
              Favorite Player
            </label>
            <input
              type="text"
              value={favoritePlayer}
              onChange={(e) => setFavoritePlayer(e.target.value)}
              placeholder="e.g., Michael van Gerwen"
              className="w-full px-4 py-3 bg-[#2a2a2a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-2">
              Darts Model
            </label>
            <input
              type="text"
              value={dartsModel}
              onChange={(e) => setDartsModel(e.target.value)}
              placeholder="e.g., Target Power 9Five Gen 5"
              className="w-full px-4 py-3 bg-[#2a2a2a] rounded-xl text-white text-lg focus:outline-none focus:ring-2 focus:ring-[#4ade80] placeholder:text-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4">
        <button
          onClick={handleSave}
          disabled={!name.trim() || isSaving}
          className={`w-full py-4 rounded-xl text-xl font-semibold transition-colors ${
            name.trim() && !isSaving
              ? "bg-[#4ade80] hover:bg-[#22c55e] text-black"
              : "bg-[#333] text-slate-500 cursor-not-allowed"
          }`}
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
