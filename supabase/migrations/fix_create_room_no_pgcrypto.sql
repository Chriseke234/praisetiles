-- =============================================================================
-- Migration: fix_create_room_no_pgcrypto
-- Purpose  : Replace gen_random_bytes() usage in create_room() with an
--            externally-supplied invite code (passed from the Next.js API route).
--            This removes the dependency on the pgcrypto extension entirely.
--
-- HOW TO RUN:
--   1. Open your Supabase project → SQL Editor
--   2. Paste this entire script and click "Run"
--   3. You should see: "create_room function updated successfully"
-- =============================================================================

CREATE OR REPLACE FUNCTION create_room(
  p_instrument  TEXT DEFAULT 'piano',
  p_invite_code TEXT DEFAULT NULL        -- supplied by the Next.js API route
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_id    UUID;
  v_invite     TEXT;
  v_host_id    UUID;
BEGIN
  -- Identify the calling user (JWT sub claim)
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Use the invite code supplied by the caller; fall back to a simple random string
  -- using gen_random_uuid() (always available) rather than gen_random_bytes().
  v_invite := COALESCE(
    p_invite_code,
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 6))
  );

  -- Insert new room row
  INSERT INTO rooms (host_id, instrument, invite_code, status)
  VALUES (v_host_id, p_instrument, v_invite, 'waiting')
  RETURNING id INTO v_room_id;

  -- Add host as first participant (is_host column in room_participants)
  INSERT INTO public.room_participants (room_id, user_id, is_host)
  VALUES (v_room_id, v_host_id, TRUE)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'room_id',     v_room_id,
    'invite_code', v_invite
  );
END;
$$;

-- Confirm
DO $$ BEGIN
  RAISE NOTICE 'create_room function updated successfully — pgcrypto no longer required.';
END $$;
