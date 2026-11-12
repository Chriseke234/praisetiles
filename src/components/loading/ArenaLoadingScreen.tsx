'use client';

/**
 * ArenaLoadingScreen — Flagship PraiseTiles Gospel Arena Loading Experience
 * 
 * Composition:
 * 1. Prominent PraiseTiles Crest Logo with Gospel Rhythm subtitle
 * 2. Flanked Soundstage: Central rotating AnimatedVinyl flanked by 4-lane falling gameplay tiles
 * 3. Aria Cherub Mascot with natural smooth rotating gospel tips
 * 4. Calibrated ArenaProgressBar (Indeterminate vs Measurable)
 * 5. Failsafe Timeout Handler: Provides Retry & Continue actions if loading takes longer than expected
 * 6. Responsive: Desktop flanked layout adapts cleanly to tablet and mobile
 */

import React, { useState, useEffect } from 'react';
import { BrandLogo } from '@/components/common/BrandLogo';
import { PraiseMascot, MascotPose } from '@/components/common/PraiseMascot';
import { AnimatedVinyl } from './AnimatedVinyl';
import { RhythmTilesMiniature } from './RhythmTilesMiniature';
import { ArenaProgressBar } from './ArenaProgressBar';
import { RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';

export interface ArenaLoadingScreenProps {
  title?: string;
  subtitle?: string;
  artist?: string;
  artworkUrl?: string;
  mode?: 'piano' | 'guitar';
  progress?: number; // 0 to 100 or undefined for indeterminate
  statusText?: string;
  substatusText?: string;
  mascotPose?: MascotPose;
  timeoutMs?: number; // Failsafe timeout in ms (default 12000)
  onRetry?: () => void;
  onSkip?: () => void;
  reducedMotion?: boolean;
  className?: string;
}

const DEFAULT_ROTATING_MESSAGES = [
  'Tuning the arena...',
  'Getting your rhythm ready...',
  'Preparing your next performance...',
  'Warming up the instruments...',
  'Loading your gospel experience...',
  'The arena is almost ready...',
];

export const ArenaLoadingScreen: React.FC<ArenaLoadingScreenProps> = ({
  title,
  subtitle,
  artist,
  artworkUrl,
  mode,
  progress,
  statusText,
  substatusText,
  mascotPose = 'listening',
  timeoutMs = 12000,
  onRetry,
  onSkip,
  reducedMotion = false,
  className = '',
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Rotate helpful messages every 3.2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % DEFAULT_ROTATING_MESSAGES.length);
    }, 3200);

    return () => clearInterval(interval);
  }, []);

  // Failsafe timeout handler
  useEffect(() => {
    if (timeoutMs <= 0) return;

    const timer = setTimeout(() => {
      setHasTimedOut(true);
    }, timeoutMs);

    return () => clearTimeout(timer);
  }, [timeoutMs]);

  const activeMessage = statusText || DEFAULT_ROTATING_MESSAGES[messageIndex];

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col justify-between items-center p-4 sm:p-8 bg-[#080414] text-white select-none overflow-hidden ${className}`}
      role="alert"
      aria-busy="true"
      aria-label="Loading PraiseTiles Gospel Rhythm Arena"
    >
      {/* Background Atmosphere */}
      <div className="absolute inset-0 bg-halftone-dots opacity-20 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-gradient-to-b from-purple-600/20 via-amber-500/10 to-transparent blur-[140px] pointer-events-none" />

      {/* 1. TOP HEADER: Brand Logo */}
      <header className="relative z-10 w-full flex items-center justify-between max-w-4xl pt-2 sm:pt-4 animate-fadeIn">
        <BrandLogo size="md" showSubtitle={true} />

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40">
            Sanctuary Engine v2.0
          </span>
        </div>
      </header>

      {/* 2. CENTREPIECE: FLANKED SOUNDSTAGE (Vinyl + 4 Falling Tile Lanes) */}
      <main className="relative z-10 flex flex-col items-center justify-center my-auto w-full max-w-4xl py-4 sm:py-8">
        {/* Optional Title / Custom Operation / Game Prep */}
        {(title || mode) && (
          <div className="text-center mb-6 animate-fadeIn space-y-1.5">
            {mode && (
              <div>
                <span className="inline-block text-[10px] sm:text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider bg-purple-500/20 border border-purple-500/40 text-purple-300 shadow-sm">
                  {mode === 'piano' ? 'Piano Tiles Arena' : 'Guitar Tiles Arena'}
                </span>
              </div>
            )}
            {title && (
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-amber-400 via-amber-200 to-purple-300 bg-clip-text text-transparent">
                {title}
              </h1>
            )}
            {artist && <p className="text-xs text-purple-300 font-semibold">{artist}</p>}
            {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
          </div>
        )}

        {/* Flanked Arena Soundstage on Desktop / Stacked on Mobile */}
        <div className="w-full flex flex-col md:flex-row items-center justify-center gap-6 sm:gap-10">
          {/* Left Flank: Lanes 0 & 1 (Hidden on small mobile to avoid cramped viewport) */}
          <div className="hidden md:block w-36 lg:w-44">
            <RhythmTilesMiniature mode="left-pair" height={190} reducedMotion={reducedMotion} />
          </div>

          {/* Central Vinyl Record */}
          <div className="relative shrink-0 animate-fadeIn">
            <AnimatedVinyl
              size="lg"
              isSpinning={true}
              reducedMotion={reducedMotion}
              glowColor="gold"
            />
          </div>

          {/* Right Flank: Lanes 2 & 3 (Hidden on small mobile) */}
          <div className="hidden md:block w-36 lg:w-44">
            <RhythmTilesMiniature mode="right-pair" height={190} reducedMotion={reducedMotion} />
          </div>

          {/* Mobile Fallback: Unified 4-lane miniature displayed underneath on small screens */}
          <div className="block md:hidden w-64 max-w-xs mt-2">
            <RhythmTilesMiniature mode="full" height={110} reducedMotion={reducedMotion} />
          </div>
        </div>
      </main>

      {/* 3. BOTTOM FOOTER: Mascot + Progress Bar + Failsafe Notice */}
      <footer className="relative z-10 w-full max-w-xl pb-2 sm:pb-6 space-y-4">
        {/* Aria Mascot Presentation */}
        <div className="flex items-center justify-center gap-3">
          <PraiseMascot
            pose={mascotPose}
            size="sm"
            className="shrink-0 transition-transform hover:scale-105"
          />

          <div className="relative px-3.5 py-2 rounded-2xl bg-[#141026]/90 border border-purple-500/30 text-left shadow-lg backdrop-blur-md min-w-[220px] max-w-xs sm:max-w-sm">
            <p className="text-xs font-bold text-amber-300 transition-opacity duration-300">
              {activeMessage}
            </p>
            <p className="text-[10px] text-gray-400 mt-0.5">Aria &bull; Sanctuary Companion</p>
          </div>
        </div>

        {/* Progress Bar */}
        <ArenaProgressBar
          progress={progress}
          statusText={activeMessage}
          substatusText={substatusText || (progress !== undefined ? 'Calibrating audio buffers' : 'Connecting to gospel soundstage')}
          showPercentage={true}
          reducedMotion={reducedMotion}
        />

        {/* 4. FAILSAFE TIMEOUT BANNER (Never leaves player trapped) */}
        {hasTimedOut && (
          <div className="mt-4 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between gap-3 text-left animate-fadeIn">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white">Loading taking longer than expected</p>
                <p className="text-[10px] text-gray-400 truncate">
                  Check your network connection or enter directly.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-700 hover:border-amber-400 text-xs font-bold text-gray-200 hover:text-white transition flex items-center gap-1.5 shadow"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Retry</span>
                </button>
              )}

              {onSkip && (
                <button
                  onClick={onSkip}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-extrabold transition flex items-center gap-1 shadow-md shadow-amber-500/20"
                >
                  <span>Continue</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
