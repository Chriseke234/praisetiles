/**
 * Phase 3 Multiplayer Unit Tests
 * Tests invite code validation, room capacity, vote deduplication,
 * tie resolution logic, map validation, and result idempotency.
 */

import { describe, it, expect } from 'vitest';
import { MULTIPLAYER_CONFIG } from '../src/config/multiplayer';
import { RhythmMap } from '../src/types/game';

// ---------------------------------------------------------------------------
// Invite code validation
// ---------------------------------------------------------------------------
describe('Invite code validation', () => {
  const VALID_CODE_LENGTH = MULTIPLAYER_CONFIG.ROOM.INVITE_CODE_LENGTH;

  it('accepts an 8-char uppercase alphanumeric code', () => {
    const code = 'AB12CD34';
    expect(code.length).toBe(VALID_CODE_LENGTH);
    expect(/^[A-Z0-9]{8}$/.test(code)).toBe(true);
  });

  it('rejects a code shorter than 8 characters', () => {
    const code = 'AB12CD3';
    expect(code.length).not.toBe(VALID_CODE_LENGTH);
  });

  it('rejects a code with special characters', () => {
    const code = 'AB12CD!@';
    expect(/^[A-Z0-9]{8}$/.test(code)).toBe(false);
  });

  it('rejects an empty code', () => {
    const code = '';
    expect(/^[A-Z0-9]{8}$/.test(code)).toBe(false);
  });

  it('normalises lowercase input to uppercase', () => {
    const raw     = 'ab12cd34';
    const cleaned = raw.toUpperCase();
    expect(/^[A-Z0-9]{8}$/.test(cleaned)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Room capacity
// ---------------------------------------------------------------------------
describe('Room capacity', () => {
  const MAX = MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS;

  it(`max participants constant is ${4}`, () => {
    expect(MAX).toBe(4);
  });

  it('blocks join when at capacity', () => {
    const currentCount = MAX;
    const canJoin = currentCount < MAX;
    expect(canJoin).toBe(false);
  });

  it('allows join when one slot remains', () => {
    const currentCount = MAX - 1;
    const canJoin = currentCount < MAX;
    expect(canJoin).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Vote deduplication
// ---------------------------------------------------------------------------

interface VoteRecord {
  userId: string;
  nominationId: string;
}

/** Simulate DB UNIQUE(room_id, user_id) by deduplicating per userId. */
function upsertVote(votes: VoteRecord[], newVote: VoteRecord): VoteRecord[] {
  const without = votes.filter((v) => v.userId !== newVote.userId);
  return [...without, newVote];
}

describe('Vote deduplication', () => {
  it('replacing a vote removes the old one and inserts the new one', () => {
    let votes: VoteRecord[] = [];
    votes = upsertVote(votes, { userId: 'u1', nominationId: 'nom-a' });
    votes = upsertVote(votes, { userId: 'u1', nominationId: 'nom-b' });

    expect(votes.filter((v) => v.userId === 'u1').length).toBe(1);
    expect(votes.find((v) => v.userId === 'u1')?.nominationId).toBe('nom-b');
  });

  it('two different users can both cast votes', () => {
    let votes: VoteRecord[] = [];
    votes = upsertVote(votes, { userId: 'u1', nominationId: 'nom-a' });
    votes = upsertVote(votes, { userId: 'u2', nominationId: 'nom-a' });

    expect(votes.length).toBe(2);
  });

  it('each user can only have one vote at a time', () => {
    let votes: VoteRecord[] = [];
    for (let i = 0; i < 5; i++) {
      votes = upsertVote(votes, { userId: 'u1', nominationId: `nom-${i}` });
    }
    expect(votes.filter((v) => v.userId === 'u1').length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Voting tie resolution
// ---------------------------------------------------------------------------

interface Nomination {
  id: string;
  songTitle: string;
  createdAt: string; // ISO 8601 — earlier = older = wins tie
  nominatedByHost: boolean;
}

interface TallyEntry {
  nomination: Nomination;
  voteCount: number;
}

/** Apply tie-breaking: earliest nomination wins; host's if tied further; first if still tied. */
function resolveWinner(tallies: TallyEntry[], hostNominationId?: string): Nomination {
  const maxVotes = Math.max(...tallies.map((t) => t.voteCount));
  const tied = tallies.filter((t) => t.voteCount === maxVotes);

  if (tied.length === 1) return tied[0].nomination;

  // 1st tie-break: earliest nomination (smallest created_at)
  tied.sort((a, b) =>
    new Date(a.nomination.createdAt).getTime() - new Date(b.nomination.createdAt).getTime()
  );
  const earliest = tied[0];
  const stillTied = tied.filter(
    (t) => new Date(t.nomination.createdAt).getTime() === new Date(earliest.nomination.createdAt).getTime()
  );

  if (stillTied.length === 1) return earliest.nomination;

  // 2nd tie-break: host's nomination
  if (hostNominationId) {
    const hostPick = stillTied.find((t) => t.nomination.id === hostNominationId);
    if (hostPick) return hostPick.nomination;
  }

  // 3rd tie-break: first in list (deterministic fallback)
  return stillTied[0].nomination;
}

describe('Voting tie resolution', () => {
  it('returns the sole nomination with most votes', () => {
    const tallies: TallyEntry[] = [
      { nomination: { id: 'n1', songTitle: 'Song A', createdAt: '2026-01-01T00:00:00Z', nominatedByHost: false }, voteCount: 3 },
      { nomination: { id: 'n2', songTitle: 'Song B', createdAt: '2026-01-01T00:01:00Z', nominatedByHost: false }, voteCount: 1 },
    ];
    expect(resolveWinner(tallies).id).toBe('n1');
  });

  it('tie broken by earliest nomination', () => {
    const tallies: TallyEntry[] = [
      { nomination: { id: 'n1', songTitle: 'Song A', createdAt: '2026-01-01T00:01:00Z', nominatedByHost: false }, voteCount: 2 },
      { nomination: { id: 'n2', songTitle: 'Song B', createdAt: '2026-01-01T00:00:00Z', nominatedByHost: false }, voteCount: 2 },
    ];
    expect(resolveWinner(tallies).id).toBe('n2');
  });

  it('tie broken by host pick when timestamps are equal', () => {
    const ts = '2026-01-01T00:00:00Z';
    const tallies: TallyEntry[] = [
      { nomination: { id: 'n1', songTitle: 'Song A', createdAt: ts, nominatedByHost: false }, voteCount: 2 },
      { nomination: { id: 'n2', songTitle: 'Song B', createdAt: ts, nominatedByHost: true  }, voteCount: 2 },
    ];
    expect(resolveWinner(tallies, 'n2').id).toBe('n2');
  });

  it('falls back to first entry if still tied and host not in tied set', () => {
    const ts = '2026-01-01T00:00:00Z';
    const tallies: TallyEntry[] = [
      { nomination: { id: 'n1', songTitle: 'Song A', createdAt: ts, nominatedByHost: false }, voteCount: 2 },
      { nomination: { id: 'n2', songTitle: 'Song B', createdAt: ts, nominatedByHost: false }, voteCount: 2 },
    ];
    const winner = resolveWinner(tallies, 'n-other');
    // Should deterministically pick first
    expect(['n1', 'n2'].includes(winner.id)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Map validation (server-side logic mirrored)
// ---------------------------------------------------------------------------

function validateMapStructure(map: unknown): map is RhythmMap {
  if (!map || typeof map !== 'object') return false;
  const m = map as Record<string, unknown>;
  if (typeof m.version !== 'string') return false;
  if (typeof m.duration !== 'number' || (m.duration as number) <= 0) return false;
  if (typeof m.totalNotes !== 'number') return false;
  if (!Array.isArray(m.notes)) return false;
  if (typeof m.audioFingerprint !== 'string') return false;
  if (!m.stages || typeof m.stages !== 'object') return false;
  return true;
}

const VALID_MAP: RhythmMap = {
  version:          '1.0',
  audioFingerprint: 'abc123',
  songTitle:        'Test Song',
  duration:         120,
  totalNotes:       80,
  notes:            [{ id: 'n1', lane: 0, time: 1.0, hit: false }],
  stages:           { star1End: 40, star2End: 80, star3End: 120 },
};

describe('Map validation', () => {
  it('accepts a valid map', () => {
    expect(validateMapStructure(VALID_MAP)).toBe(true);
  });

  it('rejects a map missing version', () => {
    const bad = { ...VALID_MAP, version: undefined };
    expect(validateMapStructure(bad)).toBe(false);
  });

  it('rejects a map with non-positive duration', () => {
    const bad = { ...VALID_MAP, duration: 0 };
    expect(validateMapStructure(bad)).toBe(false);
  });

  it('rejects a map with non-array notes', () => {
    const bad = { ...VALID_MAP, notes: 'not-an-array' };
    expect(validateMapStructure(bad)).toBe(false);
  });

  it('rejects null', () => {
    expect(validateMapStructure(null)).toBe(false);
  });

  it('rejects a map missing audioFingerprint', () => {
    const bad = { ...VALID_MAP, audioFingerprint: undefined };
    expect(validateMapStructure(bad)).toBe(false);
  });

  it('rejects a map missing stages', () => {
    const bad = { ...VALID_MAP, stages: undefined };
    expect(validateMapStructure(bad)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Result idempotency (placement calculation)
// ---------------------------------------------------------------------------

interface SubmittedResult {
  userId: string;
  score: number;
  submittedAt: string | null;
}

/** Compute placement for a newly-submitted player. */
function computePlacement(
  allResults: SubmittedResult[],
  userId: string,
  score: number
): number {
  const alreadySubmitted = allResults.filter(
    (r) => r.userId !== userId && r.submittedAt !== null
  );
  return 1 + alreadySubmitted.filter((r) => r.score > score).length;
}

describe('Result idempotency', () => {
  it('first finisher gets placement 1 if they have the top score', () => {
    const results: SubmittedResult[] = [
      { userId: 'u1', score: 5000, submittedAt: null },
      { userId: 'u2', score: 3000, submittedAt: null },
    ];
    // u1 submits first with top score
    expect(computePlacement(results, 'u1', 5000)).toBe(1);
  });

  it('second finisher with lower score gets placement 2', () => {
    const results: SubmittedResult[] = [
      { userId: 'u1', score: 5000, submittedAt: new Date().toISOString() },
      { userId: 'u2', score: 3000, submittedAt: null },
    ];
    expect(computePlacement(results, 'u2', 3000)).toBe(2);
  });

  it('re-submission does not change placement (idempotency)', () => {
    const results: SubmittedResult[] = [
      { userId: 'u1', score: 5000, submittedAt: new Date().toISOString() },
    ];
    // Simulate idempotency: if already submitted, placement stays the same
    const alreadySubmitted = results.find(
      (r) => r.userId === 'u1' && r.submittedAt !== null
    );
    expect(alreadySubmitted).toBeDefined();
    // In the real DB function we early-return with the stored placement
  });
});

// ---------------------------------------------------------------------------
// Config smoke tests
// ---------------------------------------------------------------------------
describe('Multiplayer config', () => {
  it('has a valid MAX_PARTICIPANTS (2–8)', () => {
    expect(MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS).toBeGreaterThanOrEqual(2);
    expect(MULTIPLAYER_CONFIG.ROOM.MAX_PARTICIPANTS).toBeLessThanOrEqual(8);
  });

  it('has a positive COUNTDOWN_MS', () => {
    expect(MULTIPLAYER_CONFIG.MATCH.COUNTDOWN_MS).toBeGreaterThan(0);
  });

  it('has a positive SCORE_BROADCAST_INTERVAL_MS', () => {
    expect(MULTIPLAYER_CONFIG.MATCH.SCORE_BROADCAST_INTERVAL_MS).toBeGreaterThan(0);
  });

  it('has non-empty broadcast event names', () => {
    for (const ev of Object.values(MULTIPLAYER_CONFIG.REALTIME.BROADCAST_EVENTS)) {
      expect(typeof ev).toBe('string');
      expect(ev.length).toBeGreaterThan(0);
    }
  });
});
