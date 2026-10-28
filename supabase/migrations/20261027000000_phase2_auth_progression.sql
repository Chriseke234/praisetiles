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
