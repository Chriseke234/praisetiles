-- PraiseTiles Gospel Rhythm Game
-- Migration: 20261027000000_phase2_auth_progression.sql
-- Description: Sets up profiles, player_progress, player_stats, match_history, RLS, and secure match processing function.

-- ============================================================================
-- BLOCK 1: TABLES AND INDEXES
-- ============================================================================

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  is_public BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT username_length_check CHECK (char_length(username) >= 3 AND char_length(username) <= 24),
  CONSTRAINT username_format_check CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_idx ON public.profiles (lower(username));

-- 2. Player Progress Table
CREATE TABLE IF NOT EXISTS public.player_progress (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0 NOT NULL CHECK (xp >= 0),
  level INTEGER DEFAULT 1 NOT NULL CHECK (level >= 1),
  gem_rank TEXT DEFAULT 'Quartz' NOT NULL CHECK (gem_rank IN ('Quartz', 'Jade', 'Sapphire', 'Ruby', 'Diamond')),
  qualifying_completed_songs INTEGER DEFAULT 0 NOT NULL CHECK (qualifying_completed_songs >= 0),
  version TEXT DEFAULT '1.0.0' NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Player Stats Table
CREATE TABLE IF NOT EXISTS public.player_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_attempts INTEGER DEFAULT 0 NOT NULL,
  completed_songs INTEGER DEFAULT 0 NOT NULL,
  best_score INTEGER DEFAULT 0 NOT NULL,
  best_accuracy NUMERIC(5,2) DEFAULT 0.00 NOT NULL,
  highest_combo INTEGER DEFAULT 0 NOT NULL,
  piano_attempts INTEGER DEFAULT 0 NOT NULL,
  piano_completed INTEGER DEFAULT 0 NOT NULL,
  piano_best_score INTEGER DEFAULT 0 NOT NULL,
  guitar_attempts INTEGER DEFAULT 0 NOT NULL,
  guitar_completed INTEGER DEFAULT 0 NOT NULL,
  guitar_best_score INTEGER DEFAULT 0 NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Match History Table
CREATE TABLE IF NOT EXISTS public.match_history (
  id UUID PRIMARY KEY, -- Idempotency key generated per run
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL CHECK (instrument IN ('piano', 'guitar')),
  song_title TEXT NOT NULL,
  song_fingerprint TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0),
  accuracy NUMERIC(5,2) NOT NULL CHECK (accuracy >= 0 AND accuracy <= 100),
  highest_combo INTEGER NOT NULL CHECK (highest_combo >= 0),
  elapsed_time NUMERIC(6,2) NOT NULL CHECK (elapsed_time >= 0),
  completed BOOLEAN NOT NULL,
  failure_reason TEXT,
  rules_version TEXT DEFAULT '1.0.0' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS match_history_user_id_idx ON public.match_history (user_id, created_at DESC);

-- ============================================================================
-- BLOCK 2: ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_history ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (is_public = true OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own permitted profile fields" ON public.profiles;
CREATE POLICY "Users can update their own permitted profile fields"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Player Progress Policies: READ-ONLY for users; direct modification disallowed
DROP POLICY IF EXISTS "Users can view their own progress" ON public.player_progress;
CREATE POLICY "Users can view their own progress"
  ON public.player_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Player Stats Policies: Users can view own stats or public profile stats
DROP POLICY IF EXISTS "Users can view stats" ON public.player_stats;
CREATE POLICY "Users can view stats"
  ON public.player_stats FOR SELECT
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = player_stats.user_id AND profiles.is_public = true)
  );

-- Match History Policies: Users can view their own matches
DROP POLICY IF EXISTS "Users can view their own match history" ON public.match_history;
CREATE POLICY "Users can view their own match history"
  ON public.match_history FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert match records for themselves" ON public.match_history;
