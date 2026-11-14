'use client';

import React, { memo } from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Crown, Play } from 'lucide-react';

interface PianoTilesViewProps {
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
  highScore?: number;
}

export const PianoTilesView: React.FC<PianoTilesViewProps> = memo(({
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
  highScore = 0,
}) => {
  const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
  const hitLinePercent = 88;

  // Filter notes that are within visible approach window (and include recently hit tiles for 150ms hit burst)
  const visibleNotes = notes.filter((n) => {
    const duration = n.duration ?? 0;
    const timeUntilEnd = n.time + duration - currentTime;
    const timeUntilStart = n.time - currentTime;

    // Completed long notes or missed notes hide immediately
    if (n.sustainState === 'completed' || (n.hit && n.grade === 'MISS')) return false;

    // Hit short notes stay visible for 150ms to display tactical hit burst feedback
    if (n.hit && n.type !== 'long') {
      const hitAge = (n as any).hitTimestamp ? Date.now() - (n as any).hitTimestamp : 999;
      return hitAge < 150;
    }

    return timeUntilStart <= approachTime && timeUntilEnd >= -goodWindow;
  });

  return (
    <div
      className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#0c071d] select-none border-x border-purple-900/50 shadow-2xl touch-none [isolation:isolate] [contain:paint_layout]"
      onPointerLeave={() => {
        onPointerLeaveArea();
      }}
    >
      {/* 4 Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-white/10 overflow-hidden">
        {/* Hit line receptor guide at 88% from top */}
        <div className="absolute top-[88%] left-0 right-0 h-1 bg-gradient-to-r from-purple-500/30 via-amber-400/80 to-purple-500/30 z-10 shadow-[0_0_15px_rgba(251,191,36,0.6)]" />

        {/* 4 Vertical Lanes — Visual tracks & Interactive Tap Buffers */}
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
                isActive ? 'bg-amber-400/15' : ''
              }`}
            >
              {/* Subtle vertical center guide line */}
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-white/5 pointer-events-none" />

              {/* Active Lane Hit Beam */}
              {isActive && (
                <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-amber-400/30 via-purple-500/15 to-transparent pointer-events-none animate-pulse" />
              )}
            </div>
          );
        })}

        {/* Floating Song Intro Banner (Visible before player taps START) */}
        {isWaitingForStart && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
            <div className="px-6 py-6 rounded-3xl bg-[#140b2e]/90 border border-purple-500/40 shadow-[0_0_40px_rgba(139,92,246,0.3)] backdrop-blur-md max-w-sm w-full space-y-2 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/30 inline-block">
                Solo Arena
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-md">
                {songTitle || 'Praise Song'}
              </h2>
              <p className="text-xs text-purple-300 font-semibold tracking-wider">
                {artist || 'Gospel Melody'}
              </p>
              <div className="flex items-center justify-center gap-1.5 pt-1 text-xs font-mono font-bold text-amber-300">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Highscore: {highScore > 0 ? highScore.toLocaleString() : '---'}</span>
              </div>

              <div className="pt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartGame?.();
                  }}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-black font-black text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(251,191,36,0.8)] hover:scale-102 active:scale-98 transition-transform cursor-pointer flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>START PRAISE</span>
                </button>
              </div>

              <p className="text-[10px] text-gray-400 font-medium pt-1">
                Tap button to begin • Direct touch & tap on tiles
              </p>
            </div>
          </div>
        )}

        {/* Falling Interactive Piano Tiles */}
        {visibleNotes.map((note) => {
          const timeUntilHit = note.time - currentTime;
          const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
          const duration = note.duration ?? 0;
          const lanePercent = note.lane * 25;

          if (isLong) {
            // Sustained Long Tile (Piano Tiles 2 Rounded Cap & Luminous Tail)
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
                  minHeight: '48px',
                  transform: 'translate3d(0, 0, 0)',
                  willChange: 'top, height',
                  backfaceVisibility: 'hidden',
                  touchAction: 'none',
                }}
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
                className="px-1 z-20 flex flex-col justify-end cursor-pointer py-2 -my-2"
              >
                {/* Luminous Sustain Tail Body with Central Dotted Guide */}
                <div
                  className={`w-full h-full rounded-t-xl border-x border-t relative overflow-hidden pointer-events-none ${
                    isHolding
                      ? 'bg-gradient-to-t from-purple-600/90 via-purple-800/70 to-purple-950/40 border-purple-300 shadow-[0_0_18px_rgba(192,132,252,0.8)]'
                      : 'bg-gradient-to-t from-purple-700/80 via-purple-900/60 to-purple-950/30 border-purple-500/40 shadow-[0_0_10px_rgba(168,85,247,0.4)]'
                  }`}
                >
                  {/* Central Luminous Dot Guideline */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 border-l-2 border-dashed border-purple-300/40 pointer-events-none" />

                  {/* Periodic Luminous Guide Rings along Tail */}
                  <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none opacity-40">
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-sm" />
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-sm" />
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-sm" />
                  </div>
                </div>

                {/* Rounded Contact Head Cap with Concentric Touch Circles & Sustain Progress */}
                <div
                  className={`w-full h-12 sm:h-14 rounded-b-2xl border-2 flex items-center justify-center relative overflow-hidden pointer-events-none ${
                    isHolding
                      ? 'border-amber-300 bg-gradient-to-b from-amber-500 via-purple-700 to-purple-950 shadow-[0_0_18px_rgba(251,191,36,0.8)]'
                      : 'border-purple-300 bg-gradient-to-b from-purple-700 via-purple-800 to-purple-950 shadow-[0_0_14px_rgba(168,85,247,0.7)]'
                  }`}
                >
                  {/* Visual Sustain Hold Progress Fill */}
                  {isHolding && (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-400/50 to-yellow-300/30 pointer-events-none"
                      style={{ height: `${Math.round(progress * 100)}%` }}
                    />
                  )}

                  {/* Target Ripple / Bullseye Rings or Progress Percent */}
                  {isHolding ? (
                    <span className="relative z-10 text-xs font-mono font-black text-amber-200 drop-shadow-[0_0_8px_#000]">
                      {Math.round(progress * 100)}%
                    </span>
                  ) : (
                    <div className="relative w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center shadow-sm pointer-events-none">
                      <div className="w-2 h-2 rounded-full bg-white pointer-events-none" />
                    </div>
                  )}

                  {isHolding && (
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-b-2xl pointer-events-none" />
                  )}
                </div>
              </div>
            );
          }

          // Short Standard Tile (Entire container is reliable touch target)
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
                transform: 'translateY(-100%) translateZ(0)',
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                touchAction: 'none',
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                // Instantaneous scoring
                onTilePointerDown(note.id, note.lane);
              }}
              className="px-1 z-20 cursor-pointer h-28 sm:h-36 py-2 -my-2"
            >
              <div
                className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden ${
                  isHitBurst
                    ? 'border-amber-200 bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 shadow-[0_0_24px_rgba(251,191,36,0.9)] scale-105 transition-transform duration-75'
                    : 'border-amber-400/80 bg-gradient-to-b from-[#2d1659] via-[#160c2e] to-[#080413] shadow-[0_4px_16px_rgba(251,191,36,0.35)]'
                }`}
              >
                {/* Surface Sheen */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

                {/* Tactile Hit Pulse Ping */}
                {isHitBurst && (
                  <div className="absolute inset-0 bg-white/40 animate-ping rounded-2xl pointer-events-none" />
                )}

                {/* Central Radiant Golden Rhythm Pill */}
                <div
                  className={`h-2.5 rounded-full pointer-events-none mb-1 ${
                    isHitBurst
                      ? 'w-3/4 bg-white shadow-[0_0_12px_#ffffff]'
                      : 'w-1/2 bg-gradient-to-r from-amber-400 via-yellow-300 to-purple-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]'
                  }`}
                />
                <div className="w-1/4 h-1 bg-amber-400/50 rounded-full pointer-events-none" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

PianoTilesView.displayName = 'PianoTilesView';
