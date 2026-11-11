-- ============================================================================
-- Muktainagar Daily — Bus Timetable Marathi backfill (2026-06-27)
-- ----------------------------------------------------------------------------
-- Safe to re-run. Fills `destination_mr` for every seeded destination so the
-- Bus Timetable page can render Marathi labels when the user switches lang.
--
-- Strategy:
--   * Idempotent: only updates rows where destination_mr IS NULL OR empty,
--     so manual admin edits are never overwritten.
--   * Matches on the English `destination` column (the seed key).
--   * If the bus_timetable table doesn't exist yet, the patch is a no-op
--     (wrapped in a DO block + to_regclass check) so it's safe to apply on
--     environments where the base bus_timetable patch hasn't been run.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.bus_timetable') IS NULL THEN
    RAISE NOTICE 'public.bus_timetable not found — skipping Marathi backfill.';
    RETURN;
  END IF;

  WITH translations(destination, destination_mr) AS (
    VALUES
      ('Akola',                       'अकोला'),
      ('Amalner',                     'अमळनेर'),
      ('Amravati',                    'अमरावती'),
      ('Bhusawal',                    'भुसावळ'),
      ('Burhanpur',                   'बुऱ्हाणपूर'),
      ('Chalisgaon',                  'चाळीसगाव'),
      ('Chhatrapati Sambhaji Nagar',  'छत्रपती संभाजीनगर'),
      ('Chikhli',                     'चिखली'),
      ('Dhule',                       'धुळे'),
      ('Gangakhed',                   'गंगाखेड'),
      ('Indore',                      'इंदूर'),
      ('Jalgaon',                     'जळगाव'),
      ('Kalamnuri',                   'कळमनुरी'),
      ('Karanja',                     'कारंजा'),
      ('Khamgaon',                    'खामगाव'),
      ('Mahurgad',                    'माहूरगड'),
      ('Malegaon',                    'मालेगाव'),
      ('Mangrulpir',                  'मंगरूळपीर'),
      ('Manmad',                      'मनमाड'),
      ('Mehkar',                      'मेहकर'),
      ('Nagpur',                      'नागपूर'),
      ('Nandurbar',                   'नंदुरबार'),
      ('Nandurgad',                   'नांदूरगड'),
      ('Nashik',                      'नाशिक'),
      ('Pandharpur',                  'पंढरपूर'),
      ('Paratwada',                   'परतवाडा'),
      ('Pune',                        'पुणे'),
      ('Pusad',                       'पुसद'),
      ('Ralegaon',                    'राळेगाव'),
      ('Sakri',                       'साक्री'),
      ('Shegaon',                     'शेगाव'),
      ('Shirkhed',                    'शिरखेड'),
      ('Shirdi',                      'शिर्डी'),
      ('Thane',                       'ठाणे'),
      ('Yavatmal',                    'यवतमाळ'),
      ('Yawal',                       'यावल'),
      -- Common aliases / variants from the screenshot just in case
      ('Risod',                       'रिसोड'),
      ('Risod (Ralegaon)',            'रिसोड (राळेगाव)')
  )
  UPDATE public.bus_timetable t
     SET destination_mr = tr.destination_mr,
         updated_at     = now()
    FROM translations tr
   WHERE t.destination = tr.destination
     AND (t.destination_mr IS NULL OR btrim(t.destination_mr) = '');
END $$;

-- ============================================================================
-- END
-- ============================================================================