CREATE POLICY "Users can insert match records for themselves"
  ON public.match_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- BLOCK 3: AUTH TRIGGER FOR AUTOMATIC PROFILE INITIALIZATION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $trigger$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, avatar_url, is_public)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', 'praiser_' || substr(NEW.id::text, 1, 8)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', COALESCE(NEW.raw_user_meta_data->>'username', 'praiser_' || substr(NEW.id::text, 1, 8))),
    NEW.raw_user_meta_data->>'avatar_url',
    true
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.player_progress (user_id, xp, level, gem_rank, qualifying_completed_songs, version)
  VALUES (NEW.id, 0, 1, 'Quartz', 0, '1.0.0')
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.player_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$trigger$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- BLOCK 4: SECURE MATCH RESULT PROCESSING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_match_result(
  p_match_id UUID,
  p_instrument TEXT,
  p_song_title TEXT,
  p_song_fingerprint TEXT,
  p_score INTEGER,
  p_accuracy NUMERIC,
  p_highest_combo INTEGER,
  p_elapsed_time NUMERIC,
  p_completed BOOLEAN,
  p_failure_reason TEXT DEFAULT NULL,
  p_rules_version TEXT DEFAULT '1.0.0'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_user_id UUID;
  v_existing_id UUID;
  v_xp_earned INTEGER;
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_current_rank TEXT;
  v_qualifying_count INTEGER;
  v_new_rank TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record match results';
  END IF;

  -- 1. Idempotency Check: Prevent duplicate submissions
  SELECT id INTO v_existing_id FROM public.match_history WHERE id = p_match_id;
  IF v_existing_id IS NOT NULL THEN
    SELECT xp, level, gem_rank INTO v_current_xp, v_current_level, v_current_rank
    FROM public.player_progress WHERE user_id = v_user_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'match_id', p_match_id,
      'xp_earned', 0,
      'xp', COALESCE(v_current_xp, 0),
      'level', COALESCE(v_current_level, 1),
      'gem_rank', COALESCE(v_current_rank, 'Quartz')
    );
  END IF;

  -- 2. Insert match record
  INSERT INTO public.match_history (
    id, user_id, instrument, song_title, song_fingerprint,
    score, accuracy, highest_combo, elapsed_time, completed,
    failure_reason, rules_version, created_at
  ) VALUES (
    p_match_id, v_user_id, p_instrument, p_song_title, p_song_fingerprint,
    p_score, p_accuracy, p_highest_combo, p_elapsed_time, p_completed,
    p_failure_reason, p_rules_version, now()
  );

  -- 3. Calculate XP using clean CASE expressions
  v_xp_earned := CASE
    WHEN p_completed THEN
      ROUND(100.0 * (p_accuracy / 100.0) + (p_highest_combo * 0.5) + (p_score / 1000.0))::INTEGER
    WHEN p_elapsed_time >= 15.0 THEN
      5
    ELSE
      0
  END;

  -- 4. Update player_stats
  UPDATE public.player_stats
  SET
    total_attempts = total_attempts + 1,
    completed_songs = completed_songs + (CASE WHEN p_completed THEN 1 ELSE 0 END),
    best_score = GREATEST(best_score, (CASE WHEN p_completed THEN p_score ELSE 0 END)),
    best_accuracy = GREATEST(best_accuracy, (CASE WHEN p_completed THEN p_accuracy ELSE 0.0 END)),
    highest_combo = GREATEST(highest_combo, p_highest_combo),
    piano_attempts = piano_attempts + (CASE WHEN p_instrument = 'piano' THEN 1 ELSE 0 END),
    piano_completed = piano_completed + (CASE WHEN p_instrument = 'piano' AND p_completed THEN 1 ELSE 0 END),
    piano_best_score = GREATEST(piano_best_score, (CASE WHEN p_instrument = 'piano' AND p_completed THEN p_score ELSE 0 END)),
    guitar_attempts = guitar_attempts + (CASE WHEN p_instrument = 'guitar' THEN 1 ELSE 0 END),
    guitar_completed = guitar_completed + (CASE WHEN p_instrument = 'guitar' AND p_completed THEN 1 ELSE 0 END),
    guitar_best_score = GREATEST(guitar_best_score, (CASE WHEN p_instrument = 'guitar' AND p_completed THEN p_score ELSE 0 END)),
    updated_at = now()
  WHERE user_id = v_user_id;

  -- 5. Fetch current progression
  SELECT COALESCE(xp, 0), COALESCE(level, 1), COALESCE(gem_rank, 'Quartz'), COALESCE(qualifying_completed_songs, 0)
  INTO v_current_xp, v_current_level, v_current_rank, v_qualifying_count
  FROM public.player_progress WHERE user_id = v_user_id;

  v_current_xp := v_current_xp + v_xp_earned;
  v_current_level := FLOOR(SQRT(v_current_xp / 100.0)) + 1;

  -- 6. Add to qualifying count (using CASE, zero IF statements)
  v_qualifying_count := v_qualifying_count + (
    CASE
      WHEN p_completed AND (
        (v_current_rank = 'Quartz' AND p_accuracy >= 80.0) OR
        (v_current_rank = 'Jade' AND p_accuracy >= 85.0) OR
        (v_current_rank = 'Sapphire' AND p_accuracy >= 90.0) OR
        (v_current_rank = 'Ruby' AND p_accuracy >= 95.0)
      ) THEN 1
      ELSE 0
    END
  );

  -- 7. Evaluate 3-factor rank promotion (using CASE)
  v_new_rank := CASE
    WHEN v_current_rank = 'Quartz' AND v_current_xp >= 300 AND v_qualifying_count >= 3 THEN 'Jade'
    WHEN v_current_rank = 'Jade' AND v_current_xp >= 700 AND v_qualifying_count >= 5 THEN 'Sapphire'
    WHEN v_current_rank = 'Sapphire' AND v_current_xp >= 1500 AND v_qualifying_count >= 7 THEN 'Ruby'
    WHEN v_current_rank = 'Ruby' AND v_current_xp >= 3000 AND v_qualifying_count >= 10 THEN 'Diamond'
    ELSE v_current_rank
  END;

  -- Reset qualifying count on promotion
  v_qualifying_count := CASE
    WHEN v_new_rank <> v_current_rank AND v_new_rank <> 'Diamond' THEN 0
    ELSE v_qualifying_count
  END;

  -- Update player_progress
  UPDATE public.player_progress
  SET
    xp = v_current_xp,
    level = v_current_level,
    gem_rank = v_new_rank,
    qualifying_completed_songs = v_qualifying_count,
    updated_at = now()
  WHERE user_id = v_user_id;

  RETURN jsonb_build_object(
    'status', 'success',
    'match_id', p_match_id,
    'xp_earned', v_xp_earned,
    'xp', v_current_xp,
    'level', v_current_level,
    'gem_rank', v_new_rank,
    'qualifying_completed_songs', v_qualifying_count,
    'promoted', (v_new_rank <> v_current_rank)
  );
