-- ============================================================================
-- 2026-06-02  i18n wireup follow-up
-- Backfills `amenity_translations` with the full amenity vocabulary used by
-- AmenitiesPicker (en + mr) and tightens defensive constraints.
-- Idempotent: safe to re-run.
-- ============================================================================

INSERT INTO public.amenity_translations (amenity_key, locale, label) VALUES
  -- core
  ('parking','en','Parking'),             ('parking','mr','पार्किंग'),
  ('ac','en','AC'),                       ('ac','mr','एसी'),
  ('wifi','en','Wi-Fi'),                  ('wifi','mr','वाय-फाय'),
  ('card','en','Card Payment'),           ('card','mr','कार्ड पेमेंट'),
  ('upi','en','UPI'),                     ('upi','mr','यूपीआय'),
  ('home_delivery','en','Home Delivery'), ('home_delivery','mr','होम डिलिव्हरी'),
  -- extras commonly used
  ('cash_only','en','Cash Only'),         ('cash_only','mr','फक्त रोख'),
  ('washroom','en','Washroom'),           ('washroom','mr','स्वच्छतागृह'),
  ('lift','en','Lift'),                   ('lift','mr','लिफ्ट'),
  ('drinking_water','en','Drinking Water'),('drinking_water','mr','पिण्याचे पाणी'),
  ('seating','en','Seating'),             ('seating','mr','बसण्याची सोय'),
  ('takeaway','en','Takeaway'),           ('takeaway','mr','पार्सल'),
  ('dine_in','en','Dine-in'),             ('dine_in','mr','डायन-इन'),
  ('online_order','en','Online Order'),   ('online_order','mr','ऑनलाइन ऑर्डर'),
  ('emi','en','EMI Available'),           ('emi','mr','ईएमआय उपलब्ध'),
  ('warranty','en','Warranty'),           ('warranty','mr','वॉरंटी'),
  ('repair','en','Repair Service'),       ('repair','mr','दुरुस्ती सेवा'),
  ('appointment','en','By Appointment'),  ('appointment','mr','अपॉइंटमेंटने'),
  ('open_24x7','en','Open 24×7'),         ('open_24x7','mr','२४×७ सुरू')
ON CONFLICT (amenity_key, locale) DO UPDATE SET label = EXCLUDED.label;

-- Helpful index for translation lookups by locale
CREATE INDEX IF NOT EXISTS amenity_translations_locale_idx
  ON public.amenity_translations (locale);

-- Sanity: confirm shop_translations only stores 'mr' rows (en lives on shops).
-- (Constraint already in place via CHECK; left here as documentation.)
-- ALTER TABLE public.shop_translations
--   ADD CONSTRAINT shop_translations_locale_mr_only CHECK (locale = 'mr') NOT VALID;
