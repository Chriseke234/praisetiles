'use client';

import React, { memo, forwardRef, useImperativeHandle, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Play } from 'lucide-react';
import type { TilesViewHandle } from './PianoTilesView';

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

const HIT_LINE_RATIO = 0.88;
const PRELOAD_BUFFER_SEC = 0.6;

export const GuitarTilesView = memo(
  forwardRef<TilesViewHandle, GuitarTilesViewProps>(
    (
      {
        notes,
        currentTime,
        approachTime = GAMEPLAY_CONFIG.APPROACH_TIME_SECONDS,
        activeLanes,
        onTilePointerDown,
        onTilePointerUp,
        onLanePointerDown,
        onPointerLeaveArea,
        reducedMotion,
        isWaitingForStart = false,
        onStartGame,
        songTitle,
        artist,
      },
      ref
    ) => {
      const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
      const firstNoteId = notes.length > 0 ? notes[0].id : null;

      // Cached container height (ResizeObserver — zero layout reads in rAF)
      const lanesContainerRef = useRef<HTMLDivElement | null>(null);
      const containerHeightRef = useRef<number>(640);
      const tileElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
      const notesByIdRef = useRef<Map<string, Note>>(new Map());
      const lastTimeRef = useRef<number>(currentTime);
      const lastApproachRef = useRef<number>(approachTime);

      useEffect(() => {
        const el = lanesContainerRef.current;
        if (!el) return;

        const updateHeight = () => {
          const h = el.clientHeight;
          if (h > 0) containerHeightRef.current = h;
        };
        updateHeight();

        if (typeof ResizeObserver !== 'undefined') {
          const observer = new ResizeObserver(updateHeight);
          observer.observe(el);
          return () => observer.disconnect();
        }
        window.addEventListener('resize', updateHeight);
        return () => window.removeEventListener('resize', updateHeight);
      }, []);

      const visibleNotes = notes.filter((n) => {
        const duration = n.duration ?? 0;
        const timeUntilEnd = n.time + duration - currentTime;
        const timeUntilStart = n.time - currentTime;

        if (n.sustainState === 'completed' || (n.hit && n.grade === 'MISS')) return false;

        if (n.hit && n.type !== 'long') {
          const hitTs = (n as unknown as { hitTimestamp?: number }).hitTimestamp;
          const hitAge = hitTs ? Date.now() - hitTs : 999;
          return hitAge < 150;
        }

        return timeUntilStart <= approachTime + PRELOAD_BUFFER_SEC && timeUntilEnd >= -goodWindow;
      });

      const map = notesByIdRef.current;
      map.clear();
      for (let i = 0; i < visibleNotes.length; i++) {
        map.set(visibleNotes[i].id, visibleNotes[i]);
      }

      const applyPositions = useCallback((time: number, curApproach: number) => {
        lastTimeRef.current = time;
        lastApproachRef.current = curApproach;
        const height = containerHeightRef.current;
        if (height <= 0) return;

        const hitLineY = height * HIT_LINE_RATIO;
        const elements = tileElementsRef.current;
        const noteLookup = notesByIdRef.current;

        elements.forEach((el, noteId) => {
          const note = noteLookup.get(noteId);
          if (!note) return;

          const timeUntilHit = note.time - time;
          const isLong = note.type === 'long' && (note.duration ?? 0) > 0;

          if (isLong) {
            const duration = note.duration ?? 0;
            const isHolding = note.sustainState === 'holding';
            const sustainProg = note.sustainProgress ?? 0;
            const fullTailHeightPx = (duration / curApproach) * hitLineY;

            const headYPx = isHolding
              ? hitLineY
              : (1 - timeUntilHit / curApproach) * hitLineY;
            const currentTailHeightPx = isHolding
              ? Math.max(48, fullTailHeightPx * (1 - sustainProg))
              : Math.max(48, fullTailHeightPx);
            const tailTopYPx = headYPx - currentTailHeightPx;

            el.style.transform = `translate3d(0, ${tailTopYPx}px, 0)`;
            el.style.height = `${currentTailHeightPx}px`;
          } else {
            const progress = 1 - timeUntilHit / curApproach;
            const yPx = progress * hitLineY;
            el.style.transform = `translate3d(0, ${yPx}px, 0) translateY(-100%)`;
          }
        });
      }, []);

      useImperativeHandle(
        ref,
        () => ({
          updatePositions: applyPositions,
        }),
        [applyPositions]
      );

      useLayoutEffect(() => {
        applyPositions(lastTimeRef.current, lastApproachRef.current);
      });

      const setTileRef = useCallback((noteId: string, el: HTMLDivElement | null) => {
        if (el) {
          tileElementsRef.current.set(noteId, el);
        } else {
          tileElementsRef.current.delete(noteId);
        }
      }, []);

      return (
        <div
          className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#0a0705] select-none border-x-2 border-amber-900/60 shadow-2xl touch-none [isolation:isolate] [contain:paint_layout]"
          onPointerLeave={() => {
            onPointerLeaveArea();
          }}
        >
          {/* 4 Fretboard Lanes Container */}
          <div
            ref={lanesContainerRef}
            className="relative w-full flex-1 grid grid-cols-4 divide-x divide-amber-950/70 overflow-hidden"
          >
            {/* Horizontal Fret Bars */}
            <div className="absolute top-[20%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
            <div className="absolute top-[40%] left-0 right-0 h-[1px] bg-amber-800/30 pointer-events-none" />
            <div className="absolute top-[60%] left-0 right-0 h-[1px] bg-amber-800/40 pointer-events-none" />

            {/* Hit Bar at 88% */}
            <div className="absolute top-[88%] left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500/70 via-yellow-300 to-amber-500/70 z-10 shadow-[0_0_15px_rgba(245,158,11,0.8)] pointer-events-none" />

            {/* 4 Guitar Lanes */}
            {[0, 1, 2, 3].map((lane) => {
              const isActive = activeLanes[lane];
              return (
                <div
                  key={lane}
                  onPointerDown={() => {
                    onLanePointerDown?.(lane);
                  }}
                  className={`relative h-full flex flex-col justify-end cursor-pointer transition-colors duration-75 ${
                    isActive ? 'bg-amber-500/25' : ''
                  }`}
                >
                  <div
                    className={`absolute inset-y-0 left-1/2 -translate-x-1/2 pointer-events-none transition-all ${
                      isActive
                        ? 'w-1 bg-yellow-200 shadow-[0_0_10px_rgba(250,204,21,1)]'
                        : 'w-[2px] bg-gradient-to-b from-amber-600/50 via-yellow-600/70 to-amber-500'
                    }`}
                  />
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-amber-500/35 via-yellow-500/15 to-transparent pointer-events-none" />
                  )}
                </div>
              );
            })}

            {/* Non-blocking Floating Song Intro Banner */}
            {isWaitingForStart && firstNoteId && (
              <div className="absolute top-4 inset-x-4 z-30 flex justify-center pointer-events-none animate-fadeIn">
                <div className="px-5 py-3.5 rounded-2xl bg-[#1c0f05]/90 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)] backdrop-blur-md max-w-xs w-full text-center space-y-1">
                  <h2 className="text-base sm:text-lg font-black text-white tracking-wide truncate">
                    {songTitle || 'Praise Track'}
                  </h2>
                  <p className="text-[11px] text-amber-300 font-semibold tracking-wider truncate">
                    {artist || 'Acoustic Worship'}
                  </p>
                  <p className="text-[10px] text-amber-200/90 font-bold uppercase tracking-widest pt-1">
                    Tap the START tile below to begin
                  </p>
                </div>
              </div>
            )}

            {/* Fallback Start Button */}
            {isWaitingForStart && !firstNoteId && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartGame?.();
                  }}
                  className="py-3.5 px-8 rounded-2xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-black font-black text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(251,191,36,0.8)] cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-black" />
                  <span>START PRAISE</span>
                </button>
              </div>
            )}

            {/* Falling Guitar Tiles (GPU translate3d positioned) */}
            {visibleNotes.map((note) => {
              const timeUntilHit = note.time - lastTimeRef.current;
              const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
              const duration = note.duration ?? 0;
              const lanePercent = note.lane * 25;
              const isStartTile = isWaitingForStart && note.id === firstNoteId;
              const hitLineY = containerHeightRef.current * HIT_LINE_RATIO;

              if (isLong) {
                const isHolding = note.sustainState === 'holding';
                const progress = note.sustainProgress ?? 0;
                const fullTailHeightPx = (duration / lastApproachRef.current) * hitLineY;
                const headYPx = isHolding
                  ? hitLineY
                  : (1 - timeUntilHit / lastApproachRef.current) * hitLineY;
                const currentTailHeightPx = isHolding
                  ? Math.max(48, fullTailHeightPx * (1 - progress))
                  : Math.max(48, fullTailHeightPx);
                const tailTopYPx = headYPx - currentTailHeightPx;

                return (
                  <div
                    key={note.id}
                    ref={(el) => setTileRef(note.id, el)}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: `${lanePercent}%`,
                      width: '25%',
                      height: `${currentTailHeightPx}px`,
                      minHeight: '48px',
                      transform: `translate3d(0, ${tailTopYPx}px, 0)`,
                      willChange: 'transform',
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
                    className={`px-2 flex flex-col justify-end cursor-pointer py-2 -my-2 ${
                      isStartTile ? 'z-30' : 'z-20'
                    }`}
                  >
                    <div
                      className={`w-full h-full rounded-t-xl border-x-2 border-t-2 relative overflow-hidden pointer-events-none ${
                        isHolding
                          ? 'bg-gradient-to-t from-yellow-500/90 via-amber-400/60 to-yellow-600/30 border-yellow-200'
                          : 'bg-gradient-to-t from-amber-600/80 via-amber-500/40 to-yellow-700/20 border-amber-400'
                      }`}
                    >
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-white rotate-[-90deg]">
                          {isHolding ? 'SUSTAIN' : 'HOLD'}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`w-full h-12 sm:h-14 rounded-b-xl border-2 flex items-center justify-center relative pointer-events-none ${
                        isHolding
                          ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-600'
                          : 'border-yellow-300 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700'
                      }`}
                    >
                      {isHolding && (
                        <div
                          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-yellow-400/60 to-white/30 pointer-events-none"
                          style={{ height: `${Math.round(progress * 100)}%` }}
                        />
                      )}

                      {isHolding ? (
                        <span className="relative z-10 text-xs font-mono font-black text-amber-950">
                          {Math.round(progress * 100)}%
                        </span>
                      ) : isStartTile ? (
                        <span className="relative z-10 text-[10px] font-black tracking-widest uppercase text-black bg-yellow-200 px-2 py-0.5 rounded-full shadow-md animate-pulse">
                          START
                        </span>
                      ) : (
                        <div className="w-8 h-8 rounded-full border-2 border-yellow-200 bg-yellow-400/80 flex items-center justify-center pointer-events-none">
                          <div className="w-2.5 h-2.5 rounded-full bg-white pointer-events-none" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Short Guitar Tile
              const isHitBurst = note.hit && note.grade !== 'MISS';
              const progress = 1 - timeUntilHit / lastApproachRef.current;
              const yPx = progress * hitLineY;

              return (
                <div
                  key={note.id}
                  ref={(el) => setTileRef(note.id, el)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: `${lanePercent}%`,
                    width: '25%',
                    transform: `translate3d(0, ${yPx}px, 0) translateY(-100%)`,
                    willChange: 'transform',
                    backfaceVisibility: 'hidden',
                    touchAction: 'none',
                  }}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onTilePointerDown(note.id, note.lane);
                  }}
                  className={`px-2 cursor-pointer h-28 sm:h-36 py-2 -my-2 ${
                    isStartTile ? 'z-30' : 'z-20'
                  }`}
                >
                  <div
                    className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden ${
                      isHitBurst
                        ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-300 to-yellow-400 scale-105'
                        : isStartTile
                        ? 'border-yellow-200 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 shadow-[0_0_28px_rgba(250,204,21,0.9)]'
                        : 'border-yellow-300 bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-700'
                    }`}
                  >
                    {(isHitBurst || (isStartTile && !reducedMotion)) && (
                      <div className="absolute inset-0 bg-white/30 animate-pulse rounded-2xl pointer-events-none" />
                    )}

                    {isStartTile ? (
                      <div className="relative z-10 flex flex-col items-center justify-center gap-1 px-1 text-center pointer-events-none">
                        <Play className="w-5 h-5 text-black fill-black" />
                        <span className="text-[10px] sm:text-xs font-black tracking-widest uppercase text-black leading-tight">
                          TAP TO
                          <br />
                          START
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full border-2 border-yellow-200 bg-yellow-400/80 flex items-center justify-center pointer-events-none mb-1">
                          <div className="w-2.5 h-2.5 rounded-full bg-white pointer-events-none" />
                        </div>
                        <div className="w-1/2 h-1 bg-yellow-200/60 rounded-full pointer-events-none" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
  )
);

GuitarTilesView.displayName = 'GuitarTilesView';
