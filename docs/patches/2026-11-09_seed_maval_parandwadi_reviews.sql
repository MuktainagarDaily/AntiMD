-- ============================================================================
-- Patch: 2026-11-09_seed_maval_parandwadi_reviews.sql (v2 - Fixed)
-- Description:
--   1. Ensures Parandwadi has its dedicated Mess, PG, and Student Hostel listings
--   2. Seeds authentic dummy user accounts in auth.users and public.profiles
--      using valid username handles matching `^[a-z][a-z0-9_.]{2,23}$`
--   3. Seeds multi-lingual reviews (English, Hinglish, Marathi) across:
--      - Local Shops (Kirana, Medical, Restaurants, Auto, Cafes)
--      - Mess & Tiffin Services (Vegetarian & Non-Veg, Unlimited Thalis)
--      - Paying Guest (PG) & Student Hostels (Boys & Girls)
--   4. Idempotent: safe to run multiple times without duplicating reviews
-- ============================================================================

BEGIN;

DO $$
DECLARE
  v_state_id     UUID;
  v_pune_dist_id UUID;
  v_maval_id     UUID;
  v_parandwadi_id UUID;

  -- Category UUIDs
  v_cat_grocery     UUID;
  v_cat_medical     UUID;
  v_cat_restaurant  UUID;
  v_cat_mess        UUID;
  v_cat_pg          UUID;
  v_cat_snacks      UUID;
  v_cat_auto        UUID;

  -- Entity Shop UUIDs
  v_shop_mauli_kirana UUID;
  v_shop_sai_medical  UUID;
  v_shop_visawa_rest  UUID;
  v_shop_kolhapuri    UUID;
  v_shop_yewale_tea   UUID;
  v_shop_ganesh_bike  UUID;
  
  -- Maval Mess & PG UUIDs
  v_mess_dypatil_uuid UUID := 'c1111111-1111-4111-8111-111111111111';
  v_mess_annapurna_uuid UUID := 'c2222222-2222-4222-8222-222222222222';
  v_pg_dypatil_boys_uuid UUID := 'd1111111-1111-4111-8111-111111111111';
  v_pg_saikrupa_girls_uuid UUID := 'd2222222-2222-4222-8222-222222222222';

  -- User Reviewer UUIDs
  v_u_rohan    UUID := 'e1000000-0000-4000-8000-000000000001'; -- rohan_kadam (Engg student, Hinglish)
  v_u_shrikant UUID := 'e1000000-0000-4000-8000-000000000002'; -- shrikant_p (Local resident, Marathi)
  v_u_ananya   UUID := 'e1000000-0000-4000-8000-000000000003'; -- ananya_s (Tech professional, English)
  v_u_tanmay   UUID := 'e1000000-0000-4000-8000-000000000004'; -- tanmay_j (Highway commuter, Mix)
  v_u_priya    UUID := 'e1000000-0000-4000-8000-000000000005'; -- priya_d (Girls PG resident, Hinglish/Marathi)
  v_u_sachin   UUID := 'e1000000-0000-4000-8000-000000000006'; -- sachin_g (Farmer/Local, Marathi)
  v_u_vikram   UUID := 'e1000000-0000-4000-8000-000000000007'; -- vikram_r (Weekend visitor, English)
  v_u_sneha    UUID := 'e1000000-0000-4000-8000-000000000008'; -- sneha_w (Homemaker, Marathi)

