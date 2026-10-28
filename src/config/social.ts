/**
 * Central Social, Competitive & Matchmaking Configuration for PraiseTiles Phase 4
 * Version: 4.0.0
 *
 * All parameters for matchmaking queues, Elo rating adjustments, public rooms,
 * leaderboards, chat rate-limiting, and moderation are defined here.
 */

export const SOCIAL_CONFIG = {
  VERSION: '4.0.0',

  PUBLIC_ROOMS: {
    DEFAULT_CAPACITY: 8,
    MAX_CAPACITY: 16,
    MAX_ACTIVE_PLAYERS: 4,
  },

  MATCHMAKING: {
    /** How often client sends queue heartbeat (ms) */
    HEARTBEAT_INTERVAL_MS: 5_000,
    /** After how long without heartbeat an entry is considered stale (ms) */
    QUEUE_TIMEOUT_MS: 15_000,
    /** Initial rating search window in ranked queue (± points) */
    INITIAL_RATING_WINDOW: 100,
    /** Rating window expansion rate (points added every interval) */
    RATING_WINDOW_EXPANSION_STEP: 50,
    /** Expansion interval (ms) */
    RATING_EXPANSION_INTERVAL_MS: 10_000,
    /** Maximum rating search window ceiling (± points) */
    MAX_RATING_WINDOW: 400,
    /** Countdown before match starts once group is assembled (ms) */
    MATCH_PREP_WINDOW_MS: 5_000,
  },

  COMPETITIVE: {
    DEFAULT_RATING: 1000,
    /** Number of ranked matches a player remains in provisional status */
    PROVISIONAL_MATCHES_THRESHOLD: 10,
    /** K-Factor during provisional period (faster calibration) */
    K_FACTOR_PROVISIONAL: 32,
    /** K-Factor for established players */
    K_FACTOR_ESTABLISHED: 16,
    /** Minimum allowed rating floor */
    MIN_RATING: 100,
    /** Current active competitive season identifier */
    CURRENT_SEASON_ID: 'season-1',
  },

  CHAT: {
    MAX_MESSAGE_LENGTH: 280,
    /** Cooldown period between chat messages sent by the same user (ms) */
    RATE_LIMIT_MS: 1_500,
    /** Max messages retained per room in memory */
    MAX_MESSAGES_PER_ROOM: 100,
  },

  MODERATION: {
    REPORT_REASONS: [
      { id: 'harassment', label: 'Harassment or Bullying' },
      { id: 'hate_speech', label: 'Inappropriate or Offensive Language' },
      { id: 'spam', label: 'Spamming or Advertising' },
      { id: 'cheating', label: 'Suspected Cheating or Tampering' },
      { id: 'impersonation', label: 'Impersonation' },
      { id: 'other', label: 'Other' },
    ] as const,
  },

  QUICK_REACTIONS: [
    { id: 'amen', label: 'Amen!', iconName: 'Flame' },
    { id: 'praise', label: 'Praise God!', iconName: 'Sparkles' },
    { id: 'hallelujah', label: 'Hallelujah!', iconName: 'Music' },
    { id: 'fire', label: 'On Fire!', iconName: 'Zap' },
    { id: 'heart', label: 'Love this track', iconName: 'Heart' },
    { id: 'blessed', label: 'Blessed', iconName: 'ShieldCheck' },
  ] as const,

  LEADERBOARDS: {
    PAGE_SIZE: 20,
    MAX_RECORDS: 100,
    TABS: [
      { id: 'global', label: 'Global Ranked' },
      { id: 'weekly', label: 'Weekly Ranked' },
      { id: 'piano', label: 'Piano Tiles' },
      { id: 'guitar', label: 'Guitar Tiles' },
      { id: 'friends', label: 'Friends' },
    ] as const,
  },
} as const;

export type SocialConfig = typeof SOCIAL_CONFIG;
export type ReportReasonId = typeof SOCIAL_CONFIG.MODERATION.REPORT_REASONS[number]['id'];
export type QuickReactionId = typeof SOCIAL_CONFIG.QUICK_REACTIONS[number]['id'];
export type LeaderboardTabId = typeof SOCIAL_CONFIG.LEADERBOARDS.TABS[number]['id'];
