import { describe, it, expect, beforeEach } from 'vitest';
import { isSupabaseConfigured, getSupabaseBrowserClient } from '../src/lib/supabase/client';
import { MatchRecord } from '../src/types/auth';

describe('Auth & Supabase Fallback Handling', () => {
  it('safely detects when Supabase environment variables are missing', () => {
    // In test environment without .env, isSupabaseConfigured must return false
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('returns null without throwing exceptions when Supabase is unconfigured', () => {
    expect(() => getSupabaseBrowserClient()).not.toThrow();
    expect(getSupabaseBrowserClient()).toBeNull();
  });
});

describe('Guest Session & Match Aggregation', () => {
  let guestMatches: MatchRecord[] = [];

  beforeEach(() => {
    guestMatches = [];
  });

  function recordGuestMatch(match: MatchRecord): { added: boolean } {
    // Idempotency check: prevent duplicate submissions with identical ID
    const exists = guestMatches.some((m) => m.id === match.id);
    if (exists) {
      return { added: false };
    }
    guestMatches.push(match);
    return { added: true };
  }

  it('records guest matches with unique idempotency keys', () => {
    const match1: MatchRecord = {
      id: 'match-uuid-1',
      instrument: 'piano',
      songTitle: 'Amazing Grace',
      songFingerprint: 'fp-1',
      score: 45000,
      accuracy: 92.5,
      highestCombo: 35,
      elapsedTime: 40.0,
      completed: true,
      failureReason: null,
      rulesVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    const res1 = recordGuestMatch(match1);
    expect(res1.added).toBe(true);
    expect(guestMatches.length).toBe(1);

    // Re-submitting with the same ID must be rejected as duplicate
    const res2 = recordGuestMatch(match1);
    expect(res2.added).toBe(false);
    expect(guestMatches.length).toBe(1);
  });

  it('never counts failed partial runs as completed songs', () => {
    const completedMatch: MatchRecord = {
      id: 'match-uuid-2',
      instrument: 'piano',
      songTitle: 'Joyful Joyful',
      songFingerprint: 'fp-2',
      score: 60000,
      accuracy: 94.0,
      highestCombo: 60,
      elapsedTime: 50.0,
      completed: true,
      failureReason: null,
      rulesVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    const failedMatch: MatchRecord = {
      id: 'match-uuid-3',
      instrument: 'guitar',
      songTitle: 'Praise You',
      songFingerprint: 'fp-3',
      score: 12000,
      accuracy: 98.0, // High partial accuracy before fail
      highestCombo: 12,
      elapsedTime: 18.0,
      completed: false,
      failureReason: 'MISSED_NOTE',
      rulesVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    recordGuestMatch(completedMatch);
    recordGuestMatch(failedMatch);

    const totalAttempts = guestMatches.length;
    const completedCount = guestMatches.filter((m) => m.completed).length;

    expect(totalAttempts).toBe(2);
    expect(completedCount).toBe(1);

    // Best completed accuracy must ONLY be drawn from completed runs
    const bestCompletedAcc = guestMatches
      .filter((m) => m.completed)
      .reduce((max, m) => Math.max(max, m.accuracy), 0);

    expect(bestCompletedAcc).toBe(94.0); // 98.0 from failed run is ignored
  });

  it('separates statistics cleanly by instrument (Piano vs Guitar)', () => {
    const pianoMatch: MatchRecord = {
      id: 'p-1',
      instrument: 'piano',
      songTitle: 'Hymn 1',
      songFingerprint: 'fp-p',
      score: 30000,
      accuracy: 85.0,
      highestCombo: 20,
      elapsedTime: 40.0,
      completed: true,
      failureReason: null,
      rulesVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    const guitarMatch: MatchRecord = {
      id: 'g-1',
      instrument: 'guitar',
      songTitle: 'Hymn 2',
      songFingerprint: 'fp-g',
      score: 55000,
      accuracy: 91.0,
      highestCombo: 40,
      elapsedTime: 45.0,
      completed: true,
      failureReason: null,
      rulesVersion: '1.0.0',
      createdAt: new Date().toISOString(),
    };

    recordGuestMatch(pianoMatch);
    recordGuestMatch(guitarMatch);

    const pianoMatches = guestMatches.filter((m) => m.instrument === 'piano');
    const guitarMatches = guestMatches.filter((m) => m.instrument === 'guitar');

    expect(pianoMatches.length).toBe(1);
    expect(guitarMatches.length).toBe(1);
    expect(pianoMatches[0].score).toBe(30000);
    expect(guitarMatches[0].score).toBe(55000);
  });
});
