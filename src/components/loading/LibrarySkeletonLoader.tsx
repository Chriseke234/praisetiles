'use client';

/**
 * LibrarySkeletonLoader — Music Library & Streaming Discovery Skeleton
 * 
 * Features:
 * - 6 responsive card placeholders with vinyl aspect ratio
 * - Specular shimmer gradient sweep
 * - Micro-equalizer animation (4 pulsing rhythm bars)
 * - "Discovering your next favourite song..." message
 */

import React from 'react';
import { Music2 } from 'lucide-react';

interface LibrarySkeletonLoaderProps {
  count?: number;
  message?: string;
  reducedMotion?: boolean;
  className?: string;
}

export const LibrarySkeletonLoader: React.FC<LibrarySkeletonLoaderProps> = ({
  count = 6,
  message = 'Discovering your next favourite worship song...',
  reducedMotion = false,
  className = '',
}) => {
  return (
    <div className={`space-y-4 select-none ${className}`}>
      {/* Equalizer Header Indicator */}
      <div className="flex items-center justify-between pb-2 border-b border-gray-800/80">
        <div className="flex items-center gap-2">
          {/* 4 Dancing Equalizer Bars */}
          <div className="flex items-end gap-1 h-4 w-5">
            {[0.4, 0.9, 0.6, 0.8].map((initialScale, idx) => (
              <div
                key={idx}
                style={{
                  animationDelay: `${idx * 0.15}s`,
                  height: '100%',
                }}
                className={`w-1 rounded-full bg-gradient-to-t from-purple-500 to-amber-400 ${
                  !reducedMotion ? 'animate-[equalizerBounce_1.1s_ease-in-out_infinite_alternate]' : ''
                }`}
              />
            ))}
          </div>

          <span className="text-xs font-semibold text-gray-300 tracking-wide">
            {message}
          </span>
        </div>

        <span className="text-[10px] uppercase font-mono tracking-wider text-purple-400">
          Syncing Catalog
        </span>
      </div>

      {/* Grid of Music Skeleton Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-2xl bg-[#130f24]/70 border border-gray-800/80 flex items-center gap-3.5 overflow-hidden relative"
          >
            {/* Shimmer Sweep Animation */}
            {!reducedMotion && (
              <div className="absolute inset-0 -translate-x-full animate-[shimmerSweep_1.8s_infinite] bg-gradient-to-r from-transparent via-purple-500/10 to-transparent pointer-events-none" />
            )}

            {/* Album Artwork Vinyl Placeholder */}
            <div className="w-12 h-12 rounded-xl bg-gray-900 border border-purple-500/20 shrink-0 flex items-center justify-center relative overflow-hidden">
              <div className="w-6 h-6 rounded-full border border-purple-500/40 flex items-center justify-center bg-black/40">
                <div className="w-2 h-2 rounded-full bg-amber-400/60" />
              </div>
            </div>

            {/* Text Skeletons */}
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-3.5 w-3/4 bg-gray-800/80 rounded-md" />
              <div className="h-2.5 w-1/2 bg-gray-900 rounded-md" />
              <div className="h-2 w-1/3 bg-gray-900/60 rounded-md" />
            </div>

            {/* Action Placeholder */}
            <div className="w-16 h-8 rounded-xl bg-gray-900/80 shrink-0" />
          </div>
        ))}
      </div>

      <style jsx global>{`
        @keyframes equalizerBounce {
          0% {
            transform: scaleY(0.3);
          }
          100% {
            transform: scaleY(1);
          }
        }
        @keyframes shimmerSweep {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
};
