-- ============================================================================
-- Seed Data: Demo Mess & PG Listings for Muktainagar Daily
-- Run this script in the Supabase SQL Editor to populate demo listings.
-- ============================================================================

DO $$
DECLARE
  v_city_id UUID := '644b68eb-472c-40d3-9f83-c7d26e121498'; -- Muktainagar
  v_mess_cat_id UUID;
  v_pg_cat_id UUID;

  v_shop_mess_1 UUID := 'a1111111-1111-4111-8111-111111111111';
  v_shop_mess_2 UUID := 'a2222222-2222-4222-8222-222222222222';
  v_shop_mess_3 UUID := 'a3333333-3333-4333-8333-333333333333';

  v_shop_pg_1 UUID   := 'b1111111-1111-4111-8111-111111111111';
  v_shop_pg_2 UUID   := 'b2222222-2222-4222-8222-222222222222';
  v_shop_pg_3 UUID   := 'b3333333-3333-4333-8333-333333333333';
BEGIN
  -- Get category IDs
  SELECT id INTO v_mess_cat_id FROM public.categories WHERE name ILIKE '%mess%' LIMIT 1;
  SELECT id INTO v_pg_cat_id   FROM public.categories WHERE name ILIKE '%pg%' OR name ILIKE '%hostel%' LIMIT 1;

  -- 1. INSERT MESS SHOPS
  INSERT INTO public.shops (
    id, name, slug, phone, whatsapp, address, area, city_id, image_url, is_verified, is_active,
    amenities, opening_time, closing_time, is_open
  ) VALUES
  (
    v_shop_mess_1,
    'Shree Swami Samarth Bhojanalay',
    'shree-swami-samarth-bhojanalay',
    '9876543210',
    '919876543210',
    'Near Shivaji College, Main Road, Muktainagar',
    'College Road',
    v_city_id,
    '/images/demo/swami-samarth-thali.jpg',
    true, true,
    ARRAY['Pure Veg', 'Tiffin Delivery', 'Unlimited Thali', 'RO Drinking Water', 'Monthly Pass Available', 'Sunday Special Feast', 'UPI Accepted'],
    '11:00', '22:30', true
  ),
  (
    v_shop_mess_2,
    'Kolhapuri Ruchira Mess & Tiffin',
    'kolhapuri-ruchira-mess',
    '9822334455',
    '919822334455',
    'Station Road, Near ST Bus Stand, Muktainagar',
    'Station Road',
    v_city_id,
    '/images/demo/ruchira-nonveg-thali.jpg',
    true, true,
    ARRAY['Veg & Non-Veg', 'Tiffin Delivery', 'RO Drinking Water', 'Monthly Pass Available', 'Sunday Special Feast', 'UPI Accepted'],
    '11:30', '23:00', true
  ),
  (
    v_shop_mess_3,
    'Annapurna Home Tiffin Service',
    'annapurna-tiffin-service',
    '9422001122',
    '919422001122',
    'Gandhi Chowk, Near Old Post Office, Muktainagar',
    'Gandhi Chowk',
    v_city_id,
    '/images/demo/annapurna-tiffin.jpg',
    true, true,
    ARRAY['Pure Veg', 'Tiffin Delivery', 'RO Drinking Water', 'Home Delivery', 'UPI Accepted'],
    '10:30', '22:00', true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    image_url = EXCLUDED.image_url,
    amenities = EXCLUDED.amenities;

  -- 2. INSERT PG SHOPS
  INSERT INTO public.shops (
    id, name, slug, phone, whatsapp, address, area, city_id, image_url, is_verified, is_active,
    amenities, opening_time, closing_time, is_open
  ) VALUES
  (
    v_shop_pg_1,
    'Shree Sai Boys Hostel & PG',
    'shree-sai-boys-hostel',
    '9850123456',
    '919850123456',
    'Plot No. 12, Behind Shivaji College, Muktainagar',
    'College Campus Area',
    v_city_id,
    '/images/demo/sai-boys-hostel.jpg',
    true, true,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'Inverter / Power Backup', 'Study Table & Chair', 'Daily Housekeeping', 'CCTV Security', 'Mess / Food Included', 'Parking'],
    '06:00', '22:00', true
  ),
  (
    v_shop_pg_2,
    'Matoshree Girls PG & Residence',
    'matoshree-girls-pg',
    '9860987654',
    '919860987654',
    'Lane No. 3, Near JDCC Bank, Pratibha Nagar, Muktainagar',
    'Pratibha Nagar',
    v_city_id,
    '/images/demo/matoshree-girls-pg.jpg',
    true, true,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'CCTV Security', 'Inverter / Power Backup', 'Study Table & Chair', 'Washing Machine / Laundry', 'Mess / Food Included', 'Attached Washroom'],
    '06:00', '21:30', true
  ),
  (
    v_shop_pg_3,
    'Gurukrupa Executive PG & Rooms',
    'gurukrupa-executive-pg',
    '9765432109',
    '919765432109',
    'Station Road, Near Panchavati Complex, Muktainagar',
    'Station Road',
    v_city_id,
    '/images/demo/gurukrupa-executive-pg.jpg',
    true, true,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'Attached Washroom', 'Inverter / Power Backup', 'Parking', 'Cupboard / Almirah', 'Daily Housekeeping'],
    '06:00', '23:00', true
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    image_url = EXCLUDED.image_url,
    amenities = EXCLUDED.amenities;

  -- 3. LINK SHOPS TO CATEGORIES
  IF v_mess_cat_id IS NOT NULL THEN
    INSERT INTO public.shop_categories (shop_id, category_id) VALUES
      (v_shop_mess_1, v_mess_cat_id),
      (v_shop_mess_2, v_mess_cat_id),
      (v_shop_mess_3, v_mess_cat_id)
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_pg_cat_id IS NOT NULL THEN
    INSERT INTO public.shop_categories (shop_id, category_id) VALUES
      (v_shop_pg_1, v_pg_cat_id),
      (v_shop_pg_2, v_pg_cat_id),
      (v_shop_pg_3, v_pg_cat_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 4. INSERT MESS PROFILES
  INSERT INTO public.mess_profiles (
    shop_id, mess_type, monthly_rate, single_thali_rate, tiffin_delivery,
    lunch_timing, dinner_timing, sunday_feast
  ) VALUES
  (
    v_shop_mess_1,
    'pure_veg',
    2200,
    70,
    true,
    '11:30 AM - 02:30 PM',
    '07:30 PM - 10:30 PM',
    true
  ),
  (
    v_shop_mess_2,
    'veg_nonveg',
    2600,
    90,
    true,
    '12:00 PM - 03:00 PM',
    '07:30 PM - 11:00 PM',
    true
  ),
  (
    v_shop_mess_3,
    'pure_veg',
    2000,
    60,
    true,
    '11:00 AM - 02:00 PM',
    '07:00 PM - 10:00 PM',
    false
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    mess_type = EXCLUDED.mess_type,
    monthly_rate = EXCLUDED.monthly_rate,
    single_thali_rate = EXCLUDED.single_thali_rate,
    tiffin_delivery = EXCLUDED.tiffin_delivery,
    lunch_timing = EXCLUDED.lunch_timing,
    dinner_timing = EXCLUDED.dinner_timing,
    sunday_feast = EXCLUDED.sunday_feast;

  -- 5. INSERT TODAY'S MESS DAILY MENUS
  INSERT INTO public.mess_daily_menus (
    shop_id, menu_date, lunch_text, dinner_text, photo_url, special_tag
  ) VALUES
  (
    v_shop_mess_1,
    CURRENT_DATE,
    'शेव भाजी रस्सा, मुगाची डाळ, ४ गरम चपाती, जीरा राईस, कांदा-लिंबू',
    'पनीर बटर मसाला, वरण-भात, चपाती, पापड, गुलाबजाम',
    '/images/demo/daily-menu-board.jpg',
    'आजची मेजवानी: गुलाबजाम व पनीर मसाला'
  ),
  (
    v_shop_mess_2,
    CURRENT_DATE,
    'सुका चिकन मसाला / शेव भाजी, तांबडा-पांढरा रस्सा, ४ चपाती, भात',
    'अंडा करी / दाल तडका, जिरा राईस, ४ चपाती, कांदा-सलाड',
    '/images/demo/ruchira-nonveg-thali.jpg',
    'स्पेशल कोल्हापुरी तांबडा रस्सा'
  ),
  (
    v_shop_mess_3,
    CURRENT_DATE,
    'खानदेशी वांग्याचं भरीत, बाजरीची भाकरी (२), पिठलं-भात, ठेचा',
    'मटकी उसळ, ४ चपाती, डाळ-भात, कोशिंबीर',
    '/images/demo/annapurna-tiffin.jpg',
    'खानदेशी स्पेशल भरीत-भाकरी'
  )
  ON CONFLICT (shop_id, menu_date) DO UPDATE SET
    lunch_text = EXCLUDED.lunch_text,
    dinner_text = EXCLUDED.dinner_text,
    photo_url = EXCLUDED.photo_url,
    special_tag = EXCLUDED.special_tag;

  -- 6. INSERT PG PROFILES
  INSERT INTO public.pg_profiles (
    shop_id, gender, occupancy_target, total_beds, available_beds, deposit_amount,
    notice_period_days, gate_closing_time, food_included, amenities, sharing_rates
  ) VALUES
  (
    v_shop_pg_1,
    'boys',
    'students',
    24,
    4,
    2000,
    30,
    '10:00 PM',
    true,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'Inverter / Power Backup', 'Study Table & Chair', 'Daily Housekeeping', 'CCTV Security', 'Mess / Food Included', 'Parking'],
    '{"1_sharing": 4500, "2_sharing": 3200, "3_sharing": 2500, "4_sharing": 2000}'::jsonb
  ),
  (
    v_shop_pg_2,
    'girls',
    'students',
    18,
    3,
    2500,
    30,
    '09:30 PM',
    true,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'CCTV Security', 'Inverter / Power Backup', 'Study Table & Chair', 'Washing Machine / Laundry', 'Mess / Food Included', 'Attached Washroom'],
    '{"1_sharing": 5000, "2_sharing": 3500, "3_sharing": 2800}'::jsonb
  ),
  (
    v_shop_pg_3,
    'boys',
    'professionals',
    12,
    2,
    3000,
    30,
    '11:00 PM',
    false,
    ARRAY['Wi-Fi', 'RO Drinking Water', 'Geyser / Hot Water', 'Attached Washroom', 'Inverter / Power Backup', 'Parking', 'Cupboard / Almirah', 'Daily Housekeeping'],
    '{"1_sharing": 4000, "2_sharing": 2800, "3_sharing": 2200}'::jsonb
  )
  ON CONFLICT (shop_id) DO UPDATE SET
    gender = EXCLUDED.gender,
    occupancy_target = EXCLUDED.occupancy_target,
    total_beds = EXCLUDED.total_beds,
    available_beds = EXCLUDED.available_beds,
    deposit_amount = EXCLUDED.deposit_amount,
    gate_closing_time = EXCLUDED.gate_closing_time,
    food_included = EXCLUDED.food_included,
    amenities = EXCLUDED.amenities,
    sharing_rates = EXCLUDED.sharing_rates;

  -- 7. INSERT MARATHI TRANSLATIONS
  INSERT INTO public.shop_translations (shop_id, locale, name, address, area)
  VALUES
    (v_shop_mess_1, 'mr', 'श्री स्वामी समर्थ भोजनालय (शुद्ध शाकाहारी)', 'शिवाजी कॉलेज जवळ, मेन रोड, मुक्ताईनगर', 'कॉलेज रोड'),
    (v_shop_mess_2, 'mr', 'कोल्हापुरी रुचिरा मेस आणि टिफिन सेंटर', 'स्टेशन रोड, एसटी बस स्टँड जवळ, मुक्ताईनगर', 'स्टेशन रोड'),
    (v_shop_mess_3, 'mr', 'अन्नपूर्णा घरगुती टिफिन व मेस', 'गांधी चौक, जुन्या पोस्ट ऑफिस जवळ, मुक्ताईनगर', 'गांधी चौक'),
    (v_shop_pg_1,   'mr', 'श्री साई बॉईज हॉस्टेल व पीजी', 'प्लॉट क्र. १२, शिवाजी कॉलेज मागे, मुक्ताईनगर', 'कॉलेज परिसर'),
    (v_shop_pg_2,   'mr', 'मातोश्री गर्ल्स पीजी व वसतिगृह', 'लेन क्र. ३, जेडीसीसी बँक जवळ, प्रतिभा नगर, मुक्ताईनगर', 'प्रतिभा नगर'),
    (v_shop_pg_3,   'mr', 'गुरुकृपा एक्झिक्युटिव्ह पीजी व रूम्स', 'स्टेशन रोड, पंचवटी कॉम्प्लेक्स जवळ, मुक्ताईनगर', 'स्टेशन रोड')
  ON CONFLICT (shop_id, locale) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    area = EXCLUDED.area;

END $$;