END;
$func$;
-- ============================================================
-- PraiseTiles Phase 3 Migration: Private Multiplayer Rooms
-- File: 20261028000000_phase3_multiplayer_rooms.sql
-- 
-- IMPORTANT â€” Supabase SQL Editor usage:
--   Run each numbered block separately.
--   Ensure NO text is selected before clicking Run.
--   Uses CASE expressions; no standalone PL/pgSQL IF at the top level.
-- ============================================================


-- ============================================================
-- BLOCK 1: Tables
-- ============================================================

-- Extension for generating UUIDs (already enabled in Phase 2, safe to repeat)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------
-- rooms
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rooms (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code         TEXT NOT NULL UNIQUE,           -- 8-char alphanumeric
  host_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status              TEXT NOT NULL DEFAULT 'waiting'
                        CHECK (status IN (
                          'waiting','nominating','voting','uploading',
                          'ready_check','countdown','playing','finished','closed'
                        )),
  instrument          TEXT NOT NULL DEFAULT 'piano'
                        CHECK (instrument IN ('piano','guitar')),
  max_participants    INT  NOT NULL DEFAULT 4,
  song_title          TEXT,
  song_fingerprint    TEXT,
  map_version         TEXT,
  map_checksum        TEXT,
  scheduled_start_at  TIMESTAMPTZ,
  audio_storage_path  TEXT,
  audio_expires_at    TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- room_participants
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_participants (
  room_id       UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_host       BOOLEAN NOT NULL DEFAULT FALSE,
  is_ready      BOOLEAN NOT NULL DEFAULT FALSE,
  is_connected  BOOLEAN NOT NULL DEFAULT TRUE,
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

-- ----------------------------------------------------------------
-- nominations
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.nominations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id     UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_title  TEXT NOT NULL,
  artist      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- votes  (one vote per player per room round)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.votes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  nomination_id  UUID NOT NULL REFERENCES public.nominations(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, user_id)   -- one vote per player per room round
);

-- ----------------------------------------------------------------
-- room_matches
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.room_matches (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  map_json            JSONB NOT NULL,
  map_checksum        TEXT NOT NULL,
  song_title          TEXT NOT NULL,
  song_fingerprint    TEXT NOT NULL,
  instrument          TEXT NOT NULL CHECK (instrument IN ('piano','guitar')),
  scheduled_start_at  TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','active','completed','cancelled')),
  is_casual           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- match_participants
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.match_participants (
  match_id        UUID NOT NULL REFERENCES public.room_matches(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score           INT  NOT NULL DEFAULT 0,
  accuracy        NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  highest_combo   INT  NOT NULL DEFAULT 0,
  completed       BOOLEAN NOT NULL DEFAULT FALSE,
  eliminated_at   TIMESTAMPTZ,
  placement       INT,
  failure_reason  TEXT,
  submitted_at    TIMESTAMPTZ,
  PRIMARY KEY (match_id, user_id)
);

-- ----------------------------------------------------------------
-- Indexes for common query paths
-- ----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_rooms_invite_code        ON public.rooms(invite_code);
CREATE INDEX IF NOT EXISTS idx_rooms_host               ON public.rooms(host_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status             ON public.rooms(status);
CREATE INDEX IF NOT EXISTS idx_room_participants_room   ON public.room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_participants_user   ON public.room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_nominations_room         ON public.nominations(room_id);
CREATE INDEX IF NOT EXISTS idx_votes_room               ON public.votes(room_id);
CREATE INDEX IF NOT EXISTS idx_room_matches_room        ON public.room_matches(room_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_match ON public.match_participants(match_id);
CREATE INDEX IF NOT EXISTS idx_match_participants_user  ON public.match_participants(user_id);

-- ----------------------------------------------------------------
-- updated_at trigger helper (reuse pattern from Phase 2)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $fn$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE TRIGGER trg_nominations_updated_at
  BEFORE UPDATE ON public.nominations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- BLOCK 2: RLS Enable + Policies
-- ============================================================

ALTER TABLE public.rooms             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nominations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;

-- ---- rooms ----
-- Any authenticated user can view a room they participate in (or before joining via invite code lookup)
CREATE POLICY "rooms_select_participant" ON public.rooms
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
      OR status IN ('waiting','nominating','voting') -- allow invite-code lookup
    )
  );

-- Only SECURITY DEFINER functions insert/update rooms
CREATE POLICY "rooms_no_direct_insert" ON public.rooms
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "rooms_no_direct_update" ON public.rooms
  FOR UPDATE USING (FALSE);

-- ---- room_participants ----
CREATE POLICY "rp_select_own_room" ON public.room_participants
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "rp_no_direct_insert" ON public.room_participants
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "rp_no_direct_update" ON public.room_participants
  FOR UPDATE USING (FALSE);

-- ---- nominations ----
CREATE POLICY "nom_select_own_room" ON public.nominations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "nom_insert_own" ON public.nominations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "nom_update_own" ON public.nominations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "nom_delete_own" ON public.nominations
  FOR DELETE USING (auth.uid() = user_id);

-- ---- votes ----
CREATE POLICY "votes_select_own_room" ON public.votes
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "votes_insert_own" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "votes_delete_own" ON public.votes
  FOR DELETE USING (auth.uid() = user_id);

-- ---- room_matches ----
CREATE POLICY "rm_select_participant" ON public.room_matches
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

CREATE POLICY "rm_no_direct_insert" ON public.room_matches
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "rm_no_direct_update" ON public.room_matches
  FOR UPDATE USING (FALSE);

-- ---- match_participants ----
CREATE POLICY "mp_select_participant" ON public.match_participants
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    match_id IN (
      SELECT id FROM public.room_matches
      WHERE room_id IN (
        SELECT room_id FROM public.room_participants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "mp_no_direct_insert" ON public.match_participants
  FOR INSERT WITH CHECK (FALSE);

CREATE POLICY "mp_no_direct_update" ON public.match_participants
  FOR UPDATE USING (FALSE);


-- ============================================================
-- BLOCK 3: SECURITY DEFINER Functions â€” create_room, join_room,
--          transfer_host, submit_map, set_player_ready
-- ============================================================

-- ----------------------------------------------------------------
-- create_room(p_instrument TEXT) -> JSON {room_id, invite_code}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_room(
  p_instrument TEXT DEFAULT 'piano'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $create_room$
DECLARE
  v_user_id       UUID;
  v_invite_code   TEXT;
  v_room_id       UUID;
  v_attempts      INT := 0;
  v_max_attempts  INT := 10;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Generate unique 8-char alphanumeric invite code
  LOOP
    v_invite_code := upper(substring(encode(gen_random_bytes(6), 'base64') FROM 1 FOR 8));
    -- Remove non-alphanumeric chars by replacing them
    v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    -- Pad if needed
    WHILE length(v_invite_code) < 8 LOOP
      v_invite_code := v_invite_code || upper(substring(encode(gen_random_bytes(2), 'base64') FROM 1 FOR 1));
      v_invite_code := regexp_replace(v_invite_code, '[^A-Z0-9]', '', 'g');
    END LOOP;
    v_invite_code := left(v_invite_code, 8);

    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.rooms WHERE invite_code = v_invite_code);

    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      RAISE EXCEPTION 'Could not generate unique invite code after % attempts', v_max_attempts;
    END IF;
  END LOOP;

  -- Create the room
  INSERT INTO public.rooms (invite_code, host_id, instrument)
  VALUES (v_invite_code, v_user_id, p_instrument)
  RETURNING id INTO v_room_id;

  -- Add host as first participant
  INSERT INTO public.room_participants (room_id, user_id, is_host)
  VALUES (v_room_id, v_user_id, TRUE);

  RETURN json_build_object(
    'room_id',     v_room_id,
    'invite_code', v_invite_code
  );
END;
$create_room$;

-- ----------------------------------------------------------------
-- join_room(p_invite_code TEXT) -> JSON {room_id, invite_code, status}
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.join_room(
  p_invite_code TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $join_room$
DECLARE
  v_user_id         UUID;
  v_room_id         UUID;
  v_room_status     TEXT;
  v_max_part        INT;
  v_current_count   INT;
  v_invite_code_uc  TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_invite_code_uc := upper(trim(p_invite_code));

  -- Look up the room
  SELECT id, status, max_participants
  INTO v_room_id, v_room_status, v_max_part
  FROM public.rooms
  WHERE invite_code = v_invite_code_uc
    AND expires_at > NOW()
  LIMIT 1;

  IF v_room_id IS NULL THEN
    RAISE EXCEPTION 'Room not found or expired';
  END IF;

  -- Validate joinable state
  IF v_room_status NOT IN ('waiting', 'nominating') THEN
    RAISE EXCEPTION 'Room is not accepting new players (status: %)', v_room_status;
  END IF;

  -- Check capacity
  SELECT COUNT(*) INTO v_current_count
  FROM public.room_participants
  WHERE room_id = v_room_id;

  IF v_current_count >= v_max_part THEN
    RAISE EXCEPTION 'Room is full (% / % players)', v_current_count, v_max_part;
  END IF;

  -- Upsert participant (handles reconnect scenario)
  INSERT INTO public.room_participants (room_id, user_id, is_host, is_connected)
  VALUES (v_room_id, v_user_id, FALSE, TRUE)
  ON CONFLICT (room_id, user_id) DO UPDATE
    SET is_connected = TRUE;

  RETURN json_build_object(
    'room_id',     v_room_id,
    'invite_code', v_invite_code_uc,
    'status',      v_room_status
  );
END;
$join_room$;

-- ----------------------------------------------------------------
-- transfer_host(p_room_id UUID, p_new_host_id UUID) -> BOOLEAN
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transfer_host(
  p_room_id      UUID,
  p_new_host_id  UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $transfer_host$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is current host
  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = p_room_id AND user_id = v_user_id AND is_host = TRUE
  ) THEN
    RAISE EXCEPTION 'Only the host can transfer host status';
  END IF;

  -- New host must be a participant
  IF NOT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = p_room_id AND user_id = p_new_host_id
  ) THEN
    RAISE EXCEPTION 'New host must be a room participant';
  END IF;

  UPDATE public.room_participants
  SET is_host = CASE WHEN user_id = p_new_host_id THEN TRUE ELSE FALSE END
  WHERE room_id = p_room_id;

  UPDATE public.rooms
  SET host_id = p_new_host_id, updated_at = NOW()
  WHERE id = p_room_id;

  RETURN TRUE;
END;
$transfer_host$;

-- ----------------------------------------------------------------
-- set_player_ready(p_room_id UUID, p_ready BOOLEAN) -> BOOLEAN
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_player_ready(
  p_room_id UUID,
  p_ready   BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $set_player_ready$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.room_participants
  SET is_ready = p_ready
  WHERE room_id = p_room_id AND user_id = v_user_id;

  RETURN FOUND;
END;
$set_player_ready$;

-- ----------------------------------------------------------------
-- leave_room(p_room_id UUID) -> JSON {transferred_host, new_host_id}
-- Handles host departure: auto-transfers to next connected participant.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.leave_room(
  p_room_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $leave_room$
DECLARE
  v_user_id       UUID;
  v_was_host      BOOLEAN;
  v_new_host_id   UUID;
  v_room_status   TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT is_host INTO v_was_host
  FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = v_user_id;

  SELECT status INTO v_room_status
  FROM public.rooms WHERE id = p_room_id;

  -- Remove participant
  DELETE FROM public.room_participants
  WHERE room_id = p_room_id AND user_id = v_user_id;

  -- If room is empty or in terminal state, close it
  IF NOT EXISTS (SELECT 1 FROM public.room_participants WHERE room_id = p_room_id)
     OR v_room_status IN ('finished', 'closed') THEN
    UPDATE public.rooms SET status = 'closed', updated_at = NOW()
    WHERE id = p_room_id;
    RETURN json_build_object('transferred_host', FALSE, 'new_host_id', NULL, 'room_closed', TRUE);
  END IF;

  -- Transfer host if leaver was host
  IF v_was_host THEN
    SELECT user_id INTO v_new_host_id
    FROM public.room_participants
    WHERE room_id = p_room_id AND is_connected = TRUE
    ORDER BY joined_at ASC
    LIMIT 1;

    IF v_new_host_id IS NOT NULL THEN
      UPDATE public.room_participants
      SET is_host = CASE WHEN user_id = v_new_host_id THEN TRUE ELSE FALSE END
      WHERE room_id = p_room_id;

      UPDATE public.rooms
      SET host_id = v_new_host_id, updated_at = NOW()
      WHERE id = p_room_id;
    END IF;

    RETURN json_build_object('transferred_host', TRUE, 'new_host_id', v_new_host_id, 'room_closed', FALSE);
  END IF;

  RETURN json_build_object('transferred_host', FALSE, 'new_host_id', NULL, 'room_closed', FALSE);
END;
$leave_room$;


-- ============================================================
-- BLOCK 4: submit_map and finalize_match SECURITY DEFINER functions
-- ============================================================

-- ----------------------------------------------------------------
-- submit_map(p_room_id, map_json, checksum, song_title, song_fingerprint)
--   -> JSON {match_id, scheduled_start_at}
-- Only the host may call this. Transitions room to 'ready_check'.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_map(
  p_room_id          UUID,
  p_map_json         JSONB,
  p_checksum         TEXT,
  p_song_title       TEXT,
  p_song_fingerprint TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $submit_map$
DECLARE
  v_user_id         UUID;
  v_is_host         BOOLEAN;
  v_instrument      TEXT;
  v_match_id        UUID;
  v_start_at        TIMESTAMPTZ;
  v_countdown_ms    CONSTANT INT := 5000;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify caller is the room host
  SELECT r.instrument, rp.is_host
  INTO v_instrument, v_is_host
  FROM public.rooms r
  JOIN public.room_participants rp ON rp.room_id = r.id AND rp.user_id = v_user_id
  WHERE r.id = p_room_id;

  IF NOT v_is_host THEN
    RAISE EXCEPTION 'Only the host can submit the rhythm map';
  END IF;

  -- Validate map JSON has expected fields
  IF p_map_json IS NULL
     OR p_map_json->>'version' IS NULL
     OR p_map_json->>'notes' IS NULL
     OR p_map_json->>'duration' IS NULL THEN
    RAISE EXCEPTION 'Invalid map JSON: missing required fields (version, notes, duration)';
  END IF;

  -- Schedule start 5 seconds from now
  v_start_at := NOW() + (v_countdown_ms || ' milliseconds')::INTERVAL;

  -- Create the match record
  INSERT INTO public.room_matches (
    room_id, map_json, map_checksum, song_title, song_fingerprint,
    instrument, scheduled_start_at, status, is_casual
  )
  VALUES (
    p_room_id, p_map_json, p_checksum, p_song_title, p_song_fingerprint,
    v_instrument, v_start_at, 'pending', TRUE
  )
  RETURNING id INTO v_match_id;

  -- Seed match_participants for every current room participant
  INSERT INTO public.match_participants (match_id, user_id)
  SELECT v_match_id, user_id
  FROM public.room_participants
  WHERE room_id = p_room_id;

  -- Update room state
  UPDATE public.rooms
  SET
    status             = 'ready_check',
    song_title         = p_song_title,
    song_fingerprint   = p_song_fingerprint,
    map_checksum       = p_checksum,
    scheduled_start_at = v_start_at,
    updated_at         = NOW()
  WHERE id = p_room_id;

  -- Reset all player ready flags for the new match
  UPDATE public.room_participants
  SET is_ready = FALSE
  WHERE room_id = p_room_id;

  RETURN json_build_object(
    'match_id',           v_match_id,
    'scheduled_start_at', v_start_at
  );
END;
$submit_map$;

-- ----------------------------------------------------------------
-- finalize_match(p_match_id, result fields...)
--   -> JSON {placement, match_status}
-- Each player calls this once when their run ends.
-- Uses CASE expressions to compute placement â€” no standalone IF.
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_match(
  p_match_id       UUID,
  p_score          INT,
  p_accuracy       NUMERIC,
  p_highest_combo  INT,
  p_completed      BOOLEAN,
  p_failure_reason TEXT,
  p_notes_hit      INT,
  p_total_notes    INT,
  p_elapsed_time   NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $finalize_match$
DECLARE
  v_user_id        UUID;
  v_room_id        UUID;
  v_placement      INT;
  v_all_submitted  BOOLEAN;
  v_match_status   TEXT;
  v_eliminated_at  TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify participant belongs to this match
  IF NOT EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Player is not a participant in this match';
  END IF;

  -- Idempotency: skip if already submitted
  IF EXISTS (
    SELECT 1 FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id AND submitted_at IS NOT NULL
  ) THEN
    SELECT placement INTO v_placement
    FROM public.match_participants
    WHERE match_id = p_match_id AND user_id = v_user_id;

    SELECT status INTO v_match_status FROM public.room_matches WHERE id = p_match_id;

    RETURN json_build_object('placement', v_placement, 'match_status', v_match_status);
  END IF;

  v_eliminated_at := CASE WHEN NOT p_completed THEN NOW() ELSE NULL END;

  -- Compute placement: 1 + count of players with higher score who already submitted
  SELECT 1 + COUNT(*) INTO v_placement
  FROM public.match_participants
  WHERE match_id = p_match_id
    AND user_id <> v_user_id
    AND submitted_at IS NOT NULL
    AND score > p_score;

  -- Upsert this player's result
  UPDATE public.match_participants
  SET
    score          = p_score,
    accuracy       = p_accuracy,
    highest_combo  = p_highest_combo,
    completed      = p_completed,
    eliminated_at  = v_eliminated_at,
    placement      = v_placement,
    failure_reason = p_failure_reason,
    submitted_at   = NOW()
  WHERE match_id = p_match_id AND user_id = v_user_id;

  -- Update solo match_history for progression (non-blocking â€” uses existing Phase 2 function)
  BEGIN
    PERFORM public.record_match_result(
      gen_random_uuid(),
      (SELECT instrument FROM public.room_matches WHERE id = p_match_id),
      (SELECT song_title  FROM public.room_matches WHERE id = p_match_id),
      (SELECT song_fingerprint FROM public.room_matches WHERE id = p_match_id),
      p_score,
      p_accuracy,
      p_highest_combo,
      p_elapsed_time,
      p_completed,
      p_failure_reason,
      '3.0.0'
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Non-fatal: progression update failure should not fail match result submission
  END;

  -- Check if all participants have submitted
  SELECT BOOL_AND(submitted_at IS NOT NULL) INTO v_all_submitted
  FROM public.match_participants
  WHERE match_id = p_match_id;

  -- Derive room_id for status update
  SELECT room_id INTO v_room_id FROM public.room_matches WHERE id = p_match_id;

  v_match_status := CASE WHEN v_all_submitted THEN 'completed' ELSE 'active' END;

  -- Mark match completed if all submitted
  UPDATE public.room_matches
  SET
    status       = v_match_status,
    completed_at = CASE WHEN v_all_submitted THEN NOW() ELSE NULL END
  WHERE id = p_match_id;

  -- Transition room to finished when match completes
  UPDATE public.rooms
  SET status = CASE WHEN v_all_submitted THEN 'finished' ELSE status END,
      updated_at = NOW()
  WHERE id = v_room_id;

  RETURN json_build_object(
    'placement',     v_placement,
    'match_status',  v_match_status
  );
END;
$finalize_match$;


-- ============================================================
-- BLOCK 5: Storage bucket for room audio
-- (Run this block; bucket creation via SQL may need Supabase dashboard
--  if the storage extension is not enabled. See README for fallback.)
-- ============================================================

-- Create private bucket for room audio files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'room-audio',
  'room-audio',
  FALSE,
  15728640,  -- 15 MB
  ARRAY['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','video/mp4','audio/aac','audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage objects: only room host can upload; participants can download via signed URL
CREATE POLICY "room_audio_host_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'room-audio' AND
    auth.uid() IS NOT NULL AND
    -- Verify uploader is host of the room embedded in object path: rooms/{room_id}/...
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = (
        -- Extract room_id UUID from path segment 2
        (string_to_array(name, '/'))[2]::UUID
      )
      AND rp.user_id = auth.uid()
      AND rp.is_host = TRUE
    )
  );

CREATE POLICY "room_audio_participant_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'room-audio' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = (
        (string_to_array(name, '/'))[2]::UUID
      )
      AND rp.user_id = auth.uid()
    )
  );

CREATE POLICY "room_audio_host_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'room-audio' AND
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.room_participants rp
      WHERE rp.room_id = (
        (string_to_array(name, '/'))[2]::UUID
      )
      AND rp.user_id = auth.uid()
      AND rp.is_host = TRUE
    )
  );
-- ============================================================
-- PraiseTiles Phase 4 Migration: Public Multiplayer, Social & Ranked
-- File: 20261029000000_phase4_social_ranked.sql
--
-- IMPORTANT â€” Supabase SQL Editor usage:
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
CREATE POLICY "queue_select_own" ON public.matchmaking_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "queue_all_trusted_functions" ON public.matchmaking_queue
  FOR ALL USING (auth.uid() = user_id);

-- ---- friendships ----
CREATE POLICY "friendships_select" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friendships_insert" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "friendships_update" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "friendships_delete" ON public.friendships
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- ---- follows ----
CREATE POLICY "follows_select" ON public.follows
  FOR SELECT USING (TRUE); -- public visibility

CREATE POLICY "follows_insert" ON public.follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete" ON public.follows
  FOR DELETE USING (auth.uid() = follower_id);

-- ---- user_blocks ----
CREATE POLICY "blocks_select_own" ON public.user_blocks
  FOR SELECT USING (auth.uid() = blocker_id);

CREATE POLICY "blocks_insert_own" ON public.user_blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete_own" ON public.user_blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- ---- user_reports ----
CREATE POLICY "reports_insert_own" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- ---- room_invitations ----
CREATE POLICY "invites_select" ON public.room_invitations
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "invites_insert" ON public.room_invitations
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "invites_update" ON public.room_invitations
  FOR UPDATE USING (auth.uid() = receiver_id);

-- ---- competitive_ratings ----
CREATE POLICY "comp_ratings_select_all" ON public.competitive_ratings
  FOR SELECT USING (TRUE); -- leaderboards need to read all

-- Direct updates to competitive rating are disallowed (only through SECURITY DEFINER RPCs)
CREATE POLICY "comp_ratings_no_direct_update" ON public.competitive_ratings
  FOR UPDATE USING (FALSE);

-- ---- rating_history ----
CREATE POLICY "rating_history_select" ON public.rating_history
  FOR SELECT USING (TRUE);

-- ---- room_messages ----
CREATE POLICY "room_messages_select_participant" ON public.room_messages
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

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
-- =============================================================================
-- PraiseTiles â€” Phase 5: Tournaments, Competitive Events, Brackets & Seasons
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
/*
 * PraiseTiles Gospel Rhythm Game
 * Migration: 20261101000000_phase8_profile_settings.sql
 * Description: Adds preferred_instrument column to profiles table for GDD reconciliation.
 */

-- 1. Add preferred_instrument column with default 'piano'
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_instrument TEXT DEFAULT 'piano' NOT NULL;

-- 2. Safely add check constraint if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'preferred_instrument_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT preferred_instrument_check
      CHECK (preferred_instrument IN ('piano', 'guitar'));
  END IF;
END $$;

