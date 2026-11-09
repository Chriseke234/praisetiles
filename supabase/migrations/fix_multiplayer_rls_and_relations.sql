-- =============================================================================
-- Migration: fix_multiplayer_rls_and_relations
-- Purpose  : 
--   1. Fix PostgreSQL RLS infinite recursion (42P17) on room_participants
--   2. Add non-recursive SECURITY DEFINER helper public.is_room_participant()
--   3. Recreate clean RLS policies for rooms, room_participants, nominations, votes, matches
--   4. Add direct Foreign Key constraint between room_participants and profiles
--   5. Provide unified create_room() function accepting 8-character invite codes
--
-- HOW TO RUN:
--   1. Open your Supabase Dashboard -> SQL Editor
--   2. Paste this entire script and click "Run"
--   3. You should see "Success: Multiplayer RLS and schema relations updated"
-- =============================================================================

-- 1. Helper function: check room membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_room_participant(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

-- 2. Foreign Keys: Link room_participants and room_messages to public.profiles.id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_room_participants_profiles'
  ) THEN
    ALTER TABLE public.room_participants
      ADD CONSTRAINT fk_room_participants_profiles
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_room_messages_profiles'
  ) THEN
    ALTER TABLE public.room_messages
      ADD CONSTRAINT fk_room_messages_profiles
      FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Fix RLS on room_participants (Eliminate recursive self-select policy)
DROP POLICY IF EXISTS "rp_select_own_room" ON public.room_participants;
DROP POLICY IF EXISTS "rp_select_authenticated" ON public.room_participants;

CREATE POLICY "rp_select_authenticated" ON public.room_participants
  FOR SELECT TO authenticated
  USING (true);

-- Ensure insert/update remain protected via SECURITY DEFINER RPCs only
DROP POLICY IF EXISTS "rp_no_direct_insert" ON public.room_participants;
CREATE POLICY "rp_no_direct_insert" ON public.room_participants
  FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "rp_no_direct_update" ON public.room_participants;
CREATE POLICY "rp_no_direct_update" ON public.room_participants
  FOR UPDATE USING (FALSE);

-- 4. Fix RLS on rooms (Use non-recursive membership check)
DROP POLICY IF EXISTS "rooms_select_participant_or_active" ON public.rooms;
CREATE POLICY "rooms_select_participant_or_active" ON public.rooms
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      status IN ('waiting', 'nominating', 'voting')
      OR public.is_room_participant(id, auth.uid())
    )
  );

-- 5. Fix RLS on nominations (Use non-recursive membership check)
DROP POLICY IF EXISTS "nom_select_own_room" ON public.nominations;
CREATE POLICY "nom_select_own_room" ON public.nominations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    public.is_room_participant(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "nom_insert_own" ON public.nominations;
CREATE POLICY "nom_insert_own" ON public.nominations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    public.is_room_participant(room_id, auth.uid())
  );

-- 6. Fix RLS on votes (Use non-recursive membership check)
DROP POLICY IF EXISTS "votes_select_own_room" ON public.votes;
CREATE POLICY "votes_select_own_room" ON public.votes
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    public.is_room_participant(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "votes_insert_own" ON public.votes;
CREATE POLICY "votes_insert_own" ON public.votes
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    user_id = auth.uid() AND
    public.is_room_participant(room_id, auth.uid())
  );

-- 7. Fix RLS on room_matches
DROP POLICY IF EXISTS "rm_select_participant" ON public.room_matches;
CREATE POLICY "rm_select_participant" ON public.room_matches
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    public.is_room_participant(room_id, auth.uid())
  );

-- 8. Unified create_room RPC with 8-character invite code support and is_host = TRUE
CREATE OR REPLACE FUNCTION public.create_room(
  p_instrument  TEXT DEFAULT 'piano',
  p_invite_code TEXT DEFAULT NULL
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
  v_host_id := auth.uid();
  IF v_host_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Default to 8 uppercase alphanumeric characters
  v_invite := COALESCE(
    p_invite_code,
    UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', ''), 1, 8))
  );

  -- Insert room
  INSERT INTO public.rooms (host_id, instrument, invite_code, status)
  VALUES (v_host_id, p_instrument, v_invite, 'waiting')
  RETURNING id INTO v_room_id;

  -- Add host as first participant
  INSERT INTO public.room_participants (room_id, user_id, is_host)
  VALUES (v_room_id, v_host_id, TRUE)
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN json_build_object(
    'room_id',     v_room_id,
    'invite_code', v_invite
  );
END;
$$;

-- 9. Ensure multiplayer tables are published to supabase_realtime
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.nominations;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_matches;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_participants;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.room_messages;
  EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL;
  END;
END $$;

DO $$ BEGIN
  RAISE NOTICE 'Success: Multiplayer RLS and schema relations updated';
END $$;
