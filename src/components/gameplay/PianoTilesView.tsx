'use client';

import React from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Crown } from 'lucide-react';

interface PianoTilesViewProps {
  notes: readonly Note[];
  currentTime: number;
  approachTime?: number;
  activeLanes: boolean[];
  /** Called when the player taps/clicks directly on a falling tile */
  onTilePointerDown: (noteId: string, lane: number) => void;
  /** Called when the player releases a falling tile */
  onTilePointerUp: (noteId: string, lane: number) => void;
  /** Called when pointer leaves the game area (cancel all sustains) */
  onPointerLeaveArea: () => void;
  reducedMotion: boolean;
  isWaitingForStart?: boolean;
  onStartGame?: () => void;
  songTitle?: string;
  artist?: string;
  highScore?: number;
}

export const PianoTilesView: React.FC<PianoTilesViewProps> = ({
  notes,
  currentTime,
  approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS,
  activeLanes,
  onTilePointerDown,
  onTilePointerUp,
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

  // Filter notes that are within visible approach window
  const visibleNotes = notes.filter((n) => {
    const duration = n.duration ?? 0;
    const timeUntilEnd = n.time + duration - currentTime;
    const timeUntilStart = n.time - currentTime;

    // If already hit and not a long note, hide it
    if (n.hit && n.type !== 'long') return false;
    // If long note finished holding or missed, hide it
    if (n.sustainState === 'completed' || (n.hit && n.grade === 'MISS')) return false;

    // In waiting state, always keep the first note visible so player can tap "START"
    if (isWaitingForStart && n.id === notes[0]?.id) return true;

    return timeUntilStart <= approachTime && timeUntilEnd >= -goodWindow;
  });

  const firstNote = notes[0];

  return (
    <div
      className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-transparent select-none border-x border-purple-900/40 touch-none"
      onPointerLeave={() => {
        onPointerLeaveArea();
      }}
    >
      {/* 4 Lanes Container */}
      <div className="relative w-full flex-1 grid grid-cols-4 divide-x divide-white/10 overflow-hidden">
        {/* Hit line receptor guide at 88% from top */}
        <div className="absolute top-[88%] left-0 right-0 h-1 bg-gradient-to-r from-purple-500/30 via-amber-400/80 to-purple-500/30 z-10 shadow-[0_0_15px_rgba(251,191,36,0.6)]" />

        {/* 4 Vertical Lanes — Visual tracks */}
        {[0, 1, 2, 3].map((lane) => {
          const isActive = activeLanes[lane];
          return (
            <div
              key={lane}
              className={`relative h-full flex flex-col justify-end pointer-events-none transition-colors duration-75 ${
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
          <div className="absolute top-[28%] inset-x-4 z-20 pointer-events-none flex flex-col items-center text-center animate-fadeIn">
            <div className="px-6 py-4 rounded-2xl bg-[#140b2e]/80 border border-purple-500/30 shadow-2xl backdrop-blur-md max-w-sm w-full space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide drop-shadow-md">
                {songTitle || 'Praise Song'}
              </h2>
              <p className="text-xs text-purple-300 font-semibold tracking-wider">
                {artist || 'Gospel Melody'}
              </p>
              <div className="flex items-center justify-center gap-1.5 pt-2 text-xs font-mono font-bold text-amber-300">
                <Crown className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>Highscore: {highScore > 0 ? highScore.toLocaleString() : '---'}</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-300/80 font-bold uppercase tracking-widest mt-4 animate-pulse">
              Tap START to Praise
            </p>
          </div>
        )}

        {/* Falling Interactive Piano Tiles */}
        {visibleNotes.map((note) => {
          const isFirstNote = isWaitingForStart && note.id === firstNote?.id;
          const timeUntilHit = note.time - currentTime;
          const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
          const duration = note.duration ?? 0;
          const lanePercent = note.lane * 25;

          // If this is the START note waiting for kickoff
          if (isFirstNote) {
            return (
              <div
                key={note.id}
                style={{
                  position: 'absolute',
                  left: `${lanePercent}%`,
                  width: '25%',
                  top: '64%',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (onStartGame) {
                    onStartGame();
                  } else {
                    onTilePointerDown(note.id, note.lane);
                  }
                }}
                className="px-1 z-25 cursor-pointer animate-pulse"
              >
                <div className="w-full h-24 sm:h-28 rounded-xl bg-gradient-to-b from-[#241344] via-[#150a2b] to-[#0a0515] border-2 border-amber-400 shadow-[0_0_25px_rgba(251,191,36,0.85)] flex flex-col items-center justify-center gap-1 transition-transform hover:scale-105 active:scale-95">
                  <span className="text-base sm:text-lg font-black tracking-widest text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]">
                    START
                  </span>
                  <div className="w-8 h-1 rounded-full bg-amber-400 shadow-[0_0_6px_#fbbf24]" />
                </div>
              </div>
            );
          }

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
                  willChange: 'top, height',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  onTilePointerDown(note.id, note.lane);
                }}
                onPointerUp={(e) => {
                  e.stopPropagation();
                  onTilePointerUp(note.id, note.lane);
                }}
                className="px-1 z-15 flex flex-col justify-end cursor-pointer"
              >
                {/* Luminous Sustain Tail Body with Central Dotted Guide */}
                <div
                  className={`w-full h-full rounded-t-xl border-x border-t relative overflow-hidden transition-all ${
                    isHolding
                      ? 'bg-gradient-to-t from-purple-600/90 via-purple-800/70 to-purple-950/40 border-purple-300 shadow-[0_0_25px_rgba(192,132,252,0.9)]'
                      : 'bg-gradient-to-t from-purple-700/80 via-purple-900/60 to-purple-950/30 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.5)]'
                  }`}
                >
                  {/* Central Luminous Dot Guideline */}
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 border-l-2 border-dashed border-purple-300/40" />

                  {/* Periodic Luminous Guide Rings along Tail */}
                  <div className="absolute inset-0 flex flex-col justify-around items-center pointer-events-none opacity-40">
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-[0_0_6px_#fff]" />
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-[0_0_6px_#fff]" />
                    <div className="w-2 h-2 rounded-full bg-purple-200 shadow-[0_0_6px_#fff]" />
                  </div>
                </div>

                {/* Rounded Contact Head Cap with Concentric Touch Circles */}
                <div
                  className={`w-full h-12 sm:h-14 rounded-b-2xl border-2 bg-gradient-to-b from-purple-700 via-purple-800 to-purple-950 border-purple-300 shadow-[0_0_20px_rgba(168,85,247,0.9)] flex items-center justify-center relative overflow-hidden`}
                >
                  {/* Target Ripple / Bullseye Rings */}
                  <div className="relative w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center shadow-[0_0_8px_#ffffff]">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_6px_#ffffff]" />
                  </div>

                  {isHolding && (
                    <div className="absolute inset-0 bg-white/30 animate-ping rounded-b-2xl pointer-events-none" />
                  )}
                </div>
              </div>
            );
          }

          // Short Standard Tile (Deep Obsidian Purple with Subtle Shine)
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
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                onTilePointerDown(note.id, note.lane);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                onTilePointerUp(note.id, note.lane);
              }}
              className="px-1 z-15 cursor-pointer"
            >
              <div
                className={`w-full h-16 sm:h-20 rounded-xl border border-purple-400/40 bg-gradient-to-b from-[#221344] via-[#140b29] to-[#090414] shadow-[0_4px_15px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden transition-transform ${
                  !reducedMotion ? 'hover:scale-[1.03] active:scale-95' : ''
                }`}
              >
                {/* Surface Sheen */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                {/* Central Soft Ambient Glow */}
                <div className="w-1/3 h-1 bg-purple-300/60 rounded-full shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
