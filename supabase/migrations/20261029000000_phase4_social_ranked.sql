-- ============================================================
-- PraiseTiles Phase 4 Migration: Public Multiplayer, Social & Ranked
-- File: 20261029000000_phase4_social_ranked.sql
--
-- IMPORTANT — Supabase SQL Editor usage:
--   Run each numbered block separately.
--   Ensure NO text is selected before clicking Run.
--   Uses CASE expressions; no top-level IF statements.
-- ============================================================


-- ============================================================
-- BLOCK 1: Alter Rooms & Create New Phase 4 Tables
-- ============================================================

-- Extend rooms table for public lobbies & 8-16 capacity
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS room_mode TEXT NOT NULL DEFAULT 'casual'
    CHECK (room_mode IN ('casual', 'ranked')),
  ADD COLUMN IF NOT EXISTS max_active_players INT NOT NULL DEFAULT 4;

-- Extend room_participants for active seats vs spectator/waiting list
ALTER TABLE public.room_participants
  ADD COLUMN IF NOT EXISTS is_active_player BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS seat_index INT;

-- ----------------------------------------------------------------
-- matchmaking_queue
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.matchmaking_queue (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  mode               TEXT NOT NULL DEFAULT 'casual' CHECK (mode IN ('casual', 'ranked')),
  instrument         TEXT NOT NULL DEFAULT 'piano' CHECK (instrument IN ('piano', 'guitar')),
  rating             INT NOT NULL DEFAULT 1000,
  rating_range       INT NOT NULL DEFAULT 100,
  status             TEXT NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'matched', 'cancelled')),
  matched_room_id    UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  matched_invite_code TEXT,
  queued_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- friendships
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.friendships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friend_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, friend_id),
  CONSTRAINT no_self_friend CHECK (user_id <> friend_id)
);

-- ----------------------------------------------------------------
-- follows
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

-- ----------------------------------------------------------------
-- user_blocks
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT no_self_block CHECK (blocker_id <> blocked_id)
);

-- ----------------------------------------------------------------
-- user_reports
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL,
  details      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- room_invitations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- ----------------------------------------------------------------
-- competitive_ratings
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.competitive_ratings (
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument             TEXT NOT NULL CHECK (instrument IN ('piano', 'guitar', 'overall')),
  rating                 INT NOT NULL DEFAULT 1000,
  provisional            BOOLEAN NOT NULL DEFAULT TRUE,
  ranked_matches_played  INT NOT NULL DEFAULT 0,
  ranked_wins            INT NOT NULL DEFAULT 0,
  best_rating            INT NOT NULL DEFAULT 1000,
  season_id              TEXT NOT NULL DEFAULT 'season-1',
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, instrument, season_id)
);

