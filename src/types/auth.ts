/**
 * Auth, Profile, and Progression Domain Types for PraiseTiles
 * Rule version: 1.0.0
 */

import { InstrumentType, FailureReason } from './game';

export type GemRank = 'Quartz' | 'Jade' | 'Sapphire' | 'Ruby' | 'Diamond';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  isPublic: boolean;
  preferredInstrument: InstrumentType;
  createdAt: string;
  updatedAt: string;
}

export interface PlayerProgress {
  userId: string;
  xp: number;
  level: number;
  gemRank: GemRank;
  qualifyingCompletedSongs: number;
  version: string;
  updatedAt: string;
}

export interface PlayerStats {
  userId: string;
  totalAttempts: number;
  completedSongs: number;
  bestScore: number;
  bestAccuracy: number;
  highestCombo: number;
  pianoAttempts: number;
  pianoCompleted: number;
  pianoBestScore: number;
  guitarAttempts: number;
  guitarCompleted: number;
  guitarBestScore: number;
  updatedAt: string;
}

export interface MatchRecord {
  id: string; // Idempotency key
  userId?: string;
  instrument: InstrumentType;
  songTitle: string;
  songFingerprint: string;
  score: number;
  accuracy: number;
  highestCombo: number;
  elapsedTime: number;
  completed: boolean;
  failureReason: FailureReason;
  rulesVersion: string;
  createdAt: string;
}

export interface PromotionRequirement {
  tier: number;
  gemRank: GemRank;
  title: string;
  requiredXp: number;
  requiredAccuracy: number;
  requiredQualifyingSongs: number;
  colorHex: string;
}

export interface PromotionEvaluation {
  currentRank: GemRank;
  nextRank: GemRank | null;
  canPromote: boolean;
  currentXp: number;
  requiredXp: number;
  currentQualifying: number;
  requiredQualifying: number;
  requiredAccuracy: number;
  progressPercent: number;
}

export interface MatchSubmissionResult {
  status: 'success' | 'duplicate' | 'offline_saved' | 'error';
  matchId: string;
  xpEarned: number;
  xp: number;
  level: number;
  gemRank: GemRank;
  promoted: boolean;
  error?: string;
}
