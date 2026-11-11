-- ============================================================================
-- Patch: 2026-11-12_seed_education_notices_reviews.sql
-- Description:
--   Optional idempotent demo seed for the Education & Institutes Portal:
--   1. Ensures demo reviewer accounts exist in auth.users & public.profiles
--      matching the valid handle regex `^[a-z][a-z0-9_.]{2,23}$`.
--   2. Non-destructively enriches pre-existing seeded institutes where
--      structured admission/seat/transport metadata is still default ('unknown').
--   3. Seeds realistic bilingual (English + Marathi) pinned circulars into
--      `public.school_notices` for Maval/Parandwadi & Muktainagar institutes.
--   4. Seeds multi-lingual reviews (English, Marathi, Hinglish) into
--      `public.school_reviews`.
--
-- Prerequisites:
--   Run `supabase/migrations/20261112000000_education_portal_and_owner_hub.sql`
--   first, and seed schools via Admin Dashboard -> Education & Institutes.
-- Safe to re-run multiple times cleanly.
-- ============================================================================

BEGIN;

DO $$
DECLARE
  -- Reviewer UUIDs (aligned with 2026-11-09_seed_maval_parandwadi_reviews.sql)
  v_u_rohan    UUID := 'e1000000-0000-4000-8000-000000000001'; -- rohan_kadam
  v_u_shrikant UUID := 'e1000000-0000-4000-8000-000000000002'; -- shrikant_p
  v_u_ananya   UUID := 'e1000000-0000-4000-8000-000000000003'; -- ananya_s
  v_u_tanmay   UUID := 'e1000000-0000-4000-8000-000000000004'; -- tanmay_j
  v_u_priya    UUID := 'e1000000-0000-4000-8000-000000000005'; -- priya_d
  v_u_sachin   UUID := 'e1000000-0000-4000-8000-000000000006'; -- sachin_g
  v_u_vikram   UUID := 'e1000000-0000-4000-8000-000000000007'; -- vikram_r
  v_u_sneha    UUID := 'e1000000-0000-4000-8000-000000000008'; -- sneha_w

  -- School UUIDs resolved dynamically by name
  v_zp_parandwadi    UUID;
  v_birla            UUID;
  v_dyp_engg         UUID;
  v_dyp_poly         UUID;
  v_indrayani        UUID;
  v_indira           UUID;
  v_iti_talegaon     UUID;
  v_mimer            UUID;
  v_zp_muktainagar   UUID;
  v_mukta_high       UUID;
  v_khadse_college   UUID;
  v_iti_muktainagar  UUID;
  v_kbcnmu_center    UUID;

