'use client';

/**
 * ResultScreen — Premium Post-Game Vinyl Record Ceremony
 * Inspired by vinyl-record game result screens with realistic grooves,
 * circular accuracy progress ring, performance breakdown, and Aria mascot celebration.
 */

import React, { useState } from 'react';
import { RunResult } from '@/types/game';
import {
  RotateCcw,
  Home,
  Award,
  AlertOctagon,
  Music,
  Zap,
  Sparkles,
  UserPlus,
  Share2,
  Trophy,
  Check,
  Disc,
  Clock,
  Target,
  Flame,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/AuthContext';
import { PraiseMascot } from '@/components/common/PraiseMascot';

interface ResultScreenProps {
  result: RunResult;
  songTitle: string;
  xpEarned?: number;
  onRetry: () => void;
  onChangeInstrument: () => void;
  onMainMenu: () => void;
  onOpenAuth?: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  songTitle,
  xpEarned = 0,
  onRetry,
  onChangeInstrument,
  onMainMenu,
  onOpenAuth,
}) => {
  const { user, isGuest, stats } = useAuth();
  const [copiedShare, setCopiedShare] = useState(false);

  const isVictory = result.completed;
  const isPractice = Boolean(result.isPractice);
  const elapsedMin = Math.floor(result.elapsedTime / 60);
  const elapsedSec = Math.floor(result.elapsedTime % 60);
  const formattedElapsed = `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')}`;

  const songMin = Math.floor(result.songDuration / 60);
  const songSec = Math.floor(result.songDuration % 60);
  const formattedSongDuration = `${songMin}:${songSec.toString().padStart(2, '0')}`;

  // Personal Best Comparison
  const isNewBestScore = !isPractice && result.score > (stats?.bestScore ?? 0) && (stats?.bestScore ?? 0) > 0;
  const isNewBestCombo = !isPractice && result.highestCombo > (stats?.highestCombo ?? 0) && (stats?.highestCombo ?? 0) > 0;

  // Calculate Rank grade
  const getRank = (accuracy: number, completed: boolean) => {
    if (isPractice) return { grade: 'P', color: 'from-emerald-400 to-teal-600', label: 'Practice' };
    if (!completed) return { grade: 'B', color: 'from-amber-500 to-amber-700', label: 'Unfinished' };
    if (accuracy >= 98) return { grade: 'S+', color: 'from-amber-300 via-amber-400 to-yellow-500', label: 'Divine' };
    if (accuracy >= 95) return { grade: 'S', color: 'from-amber-400 to-amber-600', label: 'Flawless' };
    if (accuracy >= 90) return { grade: 'A', color: 'from-cyan-400 to-blue-500', label: 'Master' };
    if (accuracy >= 80) return { grade: 'B', color: 'from-purple-400 to-violet-600', label: 'Praiser' };
    return { grade: 'C', color: 'from-gray-400 to-gray-600', label: 'Novice' };
  };

  const rank = getRank(result.accuracy, isVictory);

  // SVG Circular Accuracy Ring calculations (radius 110, circumference = 2 * PI * 110 ≈ 691.15)
  const radius = 110;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (Math.min(100, Math.max(0, result.accuracy)) / 100) * circumference;

  const handleShare = async () => {
    const text = `I just scored ${result.score.toLocaleString()} points (${result.accuracy.toFixed(1)}% accuracy) on "${songTitle}" in PraiseTiles! Can you beat my praise rhythm?`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PraiseTiles Score', text, url: window.location.origin });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 bg-[#08070d] text-gray-100 overflow-x-hidden">
      {/* Background Halftone & Atmospheric Glows */}
      <div className="absolute inset-0 bg-halftone-dots opacity-30 pointer-events-none" />
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[400px] blur-[120px] pointer-events-none opacity-40 ${
          isVictory ? 'bg-amber-500/30' : 'bg-purple-600/30'
        }`}
      />

      {/* Main Ceremony Card */}
      <div className="relative z-10 w-full max-w-4xl bg-gradient-to-b from-[#141026]/95 via-[#0f0c1e]/95 to-[#090710]/95 border border-purple-500/30 rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl backdrop-blur-xl animate-fadeIn">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-6 border-b border-gray-800/80">
          <div className="text-center sm:text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 block">
              Performance Results
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2 justify-center sm:justify-start">
              <Disc className="w-6 h-6 text-purple-400 animate-spin-slow" />
              <span>{songTitle}</span>
            </h1>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 justify-center sm:justify-start">
              <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                {result.instrument} Mode
              </span>
              <span>&bull;</span>
              <span>{formattedSongDuration} Hymn Duration</span>
              {isPractice && (
                <>
                  <span>&bull;</span>
                  <span className="uppercase text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                    Non-Competitive Practice
                  </span>
                </>
              )}
            </p>
          </div>

          {/* Result Status Banner */}
          <div className="flex items-center gap-3">
            {isPractice ? (
              <div className="px-4 py-2 rounded-2xl flex items-center gap-2 border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 font-black text-xs sm:text-sm uppercase tracking-wide shadow-md">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Practice Finished</span>
              </div>
            ) : (
              <div
                className={`px-4 py-2 rounded-2xl flex items-center gap-2 border font-black text-xs sm:text-sm uppercase tracking-wide shadow-md ${
                  isVictory
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-rose-500/20 border-rose-500/50 text-rose-300'
                }`}
              >
                {isVictory ? (
                  <>
                    <Award className="w-4 h-4 text-amber-400" />
                    <span>Cleared</span>
                  </>
                ) : (
                  <>
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>Interrupted</span>
                  </>
                )}
              </div>
            )}

            {/* Share Result Button */}
            <button
              onClick={handleShare}
              className="p-2.5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-purple-400 text-gray-300 hover:text-white transition flex items-center gap-1.5 text-xs font-semibold"
              title="Share Performance"
            >
              {copiedShare ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Center Stage: Vinyl Turntable Centerpiece & Mascot Duo */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 my-8 items-center">
          {/* Left Column: Mascot Reaction */}
          <div className="lg:col-span-3 flex flex-col items-center justify-center order-2 lg:order-1">
            <PraiseMascot
              pose={isVictory ? 'celebrating' : 'encouraging'}
              size="lg"
              showSpeechBubble
              speechText={
                isVictory
                  ? 'Magnificent praise! Heavenly rhythm!'
                  : 'Keep the faith! Tap to retry!'
              }
            />
          </div>

          {/* Center Column: Animated Vinyl Record with Accuracy Ring */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center order-1 lg:order-2">
            <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
              {/* Circular Accuracy Progress SVG Ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none z-20">
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.05)"
                  strokeWidth="8"
                />
                <circle
                  cx="50%"
                  cy="50%"
                  r={radius}
                  fill="none"
                  stroke="url(#accuracyGradient)"
                  strokeWidth="8"
                  strokeDasharray={circumference}
                  strokeDashoffset={progressOffset}
                  strokeLinecap="round"
                  className="transition-all duration-1000 ease-out"
                />
                <defs>
                  <linearGradient id="accuracyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="50%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Realistic Grooved Vinyl Record */}
              <div className="relative w-56 h-56 sm:w-60 sm:h-60 rounded-full vinyl-grooves shadow-[0_0_35px_rgba(0,0,0,0.9)] border-4 border-[#252038] flex items-center justify-center animate-spin-record z-10">
                {/* Vinyl Light Reflection Sheens */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />

                {/* Center Record Label / Artwork */}
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-700 via-amber-600 to-indigo-900 border-2 border-amber-400/80 flex flex-col items-center justify-center p-2 text-center shadow-inner">
                  <div className="w-4 h-4 rounded-full bg-[#08070d] border border-amber-300 mb-1" />
                  <span className="text-[8px] font-black uppercase text-amber-300 tracking-wider">PraiseTiles</span>
                  <span className="text-[7px] text-white/80 font-mono truncate max-w-[70px]">Gospel Vinyl</span>
                </div>
              </div>

              {/* Rank Badge Floating Overlay */}
              <div className="absolute -bottom-2 -right-2 z-30 flex flex-col items-center">
                <div className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${rank.color} text-black font-black text-2xl sm:text-3xl flex items-center justify-center shadow-xl border-2 border-white/40 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]`}>
                  {rank.grade}
                </div>
                <span className="text-[9px] font-bold text-amber-300 uppercase tracking-widest mt-1 bg-black/80 px-2 py-0.5 rounded-full border border-amber-500/30">
                  {rank.label}
                </span>
              </div>
            </div>

            {/* Final Score Prominent Presentation */}
            <div className="mt-5 text-center">
              <span className="text-xs uppercase tracking-widest text-gray-400 font-bold block">
                Final Score
              </span>
              <p className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 tracking-tight text-glow-gold font-mono">
                {result.score.toLocaleString()}
              </p>
              {isNewBestScore && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-300 text-xs font-black uppercase tracking-wider shadow-[0_0_15px_rgba(251,191,36,0.6)] animate-bounce">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>New Personal Best!</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key Metrics Stack */}
          <div className="lg:col-span-3 flex flex-col gap-3 order-3">
            {/* Accuracy Card */}
            <div className="p-4 rounded-2xl bg-[#171329]/80 border border-gray-800 text-left">
              <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                <Target className="w-3.5 h-3.5 text-cyan-400" />
                Accuracy
              </span>
              <p className="text-2xl font-black text-cyan-300 mt-0.5 font-mono">
                {result.accuracy.toFixed(1)}%
              </p>
              <span className="text-[10px] text-gray-500">
                {result.isPartial ? 'Up to fail line' : 'Full song timing'}
              </span>
            </div>

            {/* Highest Streak */}
            <div className="p-4 rounded-2xl bg-[#171329]/80 border border-gray-800 text-left">
              <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5 text-emerald-400" />
                Max Streak
              </span>
              <p className="text-2xl font-black text-emerald-400 mt-0.5 font-mono">
                {result.highestCombo}x
              </p>
              <span className="text-[10px] text-gray-500">
                {isNewBestCombo ? 'Personal record combo!' : 'Consecutive hit streak'}
              </span>
            </div>

            {/* Perfect Streak */}
            <div className="p-4 rounded-2xl bg-[#171329]/80 border border-gray-800 text-left">
              <span className="text-[10px] uppercase font-bold text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-pink-400" />
                Highest Perfect Streak
              </span>
              <p className="text-2xl font-black text-pink-300 mt-0.5 font-mono">
                {result.highestPerfectStreak ?? 0}x
              </p>
              <span className="text-[10px] text-gray-500">Consecutive Perfects</span>
            </div>

            {/* XP Award */}
            {xpEarned > 0 && !isPractice && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-left">
                <span className="text-[10px] uppercase font-bold text-amber-400 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5 text-amber-400" />
                  Progression XP
                </span>
                <p className="text-2xl font-black text-amber-300 mt-0.5 font-mono">
                  +{xpEarned} XP
                </p>
                <span className="text-[10px] text-amber-400/70">Synced to Profile</span>
              </div>
            )}
          </div>
        </div>

        {/* PERFORMANCE BREAKDOWN: Genuine Hit Grade Statistics Grid & Sustain Bonuses */}
        <div className="my-6 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 text-left">
            Timing &amp; Accuracy Breakdown
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* PERFECT */}
            <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-left">
              <span className="text-[10px] font-bold uppercase text-purple-300">Perfect (&plusmn;50ms)</span>
              <p className="text-xl font-black text-white mt-0.5 font-mono">
                {result.perfectCount ?? result.notesHit}
              </p>
              <span className="text-[10px] text-purple-400 font-semibold">100 Pts each</span>
            </div>

            {/* GREAT */}
            <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 text-left">
              <span className="text-[10px] font-bold uppercase text-cyan-300">Great (&plusmn;100ms)</span>
              <p className="text-xl font-black text-white mt-0.5 font-mono">
                {result.greatCount ?? 0}
              </p>
              <span className="text-[10px] text-cyan-400 font-semibold">75 Pts each</span>
            </div>

            {/* GOOD */}
            <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 text-left">
              <span className="text-[10px] font-bold uppercase text-amber-300">Good (&plusmn;150ms)</span>
              <p className="text-xl font-black text-white mt-0.5 font-mono">
                {result.goodCount ?? 0}
              </p>
              <span className="text-[10px] text-amber-400 font-semibold">50 Pts each</span>
            </div>

            {/* MISS */}
            <div className="p-3.5 rounded-2xl bg-rose-950/20 border border-rose-500/30 text-left">
              <span className="text-[10px] font-bold uppercase text-rose-300">Missed Notes</span>
              <p className="text-xl font-black text-white mt-0.5 font-mono">
                {result.missCount ?? (result.totalNotes - result.notesHit)}
              </p>
              <span className="text-[10px] text-rose-400 font-semibold">
                {isPractice ? 'Practice feedback' : '0 Pts / Shield loss'}
              </span>
            </div>
          </div>

          {/* Long Note Sustain Bonus Bar */}
          <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-center justify-between text-left">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <div>
                <span className="text-xs font-bold text-white block">Sustained Long Tile Bonuses</span>
                <span className="text-[10px] text-gray-400">
                  {result.completedSustainsCount ?? 0} sustained notes fully completed
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm font-black text-amber-300 font-mono">
                +{result.sustainBonusPoints ?? 0} PTS
              </span>
              <span className="text-[10px] text-amber-400/80 block uppercase font-bold">+250 per completion</span>
            </div>
          </div>
        </div>

        {/* Guest Progress Save Banner */}
        {isGuest && onOpenAuth && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-transparent border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>Save this performance to your permanent record</span>
              </p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Create a free account to track high scores, level up your gem rank, and enter tournaments.
              </p>
            </div>
            <button
              onClick={onOpenAuth}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-xs transition shadow-md shrink-0"
            >
              Sign In / Save
            </button>
          </div>
        )}

        {/* Actions Toolbar */}
        <div className="pt-4 border-t border-gray-800/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Main Action: Instant Retry */}
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-amber-500/25 transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4 stroke-[2.5]" />
            <span>PLAY AGAIN</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              onClick={onChangeInstrument}
              className="flex-1 sm:flex-none px-4 py-3 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-gray-200 hover:text-white transition"
            >
              Change Instrument
            </button>
            <button
              onClick={onMainMenu}
              className="flex-1 sm:flex-none px-5 py-3 rounded-xl bg-[#161226] hover:bg-[#201a35] border border-purple-500/30 text-xs font-bold text-purple-200 hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <Home className="w-3.5 h-3.5" />
              <span>Main Menu</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
