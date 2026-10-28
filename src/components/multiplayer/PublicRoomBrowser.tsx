'use client';

/**
 * PublicRoomBrowser — Filterable public room discovery browser.
 * Supports:
 * - Filtering by mode (Casual / Ranked), instrument (Piano / Guitar), status, availability
 * - Debounced text search
 * - Pagination
 * - Direct join flow into /room/[code]
 * - SVG icons only, no emojis
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, Search, RefreshCw, Plus, Play, Music,
  Loader2, AlertCircle, X,
} from 'lucide-react';
import { PublicRoomSummary, RoomMode } from '@/types/social';
import { InstrumentType } from '@/types/game';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

interface PublicRoomBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePublicRoom: () => void;
  onOpenAuth: () => void;
}

export const PublicRoomBrowser: React.FC<PublicRoomBrowserProps> = ({
  isOpen,
  onClose,
  onCreatePublicRoom,
  onOpenAuth,
}) => {
  const router = useRouter();
  const { user } = useAuth();

  const [rooms, setRooms]                       = useState<PublicRoomSummary[]>([]);
  const [total, setTotal]                       = useState(0);
  const [page, setPage]                         = useState(1);
  const [pageSize]                              = useState(6);
  const [isLoading, setIsLoading]               = useState(false);
  const [error, setError]                       = useState<string | null>(null);

  // Filters
  const [modeFilter, setModeFilter]             = useState<RoomMode | 'all'>('all');
  const [instrumentFilter, setInstrumentFilter] = useState<InstrumentType | 'all'>('all');
  const [waitingOnly, setWaitingOnly]           = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');

  const fetchRooms = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        mode: modeFilter,
        instrument: instrumentFilter,
        waitingOnly: waitingOnly.toString(),
      });
      if (searchQuery.trim()) {
        params.set('query', searchQuery.trim());
      }

      const res = await fetch(`/api/rooms/public?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to load public rooms');
      }

      const json = await res.json();
      setRooms(json.rooms ?? []);
      setTotal(json.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error loading rooms');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, modeFilter, instrumentFilter, waitingOnly, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      void fetchRooms();
    }, 0);
    return () => clearTimeout(timer);
  }, [isOpen, fetchRooms]);

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleJoin = (room: PublicRoomSummary) => {
    if (room.roomMode === 'ranked' && !user) {
      onOpenAuth();
      return;
    }
    onClose();
    router.push(`/room/${room.inviteCode}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[#0d0f15] border border-gray-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider">
                Public Lobbies
              </h2>
              <p className="text-[10px] sm:text-xs text-gray-400">
                Browse open gospel rooms or host your own praise session
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCreatePublicRoom}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition shadow"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Host Room</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Filters & Search Toolbar */}
        <div className="px-5 sm:px-6 py-3 border-b border-gray-800/60 bg-gray-900/30 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search room name…"
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
            {(['all', 'casual', 'ranked'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setModeFilter(m); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                  modeFilter === m ? 'bg-amber-500 text-black font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Instrument toggle */}
          <div className="flex items-center gap-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
            {(['all', 'piano', 'guitar'] as const).map((inst) => (
              <button
                key={inst}
                onClick={() => { setInstrumentFilter(inst); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg capitalize font-medium transition ${
                  instrumentFilter === inst ? 'bg-cyan-500 text-black font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                {inst}
              </button>
            ))}
          </div>

          {/* Waiting checkbox */}
          <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={waitingOnly}
              onChange={(e) => { setWaitingOnly(e.target.checked); setPage(1); }}
              className="rounded bg-gray-950 border-gray-800 text-amber-500 focus:ring-0"
            />
            <span>Waiting only</span>
          </label>

          <button
            onClick={fetchRooms}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-gray-950 border border-gray-800 text-gray-400 hover:text-white transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Room Grid */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isLoading && rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-500 text-sm">
              <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
              <p>Scanning active lobbies…</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Users className="w-12 h-12 text-gray-700" />
              <p className="text-sm font-semibold text-gray-300">No public rooms found</p>
              <p className="text-xs text-gray-500 max-w-sm">
                No open public lobbies match your filters. Host a new public room and praise together!
              </p>
              <button
                onClick={onCreatePublicRoom}
                className="mt-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition"
              >
                Host a Public Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rooms.map((room) => {
                const isRanked = room.roomMode === 'ranked';
                const hasActiveSlot = room.activePlayerCount < room.maxActivePlayers;

                return (
                  <div
                    key={room.id}
                    className="flex flex-col justify-between p-4 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-gray-700 transition space-y-3"
                  >
                    <div>
                      {/* Top badges */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                            isRanked
                              ? 'bg-rose-500/10 border-rose-500/40 text-rose-400'
                              : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                          }`}
                        >
                          {room.roomMode}
                        </span>

                        <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                          <Music className="w-3 h-3 text-cyan-400" />
                          <span className="capitalize">{room.instrument}</span>
                        </div>
                      </div>

                      {/* Room Name & Host */}
                      <h3 className="text-sm font-bold text-white truncate">{room.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Host: <span className="text-gray-200 font-semibold">{room.hostDisplayName}</span>
                      </p>
                    </div>

                    {/* Stats & Join Button */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-800/60">
                      <div className="space-y-0.5">
                        <p className="text-[11px] text-gray-400">
                          Total: <span className="font-bold text-white">{room.participantCount}/{room.maxParticipants}</span>
                        </p>
                        <p className="text-[10px] text-gray-500">
                          Active: {room.activePlayerCount}/{room.maxActivePlayers}
                          {!hasActiveSlot && ' (Spectating/Waiting)'}
                        </p>
                      </div>

                      <button
                        onClick={() => handleJoin(room)}
                        disabled={!room.canJoin}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow ${
                          room.canJoin
                            ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        {room.canJoin ? (hasActiveSlot ? 'Join Match' : 'Spectate') : 'In Match'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <footer className="flex items-center justify-between px-6 py-3 border-t border-gray-800/80 bg-gray-950/60 text-xs text-gray-400">
            <span>
              Page {page} of {totalPages} ({total} rooms)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 hover:text-white transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-lg bg-gray-900 border border-gray-800 disabled:opacity-40 hover:text-white transition"
              >
                Next
              </button>
            </div>
          </footer>
        )}
      </div>
    </div>
  );
};
