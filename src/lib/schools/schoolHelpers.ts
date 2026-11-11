/**
 * School and Higher Education Helper Utilities.
 * Supports schools, junior colleges, degree colleges, engineering/polytechnic, and universities.
 */
import type { SchoolRow } from '@/lib/repos/schoolsRepo';

export type SchoolType =
  | 'primary'
  | 'secondary'
  | 'higher-secondary'
  | 'college'
  | 'engineering-polytechnic'
  | 'university'
  | 'coaching'
  | 'other';

export type SchoolMedium =
  | 'marathi'
  | 'english'
  | 'semi-english'
  | 'hindi'
  | 'urdu'
  | 'other';

export interface SchoolTypeMeta {
  value: SchoolType;
  labelEn: string;
  labelMr: string;
  badgeClass: string;
  group: 'school' | 'college' | 'higher-ed' | 'other';
}

export const SCHOOL_TYPE_CONFIG: Record<SchoolType, SchoolTypeMeta> = {
  primary: {
    value: 'primary',
    labelEn: 'Primary School (1st-4th/7th)',
    labelMr: 'प्राथमिक शाळा',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    group: 'school',
  },
  secondary: {
    value: 'secondary',
    labelEn: 'Secondary High School (8th-10th)',
    labelMr: 'माध्यमिक विद्यालय',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
    group: 'school',
  },
  'higher-secondary': {
    value: 'higher-secondary',
    labelEn: 'Junior College (11th-12th)',
    labelMr: 'कनिष्ठ महाविद्यालय',
    badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30',
    group: 'college',
  },
  college: {
    value: 'college',
    labelEn: 'Senior Degree College (Arts/Sci/Com)',
    labelMr: 'वरिष्ठ महाविद्यालय',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
    group: 'college',
  },
  'engineering-polytechnic': {
    value: 'engineering-polytechnic',
    labelEn: 'Engineering / Polytechnic / ITI',
    labelMr: 'अभियांत्रिकी व तंत्रनिकेतन / ITI',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    group: 'higher-ed',
  },
  university: {
    value: 'university',
    labelEn: 'University / Campus / Sub-Center',
    labelMr: 'विद्यापीठ व उपकेंद्र',
    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
    group: 'higher-ed',
  },
  coaching: {
    value: 'coaching',
    labelEn: 'Coaching & Study Room (Abhyasika)',
    labelMr: 'क्लासेस व अभ्यासिका',
    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    group: 'other',
  },
  other: {
    value: 'other',
    labelEn: 'Other Educational Institute',
    labelMr: 'इतर शिक्षण संस्था',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    group: 'other',
  },
};

