'use client';

/**
 * MultiplayerResultScreen — Shows placements, scores and rematch option.
 * Clearly labeled "Casual" — no competitive anti-cheat claimed.
 */

import React from 'react';
import { Trophy, RefreshCw, LogOut, Star, XCircle } from 'lucide-react';
import { MatchParticipant } from '@/types/room';

interface MultiplayerResultScreenProps {
  matchResults:  MatchParticipant[];
  currentUserId: string;
  songTitle:     string;
  onRematch:     () => void;
  onLeave:       () => void;
  isHost:        boolean;
}

const PLACEMENT_COLORS: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

const PLACEMENT_LABELS: Record<number, string> = {
  1: '1st',
  2: '2nd',
  3: '3rd',
};

const placementLabel = (p: number | null) =>
  p !== null ? (PLACEMENT_LABELS[p] ?? `${p}th`) : '—';

export const MultiplayerResultScreen: React.FC<MultiplayerResultScreenProps> = ({
  matchResults,
  currentUserId,
  songTitle,
  onRematch,
  onLeave,
  isHost,
}) => {
  const sorted = [...matchResults].sort((a, b) => {
    // Completed players sorted by score desc, then eliminated players by elimination order
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    return b.score - a.score;
  });

  const myResult = matchResults.find((r) => r.userId === currentUserId);
  const myPlacement = myResult?.placement;

  return (
    <div className="min-h-screen w-full bg-[#090a0f] flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="w-full max-w-lg text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
          <Star className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Casual Match · Results</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white mb-1">Match Over</h2>
        <p className="text-sm text-gray-400 truncate max-w-xs mx-auto">{songTitle}</p>

        {myPlacement !== null && myPlacement !== undefined && (
          <p className={`text-4xl font-black mt-3 ${PLACEMENT_COLORS[myPlacement ?? 0] ?? 'text-gray-200'}`}>
            {placementLabel(myPlacement)}
          </p>
        )}
      </div>

      {/* Placement table */}
      <div className="w-full max-w-lg bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden mb-6">
        <div className="grid grid-cols-5 px-4 py-2 border-b border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <span>#</span>
          <span className="col-span-2">Player</span>
          <span className="text-right">Score</span>
          <span className="text-right">Acc</span>
        </div>

        {sorted.map((r, i) => {
          const isMe     = r.userId === currentUserId;
          const p        = r.placement ?? (i + 1);
          const pColor   = PLACEMENT_COLORS[p] ?? 'text-gray-400';

          return (
            <div
              key={r.userId}
              className={`grid grid-cols-5 items-center px-4 py-3 border-b border-gray-800/50 last:border-0 transition
                ${isMe ? 'bg-amber-500/5' : ''}`}
            >
              {/* Placement */}
              <span className={`text-sm font-black ${pColor}`}>
                {p === 1 ? (
                  <Trophy className="w-4 h-4 text-amber-400 inline" />
                ) : (
                  placementLabel(r.placement)
                )}
              </span>

              {/* Name */}
              <div className="col-span-2 flex items-center gap-2 min-w-0">
                {!r.completed && (
                  <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                )}
                <span className={`text-sm font-semibold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                  {r.displayName}
                  {isMe && <span className="text-amber-500 ml-1 text-[10px] font-bold">(You)</span>}
                </span>
              </div>

              {/* Score */}
              <span className="text-right text-sm font-bold text-white tabular-nums">
                {r.score.toLocaleString()}
              </span>

              {/* Accuracy */}
              <span className="text-right text-xs text-gray-400 tabular-nums">
                {r.accuracy.toFixed(1)}%
              </span>
            </div>
          );
        })}

        {sorted.length === 0 && (
          <p className="text-center text-sm text-gray-500 italic py-8">
            Waiting for results…
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg">
        {isHost && (
          <button
            onClick={onRematch}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-500 hover:bg-amber-400
              text-black font-bold text-sm transition shadow"
          >
            <RefreshCw className="w-4 h-4" />
            Rematch
          </button>
        )}
        {!isHost && (
          <div className="flex-1 flex items-center justify-center py-3 rounded-xl bg-gray-800 border border-gray-700 text-gray-400 text-sm">
            Waiting for host to start rematch…
          </div>
        )}
        <button
          onClick={onLeave}
          className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gray-900 border border-gray-700
            hover:border-rose-500/50 text-gray-300 hover:text-rose-400 font-semibold text-sm transition"
        >
          <LogOut className="w-4 h-4" />
          Leave
        </button>
      </div>

      <p className="mt-6 text-[10px] text-gray-600 text-center max-w-xs">
        Results labeled &ldquo;Casual&rdquo;. Sync tolerance ~±500ms over internet.
        No competitive anti-cheat applied in this phase.
      </p>
    </div>
  );
};
