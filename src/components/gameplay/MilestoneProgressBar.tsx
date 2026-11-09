'use client';

import React, { memo } from 'react';
import { Star, Crown } from 'lucide-react';

interface MilestoneProgressBarProps {
  progressPercent: number; // 0 to 100
  score: number;
}

interface Milestone {
  type: 'star' | 'crown';
  percent: number;
  label: string;
}

const MILESTONES: Milestone[] = [
  { type: 'star',  percent: 18, label: 'Star 1' },
  { type: 'star',  percent: 36, label: 'Star 2' },
  { type: 'star',  percent: 54, label: 'Star 3' },
  { type: 'crown', percent: 70, label: 'Crown 1' },
  { type: 'crown', percent: 85, label: 'Crown 2' },
  { type: 'crown', percent: 100, label: 'Crown 3' },
];

export const MilestoneProgressBar: React.FC<MilestoneProgressBarProps> = memo(({
  progressPercent,
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="relative w-full max-w-md mx-auto px-4 py-2 flex flex-col items-center">
      {/* Background Track */}
      <div className="relative w-full h-1.5 bg-white/20 rounded-full overflow-visible flex items-center shadow-inner">
        {/* Active Filled Progress Bar */}
        <div
          className="h-full bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-200 rounded-full transition-all duration-150 ease-out shadow-[0_0_12px_rgba(251,191,36,0.9)] relative"
          style={{ width: `${clampedProgress}%` }}
        >
          {/* Glowing Leading Head Dot */}
          {clampedProgress > 0 && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-[0_0_8px_#ffffff] pointer-events-none" />
          )}
        </div>

        {/* Milestone Icons along the Track */}
        {MILESTONES.map((m, idx) => {
          const isReached = clampedProgress >= m.percent;
          return (
            <div
              key={idx}
              className="absolute -top-3.5 -translate-x-1/2 flex items-center justify-center transition-transform duration-200 pointer-events-none"
              style={{ left: `${m.percent}%` }}
            >
              {m.type === 'star' ? (
                <div
                  className={`transition-all duration-300 ${
                    isReached
                      ? 'text-amber-400 scale-110 drop-shadow-[0_0_8px_rgba(251,191,36,0.9)]'
                      : 'text-white/40 scale-90'
                  }`}
                >
                  <Star
                    className="w-4 h-4"
                    fill={isReached ? '#fbbf24' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isReached ? 1.5 : 1}
                  />
                </div>
              ) : (
                <div
                  className={`transition-all duration-300 ${
                    isReached
                      ? 'text-yellow-300 scale-125 drop-shadow-[0_0_10px_rgba(253,224,71,1)]'
                      : 'text-white/40 scale-95'
                  }`}
                >
                  <Crown
                    className="w-4 h-4"
                    fill={isReached ? '#fde047' : 'rgba(255,255,255,0.2)'}
                    strokeWidth={isReached ? 1.5 : 1}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

MilestoneProgressBar.displayName = 'MilestoneProgressBar';
