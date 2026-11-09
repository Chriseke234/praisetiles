import { describe, it, expect } from 'vitest';
import {
  getTimingJudgement,
  getComboMultiplier,
  calculateAccuracy,
  createInitialScoreState,
  applyHitToScoreState,
  applyMissToScoreState,
  getCurrentStarStage,
} from '../src/lib/game/scoring';

describe('Scoring & Judgement Engine', () => {
  describe('getTimingJudgement', () => {
    it('awards PERFECT for timing error within ±100ms', () => {
      expect(getTimingJudgement(0.000)).toBe('PERFECT');
      expect(getTimingJudgement(0.025)).toBe('PERFECT');
      expect(getTimingJudgement(-0.049)).toBe('PERFECT');
      expect(getTimingJudgement(0.050)).toBe('PERFECT');
      expect(getTimingJudgement(-0.050)).toBe('PERFECT');
      expect(getTimingJudgement(0.099)).toBe('PERFECT');
      expect(getTimingJudgement(-0.100)).toBe('PERFECT');
    });

    it('awards GREAT for timing error between 100ms and 220ms', () => {
      expect(getTimingJudgement(0.101)).toBe('GREAT');
      expect(getTimingJudgement(-0.150)).toBe('GREAT');
      expect(getTimingJudgement(0.220)).toBe('GREAT');
      expect(getTimingJudgement(-0.220)).toBe('GREAT');
    });

    it('awards GOOD for timing error between 220ms and 350ms', () => {
      expect(getTimingJudgement(0.221)).toBe('GOOD');
      expect(getTimingJudgement(-0.300)).toBe('GOOD');
      expect(getTimingJudgement(0.350)).toBe('GOOD');
      expect(getTimingJudgement(-0.350)).toBe('GOOD');
    });

    it('returns null for timing errors exceeding ±350ms', () => {
      expect(getTimingJudgement(0.351)).toBeNull();
      expect(getTimingJudgement(-0.400)).toBeNull();
      expect(getTimingJudgement(1.0)).toBeNull();
    });
  });

  describe('getComboMultiplier', () => {
    it('applies 1.0x multiplier for combo 1-9', () => {
      expect(getComboMultiplier(0)).toBe(1.0);
      expect(getComboMultiplier(1)).toBe(1.0);
      expect(getComboMultiplier(9)).toBe(1.0);
    });

    it('applies 1.2x multiplier for combo 10-24', () => {
      expect(getComboMultiplier(10)).toBe(1.2);
      expect(getComboMultiplier(24)).toBe(1.2);
    });

    it('applies 1.5x multiplier for combo 25-49', () => {
      expect(getComboMultiplier(25)).toBe(1.5);
      expect(getComboMultiplier(49)).toBe(1.5);
    });

    it('applies 2.0x multiplier for combo 50-99', () => {
      expect(getComboMultiplier(50)).toBe(2.0);
      expect(getComboMultiplier(99)).toBe(2.0);
    });

    it('applies 3.0x multiplier for combo 100+', () => {
      expect(getComboMultiplier(100)).toBe(3.0);
      expect(getComboMultiplier(250)).toBe(3.0);
    });
  });

  describe('calculateAccuracy', () => {
    it('returns 100% when no notes have been encountered', () => {
      expect(calculateAccuracy(0, 0, 0, 0)).toBe(100.0);
    });

    it('returns 100% for all PERFECT hits', () => {
      expect(calculateAccuracy(10, 0, 0, 10)).toBe(100.0);
    });

    it('correctly weighs GREAT (0.90) and GOOD (0.75)', () => {
      // 1 Perfect (1.0), 1 Great (0.9), 1 Good (0.75) out of 3 = 2.65 / 3 = 88.33%
      expect(calculateAccuracy(1, 1, 1, 3)).toBe(88.33);
    });

    it('penalizes missed notes (0 weight)', () => {
      // 2 Perfect (2.0) out of 4 (2 missed) = 2.0 / 4 = 50.0%
      expect(calculateAccuracy(2, 0, 0, 4)).toBe(50.0);
    });
  });

  describe('applyHitToScoreState and applyMissToScoreState', () => {
    it('accumulates score with combo multiplier and tracks max combo', () => {
      let state = createInitialScoreState();

      // First hit: Perfect -> 100 * 1.0 = 100
      state = applyHitToScoreState(state, 'PERFECT');
      expect(state.score).toBe(100);
      expect(state.combo).toBe(1);
      expect(state.maxCombo).toBe(1);

      // Hit until combo reaches 10
      for (let i = 2; i <= 9; i++) {
        state = applyHitToScoreState(state, 'PERFECT');
      }
      expect(state.combo).toBe(9);
      expect(state.score).toBe(900);

      // 10th hit: Perfect with 1.2x multiplier -> 100 * 1.2 = 120
      state = applyHitToScoreState(state, 'PERFECT');
      expect(state.combo).toBe(10);
      expect(state.score).toBe(1020);
      expect(state.maxCombo).toBe(10);
    });

    it('resets combo on miss while preserving maxCombo', () => {
      let state = createInitialScoreState();
      for (let i = 1; i <= 5; i++) {
        state = applyHitToScoreState(state, 'PERFECT');
      }
      expect(state.combo).toBe(5);
      expect(state.maxCombo).toBe(5);

      state = applyMissToScoreState(state);
      expect(state.combo).toBe(0);
      expect(state.maxCombo).toBe(5);
      expect(state.missCount).toBe(1);
    });
  });

  describe('3-Star Song Progression Stages', () => {
    it('correctly maps song time to stages 1, 2, and 3', () => {
      const duration = 120; // 2 minutes
      // Star 1: 0 - 39.6s (< 33%)
      expect(getCurrentStarStage(0, duration)).toBe(1);
      expect(getCurrentStarStage(30, duration)).toBe(1);

      // Star 2: 39.6s - 79.2s (33% - 66%)
      expect(getCurrentStarStage(40, duration)).toBe(2);
      expect(getCurrentStarStage(60, duration)).toBe(2);

      // Star 3: 79.2s - 120s (>= 66%)
      expect(getCurrentStarStage(80, duration)).toBe(3);
      expect(getCurrentStarStage(120, duration)).toBe(3);
    });
  });
});
