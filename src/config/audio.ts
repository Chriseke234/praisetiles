/**
 * Central Versioned Audio Intelligence & Rhythm Map Configuration for PraiseTiles
 * Rule version: 2.0.0 (Phase 6 Advanced Audio Engine)
 */

import { DifficultyProfile, DifficultyProfileName } from '@/types/audio';

export const AUDIO_CONFIG = {
  VERSION: '2.0.0',
  ALGORITHM_VERSION: 'pt-analyzer-2.0.0',

  // DSP & Framing Constants
  DSP: {
    FRAME_DURATION_SEC: 0.04, // 40ms frames for higher temporal resolution
    HOP_DURATION_SEC: 0.02,   // 20ms hops (50% overlap for smooth envelope tracking)
    SUB_BAND_CROSSOVER_HZ: 250, // Separates low-end (kick/bass) from mids/highs (snare/keys)
    LOCAL_WINDOW_SEC: 0.8,    // 800ms sliding window for adaptive local thresholding
    DUPLICATE_SUPPRESSION_WINDOW_SEC: 0.12, // 120ms suppression between consecutive candidate onsets
    LOW_BAND_WEIGHT: 0.65,    // Weight for bass transients
    HIGH_BAND_WEIGHT: 0.35,   // Weight for high/percussive transients
    INITIAL_PREPARE_PADDING_SEC: 1.5, // Silence before first note to allow player to prepare
    END_PADDING_SEC: 1.0,     // Silence after last note before track concludes
  },

  // Playability & Map Validation Thresholds
  VALIDATION: {
    MIN_TOTAL_NOTES: 15,
    MIN_DURATION_SEC: 30,   // GDD minimum: 30 seconds
    MAX_DURATION_SEC: 300,  // GDD maximum: 5 minutes
    MAX_LANE_CONCENTRATION_PERCENT: 55.0, // Max % of notes on any single lane
    MAX_DIFFICULTY_SPIKE_RATIO: 3.0,     // Max note density increase between consecutive 5s windows
    SILENCE_THRESHOLD_RMS: 0.008,        // Below this RMS level is considered musical silence
    MAX_ALLOWED_NOTES_DURING_SILENCE: 0, // No notes allowed during sustained silence
  },

  // Difficulty Profiles
  DIFFICULTY_PROFILES: {
    beginner: {
      name: 'beginner',
      label: 'Beginner Praiser',
      description: 'Generous note spacing with focus on center lanes, ideal for casual and learning play.',
      minIntervalStar1Sec: 0.85,
      minIntervalStar2Sec: 0.50,
      minIntervalStar3Sec: 0.30,
      maxNotesPerSecStar1: 1.5,
      maxNotesPerSecStar2: 2.5,
      maxNotesPerSecStar3: 3.8,
      adaptiveThresholdSensitivity: 1.0, // Higher threshold = fewer notes
      allowedLanesStar1: [1, 2],
      allowedLanesStar2: [0, 1, 2, 3],
      allowedLanesStar3: [0, 1, 2, 3],
    },
    standard: {
      name: 'standard',
      label: 'Standard Praise',
      description: 'Balanced rhythm patterns tracking kick, snare, and melodic accents across all four lanes.',
      minIntervalStar1Sec: 0.70,
      minIntervalStar2Sec: 0.40,
      minIntervalStar3Sec: 0.22,
      maxNotesPerSecStar1: 2.0,
      maxNotesPerSecStar2: 3.5,
      maxNotesPerSecStar3: 5.5,
      adaptiveThresholdSensitivity: 0.75,
      allowedLanesStar1: [1, 2],
      allowedLanesStar2: [0, 1, 2, 3],
      allowedLanesStar3: [0, 1, 2, 3],
    },
    advanced: {
      name: 'advanced',
      label: 'Virtuoso Worship',
      description: 'High note density and intricate syncopation matching rapid praise runs and gospel percussion.',
      minIntervalStar1Sec: 0.50,
      minIntervalStar2Sec: 0.28,
      minIntervalStar3Sec: 0.16,
      maxNotesPerSecStar1: 2.8,
      maxNotesPerSecStar2: 4.8,
      maxNotesPerSecStar3: 7.2,
      adaptiveThresholdSensitivity: 0.55,
      allowedLanesStar1: [0, 1, 2, 3],
      allowedLanesStar2: [0, 1, 2, 3],
      allowedLanesStar3: [0, 1, 2, 3],
    },
  } as Record<DifficultyProfileName, DifficultyProfile>,

  DEFAULT_DIFFICULTY: 'standard' as DifficultyProfileName,

  // Calibration Defaults (in milliseconds)
  CALIBRATION: {
    MIN_OFFSET_MS: -150,
    MAX_OFFSET_MS: 150,
    DEFAULT_OFFSET_MS: 0,
    STEP_MS: 5,
  },
} as const;
