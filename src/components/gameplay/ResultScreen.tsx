'use client';

import React from 'react';
import { RunResult } from '@/types/game';
import { RotateCcw, Home, Award, AlertOctagon, Music, Zap } from 'lucide-react';

interface ResultScreenProps {
  result: RunResult;
  songTitle: string;
  onRetry: () => void;
  onChangeInstrument: () => void;
  onMainMenu: () => void;
}

export const ResultScreen: React.FC<ResultScreenProps> = ({
  result,
  songTitle,
  onRetry,
  onChangeInstrument,
  onMainMenu,
}) => {
  const isVictory = result.completed;
  const elapsedMin = Math.floor(result.elapsedTime / 60);
  const elapsedSec = Math.floor(result.elapsedTime % 60);
  const formattedElapsed = `${elapsedMin}:${elapsedSec.toString().padStart(2, '0')}`;

  const songMin = Math.floor(result.songDuration / 60);
  const songSec = Math.floor(result.songDuration % 60);
  const formattedSongDuration = `${songMin}:${songSec.toString().padStart(2, '0')}`;

  let failureDescription = '';
  if (!isVictory) {
    if (result.failureReason === 'MISSED_NOTE') {
      failureDescription = 'Strict Rule: A required note was missed.';
    } else if (result.failureReason === 'INCORRECT_TAP') {
      failureDescription = 'Strict Rule: An empty lane was tapped without a note in range.';
    } else {
      failureDescription = 'Praise run interrupted.';
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-center items-center p-4 sm:p-6 bg-[#090a0f] text-gray-100">
      <div className="w-full max-w-lg bg-gray-950/90 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden animate-fadeIn">
        {/* Glow Header */}
        <div
          className={`absolute top-0 left-1/2 -translate-x-1/2 w-80 h-32 blur-3xl pointer-events-none ${
            isVictory ? 'bg-amber-500/20' : 'bg-rose-500/20'
          }`}
        />

        {/* Status Badge & Icon */}
        <div className="relative z-10 flex flex-col items-center text-center mb-6">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-3 shadow-xl ${
              isVictory
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black glow-gold'
                : 'bg-gradient-to-br from-rose-500 to-rose-700 text-white glow-rose'
            }`}
          >
            {isVictory ? (
              <Award className="w-8 h-8 stroke-[2.5]" />
            ) : (
              <AlertOctagon className="w-8 h-8 stroke-[2.5]" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            {isVictory ? 'Praise Completed!' : 'Praise Interrupted'}
          </h2>

          <p
            className={`text-xs sm:text-sm font-semibold mt-1 ${
              isVictory ? 'text-amber-400' : 'text-rose-400'
            }`}
          >
            {isVictory ? 'Full Song Cleared' : failureDescription}
          </p>

          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5">
            <Music className="w-3.5 h-3.5" />
            <span className="truncate max-w-xs">{songTitle}</span>
            <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-bold">
              {result.instrument}
            </span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="relative z-10 grid grid-cols-2 gap-3 mb-6">
          {/* Total Score */}
          <div className="col-span-2 p-4 rounded-2xl bg-gray-900/80 border border-gray-800 text-center">
            <span className="text-[11px] uppercase tracking-wider text-gray-400 font-bold">
              Final Score
            </span>
            <p className="text-3xl sm:text-4xl font-black text-amber-400 tracking-tight mt-0.5">
              {result.score.toLocaleString()}
            </p>
          </div>

          {/* Accuracy */}
          <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
              {result.isPartial ? 'Run Accuracy (Incomplete)' : 'Final Accuracy'}
            </span>
            <p className="text-xl font-black text-cyan-400 mt-1">
              {result.accuracy.toFixed(1)}%
            </p>
            {result.isPartial && (
              <span className="text-[10px] text-gray-400 block mt-0.5">
                Up to failure point
              </span>
            )}
          </div>

          {/* Highest Combo */}
          <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
              Highest Combo
            </span>
            <p className="text-xl font-black text-emerald-400 mt-1 flex items-center gap-1">
              <Zap className="w-4 h-4 fill-emerald-400" />
              {result.highestCombo}x
            </p>
            <span className="text-[10px] text-gray-400 block mt-0.5">
              Consecutive hits
            </span>
          </div>

          {/* Notes Hit */}
          <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
              Notes Hit
            </span>
            <p className="text-lg font-black text-white mt-1">
              {result.notesHit} <span className="text-xs text-gray-500">/ {result.totalNotes}</span>
            </p>
          </div>

          {/* Elapsed Time */}
          <div className="p-3.5 rounded-xl bg-gray-900/60 border border-gray-800">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 font-bold block">
              Time Played
            </span>
            <p className="text-lg font-black text-white mt-1">
              {formattedElapsed} <span className="text-xs text-gray-500">/ {formattedSongDuration}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative z-10 flex flex-col gap-2.5">
          {/* Instant Retry (Reuses decoded audio and map) */}
          <button
            onClick={onRetry}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-extrabold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg glow-gold transition duration-150 hover:scale-[1.01] active:scale-[0.99]"
          >
            <RotateCcw className="w-5 h-5 stroke-[2.5]" />
            Retry Track (Instant)
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onChangeInstrument}
              className="py-3 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-gray-200 hover:text-white transition"
            >
              Change Instrument
            </button>
            <button
              onClick={onMainMenu}
              className="py-3 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-800 text-xs font-bold text-gray-200 hover:text-white flex items-center justify-center gap-1.5 transition"
            >
              <Home className="w-3.5 h-3.5" />
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
