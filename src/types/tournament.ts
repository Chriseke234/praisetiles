/**
 * Phase 5 Tournament, Bracket, Season & Reward Domain Types
 */

import { InstrumentType } from './game';
import { RoomMode } from './social';
import {
  TournamentCapacity,
  TournamentRole,
  TournamentStatus,
  ParticipantStatus,
  TournamentMatchStatus,
  SongSelectionPolicy,
  DisputeReason,
  AchievementCode,
} from '@/config/tournament';

export interface Tournament {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImageUrl: string;
  organizerId: string;
  organizerDisplayName: string;
  organizerRole: TournamentRole;
  eventType: 'official' | 'community';
  instrument: InstrumentType;
  capacity: TournamentCapacity;
  minParticipants: number;
  roomMode: RoomMode;
  songSelectionPolicy: SongSelectionPolicy;
  status: TournamentStatus;
  registrationStartAt: string;
  registrationEndAt: string;
  checkInStartAt: string;
  checkInEndAt: string;
  startAt: string;
  cancellationReason?: string | null;
  seasonId?: string | null;
  rulesText: string;
  registeredCount: number;
  checkedInCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TournamentParticipant {
  id: string;
  tournamentId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  gemRank: string;
  rating?: number;
  status: ParticipantStatus;
  seed?: number | null;
  placement?: number | null;
  registeredAt: string;
  checkedInAt?: string | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  roundIndex: number;
  matchIndexInRound: number;
  roundName: string;
  participant1?: TournamentParticipant | null;
  participant2?: TournamentParticipant | null;
  winnerParticipantId?: string | null;
  nextMatchId?: string | null;
  roomId?: string | null;
  roomInviteCode?: string | null;
  status: TournamentMatchStatus;
  score1?: number | null;
  score2?: number | null;
  accuracy1?: number | null;
  accuracy2?: number | null;
  combo1?: number | null;
  combo2?: number | null;
  scheduledStartAt?: string | null;
  completedAt?: string | null;
}

export interface TournamentBracket {
  tournamentId: string;
  capacity: TournamentCapacity;
  rounds: {
    roundIndex: number;
    roundName: string;
    matches: TournamentMatch[];
  }[];
  champion?: TournamentParticipant | null;
}

export interface TournamentDispute {
  id: string;
  tournamentId: string;
  matchId: string;
  filedByUserId: string;
  filedByDisplayName: string;
  reason: DisputeReason;
  description: string;
  status: 'pending' | 'upheld' | 'rejected';
  resolutionNotes?: string | null;
  resolvedByUserId?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface Season {
  id: string;
  name: string;
  seasonNumber: number;
  startAt: string;
  endAt: string;
  status: 'upcoming' | 'active' | 'completed' | 'archived';
  totalTournaments: number;
}

export interface SeasonStanding {
  seasonId: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  gemRank: string;
  tournamentPoints: number;
  tournamentsWon: number;
  tournamentsPlayed: number;
  finalRank?: number | null;
}

export interface Achievement {
  code: AchievementCode;
  title: string;
  description: string;
  iconName: string;
  badgeTier: 'bronze' | 'silver' | 'gold' | 'platinum';
}

export interface PlayerAchievement {
  id: string;
  userId: string;
  achievementCode: AchievementCode;
  tournamentId?: string | null;
  unlockedAt: string;
}

export type NotificationType =
  | 'registration'
  | 'checkin'
  | 'match'
  | 'dispute'
  | 'achievement'
  | 'tournament_update';

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

export type {
  TournamentCapacity,
  TournamentRole,
  TournamentStatus,
  ParticipantStatus,
  TournamentMatchStatus,
  SongSelectionPolicy,
  DisputeReason,
  AchievementCode,
} from '@/config/tournament';
