/**
 * Central Versioned Gameplay Configuration for PraiseTiles
 * Rule version: 1.0.0 (Matches GDD v1.0 specifications)
 * 
 * Keep all gameplay tuning values in this single module.
 * Never hardcode magic numbers in UI or engine components.
 */

export const GAMEPLAY_CONFIG = {
  RULES_VERSION: '1.0.0',

  // Audio Upload Constraints
  UPLOAD: {
    MAX_FILE_SIZE_BYTES: 15 * 1024 * 1024, // 15 MB
    MIN_DURATION_SECONDS: 30, // 30 seconds
    MAX_DURATION_SECONDS: 300, // 5 minutes
    ALLOWED_MIME_TYPES: [
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/x-wav',
      'audio/mp4',
      'video/mp4', // for mp4 files containing audio tracks
      'audio/aac',
      'audio/ogg',
    ],
  },

  // Timing Windows (in seconds)
  // Provisional windows from GDD: Perfect ±50ms; Great ±100ms; Good ±150ms
  TIMING_WINDOWS: {
    PERFECT_SEC: 0.050, // ±50ms
    GREAT_SEC: 0.100,   // ±100ms
    GOOD_SEC: 0.150,    // ±150ms
  },

  // Base Points per Hit Grade (Arcade Standard: 100 / 75 / 50)
  BASE_POINTS: {
    PERFECT: 100,
    GREAT: 75,
    GOOD: 50,
    MISS: 0,
  },

  // Accuracy Hit Weights (Weighted timing quality)
  ACCURACY_WEIGHTS: {
    PERFECT: 1.00,
    GREAT: 0.90,
    GOOD: 0.75,
    MISS: 0.00,
  },

  // Combo Multipliers based on consecutive successful hits
  // 1–9 hits: ×1.0, 10–24: ×1.2, 25–49: ×1.5, 50–99: ×2.0, 100+: ×3.0
  COMBO_MULTIPLIERS: [
    { minCombo: 100, multiplier: 3.0 },
    { minCombo: 50, multiplier: 2.0 },
    { minCombo: 25, multiplier: 1.5 },
    { minCombo: 10, multiplier: 1.2 },
    { minCombo: 1, multiplier: 1.0 },
  ],

  // 3-Star Song Progression Stages (fraction of total track duration)
  // Difficulty/density builds progressively; audio playback speed is NEVER altered.
  STAGE_FRACTIONS: {
    STAR_1: 0.33, // 0 to 33%: Star 1 - Establish the rhythm
    STAR_2: 0.66, // 33% to 66%: Star 2 - Build intensity
    STAR_3: 1.00, // 66% to 100%: Star 3 - Final challenge
  },

  // Four-lane setup
  LANES: {
    COUNT: 4,
    DEFAULT_KEYS: ['d', 'f', 'j', 'k'] as const,
  },

  // Visual & Fall timing
  // Time ahead of hit point that notes become visible and start falling down lane
  APPROACH_TIME_SECONDS: 1.8, // 1.8s for smooth readable approach on both mobile & desktop

  // Dynamic approach times based on song progression and energy
  DYNAMIC_APPROACH_TIMES: {
    STAR_1: 1.8,  // Star 1 (0-33%): Calm / introductory approach
    STAR_2: 1.45, // Star 2 (33-66%): Accelerated moderate pace
    STAR_3: 1.15, // Star 3 (66-100%): High-energy arcade climax
  },

  // Long (Sustained) Tile Mechanics
  SUSTAIN: {
    MIN_DURATION_SECONDS: 0.5, // Minimum duration for sustained notes
    MAX_DURATION_SECONDS: 2.0, // Maximum duration for sustained notes
    TICK_INTERVAL_SECONDS: 0.1, // Hold evaluation tick every 100ms
    TICK_POINTS: 10,           // Points awarded per tick held
    COMPLETION_BONUS: 100,     // Full sustain completion bonus
    EARLY_RELEASE_TOLERANCE_SEC: 0.1, // Allow releasing within 100ms of end
  },
} as const;

export type GameplayConfig = typeof GAMEPLAY_CONFIG;
