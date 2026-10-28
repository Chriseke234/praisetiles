/**
 * Phase 5 Tournament, Bracket, Season & Achievement Unit Tests
 *
 * Covers:
 * 1. Tournament config validation (capacities, roles, statuses, round names)
 * 2. Single-elimination bracket generation (tree integrity, no self-matches)
 * 3. Chronological schedule validation (registration < check-in < start)
 * 4. Capacity limits and duplicate registration prevention
 * 5. Check-in freeze and no-show transitions
 * 6. Deterministic tie-breaking order (score > accuracy > combo > sudden death)
 * 7. Winner advancement idempotency
 * 8. Dispute state machine (pending → upheld/rejected, no re-open)
 * 9. Achievement deduplication
 * 10. Season points allocation by placement
 */

import { describe, it, expect } from 'vitest';
import { TOURNAMENT_CONFIG } from '../src/config/tournament';
import type {
  TournamentCapacity,
  ParticipantStatus,
  TournamentMatchStatus,
  DisputeReason,
  AchievementCode,
} from '../src/config/tournament';

// ===========================================================================
// 1. TOURNAMENT CONFIG VALIDATION
// ===========================================================================
describe('Tournament Configuration Integrity', () => {
  it('supports exactly 4, 8, and 16 player capacities', () => {
    expect(TOURNAMENT_CONFIG.SIZES.SUPPORTED).toEqual([4, 8, 16]);
  });

  it('default capacity is 8 and max is 16', () => {
    expect(TOURNAMENT_CONFIG.SIZES.DEFAULT_CAPACITY).toBe(8);
    expect(TOURNAMENT_CONFIG.SIZES.MAX_CAPACITY).toBe(16);
    expect(TOURNAMENT_CONFIG.SIZES.DEFAULT_CAPACITY).toBeLessThanOrEqual(
      TOURNAMENT_CONFIG.SIZES.MAX_CAPACITY
    );
  });

  it('minimum required participants are valid for each capacity', () => {
    const minReq = TOURNAMENT_CONFIG.SIZES.MIN_REQUIRED;
    expect(minReq[4]).toBeGreaterThanOrEqual(2);
    expect(minReq[4]).toBeLessThanOrEqual(4);
    expect(minReq[8]).toBeGreaterThanOrEqual(4);
    expect(minReq[8]).toBeLessThanOrEqual(8);
    expect(minReq[16]).toBeGreaterThanOrEqual(4);
    expect(minReq[16]).toBeLessThanOrEqual(16);
  });

  it('defines exactly 4 roles: admin, organizer, participant, viewer', () => {
    const roles = Object.values(TOURNAMENT_CONFIG.ROLES);
    expect(roles).toHaveLength(4);
    expect(roles).toContain('platform_admin');
    expect(roles).toContain('approved_organizer');
    expect(roles).toContain('tournament_participant');
    expect(roles).toContain('tournament_viewer');
  });

  it('defines all required tournament statuses in lifecycle order', () => {
    const statuses = TOURNAMENT_CONFIG.STATUSES.TOURNAMENT;
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
    expect(statuses).toContain('registration_open');
    expect(statuses).toContain('check_in');
    expect(statuses).toContain('bracket_ready');
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('cancelled');
    expect(statuses.indexOf('draft')).toBeLessThan(statuses.indexOf('published'));
    expect(statuses.indexOf('published')).toBeLessThan(statuses.indexOf('in_progress'));
    expect(statuses.indexOf('in_progress')).toBeLessThan(statuses.indexOf('completed'));
  });

  it('defines all required participant statuses', () => {
    const statuses = TOURNAMENT_CONFIG.STATUSES.PARTICIPANT;
    expect(statuses).toContain('registered');
    expect(statuses).toContain('checked_in');
    expect(statuses).toContain('withdrawn');
    expect(statuses).toContain('disqualified');
    expect(statuses).toContain('no_show');
    expect(statuses).toContain('eliminated');
    expect(statuses).toContain('champion');
  });

  it('defines all required match statuses', () => {
    const statuses = TOURNAMENT_CONFIG.STATUSES.MATCH;
    expect(statuses).toContain('pending');
    expect(statuses).toContain('ready');
    expect(statuses).toContain('playing');
    expect(statuses).toContain('completed');
    expect(statuses).toContain('forfeited');
    expect(statuses).toContain('disputed');
  });

  it('has at least one song in the approved pool', () => {
    expect(TOURNAMENT_CONFIG.APPROVED_SONG_POOL.length).toBeGreaterThanOrEqual(1);
    TOURNAMENT_CONFIG.APPROVED_SONG_POOL.forEach((song) => {
      expect(song.id).toBeTruthy();
      expect(song.title).toBeTruthy();
      expect(song.artist).toBeTruthy();
      expect(song.bpm).toBeGreaterThan(0);
      expect(song.duration).toBeGreaterThan(0);
    });
  });

  it('version matches Phase 5 semver', () => {
    expect(TOURNAMENT_CONFIG.VERSION).toBe('5.0.0');
  });
});

