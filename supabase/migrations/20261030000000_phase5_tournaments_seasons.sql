-- =============================================================================
-- PraiseTiles — Phase 5: Tournaments, Competitive Events, Brackets & Seasons
-- Migration: 20261030000000_phase5_tournaments_seasons.sql
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tournament Organizers & Permissions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_organizers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role       TEXT NOT NULL CHECK (role IN ('platform_admin', 'approved_organizer')),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_organizers_user ON tournament_organizers(user_id);

ALTER TABLE tournament_organizers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament organizers"
  ON tournament_organizers FOR SELECT USING (TRUE);

CREATE POLICY "Only admins can manage tournament organizers"
  ON tournament_organizers FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM tournament_organizers WHERE role = 'platform_admin')
  );

-- -----------------------------------------------------------------------------
-- 2. Seasons Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seasons (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  season_number INT NOT NULL DEFAULT 1,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL CHECK (status IN ('upcoming', 'active', 'completed', 'archived')) DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view seasons"
  ON seasons FOR SELECT USING (TRUE);

-- Seed default active season
INSERT INTO seasons (id, name, season_number, start_at, end_at, status)
VALUES ('season-1', 'Season 1: Foundation of Praise', 1, '2026-01-01 00:00:00+00', '2026-12-31 23:59:59+00', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. Tournaments Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournaments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                  TEXT NOT NULL,
  slug                   TEXT NOT NULL UNIQUE,
  description            TEXT NOT NULL DEFAULT '',
  cover_image_url        TEXT NOT NULL,
  organizer_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type             TEXT NOT NULL CHECK (event_type IN ('official', 'community')) DEFAULT 'official',
  instrument             TEXT NOT NULL CHECK (instrument IN ('piano', 'guitar')) DEFAULT 'piano',
  capacity               INT NOT NULL CHECK (capacity IN (4, 8, 16)) DEFAULT 8,
  min_participants       INT NOT NULL DEFAULT 4,
  room_mode              TEXT NOT NULL CHECK (room_mode IN ('casual', 'ranked')) DEFAULT 'ranked',
  song_selection_policy  TEXT NOT NULL CHECK (song_selection_policy IN ('approved_pool', 'organizer_selected', 'voting')) DEFAULT 'approved_pool',
  status                 TEXT NOT NULL CHECK (
    status IN (
      'draft', 'published', 'registration_open', 'registration_closed',
      'check_in', 'bracket_ready', 'in_progress', 'paused', 'completed', 'cancelled'
    )
  ) DEFAULT 'published',
  registration_start_at  TIMESTAMPTZ NOT NULL,
  registration_end_at    TIMESTAMPTZ NOT NULL,
  check_in_start_at      TIMESTAMPTZ NOT NULL,
  check_in_end_at        TIMESTAMPTZ NOT NULL,
  start_at               TIMESTAMPTZ NOT NULL,
  cancellation_reason    TEXT,
  season_id              TEXT REFERENCES seasons(id) ON DELETE SET NULL,
  rules_text             TEXT NOT NULL DEFAULT '',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_start ON tournaments(start_at);
CREATE INDEX IF NOT EXISTS idx_tournaments_organizer ON tournaments(organizer_id);

ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published tournaments"
  ON tournaments FOR SELECT
  USING (status != 'draft' OR auth.uid() = organizer_id);

CREATE POLICY "Organizers can create and edit their tournaments"
  ON tournaments FOR ALL
  USING (auth.uid() = organizer_id);

-- -----------------------------------------------------------------------------
-- 4. Tournament Participants Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_participants (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id  UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL CHECK (
    status IN ('registered', 'checked_in', 'withdrawn', 'no_show', 'eliminated', 'champion')
  ) DEFAULT 'registered',
  seed           INT,
  placement      INT,
  registered_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_in_at  TIMESTAMPTZ,
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_tourney ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_participants_user ON tournament_participants(user_id);

ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament participants"
  ON tournament_participants FOR SELECT USING (TRUE);

CREATE POLICY "Users can manage their own registration"
  ON tournament_participants FOR ALL
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 5. Tournament Matches Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_matches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id         UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_index           INT NOT NULL,
  match_index_in_round  INT NOT NULL,
  round_name            TEXT NOT NULL,
  participant1_id       UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  participant2_id       UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  winner_participant_id UUID REFERENCES tournament_participants(id) ON DELETE SET NULL,
  next_match_id         UUID REFERENCES tournament_matches(id) ON DELETE SET NULL,
  room_id               UUID REFERENCES rooms(id) ON DELETE SET NULL,
  room_invite_code      TEXT,
  status                TEXT NOT NULL CHECK (
    status IN ('pending', 'ready', 'playing', 'completed', 'forfeited', 'disputed')
  ) DEFAULT 'pending',
  score1                INT DEFAULT 0,
  score2                INT DEFAULT 0,
  accuracy1             NUMERIC(5,2) DEFAULT 0.00,
  accuracy2             NUMERIC(5,2) DEFAULT 0.00,
  combo1                INT DEFAULT 0,
  combo2                INT DEFAULT 0,
  scheduled_start_at    TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tourney ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_room ON tournament_matches(room_id);

ALTER TABLE tournament_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view tournament matches"
  ON tournament_matches FOR SELECT USING (TRUE);

-- -----------------------------------------------------------------------------
-- 6. Tournament Disputes Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tournament_disputes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  match_id            UUID NOT NULL REFERENCES tournament_matches(id) ON DELETE CASCADE,
  filed_by_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason              TEXT NOT NULL CHECK (reason IN ('disconnection', 'desync', 'conduct', 'other')),
  description         TEXT NOT NULL,
  status              TEXT NOT NULL CHECK (status IN ('pending', 'upheld', 'rejected')) DEFAULT 'pending',
  resolution_notes    TEXT,
  resolved_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tournament_disputes_tourney ON tournament_disputes(tournament_id);

ALTER TABLE tournament_disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their disputes or organizers can view all"
  ON tournament_disputes FOR SELECT
  USING (
    auth.uid() = filed_by_user_id
    OR auth.uid() IN (SELECT organizer_id FROM tournaments WHERE id = tournament_id)
  );

CREATE POLICY "Participants can file disputes"
  ON tournament_disputes FOR INSERT
  WITH CHECK (auth.uid() = filed_by_user_id);

-- -----------------------------------------------------------------------------
-- 7. Season Standings Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS season_standings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id          TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_points  INT NOT NULL DEFAULT 0,
  tournaments_won    INT NOT NULL DEFAULT 0,
  tournaments_played INT NOT NULL DEFAULT 0,
  final_rank         INT,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_season_standings_season_pts ON season_standings(season_id, tournament_points DESC);

ALTER TABLE season_standings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view season standings"
  ON season_standings FOR SELECT USING (TRUE);

-- -----------------------------------------------------------------------------
-- 8. Achievements & Player Achievements
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS achievements (
  code        TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_name   TEXT NOT NULL,
  badge_tier  TEXT NOT NULL CHECK (badge_tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view achievements"
  ON achievements FOR SELECT USING (TRUE);

-- Seed achievements
INSERT INTO achievements (code, title, description, icon_name, badge_tier) VALUES
  ('first_tournament', 'First Step to Glory', 'Registered and competed in your first PraiseTiles tournament.', 'Award', 'bronze'),
  ('first_tournament_win', 'Victorious Note', 'Won your first tournament elimination match.', 'Flame', 'silver'),
  ('tournament_finalist', 'Grand Finalist', 'Advanced to the Championship Final in any tournament.', 'ShieldCheck', 'gold'),
  ('tournament_champion', 'Praise Champion', 'Crowned 1st Place Champion of an official PraiseTiles tournament.', 'Trophy', 'platinum'),
  ('five_tournaments', 'Dedicated Competitor', 'Participated in 5 or more completed tournaments.', 'Sparkles', 'silver'),
  ('clean_accuracy', 'Virtuoso Precision', 'Achieved 98%+ accuracy in a tournament match.', 'Music', 'gold')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS player_achievements (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_code TEXT NOT NULL REFERENCES achievements(code) ON DELETE CASCADE,
  tournament_id    UUID REFERENCES tournaments(id) ON DELETE SET NULL,
  unlocked_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_code)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_user ON player_achievements(user_id);

ALTER TABLE player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view unlocked achievements"
  ON player_achievements FOR SELECT USING (TRUE);

-- -----------------------------------------------------------------------------
-- 9. In-App Notifications
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  message    TEXT NOT NULL,
  type       TEXT NOT NULL,
  link_url   TEXT,
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view and manage their notifications"
  ON notifications FOR ALL
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 10. SECURITY DEFINER RPCs
-- -----------------------------------------------------------------------------

-- A. Register for Tournament
CREATE OR REPLACE FUNCTION register_tournament_participant(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tourney RECORD;
  v_reg_count INT;
  v_participant_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_tourney FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tourney.status NOT IN ('published', 'registration_open') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration is not open for this tournament');
  END IF;

  IF NOW() > v_tourney.registration_end_at THEN
    RETURN jsonb_build_object('success', false, 'error', 'Registration deadline has passed');
  END IF;

  SELECT COUNT(*) INTO v_reg_count
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id AND status != 'withdrawn';

  IF v_reg_count >= v_tourney.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament capacity reached');
  END IF;

  INSERT INTO tournament_participants (tournament_id, user_id, status)
  VALUES (p_tournament_id, v_user_id, 'registered')
  ON CONFLICT (tournament_id, user_id)
  DO UPDATE SET status = 'registered', registered_at = NOW()
  RETURNING id INTO v_participant_id;

  INSERT INTO notifications (user_id, title, message, type, link_url)
  VALUES (
    v_user_id,
    'Registration Confirmed',
    'You are registered for ' || v_tourney.title || '. Check-in begins before match start.',
    'registration',
    '/tournaments/' || v_tourney.slug
  );

  RETURN jsonb_build_object('success', true, 'participantId', v_participant_id);
END;
$$;

-- B. Check-in for Tournament
CREATE OR REPLACE FUNCTION check_in_tournament_participant(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_tourney RECORD;
  v_part RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  SELECT * INTO v_tourney FROM tournaments WHERE id = p_tournament_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  SELECT * INTO v_part FROM tournament_participants
  WHERE tournament_id = p_tournament_id AND user_id = v_user_id;

  IF NOT FOUND OR v_part.status = 'withdrawn' THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not registered for this tournament');
  END IF;

  IF v_part.status = 'checked_in' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already checked in');
  END IF;

  UPDATE tournament_participants
  SET status = 'checked_in', checked_in_at = NOW()
  WHERE id = v_part.id;

  RETURN jsonb_build_object('success', true, 'checkedInAt', NOW());
END;
$$;

-- C. Generate Single Elimination Bracket
CREATE OR REPLACE FUNCTION generate_single_elimination_bracket(p_tournament_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tourney RECORD;
  v_checked_in_count INT;
  v_capacity INT;
  v_participants RECORD;
  v_part_ids UUID[];
  v_final_id UUID;
  v_sf1_id UUID;
  v_sf2_id UUID;
  v_qf1_id UUID;
  v_qf2_id UUID;
  v_qf3_id UUID;
  v_qf4_id UUID;
BEGIN
  SELECT * INTO v_tourney FROM tournaments WHERE id = p_tournament_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tournament not found');
  END IF;

  IF v_tourney.status = 'bracket_ready' OR v_tourney.status = 'in_progress' OR v_tourney.status = 'completed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bracket already generated for this tournament');
  END IF;

  -- Freeze un-checked participants as no_show
  UPDATE tournament_participants
  SET status = 'no_show'
  WHERE tournament_id = p_tournament_id AND status = 'registered';

  -- Collect checked-in participants
  SELECT array_agg(id ORDER BY registered_at ASC) INTO v_part_ids
  FROM tournament_participants
  WHERE tournament_id = p_tournament_id AND status = 'checked_in';

  v_checked_in_count := coalesce(array_length(v_part_ids, 1), 0);
  IF v_checked_in_count < v_tourney.min_participants THEN
    UPDATE tournaments
    SET status = 'cancelled', cancellation_reason = 'Insufficient checked-in participants'
    WHERE id = p_tournament_id;
    RETURN jsonb_build_object('success', false, 'error', 'Cancelled due to minimum participant requirement');
  END IF;

  v_capacity := v_tourney.capacity;

  -- 4-Player Bracket: Semifinals (Round 1) -> Final (Round 2)
  IF v_capacity = 4 THEN
    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, status)
    VALUES (p_tournament_id, 2, 1, 'Championship Final', 'pending')
    RETURNING id INTO v_final_id;

    INSERT INTO tournament_matches (
      tournament_id, round_index, match_index_in_round, round_name,
      participant1_id, participant2_id, next_match_id, status
    ) VALUES
      (p_tournament_id, 1, 1, 'Semifinal 1', v_part_ids[1], v_part_ids[4], v_final_id, 'ready'),
      (p_tournament_id, 1, 2, 'Semifinal 2', v_part_ids[2], v_part_ids[3], v_final_id, 'ready');

  -- 8-Player Bracket: Quarterfinals (Round 1) -> Semifinals (Round 2) -> Final (Round 3)
  ELSIF v_capacity = 8 THEN
    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, status)
    VALUES (p_tournament_id, 3, 1, 'Championship Final', 'pending')
    RETURNING id INTO v_final_id;

    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, next_match_id, status)
    VALUES
      (p_tournament_id, 2, 1, 'Semifinal 1', v_final_id, 'pending'),
      (p_tournament_id, 2, 2, 'Semifinal 2', v_final_id, 'pending')
    RETURNING id INTO v_sf1_id;

    -- Fetch second SF id
    SELECT id INTO v_sf2_id FROM tournament_matches
    WHERE tournament_id = p_tournament_id AND round_index = 2 AND match_index_in_round = 2;

    INSERT INTO tournament_matches (
      tournament_id, round_index, match_index_in_round, round_name,
      participant1_id, participant2_id, next_match_id, status
    ) VALUES
      (p_tournament_id, 1, 1, 'Quarterfinal 1', v_part_ids[1], v_part_ids[8], v_sf1_id, 'ready'),
      (p_tournament_id, 1, 2, 'Quarterfinal 2', v_part_ids[4], v_part_ids[5], v_sf1_id, 'ready'),
      (p_tournament_id, 1, 3, 'Quarterfinal 3', v_part_ids[2], v_part_ids[7], v_sf2_id, 'ready'),
      (p_tournament_id, 1, 4, 'Quarterfinal 4', v_part_ids[3], v_part_ids[6], v_sf2_id, 'ready');

  -- 16-Player Bracket: Round of 16 (Round 1) -> Quarterfinals (Round 2) -> Semifinals (Round 3) -> Final (Round 4)
  ELSIF v_capacity = 16 THEN
    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, status)
    VALUES (p_tournament_id, 4, 1, 'Championship Final', 'pending')
    RETURNING id INTO v_final_id;

    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, next_match_id, status)
    VALUES
      (p_tournament_id, 3, 1, 'Semifinal 1', v_final_id, 'pending'),
      (p_tournament_id, 3, 2, 'Semifinal 2', v_final_id, 'pending');

    SELECT id INTO v_sf1_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 3 AND match_index_in_round = 1;
    SELECT id INTO v_sf2_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 3 AND match_index_in_round = 2;

    INSERT INTO tournament_matches (tournament_id, round_index, match_index_in_round, round_name, next_match_id, status)
    VALUES
      (p_tournament_id, 2, 1, 'Quarterfinal 1', v_sf1_id, 'pending'),
      (p_tournament_id, 2, 2, 'Quarterfinal 2', v_sf1_id, 'pending'),
      (p_tournament_id, 2, 3, 'Quarterfinal 3', v_sf2_id, 'pending'),
      (p_tournament_id, 2, 4, 'Quarterfinal 4', v_sf2_id, 'pending');

    SELECT id INTO v_qf1_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 2 AND match_index_in_round = 1;
    SELECT id INTO v_qf2_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 2 AND match_index_in_round = 2;
    SELECT id INTO v_qf3_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 2 AND match_index_in_round = 3;
    SELECT id INTO v_qf4_id FROM tournament_matches WHERE tournament_id = p_tournament_id AND round_index = 2 AND match_index_in_round = 4;

    INSERT INTO tournament_matches (
      tournament_id, round_index, match_index_in_round, round_name,
      participant1_id, participant2_id, next_match_id, status
    ) VALUES
      (p_tournament_id, 1, 1, 'Match 1', v_part_ids[1], v_part_ids[16], v_qf1_id, 'ready'),
      (p_tournament_id, 1, 2, 'Match 2', v_part_ids[8], v_part_ids[9],  v_qf1_id, 'ready'),
      (p_tournament_id, 1, 3, 'Match 3', v_part_ids[4], v_part_ids[13], v_qf2_id, 'ready'),
      (p_tournament_id, 1, 4, 'Match 4', v_part_ids[5], v_part_ids[12], v_qf2_id, 'ready'),
      (p_tournament_id, 1, 5, 'Match 5', v_part_ids[2], v_part_ids[15], v_qf3_id, 'ready'),
      (p_tournament_id, 1, 6, 'Match 6', v_part_ids[7], v_part_ids[10], v_qf3_id, 'ready'),
      (p_tournament_id, 1, 7, 'Match 7', v_part_ids[3], v_part_ids[14], v_qf4_id, 'ready'),
      (p_tournament_id, 1, 8, 'Match 8', v_part_ids[6], v_part_ids[11], v_qf4_id, 'ready');
  END IF;

  UPDATE tournaments
  SET status = 'bracket_ready', updated_at = NOW()
  WHERE id = p_tournament_id;

  RETURN jsonb_build_object('success', true, 'capacity', v_capacity, 'checkedInCount', v_checked_in_count);
END;
$$;

-- D. Advance Tournament Match Winner
CREATE OR REPLACE FUNCTION advance_tournament_match_winner(
  p_match_id UUID,
  p_winner_participant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match RECORD;
  v_next_match RECORD;
  v_tourney RECORD;
  v_loser_id UUID;
  v_winner_user_id UUID;
  v_loser_user_id UUID;
BEGIN
  SELECT * INTO v_match FROM tournament_matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Match not found');
  END IF;

  IF v_match.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Match already finalized');
  END IF;

  SELECT * INTO v_tourney FROM tournaments WHERE id = v_match.tournament_id;

  v_loser_id := CASE
    WHEN v_match.participant1_id = p_winner_participant_id THEN v_match.participant2_id
    ELSE v_match.participant1_id
  END;

  SELECT user_id INTO v_winner_user_id FROM tournament_participants WHERE id = p_winner_participant_id;
  SELECT user_id INTO v_loser_user_id FROM tournament_participants WHERE id = v_loser_id;

  -- Update current match
  UPDATE tournament_matches
  SET winner_participant_id = p_winner_participant_id,
      status = 'completed',
      completed_at = NOW()
  WHERE id = p_match_id;

  -- Mark loser as eliminated
  IF v_loser_id IS NOT NULL THEN
    UPDATE tournament_participants
    SET status = 'eliminated'
    WHERE id = v_loser_id;
  END IF;

  -- Check if Championship Final
  IF v_match.next_match_id IS NULL THEN
    UPDATE tournament_participants
    SET status = 'champion', placement = 1
    WHERE id = p_winner_participant_id;

    IF v_loser_id IS NOT NULL THEN
      UPDATE tournament_participants
      SET placement = 2
      WHERE id = v_loser_id;
    END IF;

    UPDATE tournaments
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_match.tournament_id;

    -- Award Champion Achievement
    INSERT INTO player_achievements (user_id, achievement_code, tournament_id)
    VALUES (v_winner_user_id, 'tournament_champion', v_match.tournament_id)
    ON CONFLICT (user_id, achievement_code) DO NOTHING;

    -- Award Finalist Achievement to both
    INSERT INTO player_achievements (user_id, achievement_code, tournament_id)
    VALUES (v_winner_user_id, 'tournament_finalist', v_match.tournament_id)
    ON CONFLICT (user_id, achievement_code) DO NOTHING;

    IF v_loser_user_id IS NOT NULL THEN
      INSERT INTO player_achievements (user_id, achievement_code, tournament_id)
      VALUES (v_loser_user_id, 'tournament_finalist', v_match.tournament_id)
      ON CONFLICT (user_id, achievement_code) DO NOTHING;
    END IF;

    -- Update seasonal standings
    IF v_tourney.season_id IS NOT NULL THEN
      INSERT INTO season_standings (season_id, user_id, tournament_points, tournaments_won, tournaments_played)
      VALUES (v_tourney.season_id, v_winner_user_id, 100, 1, 1)
      ON CONFLICT (season_id, user_id)
      DO UPDATE SET
        tournament_points = season_standings.tournament_points + 100,
        tournaments_won = season_standings.tournaments_won + 1,
        tournaments_played = season_standings.tournaments_played + 1;

      IF v_loser_user_id IS NOT NULL THEN
        INSERT INTO season_standings (season_id, user_id, tournament_points, tournaments_won, tournaments_played)
        VALUES (v_tourney.season_id, v_loser_user_id, 60, 0, 1)
        ON CONFLICT (season_id, user_id)
        DO UPDATE SET
          tournament_points = season_standings.tournament_points + 60,
          tournaments_played = season_standings.tournaments_played + 1;
      END IF;
    END IF;

    RETURN jsonb_build_object('success', true, 'isFinal', true, 'championId', p_winner_participant_id);
  END IF;

  -- Advance to next match
  SELECT * INTO v_next_match FROM tournament_matches WHERE id = v_match.next_match_id FOR UPDATE;

  IF v_next_match.participant1_id IS NULL THEN
    UPDATE tournament_matches
    SET participant1_id = p_winner_participant_id
    WHERE id = v_match.next_match_id;
  ELSIF v_next_match.participant2_id IS NULL THEN
    UPDATE tournament_matches
    SET participant2_id = p_winner_participant_id,
        status = 'ready'
    WHERE id = v_match.next_match_id;
  END IF;

  -- Award first tournament win achievement
  INSERT INTO player_achievements (user_id, achievement_code, tournament_id)
  VALUES (v_winner_user_id, 'first_tournament_win', v_match.tournament_id)
  ON CONFLICT (user_id, achievement_code) DO NOTHING;

  RETURN jsonb_build_object('success', true, 'advancedToMatchId', v_match.next_match_id);
END;
$$;
