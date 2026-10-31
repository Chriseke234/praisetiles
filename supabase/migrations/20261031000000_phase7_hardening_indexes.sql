-- ============================================================================
-- Phase 7: Production Hardening, Composite Indexes & Data Integrity
-- File: supabase/migrations/20261031000000_phase7_hardening_indexes.sql
-- ============================================================================

-- 1. Rooms & Discovery Performance
CREATE INDEX IF NOT EXISTS idx_rooms_status_public
  ON public.rooms(status, is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_rooms_audio_expires
  ON public.rooms(audio_expires_at)
  WHERE audio_storage_path IS NOT NULL;

-- 2. Room Matches & Realtime Scoring
CREATE INDEX IF NOT EXISTS idx_room_matches_room_status
  ON public.room_matches(room_id, status);

CREATE INDEX IF NOT EXISTS idx_match_participants_match_score
  ON public.match_participants(match_id, score DESC);

-- 3. Competitive Leaderboards & Profiles
CREATE INDEX IF NOT EXISTS idx_competitive_ratings_rating
  ON public.competitive_ratings(rating DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_user_created
  ON public.match_history(user_id, created_at DESC);

-- 4. Tournaments & Brackets
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status
  ON public.tournament_participants(tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket
  ON public.tournament_matches(tournament_id, round_index, match_index_in_round);

CREATE INDEX IF NOT EXISTS idx_season_standings_rank
  ON public.season_standings(season_id, tournament_points DESC);

-- 5. Social & Moderation Indexes
CREATE INDEX IF NOT EXISTS idx_friendships_lookup
  ON public.friendships(user_id, friend_id, status);

CREATE INDEX IF NOT EXISTS idx_user_reports_reported
  ON public.user_reports(reported_id, created_at DESC);
