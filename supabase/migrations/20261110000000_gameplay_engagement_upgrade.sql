-- ============================================================================
-- PraiseTiles: Gameplay Experience, Engagement & Multiplayer Upgrade Migration
-- Migration: 20261110000000_gameplay_engagement_upgrade.sql
-- ============================================================================

-- 1. Daily & Weekly Challenges Table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('complete_songs', 'accuracy_target', 'combo_target', 'sustain_target', 'play_both_instruments', 'flawless_run')),
  target_value NUMERIC NOT NULL,
  xp_reward INTEGER NOT NULL DEFAULT 50,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active challenges" ON public.daily_challenges;
CREATE POLICY "Anyone can view active challenges"
  ON public.daily_challenges FOR SELECT
  USING (is_active = true);

-- Seed Initial Daily & Weekly Challenges
INSERT INTO public.daily_challenges (code, period_type, title, description, target_type, target_value, xp_reward) VALUES
  ('daily_two_songs', 'daily', 'Daily Praiser', 'Complete 2 songs in any mode today.', 'complete_songs', 2, 60),
  ('daily_accuracy_85', 'daily', 'Precision Offering', 'Achieve at least 85% accuracy on any song.', 'accuracy_target', 85, 75),
  ('daily_combo_30', 'daily', 'Steady Rhythm', 'Reach a 30-hit combo streak in a single song.', 'combo_target', 30, 80),
  ('weekly_ten_songs', 'weekly', 'Sanctuary Marathon', 'Complete 10 songs this week.', 'complete_songs', 10, 250),
  ('weekly_both_instruments', 'weekly', 'Master of Instruments', 'Complete songs with both Piano and Guitar.', 'play_both_instruments', 2, 200),
  ('weekly_sustains_20', 'weekly', 'Sustain Devotion', 'Complete 20 long sustain tiles this week.', 'sustain_target', 20, 220)
ON CONFLICT (code) DO NOTHING;

-- 2. Player Challenge Progress Tracking
CREATE TABLE IF NOT EXISTS public.player_challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenge_id UUID NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  current_progress NUMERIC NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  claimed BOOLEAN NOT NULL DEFAULT false,
  period_start DATE NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT player_challenge_period_unique UNIQUE(user_id, challenge_id, period_start)
);

ALTER TABLE public.player_challenge_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage their challenge progress" ON public.player_challenge_progress;
CREATE POLICY "Users can view and manage their challenge progress"
  ON public.player_challenge_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Consecutive-Day Activity Streaks
CREATE TABLE IF NOT EXISTS public.player_login_streaks (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak INTEGER NOT NULL DEFAULT 1,
  longest_streak INTEGER NOT NULL DEFAULT 1,
  last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.player_login_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and update their streak" ON public.player_login_streaks;
CREATE POLICY "Users can view and update their streak"
  ON public.player_login_streaks FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Ghost Performances for Head-to-Head Replay Challenge
CREATE TABLE IF NOT EXISTS public.ghost_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_title TEXT NOT NULL,
  song_fingerprint TEXT NOT NULL,
  instrument TEXT NOT NULL CHECK (instrument IN ('piano', 'guitar')),
  score INTEGER NOT NULL,
  accuracy NUMERIC(5,2) NOT NULL,
  highest_combo INTEGER NOT NULL,
  perfect_streak INTEGER NOT NULL DEFAULT 0,
  duration NUMERIC(6,2) NOT NULL,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.ghost_performances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view ghost performances" ON public.ghost_performances;
CREATE POLICY "Anyone can view ghost performances"
  ON public.ghost_performances FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert their ghost performances" ON public.ghost_performances;
CREATE POLICY "Users can insert their ghost performances"
  ON public.ghost_performances FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 5. Friend Challenges Table
CREATE TABLE IF NOT EXISTS public.friend_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  song_title TEXT NOT NULL,
  song_fingerprint TEXT NOT NULL,
  instrument TEXT NOT NULL CHECK (instrument IN ('piano', 'guitar')),
  challenger_score INTEGER NOT NULL,
  challenger_accuracy NUMERIC(5,2) NOT NULL,
  challenged_score INTEGER,
  challenged_accuracy NUMERIC(5,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined', 'expired')),
  winner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.friend_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view and update friend challenges" ON public.friend_challenges;
CREATE POLICY "Participants can view and update friend challenges"
  ON public.friend_challenges FOR ALL
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = challenged_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = challenged_id);

-- 6. Add Core Gameplay & Practice Achievements
INSERT INTO public.achievements (code, title, description, icon_name, badge_tier) VALUES
  ('first_performance', 'First Praise', 'Successfully completed your very first gospel song.', 'Award', 'bronze'),
  ('rhythm_keeper', 'Rhythm Keeper', 'Successfully completed 5 songs on the PraiseTiles stage.', 'Music', 'bronze'),
  ('perfect_touch', 'Perfect Touch', 'Achieved 100% accuracy on a qualifying song run.', 'Sparkles', 'gold'),
  ('combo_master', 'Combo Master', 'Maintained an unbroken 50-hit combo streak.', 'Flame', 'silver'),
  ('worship_warrior', 'Worship Warrior', 'Completed 10 songs across the shared gospel sanctuary.', 'Shield', 'silver'),
  ('instrument_explorer', 'Instrument Explorer', 'Demonstrated versatile musicianship with both Piano and Guitar.', 'Layers', 'bronze'),
  ('sustain_master', 'Sustain Master', 'Successfully held and completed 20 long sustain tiles.', 'Zap', 'silver'),
  ('perfect_streak', 'Heavenly Streak', 'Achieved 25 consecutive Perfect judgements without missing a beat.', 'Crown', 'gold')
ON CONFLICT (code) DO NOTHING;

-- 7. Add columns for Perfect Streak and Sustain Bonuses to player_stats
ALTER TABLE public.player_stats
  ADD COLUMN IF NOT EXISTS highest_perfect_streak INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_sustains_completed INTEGER DEFAULT 0 NOT NULL;
