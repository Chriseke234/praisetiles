'use client';

import React from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';

interface GuitarTilesViewProps {
  notes: readonly Note[];
  currentTime: number;
  activeLanes: boolean[];
  onLaneTap: (lane: number) => void;
  reducedMotion: boolean;
}

export const GuitarTilesView: React.FC<GuitarTilesViewProps> = ({
  notes,
  currentTime,
  activeLanes,
  onLaneTap,
  reducedMotion,
}) => {
  const approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS;
  const laneKeys = ['D', 'F', 'J', 'K'];

  // Visible unhit notes within approach window
  const visibleNotes = notes.filter((n) => {
    if (n.hit) return false;
    const timeUntilHit = n.time - currentTime;
    return timeUntilHit <= approachTime && timeUntilHit >= -GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
  });

  return (
    <div className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#0a0705] select-none border-x-2 border-amber-900/60 shadow-2xl">
      {/* 4 Fretboard Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-amber-950/70 overflow-hidden">
        {/* Horizontal Fret Bars */}
        <div className="absolute top-[20%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
        <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
        <div className="absolute top-[60%] left-0 right-0 h-[1px] bg-amber-800/40 pointer-events-none" />

        {/* Hit Bar at 82% */}
        <div className="absolute top-[82%] left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-500 z-10 shadow-[0_0_15px_rgba(245,158,11,0.7)]" />

        {/* 4 Guitar Lanes */}
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
                  ? 'bg-amber-500/25'
                  : 'hover:bg-amber-950/20 active:bg-amber-500/20'
              }`}
            >
              {/* Bronze/Steel Guitar String running down center */}
              <div
                className={`absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none transition-all ${
                  isActive
                    ? 'w-1 bg-yellow-200 shadow-[0_0_8px_rgba(250,204,21,0.9)]'
                    : 'w-[2px] bg-gradient-to-b from-amber-600/50 via-yellow-600/70 to-amber-500'
                }`}
              />

              {/* String vibration hit beam */}
              {isActive && (
                <div
                  className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-amber-500/30 via-yellow-500/10 to-transparent pointer-events-none animate-pulse"
                />
              )}

              {/* Fret Button Hit Zone */}
              <div
                className={`relative z-20 w-full h-[18%] flex flex-col items-center justify-center border-t-2 transition-all ${
                  isActive
                    ? 'border-yellow-400 bg-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-[0.98]'
                    : 'border-amber-600/40 bg-gradient-to-t from-black to-amber-950/60'
                }`}
              >
                {/* Fret button circle */}
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                    isActive
                      ? 'border-yellow-300 bg-yellow-400 text-black shadow-lg scale-110'
                      : 'border-amber-500/60 bg-gray-950 text-amber-300'
                  }`}
                >
                  <span className="text-sm sm:text-base font-black">
                    {laneKeys[lane]}
                  </span>
                </div>
                <span className="text-[8px] uppercase tracking-wider text-amber-400/90 font-black mt-0.5 hidden sm:inline">
                  Fret {lane + 1}
                </span>
              </div>
            </div>
          );
        })}

        {/* Falling Guitar Plectrum Notes */}
        {visibleNotes.map((note) => {
          const timeUntilHit = note.time - currentTime;
          const progress = 1 - timeUntilHit / approachTime;
          const topPercent = progress * 82; // 82% is hit line position
          const lanePercent = note.lane * 25;

          // Distinct gem colors per string
          const gemColors = [
            'from-emerald-400 to-emerald-600 border-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.8)]',
            'from-amber-400 to-amber-600 border-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.8)]',
            'from-cyan-400 to-cyan-600 border-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.8)]',
            'from-rose-400 to-rose-600 border-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.8)]',
          ];

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
              className="flex items-center justify-center pointer-events-none z-15 px-2"
            >
              <div
                className={`w-11 h-11 sm:w-13 sm:h-13 rounded-full border-2 bg-gradient-to-br ${
                  gemColors[note.lane]
                } flex items-center justify-center relative ${
                  !reducedMotion ? 'animate-pulse' : ''
                }`}
              >
                {/* Inner plectrum core star */}
                <div className="w-4 h-4 rounded-full bg-white/90 shadow-md" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
