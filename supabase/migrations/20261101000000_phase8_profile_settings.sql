-- PraiseTiles Gospel Rhythm Game
-- Migration: 20261101000000_phase8_profile_settings.sql
-- Description: Adds preferred_instrument column to profiles table for GDD reconciliation.
-- Phase 8: GDD Reconciliation & Remaining Game Implementation

-- ============================================================================
-- BLOCK 1: ADD PREFERRED INSTRUMENT COLUMN
-- ============================================================================

-- Add preferred_instrument to profiles with a default of 'piano'.
-- GDD Open Decision #4 and Section 7 specify that players should be able
-- to set a preferred instrument in their profile settings.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_instrument TEXT DEFAULT 'piano' NOT NULL
  CONSTRAINT preferred_instrument_check CHECK (preferred_instrument IN ('piano', 'guitar'));