export const SCHOOL_TYPE_OPTIONS = Object.values(SCHOOL_TYPE_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.labelEn} (${c.labelMr})`,
}));

export const SCHOOL_MEDIUM_CONFIG: Record<
  SchoolMedium,
  { labelEn: string; labelMr: string; badgeClass: string }
> = {
  marathi: {
    labelEn: 'Marathi Medium',
    labelMr: 'मराठी माध्यम',
    badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20',
  },
  english: {
    labelEn: 'English Medium',
    labelMr: 'इंग्रजी माध्यम',
    badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20',
  },
  'semi-english': {
    labelEn: 'Semi-English Medium',
    labelMr: 'सेमी-इंग्रजी',
    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20',
  },
  hindi: {
    labelEn: 'Hindi Medium',
    labelMr: 'हिंदी माध्यम',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  urdu: {
    labelEn: 'Urdu Medium',
    labelMr: 'उर्दू माध्यम',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  other: {
    labelEn: 'Other Medium',
    labelMr: 'इतर माध्यम',
    badgeClass: 'bg-muted text-muted-foreground border-border',
  },
};

export const SCHOOL_MEDIUM_OPTIONS = (
  Object.keys(SCHOOL_MEDIUM_CONFIG) as SchoolMedium[]
).map((key) => ({
  value: key,
  label: `${SCHOOL_MEDIUM_CONFIG[key].labelEn} (${SCHOOL_MEDIUM_CONFIG[key].labelMr})`,
}));

export const COMMON_BOARDS = [
  { value: 'State Board (SSC/HSC)', label: 'State Board (महाराष्ट्र राज्य मंडळ)' },
  { value: 'CBSE', label: 'CBSE (केंद्रीय माध्यमिक शिक्षण मंडळ)' },
  { value: 'ICSE', label: 'ICSE / ISC' },
  { value: 'SPPU (Pune University)', label: 'SPPU (सावित्रीबाई फुले पुणे विद्यापीठ)' },
  { value: 'KBCNMU (Jalgaon)', label: 'KBCNMU (कवयित्री बहिणाबाई चौधरी उत्तर महाराष्ट्र विद्यापीठ)' },
  { value: 'MSBTE (Polytechnic)', label: 'MSBTE (महाराष्ट्र राज्य तंत्र शिक्षण मंडळ)' },
  { value: 'DTE / AICTE', label: 'DTE / AICTE (Technical Education)' },
  { value: 'Autonomous', label: 'Autonomous (स्वायत्त संस्था)' },
  { value: 'Other', label: 'Other Board / University' },
];

export const COMMON_FACILITIES = [
  'School Bus / Transport (वाहतूक)',
  'Boys / Girls Hostel (वसतिगृह)',
  'Science & Computer Labs (प्रयोगशाळा)',
  'Library & Reading Room (ग्रंथालय)',
  'Sports Ground (खेळाचे मैदान)',
  'Digital Classrooms (डिजिटल वर्ग)',
  'Canteen / Mess (कॅन्टीन)',
  'Auditorium / Hall (सभागृह)',
];

export interface SchoolExtendedMeta {
  type_override?: SchoolType;
  board?: string;
  streams?: string[];
  facilities?: string[];
  principal_name?: string;
  office_timing?: string;
  admission_status?: 'open' | 'closed' | 'ongoing';
  raw_description: string;
}

/**
 * Standard Postgres-level types accepted by the `schools_school_type_check` constraint.
 */
export type DbSchoolType = 'primary' | 'secondary' | 'higher-secondary' | 'college' | 'other';

/**
 * Maps an extended SchoolType to a safe DbSchoolType that always satisfies
 * the Postgres check constraint `schools_school_type_check`.
 */
export function toDbSchoolType(type: SchoolType | string | undefined): DbSchoolType {
  const norm = normalizeSchoolType(type);
  switch (norm) {
    case 'primary':
      return 'primary';
    case 'secondary':
      return 'secondary';
    case 'higher-secondary':
      return 'higher-secondary';
    case 'college':
    case 'engineering-polytechnic':
    case 'university':
      return 'college';
    case 'coaching':
    case 'other':
    default:
      return 'other';
  }
}

/**
 * Resolves the true educational category from a row, checking extended
 * metadata tags before falling back to the raw database column.
 */
export function resolveSchoolType(row: {
  school_type: string;
  description?: string | null;
}): SchoolType {
  const meta = parseSchoolDescription(row.description);
  if (meta.type_override && meta.type_override !== 'other') {
    return meta.type_override;
  }
  return normalizeSchoolType(row.school_type);
}

/**
 * Parses structured educational tags from the description text.
 * Tags format:
 * `[Type: engineering-polytechnic] · [Board: CBSE] · [Streams: Science, Commerce] · [Facilities: Bus, Hostel] · [Timing: 9 AM - 4 PM]`
 * followed by raw description text.
 */
export function parseSchoolDescription(
  desc: string | null | undefined
): SchoolExtendedMeta {
  if (!desc) {
    return { raw_description: '' };
  }

  const result: SchoolExtendedMeta = {
    raw_description: desc,
  };

  // Check for JSON comment envelope first: <!--edu_meta:{...}-->
  const jsonMatch = desc.match(/<!--edu_meta:([\s\S]*?)-->/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        ...parsed,
        raw_description: desc.replace(jsonMatch[0], '').trim(),
      };
    } catch {
      // fallback to bracket parser below
    }
  }

  // Parse type override tag [Type: ...]
  const typeMatch = desc.match(/\[Type:\s*([^\]]+)\]/i);
  if (typeMatch) {
    result.type_override = normalizeSchoolType(typeMatch[1]);
  }

  // Parse tag brackets like [Board: ...], [Streams: ...]
  const boardMatch = desc.match(/\[Board:\s*([^\]]+)\]/i);
  if (boardMatch) result.board = boardMatch[1].trim();

  const streamsMatch = desc.match(/\[Streams:\s*([^\]]+)\]/i);
  if (streamsMatch) {
    result.streams = streamsMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const facilitiesMatch = desc.match(/\[Facilities:\s*([^\]]+)\]/i);
  if (facilitiesMatch) {
    result.facilities = facilitiesMatch[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const timingMatch = desc.match(/\[Timing:\s*([^\]]+)\]/i);
  if (timingMatch) result.office_timing = timingMatch[1].trim();

  const principalMatch = desc.match(/\[Principal:\s*([^\]]+)\]/i);
  if (principalMatch) result.principal_name = principalMatch[1].trim();

  // Strip parsed tags from raw description to leave user text clean
  const cleaned = desc
    .replace(/\[(Type|Board|Streams|Facilities|Timing|Principal):[^\]]+\]\s*·?\s*/gi, '')
    .trim();
  result.raw_description = cleaned;

  return result;
}

/**
 * Serializes extended metadata into human-readable bracket tags prefixed
 * to the description text, maintaining full backward compatibility.
 */
export function serializeSchoolDescription(
  meta: Partial<SchoolExtendedMeta>
): string {
  const tags: string[] = [];

  if (
    meta.type_override &&
    (meta.type_override === 'engineering-polytechnic' ||
      meta.type_override === 'university' ||
      meta.type_override === 'coaching')
  ) {
    tags.push(`[Type: ${meta.type_override}]`);
  }

  if (meta.board?.trim()) tags.push(`[Board: ${meta.board.trim()}]`);
  if (meta.streams && meta.streams.length > 0) {
    tags.push(`[Streams: ${meta.streams.join(', ')}]`);
  }
  if (meta.facilities && meta.facilities.length > 0) {
    tags.push(`[Facilities: ${meta.facilities.join(', ')}]`);
  }
  if (meta.office_timing?.trim()) tags.push(`[Timing: ${meta.office_timing.trim()}]`);
  if (meta.principal_name?.trim()) {
    tags.push(`[Principal: ${meta.principal_name.trim()}]`);
  }

  const raw = meta.raw_description?.trim() || '';
  if (tags.length === 0) return raw;
  if (!raw) return tags.join(' · ');
  return `${tags.join(' · ')}\n\n${raw}`;
}

/**
 * Pure filter function for educational institution rows.
 */
export function filterSchools(
  rows: SchoolRow[],
  query: string,
  typeFilter: 'all' | SchoolType | 'schools' | 'colleges' | 'higher-ed' = 'all',
  statusFilter: 'all' | 'active' | 'disabled' = 'all'
): SchoolRow[] {
  const needle = query.trim().toLowerCase();

  return rows.filter((row) => {
    // 1. Status Filter
    if (statusFilter === 'active' && !row.is_active) return false;
    if (statusFilter === 'disabled' && row.is_active) return false;

    const rowType = resolveSchoolType(row);

    // 2. Type Filter (Supports individual or grouped)
    if (typeFilter !== 'all') {
      if (typeFilter === 'schools') {
        if (rowType !== 'primary' && rowType !== 'secondary') {
          return false;
        }
      } else if (typeFilter === 'colleges') {
        if (
          rowType !== 'higher-secondary' &&
          rowType !== 'college'
        ) {
          return false;
        }
      } else if (typeFilter === 'higher-ed') {
        if (
          rowType !== 'engineering-polytechnic' &&
          rowType !== 'university'
        ) {
          return false;
        }
      } else if (rowType !== typeFilter) {
        return false;
      }
    }

    // 3. Search Needle
    if (!needle) return true;

    const hay = [
      row.name,
      row.name_mr,
      row.area,
      row.sub_area,
      row.address,
      row.phone,
      row.email,
      row.website,
      row.school_type,
      row.medium,
      row.description,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return hay.includes(needle);
  });
}

/**
 * Splits a single CSV / TSV / pipe line respecting quoted strings.
 */
export function splitDelimitedLine(line: string): string[] {
  let delimiter = ',';
  if (line.includes('\t')) delimiter = '\t';
  else if (line.includes('|')) delimiter = '|';

  const tokens: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (!inQuotes && (char === '"' || char === "'")) {
      inQuotes = true;
      quoteChar = char;
    } else if (inQuotes && char === quoteChar) {
      if (i + 1 < line.length && line[i + 1] === quoteChar) {
        current += quoteChar;
        i++;
      } else {
        inQuotes = false;
        quoteChar = '';
      }
    } else if (!inQuotes && char === delimiter) {
      tokens.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  tokens.push(current.trim());
  return tokens;
}

export function normalizeSchoolType(input: string | undefined): SchoolType {
  if (!input) return 'other';
  const lower = input.toLowerCase().trim();
  if (lower.includes('primary') || lower.includes('प्राथमिक') || lower.includes('1st') || lower.includes('4th')) return 'primary';
  if (lower.includes('junior') || lower.includes('jr') || lower.includes('higher') || lower.includes('11th') || lower.includes('12th') || lower.includes('कनिष्ठ')) return 'higher-secondary';
  if (lower.includes('high') || lower.includes('secondary') || lower.includes('माध्यमिक') || lower.includes('10th') || lower.includes('ssc')) return 'secondary';
  if (lower.includes('engg') || lower.includes('engineering') || lower.includes('polytechnic') || lower.includes('iti') || lower.includes('तंत्र')) return 'engineering-polytechnic';
  if (lower.includes('univ') || lower.includes('विद्यापीठ') || lower.includes('campus') || lower.includes('उपकेंद्र')) return 'university';
  if (lower.includes('coach') || lower.includes('class') || lower.includes('abhyasika') || lower.includes('अभ्यासिका')) return 'coaching';
  if (lower.includes('college') || lower.includes('degree') || lower.includes('महाविद्यालय')) return 'college';
  return 'other';
}

export function normalizeSchoolMedium(input: string | undefined): SchoolMedium | null {
  if (!input) return null;
  const lower = input.toLowerCase().trim();
  if (lower.includes('semi')) return 'semi-english';
  if (lower.includes('eng')) return 'english';
  if (lower.includes('mar') || lower.includes('मराठी')) return 'marathi';
  if (lower.includes('hin') || lower.includes('हिंदी')) return 'hindi';
  if (lower.includes('urd') || lower.includes('उर्दू')) return 'urdu';
  return 'other';
}

export interface ParsedBulkSchoolRow {
  name: string;
  name_mr?: string;
  school_type: SchoolType;
  medium?: SchoolMedium;
  area?: string;
  phone?: string;
  description?: string;
  is_active: boolean;
}

/**
 * Parses multi-line pasted CSV / TSV text for bulk education institute import.
 * Supports rows like:
 * "Z.P. Primary School, जि.प. प्राथमिक शाळा, Primary, Marathi, Station Road, 02583-234000, State Board"
 */
export function parseBulkSchoolCsv(rawText: string): {
  valid: ParsedBulkSchoolRow[];
  errors: { line: number; message: string; raw: string }[];
} {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid: ParsedBulkSchoolRow[] = [];
  const errors: { line: number; message: string; raw: string }[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx];

    const cols = splitDelimitedLine(line).map((c) => c.replace(/^["']|["']$/g, '').trim());

    // Skip header line if present
    const firstLower = (cols[0] || '').toLowerCase();
    if (
      idx === 0 &&
      (firstLower.includes('name') ||
        firstLower.includes('institute') ||
        firstLower.includes('school') ||
        firstLower.includes('नाव') ||
        firstLower.includes('शाळा'))
    ) {
      continue;
    }

    if (!cols[0]) {
      errors.push({ line: lineNum, message: 'Institute name is missing', raw: line });
      continue;
    }

    const name = cols[0];
    let name_mr: string | undefined = undefined;
    let typeRaw = '';
    let mediumRaw = '';
    let area = '';
    let phone = '';
    let notes = '';

    // If 6-7 columns: Name, Marathi Name, Type, Medium, Area, Phone, Notes
    if (cols.length >= 6) {
      name_mr = cols[1] || undefined;
      typeRaw = cols[2];
      mediumRaw = cols[3];
      area = cols[4];
      phone = cols[5];
      notes = cols.slice(6).join(' · ');
    } else if (cols.length === 5) {
      name_mr = cols[1] || undefined;
      typeRaw = cols[2];
      mediumRaw = cols[3];
      area = cols[4];
    } else if (cols.length === 4) {
      name_mr = cols[1] || undefined;
      typeRaw = cols[2];
      area = cols[3];
    } else if (cols.length === 3) {
      typeRaw = cols[1];
      area = cols[2];
    } else if (cols.length === 2) {
      typeRaw = cols[1];
    }

    const school_type = normalizeSchoolType(typeRaw);
    const medium = normalizeSchoolMedium(mediumRaw) || undefined;

    let finalDesc: string | undefined = undefined;
    if (notes) {
      finalDesc = notes.startsWith('[') ? notes : `[Notes: ${notes}]`;
    }

    valid.push({
      name,
      name_mr: name_mr || undefined,
      school_type,
      medium,
      area: area || undefined,
      phone: phone || undefined,
      description: finalDesc,
      is_active: true,
    });
  }

  return { valid, errors };
}

export interface SeedSchool {
  name: string;
  name_mr: string;
  school_type: SchoolType;
  medium: SchoolMedium;
  area: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
}

export const MUKTAINAGAR_EDUCATION_SEEDS: SeedSchool[] = [
  {
    name: 'Z.P. Primary Central School, Muktainagar',
    name_mr: 'जि.प. प्राथमिक केंद्र शाळा, मुक्ताईनगर',
    school_type: 'primary',
    medium: 'marathi',
    area: 'Station Road',
    address: 'Near Old Bus Stand, Muktainagar',
    phone: '02583-234120',
    description: '[Board: State Board (SSC/HSC)] · [Facilities: Library & Reading Room, Sports Ground, Digital Classrooms]\n\nHistoric primary school founded in 1952, catering to 1st to 7th grade students in Muktainagar town.',
  },
  {
    name: 'Muktainagar High School & Junior College',
    name_mr: 'मुक्ताईनगर हायस्कूल व कनिष्ठ महाविद्यालय',
    school_type: 'higher-secondary',
    medium: 'semi-english',
    area: 'College Road',
    address: 'Muktainagar, Dist. Jalgaon - 425306',
    phone: '02583-234250',
    description: '[Board: State Board (SSC/HSC)] · [Streams: Science, Commerce, Arts] · [Facilities: Science & Computer Labs, Library, Sports Ground, Digital Classrooms]\n\nRenowned educational institute providing SSC secondary education and HSC Junior College with full Science and Commerce streams.',
  },
  {
    name: 'Smt. Godavaribai Ganpatrao Khadse Senior College',
    name_mr: 'श्रीमती जी. जी. खडसे कला, वाणिज्य व विज्ञान महाविद्यालय',
    school_type: 'college',
    medium: 'marathi',
    area: 'Taluka Campus',
    address: 'National Highway 6, Muktainagar, Jalgaon',
    phone: '02583-234408',
    website: 'https://khadsecollege.in',
    description: '[Board: KBCNMU (Jalgaon)] · [Streams: Arts, Commerce, Science, Computer Science, BBA, BCA] · [Facilities: Boys/Girls Hostel, Library, Computer Lab, Auditorium, Canteen]\n\nGrade A NAAC accredited multi-faculty senior degree college affiliated with Kavayitri Bahinabai Chaudhari North Maharashtra University.',
  },
  {
    name: 'Government ITI Muktainagar',
    name_mr: 'शासकीय औद्योगिक प्रशिक्षण संस्था (ITI), मुक्ताईनगर',
    school_type: 'engineering-polytechnic',
    medium: 'marathi',
    area: 'Bhusawal Road',
    address: 'Near MIDC, Muktainagar',
    phone: '02583-234789',
    description: '[Board: DTE / AICTE] · [Streams: Electrician, Fitter, Welder, COPA, Wireman] · [Facilities: Science & Computer Labs, Workshop, Sports Ground]\n\nGovernment vocational training institute offering technical trades and skill development certification under NCVT / DTE.',
  },
  {
    name: 'Saint Muktabai English Medium School',
    name_mr: 'संत मुक्ताबाई इंग्लिश मीडियम स्कूल',
    school_type: 'secondary',
    medium: 'english',
    area: 'Pachora Road',
    address: 'Muktainagar, Dist. Jalgaon',
    phone: '9822334455',
    description: '[Board: State Board (SSC/HSC)] · [Facilities: School Bus, Computer Lab, Library, Digital Classrooms]\n\nEnglish medium high school with dedicated transport and activity-based learning.',
  },
  {
    name: 'KBCNMU University Sub-Center & Competitive Exam Study Room',
    name_mr: 'कवयित्री बहिणाबाई चौधरी उ.म.वि. उपकेंद्र व अभ्यासिका',
    school_type: 'university',
    medium: 'marathi',
    area: 'Near Tehsil Office',
    address: 'Administrative Complex, Muktainagar',
    phone: '02583-234900',
    description: '[Board: KBCNMU (Jalgaon)] · [Streams: Distance Education, MPSC/UPSC Guidance] · [Facilities: Library & Reading Room, Digital Classrooms, 24/7 Abhyasika]\n\nOfficial university guidance center offering distance degree admissions, certificate courses, and student study library.',
  },
];

export const MAVAL_EDUCATION_SEEDS: SeedSchool[] = [
  {
    name: 'Z.P. Primary School, Parandwadi',
    name_mr: 'जि.प. प्राथमिक शाळा, परंदवडी',
    school_type: 'primary',
    medium: 'marathi',
    area: 'Parandwadi Gaothan',
    address: 'Near Gram Panchayat, Parandwadi, Tal. Maval',
    phone: '9850123456',
    description: '[Board: State Board (SSC/HSC)] · [Facilities: Digital Classrooms, Sports Ground, Mid-Day Meal]\n\nCentrally located Zilla Parishad primary school serving children across Parandwadi village and surrounding wadis.',
  },
  {
    name: 'B.K. Birla Centre for Education',
    name_mr: 'बी.के. बिर्ला सेंटर फॉर एज्युकेशन',
    school_type: 'secondary',
    medium: 'english',
    area: 'Shirgaon / Somatane',
    address: 'Near Somatane Toll Naka, Pune-Mumbai Highway, Maval',
    phone: '02114-287000',
    website: 'https://bkbirlacentre.com',
    description: '[Board: CBSE] · [Streams: Science, Commerce] · [Facilities: Boys/Girls Hostel, School Bus, Swimming Pool, Sports Complex, Labs]\n\nPremier world-class CBSE residential and day boarding school located 4 km from Parandwadi on the expressway corridor.',
  },
  {
    name: 'D.Y. Patil College of Engineering & Innovation',
    name_mr: 'डी.वाय. पाटील कॉलेज ऑफ इंजिनिअरिंग अँड इनोव्हेशन',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    area: 'Varale / Ambi Campus',
    address: 'SR No. 27/A/1/2C, Varale, Talegaon Dabhade, Maval',
    phone: '02114-673351',
    website: 'https://dypcoei.edu.in',
    description: '[Board: SPPU (Pune University)] · [Streams: Computer Engineering, AI & Data Science, Mechanical, Civil] · [Facilities: Hostel, School Bus, Computer Lab, Library, Canteen, Auditorium]\n\nAICTE approved degree engineering college affiliated with Savitribai Phule Pune University located within 6 km of Parandwadi.',
  },
  {
    name: 'D.Y. Patil Polytechnic, Ambi',
    name_mr: 'डी.वाय. पाटील तंत्रनिकेतन (पॉलिटेक्निक), आंबी',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    area: 'Ambi / Talegaon',
    address: 'Ambi, Talegaon Dabhade, Pune - 410507',
    phone: '02114-673355',
    website: 'https://dypatil.edu',
    description: '[Board: MSBTE (Polytechnic)] · [Streams: Diploma in Mechanical, Computer, Civil, Electrical] · [Facilities: Science & Computer Labs, Hostel, Transport, Workshop]\n\nDiploma engineering institute providing technical education to students across Maval, Talegaon, and PCMC.',
  },
  {
    name: 'Indrayani Arts, Commerce & Science College',
    name_mr: 'इंद्रायणी कला, वाणिज्य व विज्ञान महाविद्यालय',
    school_type: 'college',
    medium: 'marathi',
    area: 'Talegaon Dabhade',
    address: 'Indrayani Nagar, Talegaon Dabhade, Maval',
    phone: '02114-222225',
    website: 'https://indrayanicollege.com',
    description: '[Board: SPPU (Pune University)] · [Streams: B.A., B.Com., B.Sc., BBA, BCA, M.Com.] · [Facilities: Library, Computer Lab, Sports Ground, Auditorium]\n\nRenowned senior college serving the rural and urban youth of Maval taluka for over 50 years under SPPU.',
  },
  {
    name: 'Indira College of Pharmacy & Engineering',
    name_mr: 'इंदिरा इन्स्टिट्यूट ऑफ फार्मसी व इंजिनिअरिंग',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    area: 'Somatane Phata',
    address: 'New Mumbai-Pune Highway, Somatane Phata, Tal. Maval',
    phone: '02114-661500',
    website: 'https://indiraedu.com',
    description: '[Board: SPPU (Pune University)] · [Streams: B.Pharm, D.Pharm, Computer Engineering, MBA] · [Facilities: Science & Computer Labs, School Bus, Hostel, Library]\n\nPrestigious pharmaceutical and engineering campus located at Somatane Phata, right next to Parandwadi.',
  },
  {
    name: 'Government ITI Talegaon Dabhade',
    name_mr: 'शासकीय औद्योगिक प्रशिक्षण संस्था (ITI), तळेगाव दाभाडे',
    school_type: 'engineering-polytechnic',
    medium: 'marathi',
    area: 'Station Road',
    address: 'Near Railway Station, Talegaon Dabhade, Maval',
    phone: '02114-223450',
    description: '[Board: DTE / AICTE] · [Streams: CNC Machinist, Fitter, Electrician, Automobile, Welder] · [Facilities: Workshop, Computer Lab, Library]\n\nDirect feeder technical institute for the Talegaon MIDC automotive and engineering manufacturing hub.',
  },
  {
    name: 'MIMER Medical College & Bhausaheb Sardesai Hospital',
    name_mr: 'मायमर मेडिकल कॉलेज व भाऊसाहेब सरदेसाई रुग्णालय',
    school_type: 'college',
    medium: 'english',
    area: 'Somatane Road',
    address: 'Talegaon Dabhade, Tal. Maval, Pune - 410507',
    phone: '02114-308300',
    website: 'https://mitmimer.com',
    description: '[Board: Other] · [Streams: MBBS, MD/MS, Physiotherapy, Nursing] · [Facilities: 700-bed Hospital, Hostel, Library, Transport, Research Labs]\n\nTeaching medical college and tertiary care hospital serving the entire Maval region.',
  },
];