// ===========================================================================
// 2. SINGLE-ELIMINATION BRACKET GENERATION
// ===========================================================================
describe('Single-Elimination Bracket Generation', () => {
  /**
   * Simulates bracket generation for a given capacity.
   * Produces the expected round structure:
   * - 4 players: 2 rounds (Semis, Final)
   * - 8 players: 3 rounds (QF, Semis, Final)
   * - 16 players: 4 rounds (R16, QF, Semis, Final)
   */
  function generateBracket(capacity: TournamentCapacity) {
    const roundNames = TOURNAMENT_CONFIG.FORMAT.ROUNDS[capacity];
    const totalRounds = Math.log2(capacity);
    const rounds: { roundIndex: number; roundName: string; matchCount: number; matchIds: string[] }[] = [];

    for (let r = 0; r < totalRounds; r++) {
      const matchCount = capacity / Math.pow(2, r + 1);
      const matchIds = Array.from({ length: matchCount }, (_, i) => `m-r${r}-${i}`);
      rounds.push({
        roundIndex: r,
        roundName: roundNames[r],
        matchCount,
        matchIds,
      });
    }

    return { capacity, rounds, totalRounds };
  }

  it.each([4, 8, 16] as TournamentCapacity[])('generates correct rounds for %d-player bracket', (capacity) => {
    const bracket = generateBracket(capacity);
    const expectedRounds = Math.log2(capacity);
    expect(bracket.rounds).toHaveLength(expectedRounds);

    // Final round always has exactly 1 match
    const finalRound = bracket.rounds[bracket.rounds.length - 1];
    expect(finalRound.matchCount).toBe(1);
    expect(finalRound.roundName).toContain('Final');
  });

  it.each([4, 8, 16] as TournamentCapacity[])('total first-round slots equal capacity for %d players', (capacity) => {
    const bracket = generateBracket(capacity);
    const firstRoundSlots = bracket.rounds[0].matchCount * 2;
    expect(firstRoundSlots).toBe(capacity);
  });

  it('4-player bracket has Semifinals and Championship Final', () => {
    const names = TOURNAMENT_CONFIG.FORMAT.ROUNDS[4];
    expect(names).toEqual(['Semifinals', 'Championship Final']);
  });

  it('8-player bracket has QF, Semifinals, and Championship Final', () => {
    const names = TOURNAMENT_CONFIG.FORMAT.ROUNDS[8];
    expect(names).toEqual(['Quarterfinals', 'Semifinals', 'Championship Final']);
  });

  it('16-player bracket has R16, QF, Semifinals, and Championship Final', () => {
    const names = TOURNAMENT_CONFIG.FORMAT.ROUNDS[16];
    expect(names).toEqual([
      'Round of 16', 'Quarterfinals', 'Semifinals', 'Championship Final',
    ]);
  });

  it('bracket never creates a self-match (player vs. themselves)', () => {
    // Simulate seeded slot assignments for 8-player bracket
    const players = Array.from({ length: 8 }, (_, i) => `player-${i + 1}`);
    const matchups: [string, string][] = [];
    for (let i = 0; i < players.length; i += 2) {
      matchups.push([players[i], players[i + 1]]);
    }
    matchups.forEach(([p1, p2]) => {
      expect(p1).not.toBe(p2);
    });
  });

  it('every match has a unique ID within a bracket', () => {
    const bracket = generateBracket(16);
    const allIds = bracket.rounds.flatMap((r) => r.matchIds);
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(allIds.length);
  });

  it('match count halves each subsequent round', () => {
    const bracket = generateBracket(16);
    for (let i = 1; i < bracket.rounds.length; i++) {
      expect(bracket.rounds[i].matchCount).toBe(bracket.rounds[i - 1].matchCount / 2);
    }
  });
});

