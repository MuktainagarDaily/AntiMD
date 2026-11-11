import { describe, it, expect } from 'vitest';
import {
  SCHOOL_TYPE_CONFIG,
  SCHOOL_MEDIUM_CONFIG,
  parseSchoolDescription,
  serializeSchoolDescription,
  filterSchools,
  parseBulkSchoolCsv,
  normalizeSchoolType,
  normalizeSchoolMedium,
  toDbSchoolType,
  resolveSchoolType,
  MUKTAINAGAR_EDUCATION_SEEDS,
  MAVAL_EDUCATION_SEEDS,
  type SchoolType,
} from '@/lib/schools/schoolHelpers';
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
});
