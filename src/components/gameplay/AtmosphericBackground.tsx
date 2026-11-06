'use client';

import React from 'react';

export const AtmosphericBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-0">
      {/* Base Deep Purple Ethereal Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#160b33] via-[#0e0722] to-[#070312]" />

      {/* Top Ambient Gold & Purple Glows */}
      <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full bg-gradient-to-b from-amber-500/15 via-purple-600/20 to-transparent blur-3xl" />
      <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] rounded-full bg-purple-600/10 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Soft Moon / Halo in Upper Center */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full bg-white/5 blur-2xl border border-white/5" />

      {/* Piano & Pianist Water Silhouette Artwork */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[340px] opacity-20 pointer-events-none">
        <svg
          viewBox="0 0 400 240"
          fill="currentColor"
          className="w-full h-auto text-purple-300 drop-shadow-[0_0_15px_rgba(168,85,247,0.3)]"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Grand Piano Body */}
          <path d="M 120 150 Q 140 100 230 100 Q 280 100 310 130 Q 320 140 320 160 L 120 160 Z" />
          {/* Piano Open Lid */}
          <path d="M 130 150 L 290 50 L 295 55 L 140 150 Z" />
          {/* Lid Prop Stick */}
          <line x1="260" y1="70" x2="260" y2="120" stroke="currentColor" strokeWidth="3" />
          {/* Keyboard Shelf */}
          <rect x="100" y="152" width="40" height="10" rx="2" />
          {/* Piano Legs */}
          <rect x="135" y="160" width="6" height="40" rx="2" />
          <rect x="290" y="160" width="6" height="40" rx="2" />
          <rect x="220" y="160" width="6" height="40" rx="2" />

          {/* Pianist Silhouette */}
          {/* Head */}
          <circle cx="85" cy="115" r="10" />
          {/* Hair flow */}
          <path d="M 80 115 Q 70 130 75 145 Q 85 135 88 122 Z" />
          {/* Torso & posture */}
          <path d="M 85 125 Q 92 145 92 165 L 75 165 Q 75 140 80 128 Z" />
          {/* Arms reaching to keys */}
          <path d="M 88 135 L 115 155 L 105 157 Z" />
          {/* Bench */}
          <rect x="65" y="165" width="25" height="6" rx="2" />
          <rect x="70" y="171" width="4" height="28" />
          <rect x="82" y="171" width="4" height="28" />

          {/* Water Line & Gentle Reflection */}
          <line x1="20" y1="200" x2="380" y2="200" stroke="currentColor" strokeWidth="1" strokeDasharray="6 4" opacity="0.6" />
          <ellipse cx="200" cy="215" rx="160" ry="12" fill="none" stroke="currentColor" strokeWidth="0.8" opacity="0.25" />
          <ellipse cx="200" cy="225" rx="110" ry="8" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.15" />
        </svg>
      </div>

      {/* Subtle Vertical Stars / Light Glints */}
      <div className="absolute top-1/4 left-8 w-1 h-1 bg-white/40 rounded-full animate-pulse" />
      <div className="absolute top-1/3 right-10 w-1.5 h-1.5 bg-amber-300/40 rounded-full animate-pulse" />
      <div className="absolute top-2/3 left-14 w-1 h-1 bg-purple-300/40 rounded-full animate-pulse" />
      <div className="absolute top-1/2 right-16 w-1.5 h-1.5 bg-yellow-200/50 rounded-full animate-pulse" />
    </div>
  );
};
