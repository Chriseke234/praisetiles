'use client';

import React, { memo } from 'react';
import { GhostRun, getGhostScoreAtTime } from '@/lib/game/ghost';
import { Ghost, TrendingUp, TrendingDown, Equal } from 'lucide-react';

interface GhostChallengeHUDProps {
  ghost: GhostRun | null;
  currentAudioTime: number;
  playerScore: number;
}

export const GhostChallengeHUD: React.FC<GhostChallengeHUDProps> = memo(({
  ghost,
  currentAudioTime,
  playerScore,
}) => {
  if (!ghost) return null;

  const ghostScore = getGhostScoreAtTime(ghost.snapshots, currentAudioTime);
  const delta = playerScore - ghostScore;
  const isAhead = delta > 0;
  const isTied = delta === 0;

  return (
    <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-2xl bg-black/75 border border-purple-500/40 backdrop-blur-md shadow-lg pointer-events-none text-xs select-none animate-fadeIn">
      {/* Ghost Icon & Name */}
      <div className="flex items-center gap-1.5 text-purple-300">
        <Ghost className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
        <span className="font-bold text-[10px] uppercase tracking-wider truncate max-w-[90px]">
          {ghost.displayName}
        </span>
      </div>

      <div className="h-3 w-[1px] bg-white/20" />

      {/* Realtime Ghost Score */}
      <div className="text-[11px] font-mono text-gray-300">
        <span>Ghost: </span>
        <strong className="text-white font-bold">{ghostScore.toLocaleString()}</strong>
      </div>

      <div className="h-3 w-[1px] bg-white/20" />

      {/* Live Score Delta */}
      <div
        className={`flex items-center gap-1 font-mono font-black text-[11px] px-2 py-0.5 rounded-full ${
          isAhead
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            : isTied
            ? 'bg-gray-800 text-gray-300'
            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
        }`}
      >
        {isAhead ? (
          <>
            <TrendingUp className="w-3 h-3 text-emerald-400" />
            <span>+{delta.toLocaleString()}</span>
          </>
        ) : isTied ? (
          <>
            <Equal className="w-3 h-3 text-gray-400" />
            <span>Tied</span>
          </>
        ) : (
          <>
            <TrendingDown className="w-3 h-3 text-rose-400" />
            <span>{delta.toLocaleString()}</span>
          </>
        )}
      </div>
    </div>
  );
});

GhostChallengeHUD.displayName = 'GhostChallengeHUD';
