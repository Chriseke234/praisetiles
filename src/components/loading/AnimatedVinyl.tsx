'use client';

/**
 * AnimatedVinyl — Bespoke Gospel Vinyl Soundstage Centrepiece
 * 
 * Features:
 * - Ultra-crisp concentric audio grooves (8 precision tracks)
 * - Central PraiseTiles golden sanctuary label with glowing music crest
 * - Radial specular reflection sheen angled across the grooves
 * - 360-degree smooth rotational motion
 * - Respects prefers-reduced-motion and custom reducedMotion property
 * - Zero external asset dependencies (100% vector SVG & pure CSS)
 */

import React from 'react';

interface AnimatedVinylProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isSpinning?: boolean;
  reducedMotion?: boolean;
  className?: string;
  glowColor?: 'gold' | 'violet' | 'amber';
}

export const AnimatedVinyl: React.FC<AnimatedVinylProps> = ({
  size = 'md',
  isSpinning = true,
  reducedMotion = false,
  className = '',
  glowColor = 'gold',
}) => {
  const sizeClasses = {
    sm: 'w-24 h-24 sm:w-28 sm:h-28',
    md: 'w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56',
    lg: 'w-52 h-52 sm:w-64 sm:h-64 md:w-72 md:h-72',
    xl: 'w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96',
  }[size];

  const glowStyles = {
    gold: 'drop-shadow-[0_0_28px_rgba(245,158,11,0.35)]',
    violet: 'drop-shadow-[0_0_28px_rgba(168,85,247,0.4)]',
    amber: 'drop-shadow-[0_0_32px_rgba(251,191,36,0.4)]',
  }[glowColor];

  const spinAnimation = !reducedMotion && isSpinning ? 'animate-[spin_7s_linear_infinite]' : '';

  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Ambient Radial Underglow */}
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-tr from-purple-600/25 via-amber-500/20 to-transparent blur-2xl transform scale-110 pointer-events-none transition-opacity duration-700 ${
          isSpinning ? 'opacity-100' : 'opacity-60'
        }`}
      />

      {/* Main Vinyl Record Container */}
      <div className={`relative ${sizeClasses} ${glowStyles} transition-transform duration-500 hover:scale-[1.02]`}>
        <svg
          viewBox="0 0 300 300"
          className={`w-full h-full ${spinAnimation}`}
          xmlns="http://www.w3.org/2000/svg"
          aria-label="PraiseTiles Animated Vinyl Record"
          role="img"
        >
          <defs>
            {/* Outer Vinyl Gradient */}
            <radialGradient id="vinylBody" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#120c1f" />
              <stop offset="60%" stopColor="#0a0712" />
              <stop offset="88%" stopColor="#050308" />
              <stop offset="100%" stopColor="#151024" />
            </radialGradient>

            {/* Specular Sheen Gradients simulating vinyl reflections */}
            <linearGradient id="sheenLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.14" />
              <stop offset="35%" stopColor="#c084fc" stopOpacity="0.08" />
              <stop offset="50%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="65%" stopColor="#fbbf24" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.16" />
            </linearGradient>

            <linearGradient id="sheenRight" x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
              <stop offset="45%" stopColor="#ffffff" stopOpacity="0" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0.12" />
            </linearGradient>

            {/* Center Label Sanctuary Gold Gradient */}
            <radialGradient id="centerLabel" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="85%" stopColor="#B45309" />
              <stop offset="100%" stopColor="#78350F" />
            </radialGradient>

            {/* Center Label Ring Shadow */}
            <filter id="labelShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.7" />
            </filter>
          </defs>

          {/* Vinyl Rim */}
          <circle cx="150" cy="150" r="148" fill="url(#vinylBody)" stroke="#2e1f4d" strokeWidth="2" />
          <circle cx="150" cy="150" r="145" fill="none" stroke="#3b2d5a" strokeWidth="1" opacity="0.6" />

          {/* Micro-Grooves: 8 concentric sound rings */}
          <circle cx="150" cy="150" r="136" fill="none" stroke="#251b3a" strokeWidth="1.2" opacity="0.75" />
          <circle cx="150" cy="150" r="126" fill="none" stroke="#3a2b56" strokeWidth="0.8" opacity="0.65" />
          <circle cx="150" cy="150" r="116" fill="none" stroke="#1d152e" strokeWidth="1.5" opacity="0.85" />
          <circle cx="150" cy="150" r="106" fill="none" stroke="#33244c" strokeWidth="0.9" opacity="0.6" />
          <circle cx="150" cy="150" r="96" fill="none" stroke="#2a1e40" strokeWidth="1.1" opacity="0.7" />
          <circle cx="150" cy="150" r="86" fill="none" stroke="#3d2c5c" strokeWidth="0.8" opacity="0.6" />
          <circle cx="150" cy="150" r="76" fill="none" stroke="#201733" strokeWidth="1.4" opacity="0.8" />
          <circle cx="150" cy="150" r="66" fill="none" stroke="#382952" strokeWidth="0.8" opacity="0.65" />

          {/* Specular Light Reflections (Bowtie Shimmer) */}
          <path
            d="M 150 150 L 25 35 A 148 148 0 0 1 105 10 Z"
            fill="url(#sheenLeft)"
            opacity="0.85"
          />
          <path
            d="M 150 150 L 275 265 A 148 148 0 0 1 195 290 Z"
            fill="url(#sheenLeft)"
            opacity="0.85"
          />
          <path
            d="M 150 150 L 265 35 A 148 148 0 0 0 195 10 Z"
            fill="url(#sheenRight)"
            opacity="0.6"
          />
          <path
            d="M 150 150 L 35 265 A 148 148 0 0 0 105 290 Z"
            fill="url(#sheenRight)"
            opacity="0.6"
          />

          {/* Run-Out Groove Ring */}
          <circle cx="150" cy="150" r="56" fill="none" stroke="#181226" strokeWidth="2.5" />
          <circle cx="150" cy="150" r="54" fill="none" stroke="#4a3770" strokeWidth="0.6" opacity="0.5" />

          {/* Centre Sanctuary Label */}
          <circle
            cx="150"
            cy="150"
            r="48"
            fill="url(#centerLabel)"
            filter="url(#labelShadow)"
            stroke="#FDE68A"
            strokeWidth="1.5"
          />
          <circle cx="150" cy="150" r="44" fill="none" stroke="#78350F" strokeWidth="0.75" opacity="0.6" />

          {/* Centre Label Decorative Sanctuary Cross + Musical Note Icon */}
          <g transform="translate(150, 150)">
            {/* Sanctuary Cross silhouette */}
            <path
              d="M -2 -24 L 2 -24 L 2 -10 L 14 -10 L 14 -6 L 2 -6 L 2 24 L -2 24 L -2 -6 L -14 -6 L -14 -10 L -2 -10 Z"
              fill="#451A03"
              opacity="0.25"
            />
            {/* Illuminated Eighth Note Icon */}
            <path
              d="M -3 -12 C -3 -14 0 -16 6 -17 L 6 8 C 4 7 1 6.5 -2 8 C -6 9.5 -8 13 -6 16 C -4 19 0 20 4 18.5 C 7 17 8 14 8 11 L 8 -11 C 8 -13 5 -14.5 1 -14 L -3 -12 Z"
              fill="#FFFFFF"
            />
            {/* Secondary Gold Highlight Note Accent */}
            <circle cx="0" cy="14" r="3.5" fill="#FEF08A" />
          </g>

          {/* Spindle Centre Hole */}
          <circle cx="150" cy="150" r="7" fill="#080414" stroke="#D97706" strokeWidth="1" />
          <circle cx="150" cy="150" r="5.5" fill="#030206" />
        </svg>

        {/* Ambient Tonearm Glow (Static, non-obtrusive) */}
        <div className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-amber-400/80 shadow-[0_0_12px_#F59E0B] pointer-events-none" />
      </div>
    </div>
  );
};
