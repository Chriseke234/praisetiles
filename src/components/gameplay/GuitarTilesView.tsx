'use client';

import React, { memo } from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Play } from 'lucide-react';

interface GuitarTilesViewProps {
  notes: readonly Note[];
  currentTime: number;
  approachTime?: number;
  activeLanes: boolean[];
  keyBindings?: string[];
  /** Called when the player taps/clicks directly on a falling tile */
  onTilePointerDown: (noteId: string, lane: number) => void;
  /** Called when the player releases a falling tile */
  onTilePointerUp: (noteId: string, lane: number) => void;
  /** Called when player taps anywhere on a lane (buffer tap) */
  onLanePointerDown?: (lane: number) => void;
  /** Called when pointer leaves the game area (cancel all sustains) */
  onPointerLeaveArea: () => void;
  reducedMotion: boolean;
  isWaitingForStart?: boolean;
  onStartGame?: () => void;
  songTitle?: string;
  artist?: string;
}

export const GuitarTilesView: React.FC<GuitarTilesViewProps> = memo(({
  notes,
  currentTime,
  approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS,
  activeLanes,
  keyBindings,
  onTilePointerDown,
  onTilePointerUp,
  onLanePointerDown,
  onPointerLeaveArea,
  reducedMotion,
  isWaitingForStart = false,
  onStartGame,
  songTitle,
  artist,
}) => {
  const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;

  // Visible notes within approach window (including recently hit tiles for 150ms hit burst)
  const visibleNotes = notes.filter((n) => {
    const duration = n.duration ?? 0;
    const timeUntilEnd = n.time + duration - currentTime;
    const timeUntilStart = n.time - currentTime;

    // Completed long notes or missed notes hide immediately
    if (n.sustainState === 'completed' || (n.hit && n.grade === 'MISS')) return false;

    // Hit short notes stay visible for 150ms to display hit burst feedback
    if (n.hit && n.type !== 'long') {
      const hitAge = (n as any).hitTimestamp ? Date.now() - (n as any).hitTimestamp : 999;
      return hitAge < 150;
    }

    return timeUntilStart <= approachTime && timeUntilEnd >= -goodWindow;
  });

  return (
    <div
      className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#0a0705] select-none border-x-2 border-amber-900/60 shadow-2xl touch-none"
      onPointerLeave={() => {
        // Cancel all active sustains when the pointer leaves the game area
        onPointerLeaveArea();
      }}
    >
      {/* 4 Fretboard Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-amber-950/70 overflow-hidden">
        {/* Horizontal Fret Bars */}
        <div className="absolute top-[20%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
        <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
        <div className="absolute top-[60%] left-0 right-0 h-[1px] bg-amber-800/40 pointer-events-none" />

        {/* Hit Bar at 88% */}
        <div className="absolute top-[88%] left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500/70 via-yellow-300 to-amber-500/70 z-10 shadow-[0_0_15px_rgba(245,158,11,0.8)]" />

        {/* 4 Guitar Lanes — Visual strings & interactive touch targets */}
        {[0, 1, 2, 3].map((lane) => {
          const isActive = activeLanes[lane];
          const keyLabel = keyBindings?.[lane]?.toUpperCase();

          return (
            <div
              key={lane}
              onPointerDown={() => {
                onLanePointerDown?.(lane);
              }}
              className={`relative h-full flex flex-col justify-end cursor-pointer transition-colors duration-75 ${
                isActive
                  ? 'bg-amber-500/25'
                  : ''
              }`}
            >
              {/* Bronze/Steel Guitar String running down center */}
              <div
                className={`absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none transition-all ${
                  isActive
                    ? 'w-1 bg-yellow-200 shadow-[0_0_10px_rgba(250,204,21,1)]'
                    : 'w-[2px] bg-gradient-to-b from-amber-600/50 via-yellow-600/70 to-amber-500'
                }`}
              />

              {/* String vibration hit beam */}
              {isActive && (
                <div
                  className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-amber-500/35 via-yellow-500/15 to-transparent pointer-events-none animate-pulse"
                />
              )}
            </div>
          );
        })}

        {/* Floating Song Intro Banner (Visible before player taps START) */}
        {isWaitingForStart && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
            <div className="px-6 py-6 rounded-3xl bg-[#1c0f05]/90 border border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.3)] backdrop-blur-md max-w-sm w-full space-y-2 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 inline-block">
                Guitar Arena
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-md">
                {songTitle || 'Praise Track'}
              </h2>
              <p className="text-xs text-amber-300 font-semibold tracking-wider">
                {artist || 'Acoustic Worship'}
              </p>

              <div className="pt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartGame?.();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black font-black text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(251,191,36,0.8)] hover:scale-102 active:scale-98 transition-transform cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>START PRAISE</span>
                </button>
              </div>

              <p className="text-[10px] text-gray-400 font-medium pt-1">
                Tap start to begin • Tiles will start falling to the rhythm
              </p>
            </div>
          </div>
        )}

        {/* Falling Guitar Tiles (Short & Long Sustain Beams) */}
        {visibleNotes.map((note) => {
          const timeUntilHit = note.time - currentTime;
          const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
          const duration = note.duration ?? 0;
          const lanePercent = note.lane * 25;
          const hitLinePercent = 88;

          if (isLong) {
            // Sustained Long Guitar Tile (Extended Fret Beam)
            const isHolding = note.sustainState === 'holding';
            const progress = note.sustainProgress ?? 0;

            const fullTailHeightPercent = (duration / approachTime) * hitLinePercent;

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
                  touchAction: 'none',
                }}
                /* Long tile: press anywhere on the tile to start sustain hold */
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onTilePointerDown(note.id, note.lane);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onTilePointerUp(note.id, note.lane);
                }}
                onPointerCancel={(e) => {
                  e.stopPropagation();
                  onTilePointerUp(note.id, note.lane);
                }}
                className="px-2 z-20 flex flex-col justify-end cursor-pointer py-2 -my-2"
              >
                {/* Luminous Sustain Fret Beam Body */}
                <div
                  className={`w-full h-full rounded-t-xl border-x-2 border-t-2 relative overflow-hidden transition-all pointer-events-none ${
                    isHolding
                      ? 'bg-gradient-to-t from-yellow-500/90 via-amber-400/60 to-yellow-600/30 border-yellow-200 shadow-[0_0_20px_rgba(250,204,21,1)] animate-pulse'
                      : 'bg-gradient-to-t from-amber-600/80 via-amber-500/40 to-yellow-700/20 border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                  }`}
                >
                  {/* Vibration harmonic waves */}
                  <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_6px,rgba(254,240,138,0.2)_6px,rgba(254,240,138,0.2)_10px)] pointer-events-none" />

                  {/* Sustain Hold Label */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.8)] rotate-[-90deg]">
                      {isHolding ? 'SUSTAIN' : 'HOLD'}
                    </span>
                  </div>
                </div>

                {/* Head Guitar Fret Tile with Progress */}
                <div className={`w-full h-12 sm:h-14 rounded-b-xl border-2 flex items-center justify-center relative shadow-lg pointer-events-none transition-colors ${
                  isHolding
                    ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600 shadow-[0_0_20px_rgba(250,204,21,1)]'
                    : 'border-yellow-300 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700'
                }`}>
                  {/* Sustain Hold Progress Fill */}
                  {isHolding && (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yellow-400/60 to-white/30 transition-all pointer-events-none"
                      style={{ height: `${Math.round(progress * 100)}%` }}
                    />
                  )}

                  {isHolding ? (
                    <span className="relative z-10 text-xs font-mono font-black text-amber-950 drop-shadow-[0_0_4px_#fff]">
                      {Math.round(progress * 100)}%
                    </span>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-yellow-200 bg-yellow-400/80 flex items-center justify-center shadow-[0_0_8px_rgba(250,204,21,0.8)] pointer-events-none">
                      <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm pointer-events-none" />
                    </div>
                  )}

                  {isHolding && (
                    <div className="absolute inset-0 bg-yellow-200/50 animate-pulse rounded-b-xl pointer-events-none" />
                  )}
                </div>
              </div>
            );
          }

          // Short Normal Guitar Fret Tile (Entire container is reliable hit target)
          const isHitBurst = note.hit && note.grade !== 'MISS';
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
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Instantaneous scoring
                onTilePointerDown(note.id, note.lane);
              }}
              className="px-2 z-20 cursor-pointer h-28 sm:h-36 py-2 -my-2"
            >
              <div
                className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-100 ${
                  isHitBurst
                    ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-300 to-yellow-400 shadow-[0_0_35px_rgba(250,204,21,0.95)] scale-105'
                    : 'border-yellow-300 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700 shadow-[0_4px_20px_rgba(250,204,21,0.5)]'
                }`}
              >
                {/* Surface Ping on Hit */}
                {isHitBurst && (
                  <div className="absolute inset-0 bg-white/50 animate-ping rounded-2xl pointer-events-none" />
                )}

                {/* Center pearl inlay */}
                <div className="w-8 h-8 rounded-full border-2 border-yellow-200 bg-yellow-400/80 flex items-center justify-center shadow-[0_0_8px_rgba(250,204,21,0.8)] pointer-events-none mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm pointer-events-none" />
                </div>
                <div className="w-1/2 h-1 bg-yellow-200/60 rounded-full pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

GuitarTilesView.displayName = 'GuitarTilesView';
