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

