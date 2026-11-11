-- =====================================================================
-- AUTH ROLES + SHOPKEEPER OWNERSHIP — full migration
-- =====================================================================

-- 1. Enum -------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'shopkeeper', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. profiles ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  phone       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles are publicly readable" ON public.profiles;
CREATE POLICY "Profiles are publicly readable"
  ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. user_roles -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. has_role security definer ---------------------------------------
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- user_roles policies (must come AFTER has_role)
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. shop_owners ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_owners (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (shop_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_owners_user ON public.shop_owners(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_owners_shop ON public.shop_owners(shop_id);
ALTER TABLE public.shop_owners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own ownership" ON public.shop_owners;
CREATE POLICY "Owners read own ownership"
  ON public.shop_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage shop_owners" ON public.shop_owners;
CREATE POLICY "Admins manage shop_owners"
  ON public.shop_owners FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- helper: is user an owner of a given shop
CREATE OR REPLACE FUNCTION public.is_shop_owner(_user_id uuid, _shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shop_owners
    WHERE user_id = _user_id AND shop_id = _shop_id
  );
$$;

-- 6. shop_claims ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.shop_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_phone text,
  note          text,
  status        text NOT NULL DEFAULT 'pending',
  admin_notes   text,
  reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_claims_status ON public.shop_claims(status);
CREATE INDEX IF NOT EXISTS idx_shop_claims_user   ON public.shop_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_claims_shop   ON public.shop_claims(shop_id);
ALTER TABLE public.shop_claims ENABLE ROW LEVEL SECURITY;

-- validate status via trigger (CHECK rules per project guide)
CREATE OR REPLACE FUNCTION public.validate_shop_claim_status()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status NOT IN ('pending','approved','rejected') THEN
    RAISE EXCEPTION 'Invalid shop_claims.status: %', NEW.status;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_shop_claim_status ON public.shop_claims;
CREATE TRIGGER trg_validate_shop_claim_status
  BEFORE INSERT OR UPDATE ON public.shop_claims
  FOR EACH ROW EXECUTE FUNCTION public.validate_shop_claim_status();

DROP TRIGGER IF EXISTS trg_shop_claims_updated_at ON public.shop_claims;
CREATE TRIGGER trg_shop_claims_updated_at
  BEFORE UPDATE ON public.shop_claims
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "Users submit own claims" ON public.shop_claims;
CREATE POLICY "Users submit own claims"
  ON public.shop_claims FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

DROP POLICY IF EXISTS "Users read own claims" ON public.shop_claims;
CREATE POLICY "Users read own claims"
  ON public.shop_claims FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins manage claims" ON public.shop_claims;
CREATE POLICY "Admins manage claims"
  ON public.shop_claims FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete claims" ON public.shop_claims;
CREATE POLICY "Admins delete claims"
  ON public.shop_claims FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Tighten existing RLS --------------------------------------------
-- shops: drop old broad authenticated policies and replace
DROP POLICY IF EXISTS "Authenticated users can insert shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can update shops" ON public.shops;
DROP POLICY IF EXISTS "Authenticated users can delete shops" ON public.shops;

CREATE POLICY "Admins insert shops"
  ON public.shops FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete shops"
  ON public.shops FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins or owners update shops"
  ON public.shops FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_shop_owner(auth.uid(), id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_shop_owner(auth.uid(), id)
  );

-- column guard for non-admin updates
CREATE OR REPLACE FUNCTION public.shops_owner_column_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  -- Non-admin (must be owner per RLS). Block protected columns.
  IF NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.slug      IS DISTINCT FROM OLD.slug
     OR NEW.category_id IS DISTINCT FROM OLD.category_id
     OR NEW.id        IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION 'Only admins can change verified/active/slug/category fields';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_shops_owner_column_guard ON public.shops;
CREATE TRIGGER trg_shops_owner_column_guard
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_owner_column_guard();

-- categories: admin-only writes
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON public.categories;
CREATE POLICY "Admins insert categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update categories" ON public.categories
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete categories" ON public.categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- shop_categories: admin-only writes
DROP POLICY IF EXISTS "Authenticated users can insert shop_categories" ON public.shop_categories;
DROP POLICY IF EXISTS "Authenticated users can delete shop_categories" ON public.shop_categories;
CREATE POLICY "Admins insert shop_categories" ON public.shop_categories
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete shop_categories" ON public.shop_categories
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- shop_requests: admin-only read/update/delete (insert remains public)
DROP POLICY IF EXISTS "Authenticated users can read shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can update shop requests" ON public.shop_requests;
DROP POLICY IF EXISTS "Authenticated users can delete shop requests" ON public.shop_requests;
CREATE POLICY "Admins read shop requests" ON public.shop_requests
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update shop requests" ON public.shop_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete shop requests" ON public.shop_requests
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- shop_engagement: admin or shop owner can read
DROP POLICY IF EXISTS "Authenticated users can read engagement" ON public.shop_engagement;
CREATE POLICY "Admins or owners read engagement" ON public.shop_engagement
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_shop_owner(auth.uid(), shop_id)
  );

-- 8. Auto profile + default 'user' role on signup --------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. RPCs (admin only) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  INSERT INTO public.shop_owners (shop_id, user_id, assigned_by)
  VALUES (_shop_id, _user_id, auth.uid())
  ON CONFLICT (shop_id, user_id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'shopkeeper')
  ON CONFLICT (user_id, role) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.revoke_shop_owner(_shop_id uuid, _user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE remaining int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  DELETE FROM public.shop_owners WHERE shop_id = _shop_id AND user_id = _user_id;
  SELECT COUNT(*) INTO remaining FROM public.shop_owners WHERE user_id = _user_id;
  IF remaining = 0 THEN
    DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'shopkeeper';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.approve_shop_claim(_claim_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.shop_claims%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  SELECT * INTO c FROM public.shop_claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF c.status <> 'pending' THEN RAISE EXCEPTION 'Claim already %', c.status; END IF;

  PERFORM public.assign_shop_owner(c.shop_id, c.user_id);

  UPDATE public.shop_claims
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _claim_id;
END $$;

CREATE OR REPLACE FUNCTION public.reject_shop_claim(_claim_id uuid, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  UPDATE public.shop_claims
  SET status = 'rejected', admin_notes = _notes,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = _claim_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found or not pending'; END IF;
END $$;

-- 10. Backfill --------------------------------------------------------
-- Profiles for existing users
INSERT INTO public.profiles (id, full_name)
SELECT u.id, u.raw_user_meta_data->>'full_name'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Default 'user' role for existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- Promote initial admin
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'harshking5305@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;