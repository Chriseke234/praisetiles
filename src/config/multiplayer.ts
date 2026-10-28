/**
 * Central Multiplayer Configuration for PraiseTiles Phase 3
 * Version: 3.0.0 — Private Room Multiplayer
 *
 * All room-related constants live here. Never hardcode values in components.
 */

export const MULTIPLAYER_CONFIG = {
  VERSION: '3.0.0',

  ROOM: {
    /** Maximum concurrent active competitors per private room. */
    MAX_PARTICIPANTS: 4,
    /** Length of the randomly-generated alphanumeric invite code. */
    INVITE_CODE_LENGTH: 8,
    /** Room expires and becomes unjonable after this many ms of inactivity. */
    ROOM_EXPIRY_MS: 2 * 60 * 60 * 1000, // 2 hours
    /** Grace period (ms) before treating a disconnected player as left. */
    RECONNECT_GRACE_MS: 30_000, // 30 seconds
  },

  NOMINATION: {
    /** How long (ms) players have to nominate songs once the host opens nominations. */
    DURATION_MS: 60_000, // 60 seconds
    /** Maximum nominations each player can submit per round. */
    MAX_PER_PLAYER: 3,
    /** Maximum total nominations per room per round. */
    MAX_TOTAL: 12,
  },

  VOTING: {
    /** How long (ms) players have to cast their vote. */
    DURATION_MS: 45_000, // 45 seconds
  },

  MATCH: {
    /**
     * How many ms ahead the server schedules match start.
     * Clients use this window to finish preloading audio and align clocks.
     */
    COUNTDOWN_MS: 5_000, // 5 seconds

    /**
     * How often (ms) each client broadcasts a score snapshot to opponents.
     * Intentionally coarse — avoids overwhelming Realtime with per-tap events.
     */
    SCORE_BROADCAST_INTERVAL_MS: 2_000, // 2 seconds

    /**
     * Documented timing tolerance for synchronized start.
     * Not enforced technically in casual mode.
     * LAN: ~±200ms; Internet: ~±500ms
     */
    SYNC_TOLERANCE_MS: 500,
  },

  AUDIO: {
    /** Storage bucket name for temporary match audio files. */
    BUCKET_NAME: 'room-audio',
    /**
     * How long (ms) signed audio URLs remain valid.
     * Must exceed the longest supported song (5 min) plus match duration.
     */
    SIGNED_URL_EXPIRY_SECONDS: 900, // 15 minutes
    /**
     * Delay after a match completes before attempting audio cleanup.
     * Allows late-joining result screens to still access audio details.
     */
    CLEANUP_DELAY_MS: 10 * 60 * 1000, // 10 minutes
    /** Object path template. Replace {roomId} and {matchId} at runtime. */
    OBJECT_PATH_TEMPLATE: 'rooms/{roomId}/{matchId}/audio',
  },

  REALTIME: {
    /** Supabase Realtime channel name template. Replace {roomId}. */
    CHANNEL_TEMPLATE: 'room:{roomId}',
    BROADCAST_EVENTS: {
      COUNTDOWN: 'countdown',
      MATCH_START: 'match_start',
      SCORE_UPDATE: 'score_update',
      PLAYER_ELIMINATED: 'player_eliminated',
      MATCH_END: 'match_end',
      HOST_CHANGED: 'host_changed',
    },
  },

  /** Tie-breaking rules for song voting, in priority order. */
  TIE_BREAKING: {
    /**
     * 1. Earlier nomination wins (oldest nomination_id < newest).
     * 2. If still tied, host pick (host's nominated song from the tied set).
     * 3. If host did not nominate any tied song, random selection (seeded by room_id).
     */
    STRATEGY: 'earliest_then_host_then_random' as const,
  },
} as const;

export type MultiplayerConfig = typeof MULTIPLAYER_CONFIG;
