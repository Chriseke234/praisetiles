'use client';

import React, { memo } from 'react';
import { HitGrade } from '@/types/game';

interface GameplayEffectsOverlayProps {
  latestJudgement: {
    grade: HitGrade;
    lane: number;
    key: number;
  } | null;
  combo: number;
  currentPerfectStreak: number;
  sustainBonusAwarded?: {
    key: number;
    points: number;
  } | null;
  reducedMotion?: boolean;
}

export const GameplayEffectsOverlay: React.FC<GameplayEffectsOverlayProps> = memo(({
  latestJudgement,
  combo,
  currentPerfectStreak,
  sustainBonusAwarded,
  reducedMotion = false,
}) => {
  // Determine Combo Fire Tier
  // Tier 0: <10 hits (none)
  // Tier 1: 10-24 hits (subtle cyan aura)
  // Tier 2: 25-49 hits (golden solar pulse)
  // Tier 3: 50-99 hits (Combo Fire: animated flame particles)
  // Tier 4: 100+ hits (Blazing Praise: celestial radiant aurora)
  const fireTier = combo >= 100 ? 4 : combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;

  return (
    <div className="absolute inset-0 pointer-events-none z-30 overflow-hidden flex flex-col justify-between select-none">
      {/* Screen edge Miss Flash */}
      {latestJudgement?.grade === 'MISS' && (
        <div className="absolute inset-0 bg-red-600/20 border-4 border-red-500/60 animate-ping duration-300 pointer-events-none" />
      )}

      {/* Top Combo Fire Ambient Glow (Placed behind HUD without blocking tiles) */}
      {fireTier > 0 && !reducedMotion && (
        <div
          className={`absolute top-0 inset-x-0 h-28 transition-all duration-700 pointer-events-none ${
            fireTier === 4
              ? 'bg-gradient-to-b from-purple-600/35 via-amber-500/20 to-transparent shadow-[0_0_50px_rgba(217,70,239,0.3)]'
              : fireTier === 3
              ? 'bg-gradient-to-b from-orange-600/30 via-amber-500/20 to-transparent shadow-[0_0_40px_rgba(249,115,22,0.3)]'
              : fireTier === 2
              ? 'bg-gradient-to-b from-amber-500/20 via-yellow-500/10 to-transparent'
              : 'bg-gradient-to-b from-cyan-500/15 to-transparent'
          }`}
        />
      )}

      {/* Floating Judgements, Combo Fire Badge, & Perfect Streak Banner */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center">
        {/* Floating Judgement Popup */}
        {latestJudgement && (
          <div
            key={latestJudgement.key}
            className="flex flex-col items-center animate-bounce text-center drop-shadow-2xl"
          >
            {/* Grade Typography with SVG Accents */}
            <div className="relative flex items-center justify-center gap-2">
              <span
                className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-widest uppercase ${
                  latestJudgement.grade === 'PERFECT'
                    ? 'text-pink-300 bg-gradient-to-r from-pink-300 via-purple-200 to-amber-300 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(244,114,182,0.9)]'
                    : latestJudgement.grade === 'GREAT'
                    ? 'text-cyan-300 drop-shadow-[0_0_20px_rgba(34,211,238,0.9)]'
                    : latestJudgement.grade === 'GOOD'
                    ? 'text-amber-300 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]'
                    : 'text-rose-500 drop-shadow-[0_0_15px_rgba(244,63,94,0.8)]'
                }`}
              >
                {latestJudgement.grade}
              </span>

              {/* Particle Sparks for Perfect */}
              {latestJudgement.grade === 'PERFECT' && !reducedMotion && (
                <svg
                  className="w-6 h-6 text-amber-300 animate-spin"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2l2.4 7.4h7.6l-6.1 4.5 2.3 7.1-6.2-4.5-6.2 4.5 2.3-7.1-6.1-4.5h7.6z" />
                </svg>
              )}
            </div>

            {/* Attached Combo Counter Pill */}
            {combo > 1 && (
              <div
                className={`mt-1 flex items-center gap-1.5 px-3 py-0.5 rounded-full border text-xs sm:text-sm font-black tracking-wider font-mono shadow-lg backdrop-blur-md ${
                  fireTier === 4
                    ? 'bg-gradient-to-r from-purple-900/90 to-amber-900/90 border-amber-300 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.8)]'
                    : fireTier === 3
                    ? 'bg-orange-950/90 border-orange-400 text-orange-200 shadow-[0_0_15px_rgba(249,115,22,0.7)]'
                    : fireTier === 2
                    ? 'bg-amber-950/80 border-amber-400 text-amber-200'
                    : 'bg-black/60 border-white/20 text-white'
                }`}
              >
                {fireTier >= 3 && (
                  <svg className="w-3.5 h-3.5 text-orange-400 animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2c1.1 3 3.5 5 4.5 8 1.5 4.5-1.5 9-5.5 10-3.5.8-7.5-1.5-8-5.5-.4-3.5 2-6.5 4.5-9 .5 2 1.5 3 2.5 3.5 0-3 1-5 2-7z" />
                  </svg>
                )}
                <span>{combo} COMBO</span>
                {fireTier === 4 && <span className="text-[10px] text-amber-300 font-sans uppercase">🔥 BLAZING</span>}
                {fireTier === 3 && <span className="text-[10px] text-orange-300 font-sans uppercase">🔥 FIRE</span>}
              </div>
            )}
          </div>
        )}

        {/* Sustain Bonus Popup */}
        {sustainBonusAwarded && (
          <div
            key={sustainBonusAwarded.key}
            className="mt-3 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/90 via-yellow-400/90 to-amber-600/90 border border-amber-200 text-black font-black text-xs sm:text-sm tracking-widest uppercase shadow-[0_0_25px_rgba(251,191,36,0.9)] animate-pulse flex items-center gap-1.5"
          >
            <svg className="w-4 h-4 text-black" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span>+{sustainBonusAwarded.points} SUSTAIN BONUS</span>
          </div>
        )}

        {/* Perfect Streak Floating Milestone Badge */}
        {currentPerfectStreak >= 5 && (
          <div className="mt-2 flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-pink-950/80 border border-pink-400/60 shadow-[0_0_15px_rgba(244,114,182,0.5)] backdrop-blur-md">
            <svg className="w-3.5 h-3.5 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.4 7.4h7.6l-6.1 4.5 2.3 7.1-6.2-4.5-6.2 4.5 2.3-7.1-6.1-4.5h7.6z" />
            </svg>
            <span className="text-[11px] font-mono font-black text-pink-200 tracking-wider">
              {currentPerfectStreak} PERFECT STREAK
            </span>
          </div>
        )}
      </div>

      {/* Floating Bottom Ambient Embers for Tier 3 & Tier 4 (Combo Fire / Blazing Praise) */}
      {fireTier >= 3 && !reducedMotion && (
        <div className="absolute bottom-4 inset-x-0 flex justify-center gap-8 pointer-events-none opacity-70">
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-ping shadow-[0_0_8px_#fbbf24]" />
          <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce shadow-[0_0_6px_#f97316]" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-300 animate-pulse shadow-[0_0_10px_#fde047]" />
        </div>
      )}
    </div>
  );
});

GameplayEffectsOverlay.displayName = 'GameplayEffectsOverlay';
