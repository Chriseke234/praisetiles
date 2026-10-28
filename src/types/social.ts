/**
 * Domain entity types for PraiseTiles Phase 4 — Social, Quick Play & Competitive Ranked
 * Conforms to TECHNICAL_IMPLEMENTATION_PLAN.md Milestone 4 specifications.
 */

import { InstrumentType } from '@/types/game';
import { RoomStatus } from '@/types/room';

export type RoomMode = 'casual' | 'ranked';

// ---------------------------------------------------------------------------
// Public Room Discovery
// ---------------------------------------------------------------------------

export interface PublicRoomSummary {
  id: string;
  name: string;
  inviteCode: string;
  hostId: string;
  hostDisplayName: string;
  hostAvatarUrl?: string | null;
  hostGemRank?: string;
  roomMode: RoomMode;
  instrument: InstrumentType;
  status: RoomStatus;
  participantCount: number;
  maxParticipants: number;
  activePlayerCount: number;
  maxActivePlayers: number;
  canJoin: boolean;
  songTitle?: string | null;
  createdAt: string;
}

export interface PublicRoomFilters {
  mode?: RoomMode | 'all';
  instrument?: InstrumentType | 'all';
  availableSeatsOnly?: boolean;
  waitingOnly?: boolean;
  searchQuery?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Quick Play & Matchmaking Queue
// ---------------------------------------------------------------------------

export type QueueStatus = 'queued' | 'matched' | 'cancelled';

export interface MatchmakingQueueEntry {
  id: string;
  userId: string;
  mode: RoomMode;
  instrument: InstrumentType;
  rating: number;
  ratingRange: number;
  status: QueueStatus;
  matchedRoomId?: string | null;
  matchedInviteCode?: string | null;
  queuedAt: string;
  heartbeatAt: string;
}

export interface QueueRequest {
  mode: RoomMode;
  instrument: InstrumentType;
}

export interface QueueResponse {
  queueId: string;
  status: QueueStatus;
  matchedInviteCode?: string | null;
  estimatedWaitSeconds: number;
}

// ---------------------------------------------------------------------------
// Social: Friends, Followers, Blocks & Reports
// ---------------------------------------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted' | 'rejected';

export interface Friendship {
  id: string;
  userId: string;
  friendId: string;
  friendDisplayName: string;
  friendUsername: string;
  friendAvatarUrl?: string | null;
  friendGemRank: string;
  friendCompetitiveRating: number;
  isOnline: boolean;
  status: FriendshipStatus;
  isRequester: boolean;
  createdAt: string;
}

export interface FollowerProfile {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  gemRank: string;
  competitiveRating: number;
  isOnline: boolean;
  followedAt: string;
}

export interface UserBlock {
  blockerId: string;
  blockedId: string;
  blockedDisplayName: string;
  blockedUsername: string;
  blockedAvatarUrl?: string | null;
  createdAt: string;
}

export interface UserReport {
  id: string;
  reporterId: string;
  reportedId: string;
  reason: string;
  details?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Presence & Invitations
// ---------------------------------------------------------------------------

export type OnlinePresenceState = 'online' | 'in_lobby' | 'in_match' | 'offline';

export interface UserPresence {
  userId: string;
  state: OnlinePresenceState;
  currentRoomCode?: string | null;
  lastSeenAt: string;
}

export interface RoomInvitation {
  id: string;
  senderId: string;
  senderDisplayName: string;
  senderAvatarUrl?: string | null;
  receiverId: string;
  roomId: string;
  roomName: string;
  inviteCode: string;
  roomMode: RoomMode;
  instrument: InstrumentType;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}

// ---------------------------------------------------------------------------
// Competitive Elo Rating & History
// ---------------------------------------------------------------------------

export interface CompetitiveRating {
  userId: string;
  instrument: InstrumentType | 'overall';
  rating: number;
  provisional: boolean;
  rankedMatchesPlayed: number;
  rankedWins: number;
  bestRating: number;
  seasonId: string;
  updatedAt: string;
}

export interface RatingHistoryEntry {
  id: string;
  userId: string;
  matchId: string;
  instrument: InstrumentType;
  ratingBefore: number;
  ratingAfter: number;
  ratingChange: number;
  placement: number;
  songTitle: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Leaderboards
// ---------------------------------------------------------------------------

export interface LeaderboardEntry {
  position: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  gemRank: string;
  rating: number;
  provisional: boolean;
  rankedWins: number;
  rankedMatchesPlayed: number;
  winRate: number; // 0 - 100%
  instrument: InstrumentType | 'overall';
}

// ---------------------------------------------------------------------------
// Room Chat & Quick Reactions
// ---------------------------------------------------------------------------

export type MessageType = 'chat' | 'system' | 'reaction';

export interface RoomChatMessage {
  id: string;
  roomId: string;
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  content: string;
  messageType: MessageType;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Match Result Card & Sharing
// ---------------------------------------------------------------------------

export interface MatchShareData {
  gameName: 'PraiseTiles';
  songTitle: string;
  artist?: string | null;
  instrument: InstrumentType;
  roomMode: RoomMode;
  score: number;
  accuracy: number;
  highestCombo: number;
  placement: number;
  totalPlayers: number;
  ratingChange?: number | null;
  newRating?: number | null;
  timestamp: string;
}

export type { QuickReactionId, ReportReasonId, LeaderboardTabId } from '@/config/social';
