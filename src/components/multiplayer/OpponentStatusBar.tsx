'use client';

/**
 * OpponentStatusBar — Lightweight live opponent score display.
 * Updated every ~2s from broadcast events; never per-tap.
 * Clearly labeled "Casual" to document sync tolerance.
 */

import React from 'react';
import { Zap, XCircle } from 'lucide-react';
import { OpponentSnapshot } from '@/types/room';

interface OpponentStatusBarProps {
  opponents: OpponentSnapshot[];
}

export const OpponentStatusBar: React.FC<OpponentStatusBarProps> = ({ opponents }) => {
  if (opponents.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-2 py-1.5">
      {opponents.map((opp) => (
        <div
          key={opp.userId}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border text-xs transition
            ${opp.isEliminated
              ? 'bg-gray-900/60 border-rose-500/30 opacity-60'
              : 'bg-gray-900/80 border-gray-700'
            }`}
        >
          {opp.isEliminated ? (
            <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
          ) : (
            <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
          )}
          <span className={`font-semibold max-w-[80px] truncate ${opp.isEliminated ? 'text-gray-500 line-through' : 'text-white'}`}>
            {opp.displayName}
          </span>
          {!opp.isEliminated && (
            <>
              <span className="text-amber-300 font-bold tabular-nums">
                {opp.score.toLocaleString()}
              </span>
              <span className="text-gray-500 tabular-nums">
                x{opp.combo}
              </span>
            </>
          )}
          {opp.isEliminated && (
            <span className="text-rose-400 font-bold">OUT</span>
          )}
        </div>
      ))}
      <div className="ml-auto flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-900/40 border border-gray-800">
        <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Casual · ~2s delay</span>
      </div>
    </div>
  );
};
