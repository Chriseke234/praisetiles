'use client';

/**
 * ArenaProgressBar — Calibrated & Honest Rhythm Progress Indicator
 * 
 * Features:
 * - Violet-to-Gold gradient progression with soft neon bloom
 * - Honest behavior: Exact percentage shown ONLY when progress is genuinely measurable
 * - Indeterminate sweep mode with fluid shimmer when progress cannot be computed
 * - Subtext operation label with monospaced telemetry
 * - Respects prefers-reduced-motion
 */

import React from 'react';

interface ArenaProgressBarProps {
  progress?: number; // 0 to 100, or undefined for indeterminate
  statusText?: string;
  substatusText?: string;
  showPercentage?: boolean;
  reducedMotion?: boolean;
  className?: string;
}

export const ArenaProgressBar: React.FC<ArenaProgressBarProps> = ({
  progress,
  statusText,
  substatusText,
  showPercentage = true,
  reducedMotion = false,
  className = '',
}) => {
  const isMeasurable = typeof progress === 'number' && !isNaN(progress);
  const clampedProgress = isMeasurable ? Math.min(100, Math.max(0, progress)) : 0;

  return (
    <div className={`w-full max-w-md mx-auto space-y-2 select-none ${className}`}>
      {/* Top Header: Status Label + Percentage (if measurable) */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="text-gray-300 tracking-wide font-medium truncate max-w-[280px]">
          {statusText || 'Entering Gospel Rhythm Arena'}
        </span>

        {isMeasurable && showPercentage && (
          <span className="text-amber-400 font-mono font-bold shrink-0 ml-2">
            {Math.round(clampedProgress)}%
          </span>
        )}
      </div>

      {/* Progress Track */}
      <div className="relative h-2 sm:h-2.5 w-full bg-black/60 border border-purple-500/30 rounded-full overflow-hidden shadow-inner backdrop-blur-md">
        {/* Track Ambient Glow */}
        <div className="absolute inset-0 bg-purple-950/20" />

        {isMeasurable ? (
          /* Measurable Fill */
          <div
            style={{ width: `${clampedProgress}%` }}
            className={`h-full rounded-full bg-gradient-to-r from-purple-600 via-violet-500 to-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] transition-all duration-300 ease-out`}
          >
            {/* Leading Edge Light Specular */}
            <div className="w-1.5 h-full bg-white/70 ml-auto rounded-full blur-[0.5px]" />
          </div>
        ) : (
          /* Indeterminate Sweeping Beam */
          <div
            className={`h-full w-2/5 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_16px_rgba(251,191,36,0.7)] ${
              reducedMotion
                ? 'w-full opacity-60 bg-purple-500'
                : 'animate-[indeterminateSweep_1.6s_ease-in-out_infinite]'
            }`}
          />
        )}
      </div>

      {/* Monospaced Substatus or Helpful Telemetry */}
      {substatusText && (
        <p className="text-[11px] text-gray-500 text-center font-mono tracking-tight truncate">
          {substatusText}
        </p>
      )}

      {/* Custom Keyframe Styles for Indeterminate Sweep */}
      <style jsx global>{`
        @keyframes indeterminateSweep {
          0% {
            transform: translateX(-120%);
          }
          50% {
            transform: translateX(160%);
          }
          100% {
            transform: translateX(340%);
          }
        }
      `}</style>
    </div>
  );
};