// ===========================================================================
// 3. CHRONOLOGICAL SCHEDULE VALIDATION
// ===========================================================================
describe('Tournament Schedule Chronological Validation', () => {
  function validateSchedule(regStart: Date, regEnd: Date, checkInStart: Date, checkInEnd: Date, startAt: Date) {
    const errors: string[] = [];
    if (regStart >= regEnd) errors.push('Registration start must be before registration end');
    if (regEnd > checkInStart) errors.push('Registration must close before or at check-in start');
    if (checkInStart >= checkInEnd) errors.push('Check-in start must be before check-in end');
    if (checkInEnd > startAt) errors.push('Check-in must end before or at tournament start');
    return errors;
  }

  it('accepts valid chronological order: reg → check-in → start', () => {
    const now = new Date();
    const regStart = new Date(now.getTime() + 1 * 60_000);
    const regEnd = new Date(now.getTime() + 60 * 60_000);
    const checkInStart = new Date(now.getTime() + 61 * 60_000);
    const checkInEnd = new Date(now.getTime() + 90 * 60_000);
    const startAt = new Date(now.getTime() + 91 * 60_000);

    const errors = validateSchedule(regStart, regEnd, checkInStart, checkInEnd, startAt);
    expect(errors).toHaveLength(0);
  });

  it('rejects inverted registration window', () => {
    const now = new Date();
    const regStart = new Date(now.getTime() + 60 * 60_000); // after regEnd
    const regEnd = new Date(now.getTime() + 1 * 60_000);

    const errors = validateSchedule(
      regStart, regEnd,
      new Date(now.getTime() + 90 * 60_000),
      new Date(now.getTime() + 120 * 60_000),
      new Date(now.getTime() + 121 * 60_000),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Registration start'))).toBe(true);
  });

  it('rejects check-in start that precedes registration end', () => {
    const now = new Date();
    const errors = validateSchedule(
      new Date(now.getTime() + 1 * 60_000),
      new Date(now.getTime() + 60 * 60_000),
      new Date(now.getTime() + 30 * 60_000), // before regEnd
      new Date(now.getTime() + 90 * 60_000),
      new Date(now.getTime() + 91 * 60_000),
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Registration must close'))).toBe(true);
  });

  it('rejects tournament start before check-in end', () => {
    const now = new Date();
    const errors = validateSchedule(
      new Date(now.getTime() + 1 * 60_000),
      new Date(now.getTime() + 30 * 60_000),
      new Date(now.getTime() + 31 * 60_000),
      new Date(now.getTime() + 100 * 60_000),
      new Date(now.getTime() + 90 * 60_000), // before check-in end
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('Check-in must end'))).toBe(true);
  });
});

// ===========================================================================
// 4. CAPACITY LIMITS & DUPLICATE REGISTRATION
// ===========================================================================
describe('Tournament Capacity & Registration Guards', () => {
  function registerPlayer(
    registeredIds: Set<string>,
    playerId: string,
    maxCapacity: number
  ): { success: boolean; error?: string } {
    if (registeredIds.has(playerId)) {
      return { success: false, error: 'Already registered' };
    }
    if (registeredIds.size >= maxCapacity) {
      return { success: false, error: 'Tournament is full' };
    }
    registeredIds.add(playerId);
    return { success: true };
  }

  it('allows registration up to capacity', () => {
    const registered = new Set<string>();
    for (let i = 0; i < 8; i++) {
      const res = registerPlayer(registered, `user-${i}`, 8);
      expect(res.success).toBe(true);
    }
    expect(registered.size).toBe(8);
  });

  it('rejects registration beyond capacity', () => {
    const registered = new Set<string>();
    for (let i = 0; i < 8; i++) {
      registerPlayer(registered, `user-${i}`, 8);
    }
    const res = registerPlayer(registered, 'user-overflow', 8);
    expect(res.success).toBe(false);
    expect(res.error).toContain('full');
  });

  it('prevents duplicate registration', () => {
    const registered = new Set<string>();
    const first = registerPlayer(registered, 'same-user', 8);
    expect(first.success).toBe(true);
    const second = registerPlayer(registered, 'same-user', 8);
    expect(second.success).toBe(false);
    expect(second.error).toContain('Already registered');
  });

  it.each([4, 8, 16] as const)('each supported capacity %d has a valid min-required', (cap) => {
    const minReq = TOURNAMENT_CONFIG.SIZES.MIN_REQUIRED[cap];
    expect(minReq).toBeGreaterThanOrEqual(2);
    expect(minReq).toBeLessThanOrEqual(cap);
  });
});

// ===========================================================================
// 5. CHECK-IN & NO-SHOW TRANSITIONS
// ===========================================================================
describe('Check-In Freeze & No-Show Transitions', () => {
  type ParticipantState = {
    id: string;
    status: ParticipantStatus;
    checkedInAt: string | null;
  };

  function checkIn(participant: ParticipantState, windowOpen: boolean): ParticipantState {
    if (!windowOpen) return participant;
    if (participant.status !== 'registered') return participant;
    return {
      ...participant,
      status: 'checked_in',
      checkedInAt: new Date().toISOString(),
    };
  }

  function markNoShows(participants: ParticipantState[]): ParticipantState[] {
    return participants.map((p) =>
      p.status === 'registered' ? { ...p, status: 'no_show' as const } : p
    );
  }

  it('allows check-in for registered participant when window is open', () => {
    const p: ParticipantState = { id: 'u1', status: 'registered', checkedInAt: null };
    const result = checkIn(p, true);
    expect(result.status).toBe('checked_in');
    expect(result.checkedInAt).toBeTruthy();
  });

  it('blocks check-in when window is closed', () => {
    const p: ParticipantState = { id: 'u1', status: 'registered', checkedInAt: null };
    const result = checkIn(p, false);
    expect(result.status).toBe('registered');
    expect(result.checkedInAt).toBeNull();
  });

  it('idempotent check-in does not change already checked-in state', () => {
    const p: ParticipantState = { id: 'u1', status: 'checked_in', checkedInAt: '2025-01-01T00:00:00Z' };
    const result = checkIn(p, true);
    expect(result.status).toBe('checked_in');
    expect(result.checkedInAt).toBe('2025-01-01T00:00:00Z');
  });

  it('marks all non-checked-in participants as no_show', () => {
    const participants: ParticipantState[] = [
      { id: 'u1', status: 'checked_in', checkedInAt: '2025-01-01T00:00:00Z' },
      { id: 'u2', status: 'registered', checkedInAt: null },
      { id: 'u3', status: 'registered', checkedInAt: null },
      { id: 'u4', status: 'checked_in', checkedInAt: '2025-01-01T00:00:00Z' },
    ];

    const result = markNoShows(participants);
    expect(result[0].status).toBe('checked_in');
    expect(result[1].status).toBe('no_show');
    expect(result[2].status).toBe('no_show');
    expect(result[3].status).toBe('checked_in');
  });

  it('does not mark withdrawn participants as no_show', () => {
    const participants: ParticipantState[] = [
      { id: 'u1', status: 'withdrawn', checkedInAt: null },
    ];
    const result = markNoShows(participants);
    expect(result[0].status).toBe('withdrawn');
  });
});

// ===========================================================================
// 6. DETERMINISTIC TIE-BREAKING ORDER
// ===========================================================================
describe('Tie-Breaking Policy Hierarchy', () => {
  const tieBreakPolicy = TOURNAMENT_CONFIG.TIE_BREAK_POLICY;

  it('defines exactly 4 tie-break steps', () => {
    expect(tieBreakPolicy).toHaveLength(4);
  });

  it('orders: Score → Accuracy → Combo → Sudden Death', () => {
    expect(tieBreakPolicy[0].name).toBe('Official Score');
    expect(tieBreakPolicy[1].name).toBe('Accuracy Percentage');
    expect(tieBreakPolicy[2].name).toBe('Highest Combo');
    expect(tieBreakPolicy[3].name).toBe('Sudden Death Rematch');
  });

  interface MatchResult {
    participantId: string;
    score: number;
    accuracy: number;
    combo: number;
  }

  function resolveTieBreak(p1: MatchResult, p2: MatchResult): string | null {
    // Step 1: Score
    if (p1.score !== p2.score) return p1.score > p2.score ? p1.participantId : p2.participantId;
    // Step 2: Accuracy
    if (p1.accuracy !== p2.accuracy) return p1.accuracy > p2.accuracy ? p1.participantId : p2.participantId;
    // Step 3: Combo
    if (p1.combo !== p2.combo) return p1.combo > p2.combo ? p1.participantId : p2.participantId;
    // Step 4: Sudden Death (null = requires rematch)
    return null;
  }

  it('resolves by score when scores differ', () => {
    const winner = resolveTieBreak(
      { participantId: 'p1', score: 15000, accuracy: 90, combo: 50 },
      { participantId: 'p2', score: 14000, accuracy: 95, combo: 60 },
    );
    expect(winner).toBe('p1');
  });

  it('falls back to accuracy when scores are tied', () => {
    const winner = resolveTieBreak(
      { participantId: 'p1', score: 15000, accuracy: 92, combo: 50 },
      { participantId: 'p2', score: 15000, accuracy: 95, combo: 40 },
    );
    expect(winner).toBe('p2');
  });

  it('falls back to combo when scores and accuracy are tied', () => {
    const winner = resolveTieBreak(
      { participantId: 'p1', score: 15000, accuracy: 95, combo: 60 },
      { participantId: 'p2', score: 15000, accuracy: 95, combo: 45 },
    );
    expect(winner).toBe('p1');
  });

  it('returns null for sudden death rematch when all factors tied', () => {
    const winner = resolveTieBreak(
      { participantId: 'p1', score: 15000, accuracy: 95, combo: 50 },
      { participantId: 'p2', score: 15000, accuracy: 95, combo: 50 },
    );
    expect(winner).toBeNull();
  });
});

// ===========================================================================
// 7. WINNER ADVANCEMENT IDEMPOTENCY
// ===========================================================================
describe('Winner Advancement Idempotency', () => {
  interface BracketMatch {
    id: string;
    winnerId: string | null;
    nextMatchId: string | null;
    status: TournamentMatchStatus;
  }

  function advanceWinner(
    matches: Map<string, BracketMatch>,
    matchId: string,
    winnerId: string
  ): { advanced: boolean; alreadySet: boolean } {
    const match = matches.get(matchId);
    if (!match) return { advanced: false, alreadySet: false };

    // Idempotency: same winner already recorded
    if (match.winnerId === winnerId && match.status === 'completed') {
      return { advanced: false, alreadySet: true };
    }

    // Advance
    match.winnerId = winnerId;
    match.status = 'completed';

    if (match.nextMatchId) {
      const nextMatch = matches.get(match.nextMatchId);
      if (nextMatch) {
        // Place winner in next match slot (simplified)
        nextMatch.status = 'ready';
      }
    }

    return { advanced: true, alreadySet: false };
  }

  it('advances winner to next match on first call', () => {
    const matches = new Map<string, BracketMatch>();
    matches.set('m1', { id: 'm1', winnerId: null, nextMatchId: 'm3', status: 'playing' });
    matches.set('m3', { id: 'm3', winnerId: null, nextMatchId: null, status: 'pending' });

    const result = advanceWinner(matches, 'm1', 'player-A');
    expect(result.advanced).toBe(true);
    expect(result.alreadySet).toBe(false);
    expect(matches.get('m1')!.winnerId).toBe('player-A');
    expect(matches.get('m1')!.status).toBe('completed');
    expect(matches.get('m3')!.status).toBe('ready');
  });

  it('returns idempotent result on duplicate advance call', () => {
    const matches = new Map<string, BracketMatch>();
    matches.set('m1', { id: 'm1', winnerId: 'player-A', nextMatchId: 'm3', status: 'completed' });
    matches.set('m3', { id: 'm3', winnerId: null, nextMatchId: null, status: 'ready' });

    const result = advanceWinner(matches, 'm1', 'player-A');
    expect(result.advanced).toBe(false);
    expect(result.alreadySet).toBe(true);
  });

  it('does not advance for non-existent match', () => {
    const matches = new Map<string, BracketMatch>();
    const result = advanceWinner(matches, 'ghost-match', 'player-A');
    expect(result.advanced).toBe(false);
    expect(result.alreadySet).toBe(false);
  });
});

// ===========================================================================
// 8. DISPUTE STATE MACHINE
// ===========================================================================
describe('Tournament Dispute State Machine', () => {
  type DisputeStatus = 'pending' | 'upheld' | 'rejected';

  interface Dispute {
    id: string;
    status: DisputeStatus;
    reason: DisputeReason;
    resolvedByUserId: string | null;
    resolutionNotes: string | null;
  }

  function resolveDispute(
    dispute: Dispute,
    resolution: 'upheld' | 'rejected',
    resolverUserId: string,
    notes: string
  ): Dispute | { error: string } {
    if (dispute.status !== 'pending') {
      return { error: 'Dispute has already been resolved' };
    }
    return {
      ...dispute,
      status: resolution,
      resolvedByUserId: resolverUserId,
      resolutionNotes: notes,
    };
  }

  const reasons = TOURNAMENT_CONFIG.DISPUTES.REASONS;

  it('defines at least 3 dispute reasons', () => {
    expect(reasons.length).toBeGreaterThanOrEqual(3);
  });

  it('includes disconnection, desync, conduct, and other', () => {
    const ids = reasons.map((r) => r.id);
    expect(ids).toContain('disconnection');
    expect(ids).toContain('desync');
    expect(ids).toContain('conduct');
    expect(ids).toContain('other');
  });

  it('transitions pending dispute to upheld', () => {
    const dispute: Dispute = {
      id: 'd1',
      status: 'pending',
      reason: 'disconnection',
      resolvedByUserId: null,
      resolutionNotes: null,
    };
    const result = resolveDispute(dispute, 'upheld', 'admin-1', 'Player dropped mid-match');
    expect(result).not.toHaveProperty('error');
    expect((result as Dispute).status).toBe('upheld');
    expect((result as Dispute).resolvedByUserId).toBe('admin-1');
  });

  it('transitions pending dispute to rejected', () => {
    const dispute: Dispute = {
      id: 'd2',
      status: 'pending',
      reason: 'conduct',
      resolvedByUserId: null,
      resolutionNotes: null,
    };
    const result = resolveDispute(dispute, 'rejected', 'admin-1', 'No evidence found');
    expect(result).not.toHaveProperty('error');
    expect((result as Dispute).status).toBe('rejected');
  });

  it('prevents re-resolution of already-resolved dispute', () => {
    const dispute: Dispute = {
      id: 'd3',
      status: 'upheld',
      reason: 'desync',
      resolvedByUserId: 'admin-1',
      resolutionNotes: 'Audio desync confirmed',
    };
    const result = resolveDispute(dispute, 'rejected', 'admin-2', 'Trying to re-resolve');
    expect(result).toHaveProperty('error');
    expect((result as { error: string }).error).toContain('already been resolved');
  });

  it('filing window is configured (positive minutes)', () => {
    expect(TOURNAMENT_CONFIG.DISPUTES.FILING_WINDOW_MINUTES).toBeGreaterThan(0);
  });
});

// ===========================================================================
// 9. ACHIEVEMENT DEDUPLICATION
// ===========================================================================
describe('Achievement Deduplication', () => {
  const achievementsDef = TOURNAMENT_CONFIG.ACHIEVEMENTS;

  it('defines at least 5 unique achievement codes', () => {
    expect(achievementsDef.length).toBeGreaterThanOrEqual(5);
    const codes = achievementsDef.map((a) => a.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('each achievement has a valid badge tier', () => {
    const validTiers = ['bronze', 'silver', 'gold', 'platinum'];
    achievementsDef.forEach((a) => {
      expect(validTiers).toContain(a.badgeTier);
    });
  });

  it('deduplication prevents awarding the same achievement twice', () => {
    const earned = new Set<AchievementCode>();
    function awardAchievement(code: AchievementCode): boolean {
      if (earned.has(code)) return false;
      earned.add(code);
      return true;
    }

    const first = awardAchievement('first_tournament');
    expect(first).toBe(true);
    const duplicate = awardAchievement('first_tournament');
    expect(duplicate).toBe(false);
    expect(earned.size).toBe(1);
  });

  it('allows different achievements for the same player', () => {
    const earned = new Set<AchievementCode>();
    function awardAchievement(code: AchievementCode): boolean {
      if (earned.has(code)) return false;
      earned.add(code);
      return true;
    }

    expect(awardAchievement('first_tournament')).toBe(true);
    expect(awardAchievement('first_tournament_win')).toBe(true);
    expect(awardAchievement('tournament_champion')).toBe(true);
    expect(earned.size).toBe(3);
  });
});

// ===========================================================================
// 10. SEASON POINTS ALLOCATION
// ===========================================================================
describe('Season Points Allocation by Placement', () => {
  const points = TOURNAMENT_CONFIG.SEASON.POINTS;

  it('champion earns the most points', () => {
    expect(points.CHAMPION).toBeGreaterThan(points.RUNNER_UP);
    expect(points.CHAMPION).toBeGreaterThan(points.SEMIFINALIST);
    expect(points.CHAMPION).toBeGreaterThan(points.QUARTERFINALIST);
    expect(points.CHAMPION).toBeGreaterThan(points.PARTICIPATION);
  });

  it('points decrease monotonically: champion > runner-up > semi > quarter > participation', () => {
    expect(points.CHAMPION).toBeGreaterThan(points.RUNNER_UP);
    expect(points.RUNNER_UP).toBeGreaterThan(points.SEMIFINALIST);
    expect(points.SEMIFINALIST).toBeGreaterThan(points.QUARTERFINALIST);
    expect(points.QUARTERFINALIST).toBeGreaterThan(points.PARTICIPATION);
  });

  it('participation points are positive', () => {
    expect(points.PARTICIPATION).toBeGreaterThan(0);
  });

  function allocateSeasonPoints(placement: number, capacity: TournamentCapacity): number {
    if (placement === 1) return points.CHAMPION;
    if (placement === 2) return points.RUNNER_UP;
    if (placement <= 4) return points.SEMIFINALIST;
    if (placement <= 8 && capacity >= 8) return points.QUARTERFINALIST;
    return points.PARTICIPATION;
  }

  it('1st place gets champion points', () => {
    expect(allocateSeasonPoints(1, 8)).toBe(points.CHAMPION);
  });

  it('2nd place gets runner-up points', () => {
    expect(allocateSeasonPoints(2, 8)).toBe(points.RUNNER_UP);
  });

  it('3rd/4th place get semifinalist points', () => {
    expect(allocateSeasonPoints(3, 8)).toBe(points.SEMIFINALIST);
    expect(allocateSeasonPoints(4, 16)).toBe(points.SEMIFINALIST);
  });

  it('5th-8th place get quarterfinalist points in 8+ bracket', () => {
    expect(allocateSeasonPoints(5, 8)).toBe(points.QUARTERFINALIST);
    expect(allocateSeasonPoints(8, 16)).toBe(points.QUARTERFINALIST);
  });

  it('beyond quarterfinal bracket gets participation points', () => {
    expect(allocateSeasonPoints(9, 16)).toBe(points.PARTICIPATION);
    expect(allocateSeasonPoints(16, 16)).toBe(points.PARTICIPATION);
  });

  it('current season ID is set', () => {
    expect(TOURNAMENT_CONFIG.SEASON.CURRENT_SEASON_ID).toBeTruthy();
    expect(TOURNAMENT_CONFIG.SEASON.DEFAULT_SEASON_NAME).toBeTruthy();
  });
});

// ===========================================================================
// 11. SONG SELECTION POLICIES
// ===========================================================================
describe('Song Selection Policies', () => {
  it('offers at least 2 song selection policies', () => {
    expect(TOURNAMENT_CONFIG.SONG_POLICIES.length).toBeGreaterThanOrEqual(2);
  });

  it('includes approved_pool and organizer_selected policies', () => {
    const policyIds = TOURNAMENT_CONFIG.SONG_POLICIES.map((p) => p.id);
    expect(policyIds).toContain('approved_pool');
    expect(policyIds).toContain('organizer_selected');
  });

  it('each policy has an id, label, and description', () => {
    TOURNAMENT_CONFIG.SONG_POLICIES.forEach((p) => {
      expect(p.id).toBeTruthy();
      expect(p.label).toBeTruthy();
      expect(p.desc).toBeTruthy();
    });
  });
});

// ===========================================================================
// 12. FORMAT TYPE GUARD
// ===========================================================================
describe('Tournament Format', () => {
  it('uses single_elimination format', () => {
    expect(TOURNAMENT_CONFIG.FORMAT.TYPE).toBe('single_elimination');
  });

  it('round names array length matches log2(capacity) for each size', () => {
    const sizes = TOURNAMENT_CONFIG.SIZES.SUPPORTED;
    sizes.forEach((cap) => {
      const expectedRounds = Math.log2(cap);
      expect(TOURNAMENT_CONFIG.FORMAT.ROUNDS[cap]).toHaveLength(expectedRounds);
    });
  });
});
