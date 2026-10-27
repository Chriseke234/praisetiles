'use client';

import React from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';

interface PianoTilesViewProps {
  notes: readonly Note[];
  currentTime: number;
  activeLanes: boolean[];
  onLaneTap: (lane: number) => void;
  reducedMotion: boolean;
}

export const PianoTilesView: React.FC<PianoTilesViewProps> = ({
  notes,
  currentTime,
  activeLanes,
  onLaneTap,
  reducedMotion,
}) => {
  const approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS;
  const laneKeys = ['D', 'F', 'J', 'K'];

  // Filter notes that are within visible approach window and not yet hit
  const visibleNotes = notes.filter((n) => {
    if (n.hit) return false;
    const timeUntilHit = n.time - currentTime;
    return timeUntilHit <= approachTime && timeUntilHit >= -GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
  });

  return (
    <div className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#07080c] select-none border-x border-gray-800/80">
      {/* 4 Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-gray-800/60 overflow-hidden">
        {/* Hit line guide at 82% from top */}
        <div className="absolute top-[82%] left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500 z-10 shadow-[0_0_12px_rgba(6,182,212,0.6)]" />

        {/* 4 Vertical Lanes */}
        {[0, 1, 2, 3].map((lane) => {
          const isActive = activeLanes[lane];
          return (
            <div
              key={lane}
              onPointerDown={(e) => {
                e.preventDefault();
                onLaneTap(lane);
              }}
              className={`relative h-full flex flex-col justify-end cursor-pointer transition-colors duration-75 ${
                isActive
                  ? 'bg-cyan-500/20'
                  : 'hover:bg-white/[0.02] active:bg-cyan-500/15'
              }`}
            >
              {/* Subtle vertical center guide line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-800/40 pointer-events-none" />

              {/* Lane Hit Zone at Bottom */}
              <div
                className={`relative z-20 w-full h-[18%] flex flex-col items-center justify-center border-t-2 transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500/30 glow-cyan'
                    : 'border-cyan-500/40 bg-gray-900/60'
                }`}
              >
                <span className="text-base sm:text-lg font-black text-white/90">
                  {laneKeys[lane]}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-cyan-300/80 font-bold hidden sm:inline">
                  Tap
                </span>
              </div>
            </div>
          );
        })}

        {/* Falling Piano Tiles */}
        {visibleNotes.map((note) => {
          const timeUntilHit = note.time - currentTime;
          // Progress from 0 (at top) to 1.0 (at hit line 82%)
          const progress = 1 - timeUntilHit / approachTime;
          const topPercent = progress * 82; // 82% is hit line position
          const lanePercent = note.lane * 25;

          // Alternate colors slightly between inner and outer lanes
          const isInner = note.lane === 1 || note.lane === 2;
          const colorClasses = isInner
            ? 'bg-gradient-to-b from-cyan-400 to-cyan-600 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.7)]'
            : 'bg-gradient-to-b from-amber-400 to-amber-600 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.7)]';

          return (
            <div
              key={note.id}
              style={{
                position: 'absolute',
                left: `${lanePercent}%`,
                width: '25%',
                top: `${topPercent}%`,
                transform: 'translateY(-100%)',
                willChange: 'top',
              }}
              className="px-1.5 pointer-events-none z-15"
            >
              <div
                className={`w-full h-14 sm:h-18 rounded-lg border-2 ${colorClasses} flex items-center justify-center relative overflow-hidden ${
                  !reducedMotion ? 'animate-pulse' : ''
                }`}
              >
                {/* Neon core accent line */}
                <div className="w-1/2 h-1 bg-white/80 rounded-full shadow-sm" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
