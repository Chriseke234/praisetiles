'use client';

import React from 'react';
import Image from 'next/image';

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
    sm: { cls: 'w-8 h-8', px: 32 },
    md: { cls: 'w-10 h-10', px: 40 },
    lg: { cls: 'w-12 h-12', px: 48 },
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
      {/* PraiseTiles Logo Image Icon */}
      <div className={`${iconDimensions.cls} rounded-xl overflow-hidden shrink-0 shadow-md shadow-purple-500/20`}>
        <Image
          src="/logo.png"
          alt="PraiseTiles Logo"
          width={iconDimensions.px}
          height={iconDimensions.px}
          className="w-full h-full object-cover"
          priority
        />
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
