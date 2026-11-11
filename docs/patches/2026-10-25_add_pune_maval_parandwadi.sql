-- ============================================================================
-- Patch: 2026-10-25 — Add Pune District, Maval Taluka, and Parandwadi Village
-- Description:
--   Inserts Pune District, Maval Taluka, and Parandwadi Village (along with
--   major Maval localities) into the multi-town geographic hierarchy.
-- ============================================================================

DO $$
DECLARE
  v_state_id     UUID;
  v_pune_dist_id UUID;
  v_maval_id     UUID;
  v_pune_city_id UUID;
BEGIN
  -- 1. Get Maharashtra State ID
  SELECT id INTO v_state_id FROM public.geo_states WHERE code = 'MH' LIMIT 1;

  IF v_state_id IS NULL THEN
    RAISE EXCEPTION 'Maharashtra state not found in geo_states table.';
  END IF;

  -- 2. Insert District: Pune (पुणे)
  INSERT INTO public.geo_districts (state_id, slug, name, name_mr, is_active)
  VALUES (v_state_id, 'pune', 'Pune', 'पुणे', true)
  ON CONFLICT (state_id, slug) DO UPDATE 
    SET name = EXCLUDED.name, 
        name_mr = EXCLUDED.name_mr,
        is_active = true
  RETURNING id INTO v_pune_dist_id;

  -- If conflict updated without returning, re-fetch id
  IF v_pune_dist_id IS NULL THEN
    SELECT id INTO v_pune_dist_id FROM public.geo_districts WHERE state_id = v_state_id AND slug = 'pune';
  END IF;

  -- 3. Insert Taluka: Maval (मावळ)
  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, is_active, sort_order)
  VALUES (v_pune_dist_id, 'maval', 'Maval', 'मावळ', 'taluka', 18.7546, 73.5414, true, 1)
  ON CONFLICT (district_id, slug) DO UPDATE 
    SET name = EXCLUDED.name,
        name_mr = EXCLUDED.name_mr,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = true
  RETURNING id INTO v_maval_id;

  IF v_maval_id IS NULL THEN
    SELECT id INTO v_maval_id FROM public.geo_cities WHERE district_id = v_pune_dist_id AND slug = 'maval';
  END IF;

  -- Also insert Pune City (पुणे शहर)
  INSERT INTO public.geo_cities (district_id, slug, name, name_mr, type, latitude, longitude, is_active, sort_order)
  VALUES (v_pune_dist_id, 'pune', 'Pune', 'पुणे', 'city', 18.5204, 73.8567, true, 2)
  ON CONFLICT (district_id, slug) DO UPDATE 
    SET name = EXCLUDED.name,
        name_mr = EXCLUDED.name_mr,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = true
  RETURNING id INTO v_pune_city_id;

  -- 4. Insert Villages / Localities under Maval (including Parandwadi / Parandwai)
  INSERT INTO public.geo_villages (city_id, slug, name, name_mr, pincode, latitude, longitude, is_active, sort_order)
  VALUES
    (v_maval_id, 'parandwadi', 'Parandwadi', 'परंदवडी', '410506', 18.7247, 73.6872, true, 1),
    (v_maval_id, 'talegaon-dabhade', 'Talegaon Dabhade', 'तळेगाव दाभाडे', '410506', 18.7344, 73.6761, true, 2),
    (v_maval_id, 'vadgaon', 'Vadgaon Maval', 'वडगाव मावळ', '412106', 18.7494, 73.6457, true, 3),
    (v_maval_id, 'somatane', 'Somatane', 'सोमाटणे', '410506', 18.7090, 73.6790, true, 4),
    (v_maval_id, 'kamshet', 'Kamshet', 'कामशेत', '410405', 18.7610, 73.5594, true, 5),
    (v_maval_id, 'lonavala', 'Lonavala', 'लोणावळा', '410401', 18.7557, 73.4091, true, 6)
  ON CONFLICT (city_id, slug) DO UPDATE
    SET name = EXCLUDED.name,
        name_mr = EXCLUDED.name_mr,
        pincode = EXCLUDED.pincode,
        latitude = EXCLUDED.latitude,
        longitude = EXCLUDED.longitude,
        is_active = true;

END $$;
