/**
 * Advanced Audio Intelligence & Rhythm Map v2.0 Domain Types
 * Phase 6 — PraiseTiles Audio Engine
 */

import { Note, RhythmMapStageBoundaries } from './game';

export type DifficultyProfileName = 'beginner' | 'standard' | 'advanced';

export interface DifficultyProfile {
  name: DifficultyProfileName;
  label: string;
  description: string;
  minIntervalStar1Sec: number; // e.g. 0.85s (beginner) vs 0.70s (standard) vs 0.50s (advanced)
  minIntervalStar2Sec: number; // e.g. 0.50s vs 0.40s vs 0.28s
  minIntervalStar3Sec: number; // e.g. 0.30s vs 0.22s vs 0.16s
  maxNotesPerSecStar1: number;
  maxNotesPerSecStar2: number;
  maxNotesPerSecStar3: number;
  adaptiveThresholdSensitivity: number; // Multiplier on local stdDev (lower = more notes)
  allowedLanesStar1: number[]; // e.g. [1, 2] for inner lane focus
  allowedLanesStar2: number[]; // [0, 1, 2, 3]
  allowedLanesStar3: number[]; // [0, 1, 2, 3]
}

export interface NoteV2 extends Note {
  confidence?: number; // 0.0 to 1.0 peak confidence score
  bandType?: 'low' | 'high' | 'full'; // Primary trigger band
}

export interface RhythmMapMetrics {
  avgNotesPerSecond: number;
  peakNotesPerSecond: number;
  minNoteIntervalSec: number;
  laneDistribution: [number, number, number, number]; // Percentages [lane0, lane1, lane2, lane3]
  estimatedBpm?: number | null;
}

export interface RhythmMapV2 {
  version: '2.0.0' | '1.0.0';
  mapId: string;
  algorithmVersion: string;
  audioFingerprint: string;
  songTitle: string;
  duration: number; // Total duration in seconds
  totalNotes: number;
  notes: NoteV2[];
  stages: RhythmMapStageBoundaries;
  difficultyProfile: DifficultyProfileName;
  metrics: RhythmMapMetrics;
  validationStatus: 'valid' | 'warning' | 'invalid';
  validationErrors?: string[];
  integrityChecksum: string;
  createdAt: string;
}

export interface OnsetCandidate {
  time: number;
  energy: number;
  confidence: number;
  bandType: 'low' | 'high' | 'full';
}

export interface AudioAnalysisDiagnostics {
  duration: number;
  sampleRate: number;
  numFrames: number;
  frameDurationSec: number;
  rawOnsetsCount: number;
  acceptedNotesCount: number;
  estimatedBpm: number | null;
  peakRms: number;
  meanRms: number;
  difficultyProfile: DifficultyProfileName;
}
