'use client';

import React, { useState, useEffect } from 'react';
import {
  Challenge,
  loadPlayerChallenges,
  checkDailyLoginStreak,
  PlayerStreakInfo,
} from '@/lib/progression/challenges';
import { Flame, CheckCircle, Clock, Sparkles, X, Trophy } from 'lucide-react';

interface ChallengePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChallengePanel: React.FC<ChallengePanelProps> = ({ isOpen, onClose }) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [streak, setStreak] = useState<PlayerStreakInfo | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChallenges(loadPlayerChallenges());
      setStreak(checkDailyLoginStreak());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const dailyChallenges = challenges.filter((c) => c.period === 'daily');
  const weeklyChallenges = challenges.filter((c) => c.period === 'weekly');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#110d24] border border-purple-500/30 shadow-2xl p-6 sm:p-7 text-white space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">Praise Challenges</h2>
              <p className="text-xs text-gray-400">Complete tasks to earn XP and rank up</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Challenges"
            className="p-2 rounded-xl bg-gray-900 border border-gray-800 text-gray-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Daily Streak Highlight */}
        {streak && (
          <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-transparent border border-amber-500/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 block">
                  Daily Play Streak
                </span>
                <p className="text-base font-black text-white">
                  {streak.currentStreak} Day{streak.currentStreak > 1 ? 's' : ''} Active
                </p>
                <p className="text-[10px] text-gray-400">Longest: {streak.longestStreak} days</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-black text-amber-300 font-mono block">
                +{streak.todayRewardXp} XP
              </span>
              <span className="text-[9px] uppercase tracking-wider text-amber-400/80 font-bold">
                Daily Bonus
              </span>
            </div>
          </div>
        )}

        {/* Daily Challenges Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Daily Challenges
            </h3>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              Resets 00:00 UTC
            </span>
          </div>

          <div className="space-y-2.5">
            {dailyChallenges.map((ch) => {
              const pct = Math.min(100, Math.round((ch.currentValue / ch.targetValue) * 100));
              return (
                <div
                  key={ch.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    ch.completed
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#181330] border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{ch.title}</span>
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      +{ch.xpReward} XP
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{ch.description}</p>

                  {/* Progress Bar */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ch.completed ? 'bg-emerald-400' : 'bg-amber-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">
                      {ch.currentValue} / {ch.targetValue}
                    </span>
                    {ch.completed && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Weekly Challenges Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              Weekly Challenges
            </h3>
            <span className="text-[10px] text-gray-400 flex items-center gap-1 font-mono">
              <Clock className="w-3 h-3" />
              Resets Mondays UTC
            </span>
          </div>

          <div className="space-y-2.5">
            {weeklyChallenges.map((ch) => {
              const pct = Math.min(100, Math.round((ch.currentValue / ch.targetValue) * 100));
              return (
                <div
                  key={ch.id}
                  className={`p-3.5 rounded-2xl border transition ${
                    ch.completed
                      ? 'bg-emerald-950/20 border-emerald-500/40'
                      : 'bg-[#181330] border-gray-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white">{ch.title}</span>
                    <span className="text-[11px] font-mono font-bold text-amber-400">
                      +{ch.xpReward} XP
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{ch.description}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          ch.completed ? 'bg-emerald-400' : 'bg-purple-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 shrink-0">
                      {ch.currentValue.toLocaleString()} / {ch.targetValue.toLocaleString()}
                    </span>
                    {ch.completed && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
