/**
 * Pure scoring and judgement logic for PraiseTiles
 * Rule version: 1.0.0
 * 
 * Shared across both Piano Tiles and Guitar Tiles presentations.
 * Tested comprehensively in tests/scoring.test.ts
 */

import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { HitGrade, ScoreState } from '@/types/game';

/**
 * Evaluates the timing difference between tap and note target time.
 * @param timeDiff seconds between user tap and note timestamp (hitTime - noteTime)
 * @returns HitGrade if within valid window, otherwise null
 */
export function getTimingJudgement(timeDiff: number): 'PERFECT' | 'GREAT' | 'GOOD' | null {
  const absDiff = Math.abs(timeDiff);
  const { PERFECT_SEC, GREAT_SEC, GOOD_SEC } = GAMEPLAY_CONFIG.TIMING_WINDOWS;

  if (absDiff <= PERFECT_SEC) {
    return 'PERFECT';
  }
  if (absDiff <= GREAT_SEC) {
    return 'GREAT';
  }
  if (absDiff <= GOOD_SEC) {
    return 'GOOD';
  }
  return null; // Outside valid timing window
}

/**
 * Determines current combo multiplier based on consecutive successful hits.
 */
export function getComboMultiplier(combo: number): number {
  if (combo <= 0) return 1.0;
  for (const tier of GAMEPLAY_CONFIG.COMBO_MULTIPLIERS) {
    if (combo >= tier.minCombo) {
      return tier.multiplier;
    }
  }
  return 1.0;
}

/**
 * Calculates weighted accuracy percentage.
 * Accuracy formula: sum(hit weights) / total required notes * 100
 */
export function calculateAccuracy(
  perfectCount: number,
  greatCount: number,
  goodCount: number,
  totalEncountered: number
): number {
  if (totalEncountered <= 0) {
    return 100.0;
  }
  const weightedScore =
    perfectCount * GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.PERFECT +
    greatCount * GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.GREAT +
    goodCount * GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.GOOD;

  const rawAccuracy = (weightedScore / totalEncountered) * 100;
  return Math.round(rawAccuracy * 100) / 100; // 2 decimal places
}

/**
 * Creates a clean initial score state for a new run or retry.
 */
export function createInitialScoreState(): ScoreState {
  return {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfectCount: 0,
    greatCount: 0,
    goodCount: 0,
    missCount: 0,
    runAccuracy: 100.0,
    totalEncountered: 0,
  };
}

/**
 * Pure state transition when a successful note hit occurs.
 */
export function applyHitToScoreState(current: ScoreState, grade: Exclude<HitGrade, 'MISS'>): ScoreState {
  const newCombo = current.combo + 1;
  const maxCombo = Math.max(current.maxCombo, newCombo);
  const multiplier = getComboMultiplier(newCombo);
  const basePoints = GAMEPLAY_CONFIG.BASE_POINTS[grade];
  const pointsEarned = Math.round(basePoints * multiplier);

  const perfectCount = current.perfectCount + (grade === 'PERFECT' ? 1 : 0);
  const greatCount = current.greatCount + (grade === 'GREAT' ? 1 : 0);
  const goodCount = current.goodCount + (grade === 'GOOD' ? 1 : 0);
  const totalEncountered = current.totalEncountered + 1;

  const runAccuracy = calculateAccuracy(perfectCount, greatCount, goodCount, totalEncountered);

  return {
    ...current,
    score: current.score + pointsEarned,
    combo: newCombo,
    maxCombo,
    perfectCount,
    greatCount,
    goodCount,
    runAccuracy,
    totalEncountered,
  };
}

/**
 * Pure state transition when a note is missed.
 */
export function applyMissToScoreState(current: ScoreState): ScoreState {
  const totalEncountered = current.totalEncountered + 1;
  const missCount = current.missCount + 1;
  const runAccuracy = calculateAccuracy(
    current.perfectCount,
    current.greatCount,
    current.goodCount,
    totalEncountered
  );

  return {
    ...current,
    combo: 0,
    missCount,
    runAccuracy,
    totalEncountered,
  };
}

/**
 * Returns current star tier (1, 2, or 3) for the song's progression stage.
 */
export function getCurrentStarStage(currentTime: number, duration: number): 1 | 2 | 3 {
  if (duration <= 0) return 1;
  const ratio = currentTime / duration;
  if (ratio < GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_1) {
    return 1;
  }
  if (ratio < GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_2) {
    return 2;
  }
  return 3;
}

/**
 * Applies a sustain hold tick (+10 pts per 100ms held) to current score.
 */
export function applySustainTickToScoreState(current: ScoreState): ScoreState {
  const multiplier = getComboMultiplier(current.combo);
  const points = Math.round(GAMEPLAY_CONFIG.SUSTAIN.TICK_POINTS * multiplier);
  return {
    ...current,
    score: current.score + points,
  };
}

/**
 * Applies sustain completion bonus (+100 pts) when a long note is held through its full duration.
 */
export function applySustainCompletionToScoreState(current: ScoreState): ScoreState {
  const multiplier = getComboMultiplier(current.combo);
  const bonus = Math.round(GAMEPLAY_CONFIG.SUSTAIN.COMPLETION_BONUS * multiplier);
  return {
    ...current,
    score: current.score + bonus,
  };
}

/**
 * Handles early release of a sustained note.
 * Early release preserves points earned so far, but resets combo to 0.
 */
export function applyEarlyReleaseToScoreState(current: ScoreState): ScoreState {
  return {
    ...current,
    combo: 0,
  };
}

/**
 * Calculates dynamic approach time (speed) based on song progression and tempo.
 * Star 1 = 1.8s (comfortable intro)
 * Star 2 = 1.45s (accelerated moderate pace)
 * Star 3 = 1.15s (climax arcade speed)
 */
export function getDynamicApproachTime(currentTime: number, duration: number, estimatedBpm?: number | null): number {
  const stage = getCurrentStarStage(currentTime, duration);
  const baseTime =
    stage === 1
      ? GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_1
      : stage === 2
      ? GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_2
      : GAMEPLAY_CONFIG.DYNAMIC_APPROACH_TIMES.STAR_3;

  // Modulate slightly based on BPM if detected (faster tempo = faster tiles)
  if (estimatedBpm && estimatedBpm > 130) {
    return Math.max(1.0, baseTime - 0.1);
  }
  return baseTime;
}