BEGIN
  -- 1. Resolve Geographic IDs
  SELECT id INTO v_maval_id FROM public.geo_cities WHERE slug = 'maval' LIMIT 1;
  IF v_maval_id IS NULL THEN
    RAISE EXCEPTION 'City Maval not found!';
  END IF;

  SELECT district_id INTO v_pune_dist_id FROM public.geo_cities WHERE id = v_maval_id;
  SELECT state_id INTO v_state_id FROM public.geo_districts WHERE id = v_pune_dist_id;
  SELECT id INTO v_parandwadi_id FROM public.geo_villages WHERE city_id = v_maval_id AND slug = 'parandwadi' LIMIT 1;

  -- 2. Resolve Categories
  SELECT id INTO v_cat_grocery FROM public.categories WHERE name ILIKE 'Grocery%' LIMIT 1;
  SELECT id INTO v_cat_medical FROM public.categories WHERE name ILIKE 'Medical%' LIMIT 1;
  SELECT id INTO v_cat_restaurant FROM public.categories WHERE name ILIKE 'Restaurant%' LIMIT 1;
  SELECT id INTO v_cat_mess FROM public.categories WHERE name ILIKE 'Mess%' LIMIT 1;
  SELECT id INTO v_cat_pg FROM public.categories WHERE name ILIKE 'PG%' LIMIT 1;
  SELECT id INTO v_cat_snacks FROM public.categories WHERE name ILIKE 'Snacks%' LIMIT 1;
  SELECT id INTO v_cat_auto FROM public.categories WHERE name ILIKE 'Auto%' LIMIT 1;

  -- 3. Seed Dedicated Parandwadi Mess & PG Listings (if not already present)
  -- 3a. DY Patil Campus Mess
  INSERT INTO public.shops (
    id, name, slug, area, sub_area, address, phone, whatsapp, category_id,
    is_active, is_verified, state_id, district_id, city_id, village_id
  ) VALUES (
    v_mess_dypatil_uuid,
    'Mauli Ruchira Mess & Student Dining',
    'mauli-ruchira-mess-parandwadi',
    'Parandwadi',
    'Near DY Patil College Campus',
    'Survey No. 42, College Road, Parandwadi, Taluka Maval',
    '9822114455', '9822114455', v_cat_mess,
    true, true, v_state_id, v_pune_dist_id, v_maval_id, v_parandwadi_id
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city_id = v_maval_id, village_id = v_parandwadi_id;

  INSERT INTO public.mess_profiles (
    shop_id, mess_type, monthly_rate, single_thali_rate, tiffin_delivery, lunch_timing, dinner_timing, sunday_feast
  ) VALUES (
    v_mess_dypatil_uuid, 'veg_nonveg', 3200, 90, true, '11:30 AM - 02:30 PM', '07:30 PM - 10:30 PM', true
  ) ON CONFLICT (shop_id) DO NOTHING;

  -- 3b. Annapurna Pure Veg Home Mess
  INSERT INTO public.shops (
    id, name, slug, area, sub_area, address, phone, whatsapp, category_id,
    is_active, is_verified, state_id, district_id, city_id, village_id
  ) VALUES (
    v_mess_annapurna_uuid,
    'Annapurna Pure Veg Home Mess',
    'annapurna-pure-veg-mess-parandwadi',
    'Parandwadi',
    'Grampanchayat Road',
    'Near Maruti Temple, Parandwadi Village, Maval',
    '9822114456', '9822114456', v_cat_mess,
    true, true, v_state_id, v_pune_dist_id, v_maval_id, v_parandwadi_id
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city_id = v_maval_id, village_id = v_parandwadi_id;

  INSERT INTO public.mess_profiles (
    shop_id, mess_type, monthly_rate, single_thali_rate, tiffin_delivery, lunch_timing, dinner_timing, sunday_feast
  ) VALUES (
    v_mess_annapurna_uuid, 'pure_veg', 2800, 80, true, '12:00 PM - 03:00 PM', '07:30 PM - 10:00 PM', false
  ) ON CONFLICT (shop_id) DO NOTHING;

  -- 3c. DY Patil Executive Boys Hostel & PG
  INSERT INTO public.shops (
    id, name, slug, area, sub_area, address, phone, whatsapp, category_id,
    is_active, is_verified, state_id, district_id, city_id, village_id
  ) VALUES (
    v_pg_dypatil_boys_uuid,
    'Gurukrupa Executive Boys PG & Hostel',
    'gurukrupa-boys-hostel-parandwadi',
    'Parandwadi',
    'Near Ambi-Parandwadi Bridge',
    'Plot 15, Green Meadows, Parandwadi, Maval',
    '9822114457', '9822114457', v_cat_pg,
    true, true, v_state_id, v_pune_dist_id, v_maval_id, v_parandwadi_id
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city_id = v_maval_id, village_id = v_parandwadi_id;

  INSERT INTO public.pg_profiles (
    shop_id, gender, occupancy_target, total_beds, available_beds, deposit_amount, notice_period_days,
    gate_closing_time, food_included, amenities, sharing_rates
  ) VALUES (
    v_pg_dypatil_boys_uuid, 'boys', 'students', 45, 6, 5000, 30, '10:30 PM', true,
    ARRAY['Wi-Fi', 'Hot Water', 'RO Drinking Water', 'CCTV Security', 'Study Table', 'Parking'],
    '{"1_sharing": 8500, "2_sharing": 5500, "3_sharing": 4200}'::jsonb
  ) ON CONFLICT (shop_id) DO NOTHING;

  -- 3d. Saikrupa Girls Residence PG
  INSERT INTO public.shops (
    id, name, slug, area, sub_area, address, phone, whatsapp, category_id,
    is_active, is_verified, state_id, district_id, city_id, village_id
  ) VALUES (
    v_pg_saikrupa_girls_uuid,
    'Saikrupa Deluxe Girls PG & Residence',
    'saikrupa-girls-pg-parandwadi',
    'Parandwadi',
    'DY Patil Campus West Gate',
    'Sector 3, Parandwadi Main Road, Maval',
    '9822114458', '9822114458', v_cat_pg,
    true, true, v_state_id, v_pune_dist_id, v_maval_id, v_parandwadi_id
  ) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, city_id = v_maval_id, village_id = v_parandwadi_id;

  INSERT INTO public.pg_profiles (
    shop_id, gender, occupancy_target, total_beds, available_beds, deposit_amount, notice_period_days,
    gate_closing_time, food_included, amenities, sharing_rates
  ) VALUES (
    v_pg_saikrupa_girls_uuid, 'girls', 'students', 30, 4, 6000, 30, '09:30 PM', true,
    ARRAY['24x7 Security Guard', 'Wi-Fi', 'Biometric Entry', 'Solar Water', 'Washing Machine', 'Power Backup'],
    '{"1_sharing": 9500, "2_sharing": 6500, "3_sharing": 5000}'::jsonb
  ) ON CONFLICT (shop_id) DO NOTHING;


  -- 4. Seed Dummy Reviewer Accounts in auth.users
  -- NOTE: Pass valid lower-case handle into raw_user_meta_data->>'full_name'
  -- so that the auto-profile trigger generates handles adhering to: ^[a-z][a-z0-9_.]{2,23}$
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES
    (v_u_rohan,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'rohan.kadam.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"rohan_kadam"}', now(), now()),
    (v_u_shrikant, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'shrikant.patil.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"shrikant_p"}', now(), now()),
    (v_u_ananya,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ananya.sharma.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"ananya_s"}', now(), now()),
    (v_u_tanmay,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tanmay.joshi.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"tanmay_j"}', now(), now()),
    (v_u_priya,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'priya.deshmukh.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"priya_d"}', now(), now()),
    (v_u_sachin,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sachin.gaikwad.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"sachin_g"}', now(), now()),
    (v_u_vikram,   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vikram.rao.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"vikram_r"}', now(), now()),
    (v_u_sneha,    '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'sneha.wagh.demo@apnalocal.in', '$2a$10$abcdefghijklmnopqrstuu', now(), '{"provider":"email","providers":["email"]}', '{"full_name":"sneha_w"}', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- Ensure matching public.profiles exist with valid username and phone
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES
    (v_u_rohan,    'rohan_kadam', '9822001121'),
    (v_u_shrikant, 'shrikant_p',  '9822001122'),
    (v_u_ananya,   'ananya_s',    '9822001123'),
    (v_u_tanmay,   'tanmay_j',    '9822001124'),
    (v_u_priya,    'priya_d',     '9822001125'),
    (v_u_sachin,   'sachin_g',    '9822001126'),
    (v_u_vikram,   'vikram_r',    '9822001127'),
    (v_u_sneha,    'sneha_w',     '9822001128')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name;

  -- Resolve Key Real Parandwadi Shops
  SELECT id INTO v_shop_mauli_kirana FROM public.shops WHERE slug = 'mauli-kirana-general-stores-parandwadi' LIMIT 1;
  SELECT id INTO v_shop_sai_medical  FROM public.shops WHERE slug = 'shree-sai-medical-chemist-parandwadi' LIMIT 1;
  SELECT id INTO v_shop_visawa_rest  FROM public.shops WHERE slug = 'hotel-visawa-family-restaurant-parandwadi' LIMIT 1;
  SELECT id INTO v_shop_kolhapuri    FROM public.shops WHERE slug = 'hotel-kolhapuri-misal-house-parandwadi' LIMIT 1;
  SELECT id INTO v_shop_yewale_tea   FROM public.shops WHERE slug = 'yewale-amruttulya-chaha-parandwadi' LIMIT 1;
  SELECT id INTO v_shop_ganesh_bike  FROM public.shops WHERE slug = 'shree-ganesh-bike-service-center-parandwadi' LIMIT 1;


  -- 5. Seed Reviews: Mess & Tiffin Services (Mixed, Praise & Critique)
  -- 5a. Mauli Ruchira Mess
  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_mess_dypatil_uuid, v_u_rohan, 4,
    'Unlimited chapati dete hain aur taste truly ghar jaisa hai, hostel students ke liye best deal. But Sunday non-veg ke time bohot bheed hoti hai, 15 min wait karna padta hai. Seating space thoda badhana chahiye.',
    14, now() - INTERVAL '3 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_mess_dypatil_uuid, v_u_shrikant, 5,
    'परंदवडी कॉलेज परिसरातील मुलांसाठी अतिशय सोयीची मेस. जेवणाची चव घरगुती आहे, विशेषतः डाळ तडका आणि सुकी भाजी एकदम रुचकर असते. मासिक दर अगदी योग्य आहेत.',
    9, now() - INTERVAL '6 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_mess_dypatil_uuid, v_u_ananya, 3,
    'Hygiene and food quality are well maintained. However, the night dinner timings close strictly at 10 PM. For IT folks or college students with project work, keeping it open until 10:30 PM would be very helpful.',
    5, now() - INTERVAL '10 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  -- 5b. Annapurna Pure Veg Home Mess
  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_mess_annapurna_uuid, v_u_sneha, 5,
    'शुद्ध शाकाहारी आणि अत्यंत सात्विक जेवण. तेला-मसाल्याचा अतिरेक नसतो, त्यामुळे पोट बिघडत नाही. टिफिन वेळेवर पोहोचतो.',
    12, now() - INTERVAL '4 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_mess_annapurna_uuid, v_u_tanmay, 3,
    'Taste accha hai pure veg walo ke liye, par sabji ka portion size tiffin me thoda chhota rehta hai. Bhakri option add karenge toh aur better hoga.',
    3, now() - INTERVAL '12 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;


  -- 6. Seed Reviews: Paying Guest (PG) & Student Hostels
  -- 6a. Gurukrupa Boys PG
  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_pg_dypatil_boys_uuid, v_u_rohan, 4,
    'Rooms are very airy and clean, study table aur wardrobe individual milta hai. Wi-Fi speed is good for lectures. Ek chhota issue hai ki morning hot water bas 2 ghante rehta hai, winters me rush ho jata hai. Overall worth the rent.',
    18, now() - INTERVAL '5 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_pg_dypatil_boys_uuid, v_u_sachin, 2,
    'खोली छान आहे पण महिन्यातून दोनदा अचानक पाणी संपते. वॉर्डनला सांगूनही पंप सुरू करायला वेळ लागतो. मेन्टेनन्स त्वरित केला तरच विद्यार्थ्यांचे नुकसान टळेल.',
    7, now() - INTERVAL '8 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  -- 6b. Saikrupa Girls PG
  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_pg_saikrupa_girls_uuid, v_u_priya, 5,
    'Super safe and peaceful place for girls in Parandwadi! 24x7 security guard, CCTV cameras, and biometric entry system provides full peace of mind to our parents. Warden aunty is very caring.',
    22, now() - INTERVAL '2 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

  INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
  VALUES (
    v_pg_saikrupa_girls_uuid, v_u_ananya, 4,
    'Cleanest PG near campus. High-speed Wi-Fi and power backup works reliably. Only feedback: gate closing time 9:30 PM is slightly strict on weekends if we are coming from Pune city.',
    11, now() - INTERVAL '7 days'
  ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;


  -- 7. Seed Reviews: Local Shops (Kirana, Medical, Restaurants, Auto)
  -- 7a. Mauli Kirana & General Stores
  IF v_shop_mauli_kirana IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_mauli_kirana, v_u_shrikant, 5,
      'परंदवडी गावातील सर्वात जुने आणि विश्वासू किराणा दुकान. माल नेहमी ताजा असतो, पॅकिंग उत्तम असते आणि ऑनलाईन फोनपे पेमेंट लगेच घेतात. काकांचा स्वभाव खूप चांगला आहे.',
      15, now() - INTERVAL '1 day'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_mauli_kirana, v_u_rohan, 4,
      'Hostel students ke daily items (noodles, biscuits, soap) sab mil jate hain. Evening 7-8 PM rush me thoda counter pe wait karna padta hai. Overall very convenient.',
      6, now() - INTERVAL '4 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 7b. Shree Sai Medical & Chemist
  IF v_shop_sai_medical IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_sai_medical, v_u_ananya, 5,
      'Lifesaver pharmacy in Parandwadi! They keep all regular prescriptions and even arranged a specific asthma inhaler for my family within 2 hours. Prompt and courteous service.',
      19, now() - INTERVAL '2 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_sai_medical, v_u_sachin, 3,
      'औषधे मिळतात पण रात्री १० नंतर दुकान बंद असते. हायवे जवळ असल्याने किमान एका तरी मेडिकलने आपत्कालीन सेवेसाठी नाईट काउंटर सुरू ठेवायला हवे.',
      8, now() - INTERVAL '9 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 7c. Hotel Visawa Family Restaurant
  IF v_shop_visawa_rest IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_visawa_rest, v_u_vikram, 4,
      'Great stop while traveling on the old Mumbai-Pune route. The chicken sukka and gavran handi are bursting with authentic Maval spices. Spacious family section, but parking area gets dusty.',
      16, now() - INTERVAL '3 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_visawa_rest, v_u_tanmay, 3,
      'Food is delicious no doubt, but service is slow on weekends. Humne order diya aur 35 minutes lag gaye starter aane me. Staff thoda active hona chahiye.',
      5, now() - INTERVAL '8 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 7d. Hotel Kolhapuri Misal House
  IF v_shop_kolhapuri IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_kolhapuri, v_u_rohan, 5,
      'Ek number jhanjhanit misal! Tarri ka colour aur taste ekdum authentic Kolhapuri hai. Extra rassa mangne par mana nahi karte. College doston ke sath nashte ka permanent adda.',
      24, now() - INTERVAL '1 day'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_kolhapuri, v_u_sneha, 4,
      'मिसळ खूप चवदार आणि झणझणीत आहे. पण लहान मुलांसाठी थोडा कमी तिखट पर्याय हवा. पापड आणि ताक नेहमी ताजे मिळते.',
      7, now() - INTERVAL '5 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 7e. Yewale Amruttulya Chaha
  IF v_shop_yewale_tea IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_yewale_tea, v_u_tanmay, 5,
      'Old highway road pe refreshing tea stop! Chai consistently tasty rehti hai aur garma-garam cream roll ka combination best hai. Quick service.',
      13, now() - INTERVAL '2 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 7f. Shree Ganesh Bike Service Center
  IF v_shop_ganesh_bike IS NOT NULL THEN
    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_ganesh_bike, v_u_sachin, 5,
      'माझी मोटारसायकल हायवेवर अचानक बंद पडली होती. गणेश दादांनी जागेवर येऊन स्पार्क प्लग व ऑईल बदलून गाडी चालू करून दिली. वाजवी दर घेतले, कसलीही लूटमार नाही.',
      17, now() - INTERVAL '4 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.shop_reviews (shop_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_shop_ganesh_bike, v_u_tanmay, 4,
      'Servicing quality is solid, bike pickup feels brand new. Sirf delivery time 2 hours late diya tha afternoon me. Baki mechanic honest hai aur faltu parts change nahi karwata.',
      6, now() - INTERVAL '7 days'
    ) ON CONFLICT (shop_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

END $$;

COMMIT;
