'use client';

import React from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';

interface PianoTilesViewProps {
  notes: readonly Note[];
  currentTime: number;
  approachTime?: number;
  activeLanes: boolean[];
  onLanePointerDown: (lane: number) => void;
  onLanePointerUp: (lane: number) => void;
  onLanePointerEnter: (lane: number) => void;
  reducedMotion: boolean;
}

export const PianoTilesView: React.FC<PianoTilesViewProps> = ({
  notes,
  currentTime,
  approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS,
  activeLanes,
  onLanePointerDown,
  onLanePointerUp,
  onLanePointerEnter,
  reducedMotion,
}) => {
  const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;

  // Filter notes that are within visible approach window
  // A long note remains visible until its sustain duration finishes
  const visibleNotes = notes.filter((n) => {
    const duration = n.duration ?? 0;
    const timeUntilEnd = n.time + duration - currentTime;
    const timeUntilStart = n.time - currentTime;

    // If already hit and not a long note, hide it
    if (n.hit && n.type !== 'long') return false;
    // If long note finished holding or missed, hide it
    if (n.sustainState === 'completed' || (n.hit && n.grade === 'MISS')) return false;

    return timeUntilStart <= approachTime && timeUntilEnd >= -goodWindow;
  });

  return (
    <div
      className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#07080c] select-none border-x border-gray-800/80 touch-none"
      onPointerLeave={() => {
        [0, 1, 2, 3].forEach((l) => onLanePointerUp(l));
      }}
    >
      {/* 4 Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-gray-800/60 overflow-hidden">
        {/* Hit line receptor guide at 82% from top */}
        <div className="absolute top-[82%] left-0 right-0 h-1.5 bg-gradient-to-r from-cyan-500 via-amber-400 to-cyan-500 z-10 shadow-[0_0_15px_rgba(6,182,212,0.8)]" />

        {/* 4 Vertical Lanes with Direct Pointer Handlers */}
        {[0, 1, 2, 3].map((lane) => {
          const isActive = activeLanes[lane];
          return (
            <div
              key={lane}
              onPointerDown={(e) => {
                e.preventDefault();
                (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
                onLanePointerDown(lane);
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                onLanePointerUp(lane);
              }}
              onPointerEnter={(e) => {
                // Support continuous glissando / drag across lanes
                if (e.buttons > 0) {
                  onLanePointerEnter(lane);
                }
              }}
              className={`relative h-full flex flex-col justify-end cursor-pointer transition-colors duration-75 ${
                isActive
                  ? 'bg-cyan-500/20'
                  : 'hover:bg-white/[0.02] active:bg-cyan-500/15'
              }`}
            >
              {/* Vertical center laser guide line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-gray-800/40 pointer-events-none" />

              {/* Active Lane Hit Beam */}
              {isActive && (
                <div
                  className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-cyan-500/35 via-cyan-500/10 to-transparent pointer-events-none animate-pulse"
                />
              )}

              {/* Bottom Interactive Hit Zone (No keyboard keys, pure neon receptor) */}
              <div
                className={`relative z-20 w-full h-[18%] flex flex-col items-center justify-center border-t-2 transition-all ${
                  isActive
                    ? 'border-cyan-400 bg-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-[0.98]'
                    : 'border-cyan-500/30 bg-gray-900/80 hover:bg-gray-850'
                }`}
              >
                {/* Luminous receptor node */}
                <div
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                    isActive
                      ? 'border-cyan-300 bg-cyan-400/80 shadow-[0_0_12px_rgba(34,211,238,0.9)] scale-110'
                      : 'border-cyan-500/40 bg-gray-950/60'
                  }`}
                >
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isActive ? 'bg-white shadow-[0_0_6px_#fff]' : 'bg-cyan-400/50'
                    }`}
                  />
                </div>
                <span className="text-[9px] uppercase tracking-widest text-cyan-300/80 font-bold mt-1">
                  Lane {lane + 1}
                </span>
              </div>
            </div>
          );
        })}

        {/* Falling Interactive Piano Tiles (Short & Long Sustain Notes) */}
        {visibleNotes.map((note) => {
          const timeUntilHit = note.time - currentTime;
          const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
          const duration = note.duration ?? 0;
          const isInner = note.lane === 1 || note.lane === 2;

          // Color palette
          const baseColor = isInner
            ? 'from-cyan-400 to-cyan-600 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)]'
            : 'from-amber-400 to-amber-600 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]';

          const lanePercent = note.lane * 25;

          // Calculate travel progress to hit line (at 82% from top)
          const hitLinePercent = 82;

          if (isLong) {
            // Sustained Long Tile
            const isHolding = note.sustainState === 'holding';
            const progress = note.sustainProgress ?? 0;

            // Height of sustain tail in % of container height
            const fullTailHeightPercent = (duration / approachTime) * hitLinePercent;

            // When note head reaches hitLinePercent, it pauses at the hit line while being held
            // and the tail is progressively consumed
            let headTopPercent: number;
            let currentTailHeight: number;

            if (isHolding) {
              headTopPercent = hitLinePercent;
              currentTailHeight = Math.max(0, fullTailHeightPercent * (1 - progress));
            } else {
              const headProgress = 1 - timeUntilHit / approachTime;
              headTopPercent = headProgress * hitLinePercent;
              currentTailHeight = fullTailHeightPercent;
            }

            const tailTopPercent = headTopPercent - currentTailHeight;

            return (
              <div
                key={note.id}
                style={{
                  position: 'absolute',
                  left: `${lanePercent}%`,
                  width: '25%',
                  top: `${tailTopPercent}%`,
                  height: `${currentTailHeight}%`,
                  willChange: 'top, height',
                }}
                className="px-1.5 pointer-events-none z-15 flex flex-col justify-end"
              >
                {/* Luminous Sustain Tail Body */}
                <div
                  className={`w-full h-full rounded-t-lg border-x-2 border-t-2 relative overflow-hidden transition-all ${
                    isHolding
                      ? 'bg-gradient-to-t from-cyan-500/80 via-cyan-400/50 to-cyan-600/30 border-cyan-200 shadow-[0_0_20px_rgba(34,211,238,0.9)] animate-pulse'
                      : isInner
                      ? 'bg-gradient-to-t from-cyan-600/70 via-cyan-500/40 to-cyan-700/20 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.5)]'
                      : 'bg-gradient-to-t from-amber-600/70 via-amber-500/40 to-amber-700/20 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.5)]'
                  }`}
                >
                  {/* Energy ripple bands inside sustain tail */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_8px,rgba(255,255,255,0.15)_8px,rgba(255,255,255,0.15)_12px)] pointer-events-none" />

                  {/* Hold label */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] rotate-[-90deg]">
                      {isHolding ? 'HOLDING' : 'HOLD'}
                    </span>
                  </div>
                </div>

                {/* Head Tile */}
                <div
                  className={`w-full h-12 sm:h-14 rounded-b-lg border-2 bg-gradient-to-b ${baseColor} flex items-center justify-center relative overflow-hidden shadow-lg`}
                >
                  <div className="w-1/2 h-1 bg-white rounded-full shadow-[0_0_6px_#fff]" />
                  {isHolding && (
                    <div className="absolute inset-0 bg-white/40 animate-ping rounded-b-lg" />
                  )}
                </div>
              </div>
            );
          }

          // Short Normal Tile
          const progress = 1 - timeUntilHit / approachTime;
          const topPercent = progress * hitLinePercent;

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
                className={`w-full h-14 sm:h-16 rounded-xl border-2 bg-gradient-to-b ${baseColor} flex items-center justify-center relative overflow-hidden shadow-lg transition-transform ${
                  !reducedMotion ? 'hover:scale-105' : ''
                }`}
              >
                {/* Central neon core line */}
                <div className="w-1/2 h-1.5 bg-white/90 rounded-full shadow-[0_0_8px_#fff]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