BEGIN
  -- 1. Ensure Demo Reviewer Accounts exist cleanly
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
  ON CONFLICT (id) DO NOTHING;

  -- 2. Resolve Existing Schools Dynamically
  SELECT id INTO v_zp_parandwadi   FROM public.schools WHERE name ILIKE 'Z.P. Primary School, Parandwadi%' LIMIT 1;
  SELECT id INTO v_birla           FROM public.schools WHERE name ILIKE 'B.K. Birla%' LIMIT 1;
  SELECT id INTO v_dyp_engg        FROM public.schools WHERE name ILIKE 'D.Y. Patil College of Engineering%' LIMIT 1;
  SELECT id INTO v_dyp_poly        FROM public.schools WHERE name ILIKE 'D.Y. Patil Polytechnic%' LIMIT 1;
  SELECT id INTO v_indrayani       FROM public.schools WHERE name ILIKE 'Indrayani Arts%' LIMIT 1;
  SELECT id INTO v_indira          FROM public.schools WHERE name ILIKE 'Indira College of Pharmacy%' LIMIT 1;
  SELECT id INTO v_iti_talegaon    FROM public.schools WHERE name ILIKE 'Government ITI Talegaon%' LIMIT 1;
  SELECT id INTO v_mimer           FROM public.schools WHERE name ILIKE 'MIMER Medical%' LIMIT 1;

  SELECT id INTO v_zp_muktainagar  FROM public.schools WHERE name ILIKE 'Z.P. Primary Central School, Muktainagar%' LIMIT 1;
  SELECT id INTO v_mukta_high      FROM public.schools WHERE name ILIKE 'Muktainagar High School%' LIMIT 1;
  SELECT id INTO v_khadse_college  FROM public.schools WHERE name ILIKE 'Smt. Godavaribai%' LIMIT 1;
  SELECT id INTO v_iti_muktainagar FROM public.schools WHERE name ILIKE 'Government ITI Muktainagar%' LIMIT 1;
  SELECT id INTO v_kbcnmu_center   FROM public.schools WHERE name ILIKE 'KBCNMU University Sub-Center%' LIMIT 1;

  -- 3. Non-destructive enrichment for pre-migration seeded schools
  IF v_zp_parandwadi IS NOT NULL THEN
    UPDATE public.schools SET
      admission_status = 'open',
      management_type = COALESCE(management_type, 'government'),
      fee_tier = CASE WHEN fee_tier = 'unspecified' THEN 'free' ELSE fee_tier END,
      classes_offered = COALESCE(classes_offered, '1st to 7th Std'),
      established_year = COALESCE(established_year, 1958),
      is_verified = true,
      transport_villages = CASE WHEN cardinality(transport_villages) = 0 THEN ARRAY['Parandwadi','Somatane','Shirgaon'] ELSE transport_villages END,
      scholarships = CASE WHEN cardinality(scholarships) = 0 THEN ARRAY['RTE 25% Free Admission','SC / ST / OBC / VJNT Freeship'] ELSE scholarships END,
      required_documents = CASE WHEN cardinality(required_documents) = 0 THEN ARRAY['Birth Certificate (जन्म दाखला)','Aadhaar Card (आधार कार्ड)','Passport Size Photos (3 copies)'] ELSE required_documents END
    WHERE id = v_zp_parandwadi AND admission_status = 'unknown';
  END IF;

  IF v_dyp_engg IS NOT NULL THEN
    UPDATE public.schools SET
      admission_status = 'ongoing',
      management_type = COALESCE(management_type, 'private'),
      fee_tier = CASE WHEN fee_tier = 'unspecified' THEN 'premium' ELSE fee_tier END,
      annual_fee_min = COALESCE(annual_fee_min, 88000),
      annual_fee_max = COALESCE(annual_fee_max, 112000),
      total_seats = COALESCE(total_seats, 360),
      available_seats = COALESCE(available_seats, 44),
      classes_offered = COALESCE(classes_offered, 'B.E. / B.Tech (4 Years Degree)'),
      accreditation = COALESCE(accreditation, 'AICTE Approved & NAAC Accredited'),
      is_verified = true,
      transport_villages = CASE WHEN cardinality(transport_villages) = 0 THEN ARRAY['Parandwadi','Talegaon Dabhade','Ambi','Nigdi','Chinchwad','Vadgaon Maval'] ELSE transport_villages END,
      scholarships = CASE WHEN cardinality(scholarships) = 0 THEN ARRAY['MahaDBT Post-Matric','EBC / Rajarshi Shahu Fee Waiver','SC / ST / OBC / VJNT Freeship','Panjabrao Deshmukh Hostel Allowance'] ELSE scholarships END,
      required_documents = CASE WHEN cardinality(required_documents) = 0 THEN ARRAY['MHT-CET / JEE / NEET Allotment Letter','Last Marksheet / Result (गुणपत्रिका)','Previous School Leaving Certificate (LC / TC)','Domicile / Nationality Certificate'] ELSE required_documents END
    WHERE id = v_dyp_engg AND admission_status = 'unknown';
  END IF;

  IF v_birla IS NOT NULL THEN
    UPDATE public.schools SET
      admission_status = 'open',
      management_type = COALESCE(management_type, 'trust'),
      gender_type = 'boys',
      fee_tier = CASE WHEN fee_tier = 'unspecified' THEN 'premium' ELSE fee_tier END,
      classes_offered = COALESCE(classes_offered, '4th to 12th (CBSE Day & Residential)'),
      established_year = COALESCE(established_year, 1998),
      is_verified = true,
      transport_villages = CASE WHEN cardinality(transport_villages) = 0 THEN ARRAY['Parandwadi','Somatane','Talegaon Dabhade','Dehu Road','Wakad'] ELSE transport_villages END,
      scholarships = CASE WHEN cardinality(scholarships) = 0 THEN ARRAY['Merit / Trust Scholarship'] ELSE scholarships END
    WHERE id = v_birla AND admission_status = 'unknown';
  END IF;

  IF v_indrayani IS NOT NULL THEN
    UPDATE public.schools SET
      admission_status = 'open',
      management_type = COALESCE(management_type, 'aided'),
      fee_tier = CASE WHEN fee_tier = 'unspecified' THEN 'low' ELSE fee_tier END,
      annual_fee_min = COALESCE(annual_fee_min, 4500),
      annual_fee_max = COALESCE(annual_fee_max, 18000),
      total_seats = COALESCE(total_seats, 600),
      available_seats = COALESCE(available_seats, 115),
      classes_offered = COALESCE(classes_offered, 'Jr. College & Senior Degree (BA/BCom/BSc/BBA/BCA)'),
      established_year = COALESCE(established_year, 1968),
      accreditation = COALESCE(accreditation, 'NAAC Accredited'),
      is_verified = true,
      transport_villages = CASE WHEN cardinality(transport_villages) = 0 THEN ARRAY['Talegaon Dabhade','Parandwadi','Vadgaon Maval','Somatane'] ELSE transport_villages END,
      scholarships = CASE WHEN cardinality(scholarships) = 0 THEN ARRAY['MahaDBT Post-Matric','EBC / Rajarshi Shahu Fee Waiver','SC / ST / OBC / VJNT Freeship'] ELSE scholarships END
    WHERE id = v_indrayani AND admission_status = 'unknown';
  END IF;

  IF v_indira IS NOT NULL THEN
    UPDATE public.schools SET
      admission_status = 'open',
      management_type = COALESCE(management_type, 'private'),
      fee_tier = CASE WHEN fee_tier = 'unspecified' THEN 'premium' ELSE fee_tier END,
      annual_fee_min = COALESCE(annual_fee_min, 85000),
      annual_fee_max = COALESCE(annual_fee_max, 125000),
      total_seats = COALESCE(total_seats, 240),
      available_seats = COALESCE(available_seats, 29),
      classes_offered = COALESCE(classes_offered, 'B.Pharm, D.Pharm, B.E., MBA'),
      accreditation = COALESCE(accreditation, 'PCI / AICTE Approved'),
      is_verified = true,
      transport_villages = CASE WHEN cardinality(transport_villages) = 0 THEN ARRAY['Parandwadi','Somatane','Wakad','Hinjewadi','Dehu Road','Talegaon Dabhade'] ELSE transport_villages END
    WHERE id = v_indira AND admission_status = 'unknown';
  END IF;

  -- 4. Seed Live Bilingual Circulars (`public.school_notices`)

  -- 4a. Z.P. Primary School, Parandwadi
  IF v_zp_parandwadi IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_zp_parandwadi,
      '2026-27 First Standard Enrollment & Free Textbooks Drive',
      '२०२६-२७ इयत्ता पहिली प्रवेश व मोफत गणवेश-पुस्तके वितरण',
      'Admissions open for 1st to 7th Standard (Marathi & Semi-English). Zero tuition fees, free Maharashtra State Board textbooks, uniforms, and daily hot Mid-Day Meal (Poshan). Bring Birth Certificate & Aadhaar Card between 10:30 AM and 3:30 PM.',
      'इयत्ता १ ली ते ७ वी साठी मोफत प्रवेश सुरू (मराठी व सेमी-इंग्रजी). शासनामार्फत मोफत पाठ्यपुस्तके, दोन गणवेश संच व दररोज मध्यान्ह भोजन. जन्म दाखला व आधार कार्डसह सकाळी १०:३० ते ३:३० या वेळेत संपर्क साधावा.',
      'admission', true, true, now() - INTERVAL '2 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_zp_parandwadi AND title = '2026-27 First Standard Enrollment & Free Textbooks Drive'
    );

    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_zp_parandwadi,
      'Parent-Teacher Gram Sabha & Scholarship Document Camp',
      'पालक सभा व शिष्यवृत्ती कागदपत्र नोंदणी शिबिर',
      'All parents of Std 4th and 5th students are requested to attend the Saturday 11:00 AM Gram Panchayat & School SMC meeting regarding Navodaya and Pre-Matric scholarship forms.',
      'इयत्ता ४ थी व ५ वीच्या सर्व पालकांनी नवोदय विद्यालय व पूर्व-माध्यमिक शिष्यवृत्ती अर्ज मार्गदर्शनासाठी शनिवारी सकाळी ११:०० वाजता शाळा व्यवस्थापन समिती बैठकीस उपस्थित राहावे.',
      'scholarship', false, true, now() - INTERVAL '6 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_zp_parandwadi AND title = 'Parent-Teacher Gram Sabha & Scholarship Document Camp'
    );
  END IF;

  -- 4b. D.Y. Patil College of Engineering & Innovation
  IF v_dyp_engg IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_dyp_engg,
      'B.E. Admissions 2026-27: CAP Round Verification & Spot Counseling',
      'बी.ई. अभियांत्रिकी प्रवेश २०२६-२७: CAP फेरी व समुपदेशन वेळापत्रक',
      'ARC & Document Verification Desk is open daily 9:30 AM – 5:00 PM at Admin Block Ground Floor. Computer Engineering, AI & Data Science, and Mechanical branches available. Bring MHT-CET/JEE scorecard, HSC marksheet & Caste Validity/EWS certificate.',
      'अभियांत्रिकी प्रवेश प्रक्रियेसाठी कागदपत्र पडताळणी कक्ष प्रशासकीय इमारतीत सकाळी ९:३० ते सायं. ५:०० वाजेपर्यंत सुरू आहे. संगणक, AI व डेटा सायन्स आणि मेकॅनिकल शाखा उपलब्ध.',
      'admission', true, true, now() - INTERVAL '1 day'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_dyp_engg AND title = 'B.E. Admissions 2026-27: CAP Round Verification & Spot Counseling'
    );

    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_dyp_engg,
      'MahaDBT EBC (Rajarshi Shahu) & Hostel Allowance Helpdesk',
      'महाडीबीटी ईबीसी (राजर्षी शाहू) व डॉ. पंजाबराव देशमुख वसतिगृह भत्ता मदत कक्ष',
      'Students eligible for 50% tuition waiver under Rajarshi Chhatrapati Shahu Maharaj Shikshan Shulkh Shishyavritti Scheme or Panjabrao Deshmukh Hostel Allowance should submit Income Certificate (under ₹8 Lakh) at Student Section Window 2.',
      'वार्षिक उत्पन्न ₹८ लाखापेक्षा कमी असणाऱ्या विद्यार्थ्यांनी ५०% शुल्क सवलत (ईबीसी) व वसतिगृह भत्ता अर्जासाठी विद्यार्थी विभाग खिडकी क्र. २ येथे उत्पन्नाचा दाखला जमा करावा.',
      'scholarship', false, true, now() - INTERVAL '4 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_dyp_engg AND title = 'MahaDBT EBC (Rajarshi Shahu) & Hostel Allowance Helpdesk'
    );

    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_dyp_engg,
      'Bus Route Schedule Updated: Parandwadi, Somatane Phata & Nigdi Pickup',
      'कॉलेज बस वेळापत्रक जाहीर: परंदवडी, सोमाटणे फाटा व निगडी मार्ग',
      'Morning shuttle buses depart Nigdi Bhakti-Shakti at 7:55 AM via Dehu Road, Somatane Phata (8:25 AM), and Parandwadi Chowk (8:35 AM). Evening return departures at 4:45 PM and 5:30 PM.',
      'सकाळी निगडी भक्ती-शक्ती येथून ७:५५ वाजता बस सुटेल — देहू रोड, सोमाटणे फाटा (८:२५) व परंदवडी चौक (८:३५). संध्याकाळी ४:४५ व ५:३० वाजता परतीच्या बस सुटतील.',
      'general', false, true, now() - INTERVAL '7 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_dyp_engg AND title = 'Bus Route Schedule Updated: Parandwadi, Somatane Phata & Nigdi Pickup'
    );
  END IF;

  -- 4c. B.K. Birla Centre for Education
  IF v_birla IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_birla,
      'CBSE Admissions Open (Std IV to XI) — Day & Residential Boarding',
      'सी.बी.एस.ई. प्रवेश प्रक्रिया सुरू (इयत्ता ४ थी ते ११ वी)',
      'Registration forms open for upcoming academic year. Campus tour and student interaction sessions conducted every Saturday 10 AM – 1 PM with prior appointment.',
      'आगामी शैक्षणिक वर्षासाठी प्रवेश अर्ज उपलब्ध आहेत. दर शनिवारी सकाळी १० ते १ दरम्यान पालक व विद्यार्थ्यांसाठी संकुल भेट व संवाद सत्र आयोजित केले जाते.',
      'admission', true, true, now() - INTERVAL '3 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_birla AND title = 'CBSE Admissions Open (Std IV to XI) — Day & Residential Boarding'
    );
  END IF;

  -- 4d. Indrayani Arts, Commerce & Science College
  IF v_indrayani IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_indrayani,
      'First Year UG/PG Merit List I Declared (BA / BCom / BSc / BBA / BCA)',
      'प्रथम वर्ष पदवी व पदव्युत्तर गुणवत्ता यादी जाहीर',
      'Candidates listed in First Merit List must confirm admission by paying fees online or at College Counter before Friday 4:00 PM along with Original HSC Marksheet and Leaving Certificate.',
      'प्रथम गुणवत्ता यादीत निवड झालेल्या विद्यार्थ्यांनी शुक्रवारी सायं. ४:०० वाजेपूर्वी मूळ बारावी गुणपत्रिका व शाळा सोडल्याच्या दाखल्यासह प्रवेश निश्चित करावा.',
      'admission', true, true, now() - INTERVAL '2 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_indrayani AND title = 'First Year UG/PG Merit List I Declared (BA / BCom / BSc / BBA / BCA)'
    );

    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_indrayani,
      'SPPU Semester Examination Form Submission Window Open',
      'सावित्रीबाई फुले पुणे विद्यापीठ सत्र परीक्षा अर्ज मुदत सूचना',
      'Regular and backlog students must complete SPPU exam portal forms without late fee within 10 working days and submit printed copy with fee receipt to Exam Cell.',
      'नियमित व बॅकलॉग विद्यार्थ्यांनी पुणे विद्यापीठ परीक्षा पोर्टलवर विलंब शुल्काशिवाय १० दिवसांत परीक्षा अर्ज भरून त्याची प्रत परीक्षा विभागात जमा करावी.',
      'exam', false, true, now() - INTERVAL '5 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_indrayani AND title = 'SPPU Semester Examination Form Submission Window Open'
    );
  END IF;

  -- 4e. Indira College of Pharmacy & Engineering
  IF v_indira IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_indira,
      'B.Pharm & D.Pharm CAP / Institute-Level Counseling Desk',
      'बी.फार्म व डी.फार्म प्रवेश प्रक्रिया व कागदपत्र तपासणी कक्ष',
      'Pharmacy aspirants with valid MHT-CET / NEET score can visit Somatane Phata Campus for branch counseling, lab tour, and scholarship guidance Monday to Saturday.',
      'औषधनिर्माणशास्त्र (B.Pharm / D.Pharm) प्रवेशासाठी सोमाटणे फाटा संकुलात समुपदेशन, प्रयोगशाळा भेट व शिष्यवृत्ती मार्गदर्शन सोमवार ते शनिवार उपलब्ध आहे.',
      'admission', true, true, now() - INTERVAL '3 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_indira AND title = 'B.Pharm & D.Pharm CAP / Institute-Level Counseling Desk'
    );
  END IF;

  -- 4f. MIMER Medical College
  IF v_mimer IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_mimer,
      'NEET UG / Physiotherapy Document Verification & Hostel Check-In',
      'वैद्यकीय (MBBS / फिजिओथेरपी) प्रवेश कागदपत्र पडताळणी व वसतिगृह सूचना',
      'Newly allotted MUHS / CET Cell candidates should report to Academic Dean Office with original NEET Admit Card, Allotment Letter, Medical Fitness Certificate, and Demand Draft.',
      'नवीन प्रवेशित विद्यार्थ्यांनी मूळ NEET प्रवेशपत्र, अलॉटमेंट लेटर, वैद्यकीय प्रमाणपत्र व आवश्यक कागदपत्रांसह अधिष्ठाता कार्यालयात संपर्क साधावा.',
      'admission', true, true, now() - INTERVAL '2 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_mimer AND title = 'NEET UG / Physiotherapy Document Verification & Hostel Check-In'
    );
  END IF;

  -- 4g. Muktainagar High School & Khadse College
  IF v_mukta_high IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_mukta_high,
      '11th Science, Commerce & Arts Admissions Open (FYJC)',
      'इयत्ता ११ वी विज्ञान, वाणिज्य व कला प्रवेश प्रक्रिया सुरू',
      'Students passing 10th SSC are invited to submit Admission Forms at Junior College Office Window 1 (8:00 AM – 1:30 PM). Dedicated JEE/MHT-CET foundation batch available for Science stream.',
      'दहावी उत्तीर्ण विद्यार्थ्यांनी कनिष्ठ महाविद्यालय कार्यालय खिडकी क्र. १ येथे सकाळी ८:०० ते १:३० दरम्यान प्रवेश अर्ज सादर करावेत. विज्ञान शाखेसाठी MHT-CET मार्गदर्शन बॅच उपलब्ध.',
      'admission', true, true, now() - INTERVAL '2 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_mukta_high AND title = '11th Science, Commerce & Arts Admissions Open (FYJC)'
    );
  END IF;

  IF v_khadse_college IS NOT NULL THEN
    INSERT INTO public.school_notices (school_id, title, title_mr, body, body_mr, category, is_pinned, is_active, created_at)
    SELECT
      v_khadse_college,
      'KBCNMU Degree Admissions & MahaDBT Freeship Desk',
      'क.ब.चौ.उ.म.वि. पदवी प्रवेश व महाडीबीटी शिष्यवृत्ती मदत कक्ष',
      'BA, BCom, BSc, BBA & BCA registrations open. SC/ST/OBC/EBC students can avail complete MahaDBT online form filing support at Computer Lab Room 104.',
      'बी.ए., बी.कॉम., बी.एस्सी., बी.बी.ए. व बी.सी.ए. प्रवेश नोंदणी सुरू आहे. विद्यार्थ्यांसाठी महाडीबीटी शिष्यवृत्ती अर्ज भरण्याची मोफत सुविधा संगणक कक्ष १०४ मध्ये उपलब्ध आहे.',
      'scholarship', true, true, now() - INTERVAL '3 days'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.school_notices WHERE school_id = v_khadse_college AND title = 'KBCNMU Degree Admissions & MahaDBT Freeship Desk'
    );
  END IF;

  -- 5. Seed Realistic Student / Parent Reviews (`public.school_reviews`)

  -- 5a. D.Y. Patil College of Engineering & Innovation
  IF v_dyp_engg IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_dyp_engg, v_u_rohan, 4,
      'Labs and coding clubs are genuinely active, and campus placement training starts from 3rd year itself. Parandwadi chowk se college bus ya auto easily mil jata hai. Only improvement needed is better afternoon canteen variety.',
      16, now() - INTERVAL '3 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_dyp_engg, v_u_ananya, 5,
      'Clean green campus away from city traffic noise. AI & Data Science faculty members are very supportive for hackathons and SPPU project reviews. Great library facilities.',
      11, now() - INTERVAL '6 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_dyp_engg, v_u_shrikant, 4,
      'मावळ तालुक्यातील विद्यार्थ्यांसाठी पुण्यापर्यंत प्रवास न करता जवळच उत्तम अभियांत्रिकी शिक्षणाची सोय. महाडीबीटी ईबीसी शिष्यवृत्ती प्रक्रियेत कार्यालयीन कर्मचारी चांगली मदत करतात.',
      8, now() - INTERVAL '9 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5b. Z.P. Primary School, Parandwadi
  IF v_zp_parandwadi IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_zp_parandwadi, v_u_shrikant, 5,
      'गावातील डिजिटल जि.प. शाळेने खरोखर प्रगती केली आहे. शिक्षक वर्गात वैयक्तिक लक्ष देतात, मध्यान्ह भोजन स्वच्छ व पौष्टिक असते आणि सेमी-इंग्रजीमुळे मुलांचा पाया मजबूत होत आहे.',
      19, now() - INTERVAL '2 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_zp_parandwadi, v_u_sneha, 5,
      'माझ्या मुलाचे इयत्ता दुसरीतील वाचन व गणित खूप सुधारले आहे. कोणत्याही खाजगी शुल्काशिवाय इतके चांगले शिक्षण परंदवडीतच मिळते याचा अभिमान आहे.',
      10, now() - INTERVAL '8 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5c. B.K. Birla Centre for Education
  IF v_birla IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_birla, v_u_vikram, 5,
      'Outstanding CBSE residential & day school infrastructure along Somatane corridor. Swimming pool, horse riding, robotics labs, and disciplined boarding environment stand out in the entire Pune-Lonavala belt.',
      14, now() - INTERVAL '4 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_birla, v_u_ananya, 4,
      'Strong focus on academics as well as sports and leadership. Fees are on the higher premium side as expected for a boarding campus, so plan accordingly.',
      7, now() - INTERVAL '11 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5d. Indrayani Arts, Commerce & Science College
  IF v_indrayani IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_indrayani, v_u_priya, 4,
      'Talegaon & Parandwadi area me affordable aur trusted SPPU college. Aided sections ki fees kaafi kam hai aur NSS/NCC activities bohot active hain.',
      12, now() - INTERVAL '5 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_indrayani, v_u_sachin, 5,
      'मावळ ग्रामीण भागातील विद्यार्थ्यांचे हक्काचे व परवडणारे महाविद्यालय. ग्रंथालयात स्पर्धा परीक्षांची पुस्तकेही भरपूर उपलब्ध आहेत.',
      9, now() - INTERVAL '10 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5e. Indira College of Pharmacy & Engineering
  IF v_indira IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_indira, v_u_priya, 5,
      'Pharmacy labs well-equipped hain aur Somatane Phata highway touch hone ki wajah se Pune aur Talegaon dono side se easy connectivity hai. Placement cell bhi supportive hai.',
      15, now() - INTERVAL '3 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_indira, v_u_tanmay, 4,
      'Good discipline and industry-oriented seminars for B.Pharm and MBA students. Morning highway crossing near Somatane gets busy, so leaving 15 mins early helps.',
      6, now() - INTERVAL '7 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5f. D.Y. Patil Polytechnic, Ambi
  IF v_dyp_poly IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_dyp_poly, v_u_rohan, 4,
      'After 10th diploma karne walo ke liye practical workshop aur MSBTE exam preparation strong hai. Direct 2nd year engineering transition easy ho jata hai.',
      8, now() - INTERVAL '5 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;

    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_dyp_poly, v_u_sachin, 3,
      'प्रयोगशाळा व शिक्षण चांगले आहे, मात्र आंबी रस्त्यावर संध्याकाळच्या बस फेऱ्या वाढवल्यास ग्रामीण विद्यार्थ्यांना अधिक सोयीचे होईल.',
      5, now() - INTERVAL '12 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5g. MIMER Medical College
  IF v_mimer IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_mimer, v_u_vikram, 4,
      'Attached 700-bed Bhausaheb Sardesai hospital gives huge clinical exposure to MBBS and Physiotherapy students. Calm campus environment just off Somatane road.',
      13, now() - INTERVAL '4 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  -- 5h. Muktainagar Schools & College
  IF v_mukta_high IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_mukta_high, v_u_sneha, 5,
      'मुक्ताईनगरमधील अत्यंत जुनी आणि शिस्तबद्ध शाळा. दहावी व बारावीचा निकाल दरवर्षी उत्तम लागतो. क्रीडा व सांस्कृतिक उपक्रमांनाही तितकेच प्रोत्साहन दिले जाते.',
      11, now() - INTERVAL '4 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

  IF v_khadse_college IS NOT NULL THEN
    INSERT INTO public.school_reviews (school_id, user_id, rating, body, helpful_count, created_at)
    VALUES (
      v_khadse_college, v_u_tanmay, 5,
      'NAAC Grade A accreditation with affordable KBCNMU degree courses. Surrounding villages like Kurha and Bodwad se students aate hain, and library + computer labs well maintained hain.',
      10, now() - INTERVAL '6 days'
    ) ON CONFLICT (school_id, user_id) DO UPDATE SET rating = EXCLUDED.rating, body = EXCLUDED.body;
  END IF;

END $$;

COMMIT;
