/**
 * Challenges, Achievements & Daily Login Streak Progression Engine
 * PraiseTiles — Gameplay Upgrade
 */

import { RunResult } from '@/types/game';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export interface Challenge {
  id: string;
  title: string;
  description: string;
  period: 'daily' | 'weekly';
  targetValue: number;
  currentValue: number;
  xpReward: number;
  completed: boolean;
  claimed: boolean;
  expiresAt: string;
}

export interface AchievementBadge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface PlayerStreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastLoginDate: string;
  isTodayClaimed: boolean;
  todayRewardXp: number;
}

const LOCAL_STORAGE_CHALLENGES = 'praisetiles_challenges';
const LOCAL_STORAGE_STREAK = 'praisetiles_streak';
const LOCAL_STORAGE_ACHIEVEMENTS = 'praisetiles_achievements';

/**
 * Returns consistent 00:00 UTC expiry date for daily and weekly resets.
 */
export function getChallengeExpiries() {
  const now = new Date();

  // Daily: next 00:00:00 UTC
  const dailyExpiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  // Weekly: next Monday 00:00:00 UTC
  const dayOfWeek = now.getUTCDay(); // 0 is Sunday, 1 is Monday...
  const daysUntilNextMonday = ((7 - dayOfWeek + 1) % 7) || 7;
  const weeklyExpiry = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilNextMonday));

  return {
    daily: dailyExpiry.toISOString(),
    weekly: weeklyExpiry.toISOString(),
  };
}

/**
 * Default seeded challenges.
 */
export function getDefaultChallenges(): Challenge[] {
  const { daily, weekly } = getChallengeExpiries();

  return [
    {
      id: 'daily_three_songs',
      title: 'Praise Devotion',
      description: 'Complete 3 songs in any instrument mode',
      period: 'daily',
      targetValue: 3,
      currentValue: 0,
      xpReward: 150,
      completed: false,
      claimed: false,
      expiresAt: daily,
    },
    {
      id: 'daily_high_acc',
      title: 'Flawless Timing',
      description: 'Finish a song with at least 92% accuracy',
      period: 'daily',
      targetValue: 1,
      currentValue: 0,
      xpReward: 200,
      completed: false,
      claimed: false,
      expiresAt: daily,
    },
    {
      id: 'daily_combo_50',
      title: 'Rhythm Momentum',
      description: 'Reach a 50+ combo in a single performance',
      period: 'daily',
      targetValue: 1,
      currentValue: 0,
      xpReward: 175,
      completed: false,
      claimed: false,
      expiresAt: daily,
    },
    {
      id: 'weekly_points_marathon',
      title: 'Sanctuary Marathon',
      description: 'Accumulate 200,000 total points this week',
      period: 'weekly',
      targetValue: 200000,
      currentValue: 0,
      xpReward: 1000,
      completed: false,
      claimed: false,
      expiresAt: weekly,
    },
    {
      id: 'weekly_sustains_30',
      title: 'Sustain Virtuoso',
      description: 'Complete 30 long sustained tiles without early release',
      period: 'weekly',
      targetValue: 30,
      currentValue: 0,
      xpReward: 750,
      completed: false,
      claimed: false,
      expiresAt: weekly,
    },
  ];
}

/**
 * Loads current challenges for player, refreshing if expired.
 */
export function loadPlayerChallenges(): Challenge[] {
  if (typeof window === 'undefined') return getDefaultChallenges();

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_CHALLENGES);
    if (saved) {
      const parsed: Challenge[] = JSON.parse(saved);
      const now = new Date();

      // Check if daily or weekly have expired
      const valid = parsed.map((ch) => {
        if (new Date(ch.expiresAt) <= now) {
          const { daily, weekly } = getChallengeExpiries();
          return {
            ...ch,
            currentValue: 0,
            completed: false,
            claimed: false,
            expiresAt: ch.period === 'daily' ? daily : weekly,
          };
        }
        return ch;
      });

      return valid;
    }
  } catch {
    // Ignore
  }

  const defaults = getDefaultChallenges();
  savePlayerChallenges(defaults);
  return defaults;
}

export function savePlayerChallenges(challenges: Challenge[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STORAGE_CHALLENGES, JSON.stringify(challenges));
  } catch {
    // Ignore
  }
}

/**
 * Evaluates match result against challenges and awards completions.
 */
