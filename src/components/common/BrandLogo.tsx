'use client';

import React from 'react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
  onClick?: () => void;
}

/**
 * Stylized Gospel Rhythm Brand Logo for PraiseTiles
 * Combines an illuminated worship cross silhouette, musical eighth notes,
 * and vertical rhythmic falling tile lanes inside a golden sanctuary crest.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showSubtitle = true,
  className = '',
  onClick,
}) => {
  const iconDimensions = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  }[size];

  const titleSizes = {
    sm: 'text-base sm:text-lg',
    md: 'text-lg sm:text-2xl',
    lg: 'text-2xl sm:text-3xl',
  }[size];

  const subtitleSizes = {
    sm: 'text-[8px] sm:text-[10px]',
    md: 'text-[9px] sm:text-xs',
    lg: 'text-xs sm:text-sm',
  }[size];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-2.5 sm:gap-3 shrink-0 ${
        onClick ? 'cursor-pointer select-none' : ''
      } ${className}`}
    >
      {/* Stylized Gospel Rhythm SVG Icon */}
      <div
        className={`${iconDimensions} rounded-xl bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 flex items-center justify-center p-1.5 shadow-md shadow-amber-500/20 border border-amber-400/40 shrink-0 relative overflow-hidden`}
      >
        {/* Subtle ambient light shimmer inside crest */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-black drop-shadow-sm"
          aria-hidden="true"
        >
          {/* 4 Vertical Rhythm Tile Columns (representing lanes) */}
          <rect x="7" y="10" width="4" height="20" rx="1.5" fill="currentColor" fillOpacity="0.25" />
          <rect x="14" y="6" width="4" height="28" rx="1.5" fill="currentColor" fillOpacity="0.35" />
          <rect x="22" y="6" width="4" height="28" rx="1.5" fill="currentColor" fillOpacity="0.35" />
          <rect x="29" y="10" width="4" height="20" rx="1.5" fill="currentColor" fillOpacity="0.25" />

          {/* Central Worship Cross Core (elevated stroke) */}
          <path
            d="M20 5V35M11 15H29"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Musical Rhythm Beam Over Cross */}
          <circle cx="14" cy="27" r="3.2" fill="currentColor" />
          <circle cx="26" cy="24" r="3.2" fill="currentColor" />
          <path
            d="M16.5 27V12.5C16.5 11.5 17.5 11 18.5 11.5L28.5 15.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Cyan rhythm hit sparkle accent */}
          <circle cx="20" cy="15" r="1.5" fill="#22D3EE" />
        </svg>
      </div>

      {/* Brand Typography */}
      <div>
        <h1
          className={`${titleSizes} font-black tracking-wider bg-gradient-to-r from-amber-400 via-amber-200 to-cyan-400 bg-clip-text text-transparent leading-none`}
        >
          PRAISETILES
        </h1>
        {showSubtitle && (
          <p
            className={`${subtitleSizes} tracking-widest uppercase text-gray-400 font-semibold mt-0.5 whitespace-nowrap`}
          >
            Gospel Rhythm Arena
          </p>
        )}
      </div>
    </div>
  );
};
