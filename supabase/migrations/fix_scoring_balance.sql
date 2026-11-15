-- Migration: fix_scoring_balance.sql
-- Description: Syncs the process_match_result XP formula in Supabase with the
--   TypeScript calculateMatchXp function in src/config/progression.ts (v1.1.0).
--
-- XP formula change (v1.1.0):
--   BEFORE: ROUND(100.0 * (accuracy/100) + (combo * 0.5) + (score / 1000.0))
--   AFTER:  ROUND( 80.0 * (accuracy/100) + (combo * 0.3) + (score / 2000.0))
--
-- Why: The old formula let a perfect run (accuracy=100, combo=150, score=30k)
--   earn ~225 XP per song, reaching Jade rank after just 2 songs. The new formula
--   produces ~155 XP for the same run, requiring 2–3 strong songs for Jade.
--
-- Applies to: public.process_match_result (SECURITY DEFINER function in phase2).
-- Note: Only the XP calculation CASE expression changes; all other logic is unchanged.

CREATE OR REPLACE FUNCTION public.process_match_result(
  p_map_id        TEXT,
  p_instrument    TEXT,
  p_score         INTEGER,
  p_accuracy      NUMERIC,
  p_highest_combo INTEGER,
  p_elapsed_time  NUMERIC,
  p_completed     BOOLEAN,
  p_notes_hit     INTEGER,
  p_total_notes   INTEGER,
  p_song_title    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id              UUID;
  v_xp_earned            INTEGER;
  v_current_xp           INTEGER;
  v_current_level        INTEGER;
  v_current_rank         TEXT;
  v_qualifying_count     INTEGER;
  v_new_rank             TEXT;
  v_new_level            INTEGER;
  v_is_qualifying        BOOLEAN;
BEGIN
  -- 1. Resolve authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  -- 2. Guard: reject guest runs (no progress row)
  IF NOT EXISTS (SELECT 1 FROM public.player_progress WHERE user_id = v_user_id) THEN
    RETURN jsonb_build_object(
      'xp_earned', 0,
      'xp',        0,
      'level',     1,
      'gem_rank',  'Quartz'
    );
  END IF;

  -- 3. Persist match to history
  INSERT INTO public.match_history (
    user_id, map_id, instrument,
    score, accuracy, highest_combo, elapsed_time, completed,
    notes_hit, total_notes
  ) VALUES (
    v_user_id, p_map_id, p_instrument,
    p_score, p_accuracy, p_highest_combo, p_elapsed_time, p_completed,
    p_notes_hit, p_total_notes
  );

  -- 4. Calculate XP (v1.1.0 — tightened formula, in sync with progression.ts)
  --    base:        80 × (accuracy / 100)   [was 100 ×]
  --    comboBonus:  highest_combo × 0.3     [was × 0.5]
  --    scoreBonus:  score / 2000.0          [was / 1000.0]
  --    Failed run: 5 XP if played >= 15s, else 0
  v_xp_earned := CASE
    WHEN p_completed THEN
      ROUND(80.0 * (p_accuracy / 100.0) + (p_highest_combo * 0.3) + (p_score / 2000.0))::INTEGER
    WHEN p_elapsed_time >= 15.0 THEN 5
    ELSE 0
  END;

  -- 5. Fetch current progression
  SELECT
    COALESCE(xp, 0),
    COALESCE(level, 1),
    COALESCE(gem_rank, 'Quartz'),
    COALESCE(qualifying_completed_songs, 0)
  INTO v_current_xp, v_current_level, v_current_rank, v_qualifying_count
  FROM public.player_progress
  WHERE user_id = v_user_id;

  -- 6. Accumulate XP and level
  v_current_xp    := v_current_xp + v_xp_earned;
  v_new_level     := FLOOR(SQRT(v_current_xp / 100.0)) + 1;

  -- 7. Check whether this completed song qualifies toward the next rank
  --    (only completed runs with accuracy meeting the next tier threshold qualify)
  v_is_qualifying := p_completed AND CASE
    WHEN v_current_rank = 'Quartz'   THEN p_accuracy >= 80.0
    WHEN v_current_rank = 'Jade'     THEN p_accuracy >= 85.0
    WHEN v_current_rank = 'Sapphire' THEN p_accuracy >= 90.0
    WHEN v_current_rank = 'Ruby'     THEN p_accuracy >= 95.0
    ELSE FALSE
  END;

  IF v_is_qualifying THEN
    v_qualifying_count := v_qualifying_count + 1;
  END IF;

  -- 8. Evaluate rank promotion (3-factor: XP + qualifying song count)
  v_new_rank := CASE
    WHEN v_current_rank = 'Quartz'   AND v_current_xp >= 300  AND v_qualifying_count >= 3  THEN 'Jade'
    WHEN v_current_rank = 'Jade'     AND v_current_xp >= 700  AND v_qualifying_count >= 5  THEN 'Sapphire'
    WHEN v_current_rank = 'Sapphire' AND v_current_xp >= 1500 AND v_qualifying_count >= 7  THEN 'Ruby'
    WHEN v_current_rank = 'Ruby'     AND v_current_xp >= 3000 AND v_qualifying_count >= 10 THEN 'Diamond'
    ELSE v_current_rank
  END;

  -- 9. Persist updated progress
  UPDATE public.player_progress
  SET
    xp                        = v_current_xp,
    level                     = v_new_level,
    gem_rank                  = v_new_rank,
    qualifying_completed_songs = v_qualifying_count,
    best_score                = GREATEST(best_score, CASE WHEN p_completed THEN p_score ELSE 0 END),
    piano_best_score          = GREATEST(piano_best_score,
                                  CASE WHEN p_instrument = 'piano' AND p_completed THEN p_score ELSE 0 END),
    guitar_best_score         = GREATEST(guitar_best_score,
                                  CASE WHEN p_instrument = 'guitar' AND p_completed THEN p_score ELSE 0 END),
    updated_at                = NOW()
  WHERE user_id = v_user_id;

  -- 10. Return progression summary to client
  RETURN jsonb_build_object(
    'xp_earned',   v_xp_earned,
    'xp',          v_current_xp,
    'level',       v_new_level,
    'gem_rank',    v_new_rank,
    'promoted',    (v_new_rank <> v_current_rank)
  );
END;
$$;
