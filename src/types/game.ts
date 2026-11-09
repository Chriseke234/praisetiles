/**
 * Domain entity types for PraiseTiles Gospel Rhythm Game
 * Conforms to GDD v1.0 and Technical Implementation Plan specifications.
 */

export type InstrumentType = 'piano' | 'guitar';

export type HitGrade = 'PERFECT' | 'GREAT' | 'GOOD' | 'MISS';

export type NoteType = 'short' | 'long';

export type SustainState = 'idle' | 'holding' | 'completed' | 'released_early';

export type FailureReason = 'MISSED_NOTE' | 'INCORRECT_TAP' | 'AUDIO_ERROR' | 'MISSED_SUSTAIN' | null;

export type GameStatus =
  | 'MENU'
  | 'UPLOAD'
  | 'PREVIEW'
  | 'COUNTDOWN'
  | 'PLAYING'
  | 'FAILED'
  | 'COMPLETED';

export interface Note {
  id: string;
  lane: number; // 0, 1, 2, or 3
  time: number; // Target timestamp in seconds from audio start
  hit: boolean;
  grade?: HitGrade | null;
  type?: NoteType; // 'short' (default) or 'long' (sustained note)
  duration?: number; // Duration of sustain in seconds (for 'long' notes)
  sustainProgress?: number; // 0.0 to 1.0 holding progress
  sustainState?: SustainState;
}

export interface RhythmMapStageBoundaries {
  star1End: number; // Seconds (e.g. 33% of duration)
  star2End: number; // Seconds (e.g. 66% of duration)
  star3End: number; // Seconds (100% of duration)
}

export interface RhythmMap {
  version: string;
  audioFingerprint: string;
  songTitle: string;
  duration: number; // Total duration in seconds
  totalNotes: number;
  notes: Note[];
  stages: RhythmMapStageBoundaries;
}

export interface ScoreState {
  score: number;
  combo: number;
  maxCombo: number;
  perfectCount: number;
  greatCount: number;
  goodCount: number;
  missCount: number;
  runAccuracy: number; // 0.0 to 100.0%
  totalEncountered: number;
  shieldsRemaining?: number;
}

export interface RunResult {
  completed: boolean;
  failureReason: FailureReason;
  score: number;
  accuracy: number;
  highestCombo: number;
  elapsedTime: number;
  songDuration: number;
  totalNotes: number;
  notesHit: number;
  instrument: InstrumentType;
  isPartial: boolean;
  perfectCount?: number;
  greatCount?: number;
  goodCount?: number;
  missCount?: number;
}

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
  peakAmplitude?: number;
  rmsEnergy?: number;
  sampleRate?: number;
  numberOfChannels?: number;
  isNearSilent?: boolean;
  isClipped?: boolean;
}
