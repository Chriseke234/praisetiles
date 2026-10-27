import { describe, it, expect } from 'vitest';
import {
  calculateMatchXp,
  calculateLevelFromXp,
  isSongQualifyingForNextRank,
  evaluateRankPromotion,
  getGemTier,
} from '../src/config/progression';

describe('Player Progression & Promotion Rules', () => {
  describe('calculateMatchXp', () => {
    it('awards full completion XP scaled with accuracy, combo, and score', () => {
      // Completed, 100% accuracy, 50 combo, 50,000 score
      // 100 * 1.0 + 50 * 0.5 + 50000 / 1000 = 100 + 25 + 50 = 175 XP
      const xp = calculateMatchXp(true, 100.0, 50, 50000, 45);
      expect(xp).toBe(175);
    });

    it('awards 0 XP for failed runs under 15 seconds to prevent spam/farming', () => {
      const xp = calculateMatchXp(false, 95.0, 20, 20000, 10);
      expect(xp).toBe(0);
    });

    it('awards participation 5 XP for failed runs of 15 seconds or more', () => {
      const xp = calculateMatchXp(false, 70.0, 15, 15000, 25);
      expect(xp).toBe(5);
    });
  });

  describe('calculateLevelFromXp', () => {
    it('calculates player levels according to square root progression curve', () => {
      expect(calculateLevelFromXp(0)).toBe(1);
      expect(calculateLevelFromXp(50)).toBe(1);
      expect(calculateLevelFromXp(100)).toBe(2);
      expect(calculateLevelFromXp(399)).toBe(2);
      expect(calculateLevelFromXp(400)).toBe(3);
      expect(calculateLevelFromXp(900)).toBe(4);
      expect(calculateLevelFromXp(2500)).toBe(6);
    });
  });

  describe('isSongQualifyingForNextRank', () => {
    it('rejects failed runs even if accuracy was high prior to failure', () => {
      // Failed run cannot be a qualifying song
      expect(isSongQualifyingForNextRank('Quartz', false, 95.0)).toBe(false);
      expect(isSongQualifyingForNextRank('Jade', false, 100.0)).toBe(false);
    });

    it('enforces rank-specific accuracy requirements for completed songs', () => {
      // Quartz -> Jade requires 80% accuracy
      expect(isSongQualifyingForNextRank('Quartz', true, 79.9)).toBe(false);
      expect(isSongQualifyingForNextRank('Quartz', true, 80.0)).toBe(true);

      // Jade -> Sapphire requires 85% accuracy
      expect(isSongQualifyingForNextRank('Jade', true, 84.9)).toBe(false);
      expect(isSongQualifyingForNextRank('Jade', true, 85.0)).toBe(true);

      // Sapphire -> Ruby requires 90% accuracy
      expect(isSongQualifyingForNextRank('Sapphire', true, 89.9)).toBe(false);
      expect(isSongQualifyingForNextRank('Sapphire', true, 90.0)).toBe(true);

      // Ruby -> Diamond requires 95% accuracy
      expect(isSongQualifyingForNextRank('Ruby', true, 94.9)).toBe(false);
      expect(isSongQualifyingForNextRank('Ruby', true, 95.0)).toBe(true);
    });

    it('returns false when already at Diamond rank', () => {
      expect(isSongQualifyingForNextRank('Diamond', true, 100.0)).toBe(false);
    });
  });

  describe('evaluateRankPromotion', () => {
    it('STRICT RULE: XP alone CANNOT unlock a promotion without qualifying songs', () => {
      // Quartz with 10,000 XP but 0 qualifying songs cannot promote to Jade
      const evaluation = evaluateRankPromotion('Quartz', 10000, 0);
      expect(evaluation.canPromote).toBe(false);
      expect(evaluation.nextRank).toBe('Jade');
    });

    it('STRICT RULE: Qualifying songs alone cannot unlock promotion without required XP', () => {
      // Quartz with 10 qualifying songs but only 150 XP (< 300 required) cannot promote
      const evaluation = evaluateRankPromotion('Quartz', 150, 10);
      expect(evaluation.canPromote).toBe(false);
    });

    it('allows promotion when both XP and qualifying song count requirements are met', () => {
      // Quartz -> Jade: 300 XP, 3 qualifying songs
      const readyEval = evaluateRankPromotion('Quartz', 300, 3);
      expect(readyEval.canPromote).toBe(true);
      expect(readyEval.nextRank).toBe('Jade');

      // Jade -> Sapphire: 700 XP, 5 qualifying songs
      expect(evaluateRankPromotion('Jade', 699, 5).canPromote).toBe(false);
      expect(evaluateRankPromotion('Jade', 700, 4).canPromote).toBe(false);
      expect(evaluateRankPromotion('Jade', 700, 5).canPromote).toBe(true);
    });

    it('handles Diamond as maximum rank cap', () => {
      const diamondEval = evaluateRankPromotion('Diamond', 5000, 20);
      expect(diamondEval.canPromote).toBe(false);
      expect(diamondEval.nextRank).toBeNull();
      expect(diamondEval.progressPercent).toBe(100);
    });
  });

  describe('getGemTier', () => {
    it('returns correct titles for each gem tier', () => {
      expect(getGemTier('Quartz').title).toBe('Pulse Starter');
      expect(getGemTier('Jade').title).toBe('Rhythm Keeper');
      expect(getGemTier('Sapphire').title).toBe('Groove Master');
      expect(getGemTier('Ruby').title).toBe('Virtuoso');
      expect(getGemTier('Diamond').title).toBe('Legend');
    });
  });
});
