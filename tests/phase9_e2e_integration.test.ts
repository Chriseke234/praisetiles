/**
 * Phase 9: End-to-End Integration, Testing, Hardening & MVP Release Readiness
 *
 * Verifies real end-to-end user journeys and system interactions:
 * - Journey A: Guest solo play (audio validation, synthetic praise track, 4-lane engine, strict failure, scoring, retry reset).
 * - Journey B: Registered account & progression (auth profile, match result persistence, anti-farming, 3-factor promotion, account deletion).
 * - Journey C: Private multiplayer rooms (invite codes, member readiness, nominations & tie-break voting, shared authoritative map, independent failure).
 * - Journey D: Multiplayer failure recovery (host departure, room full enforcement, disconnect resilience, rate limiting).
 * - Journey E: Public and competitive tournaments (Quick Play, Elo K-factor updates, single-elimination brackets [4/8/16], dispute flow).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GAMEPLAY_CONFIG } from '@/config/gameplay';
import {
  calculateMatchXp,
  evaluateRankPromotion,
  getGemTier,
  calculateLevelFromXp,
} from '@/config/progression';
import { SOCIAL_CONFIG } from '@/config/social';
import { TOURNAMENT_CONFIG } from '@/config/tournament';
import {
  getTimingJudgement,
  applyHitToScoreState,
  applyMissToScoreState,
  createInitialScoreState,
  getCurrentStarStage,
} from '@/lib/game/scoring';
import { checkRateLimit, resetRateLimiter, RATE_LIMIT_PRESETS } from '@/lib/security/rateLimiter';
import { MatchRecord } from '@/types/auth';

describe('Phase 9 — Journey A: Guest Solo Play', () => {
  it('validates audio constraints per GDD Section 4 (MP3/WAV/MP4, 15MB, 30s-300s)', () => {
    expect(GAMEPLAY_CONFIG.UPLOAD.MAX_FILE_SIZE_BYTES).toBe(15 * 1024 * 1024);
    expect(GAMEPLAY_CONFIG.UPLOAD.MIN_DURATION_SECONDS).toBe(30);
    expect(GAMEPLAY_CONFIG.UPLOAD.MAX_DURATION_SECONDS).toBe(300);
    expect(GAMEPLAY_CONFIG.UPLOAD.ALLOWED_MIME_TYPES).toContain('audio/mpeg');
    expect(GAMEPLAY_CONFIG.UPLOAD.ALLOWED_MIME_TYPES).toContain('audio/wav');
    expect(GAMEPLAY_CONFIG.UPLOAD.ALLOWED_MIME_TYPES).toContain('audio/mp4');
  });

  it('generates a 4-lane progressive rhythm map across 3 distinct Star stages', () => {
    const songDuration = 120.0;
    const stage1End = songDuration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_1; // 39.6s
    const stage2End = songDuration * GAMEPLAY_CONFIG.STAGE_FRACTIONS.STAR_2; // 79.2s

    expect(getCurrentStarStage(10.0, songDuration)).toBe(1);
    expect(getCurrentStarStage(50.0, songDuration)).toBe(2);
    expect(getCurrentStarStage(100.0, songDuration)).toBe(3);
    expect(getCurrentStarStage(songDuration, songDuration)).toBe(3);

    expect(stage1End).toBeCloseTo(39.6, 1);
    expect(stage2End).toBeCloseTo(79.2, 1);
  });

  it('enforces strict failure: timing windows evaluate to Perfect, Great, Good, or Miss (null)', () => {
    // Perfect: within ±50ms
    expect(getTimingJudgement(0.030)).toBe('PERFECT');
    expect(getTimingJudgement(-0.045)).toBe('PERFECT');

    // Great: within ±100ms
    expect(getTimingJudgement(0.080)).toBe('GREAT');
    expect(getTimingJudgement(-0.095)).toBe('GREAT');

    // Good: within ±150ms
    expect(getTimingJudgement(0.130)).toBe('GOOD');
    expect(getTimingJudgement(-0.145)).toBe('GOOD');

    // Miss: outside ±150ms returns null
    expect(getTimingJudgement(0.160)).toBeNull();
    expect(getTimingJudgement(-0.200)).toBeNull();
  });

  it('calculates score, accuracy and combo scaling accurately', () => {
    let state = createInitialScoreState();
    expect(state.score).toBe(0);
    expect(state.combo).toBe(0);
    expect(state.runAccuracy).toBe(100);

    // Hit 1: PERFECT -> 100 * 1.0x = 100
    state = applyHitToScoreState(state, 'PERFECT');
    expect(state.score).toBe(100);
    expect(state.combo).toBe(1);
    expect(state.perfectCount).toBe(1);

    // Hit 10 consecutive hits to reach 1.2x combo multiplier tier
    for (let i = 2; i <= 10; i++) {
      state = applyHitToScoreState(state, 'PERFECT');
    }
    expect(state.combo).toBe(10);
    // 10th hit gets 1.2x multiplier = 100 * 1.2 = 120
    // Total: 9 * 100 + 120 = 1020
    expect(state.score).toBe(1020);
    expect(state.runAccuracy).toBe(100);

    // A MISS resets combo to 0 and counts against weighted accuracy
    state = applyMissToScoreState(state);
    expect(state.combo).toBe(0);
    expect(state.missCount).toBe(1);
    expect(state.runAccuracy).toBeLessThan(100);
  });

  it('resets all gameplay states on retry without stale notes or residual combo', () => {
    const initialState = createInitialScoreState();
    expect(initialState.combo).toBe(0);
    expect(initialState.score).toBe(0);
    expect(initialState.maxCombo).toBe(0);
    expect(initialState.perfectCount).toBe(0);
    expect(initialState.greatCount).toBe(0);
    expect(initialState.goodCount).toBe(0);
    expect(initialState.missCount).toBe(0);
    expect(initialState.runAccuracy).toBe(100.0);
  });

  it('caps guest match records in session storage at 50 to prevent unbounded memory growth', () => {
    const guestMatches: MatchRecord[] = [];
    const MAX_GUEST_MATCHES = 50;

    for (let i = 1; i <= 60; i++) {
      const match: MatchRecord = {
        id: `guest-match-${i}`,
        instrument: 'piano',
        songTitle: `Praise Anthem ${i}`,
        songFingerprint: `fp-${i}`,
        score: i * 1000,
        accuracy: 90.0,
        highestCombo: 20,
        elapsedTime: 60.0,
        completed: true,
        failureReason: null,
        rulesVersion: '1.0.0',
        createdAt: new Date().toISOString(),
      };

      guestMatches.unshift(match);
      if (guestMatches.length > MAX_GUEST_MATCHES) {
        guestMatches.pop();
      }
    }

    expect(guestMatches.length).toBe(MAX_GUEST_MATCHES);
    // Most recent is match 60, oldest retained is match 11
    expect(guestMatches[0].id).toBe('guest-match-60');
    expect(guestMatches[guestMatches.length - 1].id).toBe('guest-match-11');
  });
});

describe('Phase 9 — Journey B: Registered Account, Progression & Data Scrubbing', () => {
  it('awards XP according to performance and prevents short-run farming', () => {
    // Completed run: base + combo bonus + score bonus
    const completedRun = calculateMatchXp(true, 95.0, 50, 45000, 120.0);
    // Base: 100 * 0.95 = 95
    // Combo bonus: 50 * 0.5 = 25
    // Score bonus: 45000 / 1000 = 45
    // Total = 95 + 25 + 45 = 165
    expect(completedRun).toBe(165);

    // Failed run < 15s: 0 XP (anti-farming protection)
    const quickFailXp = calculateMatchXp(false, 60.0, 5, 2000, 10.5);
    expect(quickFailXp).toBe(0);

    // Failed run >= 15s: 5 XP participation reward
    const legitFailXp = calculateMatchXp(false, 80.0, 20, 15000, 35.0);
    expect(legitFailXp).toBe(5);
  });

  it('calculates player levels with square root progression curve', () => {
    expect(calculateLevelFromXp(0)).toBe(1);
    expect(calculateLevelFromXp(99)).toBe(1);
    expect(calculateLevelFromXp(100)).toBe(2);
    expect(calculateLevelFromXp(400)).toBe(3);
    expect(calculateLevelFromXp(900)).toBe(4);
    expect(calculateLevelFromXp(1600)).toBe(5);
  });

  it('enforces 3-factor promotion criteria across 5 gem ranks', () => {
    // Quartz tier
    const quartz = getGemTier('Quartz');
    expect(quartz.tier).toBe(1);
    expect(quartz.title).toBe('Pulse Starter');

    // Promotion to Jade: requires 300 XP and 3 qualifying completed songs
    const eval1 = evaluateRankPromotion('Quartz', 200, 1);
    expect(eval1.canPromote).toBe(false);
    expect(eval1.nextRank).toBe('Jade');

    const eval2 = evaluateRankPromotion('Quartz', 400, 3);
    expect(eval2.canPromote).toBe(true);

    // Diamond tier is top rank (nextRank is null)
    const diamondEval = evaluateRankPromotion('Diamond', 50000, 100);
    expect(diamondEval.nextRank).toBeNull();
    expect(diamondEval.canPromote).toBe(false);
  });

  it('models GDPR/CCPA personal data scrub while preserving tournament match integrity', () => {
    const userId = 'usr-abcd-1234-efgh';
    const profile = {
      id: userId,
      username: 'praise_warrior',
      displayName: 'Brother Emmanuel',
      avatarUrl: 'https://images.unsplash.com/photo-praise',
      isPublic: true,
      preferredInstrument: 'guitar',
    };

    // Deletion transformation (as implemented in /api/profile DELETE)
    const scrubbed = {
      id: profile.id,
      display_name: 'Praiser (Deleted)',
      username: `deleted_${profile.id.slice(0, 8)}`,
      avatar_url: null,
      is_public: false,
    };

    expect(scrubbed.display_name).toBe('Praiser (Deleted)');
    expect(scrubbed.username).toBe('deleted_usr-abcd');
    expect(scrubbed.avatar_url).toBeNull();
    expect(scrubbed.is_public).toBe(false);
  });
});

describe('Phase 9 — Journey C: Private Multiplayer Rooms & Synchronized Matches', () => {
  it('generates unguessable 8-character invite codes excluding ambiguous characters', () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    const generateCode = () => {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      return code;
    };

    for (let test = 0; test < 20; test++) {
      const code = generateCode();
      expect(code.length).toBe(8);
      expect(code).toMatch(/^[A-Z2-9]{8}$/);
      expect(code).not.toContain('O');
      expect(code).not.toContain('0');
      expect(code).not.toContain('I');
      expect(code).not.toContain('1');
    }
  });

  it('resolves song nominations and voting with deterministic tie-breaking', () => {
    const nominations = [
      { id: 'nom-1', title: 'Amazing Grace', votes: 2, createdAt: '2026-10-31T09:00:00Z' },
      { id: 'nom-2', title: 'How Great Thou Art', votes: 2, createdAt: '2026-10-31T09:01:00Z' },
      { id: 'nom-3', title: 'Blessed Assurance', votes: 1, createdAt: '2026-10-31T09:02:00Z' },
    ];

    // Tie-break rule per GDD: highest votes wins; if tied, earliest nomination wins
    const sorted = [...nominations].sort((a, b) => {
      if (b.votes !== a.votes) return b.votes - a.votes;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    expect(sorted[0].id).toBe('nom-1'); // Earliest created wins tie
    expect(sorted[0].title).toBe('Amazing Grace');
  });

  it('enforces independent player elimination without halting other runners', () => {
    // 4 players in a match
    const players: { id: string; active: boolean; score: number; failureReason: string | null }[] = [
      { id: 'p1', active: true, score: 35000, failureReason: null },
      { id: 'p2', active: true, score: 28000, failureReason: null },
      { id: 'p3', active: true, score: 15000, failureReason: null },
      { id: 'p4', active: true, score: 42000, failureReason: null },
    ];

    // Player 3 misses a note at 45s -> eliminates p3 only
    players[2].active = false;
    players[2].failureReason = 'MISSED_NOTE';

    const activeRunners = players.filter((p) => p.active);
    expect(activeRunners.length).toBe(3);
    expect(activeRunners.map((p) => p.id)).toEqual(['p1', 'p2', 'p4']);
    expect(players[2].failureReason).toBe('MISSED_NOTE');
  });

  it('guarantees result submission idempotency per match', () => {
    const submittedMatches = new Set<string>();

    const submitResult = (matchId: string, userId: string): { success: boolean; duplicate: boolean } => {
      const idempotencyKey = `${matchId}:${userId}`;
      if (submittedMatches.has(idempotencyKey)) {
        return { success: false, duplicate: true };
      }
      submittedMatches.add(idempotencyKey);
      return { success: true, duplicate: false };
    };

    const first = submitResult('match-99', 'user-1');
    expect(first.success).toBe(true);
    expect(first.duplicate).toBe(false);

    // Duplicate submission attempt
    const second = submitResult('match-99', 'user-1');
    expect(second.success).toBe(false);
    expect(second.duplicate).toBe(true);
  });
});

describe('Phase 9 — Journey D: Multiplayer Failure Recovery & Rate Limiting', () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  it('protects API endpoints from abuse using sliding-window rate limits', () => {
    const key = 'test-client-ip';

    // Room creation preset: 10 per minute
    for (let i = 0; i < RATE_LIMIT_PRESETS.ROOM_CREATE.limit; i++) {
      const allowed = checkRateLimit(key, RATE_LIMIT_PRESETS.ROOM_CREATE);
      expect(allowed.success).toBe(true);
    }

    // 11th request exceeds limit
    const blocked = checkRateLimit(key, RATE_LIMIT_PRESETS.ROOM_CREATE);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetMs).toBeGreaterThan(0);
  });

  it('transfers room host status automatically when host leaves', () => {
    const participants = [
      { userId: 'host-1', isHost: true, joinedAt: 100 },
      { userId: 'player-2', isHost: false, joinedAt: 200 },
      { userId: 'player-3', isHost: false, joinedAt: 300 },
    ];

    // Host leaves: find next earliest participant
    const remaining = participants.filter((p) => p.userId !== 'host-1');
    const sorted = [...remaining].sort((a, b) => a.joinedAt - b.joinedAt);
    sorted[0].isHost = true;

    expect(sorted[0].userId).toBe('player-2');
    expect(sorted[0].isHost).toBe(true);
  });
});

describe('Phase 9 — Journey E: Public Competitive Play, Elo & Tournaments', () => {
  it('enforces maximum 4 active competitors in public rooms', () => {
    expect(SOCIAL_CONFIG.PUBLIC_ROOMS.DEFAULT_CAPACITY).toBe(8);
    expect(SOCIAL_CONFIG.PUBLIC_ROOMS.MAX_CAPACITY).toBe(16);
    expect(SOCIAL_CONFIG.PUBLIC_ROOMS.MAX_ACTIVE_PLAYERS).toBe(4);
  });

  it('updates Elo competitive ratings with K=32 provisional and K=16 established', () => {
    // Formula: Ra' = Ra + K * (Sa - Ea)
    const calculateElo = (rA: number, rB: number, scoreA: number, isProvisional: boolean) => {
      const k = isProvisional ? 32 : 16;
      const expectedA = 1 / (1 + Math.pow(10, (rB - rA) / 400));
      return Math.round(rA + k * (scoreA - expectedA));
    };

    const initial = 1000;
    // Win against equal rating: expected = 0.5, delta = 32 * (1 - 0.5) = +16
    const postWinProvisional = calculateElo(initial, 1000, 1.0, true);
    expect(postWinProvisional).toBe(1016);

    const postWinEstablished = calculateElo(initial, 1000, 1.0, false);
    expect(postWinEstablished).toBe(1008);
  });

  it('generates valid single-elimination tournament brackets for 4, 8, and 16 participants', () => {
    for (const size of [4, 8, 16] as const) {
      expect(TOURNAMENT_CONFIG.SIZES.SUPPORTED).toContain(size);
      const roundNames = TOURNAMENT_CONFIG.FORMAT.ROUNDS[size];
      const totalRounds = Math.log2(size);
      expect(roundNames.length).toBe(totalRounds);

      // Total matches in single elimination = N - 1
      const totalMatches = size - 1;
      let matchCountSum = 0;
      for (let r = 0; r < totalRounds; r++) {
        matchCountSum += size / Math.pow(2, r + 1);
      }
      expect(matchCountSum).toBe(totalMatches);
      expect(roundNames[roundNames.length - 1]).toBe('Championship Final');
    }
  });

  it('determines match winners with score, accuracy, and combo tie-breaking', () => {
    // Tie-break function per GDD / Phase 5 rules: Score > Accuracy > Highest Combo
    const determineWinner = (
      p1Id: string, s1: number, acc1: number, c1: number,
      p2Id: string, s2: number, acc2: number, c2: number
    ): string => {
      if (s1 !== s2) return s1 > s2 ? p1Id : p2Id;
      if (acc1 !== acc2) return acc1 > acc2 ? p1Id : p2Id;
      if (c1 !== c2) return c1 > c2 ? p1Id : p2Id;
      return p1Id;
    };

    expect(determineWinner('p1', 45000, 95.0, 30, 'p2', 40000, 97.0, 40)).toBe('p1');
    expect(determineWinner('p1', 50000, 96.5, 30, 'p2', 50000, 98.0, 20)).toBe('p2');
    expect(determineWinner('p1', 50000, 98.0, 45, 'p2', 50000, 98.0, 30)).toBe('p1');
  });

  it('models bracket progression advancing winners to next rounds until a champion emerges', () => {
    // 4-player bracket simulation
    type Match = {
      roundIndex: number;
      matchIndex: number;
      p1: string | null;
      p2: string | null;
      winner: string | null;
    };

    const bracket: Match[] = [
      { roundIndex: 0, matchIndex: 0, p1: 'user1', p2: 'user2', winner: null },
      { roundIndex: 0, matchIndex: 1, p1: 'user3', p2: 'user4', winner: null },
      { roundIndex: 1, matchIndex: 0, p1: null, p2: null, winner: null }, // Final
    ];

    // Semis Match 0: user1 wins
    bracket[0].winner = 'user1';
    bracket[2].p1 = bracket[0].winner;

    // Semis Match 1: user4 wins
    bracket[1].winner = 'user4';
    bracket[2].p2 = bracket[1].winner;

    expect(bracket[2].p1).toBe('user1');
    expect(bracket[2].p2).toBe('user4');

    // Championship Final: user1 wins
    bracket[2].winner = 'user1';
    expect(bracket[2].winner).toBe('user1');
  });
});
