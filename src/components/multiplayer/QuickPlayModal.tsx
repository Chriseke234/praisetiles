'use client';

/**
 * QuickPlayModal — Seamless Quick Play matchmaking dialog.
 * Prompts: Casual vs Ranked, Piano vs Guitar.
 * Enters queue, polls heartbeat, displays estimated wait time & animated radar,
 * and auto-navigates directly to the matched room.
 */

import React, { useEffect, useState } from 'react';
import {
  Zap, X, Play, Music, Flame, Loader2, AlertCircle, ShieldCheck,
} from 'lucide-react';
import { RoomMode } from '@/types/social';
import { InstrumentType } from '@/types/game';
import { useSocial } from '@/lib/social/SocialContext';
import { useAuth } from '@/lib/auth/AuthContext';
import { useRouter } from 'next/navigation';

interface QuickPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

export const QuickPlayModal: React.FC<QuickPlayModalProps> = ({
  isOpen,
  onClose,
  onOpenAuth,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { queueStatus, matchedInviteCode, startQuickPlay, cancelQuickPlay, error, clearError } = useSocial();

  const [mode, setMode]             = useState<RoomMode>('casual');
  const [instrument, setInstrument] = useState<InstrumentType>('piano');
  const [queueElapsed, setQueueElapsed] = useState(0);

  // Queue elapsed timer
  useEffect(() => {
    if (queueStatus !== 'queued') return;
    const start = Date.now();
    const timer = setInterval(() => {
      setQueueElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [queueStatus]);

  // Handle successful match
  useEffect(() => {
    if (queueStatus === 'matched' && matchedInviteCode) {
      onClose();
      router.push(`/room/${matchedInviteCode}`);
    }
  }, [queueStatus, matchedInviteCode, router, onClose]);

  if (!isOpen) return null;

  const handleStartQueue = async () => {
    clearError();
    if (mode === 'ranked' && !user) {
      onOpenAuth();
      return;
    }
    setQueueElapsed(0);
    await startQuickPlay(mode, instrument);
  };

  const handleCancelQueue = async () => {
    setQueueElapsed(0);
    await cancelQuickPlay();
  };

  const isQueued = queueStatus === 'queued';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-md bg-[#0d0f15] border border-gray-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800/80 bg-gray-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">Quick Play</h2>
              <p className="text-[11px] text-gray-400">Instant gospel rhythm matchmaking</p>
            </div>
          </div>

          {!isQueued && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-900 border border-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isQueued ? (
            <>
              {/* Mode Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Select Queue Mode
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setMode('casual')}
                    className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border text-center transition ${
                      mode === 'casual'
                        ? 'bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30'
                        : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-sm font-bold text-white">Casual</span>
                    <span className="text-[10px] text-gray-400">Instant play · No rating stakes</span>
                  </button>

                  <button
                    onClick={() => setMode('ranked')}
                    className={`flex flex-col items-center gap-1.5 p-3.5 rounded-2xl border text-center transition ${
                      mode === 'ranked'
                        ? 'bg-rose-500/10 border-rose-500/50 ring-1 ring-rose-500/30'
                        : 'bg-gray-900/50 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <span className="text-sm font-bold text-white">Ranked</span>
                    <span className="text-[10px] text-gray-400">Competitive Elo · Fair brackets</span>
                  </button>
                </div>
              </div>

              {/* Instrument Selection */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Select Instrument
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setInstrument('piano')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border transition ${
                      instrument === 'piano'
                        ? 'bg-cyan-500/10 border-cyan-500/50 ring-1 ring-cyan-500/30 text-cyan-300'
                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Music className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold">Piano Tiles</span>
                  </button>

                  <button
                    onClick={() => setInstrument('guitar')}
                    className={`flex items-center gap-2.5 p-3 rounded-2xl border transition ${
                      instrument === 'guitar'
                        ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30 text-amber-300'
                        : 'bg-gray-900/50 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    <Flame className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold">Guitar Tiles</span>
                  </button>
                </div>
              </div>

              {/* Ranked Notice */}
              {mode === 'ranked' && !user && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <span>Ranked requires a registered profile. You will be prompted to sign in.</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                onClick={handleStartQueue}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-sm transition shadow-lg"
              >
                <Play className="w-4 h-4 fill-current" />
                Find Match Now
              </button>
            </>
          ) : (
            /* Active Matchmaking Radar State */
            <div className="flex flex-col items-center justify-center py-6 space-y-5 text-center">
              {/* Radar ring animation */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border border-amber-500/20 animate-ping" />
                <div className="absolute inset-2 rounded-full border border-cyan-500/30 animate-pulse" />
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-cyan-500 flex items-center justify-center shadow-lg">
                  <Loader2 className="w-7 h-7 text-black animate-spin" />
                </div>
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Searching for Match…</h3>
                <p className="text-xs text-gray-400 capitalize">
                  {mode} · {instrument} Tiles · {queueElapsed}s elapsed
                </p>
                <p className="text-[11px] text-gray-500">
                  Expanding rating search bracket to minimize wait time
                </p>
              </div>

              <button
                onClick={handleCancelQueue}
                className="px-5 py-2 rounded-xl bg-gray-900 border border-gray-700 hover:border-rose-500/50 text-gray-300 hover:text-rose-400 text-xs font-semibold transition"
              >
                Cancel Queue
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
