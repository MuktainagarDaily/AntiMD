import { describe, it, expect } from 'vitest';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  parseSchoolDescription,
  serializeSchoolDescription,
  getSchoolResolvedMeta,
  filterSchools,
  parseBulkSchoolCsv,
  normalizeSchoolType,
  normalizeSchoolMedium,
  toDbSchoolType,
  resolveSchoolType,
  formatSchoolWhatsAppEnquiry,
  formatSchoolWhatsAppBroadcast,
  MUKTAINAGAR_EDUCATION_SEEDS,
  MAVAL_EDUCATION_SEEDS,
  type SchoolType,
} from '@/lib/schools/schoolHelpers';
import {
  OWNER_EDITABLE_SCHOOL_FIELDS,
  pickOwnerEditableSchool,
} from '@/lib/schoolConcurrency';
import type { SchoolRow } from '@/lib/repos/schoolsRepo';

describe('Education & Institutes Helper Logic & Verification (Phase 1)', () => {
  describe('SCHOOL_TYPE_CONFIG & SCHOOL_MEDIUM_CONFIG', () => {
    it('contains all 8 required educational tags with English & Marathi labels', () => {
      const types: SchoolType[] = [
        'primary',
        'secondary',
        'higher-secondary',
        'college',
        'engineering-polytechnic',
        'university',
        'coaching',
        'other',
      ];

      for (const t of types) {
        expect(SCHOOL_TYPE_CONFIG[t]).toBeDefined();
        expect(SCHOOL_TYPE_CONFIG[t].labelEn).toBeTruthy();
        expect(SCHOOL_TYPE_CONFIG[t].labelMr).toBeTruthy();
        expect(SCHOOL_TYPE_CONFIG[t].badgeClass).toContain('border');
      }
    });

    it('contains all standard mediums including semi-english and vernaculars', () => {
      expect(SCHOOL_MEDIUM_CONFIG.marathi).toBeDefined();
      expect(SCHOOL_MEDIUM_CONFIG.english).toBeDefined();
      expect(SCHOOL_MEDIUM_CONFIG['semi-english']).toBeDefined();
      expect(SCHOOL_MEDIUM_CONFIG.hindi).toBeDefined();
      expect(SCHOOL_MEDIUM_CONFIG.urdu).toBeDefined();
    });
  });

  describe('parseSchoolDescription & serializeSchoolDescription', () => {
    it('serializes and parses round-trip with board, streams, and facilities', () => {
      const meta = {
        board: 'CBSE',
        streams: ['Science', 'Commerce'],
        facilities: ['School Bus', 'Hostel', 'Science Lab'],
        principal_name: 'Dr. V. K. Patil',
        office_timing: '09:00 AM - 04:30 PM',
        raw_description: 'Premier school established in 1995 with digital classrooms.',
      };

      const serialized = serializeSchoolDescription(meta);
      expect(serialized).toContain('[Board: CBSE]');
      expect(serialized).toContain('[Streams: Science, Commerce]');
      expect(serialized).toContain('[Facilities: School Bus, Hostel, Science Lab]');
      expect(serialized).toContain('[Principal: Dr. V. K. Patil]');
      expect(serialized).toContain('[Timing: 09:00 AM - 04:30 PM]');
      expect(serialized).toContain('Premier school established in 1995');

      const parsed = parseSchoolDescription(serialized);
      expect(parsed.board).toBe('CBSE');
      expect(parsed.streams).toEqual(['Science', 'Commerce']);
      expect(parsed.facilities).toEqual(['School Bus', 'Hostel', 'Science Lab']);
      expect(parsed.principal_name).toBe('Dr. V. K. Patil');
      expect(parsed.office_timing).toBe('09:00 AM - 04:30 PM');
      expect(parsed.raw_description).toBe('Premier school established in 1995 with digital classrooms.');
    });

    it('gracefully handles empty or null descriptions', () => {
      const empty = parseSchoolDescription(null);
      expect(empty.raw_description).toBe('');
      expect(empty.board).toBeUndefined();

      const undefinedDesc = parseSchoolDescription(undefined);
      expect(undefinedDesc.raw_description).toBe('');
    });

    it('parses partial tags correctly without corrupting raw description text', () => {
      const partial = '[Board: MSBTE (Polytechnic)] · [Timing: 10:00 AM - 05:00 PM]\n\nAutonomous Polytechnic Institute';
      const parsed = parseSchoolDescription(partial);
      expect(parsed.board).toBe('MSBTE (Polytechnic)');
      expect(parsed.office_timing).toBe('10:00 AM - 05:00 PM');
      expect(parsed.streams).toBeUndefined();
      expect(parsed.facilities).toBeUndefined();
      expect(parsed.raw_description).toBe('Autonomous Polytechnic Institute');
    });

    it('handles legacy plain descriptions without any tags', () => {
      const plain = 'Old Zilla Parishad school serving students since 1965.';
      const parsed = parseSchoolDescription(plain);
      expect(parsed.board).toBeUndefined();
      expect(parsed.streams).toBeUndefined();
      expect(parsed.raw_description).toBe('Old Zilla Parishad school serving students since 1965.');
    });
  });

  describe('filterSchools', () => {
    const mockRows: SchoolRow[] = [
      {
        id: '1',
        name: 'Z.P. Primary Central School',
        name_mr: 'जि.प. प्राथमिक केंद्र शाळा',
        school_type: 'primary',
        medium: 'marathi',
        area: 'Station Road',
        sub_area: null,
        address: 'Near Bus Stand',
        phone: '9822012345',
        email: null,
        website: null,
        description: '[Board: State Board (SSC/HSC)]',
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: '2',
        name: 'D.Y. Patil College of Engineering',
        name_mr: 'डी.वाय. पाटील अभियांत्रिकी महाविद्यालय',
        school_type: 'engineering-polytechnic',
        medium: 'english',
        area: 'Varale / Ambi',
        sub_area: null,
        address: 'Talegaon Dabhade',
        phone: '020-223344',
        email: 'info@dypatil.edu',
        website: 'https://dypatil.edu',
        description: '[Board: SPPU (Pune University)] · [Streams: Mechanical, CS]',
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: '3',
        name: 'Muktainagar High School & Junior College',
        name_mr: 'मुक्ताईनगर हायस्कूल व कनिष्ठ महाविद्यालय',
        school_type: 'higher-secondary',
        medium: 'semi-english',
        area: 'College Road',
        sub_area: null,
        address: 'Muktainagar',
        phone: '02583-234567',
        email: null,
        website: null,
        description: null,
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: false,
        created_at: '',
        updated_at: '',
      },
    ];

    it('filters by English name query', () => {
      const res = filterSchools(mockRows, 'patil', 'all', 'all');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('2');
    });

    it('filters by Marathi Devanagari query', () => {
      const res = filterSchools(mockRows, 'प्राथमिक', 'all', 'all');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('1');
    });

    it('filters by status (active vs disabled)', () => {
      const activeOnly = filterSchools(mockRows, '', 'all', 'active');
      expect(activeOnly).toHaveLength(2);

      const disabledOnly = filterSchools(mockRows, '', 'all', 'disabled');
      expect(disabledOnly).toHaveLength(1);
      expect(disabledOnly[0].id).toBe('3');
    });

    it('filters by distinct type', () => {
      const engg = filterSchools(mockRows, '', 'engineering-polytechnic', 'all');
      expect(engg).toHaveLength(1);
      expect(engg[0].id).toBe('2');
    });

    it('filters by grouped type category (schools, colleges)', () => {
      const schools = filterSchools(mockRows, '', 'schools', 'all');
      expect(schools).toHaveLength(1);
      expect(schools[0].id).toBe('1');

      const colleges = filterSchools(mockRows, '', 'colleges', 'all');
      expect(colleges).toHaveLength(1);
      expect(colleges[0].id).toBe('3');
    });

    it('filters by area and location search', () => {
      const ambi = filterSchools(mockRows, 'Varale', 'all', 'all');
      expect(ambi).toHaveLength(1);
      expect(ambi[0].id).toBe('2');
    });

    it('filters by medium and board affiliation inside description', () => {
      const marathi = filterSchools(mockRows, 'marathi', 'all', 'all');
      expect(marathi).toHaveLength(1);
      expect(marathi[0].id).toBe('1');

      const sppu = filterSchools(mockRows, 'SPPU', 'all', 'all');
      expect(sppu).toHaveLength(1);
      expect(sppu[0].id).toBe('2');
    });

    it('combines text search with status and category filters simultaneously', () => {
      // Searching for "college" with status active should only return row 2 (row 3 is disabled)
      const res = filterSchools(mockRows, 'college', 'all', 'active');
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('2');

      const resDisabled = filterSchools(mockRows, 'college', 'all', 'disabled');
      expect(resDisabled).toHaveLength(1);
      expect(resDisabled[0].id).toBe('3');
    });
  });

  describe('normalizeSchoolType & normalizeSchoolMedium', () => {
    it('normalizes various aliases to standard SchoolType', () => {
      expect(normalizeSchoolType('Primary School')).toBe('primary');
      expect(normalizeSchoolType('जि.प. प्राथमिक')).toBe('primary');
      expect(normalizeSchoolType('Junior College 11th')).toBe('higher-secondary');
      expect(normalizeSchoolType('कनिष्ठ महाविद्यालय')).toBe('higher-secondary');
      expect(normalizeSchoolType('High School (SSC)')).toBe('secondary');
      expect(normalizeSchoolType('Engineering & Technology')).toBe('engineering-polytechnic');
      expect(normalizeSchoolType('Govt ITI')).toBe('engineering-polytechnic');
      expect(normalizeSchoolType('Polytechnic Diploma')).toBe('engineering-polytechnic');
      expect(normalizeSchoolType('University Subcenter')).toBe('university');
      expect(normalizeSchoolType('विद्यापीठ')).toBe('university');
      expect(normalizeSchoolType('MPSC Abhyasika')).toBe('coaching');
      expect(normalizeSchoolType('Degree College')).toBe('college');
      expect(normalizeSchoolType('unknown')).toBe('other');
    });

    it('normalizes medium strings', () => {
      expect(normalizeSchoolMedium('Marathi')).toBe('marathi');
      expect(normalizeSchoolMedium('English Medium')).toBe('english');
      expect(normalizeSchoolMedium('Semi-English')).toBe('semi-english');
      expect(normalizeSchoolMedium('Hindi')).toBe('hindi');
      expect(normalizeSchoolMedium('Urdu')).toBe('urdu');
      expect(normalizeSchoolMedium('')).toBeNull();
    });

    it('toDbSchoolType safely maps extended types to the 5 Postgres check constraint values', () => {
      // Must only ever produce: primary, secondary, higher-secondary, college, or other
      expect(toDbSchoolType('primary')).toBe('primary');
      expect(toDbSchoolType('secondary')).toBe('secondary');
      expect(toDbSchoolType('higher-secondary')).toBe('higher-secondary');
      expect(toDbSchoolType('college')).toBe('college');
      expect(toDbSchoolType('engineering-polytechnic')).toBe('college');
      expect(toDbSchoolType('university')).toBe('college');
      expect(toDbSchoolType('coaching')).toBe('other');
      expect(toDbSchoolType('other')).toBe('other');
    });

    it('resolveSchoolType recovers distinct category tag from description override', () => {
      const enggRow = {
        school_type: 'college',
        description: '[Type: engineering-polytechnic] · [Board: SPPU]',
      };
      expect(resolveSchoolType(enggRow)).toBe('engineering-polytechnic');

      const univRow = {
        school_type: 'college',
        description: '[Type: university] · [Board: KBCNMU]',
      };
      expect(resolveSchoolType(univRow)).toBe('university');

      const legacyRow = {
        school_type: 'primary',
        description: 'Plain ZP school without tags',
      };
      expect(resolveSchoolType(legacyRow)).toBe('primary');
    });
  });

  describe('parseBulkSchoolCsv (Phase 4 Bulk Import)', () => {
    it('parses standard comma-separated multi-column text', () => {
      const csv = `Name, Marathi Name, Type, Medium, Area, Phone, Notes
Z.P. Primary School, जि.प. शाळा, Primary, Marathi, Station Road, 02583-234000, State Board
Smt. G.G. Khadse College, खडसे महाविद्यालय, College, Marathi, Highway, 02583-234408, KBCNMU`;

      const result = parseBulkSchoolCsv(csv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);

      expect(result.valid[0].name).toBe('Z.P. Primary School');
      expect(result.valid[0].name_mr).toBe('जि.प. शाळा');
      expect(result.valid[0].school_type).toBe('primary');
      expect(result.valid[0].medium).toBe('marathi');
      expect(result.valid[0].area).toBe('Station Road');
      expect(result.valid[0].phone).toBe('02583-234000');
      expect(result.valid[0].description).toBe('[Notes: State Board]');
      expect(result.valid[0].is_active).toBe(true);

      expect(result.valid[1].name).toBe('Smt. G.G. Khadse College');
      expect(result.valid[1].school_type).toBe('college');
    });

    it('parses tab-separated TSV (copied from Google Sheets / Excel)', () => {
      const tsv = "D.Y. Patil Engineering\tडी.वाय. पाटील\tEngineering\tEnglish\tAmbi\t02114-673351\tSPPU affiliated\nIndrayani College\tइंद्रायणी महाविद्यालय\tCollege\tMarathi\tTalegaon\t02114-222225\tSPPU";
      const result = parseBulkSchoolCsv(tsv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);
      expect(result.valid[0].name).toBe('D.Y. Patil Engineering');
      expect(result.valid[0].school_type).toBe('engineering-polytechnic');
      expect(result.valid[0].medium).toBe('english');
      expect(result.valid[1].name).toBe('Indrayani College');
      expect(result.valid[1].school_type).toBe('college');
    });

    it('parses pipe-separated lines', () => {
      const pipe = 'Government ITI | शासकीय ITI | ITI | Marathi | Bhusawal Road | 02583-234789 | DTE trade';
      const result = parseBulkSchoolCsv(pipe);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].name).toBe('Government ITI');
      expect(result.valid[0].school_type).toBe('engineering-polytechnic');
    });

    it('skips header lines cleanly', () => {
      const headerCsv = `Institute Name, Marathi Name, Category, Medium, Area
Muktainagar High School, मुक्ताईनगर हायस्कूल, High School, Semi-English, College Road`;

      const result = parseBulkSchoolCsv(headerCsv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].name).toBe('Muktainagar High School');
    });

    it('captures lines with missing names into errors list', () => {
      const badCsv = `, जि.प. शाळा, Primary
Valid School, वैध शाळा, High School`;

      const result = parseBulkSchoolCsv(badCsv);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].name).toBe('Valid School');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('name is missing');
    });
  });

  describe('Official Education Seed Datasets (Muktainagar & Maval)', () => {
    it('has 6 verified official institutes for Muktainagar', () => {
      expect(MUKTAINAGAR_EDUCATION_SEEDS).toHaveLength(6);
      for (const item of MUKTAINAGAR_EDUCATION_SEEDS) {
        expect(item.name).toBeTruthy();
        expect(item.name_mr).toBeTruthy();
        expect(item.school_type).toBeTruthy();
        expect(item.area).toBeTruthy();
      }
    });

    it('Muktainagar seeds include primary, high school, senior college, ITI, and University center', () => {
      const types = MUKTAINAGAR_EDUCATION_SEEDS.map((s) => s.school_type);
      expect(types).toContain('primary');
      expect(types).toContain('higher-secondary');
      expect(types).toContain('college');
      expect(types).toContain('engineering-polytechnic');
      expect(types).toContain('university');
    });

    it('has 8 verified official institutes for Maval / Parandwadi', () => {
      expect(MAVAL_EDUCATION_SEEDS).toHaveLength(8);
      for (const item of MAVAL_EDUCATION_SEEDS) {
        expect(item.name).toBeTruthy();
        expect(item.name_mr).toBeTruthy();
        expect(item.school_type).toBeTruthy();
        expect(item.area).toBeTruthy();
      }
    });

    it('Maval seeds include local Parandwadi ZP, D.Y. Patil Engineering, Indrayani, and Indira College', () => {
      const names = MAVAL_EDUCATION_SEEDS.map((s) => s.name);
      expect(names.some((n) => n.includes('Parandwadi'))).toBe(true);
      expect(names.some((n) => n.includes('D.Y. Patil'))).toBe(true);
      expect(names.some((n) => n.includes('Indrayani'))).toBe(true);
      expect(names.some((n) => n.includes('Indira'))).toBe(true);
    });
  });

  describe('getSchoolResolvedMeta (Structured DB columns + Legacy tag precedence)', () => {
    it('prioritizes structured DB columns over legacy bracket tags while preserving clean raw_description', () => {
      const school: Partial<SchoolRow> = {
        board: 'SPPU (Pune University)',
        streams: ['Computer Engineering', 'AI & Data Science'],
        facilities: ['Boys / Girls Hostel', 'School Bus'],
        principal_name: 'Dr. R. B. Kulkarni',
        office_timing: '09:00 AM - 05:00 PM',
        admission_status: 'open',
        management_type: 'private',
        gender_type: 'coed',
        fee_tier: 'premium',
        medium: 'english',
        mediums: ['english', 'semi-english'],
        scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver'],
        required_documents: ['MHT-CET / JEE / NEET Allotment Letter'],
        transport_villages: ['Parandwadi', 'Somatane', 'Talegaon Dabhade'],
        coaching_focus: ['MHT-CET / JEE / NEET'],
        udise_aishe_code: 'C-41526',
        established_year: 2012,
        accreditation: 'NAAC Grade A',
        classes_offered: 'B.E. / B.Tech',
        admission_deadline: '2026-07-31',
        admission_url: 'https://campus.example.edu/apply',
        prospectus_url: 'https://campus.example.edu/brochure.pdf',
        annual_fee_min: 75000,
        annual_fee_max: 98000,
        total_seats: 240,
        available_seats: 38,
        description:
          '[Type: engineering-polytechnic] · [Board: Legacy MSBTE] · [Streams: Legacy Mech] · [Facilities: Legacy Canteen] · [Principal: Old Principal] · [Timing: 10 AM - 4 PM]\n\nNAAC accredited campus near Somatane Phata.',
      };

      const meta = getSchoolResolvedMeta(school);
      expect(meta.type_override).toBe('engineering-polytechnic');
      expect(meta.board).toBe('SPPU (Pune University)');
      expect(meta.streams).toEqual(['Computer Engineering', 'AI & Data Science']);
      expect(meta.facilities).toEqual(['Boys / Girls Hostel', 'School Bus']);
      expect(meta.principal_name).toBe('Dr. R. B. Kulkarni');
      expect(meta.office_timing).toBe('09:00 AM - 05:00 PM');
      expect(meta.admission_status).toBe('open');
      expect(meta.management_type).toBe('private');
      expect(meta.gender_type).toBe('coed');
      expect(meta.fee_tier).toBe('premium');
      expect(meta.mediums).toEqual(['english', 'semi-english']);
      expect(meta.scholarships).toEqual(['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver']);
      expect(meta.transport_villages).toEqual(['Parandwadi', 'Somatane', 'Talegaon Dabhade']);
      expect(meta.udise_aishe_code).toBe('C-41526');
      expect(meta.established_year).toBe(2012);
      expect(meta.annual_fee_min).toBe(75000);
      expect(meta.annual_fee_max).toBe(98000);
      expect(meta.total_seats).toBe(240);
      expect(meta.available_seats).toBe(38);
      expect(meta.raw_description).toBe('NAAC accredited campus near Somatane Phata.');
    });

    it('falls back to legacy bracket tags and single medium column when structured columns are empty', () => {
      const legacySchool: Partial<SchoolRow> = {
        school_type: 'secondary',
        medium: 'semi-english',
        mediums: [],
        streams: [],
        facilities: [],
        description:
          '[Board: State Board (SSC/HSC)] · [Streams: Science, Commerce] · [Facilities: Library, Lab] · [Principal: Prof. Joshi] · [Timing: 08:30 AM - 02:00 PM]\n\nServing taluka students since 1978.',
      };

      const meta = getSchoolResolvedMeta(legacySchool);
      expect(meta.board).toBe('State Board (SSC/HSC)');
      expect(meta.streams).toEqual(['Science', 'Commerce']);
      expect(meta.facilities).toEqual(['Library', 'Lab']);
      expect(meta.principal_name).toBe('Prof. Joshi');
      expect(meta.office_timing).toBe('08:30 AM - 02:00 PM');
      expect(meta.mediums).toEqual(['semi-english']);
      expect(meta.raw_description).toBe('Serving taluka students since 1978.');
    });
  });

  describe('OWNER_EDITABLE_SCHOOL_FIELDS & pickOwnerEditableSchool (Security Guard)', () => {
    it('does not allow any admin-only moderation, geographic, or slug columns in whitelist', () => {
      const forbidden = [
        'is_active',
        'is_verified',
        'is_claimed',
        'slug',
        'city_id',
        'district_id',
        'state_id',
        'id',
        'created_at',
        'updated_at',
      ] as const;

      for (const col of forbidden) {
        expect((OWNER_EDITABLE_SCHOOL_FIELDS as readonly string[]).includes(col)).toBe(false);
      }
    });

    it('strips forbidden admin-only fields while preserving allowed owner campus/admission/fee/bus fields', () => {
      const maliciousPayload = {
        // Forbidden admin-only or system keys
        id: 'fake-id',
        is_active: false,
        is_verified: true,
        is_claimed: true,
        slug: 'hijacked-slug',
        city_id: 'other-city-uuid',
        district_id: 'other-dist-uuid',
        state_id: 'other-state-uuid',
        created_at: '2020-01-01T00:00:00Z',
        updated_at: '2020-01-01T00:00:00Z',
        arbitrary_col: 'drop table',
        // Allowed owner fields
        name: 'Updated Campus Name',
        name_mr: 'अद्ययावत संकुल',
        admission_status: 'open',
        admission_deadline: '2026-08-15',
        admission_url: 'https://campus.edu/apply',
        prospectus_url: 'https://campus.edu/prospectus.pdf',
        fee_tier: 'moderate',
        annual_fee_min: 22000,
        annual_fee_max: 45000,
        total_seats: 180,
        available_seats: 24,
        transport_villages: ['Parandwadi', 'Somatane'],
        scholarships: ['MahaDBT Post-Matric'],
        required_documents: ['Aadhaar Card (आधार कार्ड)'],
        facilities: ['School Bus', 'Library'],
        streams: ['Science', 'Commerce'],
        mediums: ['english', 'semi-english'],
        whatsapp: '9822110099',
        principal_name: 'Dr. S. Deshmukh',
        office_timing: '09:00 AM - 05:00 PM',
      };

      const sanitized = pickOwnerEditableSchool(maliciousPayload);

      // Forbidden keys removed
      expect('id' in sanitized).toBe(false);
      expect('is_active' in sanitized).toBe(false);
      expect('is_verified' in sanitized).toBe(false);
      expect('is_claimed' in sanitized).toBe(false);
      expect('slug' in sanitized).toBe(false);
      expect('city_id' in sanitized).toBe(false);
      expect('district_id' in sanitized).toBe(false);
      expect('state_id' in sanitized).toBe(false);
      expect('created_at' in sanitized).toBe(false);
      expect('updated_at' in sanitized).toBe(false);
      expect('arbitrary_col' in sanitized).toBe(false);

      // Allowed keys preserved
      expect(sanitized.name).toBe('Updated Campus Name');
      expect(sanitized.name_mr).toBe('अद्ययावत संकुल');
      expect(sanitized.admission_status).toBe('open');
      expect(sanitized.admission_deadline).toBe('2026-08-15');
      expect(sanitized.fee_tier).toBe('moderate');
      expect(sanitized.annual_fee_min).toBe(22000);
      expect(sanitized.available_seats).toBe(24);
      expect(sanitized.transport_villages).toEqual(['Parandwadi', 'Somatane']);
      expect(sanitized.scholarships).toEqual(['MahaDBT Post-Matric']);
      expect(sanitized.mediums).toEqual(['english', 'semi-english']);
      expect(sanitized.whatsapp).toBe('9822110099');
    });
  });

  describe('filterSchools with SchoolAdvancedFilterOptions', () => {
    const advancedRows: SchoolRow[] = [
      {
        id: 'a1',
        name: 'Z.P. Primary Parandwadi',
        name_mr: 'जि.प. शाळा परंदवडी',
        school_type: 'primary',
        medium: 'marathi',
        mediums: ['marathi', 'semi-english'],
        management_type: 'government',
        admission_status: 'open',
        transport_villages: ['Parandwadi', 'Somatane'],
        udise_aishe_code: '272509001',
        area: 'Parandwadi',
        sub_area: null,
        address: 'Gaothan',
        phone: '9850123456',
        email: null,
        website: null,
        description: 'ZP Primary',
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'a2',
        name: 'Indira College of Pharmacy',
        name_mr: 'इंदिरा फार्मसी कॉलेज',
        school_type: 'engineering-polytechnic',
        medium: 'english',
        mediums: ['english'],
        management_type: 'private',
        admission_status: 'ongoing',
        streams: ['B.Pharm', 'D.Pharm'],
        transport_villages: ['Parandwadi', 'Wakad'],
        area: 'Somatane Phata',
        sub_area: null,
        address: 'NH-48',
        phone: '02114-661500',
        email: null,
        website: null,
        description: 'SPPU Pharmacy',
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
      {
        id: 'a3',
        name: 'Sankalp Abhyasika & MPSC Coaching',
        name_mr: 'संकल्प अभ्यासिका',
        school_type: 'coaching',
        medium: 'marathi',
        mediums: ['marathi'],
        management_type: 'trust',
        admission_status: 'closed',
        coaching_focus: ['MPSC / UPSC', 'Police Bharti'],
        area: 'Talegaon Station',
        sub_area: null,
        address: 'Station Road',
        phone: '9822998877',
        email: null,
        website: null,
        description: 'Reading room',
        image_url: null,
        latitude: null,
        longitude: null,
        is_active: true,
        created_at: '',
        updated_at: '',
      },
    ];

    it('filters open_only admissions including both open and ongoing, excluding closed', () => {
      const openOnly = filterSchools(advancedRows, '', 'all', 'active', {
        admissionFilter: 'open_only',
      });
      expect(openOnly.map((r) => r.id)).toEqual(['a1', 'a2']);

      const closedOnly = filterSchools(advancedRows, '', 'all', 'active', {
        admissionFilter: 'closed',
      });
      expect(closedOnly.map((r) => r.id)).toEqual(['a3']);
    });

    it('filters by managementFilter', () => {
      const govt = filterSchools(advancedRows, '', 'all', 'active', {
        managementFilter: 'government',
      });
      expect(govt.map((r) => r.id)).toEqual(['a1']);

      const pvt = filterSchools(advancedRows, '', 'all', 'active', {
        managementFilter: 'private',
      });
      expect(pvt.map((r) => r.id)).toEqual(['a2']);
    });

    it('filters by mediumFilter matching multi-medium array values', () => {
      const semiEng = filterSchools(advancedRows, '', 'all', 'active', {
        mediumFilter: 'semi-english',
      });
      expect(semiEng.map((r) => r.id)).toEqual(['a1']);
    });

    it('matches text search inside transport_villages, streams, coaching_focus, and UDISE code', () => {
      expect(filterSchools(advancedRows, 'Wakad', 'all', 'active').map((r) => r.id)).toEqual(['a2']);
      expect(filterSchools(advancedRows, 'B.Pharm', 'all', 'active').map((r) => r.id)).toEqual(['a2']);
      expect(filterSchools(advancedRows, 'MPSC', 'all', 'active').map((r) => r.id)).toEqual(['a3']);
      expect(filterSchools(advancedRows, '272509001', 'all', 'active').map((r) => r.id)).toEqual(['a1']);
    });
  });

  describe('parseBulkSchoolCsv 8-12 column extended format', () => {
    it('parses full 12-column format with Board, Management, AdmissionStatus, WhatsApp, and UDISE', () => {
      const extendedCsv = [
        'Name, Marathi Name, Type, Medium, Area, Phone, Notes, Board, Management, AdmissionStatus, WhatsApp, UDISE',
        'D.Y. Patil College of Engineering, डी.वाय. पाटील अभियांत्रिकी, Engineering, English, Varale, 02114-673351, NAAC A+, SPPU (Pune University), Private, CAP Ongoing, 9822001122, AISHE-C41234',
        'Z.P. Primary Parandwadi, जि.प. प्राथमिक परंदवडी, Primary, Marathi, Parandwadi, 9850123456, 1st-7th Std, State Board, Government / ZP, Open, 9850123456, 27250900123',
      ].join('\n');

      const result = parseBulkSchoolCsv(extendedCsv);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(2);

      expect(result.valid[0]).toMatchObject({
        name: 'D.Y. Patil College of Engineering',
        name_mr: 'डी.वाय. पाटील अभियांत्रिकी',
        school_type: 'engineering-polytechnic',
        medium: 'english',
        area: 'Varale',
        phone: '02114-673351',
        description: '[Notes: NAAC A+]',
        board: 'SPPU (Pune University)',
        management_type: 'private',
        admission_status: 'ongoing',
        whatsapp: '9822001122',
        udise_aishe_code: 'AISHE-C41234',
        is_active: true,
      });

      expect(result.valid[1]).toMatchObject({
        name: 'Z.P. Primary Parandwadi',
        school_type: 'primary',
        medium: 'marathi',
        board: 'State Board',
        management_type: 'government',
        admission_status: 'open',
        whatsapp: '9850123456',
        udise_aishe_code: '27250900123',
      });
    });

    it('parses partial 9-column rows leaving omitted trailing columns undefined', () => {
      const csv9 =
        'Indrayani Mahavidyalaya, इंद्रायणी महाविद्यालय, College, Marathi, Talegaon, 02114-222225, NAAC Accredited, SPPU, Aided';
      const result = parseBulkSchoolCsv(csv9);
      expect(result.errors).toHaveLength(0);
      expect(result.valid).toHaveLength(1);
      expect(result.valid[0].board).toBe('SPPU');
      expect(result.valid[0].management_type).toBe('aided');
      expect(result.valid[0].admission_status).toBeUndefined();
      expect(result.valid[0].whatsapp).toBeUndefined();
      expect(result.valid[0].udise_aishe_code).toBeUndefined();
    });
  });

  describe('formatSchoolWhatsAppEnquiry & formatSchoolWhatsAppBroadcast', () => {
    it('builds English parent/student admission enquiry message with optional fields', () => {
      const msg = formatSchoolWhatsAppEnquiry({
        schoolName: 'B.K. Birla Centre for Education',
        studentName: 'Aarav Patil',
        targetClassOrCourse: 'Std 6th CBSE',
        villageOrArea: 'Parandwadi',
        question: 'Please share school bus route timings and hostel fees.',
        isMr: false,
      });

      expect(msg).toContain('Hello B.K. Birla Centre for Education');
      expect(msg).toContain('Student Name: Aarav Patil');
      expect(msg).toContain('Class / Course: Std 6th CBSE');
      expect(msg).toContain('Village / Area: Parandwadi');
      expect(msg).toContain('Query: Please share school bus route timings and hostel fees.');
    });

    it('builds Marathi parent/student admission enquiry message', () => {
      const msg = formatSchoolWhatsAppEnquiry({
        schoolName: 'जि.प. प्राथमिक शाळा, परंदवडी',
        studentName: 'स्वरा कदम',
        targetClassOrCourse: 'इयत्ता १ ली',
        villageOrArea: 'परंदवडी',
        isMr: true,
      });

      expect(msg).toContain('नमस्कार जि.प. प्राथमिक शाळा, परंदवडी');
      expect(msg).toContain('विद्यार्थ्याचे नाव: स्वरा कदम');
      expect(msg).toContain('इयत्ता / अभ्यासक्रम: इयत्ता १ ली');
      expect(msg).toContain('गाव / परिसर: परंदवडी');
      expect(msg).toContain('कृपया तपशील व प्रवेशाची माहिती शेअर करा.');
    });

    it('builds English and Marathi WhatsApp broadcast cards for institute owners', () => {
      const enCard = formatSchoolWhatsAppBroadcast({
        schoolName: 'Indrayani College',
        schoolNameMr: 'इंद्रायणी महाविद्यालय',
        typeLabel: 'Senior Degree College',
        area: 'Talegaon Dabhade',
        board: 'SPPU',
        admissionStatus: 'open',
        admissionDeadline: '2026-07-15',
        streams: ['B.A.', 'B.Com.', 'B.Sc.'],
        scholarships: ['MahaDBT Post-Matric', 'EBC Waiver', 'SC Freeship', 'Extra'],
        availableSeats: 42,
        phone: '02114-222225',
        publicUrl: 'https://apnalocal.in/maval/schools/indrayani-college',
        isMr: false,
      });

      expect(enCard).toContain('🎓 *Indrayani College*');
      expect(enCard).toContain('Category: Senior Degree College');
      expect(enCard).toContain('Location: Talegaon Dabhade');
      expect(enCard).toContain('Board / Univ: SPPU');
      expect(enCard).toContain('*Admissions Open*');
      expect(enCard).toContain('Deadline: 2026-07-15');
      expect(enCard).toContain('Available Seats: 42');
      expect(enCard).toContain('B.A., B.Com., B.Sc.');
      expect(enCard).toContain('MahaDBT Post-Matric, EBC Waiver, SC Freeship');
      expect(enCard).not.toContain('Extra');
      expect(enCard).toContain('Contact: 02114-222225');
      expect(enCard).toContain('https://apnalocal.in/maval/schools/indrayani-college');

      const mrCard = formatSchoolWhatsAppBroadcast({
        schoolName: 'Indrayani College',
        schoolNameMr: 'इंद्रायणी महाविद्यालय',
        typeLabel: 'वरिष्ठ महाविद्यालय',
        area: 'तळेगाव दाभाडे',
        board: 'SPPU',
        admissionStatus: 'open',
        availableSeats: 42,
        phone: '02114-222225',
        isMr: true,
      });

      expect(mrCard).toContain('🎓 *इंद्रायणी महाविद्यालय*');
      expect(mrCard).toContain('प्रकार: वरिष्ठ महाविद्यालय');
      expect(mrCard).toContain('*प्रवेश सुरू*');
      expect(mrCard).toContain('उपलब्ध जागा: 42');
      expect(mrCard).toContain('संपर्क: 02114-222225');
    });
  });
});
