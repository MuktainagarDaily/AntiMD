import { describe, it, expect } from 'vitest';
import {
  parseCsv,
  serializeCsvValue,
  escapeCell,
  buildCsvString,
  csvFromObjects,
  townCsvFilename,
  fetchAllPaged,
} from '@/lib/csvUtils';
import {
  MASTER_DATASETS,
  DATASET_BY_KEY,
  coerceDatasetRow,
} from '@/lib/admin/masterDatasets';
import {
  SCHOOL_CSV_EXPORT_HEADERS,
  parseBulkSchoolCsv,
} from '@/lib/schools/schoolHelpers';
import { parseBulkBusCsv } from '@/lib/bus/busHelpers';

describe('Export & Import Regression Suite (Phase 5)', () => {
  describe('csvUtils Core Engine', () => {
    it('parses RFC 4180 multi-line quoted fields, internal quotes, padding preservation, and UTF-8 BOM', () => {
      const csv =
        '\uFEFF"Name","Description","Area"\r\n' +
        '"Shree ""Ganesh"" Dairy","Line 1: Fresh paneer\nLine 2: Pure cow ghee","Station Road"\r\n' +
        '"Annapurna Mess",  Pure Veg Thali  ,  "College Road"  \r\n' +
        '"  Padded Name  ",  Unquoted Text  ,"  Internal Padded  "\r\n';

      const rows = parseCsv(csv);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({
        name: 'Shree "Ganesh" Dairy',
        description: 'Line 1: Fresh paneer\nLine 2: Pure cow ghee',
        area: 'Station Road',
      });
      expect(rows[1]).toEqual({
        name: 'Annapurna Mess',
        description: 'Pure Veg Thali',
        area: 'College Road',
      });
      expect(rows[2]).toEqual({
        name: '  Padded Name  ',
        description: 'Unquoted Text',
        area: '  Internal Padded  ',
      });
    });

    it('serializes arrays and JSONB objects without [object Object]', () => {
      expect(serializeCsvValue(['Wi-Fi', 'CCTV', 'RO Water'])).toBe('Wi-Fi|CCTV|RO Water');
      expect(serializeCsvValue({ '1_sharing': 5500, '2_sharing': 3500 })).toBe(
        '{"1_sharing":5500,"2_sharing":3500}',
      );

      const csv = csvFromObjects(
        [
          {
            id: 'pg-1',
            amenities: ['Wi-Fi', 'Parking'],
            sharing_rates: { '2_sharing': 3500, '3_sharing': 2800 },
            extra_note: 'ok',
          },
        ],
        ['id', 'amenities', 'sharing_rates'],
      );

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).not.toContain('[object Object]');

      const parsed = parseCsv(csv);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].amenities).toBe('Wi-Fi|Parking');
      expect(JSON.parse(parsed[0].sharing_rates)).toEqual({
        '2_sharing': 3500,
        '3_sharing': 2800,
      });
      expect(parsed[0].extra_note).toBe('ok');
    });

    it('neutralizes formula-injection prefixes without corrupting coordinates or E.164 phone numbers', () => {
      expect(escapeCell('=CMD("calc")')).toBe('"\'=CMD(""calc"")"');
      expect(escapeCell('@SUM(1,2)')).toBe('"\'@SUM(1,2)"');
      expect(escapeCell('+cmd|calc')).toBe('"\'+cmd|calc"');
      expect(escapeCell('-foo')).toBe('"\'-foo"');

      // Genuine numeric coords and +91 phone numbers must NOT be mangled
      expect(escapeCell(21.0504)).toBe('"21.0504"');
      expect(escapeCell('-73.8567')).toBe('"-73.8567"');
      expect(escapeCell('+919822001100')).toBe('"+919822001100"');
    });

    it('builds normalized town CSV filenames', () => {
      expect(townCsvFilename('Muktainagar!', 'shops')).toBe('muktainagar-shops');
      expect(townCsvFilename('maval-parandwadi', 'mess-directory')).toBe('maval-parandwadi-mess-directory');
      expect(townCsvFilename(null, 'pending-claims')).toBe('apnatown-pending-claims');
    });

    it('paginates past Supabase 1,000-row cap cleanly via fetchAllPaged', async () => {
      const total = 2350;
      const allRecords = Array.from({ length: total }, (_, idx) => ({ id: `row-${idx}` }));
      const calls: Array<[number, number]> = [];

      const fetched = await fetchAllPaged<{ id: string }>(async (from, to) => {
        calls.push([from, to]);
        return { data: allRecords.slice(from, to + 1), error: null };
      }, 1000);

      expect(fetched).toHaveLength(total);
      expect(fetched[0].id).toBe('row-0');
      expect(fetched[2349].id).toBe('row-2349');
      expect(calls).toEqual([
        [0, 999],
        [1000, 1999],
        [2000, 2999],
      ]);
    });
  });

  describe('Master Datasets FK Order & Row Coercion', () => {
    it('maintains foreign-key safe dataset ordering across all modules', () => {
      const idx = (key: string) => MASTER_DATASETS.findIndex((d) => d.key === key);

      expect(MASTER_DATASETS).toHaveLength(20);
      expect(idx('categories')).toBeLessThan(idx('shop_categories'));
      expect(idx('shops')).toBeLessThan(idx('shop_categories'));
      expect(idx('shops')).toBeLessThan(idx('mess_profiles'));
      expect(idx('mess_profiles')).toBeLessThan(idx('mess_daily_menus'));
      expect(idx('shops')).toBeLessThan(idx('pg_profiles'));
      expect(idx('schools')).toBeLessThan(idx('school_notices'));
      expect(idx('schools')).toBeLessThan(idx('school_claims'));
      expect(idx('authority_departments')).toBeLessThan(idx('authority_organizations'));
      expect(idx('authority_departments')).toBeLessThan(idx('authority_announcements'));
      expect(idx('authority_announcements')).toBeLessThan(idx('announcement_locations'));
    });

    it('round-trips shops, pg_profiles, schools, requests, bus_timetable & local_news cleanly', () => {
      const fallbackCity = {
        id: 'city-muktai',
        district_id: 'dist-jalgaon',
        district: { state_id: 'state-mh' },
      };

      // 1. Shops array, float, bool & fallback city scoping
      const shopCsv = csvFromObjects([
        {
          id: 's1',
          name: 'Khadse Kirana',
          amenities: ['Home Delivery', 'UPI'],
          photos: ['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg'],
          latitude: 21.0504,
          longitude: 76.0604,
          is_active: true,
          is_open: true,
          is_verified: false,
          city_id: '',
          district_id: '',
          state_id: '',
        },
      ]);
      const shopRow = coerceDatasetRow('shops', parseCsv(shopCsv)[0], fallbackCity);
      expect(shopRow.amenities).toEqual(['Home Delivery', 'UPI']);
      expect(shopRow.photos).toEqual(['https://cdn.example/1.jpg', 'https://cdn.example/2.jpg']);
      expect(shopRow.latitude).toBe(21.0504);
      expect(shopRow.is_active).toBe(true);
      expect(shopRow.is_verified).toBe(false);
      expect(shopRow.city_id).toBe('city-muktai');
      expect(shopRow.district_id).toBe('dist-jalgaon');
      expect(shopRow.state_id).toBe('state-mh');

      // 2. PG profiles JSONB & NOT NULL defaults (prevents 23502 & 22P02)
      const pgCsv = csvFromObjects([
        {
          shop_id: 's-pg',
          gender: '',
          total_beds: '',
          available_beds: '',
          deposit_amount: '2000',
          food_included: 'true',
          amenities: ['Wi-Fi', 'CCTV'],
          sharing_rates: { '2_sharing': 3500 },
          vacancies_updated_at: '',
        },
      ]);
      const pgRow = coerceDatasetRow('pg_profiles', parseCsv(pgCsv)[0], fallbackCity);
      expect(pgRow.gender).toBe('boys');
      expect(pgRow.total_beds).toBe(0);
      expect(pgRow.available_beds).toBe(0);
      expect(pgRow.deposit_amount).toBe(2000);
      expect(pgRow.food_included).toBe(true);
      expect(pgRow.amenities).toEqual(['Wi-Fi', 'CCTV']);
      expect(pgRow.sharing_rates).toEqual({ '2_sharing': 3500 });
      expect('vacancies_updated_at' in pgRow).toBe(false);

      // 3. Shop requests meta JSONB & city scoping
      const reqCsv = csvFromObjects([
        {
          id: 'req-1',
          entity_type: 'school',
          name: 'ZP Primary School',
          phone: '9822001122',
          amenities: '',
          photos: '',
          meta: { board: 'State Board', udise: '270301' },
          status: '',
        },
      ]);
      const reqRow = coerceDatasetRow('requests', parseCsv(reqCsv)[0], fallbackCity);
      expect(reqRow.status).toBe('pending');
      expect(reqRow.amenities).toEqual([]);
      expect(reqRow.photos).toEqual([]);
      expect(reqRow.meta).toEqual({ board: 'State Board', udise: '270301' });
      expect(reqRow.city_id).toBe('city-muktai');

      // 4. Local News uses city_only scoping (never injects spurious district_id / state_id)
      const newsCsv = csvFromObjects([
        {
          id: '',
          title: 'Town Water Alert',
          is_pinned: 'true',
          is_active: 'true',
          city_id: '',
        },
      ]);
      const newsRow = coerceDatasetRow('local_news', parseCsv(newsCsv)[0], fallbackCity);
      expect(DATASET_BY_KEY.local_news.cityScope).toBe('city_only');
      expect(newsRow.city_id).toBe('city-muktai');
      expect('district_id' in newsRow).toBe(false);
      expect('state_id' in newsRow).toBe(false);
      expect('id' in newsRow).toBe(false);

      // 5. Bus timetable departure_times array coercion
      const busCsv = csvFromObjects([
        {
          id: 'b1',
          destination: 'Jalgaon',
          departure_times: ['06:30', '09:00', '14:15'],
          sort_order: '2',
          is_active: 'false',
        },
      ]);
      const busRow = coerceDatasetRow('bus_timetable', parseCsv(busCsv)[0]);
      expect(busRow.departure_times).toEqual(['06:30', '09:00', '14:15']);
      expect(busRow.sort_order).toBe(2);
      expect(busRow.is_active).toBe(false);
    });
  });

  describe('Education Portal Extended Export/Import Round-Trip', () => {
    it('round-trips all 45 columns including Marathi Devanagari & multi-line descriptions', () => {
      const sampleRowValues = SCHOOL_CSV_EXPORT_HEADERS.map((h) => {
        switch (h) {
          case 'slug': return 'khadse-college-muktai';
          case 'name': return 'Smt. G. G. Khadse College';
          case 'name_mr': return 'श्रीमती गो. गु. खडसे महाविद्यालय';
          case 'school_type': return 'college';
          case 'medium': return 'english';
          case 'mediums': return 'english|marathi';
          case 'board': return 'KBCNMU Jalgaon';
          case 'management_type': return 'aided';
          case 'gender_type': return 'coed';
          case 'udise_aishe_code': return 'AISHE-C8912';
          case 'established_year': return '1990';
          case 'accreditation': return 'NAAC Grade B+';
          case 'classes_offered': return 'B.A., B.Com., B.Sc., M.Sc.';
          case 'streams': return 'Science|Commerce|Arts';
          case 'facilities': return 'Library|Computer Lab|Sports Ground';
          case 'principal_name': return 'Dr. V. R. Patil';
          case 'office_timing': return '09:30 AM - 05:00 PM';
          case 'admission_status': return 'open';
          case 'admission_deadline': return '2026-07-31';
          case 'admission_url': return 'https://khadse.edu.in/apply';
          case 'prospectus_url': return 'https://khadse.edu.in/prospectus.pdf';
          case 'fee_tier': return 'low';
          case 'annual_fee_min': return '4500';
          case 'annual_fee_max': return '18000';
          case 'scholarships': return 'MahaDBT Post-Matric|EBC Concession';
          case 'required_documents': return '12th Marksheet|LC / TC|Aadhaar';
          case 'transport_villages': return 'Kothali|Kurha|Changdev';
          case 'coaching_focus': return 'MPSC|Competitive Cell';
          case 'total_seats': return '480';
          case 'available_seats': return '65';
          case 'phone': return '02583-234408';
          case 'whatsapp': return '9822001122';
          case 'email': return 'info@khadsecollege.edu.in';
          case 'website': return 'https://khadsecollege.edu.in';
          case 'area': return 'Highway Road';
          case 'sub_area': return 'Bhusawal Naka';
          case 'address': return 'NH-53, Muktainagar';
          case 'address_mr': return 'राष्ट्रीय महामार्ग ५३, मुक्ताईनगर';
          case 'latitude': return '21.0512';
          case 'longitude': return '76.0634';
          case 'image_url': return 'https://cdn.example/khadse-cover.jpg';
          case 'photos': return 'https://cdn.example/khadse-1.jpg|https://cdn.example/khadse-2.jpg';
          case 'is_verified': return 'true';
          case 'is_active': return 'true';
          case 'description': return 'NAAC Accredited Senior College.\nOffers Science, Commerce & Arts.';
          default: return '';
        }
      });

      const exportedCsv = buildCsvString([...SCHOOL_CSV_EXPORT_HEADERS], [sampleRowValues], true);
      const parsed = parseBulkSchoolCsv(exportedCsv);

      expect(parsed.errors).toHaveLength(0);
      expect(parsed.valid).toHaveLength(1);

      const row = parsed.valid[0];
      expect(row.fromExtendedHeader).toBe(true);
      expect(row.slug).toBe('khadse-college-muktai');
      expect(row.name).toBe('Smt. G. G. Khadse College');
      expect(row.name_mr).toBe('श्रीमती गो. गु. खडसे महाविद्यालय');
      expect(row.school_type).toBe('college');
      expect(row.mediums).toEqual(['english', 'marathi']);
      expect(row.streams).toEqual(['Science', 'Commerce', 'Arts']);
      expect(row.transport_villages).toEqual(['Kothali', 'Kurha', 'Changdev']);
      expect(row.annual_fee_min).toBe(4500);
      expect(row.annual_fee_max).toBe(18000);
      expect(row.total_seats).toBe(480);
      expect(row.available_seats).toBe(65);
      expect(row.latitude).toBe(21.0512);
      expect(row.longitude).toBe(76.0634);
      expect(row.photos).toEqual([
        'https://cdn.example/khadse-cover.jpg',
        'https://cdn.example/khadse-1.jpg',
        'https://cdn.example/khadse-2.jpg',
      ]);
      expect(row.is_verified).toBe(true);
      expect(row.is_active).toBe(true);
      expect(row.description).toBe('NAAC Accredited Senior College.\nOffers Science, Commerce & Arts.');
    });
  });

  describe('Bus Timetable CSV Edge Cases', () => {
    it('preserves trailing comma-separated note fragments and 5th active boolean column', () => {
      const csv =
        '\uFEFFDestination, Marathi Name, Departure Times, Notes, Active\n' +
        'Nigdi, निगडी, "07:30 12:05", via Somatane Phata, Dehu Road, true\n' +
        'Jalgaon, जळगाव, "08:00 14:30", via Bhusawal, Bodwad, false\n' +
        'Edlabad, एदलाबाद, 09:15 16:00, via Kurha, Anturli';

      const res = parseBulkBusCsv(csv);
      expect(res.errors).toHaveLength(0);
      expect(res.valid).toHaveLength(3);

      expect(res.valid[0].notes).toBe('via Somatane Phata, Dehu Road');
      expect(res.valid[0].is_active).toBe(true);

      expect(res.valid[1].notes).toBe('via Bhusawal, Bodwad');
      expect(res.valid[1].is_active).toBe(false);

      expect(res.valid[2].notes).toBe('via Kurha, Anturli');
      expect(res.valid[2].is_active).toBe(true);
    });
  });
});
