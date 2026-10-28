'use client';

/**
 * MultiplayerModal — Create or Join a private room.
 * Shown from MainMenu when user clicks "Multiplayer".
 * Requires authentication; shows sign-in prompt for guests.
 */

import React, { useState } from 'react';
import { X, Plus, LogIn, Lock, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { InstrumentType } from '@/types/game';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface MultiplayerModalProps {
  isOpen:     boolean;
  onClose:    () => void;
  onOpenAuth: () => void;
}

type ModalView = 'main' | 'create' | 'join';

const INSTRUMENT_OPTIONS: { value: InstrumentType; label: string; desc: string }[] = [
  { value: 'piano', label: 'Piano Tiles', desc: 'Falling neon keys' },
  { value: 'guitar', label: 'Guitar Tiles', desc: 'Arcade fretboard' },
];

export const MultiplayerModal: React.FC<MultiplayerModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const { user, isSupabaseAvailable } = useAuth();
  const router = useRouter();

  const [view, setView]             = useState<ModalView>('main');
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [joinCode, setJoinCode]     = useState('');
  const [isLoading, setIsLoading]   = useState(false);
  const [error, setError]           = useState('');

  if (!isOpen) return null;

  const handleClose = () => {
    setView('main');
    setError('');
    setJoinCode('');
    onClose();
  };

  // -----------------------------------------------------------------------
  // Create room
  // -----------------------------------------------------------------------
  const handleCreateRoom = async () => {
    if (!user || isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      const sb = getSupabaseBrowserClient();
      if (!sb) { setError('Supabase not configured'); return; }

      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setError('Session expired — please sign in again'); return; }

      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ instrument }),
      });

      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Failed to create room'); return; }

      handleClose();
      router.push(`/room/${json.inviteCode}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // -----------------------------------------------------------------------
  // Join room
  // -----------------------------------------------------------------------
  const handleJoinRoom = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || code.length !== 8 || !user || isLoading) return;
    setIsLoading(true);
    setError('');

    try {
      handleClose();
      router.push(`/room/${code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#0f1117] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h2 className="text-base font-black text-white uppercase tracking-widest">
              {view === 'main'   ? 'Multiplayer'
               : view === 'create' ? 'Create Room'
               : 'Join Room'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-white transition"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          {/* Not signed in */}
          {!user && (
            <div className="text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <p className="text-sm text-gray-300">
                You need an account to create or join private rooms.
              </p>
              <p className="text-xs text-gray-500">Solo play remains available as a guest.</p>
              <button
                onClick={() => { handleClose(); onOpenAuth(); }}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm transition"
              >
                Sign In / Register
              </button>
            </div>
          )}

          {/* Supabase not configured */}
          {user && !isSupabaseAvailable && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-900/20 border border-rose-500/30 text-rose-300 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Backend not configured. Multiplayer is unavailable.</span>
            </div>
          )}

          {/* Signed in — main menu */}
          {user && isSupabaseAvailable && view === 'main' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => setView('create')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-gray-900 border border-gray-700
                  hover:border-amber-500/60 hover:bg-amber-500/5 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center
                  group-hover:scale-110 transition">
                  <Plus className="w-6 h-6 text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Create Room</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Host a private match</p>
                </div>
              </button>

              <button
                onClick={() => setView('join')}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-gray-900 border border-gray-700
                  hover:border-cyan-500/60 hover:bg-cyan-500/5 transition group"
              >
                <div className="w-12 h-12 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center
                  group-hover:scale-110 transition">
                  <LogIn className="w-6 h-6 text-cyan-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Join Room</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Enter an invite code</p>
                </div>
              </button>
            </div>
          )}

          {/* Create room form */}
          {user && isSupabaseAvailable && view === 'create' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Choose your instrument for this room:</p>

              <div className="grid grid-cols-2 gap-2">
                {INSTRUMENT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setInstrument(opt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition
                      ${instrument === opt.value
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-gray-700 bg-gray-900 hover:border-amber-500/40'
                      }`}
                  >
                    <p className="text-sm font-bold text-white">{opt.label}</p>
                    <p className="text-[10px] text-gray-400">{opt.desc}</p>
                  </button>
                ))}
              </div>

              {error && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />{error}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => { setView('main'); setError(''); }}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:border-gray-600 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateRoom}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500
                    hover:bg-amber-400 disabled:opacity-60 text-black font-bold text-sm transition"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</> : 'Create Room'}
                </button>
              </div>
            </div>
          )}

          {/* Join room form */}
          {user && isSupabaseAvailable && view === 'join' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">Enter the 8-character invite code:</p>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="e.g. AB12CD34"
                maxLength={8}
                className="w-full px-4 py-3 rounded-xl bg-gray-900 border border-gray-700 text-white text-center
                  font-mono text-xl font-bold tracking-widest uppercase placeholder-gray-600
                  focus:outline-none focus:border-cyan-500 transition"
              />
              {error && (
                <p className="text-xs text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />{error}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => { setView('main'); setError(''); }}
                  className="px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-gray-300 text-sm hover:border-gray-600 transition"
                >
                  Back
                </button>
                <button
                  onClick={handleJoinRoom}
                  disabled={isLoading || joinCode.trim().length !== 8}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-cyan-600
                    hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm transition"
                >
                  {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Joining…</> : 'Join Room'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