-- ----------------------------------------------------------------
-- rating_history
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rating_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id         UUID NOT NULL REFERENCES public.room_matches(id) ON DELETE CASCADE,
  instrument       TEXT NOT NULL,
  rating_before    INT NOT NULL,
  rating_after     INT NOT NULL,
  rating_change    INT NOT NULL,
  placement        INT NOT NULL,
  formula_version  TEXT NOT NULL DEFAULT '1.0.0',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- room_messages (chat & quick reactions)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 280),
  message_type TEXT NOT NULL DEFAULT 'chat'
                 CHECK (message_type IN ('chat', 'system', 'reaction')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- Indexes for performance
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_public_status   ON public.rooms(is_public, status);
CREATE INDEX IF NOT EXISTS idx_queue_matching        ON public.matchmaking_queue(mode, instrument, status, rating);
CREATE INDEX IF NOT EXISTS idx_friendships_user      ON public.friendships(user_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_friend    ON public.friendships(friend_id, status);
CREATE INDEX IF NOT EXISTS idx_follows_following     ON public.follows(following_id);
CREATE INDEX IF NOT EXISTS idx_blocks_pair           ON public.user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_invitations_receiver  ON public.room_invitations(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_comp_rating_rank      ON public.competitive_ratings(instrument, season_id, rating DESC);
CREATE INDEX IF NOT EXISTS idx_rating_history_user   ON public.rating_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_room_messages_room    ON public.room_messages(room_id, created_at ASC);


-- ============================================================
-- BLOCK 2: Row Level Security (RLS) Policies
-- ============================================================

ALTER TABLE public.matchmaking_queue   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_blocks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_invitations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitive_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rating_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_messages       ENABLE ROW LEVEL SECURITY;

-- ---- matchmaking_queue ----
DROP POLICY IF EXISTS "queue_select_own" ON public.matchmaking_queue;
CREATE POLICY "queue_select_own" ON public.matchmaking_queue
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "queue_all_trusted_functions" ON public.matchmaking_queue;
CREATE POLICY "queue_all_trusted_functions" ON public.matchmaking_queue
  FOR ALL USING (auth.uid() = user_id);

-- ---- friendships ----
DROP POLICY IF EXISTS "friendships_select" ON public.friendships;
CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

DROP POLICY IF EXISTS "friendships_delete" ON public.friendships;
CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ---- follows ----
DROP POLICY IF EXISTS "follows_select" ON public.follows;
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (TRUE); -- public visibility

DROP POLICY IF EXISTS "follows_insert" ON public.follows;
CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "follows_delete" ON public.follows;
CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ---- user_blocks ----
DROP POLICY IF EXISTS "blocks_select_own" ON public.user_blocks;
CREATE POLICY "blocks_select_own" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_insert_own" ON public.user_blocks;
CREATE POLICY "blocks_insert_own" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

DROP POLICY IF EXISTS "blocks_delete_own" ON public.user_blocks;
CREATE POLICY "blocks_delete_own" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- ---- user_reports ----
DROP POLICY IF EXISTS "reports_insert_own" ON public.user_reports;
CREATE POLICY "reports_insert_own" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---- room_invitations ----
DROP POLICY IF EXISTS "invites_select" ON public.room_invitations;
CREATE POLICY "invites_select" ON public.room_invitations
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "invites_insert" ON public.room_invitations;
CREATE POLICY "invites_insert" ON public.room_invitations
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "invites_update" ON public.room_invitations;
CREATE POLICY "invites_update" ON public.room_invitations
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ---- competitive_ratings ----
DROP POLICY IF EXISTS "comp_ratings_select_all" ON public.competitive_ratings;
CREATE POLICY "comp_ratings_select_all" ON public.competitive_ratings
  FOR SELECT USING (TRUE); -- leaderboards need to read all

-- Direct updates to competitive rating are disallowed (only through SECURITY DEFINER RPCs)
DROP POLICY IF EXISTS "comp_ratings_no_direct_update" ON public.competitive_ratings;
CREATE POLICY "comp_ratings_no_direct_update" ON public.competitive_ratings
  FOR UPDATE USING (FALSE);

-- ---- rating_history ----
DROP POLICY IF EXISTS "rating_history_select" ON public.rating_history;
CREATE POLICY "rating_history_select" ON public.rating_history
  FOR SELECT USING (TRUE);

-- ---- room_messages ----
DROP POLICY IF EXISTS "room_messages_select_participant" ON public.room_messages;
CREATE POLICY "room_messages_select_participant" ON public.room_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "room_messages_insert_participant" ON public.room_messages;
CREATE POLICY "room_messages_insert_participant" ON public.room_messages
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );


-- ============================================================
-- BLOCK 3: Public Room Creation & Discovery Functions
-- ============================================================

-- ----------------------------------------------------------------
-- create_public_room
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_public_room(
  p_name             TEXT,
  p_instrument       TEXT DEFAULT 'piano',
  p_room_mode        TEXT DEFAULT 'casual',
  p_max_participants INT DEFAULT 8
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_pub_room$
DECLARE
  v_user_id      UUID;
  v_invite_code  TEXT;
  v_room_id      UUID;
  v_safe_cap     INT;
  v_room_name    TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate capacity bounds (8 to 16)
  v_safe_cap := GREATEST(8, LEAST(16, COALESCE(p_max_participants, 8)));
  v_room_name := COALESCE(NULLIF(trim(p_name), ''), 'Gospel Praise Arena');

  -- Generate unique 8-character invite code
  LOOP
    v_invite_code := upper(substring(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    WHILE length(v_invite_code) < 8 LOOP
      v_invite_code := v_invite_code || upper(substring(encode(gen_random_bytes(2), 'base64') FROM 1 FOR 1));
      v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    END LOOP;
    v_invite_code := left(v_invite_code, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE invite_code = v_invite_code);
  END LOOP;

  -- Insert public room
  INSERT INTO public.rooms (
    name, invite_code, host_id, instrument, room_mode,
    is_public, max_participants, max_active_players
  )
  VALUES (
    v_room_name, v_invite_code, v_user_id, p_instrument, p_room_mode,
    TRUE, v_safe_cap, 4
  )
  RETURNING id INTO v_room_id;

  -- Add host as first active participant (seat 0)
  INSERT INTO public.room_participants (room_id, user_id, is_host, is_active_player, seat_index)
  VALUES (v_room_id, v_user_id, TRUE, TRUE, 0);

  RETURN json_build_object(
    'room_id',     v_room_id,
    'invite_code', v_invite_code,
    'name',        v_room_name
  );
END;
$create_pub_room$;

-- ----------------------------------------------------------------
-- join_public_room
-- Atomic seat allocation: assigns up to 4 active players,
-- remainder assigned as waiting/spectator participants.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_public_room(
  p_room_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $join_pub_room$
DECLARE
  v_user_id           UUID;
  v_room_status       TEXT;
  v_max_part          INT;
  v_max_active        INT;
  v_current_total     INT;
  v_current_active    INT;
  v_is_active         BOOLEAN;
  v_seat_index        INT := NULL;
  v_invite_code       TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user is not blocked by host
  IF EXISTS (
    SELECT 1 FROM public.user_blocks b
    JOIN public.rooms r ON r.id = p_room_id
    WHERE b.blocker_id = r.host_id AND b.blocked_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unable to join this room';
  END IF;

  -- Check room availability
  SELECT status, max_participants, max_active_players, invite_code
  INTO v_room_status, v_max_part, v_max_active, v_invite_code
  FROM public.rooms
  WHERE id = p_room_id AND expires_at > NOW();

  IF v_room_status IS NULL THEN
    RAISE EXCEPTION 'Room not found or expired';
  END IF;

  IF v_room_status = 'closed' THEN
    RAISE EXCEPTION 'Room is closed';
  END IF;

  -- Total participant count
  SELECT COUNT(*) INTO v_current_total
  FROM public.room_participants
  WHERE room_id = p_room_id;

  IF v_current_total >= v_max_part AND NOT EXISTS (
    SELECT 1 FROM public.room_participants WHERE room_id = p_room_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Room is full (% / % players)', v_current_total, v_max_part;
  END IF;

  -- Count currently assigned active players
  SELECT COUNT(*) INTO v_current_active
  FROM public.room_participants
  WHERE room_id = p_room_id AND is_active_player = TRUE;

  -- If match is already playing, new participants join as waiting spectators
  IF v_room_status IN ('playing', 'countdown') THEN
    v_is_active := FALSE;
  ELSE
    v_is_active := (v_current_active < v_max_active);
    v_seat_index := CASE WHEN v_is_active THEN v_current_active ELSE NULL END;
  END IF;

  -- Upsert participant atomically
  INSERT INTO public.room_participants (
    room_id, user_id, is_host, is_connected, is_active_player, seat_index
  )
  VALUES (
    p_room_id, v_user_id, FALSE, TRUE, v_is_active, v_seat_index
  )
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET is_connected = TRUE;

  RETURN json_build_object(
    'room_id',          p_room_id,
    'invite_code',      v_invite_code,
    'is_active_player', v_is_active,
    'seat_index',       v_seat_index
  );
END;
$join_pub_room$;


-- ============================================================
-- BLOCK 4: Quick Play Matchmaking Atomic Allocator
-- ============================================================

-- ----------------------------------------------------------------
-- queue_for_matchmaking
-- Enters player into matchmaking_queue atomically.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.queue_for_matchmaking(
  p_mode       TEXT,
  p_instrument TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $queue_mm$
DECLARE
  v_user_id      UUID;
  v_user_rating  INT := 1000;
  v_queue_id     UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Retrieve competitive rating for ranked
  IF p_mode = 'ranked' THEN
    SELECT rating INTO v_user_rating
    FROM public.competitive_ratings
    WHERE user_id = v_user_id AND instrument = p_instrument AND season_id = 'season-1';

    IF v_user_rating IS NULL THEN
      -- Seed initial rating
      INSERT INTO public.competitive_ratings (user_id, instrument, rating, season_id)
      VALUES (v_user_id, p_instrument, 1000, 'season-1')
      ON CONFLICT DO NOTHING;
      v_user_rating := 1000;
    END IF;
  END IF;

  -- Upsert queue entry (idempotent)
  INSERT INTO public.matchmaking_queue (
    user_id, mode, instrument, rating, status, queued_at, heartbeat_at
  )
  VALUES (
    v_user_id, p_mode, p_instrument, v_user_rating, 'queued', NOW(), NOW()
  )
  ON CONFLICT (user_id) DO UPDATE
    SET mode = p_mode,
        instrument = p_instrument,
        rating = v_user_rating,
        status = 'queued',
        matched_room_id = NULL,
        matched_invite_code = NULL,
        heartbeat_at = NOW()
  RETURNING id INTO v_queue_id;

  RETURN json_build_object(
    'queue_id', v_queue_id,
    'status',   'queued'
  );
END;
$queue_mm$;

-- ----------------------------------------------------------------
-- cancel_matchmaking
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_matchmaking()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $cancel_mm$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  DELETE FROM public.matchmaking_queue
  WHERE user_id = v_user_id AND status = 'queued';

  RETURN TRUE;
END;
$cancel_mm$;

-- ----------------------------------------------------------------
-- atomic_matchmaker
-- Assembles up to 4 compatible queued players into a public match.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.atomic_matchmaker(
  p_mode       TEXT,
  p_instrument TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $atomic_mm$
DECLARE
  v_candidates      UUID[];
  v_host_id         UUID;
  v_room_id         UUID;
  v_invite_code     TEXT;
  v_room_name       TEXT;
BEGIN
  -- Remove stale queue entries older than 30s
  DELETE FROM public.matchmaking_queue
  WHERE heartbeat_at < NOW() - INTERVAL '30 seconds';

  -- Select up to 4 eligible players ordered by queue duration
  SELECT array_agg(user_id)
  INTO v_candidates
  FROM (
    SELECT user_id
    FROM public.matchmaking_queue
    WHERE mode = p_mode
      AND instrument = p_instrument
      AND status = 'queued'
    ORDER BY queued_at ASC
    LIMIT 4
    FOR UPDATE SKIP LOCKED
  ) sub;

  -- Require at least 2 players to form a quick match
  IF v_candidates IS NULL OR array_length(v_candidates, 1) < 2 THEN
    RETURN json_build_object('matched', FALSE);
  END IF;

  v_host_id := v_candidates[1];
  v_room_name := 'Quick Play: ' || upper(p_instrument) || ' (' || upper(p_mode) || ')';

  -- Generate unique invite code
  LOOP
    v_invite_code := upper(substring(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    WHILE length(v_invite_code) < 8 LOOP
      v_invite_code := v_invite_code || upper(substring(encode(gen_random_bytes(2), 'base64') FROM 1 FOR 1));
      v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    END LOOP;
    v_invite_code := left(v_invite_code, 8);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE invite_code = v_invite_code);
  END LOOP;

  -- Create room
  INSERT INTO public.rooms (
    name, invite_code, host_id, instrument, room_mode,
    is_public, max_participants, max_active_players
  )
  VALUES (
    v_room_name, v_invite_code, v_host_id, p_instrument, p_mode,
    FALSE, 8, 4
  )
  RETURNING id INTO v_room_id;

  -- Insert matched participants
  FOR i IN 1..array_length(v_candidates, 1) LOOP
    INSERT INTO public.room_participants (
      room_id, user_id, is_host, is_active_player, seat_index
    )
    VALUES (
      v_room_id, v_candidates[i], (i = 1), TRUE, (i - 1)
    );

    -- Update queue status
    UPDATE public.matchmaking_queue
    SET status = 'matched',
        matched_room_id = v_room_id,
        matched_invite_code = v_invite_code
    WHERE user_id = v_candidates[i];
  END LOOP;

  RETURN json_build_object(
    'matched',     TRUE,
    'room_id',     v_room_id,
    'invite_code', v_invite_code,
    'player_count', array_length(v_candidates, 1)
  );
END;
$atomic_mm$;


-- ============================================================
-- BLOCK 5: Multiplayer Elo Rating Calculation & Moderation
-- ============================================================

-- ----------------------------------------------------------------
-- calculate_ranked_elo
-- Multi-player Elo calculation applied when ranked match finalizes.
-- Placements: 1st (S=1.0), 2nd (S=0.66), 3rd (S=0.33), 4th (S=0.0).
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calculate_ranked_elo(
  p_match_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $calc_elo$
DECLARE
  v_instrument      TEXT;
  v_is_casual       BOOLEAN;
  v_room_mode       TEXT;
  v_rec             RECORD;
  v_opp_rec         RECORD;
  v_k               INT;
  v_actual_score    NUMERIC;
  v_expected_score  NUMERIC;
  v_total_expected  NUMERIC;
  v_delta           INT;
  v_new_rating      INT;
  v_curr_rating     INT;
  v_matches_played  INT;
  v_wins            INT;
  v_is_provisional  BOOLEAN;
  v_player_count    INT;
BEGIN
  -- Verify match mode
  SELECT rm.instrument, rm.is_casual, r.room_mode
  INTO v_instrument, v_is_casual, v_room_mode
  FROM public.room_matches rm
  JOIN public.rooms r ON r.id = rm.room_id
  WHERE rm.id = p_match_id;

  -- Only calculate for ranked mode
  IF v_room_mode <> 'ranked' OR v_is_casual = TRUE THEN
    RETURN json_build_object('applied', FALSE, 'reason', 'casual_match');
  END IF;

  SELECT COUNT(*) INTO v_player_count
  FROM public.match_participants
  WHERE match_id = p_match_id AND submitted_at IS NOT NULL;

  IF v_player_count < 2 THEN
    RETURN json_build_object('applied', FALSE, 'reason', 'insufficient_participants');
  END IF;

  -- Iterate through each participant who finished
  FOR v_rec IN (
    SELECT user_id, placement, score
    FROM public.match_participants
    WHERE match_id = p_match_id AND submitted_at IS NOT NULL
  ) LOOP
    -- Fetch or initialize player's competitive rating
    SELECT rating, ranked_matches_played, ranked_wins, provisional
    INTO v_curr_rating, v_matches_played, v_wins, v_is_provisional
    FROM public.competitive_ratings
    WHERE user_id = v_rec.user_id AND instrument = v_instrument AND season_id = 'season-1';

    IF v_curr_rating IS NULL THEN
      v_curr_rating := 1000;
      v_matches_played := 0;
      v_wins := 0;
      v_is_provisional := TRUE;
      INSERT INTO public.competitive_ratings (user_id, instrument, rating, season_id)
      VALUES (v_rec.user_id, v_instrument, 1000, 'season-1')
      ON CONFLICT DO NOTHING;
    END IF;

    -- Assign placement actual score: 1st = 1.0, 2nd = 0.66, 3rd = 0.33, 4th = 0.0
    v_actual_score := CASE
      WHEN v_rec.placement = 1 THEN 1.0
      WHEN v_rec.placement = 2 THEN 0.66
      WHEN v_rec.placement = 3 THEN 0.33
      ELSE 0.0
    END;

    -- Compute pairwise expected scores against all opponents
    v_total_expected := 0;
    FOR v_opp_rec IN (
      SELECT mp.user_id, COALESCE(cr.rating, 1000) AS opp_rating
      FROM public.match_participants mp
      LEFT JOIN public.competitive_ratings cr
        ON cr.user_id = mp.user_id AND cr.instrument = v_instrument AND cr.season_id = 'season-1'
      WHERE mp.match_id = p_match_id
        AND mp.user_id <> v_rec.user_id
        AND mp.submitted_at IS NOT NULL
    ) LOOP
      -- Standard logistic curve: E = 1 / (1 + 10^((opp - curr) / 400))
      v_expected_score := 1.0 / (1.0 + power(10.0, (v_opp_rec.opp_rating - v_curr_rating)::NUMERIC / 400.0));
      v_total_expected := v_total_expected + v_expected_score;
    END LOOP;

    -- Average expected score
    v_total_expected := v_total_expected / (v_player_count - 1)::NUMERIC;

    -- K-factor selection
    v_k := CASE WHEN v_is_provisional THEN 32 ELSE 16 END;

    -- Delta = K * (Actual - Expected)
    v_delta := round(v_k::NUMERIC * (v_actual_score - v_total_expected));

    v_new_rating := GREATEST(100, v_curr_rating + v_delta);
    v_matches_played := v_matches_played + 1;
    v_wins := CASE WHEN v_rec.placement = 1 THEN v_wins + 1 ELSE v_wins END;
    v_is_provisional := (v_matches_played < 10);

    -- Update competitive rating
    UPDATE public.competitive_ratings
    SET rating = v_new_rating,
        ranked_matches_played = v_matches_played,
        ranked_wins = v_wins,
        best_rating = GREATEST(best_rating, v_new_rating),
        provisional = v_is_provisional,
        updated_at = NOW()
    WHERE user_id = v_rec.user_id AND instrument = v_instrument AND season_id = 'season-1';

    -- Record rating history entry
    INSERT INTO public.rating_history (
      user_id, match_id, instrument, rating_before, rating_after,
      rating_change, placement, formula_version
    )
    VALUES (
      v_rec.user_id, p_match_id, v_instrument, v_curr_rating, v_new_rating,
      v_delta, v_rec.placement, '1.0.0'
    );
  END LOOP;

  RETURN json_build_object('applied', TRUE, 'participants_updated', v_player_count);
END;
$calc_elo$;
