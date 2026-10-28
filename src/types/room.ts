/**
 * Domain entity types for PraiseTiles Phase 3 — Private Multiplayer
 * Conforms to TECHNICAL_IMPLEMENTATION_PLAN.md Phase 3 specifications.
 */

import { InstrumentType, RhythmMap } from '@/types/game';

// ---------------------------------------------------------------------------
// Room State Machine
// ---------------------------------------------------------------------------

export type RoomStatus =
  | 'waiting'      // Lobby open, waiting for players
  | 'nominating'   // Players submitting song nominations
  | 'voting'       // Players voting on nominated songs
  | 'uploading'    // Host uploading the winning song audio
  | 'ready_check'  // All participants confirming ready
  | 'countdown'    // Synchronized start countdown in progress
  | 'playing'      // Match in progress
  | 'finished'     // Match concluded, results visible
  | 'closed';      // Room closed (rematch declined / max time reached)

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

export interface RoomParticipant {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  gemRank?: string;
  isHost: boolean;
  isReady: boolean;
  isConnected: boolean;
  joinedAt: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// Nominations & Votes
// ---------------------------------------------------------------------------

export interface Nomination {
  id: string;
  roomId: string;
  userId: string;
  displayName: string; // Denormalized for display
  songTitle: string;
  artist?: string | null;
  createdAt: string; // ISO 8601
}

export interface Vote {
  id: string;
  roomId: string;
  nominationId: string;
  userId: string;
  createdAt: string; // ISO 8601
}

export interface VoteTally {
  nominationId: string;
  songTitle: string;
  artist?: string | null;
  nominatedBy: string;
  voteCount: number;
}

// ---------------------------------------------------------------------------
// Room Match
// ---------------------------------------------------------------------------

export interface RoomMatch {
  id: string;
  roomId: string;
  /** Full validated RhythmMap JSON — fetched by all clients before ready-check. */
  mapJson: RhythmMap;
  mapChecksum: string;
  songTitle: string;
  songFingerprint: string;
  instrument: InstrumentType;
  /** ISO 8601 — UTC timestamp for synchronized AudioContext start. */
  scheduledStartAt: string | null;
  completedAt: string | null;
  /** 'pending' | 'active' | 'completed' | 'cancelled' */
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  /** Always true in Phase 3 — no competitive anti-cheat claimed. */
  isCasual: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Match Participant Results
// ---------------------------------------------------------------------------

export interface MatchParticipant {
  matchId: string;
  userId: string;
  displayName: string; // Denormalized
  score: number;
  accuracy: number; // 0.0 – 100.0
  highestCombo: number;
  completed: boolean;
  /** ISO 8601 timestamp — null if player completed without elimination. */
  eliminatedAt: string | null;
  /** 1-indexed final placement (1 = winner). null until match ends. */
  placement: number | null;
  failureReason: string | null;
  /** ISO 8601 — when this participant submitted their result. */
  submittedAt: string | null;
}

// ---------------------------------------------------------------------------
// Room State (Full aggregate, kept in RoomContext)
// ---------------------------------------------------------------------------

export interface RoomState {
  id: string;
  inviteCode: string;
  hostId: string;
  status: RoomStatus;
  instrument: InstrumentType;
  maxParticipants: number;
  songTitle: string | null;
  songFingerprint: string | null;
  mapVersion: string | null;
  mapChecksum: string | null;
  scheduledStartAt: string | null;
  audioStoragePath: string | null;
  audioExpiresAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Live participants — updated by Realtime. */
  participants: RoomParticipant[];
  /** Current round nominations. */
  nominations: Nomination[];
  /** Current round votes. */
  votes: Vote[];
  /** Active match (populated when status === 'playing' | 'finished'). */
  currentMatch: RoomMatch | null;
  /** Per-participant results (populated progressively as players finish). */
  matchResults: MatchParticipant[];
}

// ---------------------------------------------------------------------------
// Realtime Broadcast Payloads
// ---------------------------------------------------------------------------

export interface CountdownPayload {
  startsAt: string; // ISO 8601
  countdownMs: number;
}

export interface MatchStartPayload {
  matchId: string;
  scheduledStartAt: string; // ISO 8601 — UTC
  mapChecksum: string;
}

export interface ScoreUpdatePayload {
  userId: string;
  score: number;
  combo: number;
  accuracy: number;
  notesHit: number;
  totalEncountered: number;
  timestamp: number; // performance.now() on sender
}

export interface PlayerEliminatedPayload {
  userId: string;
  score: number;
  accuracy: number;
  highestCombo: number;
  failureReason: string;
  eliminatedAt: string; // ISO 8601
}

export interface MatchEndPayload {
  matchId: string;
  completedAt: string; // ISO 8601
}

export interface HostChangedPayload {
  newHostId: string;
  displayName: string;
}

// ---------------------------------------------------------------------------
// API Request / Response shapes
// ---------------------------------------------------------------------------

export interface CreateRoomRequest {
  instrument: InstrumentType;
}

export interface CreateRoomResponse {
  roomId: string;
  inviteCode: string;
}

export interface JoinRoomRequest {
  inviteCode: string;
}

export interface JoinRoomResponse {
  roomId: string;
  inviteCode: string;
  status: RoomStatus;
}

export interface SubmitMapRequest {
  mapJson: RhythmMap;
  checksum: string;
  songTitle: string;
  songFingerprint: string;
}

export interface SubmitMapResponse {
  matchId: string;
  scheduledStartAt: string;
}

export interface FinalizeMatchRequest {
  matchId: string;
  score: number;
  accuracy: number;
  highestCombo: number;
  completed: boolean;
  failureReason: string | null;
  notesHit: number;
  totalNotes: number;
  elapsedTime: number;
}

export interface FinalizeMatchResponse {
  placement: number;
  matchStatus: 'active' | 'completed';
}

// ---------------------------------------------------------------------------
// Client-side ephemeral opponent tracking (not persisted)
// ---------------------------------------------------------------------------

export interface OpponentSnapshot {
  userId: string;
  displayName: string;
  score: number;
  combo: number;
  accuracy: number;
  isEliminated: boolean;
  lastUpdatedAt: number; // performance.now()
}
