'use client';

/**
 * MultiplayerLoadingOverlay — Realtime Room & Arena Synchronisation State
 * 
 * Features:
 * - Displays active room PIN, mode, and 4 player slot indicators
 * - Differentiates between connecting, syncing telemetry, and game countdown
 * - Pulse indicators on connected player slots
 * - 10-second failsafe with retry and leave actions to prevent indefinite hangs
 * - Accessible with ARIA live region
 */

import React, { useState, useEffect } from 'react';
import { Users, Wifi, RefreshCw, LogOut, AlertCircle } from 'lucide-react';
import { ArenaProgressBar } from './ArenaProgressBar';

interface MultiplayerLoadingOverlayProps {
  roomCode?: string;
  connectedCount?: number;
  maxPlayers?: number;
  stage?: 'connecting' | 'syncing' | 'preparing';
  timeoutMs?: number;
  onRetry?: () => void;
  onLeave?: () => void;
  reducedMotion?: boolean;
  className?: string;
}

export const MultiplayerLoadingOverlay: React.FC<MultiplayerLoadingOverlayProps> = ({
  roomCode,
  connectedCount = 1,
  maxPlayers = 4,
  stage = 'connecting',
  timeoutMs = 10000,
  onRetry,
  onLeave,
  reducedMotion = false,
  className = '',
}) => {
  const [hasTimedOut, setHasTimedOut] = useState(false);

  useEffect(() => {
    if (timeoutMs <= 0) return;
    const t = setTimeout(() => setHasTimedOut(true), timeoutMs);
    return () => clearTimeout(t);
  }, [timeoutMs]);

  const stageMessages = {
    connecting: 'Connecting to sanctuary arena...',
    syncing: 'Synchronising player clocks & telemetry...',
    preparing: 'Preparing multiplayer match countdown...',
  }[stage];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl select-none animate-fadeIn ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="relative w-full max-w-md p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#141026] via-[#0f0c1a] to-[#08070d] border border-purple-500/40 shadow-2xl text-center space-y-6">
        {/* Room PIN Pill */}
        {roomCode && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-mono font-bold">
            <Wifi className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>ROOM PIN: {roomCode}</span>
          </div>
        )}

        {/* 4 Player Connection Slots */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-gray-400">
            <Users className="w-4 h-4 text-purple-400" />
            <span>
              Players in Lobby: {connectedCount} / {maxPlayers}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2.5 pt-2">
            {Array.from({ length: maxPlayers }).map((_, idx) => {
              const isOccupied = idx < connectedCount;
              return (
                <div
                  key={idx}
                  className={`p-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                    isOccupied
                      ? 'bg-purple-900/30 border-purple-500/60 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                      : 'bg-gray-900/40 border-gray-800 border-dashed opacity-50'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      isOccupied
                        ? 'bg-gradient-to-tr from-amber-500 to-amber-300 text-black shadow-md'
                        : 'bg-gray-800 text-gray-500'
                    }`}
                  >
                    P{idx + 1}
                  </div>
                  <span className="text-[10px] font-mono mt-1 text-gray-300">
                    {isOccupied ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress Bar with honest indeterminate status */}
        <ArenaProgressBar
          statusText={stageMessages}
          substatusText="Synchronised 60fps Web Audio clock"
          showPercentage={false}
          reducedMotion={reducedMotion}
        />

        {/* Timeout / Connection Issue Notice */}
        {hasTimedOut && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex flex-col items-center gap-3 animate-fadeIn">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>Realtime connection is taking longer than usual.</span>
            </div>

            <div className="flex items-center gap-2">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs font-bold text-white transition flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Sync</span>
                </button>
              )}

              {onLeave && (
                <button
                  onClick={onLeave}
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-extrabold text-white transition flex items-center gap-1.5"
                >
                  <LogOut className="w-3 h-3" />
                  <span>Leave Room</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
