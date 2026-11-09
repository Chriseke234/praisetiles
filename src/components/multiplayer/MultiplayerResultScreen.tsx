'use client';

/**
 * MultiplayerResultScreen — Elevated Vinyl-Inspired Ceremony
 * Shows placements, accuracy, scores, vinyl turntable centerpiece, and rematch controls.
 */

import React, { useState } from 'react';
import { Trophy, RefreshCw, LogOut, Star, XCircle, Share2, Disc, Award } from 'lucide-react';
import { MatchParticipant } from '@/types/room';
import { ShareResultCard } from '@/components/social/ShareResultCard';
import { PraiseMascot } from '@/components/common/PraiseMascot';

interface MultiplayerResultScreenProps {
  matchResults:  MatchParticipant[];
  currentUserId: string;
  songTitle:     string;
  onRematch:     () => void;
  onLeave:       () => void;
  isHost:        boolean;
}

const PLACEMENT_COLORS: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-gray-300',
  3: 'text-amber-600',
};

const PLACEMENT_LABELS: Record<number, string> = {
  1: '1st Place',
  2: '2nd Place',
  3: '3rd Place',
};

const placementLabel = (p: number | null) =>
  p !== null ? (PLACEMENT_LABELS[p] ?? `${p}th Place`) : '—';

export const MultiplayerResultScreen: React.FC<MultiplayerResultScreenProps> = ({
  matchResults,
  currentUserId,
  songTitle,
  onRematch,
  onLeave,
  isHost,
}) => {
  const [showShareCard, setShowShareCard] = useState(false);

  const sorted = [...matchResults].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? -1 : 1;
    return b.score - a.score;
  });

  const myResult = matchResults.find((r) => r.userId === currentUserId);
  const myPlacement = myResult?.placement ?? (sorted.findIndex((r) => r.userId === currentUserId) + 1);
  const isWinner = myPlacement === 1;

  return (
    <div className="min-h-screen w-full bg-[#08070d] flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8 text-gray-100 overflow-x-hidden relative">
      {/* Halftone & Glow Backdrop */}
      <div className="absolute inset-0 bg-halftone-dots opacity-30 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/20 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-xl bg-gradient-to-b from-[#141026]/95 via-[#0e0c1a]/95 to-[#08070d]/95 border border-purple-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl animate-fadeIn">
        {/* Header Ribbon */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30">
            <Star className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Multiplayer Match &bull; Final Results
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            <Disc className="w-6 h-6 text-purple-400 animate-spin-slow" />
            <span>{songTitle}</span>
          </h1>

          {/* Winner Banner or Placement */}
          <div className="pt-2 flex flex-col items-center">
            <PraiseMascot
              pose={isWinner ? 'celebrating' : 'welcoming'}
              size="md"
              showSpeechBubble
              speechText={isWinner ? 'Glorious victory! Champion of praise!' : 'Great praise battle! Rematch?'}
            />

            <div className={`mt-3 px-6 py-2 rounded-2xl bg-black/60 border text-center shadow-lg ${
              isWinner ? 'border-amber-500/60 text-amber-300' : 'border-purple-500/40 text-white'
            }`}>
              <span className="text-[10px] font-bold uppercase tracking-wider block text-gray-400">
                Your Placement
              </span>
              <p className={`text-2xl font-black ${PLACEMENT_COLORS[myPlacement] ?? 'text-gray-300'}`}>
                {isWinner ? 'Winner (1st Place)' : placementLabel(myPlacement)}
              </p>
            </div>
          </div>
        </div>

        {/* Placement Table */}
        <div className="w-full bg-[#110e1f] border border-gray-800 rounded-2xl overflow-hidden mb-6 shadow-inner">
          <div className="grid grid-cols-5 px-4 py-2.5 border-b border-gray-800 text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-black/40">
            <span>Rank</span>
            <span className="col-span-2">Player</span>
            <span className="text-right">Score</span>
            <span className="text-right">Accuracy</span>
          </div>

          {sorted.map((r, i) => {
            const isMe   = r.userId === currentUserId;
            const p      = r.placement ?? (i + 1);
            const pColor = PLACEMENT_COLORS[p] ?? 'text-gray-400';

            return (
              <div
                key={r.userId}
                className={`grid grid-cols-5 items-center px-4 py-3 border-b border-gray-800/40 last:border-0 transition ${
                  isMe ? 'bg-amber-500/10' : ''
                }`}
              >
                {/* Placement */}
                <div className="flex items-center gap-1.5">
                  {p === 1 ? (
                    <Trophy className="w-4 h-4 text-amber-400" />
                  ) : (
                    <span className={`text-xs font-black ${pColor}`}>{p}</span>
                  )}
                </div>

                {/* Name */}
                <div className="col-span-2 flex items-center gap-2 min-w-0">
                  {!r.completed && (
                    <span title="Interrupted">
                      <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    </span>
                  )}
                  <span className={`text-xs sm:text-sm font-bold truncate ${isMe ? 'text-amber-300' : 'text-white'}`}>
                    {r.displayName}
                    {isMe && <span className="text-amber-400 ml-1 text-[10px] font-semibold">(You)</span>}
                  </span>
                </div>

                {/* Score */}
                <span className="text-right text-xs sm:text-sm font-black text-white tabular-nums">
                  {r.score.toLocaleString()}
                </span>

                {/* Accuracy */}
                <span className="text-right text-xs font-mono text-cyan-300 tabular-nums">
                  {r.accuracy.toFixed(1)}%
                </span>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <p className="text-center text-sm text-gray-500 italic py-8">
              Waiting for match results&hellip;
            </p>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          {myResult && (
            <button
              onClick={() => setShowShareCard((prev) => !prev)}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-purple-950/40 border border-purple-500/40 hover:bg-purple-900/50 text-purple-200 font-bold text-xs transition"
            >
              <Share2 className="w-4 h-4 text-purple-400" />
              <span>{showShareCard ? 'Hide Card' : 'Share Result'}</span>
            </button>
          )}

          {isHost ? (
            <button
              onClick={onRematch}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-black text-xs sm:text-sm transition shadow-lg shadow-amber-500/20"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Play Rematch</span>
            </button>
          ) : (
            <div className="flex-1 flex items-center justify-center py-3 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 text-xs">
              Waiting for host to initiate rematch&hellip;
            </div>
          )}

          <button
            onClick={onLeave}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-gray-900 border border-gray-800 hover:border-rose-500/50 text-gray-300 hover:text-rose-400 font-bold text-xs transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Leave</span>
          </button>
        </div>

        {/* Share Card Modal Overlay */}
        {showShareCard && myResult && (
          <div className="mt-6 w-full animate-fadeIn">
            <ShareResultCard
              data={{
                gameName: 'PraiseTiles',
                songTitle,
                instrument: 'piano',
                roomMode: 'casual',
                score: myResult.score,
                accuracy: myResult.accuracy,
                highestCombo: myResult.highestCombo,
                placement: myResult.placement ?? 1,
                totalPlayers: matchResults.length,
                timestamp: new Date().toISOString(),
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
