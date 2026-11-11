-- ============================================================================
-- Migration: 20261106000000_expand_school_type_check.sql
-- Description: Expand schools_school_type_check constraint to allow higher
--              education categories (engineering-polytechnic, university, coaching)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'schools_school_type_check'
  ) THEN
    ALTER TABLE public.schools DROP CONSTRAINT schools_school_type_check;
  END IF;

  ALTER TABLE public.schools
    ADD CONSTRAINT schools_school_type_check
    CHECK (school_type IN (
      'primary',
      'secondary',
      'higher-secondary',
      'college',
      'engineering-polytechnic',
      'university',
      'coaching',
      'other'
    ));
END $$;
