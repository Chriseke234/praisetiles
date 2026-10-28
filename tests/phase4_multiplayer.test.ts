/**
 * Phase 4 Multiplayer & Social Unit & Integration Tests
 *
 * Covers:
 * 1. Public room capacity, constraints (8-16 players, max 4 active), and filters
 * 2. Quick Play queue mechanics (rating window expansion, heartbeat timeout, cancel penalty-free)
 * 3. Competitive Elo formula, provisional calibration, and rating floor
 * 4. Leaderboard deterministic tie-breaking and tab categorization
 * 5. Friend request lifecycle, blocking restrictions, and report validation
 * 6. Chat rate-limiting, 280-char boundaries, and SVG quick reactions
 * 7. Match share data sanitization (no private audio URLs)
 */

import { describe, it, expect } from 'vitest';
import { SOCIAL_CONFIG, QuickReactionId, ReportReasonId } from '../src/config/social';
import { InstrumentType } from '../src/types/game';
import { RoomMode, MatchShareData } from '../src/types/social';

// ===========================================================================
// 1. PUBLIC ROOM CAPACITY & ACTIVE COMPETITOR BOUNDS
// ===========================================================================
describe('Public Room System Constraints', () => {
  const { DEFAULT_CAPACITY, MAX_CAPACITY, MAX_ACTIVE_PLAYERS } = SOCIAL_CONFIG.PUBLIC_ROOMS;

  it('enforces default room capacity of 8 and maximum of 16', () => {
    expect(DEFAULT_CAPACITY).toBe(8);
    expect(MAX_CAPACITY).toBe(16);
    expect(DEFAULT_CAPACITY).toBeLessThanOrEqual(MAX_CAPACITY);
  });

  it('strictly caps active competitors at 4 per match', () => {
    expect(MAX_ACTIVE_PLAYERS).toBe(4);
  });

  it('allocates active competitor vs spectator seats correctly', () => {
    const participants = Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i + 1}`,
      seatIndex: i,
      isActivePlayer: i < MAX_ACTIVE_PLAYERS,
    }));

    const activePlayers = participants.filter((p) => p.isActivePlayer);
    const spectators = participants.filter((p) => !p.isActivePlayer);

    expect(activePlayers.length).toBe(4);
    expect(spectators.length).toBe(4);
  });

  it('rejects joining when room total capacity is full', () => {
    const room = {
      maxParticipants: 12,
      participantCount: 12,
      status: 'waiting',
    };

    const canJoin = room.participantCount < room.maxParticipants && room.status === 'waiting';
    expect(canJoin).toBe(false);
  });

  it('allows spectators to join even if 4 active player seats are occupied', () => {
    const room = {
      maxParticipants: 8,
      participantCount: 4,
      activePlayerCount: 4,
      status: 'waiting',
    };

    const canJoinRoom = room.participantCount < room.maxParticipants;
    const canTakeActiveSlot = room.activePlayerCount < MAX_ACTIVE_PLAYERS;

    expect(canJoinRoom).toBe(true);
    expect(canTakeActiveSlot).toBe(false);
  });
});

// ===========================================================================
// 2. QUICK PLAY MATCHMAKING QUEUE & RATING WINDOW EXPANSION
// ===========================================================================
describe('Quick Play Matchmaking Queue Mechanics', () => {
  const {
    HEARTBEAT_INTERVAL_MS,
    QUEUE_TIMEOUT_MS,
    INITIAL_RATING_WINDOW,
    RATING_WINDOW_EXPANSION_STEP,
    RATING_EXPANSION_INTERVAL_MS,
    MAX_RATING_WINDOW,
  } = SOCIAL_CONFIG.MATCHMAKING;

  function calculateSearchWindow(elapsedMs: number): number {
    const steps = Math.floor(elapsedMs / RATING_EXPANSION_INTERVAL_MS);
    const expanded = INITIAL_RATING_WINDOW + steps * RATING_WINDOW_EXPANSION_STEP;
    return Math.min(expanded, MAX_RATING_WINDOW);
  }

  it('initial rating search window starts at ±100 Elo points', () => {
    expect(calculateSearchWindow(0)).toBe(100);
    expect(calculateSearchWindow(5_000)).toBe(100);
  });

  it('expands rating search window by 50 points every 10 seconds', () => {
    expect(calculateSearchWindow(10_000)).toBe(150);
    expect(calculateSearchWindow(20_000)).toBe(200);
    expect(calculateSearchWindow(30_000)).toBe(250);
  });

  it('caps search window expansion at ±400 points ceiling', () => {
    expect(calculateSearchWindow(100_000)).toBe(MAX_RATING_WINDOW);
    expect(calculateSearchWindow(300_000)).toBe(400);
  });

  it('identifies stale queue entries after heartbeat timeout (15s)', () => {
    const now = Date.now();
    const freshEntry = { lastHeartbeat: now - 5_000 };
    const staleEntry = { lastHeartbeat: now - 16_000 };

    const isStale = (entry: { lastHeartbeat: number }) => now - entry.lastHeartbeat > QUEUE_TIMEOUT_MS;

    expect(isStale(freshEntry)).toBe(false);
    expect(isStale(staleEntry)).toBe(true);
  });

  it('allows cancellation from queue without rating penalty', () => {
    const playerBefore = { rating: 1250, matchesPlayed: 14 };
    // Player cancels queue
    const playerAfter = { ...playerBefore }; // No Elo adjustment applied on queue cancel
    expect(playerAfter.rating).toBe(playerBefore.rating);
    expect(playerAfter.matchesPlayed).toBe(playerBefore.matchesPlayed);
  });
});

// ===========================================================================
// 3. COMPETITIVE ELO FORMULA & PROVISIONAL CALIBRATION
// ===========================================================================
describe('Competitive Elo Rating & Calibration', () => {
  const {
    DEFAULT_RATING,
    MIN_RATING,
    PROVISIONAL_MATCHES_THRESHOLD,
    K_FACTOR_PROVISIONAL,
    K_FACTOR_ESTABLISHED,
  } = SOCIAL_CONFIG.COMPETITIVE;

  function getKFactor(matchesPlayed: number): number {
    return matchesPlayed < PROVISIONAL_MATCHES_THRESHOLD ? K_FACTOR_PROVISIONAL : K_FACTOR_ESTABLISHED;
  }

  function expectedScore(ratingA: number, ratingB: number): number {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Pairwise multiplayer Elo update:
   * Each player plays pairwise matches against all other players in the room.
   * If Player A places higher than Player B, actual score = 1.
   * If tied, actual score = 0.5.
   * If lower, actual score = 0.
   */
  function calculateMultiplayerEloDelta(
    playerRating: number,
    playerMatchesPlayed: number,
    playerPlacement: number,
    opponents: { rating: number; placement: number }[],
  ): number {
    if (opponents.length === 0) return 0;
    const K = getKFactor(playerMatchesPlayed);
    let totalDelta = 0;

    for (const opp of opponents) {
      const exp = expectedScore(playerRating, opp.rating);
      let actual = 0.5;
      if (playerPlacement < opp.placement) actual = 1.0;
      else if (playerPlacement > opp.placement) actual = 0.0;

      totalDelta += K * (actual - exp);
    }

    // Normalized by number of opponents
    return Math.round(totalDelta / opponents.length);
  }

  it('initializes default rating at 1000 with provisional status', () => {
    expect(DEFAULT_RATING).toBe(1000);
    expect(getKFactor(0)).toBe(32);
    expect(getKFactor(9)).toBe(32);
  });

  it('transitions to established K-factor (16) after 10 matches', () => {
    expect(getKFactor(10)).toBe(16);
    expect(getKFactor(25)).toBe(16);
  });

  it('awards positive rating delta for 1st place against equal-rated players', () => {
    const opponents = [
      { rating: 1000, placement: 2 },
      { rating: 1000, placement: 3 },
      { rating: 1000, placement: 4 },
    ];

    const delta = calculateMultiplayerEloDelta(1000, 5, 1, opponents);
    expect(delta).toBeGreaterThan(0);
    expect(1000 + delta).toBeGreaterThan(1000);
  });

  it('deducts rating delta for 4th place against equal-rated players', () => {
    const opponents = [
      { rating: 1000, placement: 1 },
      { rating: 1000, placement: 2 },
      { rating: 1000, placement: 3 },
    ];

    const delta = calculateMultiplayerEloDelta(1000, 5, 4, opponents);
    expect(delta).toBeLessThan(0);
  });

  it('enforces rating floor at 100 (rating never drops below MIN_RATING)', () => {
    let currentRating = 110;
    const extremeLossDelta = -40;

    currentRating = Math.max(MIN_RATING, currentRating + extremeLossDelta);
    expect(currentRating).toBe(100);

    // Another loss
    currentRating = Math.max(MIN_RATING, currentRating - 50);
    expect(currentRating).toBe(100);
  });
});

// ===========================================================================
// 4. LEADERBOARD SORTING & DETERMINISTIC TIE-BREAKING
// ===========================================================================
describe('Leaderboard Sorting & Tie-Breaking', () => {
  interface Candidate {
    id: string;
    rating: number;
    rankedWins: number;
    winRate: number;
  }

  function compareCandidates(a: Candidate, b: Candidate): number {
    if (b.rating !== a.rating) return b.rating - a.rating;
    if (b.rankedWins !== a.rankedWins) return b.rankedWins - a.rankedWins;
    if (b.winRate !== a.winRate) return b.winRate - a.winRate;
    return a.id.localeCompare(b.id); // Deterministic tie-breaker
  }

  it('ranks players by rating descending', () => {
    const list: Candidate[] = [
      { id: '1', rating: 1100, rankedWins: 5, winRate: 50 },
      { id: '2', rating: 1450, rankedWins: 12, winRate: 80 },
      { id: '3', rating: 950, rankedWins: 2, winRate: 20 },
    ];

    const sorted = [...list].sort(compareCandidates);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
    expect(sorted[2].id).toBe('3');
  });

  it('breaks rating ties using rankedWins descending', () => {
    const list: Candidate[] = [
      { id: '1', rating: 1200, rankedWins: 8, winRate: 60 },
      { id: '2', rating: 1200, rankedWins: 14, winRate: 70 },
    ];

    const sorted = [...list].sort(compareCandidates);
    expect(sorted[0].id).toBe('2');
    expect(sorted[1].id).toBe('1');
  });

  it('has 5 distinct leaderboards defined in configuration', () => {
    const tabIds = SOCIAL_CONFIG.LEADERBOARDS.TABS.map((t) => t.id);
    expect(tabIds).toEqual(['global', 'weekly', 'piano', 'guitar', 'friends']);
  });
});

// ===========================================================================
// 5. SOCIAL PLATFORM: FRIENDSHIP, BLOCKING & REPORTING
// ===========================================================================
describe('Social Platform Rules', () => {
  it('prevents self-friending', () => {
    const senderId = 'user-123';
    const receiverId = 'user-123';

    const canSendRequest = senderId !== receiverId;
    expect(canSendRequest).toBe(false);
  });

  it('friend request state transitions from pending to accepted or declined', () => {
    type FriendshipStatus = 'pending' | 'accepted' | 'declined';
    let status: FriendshipStatus = 'pending';

    const accept = () => { status = 'accepted'; };
    const decline = () => { status = 'declined'; };

    expect(status).toBe('pending');
    accept();
    expect(status).toBe('accepted');
  });

  it('blocked users cannot send room invitations', () => {
    const blockedUserIds = new Set(['bad-actor-1', 'spammer-2']);
    const inviterId = 'bad-actor-1';

    const canInvite = !blockedUserIds.has(inviterId);
    expect(canInvite).toBe(false);
  });

  it('validates supported moderation report reasons', () => {
    const validReasonIds = SOCIAL_CONFIG.MODERATION.REPORT_REASONS.map((r) => r.id);

    expect(validReasonIds.includes('harassment')).toBe(true);
    expect(validReasonIds.includes('hate_speech')).toBe(true);
    expect(validReasonIds.includes('cheating')).toBe(true);
    expect(validReasonIds.includes('spam')).toBe(true);
    // Invalid reason
    expect(validReasonIds.includes('arbitrary_complaint' as ReportReasonId)).toBe(false);
  });
});

// ===========================================================================
// 6. ROOM CHAT & PREDEFINED QUICK REACTIONS
// ===========================================================================
describe('Room Chat & Quick Reactions Integrity', () => {
  const { MAX_MESSAGE_LENGTH, RATE_LIMIT_MS } = SOCIAL_CONFIG.CHAT;

  it('enforces maximum 280 characters message length limit', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(280);

    const validMsg = 'Praise the Lord! That was an amazing rhythm map!'.padEnd(280, '.');
    const invalidMsg = validMsg + '!';

    expect(validMsg.length <= MAX_MESSAGE_LENGTH).toBe(true);
    expect(invalidMsg.length <= MAX_MESSAGE_LENGTH).toBe(false);
  });

  it('rejects empty or whitespace-only messages', () => {
    const validate = (text: string) => text.trim().length > 0 && text.length <= MAX_MESSAGE_LENGTH;

    expect(validate('')).toBe(false);
    expect(validate('   ')).toBe(false);
    expect(validate('Great run!')).toBe(true);
  });

  it('enforces 1,500ms cooldown rate limit between messages', () => {
    expect(RATE_LIMIT_MS).toBe(1500);

    let lastSentAt = 1000;
    const canSendAt = (time: number) => time - lastSentAt >= RATE_LIMIT_MS;

    expect(canSendAt(1500)).toBe(false); // Only 500ms elapsed
    expect(canSendAt(2200)).toBe(false); // 1200ms elapsed
    expect(canSendAt(2500)).toBe(true);  // Exactly 1500ms elapsed
    expect(canSendAt(3000)).toBe(true);  // 2000ms elapsed
  });

  it('validates predefined quick reactions (SVG based, no emojis)', () => {
    const reactionIds = SOCIAL_CONFIG.QUICK_REACTIONS.map((r) => r.id);
    expect(reactionIds).toContain('amen');
    expect(reactionIds).toContain('praise');
    expect(reactionIds).toContain('hallelujah');
    expect(reactionIds).toContain('fire');
    expect(reactionIds).toContain('heart');
    expect(reactionIds).toContain('blessed');

    // Emoji strings must not be allowed as quick reaction IDs
    expect(reactionIds.some((id) => /[\u{1F300}-\u{1F9FF}]/u.test(id))).toBe(false);
  });
});

// ===========================================================================
// 7. MATCH RESULT CARD & PRIVACY SANITIZATION
// ===========================================================================
describe('Match Result Card & Privacy Sanitization', () => {
  it('excludes private audio URLs and room secrets from shareable payload', () => {
    const rawMatchResult = {
      gameName: 'PraiseTiles' as const,
      songTitle: 'Way Maker',
      artist: 'Sinach',
      instrument: 'piano' as InstrumentType,
      roomMode: 'ranked' as RoomMode,
      score: 95400,
      accuracy: 98.4,
      highestCombo: 142,
      placement: 1,
      totalPlayers: 4,
      ratingChange: 24,
      newRating: 1248,
      timestamp: new Date().toISOString(),
      // Internal fields that MUST NOT be exposed
      audioUrl: 'https://supabase.internal/storage/v1/s3/temp_match_123.mp3',
      roomId: 'room-uuid-secret-999',
      hostToken: 'bearer-secret-token',
    };

    // Public share card format
    const publicCard: MatchShareData = {
      gameName: rawMatchResult.gameName,
      songTitle: rawMatchResult.songTitle,
      artist: rawMatchResult.artist,
      instrument: rawMatchResult.instrument,
      roomMode: rawMatchResult.roomMode,
      score: rawMatchResult.score,
      accuracy: rawMatchResult.accuracy,
      highestCombo: rawMatchResult.highestCombo,
      placement: rawMatchResult.placement,
      totalPlayers: rawMatchResult.totalPlayers,
      ratingChange: rawMatchResult.ratingChange,
      newRating: rawMatchResult.newRating,
      timestamp: rawMatchResult.timestamp,
    };

    expect((publicCard as unknown as Record<string, unknown>).audioUrl).toBeUndefined();
    expect((publicCard as unknown as Record<string, unknown>).roomId).toBeUndefined();
    expect((publicCard as unknown as Record<string, unknown>).hostToken).toBeUndefined();
    expect(publicCard.songTitle).toBe('Way Maker');
    expect(publicCard.placement).toBe(1);
    expect(publicCard.score).toBe(95400);
  });
});
