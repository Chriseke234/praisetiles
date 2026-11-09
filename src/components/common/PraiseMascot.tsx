'use client';

/**
 * PraiseMascot — "Aria, The Rhythm Cherub"
 * Original character identity for PraiseTiles.
 * Rendered using precision SVG vectors with high-DPI crispness and zero external asset dependencies.
 *
 * Supports poses:
 * - 'welcoming'   : Waving hand, joyful smile (Hero, onboarding, welcome screens)
 * - 'pointing'    : Gesturing toward play CTA / upload action
 * - 'celebrating' : Golden crown halo, arms raised in victory, floating musical sparks
 * - 'encouraging' : Thumbs up, empathetic smile for retries and near-misses
 * - 'listening'   : Glowing golden headphones, vibing eyes closed, musical ripples
 */

import React from 'react';

export type MascotPose = 'welcoming' | 'pointing' | 'celebrating' | 'encouraging' | 'listening';

interface PraiseMascotProps {
  pose?: MascotPose;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSpeechBubble?: boolean;
  speechText?: string;
}

export const PraiseMascot: React.FC<PraiseMascotProps> = ({
  pose = 'welcoming',
  size = 'md',
  className = '',
  showSpeechBubble = false,
  speechText,
}) => {
  const sizeMap = {
    sm: 'w-16 h-16',
    md: 'w-28 h-28 sm:w-32 sm:h-32',
    lg: 'w-44 h-44 sm:w-52 sm:h-52',
    xl: 'w-56 h-56 sm:w-64 sm:h-64',
  }[size];

  return (
    <div className={`relative inline-flex flex-col items-center select-none ${className}`}>
      {/* Optional Speech / Dialogue Bubble */}
      {showSpeechBubble && speechText && (
        <div className="mb-2 px-3 py-1.5 rounded-2xl bg-gradient-to-r from-purple-900/90 to-violet-950/90 border border-purple-500/40 text-white text-xs font-semibold shadow-lg shadow-purple-500/20 backdrop-blur-md animate-bounce text-center max-w-[200px]">
          {speechText}
          <div className="w-2 h-2 bg-violet-950 border-r border-b border-purple-500/40 rotate-45 mx-auto -mb-2 mt-1" />
        </div>
      )}

      {/* Main Mascot SVG Artwork */}
      <svg
        viewBox="0 0 200 200"
        className={`${sizeMap} filter drop-shadow-[0_10px_20px_rgba(168,85,247,0.35)] transition-transform duration-300 hover:scale-105`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`PraiseTiles Mascot: Aria (${pose})`}
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="ariaSkin" x1="100" y1="40" x2="100" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE68A" />
            <stop offset="1" stopColor="#F59E0B" />
          </linearGradient>

          <linearGradient id="ariaHoodie" x1="50" y1="90" x2="150" y2="190" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7C3AED" />
            <stop offset="0.6" stopColor="#5B21B6" />
            <stop offset="1" stopColor="#2E1065" />
          </linearGradient>

          <linearGradient id="ariaGold" x1="60" y1="20" x2="140" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" />
            <stop offset="0.5" stopColor="#F59E0B" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>

          <linearGradient id="ariaHalo" x1="50" y1="10" x2="150" y2="50" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FDE047" stopOpacity="0.9" />
            <stop offset="1" stopColor="#F59E0B" stopOpacity="0.4" />
          </linearGradient>

          <radialGradient id="wingGlow" cx="0.5" cy="0.5" r="0.5" fx="0.3" fy="0.3">
            <stop stopColor="#A855F7" stopOpacity="0.8" />
            <stop offset="0.7" stopColor="#7C3AED" stopOpacity="0.4" />
            <stop offset="1" stopColor="#581C87" stopOpacity="0" />
          </radialGradient>

          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- WINGS: Musical stave ribbon wings --- */}
        <g opacity="0.85">
          {/* Left Wing */}
          <path
            d="M50 110 C20 85, 10 120, 35 140 C15 130, 20 160, 55 145"
            fill="url(#wingGlow)"
            stroke="#C084FC"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
          {/* Right Wing */}
          <path
            d="M150 110 C180 85, 190 120, 165 140 C185 130, 180 160, 145 145"
            fill="url(#wingGlow)"
            stroke="#C084FC"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        </g>

        {/* --- CELEBRATION / HALO / CROWN --- */}
        {pose === 'celebrating' && (
          <g filter="url(#goldGlow)">
            {/* Golden Halo */}
            <ellipse cx="100" cy="30" rx="36" ry="10" stroke="url(#ariaGold)" strokeWidth="4" fill="none" />
            {/* Floating Stars */}
            <path d="M45 25 L47 30 L52 31 L48 34 L49 39 L45 36 L41 39 L42 34 L38 31 L43 30 Z" fill="#FDE047" />
            <path d="M155 22 L157 26 L161 27 L158 30 L159 34 L155 32 L152 34 L153 30 L150 27 L154 26 Z" fill="#FDE047" />
          </g>
        )}

        {/* Standard subtle rhythm halo */}
        {pose !== 'celebrating' && (
          <ellipse cx="100" cy="38" rx="26" ry="7" stroke="url(#ariaHalo)" strokeWidth="2.5" fill="none" opacity="0.75" />
        )}

        {/* --- BODY / HOODIE --- */}
        <g id="body">
          {/* Main Torso */}
          <path
            d="M60 120 C60 100, 140 100, 140 120 C146 150, 140 185, 140 185 L60 185 C60 185, 54 150, 60 120 Z"
            fill="url(#ariaHoodie)"
          />
          {/* Gold Zipper / Rhythm Meter on Chest */}
          <rect x="98" y="125" width="4" height="45" rx="2" fill="url(#ariaGold)" />
          {/* Chest Rhythm Peak Bars */}
          <rect x="86" y="145" width="3" height="10" rx="1.5" fill="#C084FC" opacity="0.8" />
          <rect x="91" y="140" width="3" height="15" rx="1.5" fill="#FDE047" />
          <rect x="106" y="140" width="3" height="15" rx="1.5" fill="#FDE047" />
          <rect x="111" y="145" width="3" height="10" rx="1.5" fill="#C084FC" opacity="0.8" />
        </g>

        {/* --- HEAD & FACE --- */}
        <g id="head">
          {/* Face Circle */}
          <ellipse cx="100" cy="85" rx="34" ry="32" fill="url(#ariaSkin)" />
          {/* Cheeks blush */}
          <circle cx="80" cy="94" r="5" fill="#F43F5E" opacity="0.4" />
          <circle cx="120" cy="94" r="5" fill="#F43F5E" opacity="0.4" />

          {/* EYES based on pose */}
          {pose === 'listening' ? (
            /* Closed musical vibing eyes */
            <g stroke="#3730A3" strokeWidth="2.5" strokeLinecap="round">
              <path d="M80 84 Q87 90 94 84" fill="none" />
              <path d="M106 84 Q113 90 120 84" fill="none" />
            </g>
          ) : pose === 'celebrating' ? (
            /* Star eyes for victory */
            <g fill="#4338CA">
              <polygon points="87,77 89,83 95,83 90,87 92,93 87,89 82,93 84,87 79,83 85,83" />
              <polygon points="113,77 115,83 121,83 116,87 118,93 113,89 108,93 110,87 105,83 111,83" />
            </g>
          ) : (
            /* Big, joyful anime/arcade eyes */
            <g>
              {/* Left Eye */}
              <ellipse cx="87" cy="84" rx="5" ry="7" fill="#1E1B4B" />
              <circle cx="85" cy="82" r="2.2" fill="#FFFFFF" />
              <circle cx="88" cy="87" r="1.2" fill="#FDE047" />

              {/* Right Eye */}
              {pose === 'welcoming' ? (
                /* Winking Right Eye */
                <path d="M108 85 Q115 79 122 85" stroke="#1E1B4B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              ) : (
                <>
                  <ellipse cx="113" cy="84" rx="5" ry="7" fill="#1E1B4B" />
                  <circle cx="111" cy="82" r="2.2" fill="#FFFFFF" />
                  <circle cx="114" cy="87" r="1.2" fill="#FDE047" />
                </>
              )}
            </g>
          )}

          {/* MOUTH based on pose */}
          {pose === 'celebrating' || pose === 'welcoming' ? (
            /* Joyful open smile with tongue */
            <g>
              <path d="M92 95 Q100 106 108 95 Z" fill="#991B1B" />
              <path d="M95 101 Q100 104 105 101" fill="#F43F5E" />
            </g>
          ) : pose === 'encouraging' ? (
            /* Confident determined smirk */
            <path d="M93 96 Q101 102 108 97" stroke="#1E1B4B" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          ) : (
            /* Soft contented smile */
            <path d="M94 96 Q100 101 106 96" stroke="#1E1B4B" strokeWidth="2" strokeLinecap="round" fill="none" />
          )}

          {/* Trendy Violet/Gold Bangs */}
          <path
            d="M72 70 C78 54, 122 54, 128 70 C120 62, 108 64, 102 70 C96 64, 84 62, 72 70 Z"
            fill="#5B21B6"
          />
          <path d="M88 64 C94 58, 106 58, 112 64" stroke="#FDE047" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* --- GOLDEN DJ HEADPHONES --- */}
        <g id="headphones">
          {/* Headband */}
          <path
            d="M66 78 C66 45, 134 45, 134 78"
            stroke="url(#ariaGold)"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Left Earcup */}
          <rect x="60" y="70" width="10" height="24" rx="5" fill="url(#ariaGold)" stroke="#78350F" strokeWidth="1" />
          <circle cx="65" cy="82" r="3" fill="#A855F7" />

          {/* Right Earcup */}
          <rect x="130" y="70" width="10" height="24" rx="5" fill="url(#ariaGold)" stroke="#78350F" strokeWidth="1" />
          <circle cx="135" cy="82" r="3" fill="#A855F7" />

          {/* Sound wave rings if listening or celebrating */}
          {(pose === 'listening' || pose === 'celebrating') && (
            <g stroke="#C084FC" strokeWidth="1.5" strokeLinecap="round" opacity="0.8">
              <path d="M54 74 C51 79, 51 85, 54 90" />
              <path d="M49 70 C44 78, 44 87, 49 94" />
              <path d="M146 74 C149 79, 149 85, 146 90" />
              <path d="M151 70 C156 78, 156 87, 151 94" />
            </g>
          )}
        </g>

        {/* --- ARMS & HANDS / GESTURES --- */}
        <g id="arms">
          {pose === 'welcoming' && (
            /* Waving Left Hand high */
            <g>
              <path d="M60 130 C45 110, 35 90, 42 75" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              {/* Hand */}
              <circle cx="42" cy="73" r="6" fill="url(#ariaSkin)" />
              {/* Floating golden musical eighth note */}
              <path
                d="M32 60 L32 50 L42 47 L42 57 M32 60 A2 2 0 1 0 30 62 M42 57 A2 2 0 1 0 40 59"
                stroke="#FDE047"
                strokeWidth="1.8"
                fill="#FDE047"
              />
              {/* Right Hand resting at side */}
              <path d="M140 130 C150 145, 148 165, 144 175" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="144" cy="177" r="5" fill="url(#ariaSkin)" />
            </g>
          )}

          {pose === 'pointing' && (
            /* Pointing hand dynamically to the right */
            <g>
              {/* Left hand relaxed */}
              <path d="M60 130 C50 145, 52 165, 56 175" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="56" cy="177" r="5" fill="url(#ariaSkin)" />

              {/* Right arm extended pointing */}
              <path d="M138 130 C155 125, 175 122, 185 122" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="187" cy="122" r="6" fill="url(#ariaSkin)" />
              {/* Glow impulse at fingertip */}
              <circle cx="192" cy="122" r="3" fill="#FDE047" />
              <line x1="190" y1="117" x2="195" y2="114" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
              <line x1="190" y1="127" x2="195" y2="130" stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}

          {pose === 'celebrating' && (
            /* Both arms raised in triumph! */
            <g>
              {/* Left Arm Raised */}
              <path d="M60 130 C45 105, 40 85, 48 70" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="48" cy="68" r="6" fill="url(#ariaSkin)" />

              {/* Right Arm Raised */}
              <path d="M140 130 C155 105, 160 85, 152 70" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="152" cy="68" r="6" fill="url(#ariaSkin)" />

              {/* Floating praise sparkles */}
              <circle cx="40" cy="50" r="2.5" fill="#FDE047" />
              <circle cx="160" cy="50" r="2.5" fill="#FDE047" />
            </g>
          )}

          {pose === 'encouraging' && (
            /* Thumbs Up gesture */
            <g>
              {/* Left arm giving big thumbs up */}
              <path d="M62 130 C48 125, 45 110, 52 100" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="52" cy="98" r="6" fill="url(#ariaSkin)" />
              {/* Thumb */}
              <path d="M52 94 L52 87" stroke="url(#ariaGold)" strokeWidth="3.5" strokeLinecap="round" />

              {/* Right hand on hip */}
              <path d="M138 130 C152 140, 150 155, 142 165" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="140" cy="167" r="5" fill="url(#ariaSkin)" />
            </g>
          )}

          {pose === 'listening' && (
            /* Both hands resting lightly on headphones */
            <g>
              <path d="M60 130 C50 110, 52 95, 60 82" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="60" cy="80" r="5.5" fill="url(#ariaSkin)" />

              <path d="M140 130 C150 110, 148 95, 140 82" stroke="#7C3AED" strokeWidth="9" strokeLinecap="round" fill="none" />
              <circle cx="140" cy="80" r="5.5" fill="url(#ariaSkin)" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
