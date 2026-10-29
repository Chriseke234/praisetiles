-- ============================================================================
-- Phase 7: Production Hardening, Composite Indexes & Data Integrity
-- File: supabase/migrations/20261031000000_phase7_hardening_indexes.sql
-- ============================================================================

-- 1. Rooms & Discovery Performance
CREATE INDEX IF NOT EXISTS idx_rooms_status_public
  ON rooms(status, is_public)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_rooms_audio_expires
  ON rooms(audio_expires_at)
  WHERE audio_storage_path IS NOT NULL;

-- 2. Room Matches & Realtime Scoring
CREATE INDEX IF NOT EXISTS idx_room_matches_room_status
  ON room_matches(room_id, status);

CREATE INDEX IF NOT EXISTS idx_match_scores_match_score
  ON match_scores(match_id, score DESC);

-- 3. Competitive Leaderboards & Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_competitive_rating
  ON profiles(competitive_rating DESC);

CREATE INDEX IF NOT EXISTS idx_match_history_user_completed
  ON match_history(user_id, completed_at DESC);

-- 4. Tournaments & Brackets
CREATE INDEX IF NOT EXISTS idx_tournament_participants_status
  ON tournament_participants(tournament_id, status);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_bracket
  ON tournament_matches(tournament_id, round, match_order);

CREATE INDEX IF NOT EXISTS idx_season_standings_rank
  ON season_standings(season_id, tournament_points DESC);

-- 5. Social & Moderation Indexes
CREATE INDEX IF NOT EXISTS idx_friendships_lookup
  ON friendships(user_id, friend_id, status);

CREATE INDEX IF NOT EXISTS idx_reports_status
  ON reports(status, created_at DESC);
