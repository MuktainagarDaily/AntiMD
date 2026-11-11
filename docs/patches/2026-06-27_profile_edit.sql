-- =====================================================================
-- 2026-06-27 — Profile edit fields (username/mobile/birthday/gender)
-- =====================================================================
-- Idempotent. Safe to re-run. Repurposes profiles.full_name as the
-- unique @username (one-time editable). Adds mobile/birth_date/gender.
-- Age is derived in the UI from birth_date (no stored column needed).
-- =====================================================================

-- 1. Columns ----------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS birth_date           date,
  ADD COLUMN IF NOT EXISTS gender               text;

-- profiles.phone already exists (used as mobile). Keep it.

-- 2. Constraints ------------------------------------------------------
-- Gender enum-as-check (keeps schema simple, no enum migration headaches).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_gender_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_gender_check
       CHECK (gender IS NULL OR gender IN ('male','female','other','prefer_not_to_say'));

-- Birth date sanity (no future dates, no absurd past).
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_birth_date_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_birth_date_check
       CHECK (birth_date IS NULL OR (birth_date <= CURRENT_DATE AND birth_date >= '1900-01-01'));

-- Mobile sanity: 10–15 digits, optional leading + (validated harder client-side).
-- NOT VALID so any legacy phone strings (formatted with spaces/dashes) don't
-- block the migration; new writes are still enforced.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_format_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_phone_format_check
       CHECK (phone IS NULL OR phone ~ '^\+?[0-9]{10,15}$')
       NOT VALID;

-- Username (full_name) format: 3–24 chars, [a-z0-9_.], must start with a letter.
-- Existing rows may hold legacy display names (spaces, capitals, etc.) from
-- before usernames were a thing. We don't want to nuke that data, so the
-- constraint is added NOT VALID — it enforces the format on every INSERT/UPDATE
-- going forward, but skips the one-time validation of pre-existing rows.
-- The BEFORE UPDATE trigger below only sets full_name_changed_at when the value
-- actually changes, so legacy rows stay editable exactly once to a valid handle.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_username_format_check;
ALTER TABLE public.profiles
  ADD  CONSTRAINT profiles_username_format_check
       CHECK (full_name IS NULL OR full_name = '' OR full_name ~ '^[a-z][a-z0-9_.]{2,23}$')
       NOT VALID;

-- 3. Case-insensitive unique index on username -----------------------
CREATE UNIQUE INDEX IF NOT EXISTS profiles_full_name_lower_uidx
  ON public.profiles (lower(full_name))
  WHERE full_name IS NOT NULL AND full_name <> '';

-- 4. Trigger: lock username after first change -----------------------
CREATE OR REPLACE FUNCTION public.profiles_lock_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only react when the value actually changes (case-insensitive).
  IF lower(coalesce(NEW.full_name,'')) IS DISTINCT FROM lower(coalesce(OLD.full_name,'')) THEN
    -- Already changed once → reject further edits.
    IF OLD.full_name_changed_at IS NOT NULL THEN
      RAISE EXCEPTION 'Username can only be changed once.'
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.full_name_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_lock_username ON public.profiles;
CREATE TRIGGER trg_profiles_lock_username
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_username();

-- 5. Availability RPC (case-insensitive, excludes caller) -------------
CREATE OR REPLACE FUNCTION public.username_available(_username text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(full_name) = lower(trim(_username))
      AND id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  );
$$;

REVOKE EXECUTE ON FUNCTION public.username_available(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.username_available(text) TO authenticated;

-- 6. Grants reminder (profiles already granted in earlier migrations) -
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- =====================================================================
-- Rollback (manual):
--   DROP TRIGGER IF EXISTS trg_profiles_lock_username ON public.profiles;
--   DROP FUNCTION IF EXISTS public.profiles_lock_username();
--   DROP FUNCTION IF EXISTS public.username_available(text);
--   DROP INDEX  IF EXISTS public.profiles_full_name_lower_uidx;
--   ALTER TABLE public.profiles
--     DROP CONSTRAINT IF EXISTS profiles_username_format_check,
--     DROP CONSTRAINT IF EXISTS profiles_phone_format_check,
--     DROP CONSTRAINT IF EXISTS profiles_birth_date_check,
--     DROP CONSTRAINT IF EXISTS profiles_gender_check,
--     DROP COLUMN IF EXISTS gender,
--     DROP COLUMN IF EXISTS birth_date,
--     DROP COLUMN IF EXISTS full_name_changed_at;
-- =====================================================================
