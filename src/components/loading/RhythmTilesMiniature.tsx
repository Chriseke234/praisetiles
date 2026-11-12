'use client';

/**
 * RhythmTilesMiniature — 4-Lane Animated Gameplay Highway
 * 
 * Accurately models PraiseTiles rhythm game mechanics during loading:
 * - 4 distinct lane colorways (Purple, Violet, Amber, Rose)
 * - Gentle vertical descent toward an illuminated strike line
 * - Subdued rhythmic tap flashes at the judgment line
 * - Split mode support for flanking the animated vinyl on desktop soundstages
 * - Lightweight pure CSS transforms with prefers-reduced-motion support
 */

import React, { useEffect, useState } from 'react';

interface RhythmTilesMiniatureProps {
  mode?: 'full' | 'left-pair' | 'right-pair'; // 'full' = 4 lanes, pairs = 2 lanes for flanking
  height?: number; // pixel height, defaults to 220
  reducedMotion?: boolean;
  className?: string;
}

interface MiniTile {
  id: string;
  lane: number;
  progress: number; // 0 to 1
  speed: number;
}

export const RhythmTilesMiniature: React.FC<RhythmTilesMiniatureProps> = ({
  mode = 'full',
  height = 200,
  reducedMotion = false,
  className = '',
}) => {
  // Determine which lanes to render based on mode
  const lanes = mode === 'left-pair' ? [0, 1] : mode === 'right-pair' ? [2, 3] : [0, 1, 2, 3];

  const laneThemes = [
    {
      name: 'Lane 1',
      border: 'border-purple-500/30',
      activeBg: 'bg-gradient-to-b from-purple-500/80 to-purple-600',
      glow: 'shadow-[0_0_14px_rgba(168,85,247,0.6)]',
      lineAccent: 'bg-purple-400',
    },
    {
      name: 'Lane 2',
      border: 'border-violet-500/30',
      activeBg: 'bg-gradient-to-b from-violet-400/90 to-violet-600',
      glow: 'shadow-[0_0_14px_rgba(139,92,246,0.6)]',
      lineAccent: 'bg-violet-300',
    },
    {
      name: 'Lane 3',
      border: 'border-amber-500/30',
      activeBg: 'bg-gradient-to-b from-amber-400/90 to-amber-600',
      glow: 'shadow-[0_0_16px_rgba(245,158,11,0.65)]',
      lineAccent: 'bg-amber-300',
    },
    {
      name: 'Lane 4',
      border: 'border-rose-500/30',
      activeBg: 'bg-gradient-to-b from-pink-400/90 to-rose-600',
      glow: 'shadow-[0_0_14px_rgba(244,63,94,0.6)]',
      lineAccent: 'bg-rose-300',
    },
  ];

  // Procedural falling tiles for a soothing, non-distracting ambient rhythm loop
  const [activeTiles, setActiveTiles] = useState<MiniTile[]>([
    { id: 't1', lane: lanes[0], progress: 0.25, speed: 0.006 },
    { id: 't2', lane: lanes[1 % lanes.length], progress: 0.65, speed: 0.007 },
    { id: 't3', lane: lanes[lanes.length - 1], progress: 0.05, speed: 0.0065 },
  ]);

  const [hitLanes, setHitLanes] = useState<{ [laneIndex: number]: boolean }>({});

  useEffect(() => {
    if (reducedMotion) return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const delta = (currentTime - lastTime) / 16.66; // Normalized to 60fps
      lastTime = currentTime;

      setActiveTiles((prevTiles) => {
        return prevTiles.map((tile) => {
          let nextProg = tile.progress + tile.speed * delta;

          // Hit feedback right as tile crosses the judgment line (progress ~ 0.85)
          if (tile.progress < 0.85 && nextProg >= 0.85) {
            setHitLanes((prev) => ({ ...prev, [tile.lane]: true }));
            setTimeout(() => {
              setHitLanes((prev) => ({ ...prev, [tile.lane]: false }));
            }, 180);
          }

          // Reset loop
          if (nextProg > 1.05) {
            nextProg = 0;
          }

          return { ...tile, progress: nextProg };
        });
      });

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [reducedMotion, lanes]);

  return (
    <div
      style={{ height }}
      className={`relative flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-3 bg-[#0d0a1a]/80 border border-purple-500/20 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden select-none ${className}`}
    >
      {/* Background Halftone & Lane Guides */}
      <div className="absolute inset-0 bg-halftone-dots opacity-15 pointer-events-none" />

      {/* Judgment Line (Strike Bar) at 85% depth */}
      <div className="absolute bottom-5 left-1 right-1 h-1 bg-gradient-to-r from-purple-500 via-amber-400 to-rose-500 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.6)] z-10 opacity-80" />

      {/* Individual Lanes */}
      {lanes.map((laneIdx) => {
        const theme = laneThemes[laneIdx];
        const isHit = hitLanes[laneIdx];
        const laneTiles = activeTiles.filter((t) => t.lane === laneIdx);

        return (
          <div
            key={laneIdx}
            className={`relative flex-1 h-full rounded-xl bg-black/40 border ${theme.border} flex flex-col justify-end items-center overflow-hidden transition-colors duration-150 ${
              isHit ? 'bg-purple-900/25' : ''
            }`}
          >
            {/* Ambient Lane Light Stripe */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none" />

            {/* Falling Tiles */}
            {!reducedMotion ? (
              laneTiles.map((tile) => {
                const topPercent = Math.min(100, Math.max(0, tile.progress * 100));
                return (
                  <div
                    key={tile.id}
                    style={{ top: `${topPercent}%` }}
                    className={`absolute w-[80%] h-6 sm:h-7 rounded-lg ${theme.activeBg} ${theme.glow} border border-white/40 transform -translate-y-1/2 transition-shadow`}
                  >
                    {/* Inner Tile Specular Bevel */}
                    <div className="w-full h-1 bg-white/50 rounded-t-lg" />
                  </div>
                );
              })
            ) : (
              /* Static gentle tile for reduced-motion */
              <div
                style={{ top: '50%' }}
                className={`absolute w-[80%] h-6 rounded-lg ${theme.activeBg} border border-white/30`}
              />
            )}

            {/* Hit Bloom Ring at Strike Bar */}
            <div
              className={`absolute bottom-4 w-7 h-2 rounded-full ${theme.lineAccent} blur-sm transition-opacity duration-150 pointer-events-none ${
                isHit ? 'opacity-100 scale-125' : 'opacity-0'
              }`}
            />
          </div>
        );
      })}
    </div>
  );
};
