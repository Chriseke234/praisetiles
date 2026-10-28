'use client';

/**
 * NominationPanel — Players submit song nominations.
 * Max nominations enforced client-side; DB enforces via RLS.
 */

import React, { useState } from 'react';
import { Plus, Music, Trash2 } from 'lucide-react';
import { Nomination } from '@/types/room';
import { MULTIPLAYER_CONFIG } from '@/config/multiplayer';

interface NominationPanelProps {
  nominations:   Nomination[];
  currentUserId: string;
  onNominate:    (songTitle: string, artist?: string) => Promise<boolean>;
  onDelete?:     (nominationId: string) => void;
  disabled?:     boolean;
}

export const NominationPanel: React.FC<NominationPanelProps> = ({
  nominations,
  currentUserId,
  onNominate,
  disabled = false,
}) => {
  const [title, setTitle]     = useState('');
  const [artist, setArtist]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const myNomCount = nominations.filter((n) => n.userId === currentUserId).length;
  const canNominate = myNomCount < MULTIPLAYER_CONFIG.NOMINATION.MAX_PER_PLAYER
    && nominations.length < MULTIPLAYER_CONFIG.NOMINATION.MAX_TOTAL
    && !disabled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) { setLocalError('Song title is required'); return; }
    setLocalError('');
    setSubmitting(true);
    const ok = await onNominate(trimmed, artist.trim() || undefined);
    if (ok) { setTitle(''); setArtist(''); }
    setSubmitting(false);
  };

  // Group nominations by song to show vote tally potential
  const grouped = nominations.reduce<Record<string, Nomination[]>>((acc, n) => {
    const key = n.songTitle.toLowerCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {});

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Music className="w-4 h-4 text-cyan-400" />
        <h3 className="text-sm font-bold text-white">Nominate a Song</h3>
        <span className="ml-auto text-xs text-gray-500">
          {myNomCount}/{MULTIPLAYER_CONFIG.NOMINATION.MAX_PER_PLAYER} submitted
        </span>
      </div>

      {/* Nomination form */}
      {canNominate && (
        <form onSubmit={handleSubmit} className="space-y-2">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="Song title (gospel / praise / worship)…"
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500
              focus:outline-none focus:border-cyan-500 transition"
          />
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            maxLength={60}
            placeholder="Artist (optional)"
            className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-sm text-white placeholder-gray-500
              focus:outline-none focus:border-cyan-500 transition"
          />
          {localError && (
            <p className="text-xs text-rose-400">{localError}</p>
          )}
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500
              disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
          >
            <Plus className="w-4 h-4" />
            {submitting ? 'Submitting…' : 'Nominate'}
          </button>
        </form>
      )}

      {!canNominate && !disabled && (
        <p className="text-xs text-amber-400/70 italic">
          {myNomCount >= MULTIPLAYER_CONFIG.NOMINATION.MAX_PER_PLAYER
            ? `You've used all ${MULTIPLAYER_CONFIG.NOMINATION.MAX_PER_PLAYER} nominations.`
            : 'Nomination limit reached for this room.'}
        </p>
      )}

      {/* Nomination list */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {Object.values(grouped).map((group) => {
          const first = group[0];
          const isMine = group.some((n) => n.userId === currentUserId);
          return (
            <div
              key={first.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border transition
                ${isMine ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-gray-800 bg-gray-900/40'}`}
            >
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center flex-shrink-0">
                <Music className="w-4 h-4 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{first.songTitle}</p>
                {first.artist && (
                  <p className="text-xs text-gray-400 truncate">{first.artist}</p>
                )}
                <p className="text-[10px] text-gray-500 mt-0.5">
                  by {group.map((n) => n.displayName).join(', ')}
                </p>
              </div>
              {isMine && !disabled && (
                <button
                  className="text-gray-600 hover:text-rose-400 transition flex-shrink-0"
                  aria-label="Remove nomination"
                  title="Only removes your nomination"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {nominations.length === 0 && (
          <p className="text-xs text-gray-500 text-center py-4 italic">
            No nominations yet — be the first!
          </p>
        )}
      </div>
    </div>
  );
};
