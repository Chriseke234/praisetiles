-- ============================================================
-- PraiseTiles Phase 3 Migration: Private Multiplayer Rooms
-- File: 20261028000000_phase3_multiplayer_rooms.sql
-- 
-- IMPORTANT — Supabase SQL Editor usage:
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
DROP POLICY IF EXISTS "rooms_select_participant" ON public.rooms;
CREATE POLICY "rooms_select_participant" ON public.rooms
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
      OR status IN ('waiting','nominating','voting') -- allow invite-code lookup
    )
  );

-- Only SECURITY DEFINER functions insert/update rooms
DROP POLICY IF EXISTS "rooms_no_direct_insert" ON public.rooms;
CREATE POLICY "rooms_no_direct_insert" ON public.rooms
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "rooms_no_direct_update" ON public.rooms;
CREATE POLICY "rooms_no_direct_update" ON public.rooms
  FOR UPDATE USING (FALSE);

-- ---- room_participants ----
DROP POLICY IF EXISTS "rp_select_own_room" ON public.room_participants;
CREATE POLICY "rp_select_own_room" ON public.room_participants
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "rp_no_direct_insert" ON public.room_participants;
CREATE POLICY "rp_no_direct_insert" ON public.room_participants
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "rp_no_direct_update" ON public.room_participants;
CREATE POLICY "rp_no_direct_update" ON public.room_participants
  FOR UPDATE USING (FALSE);

-- ---- nominations ----
DROP POLICY IF EXISTS "nom_select_own_room" ON public.nominations;
CREATE POLICY "nom_select_own_room" ON public.nominations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "nom_insert_own" ON public.nominations;
CREATE POLICY "nom_insert_own" ON public.nominations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "nom_update_own" ON public.nominations;
CREATE POLICY "nom_update_own" ON public.nominations
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "nom_delete_own" ON public.nominations;
CREATE POLICY "nom_delete_own" ON public.nominations
  FOR DELETE USING (auth.uid() = user_id);

-- ---- votes ----
DROP POLICY IF EXISTS "votes_select_own_room" ON public.votes;
CREATE POLICY "votes_select_own_room" ON public.votes
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "votes_insert_own" ON public.votes;
CREATE POLICY "votes_insert_own" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "votes_delete_own" ON public.votes;
CREATE POLICY "votes_delete_own" ON public.votes
  FOR DELETE USING (auth.uid() = user_id);

-- ---- room_matches ----
DROP POLICY IF EXISTS "rm_select_participant" ON public.room_matches;
CREATE POLICY "rm_select_participant" ON public.room_matches
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    room_id IN (SELECT room_id FROM public.room_participants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "rm_no_direct_insert" ON public.room_matches;
CREATE POLICY "rm_no_direct_insert" ON public.room_matches
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "rm_no_direct_update" ON public.room_matches;
CREATE POLICY "rm_no_direct_update" ON public.room_matches
  FOR UPDATE USING (FALSE);

-- ---- match_participants ----
DROP POLICY IF EXISTS "mp_select_participant" ON public.match_participants;
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

DROP POLICY IF EXISTS "mp_no_direct_insert" ON public.match_participants;
CREATE POLICY "mp_no_direct_insert" ON public.match_participants
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "mp_no_direct_update" ON public.match_participants;
CREATE POLICY "mp_no_direct_update" ON public.match_participants
  FOR UPDATE USING (FALSE);


-- ============================================================
-- BLOCK 3: SECURITY DEFINER Functions — create_room, join_room,
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
-- Uses CASE expressions to compute placement — no standalone IF.
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

  -- Update solo match_history for progression (non-blocking — uses existing Phase 2 function)
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
DROP POLICY IF EXISTS "room_audio_host_upload" ON storage.objects;
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

DROP POLICY IF EXISTS "room_audio_participant_select" ON storage.objects;
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

DROP POLICY IF EXISTS "room_audio_host_delete" ON storage.objects;
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
