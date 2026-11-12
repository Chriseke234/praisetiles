'use client';

/**
 * TournamentSkeletonLoader — Championship Bracket & Competition Loading Skeleton
 * 
 * Features:
 * - 3-stage single-elimination bracket skeleton nodes (Round of 8, Semis, Finals)
 * - Shimmer sweep effect
 * - "Preparing the competition..." status header with Trophy icon
 */

import React from 'react';
import { Trophy } from 'lucide-react';

interface TournamentSkeletonLoaderProps {
  reducedMotion?: boolean;
  className?: string;
}

export const TournamentSkeletonLoader: React.FC<TournamentSkeletonLoaderProps> = ({
  reducedMotion = false,
  className = '',
}) => {
  return (
    <div className={`space-y-6 select-none ${className}`}>
      {/* Header Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Preparing Championship Tournament</h3>
            <p className="text-[11px] text-gray-400">Loading bracket seeds and player rankings&hellip;</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[10px] font-mono uppercase bg-purple-500/20 text-purple-300 border border-purple-500/40">
          Ranked Arena
        </span>
      </div>

      {/* Bracket Skeleton Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        {/* Round 1 (Quarterfinals: 4 match nodes) */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-left">
            Quarterfinals
          </span>
          {[0, 1].map((idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-[#130f24]/80 border border-gray-800 space-y-2 relative overflow-hidden"
            >
              {!reducedMotion && (
                <div className="absolute inset-0 -translate-x-full animate-[shimmerSweep_1.8s_infinite] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent pointer-events-none" />
              )}
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 bg-gray-800 rounded" />
                <div className="h-3 w-6 bg-gray-900 rounded" />
              </div>
              <div className="border-t border-gray-800/60 pt-2 flex items-center justify-between">
                <div className="h-3 w-28 bg-gray-800 rounded" />
                <div className="h-3 w-6 bg-gray-900 rounded" />
              </div>
            </div>
          ))}
        </div>

        {/* Round 2 (Semifinals: 2 match nodes) */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block text-left">
            Semifinals
          </span>
          <div className="p-3.5 rounded-2xl bg-[#130f24]/80 border border-purple-500/30 space-y-2 relative overflow-hidden">
            {!reducedMotion && (
              <div className="absolute inset-0 -translate-x-full animate-[shimmerSweep_1.8s_infinite] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent pointer-events-none" />
            )}
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-28 bg-purple-900/40 rounded" />
              <div className="h-3.5 w-8 bg-purple-900/60 rounded" />
            </div>
            <div className="border-t border-gray-800/60 pt-2 flex items-center justify-between">
              <div className="h-3.5 w-24 bg-purple-900/40 rounded" />
              <div className="h-3.5 w-8 bg-purple-900/60 rounded" />
            </div>
          </div>
        </div>

        {/* Round 3 (Championship Finals) */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block text-left">
            Championship
          </span>
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/20 to-purple-950/30 border border-amber-500/40 space-y-3 relative overflow-hidden shadow-lg shadow-amber-500/10">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-amber-400/20 text-amber-300 flex items-center justify-center text-[10px] font-bold">
                ★
              </div>
              <span className="text-xs font-bold text-amber-300">Grand Finals</span>
            </div>
            <div className="h-4 w-32 bg-amber-500/20 rounded" />
            <div className="h-3 w-20 bg-gray-800 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
};
