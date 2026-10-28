'use client';

/**
 * ParticipantList — Shows all players in the room with status indicators.
 * SVG icons only, no emojis.
 */

import React from 'react';
import { Crown, Wifi, WifiOff, CheckCircle, Circle } from 'lucide-react';
import { RoomParticipant } from '@/types/room';

interface ParticipantListProps {
  participants:  RoomParticipant[];
  currentUserId: string;
  hostId:        string;
  maxPlayers:    number;
}

const GEM_COLORS: Record<string, string> = {
  Quartz:   '#9ca3af',
  Amethyst: '#a855f7',
  Topaz:    '#f59e0b',
  Emerald:  '#10b981',
  Diamond:  '#67e8f9',
};

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  currentUserId,
  hostId,
  maxPlayers,
}) => {
  const emptySlots = Math.max(0, maxPlayers - participants.length);

  return (
    <div className="w-full space-y-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-400">
          Players
        </h3>
        <span className="text-xs text-gray-500">
          {participants.length} / {maxPlayers}
        </span>
      </div>

      {participants.map((p) => {
        const isMe   = p.userId === currentUserId;
        const isHost = p.userId === hostId;
        const color  = GEM_COLORS[p.gemRank ?? 'Quartz'] ?? '#9ca3af';

        return (
          <div
            key={p.userId}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition
              ${isMe
                ? 'bg-amber-500/10 border-amber-500/40'
                : 'bg-gray-900/60 border-gray-800'
              }`}
          >
            {/* Gem rank badge */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-black text-black flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {(p.gemRank ?? 'Q')[0]}
            </div>

            {/* Name + labels */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-sm font-semibold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                  {p.displayName}
                </span>
                {isMe && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full">
                    You
                  </span>
                )}
                {isHost && (
                  <Crown className="w-3 h-3 text-amber-400 flex-shrink-0" />
                )}
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {p.isConnected ? (
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              )}
              {p.isReady ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <Circle className="w-4 h-4 text-gray-600" />
              )}
            </div>
          </div>
        );
      })}

      {/* Empty slots */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed border-gray-800/60 opacity-40"
        >
          <div className="w-7 h-7 rounded-lg bg-gray-800 flex-shrink-0" />
          <span className="text-sm text-gray-600 italic">Waiting for player…</span>
        </div>
      ))}
    </div>
  );
};
