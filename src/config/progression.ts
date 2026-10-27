/**
 * Central Versioned Progression Configuration for PraiseTiles
 * Rule version: 1.0.0 (Matches GDD v1.0 Section 7)
 * 
 * Defines gem rank tiers, 3-factor promotion requirements, and XP curves.
 * XP alone must never unlock a rank!
 */

import { GemRank, PromotionRequirement, PromotionEvaluation } from '@/types/auth';

export const PROGRESSION_CONFIG = {
  RULES_VERSION: '1.0.0',

  GEM_TIERS: [
    {
      tier: 1,
      gemRank: 'Quartz',
      title: 'Pulse Starter',
      requiredXp: 0,
      requiredAccuracy: 0,
      requiredQualifyingSongs: 0,
      colorHex: '#94a3b8', // Silver/Quartz
    },
    {
      tier: 2,
      gemRank: 'Jade',
      title: 'Rhythm Keeper',
      requiredXp: 300,
      requiredAccuracy: 80.0,
      requiredQualifyingSongs: 3,
      colorHex: '#10b981', // Jade Emerald
    },
    {
      tier: 3,
      gemRank: 'Sapphire',
      title: 'Groove Master',
      requiredXp: 700,
      requiredAccuracy: 85.0,
      requiredQualifyingSongs: 5,
      colorHex: '#06b6d4', // Sapphire Cyan
    },
    {
      tier: 4,
      gemRank: 'Ruby',
      title: 'Virtuoso',
      requiredXp: 1500,
      requiredAccuracy: 90.0,
      requiredQualifyingSongs: 7,
      colorHex: '#f43f5e', // Ruby Crimson
    },
    {
      tier: 5,
      gemRank: 'Diamond',
      title: 'Legend',
      requiredXp: 3000,
      requiredAccuracy: 95.0,
      requiredQualifyingSongs: 10,
      colorHex: '#c084fc', // Diamond Violet/White
    },
  ] as const satisfies readonly PromotionRequirement[],

  // Anti-farming limits
  MIN_TIME_FOR_PARTICIPATION_XP_SECONDS: 15.0,
  FAILED_RUN_PARTICIPATION_XP: 5,
} as const;

/**
 * Calculates XP earned for a match run.
 * Completed runs scale with accuracy, highest combo, and score.
 * Failed runs award 5 XP only if played for >= 15 seconds to prevent spam.
 */
export function calculateMatchXp(
  completed: boolean,
  accuracy: number,
  highestCombo: number,
  score: number,
  elapsedTime: number
): number {
  if (completed) {
    const accuracyFactor = Math.max(0, Math.min(100, accuracy)) / 100;
    const base = 100 * accuracyFactor;
    const comboBonus = highestCombo * 0.5;
    const scoreBonus = score / 1000;
    return Math.round(base + comboBonus + scoreBonus);
  }

  // Failed run anti-farming protection
  if (elapsedTime >= PROGRESSION_CONFIG.MIN_TIME_FOR_PARTICIPATION_XP_SECONDS) {
    return PROGRESSION_CONFIG.FAILED_RUN_PARTICIPATION_XP;
  }
  return 0;
}

/**
 * Calculates player level from total XP using a square root curve:
 * Level 1 at 0 XP, Level 2 at 100 XP, Level 3 at 400 XP, Level 4 at 900 XP, etc.
 */
export function calculateLevelFromXp(xp: number): number {
  if (xp <= 0) return 1;
  return Math.floor(Math.sqrt(xp / 100)) + 1;
}

/**
 * Returns tier definition for a given rank.
 */
export function getGemTier(gemRank: GemRank): PromotionRequirement {
  const tier = PROGRESSION_CONFIG.GEM_TIERS.find((t) => t.gemRank === gemRank);
  return tier || PROGRESSION_CONFIG.GEM_TIERS[0];
}

/**
 * Determines whether a completed song qualifies toward the next promotion target.
 * Failed runs NEVER qualify.
 */
export function isSongQualifyingForNextRank(
  currentRank: GemRank,
  completed: boolean,
  accuracy: number
): boolean {
  if (!completed) return false;

  const currentTier = getGemTier(currentRank);
  const nextTier = PROGRESSION_CONFIG.GEM_TIERS.find((t) => t.tier === currentTier.tier + 1);

  if (!nextTier) return false; // Already at max rank
  return accuracy >= nextTier.requiredAccuracy;
}

/**
 * Evaluates 3-factor rank promotion progress:
 * 1. XP >= threshold
 * 2. Accuracy >= threshold on qualifying songs
 * 3. Qualifying completed song count >= threshold
 * 
 * XP alone CANNOT unlock the next tier.
 */
export function evaluateRankPromotion(
  currentRank: GemRank,
  xp: number,
  qualifyingCount: number
): PromotionEvaluation {
  const currentTier = getGemTier(currentRank);
  const nextTier = PROGRESSION_CONFIG.GEM_TIERS.find((t) => t.tier === currentTier.tier + 1);

  if (!nextTier) {
    // Diamond (Max tier reached)
    return {
      currentRank,
      nextRank: null,
      canPromote: false,
      currentXp: xp,
      requiredXp: currentTier.requiredXp,
      currentQualifying: qualifyingCount,
      requiredQualifying: currentTier.requiredQualifyingSongs,
      requiredAccuracy: currentTier.requiredAccuracy,
      progressPercent: 100,
    };
  }

  const xpProgress = Math.min(1.0, xp / nextTier.requiredXp);
  const songProgress = Math.min(1.0, qualifyingCount / nextTier.requiredQualifyingSongs);
  const progressPercent = Math.round(((xpProgress + songProgress) / 2) * 100);

  const canPromote =
    xp >= nextTier.requiredXp &&
    qualifyingCount >= nextTier.requiredQualifyingSongs;

  return {
    currentRank,
    nextRank: nextTier.gemRank,
    canPromote,
    currentXp: xp,
    requiredXp: nextTier.requiredXp,
    currentQualifying: qualifyingCount,
    requiredQualifying: nextTier.requiredQualifyingSongs,
    requiredAccuracy: nextTier.requiredAccuracy,
    progressPercent,
  };
}