export function updateChallengesOnMatch(result: RunResult): {
  updatedChallenges: Challenge[];
  newlyCompleted: Challenge[];
} {
  const challenges = loadPlayerChallenges();
  const newlyCompleted: Challenge[] = [];

  const updated = challenges.map((ch) => {
    if (ch.completed) return ch;

    let nextVal = ch.currentValue;

    if (ch.id === 'daily_three_songs' && result.completed) {
      nextVal += 1;
    } else if (ch.id === 'daily_high_acc' && result.completed && result.accuracy >= 92) {
      nextVal = 1;
    } else if (ch.id === 'daily_combo_50' && result.highestCombo >= 50) {
      nextVal = 1;
    } else if (ch.id === 'weekly_points_marathon') {
      nextVal += result.score;
    } else if (ch.id === 'weekly_sustains_30') {
      nextVal += result.completedSustainsCount ?? 0;
    }

    const isNowCompleted = nextVal >= ch.targetValue;
    if (isNowCompleted && !ch.completed) {
      newlyCompleted.push({ ...ch, currentValue: nextVal, completed: true });
    }

    return {
      ...ch,
      currentValue: Math.min(nextVal, ch.targetValue),
      completed: isNowCompleted,
    };
  });

  savePlayerChallenges(updated);
  return { updatedChallenges: updated, newlyCompleted };
}

/**
 * Evaluates the 8 core Achievement Badges.
 */
export function evaluateAchievements(
  result: RunResult,
  stats: {
    totalSongsPlayed?: number;
    highestPerfectStreak?: number;
    totalSustainsCompleted?: number;
    playedPiano?: boolean;
    playedGuitar?: boolean;
  }
): string[] {
  if (typeof window === 'undefined') return [];

  const unlockedIds: string[] = [];
  let existing: Record<string, string> = {};

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_ACHIEVEMENTS);
    if (saved) existing = JSON.parse(saved);
  } catch {}

  const checkBadge = (id: string, condition: boolean) => {
    if (condition && !existing[id]) {
      existing[id] = new Date().toISOString();
      unlockedIds.push(id);
    }
  };

  checkBadge('first_performance', (stats.totalSongsPlayed ?? 0) >= 1 || result.completed);
  checkBadge('rhythm_keeper', result.accuracy >= 90);
  checkBadge('perfect_touch', (result.perfectCount ?? 0) >= 50);
  checkBadge('combo_master', result.highestCombo >= 75);
  checkBadge('worship_warrior', (stats.totalSongsPlayed ?? 0) >= 10);
  checkBadge('instrument_explorer', Boolean(stats.playedPiano && stats.playedGuitar));
  checkBadge('sustain_master', (stats.totalSustainsCompleted ?? 0) >= 20 || (result.completedSustainsCount ?? 0) >= 10);
  checkBadge('perfect_streak', (result.highestPerfectStreak ?? 0) >= 25 || (stats.highestPerfectStreak ?? 0) >= 25);

  try {
    localStorage.setItem(LOCAL_STORAGE_ACHIEVEMENTS, JSON.stringify(existing));
  } catch {}

  return unlockedIds;
}

/**
 * Evaluates consecutive day login streak.
 */
export function checkDailyLoginStreak(): PlayerStreakInfo {
  const today = new Date().toISOString().split('T')[0];

  if (typeof window === 'undefined') {
    return {
      currentStreak: 1,
      longestStreak: 1,
      lastLoginDate: today,
      isTodayClaimed: true,
      todayRewardXp: 50,
    };
  }

  let streakInfo: PlayerStreakInfo = {
    currentStreak: 0,
    longestStreak: 0,
    lastLoginDate: '',
    isTodayClaimed: false,
    todayRewardXp: 50,
  };

  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_STREAK);
    if (saved) {
      streakInfo = JSON.parse(saved);
    }
  } catch {}

  if (streakInfo.lastLoginDate === today) {
    // Already claimed today
    return { ...streakInfo, isTodayClaimed: true };
  }

  // Calculate day difference
  const lastDate = streakInfo.lastLoginDate ? new Date(streakInfo.lastLoginDate) : null;
  const currentDate = new Date(today);
  const diffDays = lastDate
    ? Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24))
    : 999;

  let newStreak = 1;
  if (diffDays === 1) {
    // Consecutive day
    newStreak = streakInfo.currentStreak + 1;
  } else if (diffDays === 0) {
    newStreak = streakInfo.currentStreak;
  }

  const longestStreak = Math.max(newStreak, streakInfo.longestStreak);
  const rewardXp = Math.min(newStreak, 7) * 50;

  const updated: PlayerStreakInfo = {
    currentStreak: newStreak,
    longestStreak,
    lastLoginDate: today,
    isTodayClaimed: false,
    todayRewardXp: rewardXp,
  };

  try {
    localStorage.setItem(LOCAL_STORAGE_STREAK, JSON.stringify(updated));
  } catch {}

  return updated;
}
