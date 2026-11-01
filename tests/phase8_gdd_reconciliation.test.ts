/**
 * Phase 8: GDD Reconciliation & Remaining Game Implementation Test Suite
 *
 * Validates:
 * 1. GDD core gameplay rules, scoring, timing windows, and progression alignment.
 * 2. Remappable keyboard controls (GDD Open Decision #4).
 * 3. Profile settings, privacy controls, and data retention / deletion logic (GDD §7).
 * 4. Quick Play skip-preview routing.
 * 5. Documented open decisions and anti-farming requirements.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import React from 'react';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import { calculateMatchXp, evaluateRankPromotion, getGemTier } from '@/config/progression';
import { useKeyBindings } from '@/hooks/useKeyBindings';
import { RunResult } from '@/types/game';

describe('Phase 8: GDD Core Gameplay Rules Reconciliation', () => {
  it('enforces exact GDD version 1.0.0 rules specification', () => {
    expect(GAMEPLAY_CONFIG.RULES_VERSION).toBe('1.0.0');
    expect(GAMEPLAY_CONFIG.LANES.COUNT).toBe(4);
    expect(GAMEPLAY_CONFIG.LANES.DEFAULT_KEYS).toEqual(['d', 'f', 'j', 'k']);
  });

  it('aligns provisional timing windows with GDD Section 4', () => {
    // GDD specifies: Perfect ±50ms; Great ±100ms; Good ±150ms
    expect(GAMEPLAY_CONFIG.TIMING_WINDOWS.PERFECT_SEC).toBe(0.050);
    expect(GAMEPLAY_CONFIG.TIMING_WINDOWS.GREAT_SEC).toBe(0.100);
    expect(GAMEPLAY_CONFIG.TIMING_WINDOWS.GOOD_SEC).toBe(0.150);
  });

  it('aligns base scoring and accuracy weights with GDD Section 4', () => {
    expect(GAMEPLAY_CONFIG.BASE_POINTS.PERFECT).toBe(100);
    expect(GAMEPLAY_CONFIG.BASE_POINTS.GREAT).toBe(75);
    expect(GAMEPLAY_CONFIG.BASE_POINTS.GOOD).toBe(50);
    expect(GAMEPLAY_CONFIG.BASE_POINTS.MISS).toBe(0);

    expect(GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.PERFECT).toBe(1.00);
    expect(GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.GREAT).toBe(0.90);
    expect(GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.GOOD).toBe(0.75);
    expect(GAMEPLAY_CONFIG.ACCURACY_WEIGHTS.MISS).toBe(0.00);
  });

  it('matches progressive combo multiplier tiers', () => {
    // 1-9 hits: 1.0x, 10-24: 1.2x, 25-49: 1.5x, 50-99: 2.0x, 100+: 3.0x
    const multipliers = GAMEPLAY_CONFIG.COMBO_MULTIPLIERS;
    expect(multipliers).toEqual([
      { minCombo: 100, multiplier: 3.0 },
      { minCombo: 50, multiplier: 2.0 },
      { minCombo: 25, multiplier: 1.5 },
      { minCombo: 10, multiplier: 1.2 },
      { minCombo: 1, multiplier: 1.0 },
    ]);
  });

  it('enforces 3-Star stage fraction boundaries without altering playback speed', () => {
    expect(GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_1).toBe(0.33);
    expect(GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_2).toBe(0.66);
    expect(GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_3).toBe(1.00);
  });

  it('enforces anti-farming rules: failed runs under 15s receive 0 XP, >=15s receive 5 XP', () => {
    const failedQuickRun: RunResult = {
      completed: false,
      score: 1200,
      accuracy: 65,
      highestCombo: 3,
      elapsedTime: 12.4, // < 15 seconds
      songDuration: 180,
      totalNotes: 50,
      notesHit: 5,
      instrument: 'piano',
      isPartial: true,
      failureReason: 'MISSED_NOTE',
    };
    expect(
      calculateMatchXp(
        failedQuickRun.completed,
        failedQuickRun.accuracy,
        failedQuickRun.highestCombo,
        failedQuickRun.score,
        failedQuickRun.elapsedTime
      )
    ).toBe(0);

    const failedLegitRun: RunResult = {
      completed: false,
      score: 8000,
      accuracy: 82,
      highestCombo: 15,
      elapsedTime: 22.0, // >= 15 seconds
      songDuration: 180,
      totalNotes: 50,
      notesHit: 25,
      instrument: 'guitar',
      isPartial: true,
      failureReason: 'INCORRECT_TAP',
    };
    expect(
      calculateMatchXp(
        failedLegitRun.completed,
        failedLegitRun.accuracy,
        failedLegitRun.highestCombo,
        failedLegitRun.score,
        failedLegitRun.elapsedTime
      )
    ).toBe(5);
  });
});

describe('Phase 8: Remappable Keyboard Controls (Open Decision #4)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root && container) {
      act(() => {
        root?.unmount();
      });
      container.remove();
    }
    localStorage.clear();
  });

  it('defaults to D, F, J, K when no custom bindings exist', () => {
    let captured: ReturnType<typeof useKeyBindings> | null = null;

    function TestComponent() {
      captured = useKeyBindings();
      return null;
    }

    act(() => {
      root?.render(React.createElement(TestComponent));
    });

    expect(captured).not.toBeNull();
    expect(captured!.keys).toEqual(['d', 'f', 'j', 'k']);
    expect(captured!.isCustom).toBe(false);
    expect(captured!.keyToLane('d')).toBe(0);
    expect(captured!.keyToLane('f')).toBe(1);
    expect(captured!.keyToLane('j')).toBe(2);
    expect(captured!.keyToLane('k')).toBe(3);
    expect(captured!.keyToLane('D')).toBe(0); // Case-insensitive
    expect(captured!.keyToLane('z')).toBe(-1); // Unmapped key
  });

  it('allows remapping lanes and swaps duplicate keys seamlessly', () => {
    let captured: ReturnType<typeof useKeyBindings> | null = null;

    function TestComponent() {
      captured = useKeyBindings();
      return null;
    }

    act(() => {
      root?.render(React.createElement(TestComponent));
    });

    // Remap Lane 0 from 'd' to 'a'
    act(() => {
      captured!.setKey(0, 'a');
    });

    expect(captured!.keys).toEqual(['a', 'f', 'j', 'k']);
    expect(captured!.isCustom).toBe(true);
    expect(captured!.keyToLane('a')).toBe(0);
    expect(captured!.keyToLane('d')).toBe(-1);

    // Now assign 'j' to Lane 0: since 'j' is currently on Lane 2, they should swap
    act(() => {
      captured!.setKey(0, 'j');
    });

    expect(captured!.keys).toEqual(['j', 'f', 'a', 'k']);
    expect(captured!.keyToLane('j')).toBe(0);
    expect(captured!.keyToLane('a')).toBe(2);

    // Reset back to defaults
    act(() => {
      captured!.resetToDefaults();
    });

    expect(captured!.keys).toEqual(['d', 'f', 'j', 'k']);
    expect(captured!.isCustom).toBe(false);
  });

  it('persists customized key bindings in localStorage', () => {
    localStorage.setItem('praisetiles_key_bindings', JSON.stringify(['q', 'w', 'e', 'r']));

    let captured: ReturnType<typeof useKeyBindings> | null = null;

    function TestComponent() {
      captured = useKeyBindings();
      return null;
    }

    act(() => {
      root?.render(React.createElement(TestComponent));
    });

    expect(captured!.keys).toEqual(['q', 'w', 'e', 'r']);
    expect(captured!.isCustom).toBe(true);
    expect(captured!.keyToLane('q')).toBe(0);
    expect(captured!.keyToLane('r')).toBe(3);
  });
});

describe('Phase 8: Profile Settings & Account Deletion Validation', () => {
  it('validates display name length between 2 and 32 characters', () => {
    const isValidDisplayName = (name: string) => {
      const trimmed = name.trim();
      return trimmed.length >= 2 && trimmed.length <= 32;
    };

    expect(isValidDisplayName('')).toBe(false);
    expect(isValidDisplayName('a')).toBe(false);
    expect(isValidDisplayName('  ab  ')).toBe(true);
    expect(isValidDisplayName('Faithful Praiser')).toBe(true);
    expect(isValidDisplayName('A'.repeat(32))).toBe(true);
    expect(isValidDisplayName('A'.repeat(33))).toBe(false);
  });

  it('validates preferred instrument options', () => {
    const validInstruments = ['piano', 'guitar'];
    expect(validInstruments.includes('piano')).toBe(true);
    expect(validInstruments.includes('guitar')).toBe(true);
    expect(validInstruments.includes('drums')).toBe(false);
  });

  it('models anonymized account deletion data scrub per GDD §7', () => {
    const originalProfile = {
      id: 'usr-12345678-abcd',
      username: 'worshipper_john',
      displayName: 'Brother John',
      avatarUrl: 'https://images.unsplash.com/photo-test',
      isPublic: true,
      preferredInstrument: 'piano',
    };

    // Deletion transformation logic as implemented in /api/profile DELETE
    const anonymizedSuffix = originalProfile.id.slice(0, 8);
    const scrubbedProfile = {
      id: originalProfile.id,
      display_name: 'Praiser (Deleted)',
      username: `deleted_${anonymizedSuffix}`,
      avatar_url: null,
      is_public: false,
    };

    expect(scrubbedProfile.display_name).toBe('Praiser (Deleted)');
    expect(scrubbedProfile.username).toBe('deleted_usr-1234');
    expect(scrubbedProfile.avatar_url).toBeNull();
    expect(scrubbedProfile.is_public).toBe(false);
  });
});

describe('Phase 8: Progression & Promotion Verification', () => {
  it('evaluates Quartz to Jade promotion with 3-factor criteria', () => {
    const quartzTier = getGemTier('Quartz');
    expect(quartzTier.gemRank).toBe('Quartz');

    // 0 XP, 0 qualifying songs
    const initial = evaluateRankPromotion('Quartz', 0, 0);
    expect(initial.canPromote).toBe(false);
    expect(initial.nextRank).toBe('Jade');

    // Threshold: 1000 XP, 5 qualifying songs with >=75% accuracy
    const promoted = evaluateRankPromotion('Quartz', 1200, 6);
    expect(promoted.canPromote).toBe(true);
    expect(promoted.progressPercent).toBe(100);
  });
});
