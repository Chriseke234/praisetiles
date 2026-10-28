'use client';

/**
 * ShareResultCard — Visual, exportable match result card.
 * Safe to share publicly:
 * - Excludes private audio URLs, signed storage links, and internal IDs
 * - Uses Web Share API with clipboard copy fallback
 * - Displays placement, score, accuracy, combo, rating delta
 */

import React, { useState } from 'react';
import {
  Trophy, Share2, Copy, Check, Music, Award,
} from 'lucide-react';
import { MatchShareData } from '@/types/social';

interface ShareResultCardProps {
  data: MatchShareData;
}

export const ShareResultCard: React.FC<ShareResultCardProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const shareText = `PraiseTiles Result: ${data.placement === 1 ? '🏆 1st Place' : `#${data.placement}`} on "${data.songTitle}" (${data.instrument} Tiles)!\nScore: ${data.score.toLocaleString()} | Acc: ${data.accuracy.toFixed(1)}% | Combo: x${data.highestCombo}`;

  const handleCopy = async () => {
    try {
      if (typeof window !== 'undefined') {
        const shareUrl = window.location.origin;
        await navigator.clipboard.writeText(`${shareText}\nPlay now: ${shareUrl}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // Fallback
    }
  };

  const handleWebShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'PraiseTiles Match Result',
          text: shareText,
          url: window.location.origin,
        });
      } catch {
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const isWin = data.placement === 1;

  return (
    <div className="w-full max-w-sm rounded-3xl bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-800 p-5 shadow-2xl space-y-4">
      {/* Brand Header */}
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
            <Music className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xs font-black tracking-wider text-amber-300">
            PRAISETILES
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
          {data.roomMode} · {data.instrument}
        </span>
      </div>

      {/* Main Placement Hero */}
      <div className="text-center py-2 space-y-1">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 mx-auto mb-1">
          {isWin ? (
            <Trophy className="w-8 h-8 text-amber-400 fill-amber-400" />
          ) : (
            <Award className="w-8 h-8 text-cyan-400" />
          )}
        </div>
        <h3 className="text-2xl font-black text-white">
          {data.placement === 1 ? '1st Place' : `${data.placement}th Place`}
        </h3>
        <p className="text-xs text-gray-400 truncate max-w-[240px] mx-auto font-medium">
          {data.songTitle}
        </p>
      </div>

      {/* Score Grid */}
      <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-gray-950/60 border border-gray-800/80 text-center">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Score</p>
          <p className="text-sm font-black text-white tabular-nums">
            {data.score.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Acc</p>
          <p className="text-sm font-black text-cyan-400 tabular-nums">
            {data.accuracy.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold">Combo</p>
          <p className="text-sm font-black text-amber-400 tabular-nums">
            x{data.highestCombo}
          </p>
        </div>
      </div>

      {/* Rating Delta (if ranked) */}
      {data.ratingChange !== null && data.ratingChange !== undefined && (
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-900/40 border border-gray-800 text-xs">
          <span className="text-gray-400">Competitive Rating</span>
          <span
            className={`font-black tabular-nums ${
              data.ratingChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {data.ratingChange >= 0 ? `+${data.ratingChange}` : data.ratingChange}
            {data.newRating ? ` (${data.newRating})` : ''}
          </span>
        </div>
      )}

      {/* Share / Copy Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleWebShare}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition shadow"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span>Share</span>
        </button>
        <button
          onClick={handleCopy}
          className="px-3.5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold transition"
          title="Copy result summary"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
