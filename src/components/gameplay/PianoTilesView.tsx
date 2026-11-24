'use client';

import React, { memo, forwardRef, useImperativeHandle, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { Note } from '@/types/game';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { Crown, Play } from 'lucide-react';

export interface TilesViewHandle {
  /**
   * Imperatively updates every mounted tile's GPU transform at 60-120fps
   * without triggering React re-renders or CSS layout recalculations.
   */
  updatePositions: (currentTime: number, approachTime: number) => void;
}

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

const HIT_LINE_RATIO = 0.88;
const PRELOAD_BUFFER_SEC = 0.6; // Mount tiles 600ms before top edge so GPU transforms start smoothly off-screen

export const PianoTilesView = memo(
  forwardRef<TilesViewHandle, PianoTilesViewProps>(
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
        highScore = 0,
      },
      ref
    ) => {
      const goodWindow = GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC;
      const firstNoteId = notes.length > 0 ? notes[0].id : null;

      // Cached container height (updated only via ResizeObserver — zero layout reads in rAF)
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

      // Filter notes within the visible + preload window
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

      // Keep fast O(1) lookup map synced for imperative rAF updates
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

            let headYPx: number;
            let currentTailHeightPx: number;

            if (isHolding) {
              headYPx = hitLineY;
              currentTailHeightPx = Math.max(48, fullTailHeightPx * (1 - sustainProg));
            } else {
              const headProgress = 1 - timeUntilHit / curApproach;
              headYPx = headProgress * hitLineY;
              currentTailHeightPx = Math.max(48, fullTailHeightPx);
            }

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

      // Re-apply live GPU transforms synchronously before paint whenever React re-renders
      // (e.g. when start banner closes or activeLanes flashes) so tiles never stall or snap back
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
          className="relative w-full h-full max-w-lg mx-auto flex flex-col justify-between overflow-hidden bg-[#0c071d] select-none border-x border-purple-900/50 shadow-2xl touch-none [isolation:isolate] [contain:paint_layout]"
          onPointerLeave={() => {
            onPointerLeaveArea();
          }}
        >
          {/* 4 Lanes Container */}
          <div
            ref={lanesContainerRef}
            className="relative w-full flex-1 grid grid-cols-4 divide-x divide-white/10 overflow-hidden"
          >
            {/* Hit line receptor guide at 88% from top */}
            <div className="absolute top-[88%] left-0 right-0 h-1 bg-gradient-to-r from-purple-500/30 via-amber-400/80 to-purple-500/30 z-10 shadow-[0_0_15px_rgba(251,191,36,0.6)] pointer-events-none" />

            {/* 4 Vertical Lanes — Visual tracks & Interactive Tap Buffers */}
            {[0, 1, 2, 3].map((lane) => {
              const isActive = activeLanes[lane];
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
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-white/5 pointer-events-none" />
                  {isActive && (
                    <div className="absolute inset-x-0 bottom-0 top-0 bg-gradient-to-t from-amber-400/30 via-purple-500/15 to-transparent pointer-events-none" />
                  )}
                </div>
              );
            })}

            {/* Falling Interactive Piano Tiles (GPU translate3d positioned) */}
            {visibleNotes.map((note) => {
              const timeUntilHit = note.time - lastTimeRef.current;
              const isLong = note.type === 'long' && (note.duration ?? 0) > 0;
              const duration = note.duration ?? 0;
              const lanePercent = note.lane * 25;
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
                    className="px-1 flex flex-col justify-end cursor-pointer py-2 -my-2 z-20"
                  >
                    <div
                      className={`w-full h-full rounded-t-xl border-x border-t relative overflow-hidden pointer-events-none ${
                        isHolding
                          ? 'bg-gradient-to-t from-purple-600/90 via-purple-800/70 to-purple-950/40 border-purple-300 shadow-[0_0_16px_rgba(192,132,252,0.75)]'
                          : 'bg-gradient-to-t from-purple-700/80 via-purple-900/60 to-purple-950/30 border-purple-500/40'
                      }`}
                    >
                      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 border-l-2 border-dashed border-purple-300/40 pointer-events-none" />
                    </div>

                    <div
                      className={`w-full h-12 sm:h-14 rounded-b-2xl border-2 flex items-center justify-center relative overflow-hidden pointer-events-none ${
                        isHolding
                          ? 'border-amber-300 bg-gradient-to-b from-amber-500 via-purple-700 to-purple-950'
                          : 'border-purple-300 bg-gradient-to-b from-purple-700 via-purple-800 to-purple-950'
                      }`}
                    >
                      {isHolding && (
                        <div
                          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-amber-400/50 to-yellow-300/30 pointer-events-none"
                          style={{ height: `${Math.round(progress * 100)}%` }}
                        />
                      )}

                      {isHolding ? (
                        <span className="relative z-10 text-xs font-mono font-black text-amber-200">
                          {Math.round(progress * 100)}%
                        </span>
                      ) : (
                        <div className="relative w-6 h-6 rounded-full border-2 border-white/80 flex items-center justify-center pointer-events-none">
                          <div className="w-2 h-2 rounded-full bg-white pointer-events-none" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              // Short Standard Tile (GPU translate3d from top: 0)
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
                  className="px-1 cursor-pointer h-28 sm:h-36 py-2 -my-2 z-20"
                >
                  <div
                    className={`w-full h-full rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden ${
                      isHitBurst
                        ? 'border-amber-200 bg-gradient-to-b from-amber-300 via-amber-400 to-yellow-500 scale-105'
                        : 'border-amber-400/80 bg-gradient-to-b from-[#2d1659] via-[#160c2e] to-[#080413]'
                    }`}
                  >
                    <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-white/5 to-transparent pointer-events-none" />

                    {isHitBurst && (
                      <div className="absolute inset-0 bg-white/25 animate-pulse rounded-2xl pointer-events-none" />
                    )}

                    <div
                      className={`h-2.5 rounded-full pointer-events-none mb-1 ${
                        isHitBurst
                          ? 'w-3/4 bg-white'
                          : 'w-1/2 bg-gradient-to-r from-amber-400 via-yellow-300 to-purple-400'
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
    }
  )
);

PianoTilesView.displayName = 'PianoTilesView';
