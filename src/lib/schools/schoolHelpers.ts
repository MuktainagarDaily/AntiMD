/**
 * School and Higher Education Helper Utilities.
 * Supports schools, junior colleges, degree colleges, engineering/polytechnic,
 * universities, coaching & study rooms (Abhyasika), plus admissions, fees,
 * scholarships, documents, transport routes, and bilingual WhatsApp enquiries.
 */
import type { SchoolRow } from '@/lib/repos/schoolsRepo';
import { parseCsv } from '@/lib/csvUtils';

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

export type AdmissionStatus = 'open' | 'ongoing' | 'upcoming' | 'closed';
export type ManagementType = 'government' | 'aided' | 'private' | 'trust';
export type GenderType = 'coed' | 'boys' | 'girls';
export type FeeTier = 'free' | 'low' | 'moderate' | 'premium';
export type NoticeCategory =
  | 'admission'
  | 'exam'
  | 'scholarship'
  | 'holiday'
  | 'event'
  | 'general';

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

export const SCHOOL_TYPE_LABEL: Record<SchoolType, string> = Object.fromEntries(
  Object.entries(SCHOOL_TYPE_CONFIG).map(([k, v]) => [k, v.labelEn])
) as Record<SchoolType, string>;

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

export const ADMISSION_STATUS_CONFIG: Record<
  AdmissionStatus,
  { value: AdmissionStatus; labelEn: string; labelMr: string; badgeClass: string; dotClass: string }
> = {
  open: {
    value: 'open',
    labelEn: 'Admissions Open',
    labelMr: 'प्रवेश सुरू',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    dotClass: 'bg-emerald-500',
  },
  ongoing: {
    value: 'ongoing',
    labelEn: 'Ongoing (CAP / Spot)',
    labelMr: 'प्रवेश प्रक्रिया चालू',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-500',
  },
  upcoming: {
    value: 'upcoming',
    labelEn: 'Opening Soon',
    labelMr: 'लवकरच प्रवेश सुरू',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    dotClass: 'bg-amber-500',
  },
  closed: {
    value: 'closed',
    labelEn: 'Admissions Closed',
    labelMr: 'प्रवेश बंद',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    dotClass: 'bg-muted-foreground',
  },
};

export const ADMISSION_STATUS_OPTIONS = Object.values(ADMISSION_STATUS_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.labelEn} (${c.labelMr})`,
}));

export const MANAGEMENT_TYPE_CONFIG: Record<
  ManagementType,
  { value: ManagementType; labelEn: string; labelMr: string; badgeClass: string }
> = {
  government: {
    value: 'government',
    labelEn: 'Government / ZP',
    labelMr: 'शासकीय / जि.प.',
    badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  aided: {
    value: 'aided',
    labelEn: 'Govt-Aided',
    labelMr: 'अनुदानित',
    badgeClass: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  trust: {
    value: 'trust',
    labelEn: 'Sanstha / Trust',
    labelMr: 'संस्था / ट्रस्ट',
    badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30',
  },
  private: {
    value: 'private',
    labelEn: 'Private / Self-Financed',
    labelMr: 'खाजगी / विना-अनुदानित',
    badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
};

export const MANAGEMENT_TYPE_OPTIONS = Object.values(MANAGEMENT_TYPE_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.labelEn} (${c.labelMr})`,
}));

export const GENDER_TYPE_CONFIG: Record<
  GenderType,
  { value: GenderType; labelEn: string; labelMr: string }
> = {
  coed: { value: 'coed', labelEn: 'Co-Education (Boys & Girls)', labelMr: 'सहशिक्षण (मुले व मुली)' },
  boys: { value: 'boys', labelEn: 'Boys Only', labelMr: 'फक्त मुलांसाठी' },
  girls: { value: 'girls', labelEn: 'Girls Only (Kanya)', labelMr: 'फक्त मुलींसाठी (कन्या)' },
};

export const GENDER_TYPE_OPTIONS = Object.values(GENDER_TYPE_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.labelEn} (${c.labelMr})`,
}));

export const FEE_TIER_CONFIG: Record<
  FeeTier,
  { value: FeeTier; labelEn: string; labelMr: string }
> = {
  free: { value: 'free', labelEn: 'Free / RTE / Govt Zero-Fee', labelMr: 'मोफत / शासकीय / RTE' },
  low: { value: 'low', labelEn: 'Subsidized / Affordable (< ₹15k/yr)', labelMr: 'माफक शुल्क (< ₹15,000)' },
  moderate: { value: 'moderate', labelEn: 'Moderate (₹15k – ₹50k/yr)', labelMr: 'मध्यम शुल्क (₹15k–₹50k)' },
  premium: { value: 'premium', labelEn: 'Professional / Higher (> ₹50k/yr)', labelMr: 'व्यावसायिक / उच्च (> ₹50k)' },
};

export const FEE_TIER_OPTIONS = Object.values(FEE_TIER_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.labelEn} (${c.labelMr})`,
}));

export const NOTICE_CATEGORY_CONFIG: Record<
  NoticeCategory,
  { value: NoticeCategory; labelEn: string; labelMr: string; badgeClass: string; emoji: string }
> = {
  admission: {
    value: 'admission',
    labelEn: 'Admission',
    labelMr: 'प्रवेश सूचना',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    emoji: '🎓',
  },
  exam: {
    value: 'exam',
    labelEn: 'Exam / Timetable',
    labelMr: 'परीक्षा वेळापत्रक',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    emoji: '📝',
  },
  scholarship: {
    value: 'scholarship',
    labelEn: 'Scholarship / EBC',
    labelMr: 'शिष्यवृत्ती',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    emoji: '🏅',
  },
  holiday: {
    value: 'holiday',
    labelEn: 'Holiday / Timing',
    labelMr: 'सुट्टी / वेळ बदल',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    emoji: '📅',
  },
  event: {
    value: 'event',
    labelEn: 'Campus Event',
    labelMr: 'कार्यक्रम',
    badgeClass: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
    emoji: '🎉',
  },
  general: {
    value: 'general',
    labelEn: 'General Circular',
    labelMr: 'सामान्य परिपत्रक',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    emoji: '📢',
  },
};

export const NOTICE_CATEGORY_OPTIONS = Object.values(NOTICE_CATEGORY_CONFIG).map((c) => ({
  value: c.value,
  label: `${c.emoji} ${c.labelEn} (${c.labelMr})`,
}));

export const COMMON_BOARDS = [
  { value: 'State Board (SSC/HSC)', label: 'State Board (महाराष्ट्र राज्य मंडळ)' },
  { value: 'CBSE', label: 'CBSE (केंद्रीय माध्यमिक शिक्षण मंडळ)' },
  { value: 'ICSE', label: 'ICSE / ISC' },
  { value: 'SPPU (Pune University)', label: 'SPPU (सावित्रीबाई फुले पुणे विद्यापीठ)' },
  { value: 'KBCNMU (Jalgaon)', label: 'KBCNMU (कवयित्री बहिणाबाई चौधरी उत्तर महाराष्ट्र विद्यापीठ)' },
  { value: 'MSBTE (Polytechnic)', label: 'MSBTE (महाराष्ट्र राज्य तंत्र शिक्षण मंडळ)' },
  { value: 'DTE / AICTE', label: 'DTE / AICTE (Technical Education)' },
  { value: 'MUHS / Medical', label: 'MUHS Nashik / NMC (वैद्यकीय)' },
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
  'Mid-Day Meal / Poshan (मध्यान्ह भोजन)',
  'Free Wi-Fi / AC Study Room (अभ्यासिका)',
];

export const COMMON_SCHOLARSHIPS = [
  'RTE 25% Free Admission',
  'MahaDBT Post-Matric',
  'EBC / Rajarshi Shahu Fee Waiver',
  'Minority Scholarship',
  'SC / ST / OBC / VJNT Freeship',
  'Panjabrao Deshmukh Hostel Allowance',
  'Merit / Trust Scholarship',
];

export const COMMON_DOCUMENTS = [
  'Birth Certificate (जन्म दाखला)',
  'Previous School Leaving Certificate (LC / TC)',
  'Aadhaar Card (आधार कार्ड)',
  'Last Marksheet / Result (गुणपत्रिका)',
  'Caste & Non-Creamy Layer Certificate',
  'Income Certificate (उत्पन्नाचा दाखला)',
  'Domicile / Nationality Certificate',
  'Passport Size Photos (3 copies)',
  'MHT-CET / JEE / NEET Allotment Letter',
];

export const COACHING_FOCUS_OPTIONS = [
  'MHT-CET / JEE / NEET',
  'MPSC / UPSC',
  'Police Bharti / Army / Talathi',
  '10th / 12th Board Tuitions',
  'Scholarship / Navodaya / Olympiad',
  'MS-CIT / Coding / Computer Tally',
  'Spoken English / Competitive Reading Room',
];

export interface SchoolExtendedMeta {
  type_override?: SchoolType;
  board?: string;
  streams?: string[];
  facilities?: string[];
  principal_name?: string;
  office_timing?: string;
  admission_status?: AdmissionStatus;
  management_type?: ManagementType;
  gender_type?: GenderType;
  fee_tier?: FeeTier;
  scholarships?: string[];
  required_documents?: string[];
  transport_villages?: string[];
  coaching_focus?: string[];
  mediums?: string[];
  classes_offered?: string;
  udise_aishe_code?: string;
  established_year?: number;
  accreditation?: string;
  admission_deadline?: string;
  admission_url?: string;
  prospectus_url?: string;
  annual_fee_min?: number;
  annual_fee_max?: number;
  total_seats?: number;
  available_seats?: number;
  raw_description: string;
}

/**
 * Standard Postgres-level types accepted by the legacy `schools_school_type_check` constraint.
 */
export type DbSchoolType = 'primary' | 'secondary' | 'higher-secondary' | 'college' | 'other';

/**
 * Maps an extended SchoolType to a safe DbSchoolType that always satisfies
 * the legacy Postgres check constraint `schools_school_type_check`.
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
 * Preserves full backward compatibility with bracket tags:
 * `[Type: engineering-polytechnic] · [Board: CBSE] · [Streams: Science, Commerce] · [Facilities: Bus, Hostel] · [Timing: 9 AM - 4 PM]`
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

  const typeMatch = desc.match(/\[Type:\s*([^\]]+)\]/i);
  if (typeMatch) {
    result.type_override = normalizeSchoolType(typeMatch[1]);
  }

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
 * Merges structured DB columns (post-migration 20261112000000) with
 * legacy bracket-tag description metadata so UI code has one unified reader.
 */
export function getSchoolResolvedMeta(school: Partial<SchoolRow>): SchoolExtendedMeta {
  const descMeta = parseSchoolDescription(school.description);

  return {
    type_override: descMeta.type_override,
    board: school.board || descMeta.board,
    streams:
      Array.isArray(school.streams) && school.streams.length > 0
        ? school.streams
        : descMeta.streams,
    facilities:
      Array.isArray(school.facilities) && school.facilities.length > 0
        ? school.facilities
        : descMeta.facilities,
    principal_name: school.principal_name || descMeta.principal_name,
    office_timing: school.office_timing || descMeta.office_timing,
    admission_status: (school.admission_status as AdmissionStatus | undefined) || descMeta.admission_status,
    management_type: (school.management_type as ManagementType | undefined) || descMeta.management_type,
    gender_type: (school.gender_type as GenderType | undefined) || descMeta.gender_type,
    fee_tier: (school.fee_tier as FeeTier | undefined) || descMeta.fee_tier,
    scholarships: Array.isArray(school.scholarships) ? school.scholarships : descMeta.scholarships,
    required_documents: Array.isArray(school.required_documents)
      ? school.required_documents
      : descMeta.required_documents,
    transport_villages: Array.isArray(school.transport_villages)
      ? school.transport_villages
      : descMeta.transport_villages,
    coaching_focus: Array.isArray(school.coaching_focus)
      ? school.coaching_focus
      : descMeta.coaching_focus,
    mediums:
      Array.isArray(school.mediums) && school.mediums.length > 0
        ? school.mediums
        : school.medium
          ? [school.medium]
          : descMeta.mediums,
    classes_offered: school.classes_offered || descMeta.classes_offered,
    udise_aishe_code: school.udise_aishe_code || descMeta.udise_aishe_code,
    established_year: school.established_year ?? descMeta.established_year,
    accreditation: school.accreditation || descMeta.accreditation,
    admission_deadline: school.admission_deadline || descMeta.admission_deadline,
    admission_url: school.admission_url || descMeta.admission_url,
    prospectus_url: school.prospectus_url || descMeta.prospectus_url,
    annual_fee_min: school.annual_fee_min ?? descMeta.annual_fee_min,
    annual_fee_max: school.annual_fee_max ?? descMeta.annual_fee_max,
    total_seats: school.total_seats ?? descMeta.total_seats,
    available_seats: school.available_seats ?? descMeta.available_seats,
    raw_description: descMeta.raw_description,
  };
}

export interface SchoolAdvancedFilterOptions {
  admissionFilter?: 'all' | 'open_only' | AdmissionStatus;
  managementFilter?: 'all' | ManagementType;
  mediumFilter?: 'all' | SchoolMedium;
}

/**
 * Pure filter function for educational institution rows.
 */
export function filterSchools(
  rows: SchoolRow[],
  query: string,
  typeFilter: 'all' | SchoolType | 'schools' | 'colleges' | 'higher-ed' = 'all',
  statusFilter: 'all' | 'active' | 'disabled' = 'all',
  advanced: SchoolAdvancedFilterOptions = {}
): SchoolRow[] {
  const needle = query.trim().toLowerCase();

  return rows.filter((row) => {
    // 1. Visibility Status Filter
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
        if (rowType !== 'higher-secondary' && rowType !== 'college') {
          return false;
        }
      } else if (typeFilter === 'higher-ed') {
        if (rowType !== 'engineering-polytechnic' && rowType !== 'university') {
          return false;
        }
      } else if (rowType !== typeFilter) {
        return false;
      }
    }

    // 3. Advanced filters (Admissions, Management, Medium)
    const meta = getSchoolResolvedMeta(row);
    if (advanced.admissionFilter && advanced.admissionFilter !== 'all') {
      if (advanced.admissionFilter === 'open_only') {
        if (meta.admission_status !== 'open' && meta.admission_status !== 'ongoing') {
          return false;
        }
      } else if (meta.admission_status !== advanced.admissionFilter) {
        return false;
      }
    }

    if (advanced.managementFilter && advanced.managementFilter !== 'all') {
      if (meta.management_type !== advanced.managementFilter) return false;
    }

    if (advanced.mediumFilter && advanced.mediumFilter !== 'all') {
      const meds = new Set<string>([
        ...(row.medium ? [row.medium] : []),
        ...(meta.mediums || []),
      ]);
      if (!meds.has(advanced.mediumFilter)) return false;
    }

    // 4. Search Needle
    if (!needle) return true;

    const hay = [
      row.name,
      row.name_mr,
      row.area,
      row.sub_area,
      row.address,
      row.address_mr,
      row.phone,
      row.whatsapp,
      row.email,
      row.website,
      row.school_type,
      row.medium,
      row.board,
      row.udise_aishe_code,
      row.accreditation,
      row.classes_offered,
      ...(meta.streams || []),
      ...(meta.transport_villages || []),
      ...(meta.coaching_focus || []),
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

export function normalizeManagementType(input: string | undefined): ManagementType | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  if (lower.includes('gov') || lower.includes('zp') || lower.includes('शासकीय') || lower.includes('जि.प')) return 'government';
  if (lower.includes('aided') || lower.includes('अनुदान')) return 'aided';
  if (lower.includes('trust') || lower.includes('sanstha') || lower.includes('संस्था')) return 'trust';
  if (lower.includes('priv') || lower.includes('self') || lower.includes('खाजगी')) return 'private';
  return undefined;
}

export function normalizeAdmissionStatus(input: string | undefined): AdmissionStatus | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  if (lower.includes('open') || lower.includes('सुरू')) return 'open';
  if (lower.includes('ongoing') || lower.includes('cap') || lower.includes('चालू')) return 'ongoing';
  if (lower.includes('upcom') || lower.includes('soon') || lower.includes('लवकरच')) return 'upcoming';
  if (lower.includes('close') || lower.includes('बंद')) return 'closed';
  return undefined;
}

export function normalizeGenderType(input: string | undefined): GenderType | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  if (lower.includes('girl') || lower.includes('female') || lower.includes('kanya') || lower.includes('मुली')) return 'girls';
  if (lower.includes('boy') || lower.includes('male') || lower.includes('मुले')) return 'boys';
  if (lower.includes('coed') || lower.includes('co-ed') || lower.includes('both') || lower.includes('सह')) return 'coed';
  return undefined;
}

export function normalizeFeeTier(input: string | undefined): FeeTier | undefined {
  if (!input) return undefined;
  const lower = input.toLowerCase().trim();
  if (lower.includes('free') || lower.includes('rte') || lower.includes('मोफत')) return 'free';
  if (lower.includes('low') || lower.includes('budget') || lower.includes('subsid')) return 'low';
  if (lower.includes('mod')) return 'moderate';
  if (lower.includes('prem') || lower.includes('high') || lower.includes('prof')) return 'premium';
  return undefined;
}

export const SCHOOL_CSV_EXPORT_HEADERS = [
  'slug',
  'name',
  'name_mr',
  'school_type',
  'medium',
  'mediums',
  'board',
  'management_type',
  'gender_type',
  'udise_aishe_code',
  'established_year',
  'accreditation',
  'classes_offered',
  'streams',
  'facilities',
  'principal_name',
  'office_timing',
  'admission_status',
  'admission_deadline',
  'admission_url',
  'prospectus_url',
  'fee_tier',
  'annual_fee_min',
  'annual_fee_max',
  'scholarships',
  'required_documents',
  'transport_villages',
  'coaching_focus',
  'total_seats',
  'available_seats',
  'phone',
  'whatsapp',
  'email',
  'website',
  'area',
  'sub_area',
  'address',
  'address_mr',
  'latitude',
  'longitude',
  'image_url',
  'photos',
  'is_verified',
  'is_active',
  'description',
] as const;

export interface ParsedBulkSchoolRow {
  slug?: string;
  name: string;
  name_mr?: string;
  school_type: SchoolType;
  medium?: SchoolMedium;
  mediums?: string[];
  area?: string;
  sub_area?: string;
  address?: string;
  address_mr?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  description?: string;
  board?: string;
  management_type?: ManagementType;
  gender_type?: GenderType;
  admission_status?: AdmissionStatus;
  admission_deadline?: string;
  admission_url?: string;
  prospectus_url?: string;
  fee_tier?: FeeTier;
  annual_fee_min?: number;
  annual_fee_max?: number;
  classes_offered?: string;
  established_year?: number;
  accreditation?: string;
  principal_name?: string;
  office_timing?: string;
  streams?: string[];
  facilities?: string[];
  scholarships?: string[];
  required_documents?: string[];
  transport_villages?: string[];
  coaching_focus?: string[];
  total_seats?: number;
  available_seats?: number;
  udise_aishe_code?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  photos?: string[];
  is_verified?: boolean;
  is_active: boolean;
  fromExtendedHeader?: boolean;
}

const EXTENDED_SCHOOL_HEADER_KEYS = new Set([
  'slug', 'school_type', 'mediums', 'management_type', 'gender_type',
  'udise_aishe_code', 'established_year', 'accreditation', 'classes_offered',
  'streams', 'facilities', 'principal_name', 'office_timing',
  'admission_status', 'admission_deadline', 'admission_url', 'prospectus_url',
  'fee_tier', 'annual_fee_min', 'annual_fee_max', 'scholarships',
  'required_documents', 'transport_villages', 'coaching_focus',
  'total_seats', 'available_seats', 'email', 'website', 'address',
  'address_mr', 'sub_area', 'photos', 'image_url', 'is_verified', 'is_active',
  'description',
]);

function splitPipeList(v: string | undefined): string[] {
  if (!v) return [];
  return v.split('|').map((s) => s.trim()).filter(Boolean);
}

function optionalInt(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = parseInt(v.trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

function optionalNum(v: string | undefined): number | undefined {
  if (!v) return undefined;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : undefined;
}

function optionalHttpUrl(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const clean = v.trim();
  return /^https?:\/\//i.test(clean) ? clean : undefined;
}

/**
 * Parses multi-line pasted CSV / TSV / pipe text OR full header-mapped CSV files
 * exported from SchoolsTab for bulk education institute import.
 *
 * Preserves 2-12 positional column behavior cleanly while enabling lossless
 * round-trip imports for all 40+ Education Portal columns when headers match.
 */
export function parseBulkSchoolCsv(rawText: string): {
  valid: ParsedBulkSchoolRow[];
  errors: { line: number; message: string; raw: string }[];
} {
  const cleanRaw = rawText.startsWith('\uFEFF') ? rawText.slice(1) : rawText;
  const lines = cleanRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid: ParsedBulkSchoolRow[] = [];
  const errors: { line: number; message: string; raw: string }[] = [];
  if (lines.length === 0) return { valid, errors };

  // Detect Extended Header-Mapped CSV mode (e.g., SchoolsTab Export CSV or full template)
  const firstColsLower = splitDelimitedLine(lines[0]).map((c) =>
    c.replace(/^["']|["']$/g, '').toLowerCase().trim()
  );
  const hasExtendedHeaders =
    !lines[0].includes('\t') &&
    !lines[0].includes('|') &&
    firstColsLower.some((c) => EXTENDED_SCHOOL_HEADER_KEYS.has(c));

  if (hasExtendedHeaders) {
    const records = parseCsv(cleanRaw);
    records.forEach((raw, idx) => {
      const lineNum = idx + 2;
      const name = (raw['name'] || raw['institute name'] || raw['school name'] || '').trim();
      if (!name) {
        errors.push({ line: lineNum, message: 'Institute name is missing', raw: JSON.stringify(raw) });
        return;
      }

      const rawType = raw['school_type'] || raw['type'] || raw['category'] || '';
      const school_type = normalizeSchoolType(rawType);
      const mediumsArr = splitPipeList(raw['mediums'])
        .map((m) => normalizeSchoolMedium(m) || m.toLowerCase())
        .filter(Boolean);
      const primaryMedium = normalizeSchoolMedium(raw['medium']) || (mediumsArr[0] ? normalizeSchoolMedium(mediumsArr[0]) || undefined : undefined);

      const photosList = splitPipeList(raw['photos']).filter((u) => /^https?:\/\//i.test(u));
      const coverUrl = optionalHttpUrl(raw['image_url']) || photosList[0];
      const mergedPhotos = coverUrl && !photosList.includes(coverUrl)
        ? [coverUrl, ...photosList]
        : photosList;

      const isActiveRaw = (raw['is_active'] || '').trim().toLowerCase();
      const isVerifiedRaw = (raw['is_verified'] || '').trim().toLowerCase();

      valid.push({
        slug: (raw['slug'] || '').trim() || undefined,
        name,
        name_mr: (raw['name_mr'] || raw['marathi name'] || '').trim() || undefined,
        school_type,
        medium: primaryMedium,
        mediums: mediumsArr.length > 0 ? mediumsArr : primaryMedium ? [primaryMedium] : undefined,
        board: (raw['board'] || '').trim() || undefined,
        management_type: normalizeManagementType(raw['management_type'] || raw['management']),
        gender_type: normalizeGenderType(raw['gender_type'] || raw['gender']),
        udise_aishe_code: (raw['udise_aishe_code'] || raw['udise'] || '').trim() || undefined,
        established_year: optionalInt(raw['established_year']),
        accreditation: (raw['accreditation'] || '').trim() || undefined,
        classes_offered: (raw['classes_offered'] || '').trim() || undefined,
        streams: splitPipeList(raw['streams']),
        facilities: splitPipeList(raw['facilities']),
        principal_name: (raw['principal_name'] || '').trim() || undefined,
        office_timing: (raw['office_timing'] || '').trim() || undefined,
        admission_status: normalizeAdmissionStatus(raw['admission_status'] || raw['admissionstatus']),
        admission_deadline: (raw['admission_deadline'] || '').trim() || undefined,
        admission_url: optionalHttpUrl(raw['admission_url']),
        prospectus_url: optionalHttpUrl(raw['prospectus_url']),
        fee_tier: normalizeFeeTier(raw['fee_tier']),
        annual_fee_min: optionalNum(raw['annual_fee_min']),
        annual_fee_max: optionalNum(raw['annual_fee_max']),
        scholarships: splitPipeList(raw['scholarships']),
        required_documents: splitPipeList(raw['required_documents']),
        transport_villages: splitPipeList(raw['transport_villages']),
        coaching_focus: splitPipeList(raw['coaching_focus']),
        total_seats: optionalInt(raw['total_seats']),
        available_seats: optionalInt(raw['available_seats']),
        phone: (raw['phone'] || '').trim() || undefined,
        whatsapp: (raw['whatsapp'] || '').trim() || undefined,
        email: (raw['email'] || '').trim() || undefined,
        website: optionalHttpUrl(raw['website']),
        area: (raw['area'] || '').trim() || undefined,
        sub_area: (raw['sub_area'] || '').trim() || undefined,
        address: (raw['address'] || '').trim() || undefined,
        address_mr: (raw['address_mr'] || '').trim() || undefined,
        latitude: optionalNum(raw['latitude']),
        longitude: optionalNum(raw['longitude']),
        image_url: coverUrl,
        photos: mergedPhotos,
        is_verified: isVerifiedRaw === 'true' || isVerifiedRaw === '1',
        is_active: isActiveRaw === '' ? true : (isActiveRaw === 'true' || isActiveRaw === '1'),
        description: (raw['description'] || raw['notes'] || '').trim() || undefined,
        fromExtendedHeader: true,
      });
    });
    return { valid, errors };
  }

  // Legacy Positional Mode (2–12 columns, supports CSV / TSV / pipe)
  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx];

    const cols = splitDelimitedLine(line).map((c) => c.replace(/^["']|["']$/g, '').trim());

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
    let board: string | undefined;
    let management_type: ManagementType | undefined;
    let admission_status: AdmissionStatus | undefined;
    let whatsapp: string | undefined;
    let udise_aishe_code: string | undefined;

    if (cols.length >= 8) {
      name_mr = cols[1] || undefined;
      typeRaw = cols[2];
      mediumRaw = cols[3];
      area = cols[4];
      phone = cols[5];
      notes = cols[6] || '';
      board = cols[7] || undefined;
      management_type = normalizeManagementType(cols[8]);
      admission_status = normalizeAdmissionStatus(cols[9]);
      whatsapp = cols[10] || undefined;
      udise_aishe_code = cols[11] || undefined;
    } else if (cols.length >= 6) {
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
      board,
      management_type,
      admission_status,
      whatsapp,
      udise_aishe_code,
      is_active: true,
    });
  }

  return { valid, errors };
}

/**
 * Generates a structured admission / enquiry WhatsApp message from a parent or student.
 */
export function formatSchoolWhatsAppEnquiry(opts: {
  schoolName: string;
  studentName?: string;
  targetClassOrCourse?: string;
  villageOrArea?: string;
  question?: string;
  isMr?: boolean;
}): string {
  const {
    schoolName,
    studentName,
    targetClassOrCourse,
    villageOrArea,
    question,
    isMr = false,
  } = opts;

  if (isMr) {
    const lines = [
      `नमस्कार ${schoolName} 🙏`,
      `मला *प्रवेश / फी / माहिती* बाबत चौकशी करायची आहे.`,
    ];
    if (studentName?.trim()) lines.push(`• विद्यार्थ्याचे नाव: ${studentName.trim()}`);
    if (targetClassOrCourse?.trim()) lines.push(`• इयत्ता / अभ्यासक्रम: ${targetClassOrCourse.trim()}`);
    if (villageOrArea?.trim()) lines.push(`• गाव / परिसर: ${villageOrArea.trim()}`);
    if (question?.trim()) lines.push(`• प्रश्न: ${question.trim()}`);
    lines.push('', 'कृपया तपशील व प्रवेशाची माहिती शेअर करा. धन्यवाद!');
    return lines.join('\n');
  }

  const lines = [
    `Hello ${schoolName} 🙏`,
    `I would like to enquire about *Admissions / Fees / Details*.`,
  ];
  if (studentName?.trim()) lines.push(`• Student Name: ${studentName.trim()}`);
  if (targetClassOrCourse?.trim()) lines.push(`• Class / Course: ${targetClassOrCourse.trim()}`);
  if (villageOrArea?.trim()) lines.push(`• Village / Area: ${villageOrArea.trim()}`);
  if (question?.trim()) lines.push(`• Query: ${question.trim()}`);
  lines.push('', 'Please share admission dates, fee structure & required documents. Thank you!');
  return lines.join('\n');
}

/**
 * Generates a WhatsApp shareable broadcast card for principals / coaching owners.
 */
export function formatSchoolWhatsAppBroadcast(opts: {
  schoolName: string;
  schoolNameMr?: string | null;
  typeLabel?: string;
  area?: string | null;
  board?: string;
  admissionStatus?: AdmissionStatus;
  admissionDeadline?: string | null;
  streams?: string[];
  scholarships?: string[];
  availableSeats?: number | null;
  phone?: string | null;
  publicUrl?: string;
  isMr?: boolean;
}): string {
  const {
    schoolName,
    schoolNameMr,
    typeLabel,
    area,
    board,
    admissionStatus,
    admissionDeadline,
    streams,
    scholarships,
    availableSeats,
    phone,
    publicUrl,
    isMr = false,
  } = opts;

  const statusCfg = admissionStatus ? ADMISSION_STATUS_CONFIG[admissionStatus] : null;
  const title = isMr && schoolNameMr ? schoolNameMr : schoolName;

  if (isMr) {
    const lines = [`🎓 *${title}*`];
    if (typeLabel) lines.push(`📚 प्रकार: ${typeLabel}`);
    if (area) lines.push(`📍 ठिकाण: ${area}`);
    if (board) lines.push(`🏛️ मंडळ / विद्यापीठ: ${board}`);
    if (statusCfg) lines.push(`✅ प्रवेश स्थिती: *${statusCfg.labelMr}*`);
    if (admissionDeadline) lines.push(`📅 अंतिम दिनांक: ${admissionDeadline}`);
    if (typeof availableSeats === 'number' && availableSeats > 0) {
      lines.push(`🪑 उपलब्ध जागा: ${availableSeats}`);
    }
    if (streams && streams.length > 0) lines.push(`📖 शाखा: ${streams.join(', ')}`);
    if (scholarships && scholarships.length > 0) {
      lines.push(`🏅 शिष्यवृत्ती: ${scholarships.slice(0, 3).join(', ')}`);
    }
    if (phone) lines.push(`📞 संपर्क: ${phone}`);
    if (publicUrl) lines.push('', `🔗 अधिक माहिती व सूचना पहा:\n${publicUrl}`);
    return lines.join('\n');
  }

  const lines = [`🎓 *${title}*`];
  if (typeLabel) lines.push(`📚 Category: ${typeLabel}`);
  if (area) lines.push(`📍 Location: ${area}`);
  if (board) lines.push(`🏛️ Board / Univ: ${board}`);
  if (statusCfg) lines.push(`✅ Admissions: *${statusCfg.labelEn}*`);
  if (admissionDeadline) lines.push(`📅 Deadline: ${admissionDeadline}`);
  if (typeof availableSeats === 'number' && availableSeats > 0) {
    lines.push(`🪑 Available Seats: ${availableSeats}`);
  }
  if (streams && streams.length > 0) lines.push(`📖 Streams / Courses: ${streams.join(', ')}`);
  if (scholarships && scholarships.length > 0) {
    lines.push(`🏅 Scholarships: ${scholarships.slice(0, 3).join(', ')}`);
  }
  if (phone) lines.push(`📞 Contact: ${phone}`);
  if (publicUrl) lines.push('', `🔗 View campus profile & notices:\n${publicUrl}`);
  return lines.join('\n');
}

export interface SeedSchool {
  name: string;
  name_mr: string;
  school_type: SchoolType;
  medium: SchoolMedium;
  mediums?: SchoolMedium[];
  area: string;
  address?: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  board?: string;
  management_type?: ManagementType;
  gender_type?: GenderType;
  admission_status?: AdmissionStatus;
  fee_tier?: FeeTier;
  classes_offered?: string;
  established_year?: number;
  accreditation?: string;
  office_timing?: string;
  streams?: string[];
  facilities?: string[];
  scholarships?: string[];
  required_documents?: string[];
  transport_villages?: string[];
  coaching_focus?: string[];
  description?: string;
}

export const MUKTAINAGAR_EDUCATION_SEEDS: SeedSchool[] = [
  {
    name: 'Z.P. Primary Central School, Muktainagar',
    name_mr: 'जि.प. प्राथमिक केंद्र शाळा, मुक्ताईनगर',
    school_type: 'primary',
    medium: 'marathi',
    mediums: ['marathi', 'semi-english'],
    area: 'Station Road',
    address: 'Near Old Bus Stand, Muktainagar',
    phone: '02583-234120',
    board: 'State Board (SSC/HSC)',
    management_type: 'government',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'free',
    classes_offered: '1st to 7th Std',
    established_year: 1952,
    office_timing: '10:30 AM - 05:00 PM',
    facilities: ['Library & Reading Room (ग्रंथालय)', 'Sports Ground (खेळाचे मैदान)', 'Digital Classrooms (डिजिटल वर्ग)', 'Mid-Day Meal / Poshan (मध्यान्ह भोजन)'],
    scholarships: ['RTE 25% Free Admission', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Birth Certificate (जन्म दाखला)', 'Aadhaar Card (आधार कार्ड)', 'Passport Size Photos (3 copies)'],
    transport_villages: ['Muktainagar', 'Kurha', 'Anturli'],
    description: '[Board: State Board (SSC/HSC)] · [Facilities: Library & Reading Room, Sports Ground, Digital Classrooms]\n\nHistoric primary school founded in 1952, catering to 1st to 7th grade students in Muktainagar town.',
  },
  {
    name: 'Muktainagar High School & Junior College',
    name_mr: 'मुक्ताईनगर हायस्कूल व कनिष्ठ महाविद्यालय',
    school_type: 'higher-secondary',
    medium: 'semi-english',
    mediums: ['marathi', 'semi-english'],
    area: 'College Road',
    address: 'Muktainagar, Dist. Jalgaon - 425306',
    phone: '02583-234250',
    board: 'State Board (SSC/HSC)',
    management_type: 'aided',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'low',
    classes_offered: '5th to 12th (SSC & HSC)',
    office_timing: '08:00 AM - 02:30 PM',
    streams: ['Science', 'Commerce', 'Arts'],
    facilities: ['Science & Computer Labs (प्रयोगशाळा)', 'Library & Reading Room (ग्रंथालय)', 'Sports Ground (खेळाचे मैदान)', 'Digital Classrooms (डिजिटल वर्ग)'],
    scholarships: ['EBC / Rajarshi Shahu Fee Waiver', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Previous School Leaving Certificate (LC / TC)', 'Last Marksheet / Result (गुणपत्रिका)', 'Aadhaar Card (आधार कार्ड)'],
    transport_villages: ['Muktainagar', 'Kothali', 'Ruikheda', 'Changdev'],
    description: '[Board: State Board (SSC/HSC)] · [Streams: Science, Commerce, Arts] · [Facilities: Science & Computer Labs, Library, Sports Ground, Digital Classrooms]\n\nRenowned educational institute providing SSC secondary education and HSC Junior College with full Science and Commerce streams.',
  },
  {
    name: 'Smt. Godavaribai Ganpatrao Khadse Senior College',
    name_mr: 'श्रीमती जी. जी. खडसे कला, वाणिज्य व विज्ञान महाविद्यालय',
    school_type: 'college',
    medium: 'marathi',
    mediums: ['marathi', 'english'],
    area: 'Taluka Campus',
    address: 'National Highway 6, Muktainagar, Jalgaon',
    phone: '02583-234408',
    website: 'https://khadsecollege.in',
    board: 'KBCNMU (Jalgaon)',
    management_type: 'aided',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'low',
    accreditation: 'NAAC Grade A',
    classes_offered: 'UG & PG Degree (BA / BCom / BSc / BBA / BCA / MSc)',
    office_timing: '09:30 AM - 05:00 PM',
    streams: ['Arts', 'Commerce', 'Science', 'Computer Science', 'BBA', 'BCA'],
    facilities: ['Boys / Girls Hostel (वसतिगृह)', 'Library & Reading Room (ग्रंथालय)', 'Science & Computer Labs (प्रयोगशाळा)', 'Auditorium / Hall (सभागृह)', 'Canteen / Mess (कॅन्टीन)'],
    scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver', 'SC / ST / OBC / VJNT Freeship', 'Panjabrao Deshmukh Hostel Allowance'],
    required_documents: ['Previous School Leaving Certificate (LC / TC)', 'Last Marksheet / Result (गुणपत्रिका)', 'Income Certificate (उत्पन्नाचा दाखला)', 'Aadhaar Card (आधार कार्ड)'],
    transport_villages: ['Muktainagar', 'Kurha', 'Bhusawal', 'Bodwad', 'Edlabad'],
    description: '[Board: KBCNMU (Jalgaon)] · [Streams: Arts, Commerce, Science, Computer Science, BBA, BCA] · [Facilities: Boys/Girls Hostel, Library, Computer Lab, Auditorium, Canteen]\n\nGrade A NAAC accredited multi-faculty senior degree college affiliated with Kavayitri Bahinabai Chaudhari North Maharashtra University.',
  },
  {
    name: 'Government ITI Muktainagar',
    name_mr: 'शासकीय औद्योगिक प्रशिक्षण संस्था (ITI), मुक्ताईनगर',
    school_type: 'engineering-polytechnic',
    medium: 'marathi',
    mediums: ['marathi'],
    area: 'Bhusawal Road',
    address: 'Near MIDC, Muktainagar',
    phone: '02583-234789',
    board: 'DTE / AICTE',
    management_type: 'government',
    gender_type: 'coed',
    admission_status: 'ongoing',
    fee_tier: 'free',
    accreditation: 'NCVT / DTE Approved',
    classes_offered: '1-Year & 2-Year ITI Trades',
    office_timing: '09:30 AM - 05:15 PM',
    streams: ['Electrician', 'Fitter', 'Welder', 'COPA', 'Wireman'],
    facilities: ['Science & Computer Labs (प्रयोगशाळा)', 'Sports Ground (खेळाचे मैदान)'],
    scholarships: ['MahaDBT Post-Matric', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Last Marksheet / Result (गुणपत्रिका)', 'Previous School Leaving Certificate (LC / TC)', 'Caste & Non-Creamy Layer Certificate', 'Aadhaar Card (आधार कार्ड)'],
    transport_villages: ['Muktainagar', 'Kurha', 'Anturli', 'Pimpri', 'Varangaon'],
    description: '[Board: DTE / AICTE] · [Streams: Electrician, Fitter, Welder, COPA, Wireman] · [Facilities: Science & Computer Labs, Workshop, Sports Ground]\n\nGovernment vocational training institute offering technical trades and skill development certification under NCVT / DTE.',
  },
  {
    name: 'Saint Muktabai English Medium School',
    name_mr: 'संत मुक्ताबाई इंग्लिश मीडियम स्कूल',
    school_type: 'secondary',
    medium: 'english',
    mediums: ['english'],
    area: 'Pachora Road',
    address: 'Muktainagar, Dist. Jalgaon',
    phone: '9822334455',
    board: 'State Board (SSC/HSC)',
    management_type: 'private',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'moderate',
    classes_offered: 'Nursery to 10th (SSC)',
    office_timing: '09:00 AM - 04:00 PM',
    facilities: ['School Bus / Transport (वाहतूक)', 'Science & Computer Labs (प्रयोगशाळा)', 'Library & Reading Room (ग्रंथालय)', 'Digital Classrooms (डिजिटल वर्ग)'],
    scholarships: ['RTE 25% Free Admission'],
    required_documents: ['Birth Certificate (जन्म दाखला)', 'Aadhaar Card (आधार कार्ड)', 'Passport Size Photos (3 copies)'],
    transport_villages: ['Muktainagar', 'Kothali', 'Ruikheda', 'Hartala'],
    description: '[Board: State Board (SSC/HSC)] · [Facilities: School Bus, Computer Lab, Library, Digital Classrooms]\n\nEnglish medium high school with dedicated transport and activity-based learning.',
  },
  {
    name: 'KBCNMU University Sub-Center & Competitive Exam Study Room',
    name_mr: 'कवयित्री बहिणाबाई चौधरी उ.म.वि. उपकेंद्र व अभ्यासिका',
    school_type: 'university',
    medium: 'marathi',
    mediums: ['marathi', 'english'],
    area: 'Near Tehsil Office',
    address: 'Administrative Complex, Muktainagar',
    phone: '02583-234900',
    board: 'KBCNMU (Jalgaon)',
    management_type: 'government',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'low',
    classes_offered: 'Distance UG/PG & Competitive Reading Room',
    office_timing: '07:00 AM - 10:00 PM',
    streams: ['Distance Education', 'MPSC/UPSC Guidance'],
    facilities: ['Library & Reading Room (ग्रंथालय)', 'Digital Classrooms (डिजिटल वर्ग)', 'Free Wi-Fi / AC Study Room (अभ्यासिका)'],
    coaching_focus: ['MPSC / UPSC', 'Police Bharti / Army / Talathi', 'Spoken English / Competitive Reading Room'],
    description: '[Board: KBCNMU (Jalgaon)] · [Streams: Distance Education, MPSC/UPSC Guidance] · [Facilities: Library & Reading Room, Digital Classrooms, 24/7 Abhyasika]\n\nOfficial university guidance center offering distance degree admissions, certificate courses, and student study library.',
  },
];

export const MAVAL_EDUCATION_SEEDS: SeedSchool[] = [
  {
    name: 'Z.P. Primary School, Parandwadi',
    name_mr: 'जि.प. प्राथमिक शाळा, परंदवडी',
    school_type: 'primary',
    medium: 'marathi',
    mediums: ['marathi', 'semi-english'],
    area: 'Parandwadi Gaothan',
    address: 'Near Gram Panchayat, Parandwadi, Tal. Maval',
    phone: '9850123456',
    board: 'State Board (SSC/HSC)',
    management_type: 'government',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'free',
    classes_offered: '1st to 7th Std',
    established_year: 1958,
    office_timing: '10:00 AM - 04:30 PM',
    facilities: ['Digital Classrooms (डिजिटल वर्ग)', 'Sports Ground (खेळाचे मैदान)', 'Mid-Day Meal / Poshan (मध्यान्ह भोजन)'],
    scholarships: ['RTE 25% Free Admission', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Birth Certificate (जन्म दाखला)', 'Aadhaar Card (आधार कार्ड)', 'Passport Size Photos (3 copies)'],
    transport_villages: ['Parandwadi', 'Somatane', 'Shirgaon'],
    description: '[Board: State Board (SSC/HSC)] · [Facilities: Digital Classrooms, Sports Ground, Mid-Day Meal]\n\nCentrally located Zilla Parishad primary school serving children across Parandwadi village and surrounding wadis.',
  },
  {
    name: 'B.K. Birla Centre for Education',
    name_mr: 'बी.के. बिर्ला सेंटर फॉर एज्युकेशन',
    school_type: 'secondary',
    medium: 'english',
    mediums: ['english'],
    area: 'Shirgaon / Somatane',
    address: 'Near Somatane Toll Naka, Pune-Mumbai Highway, Maval',
    phone: '02114-287000',
    website: 'https://bkbirlacentre.com',
    board: 'CBSE',
    management_type: 'trust',
    gender_type: 'boys',
    admission_status: 'open',
    fee_tier: 'premium',
    classes_offered: '4th to 12th (CBSE Day & Residential)',
    established_year: 1998,
    office_timing: '09:00 AM - 04:00 PM',
    streams: ['Science', 'Commerce'],
    facilities: ['Boys / Girls Hostel (वसतिगृह)', 'School Bus / Transport (वाहतूक)', 'Sports Ground (खेळाचे मैदान)', 'Science & Computer Labs (प्रयोगशाळा)'],
    scholarships: ['Merit / Trust Scholarship'],
    required_documents: ['Birth Certificate (जन्म दाखला)', 'Previous School Leaving Certificate (LC / TC)', 'Last Marksheet / Result (गुणपत्रिका)'],
    transport_villages: ['Parandwadi', 'Somatane', 'Talegaon Dabhade', 'Dehu Road', 'Wakad'],
    description: '[Board: CBSE] · [Streams: Science, Commerce] · [Facilities: Boys/Girls Hostel, School Bus, Swimming Pool, Sports Complex, Labs]\n\nPremier world-class CBSE residential and day boarding school located 4 km from Parandwadi on the expressway corridor.',
  },
  {
    name: 'D.Y. Patil College of Engineering & Innovation',
    name_mr: 'डी.वाय. पाटील कॉलेज ऑफ इंजिनिअरिंग अँड इनोव्हेशन',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    mediums: ['english'],
    area: 'Varale / Ambi Campus',
    address: 'SR No. 27/A/1/2C, Varale, Talegaon Dabhade, Maval',
    phone: '02114-673351',
    website: 'https://dypcoei.edu.in',
    board: 'SPPU (Pune University)',
    management_type: 'private',
    gender_type: 'coed',
    admission_status: 'ongoing',
    fee_tier: 'premium',
    accreditation: 'AICTE Approved & NAAC Accredited',
    classes_offered: 'B.E. / B.Tech (4 Years Degree)',
    office_timing: '09:00 AM - 05:00 PM',
    streams: ['Computer Engineering', 'AI & Data Science', 'Mechanical', 'Civil'],
    facilities: ['Boys / Girls Hostel (वसतिगृह)', 'School Bus / Transport (वाहतूक)', 'Science & Computer Labs (प्रयोगशाळा)', 'Library & Reading Room (ग्रंथालय)', 'Canteen / Mess (कॅन्टीन)', 'Auditorium / Hall (सभागृह)'],
    scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver', 'SC / ST / OBC / VJNT Freeship', 'Panjabrao Deshmukh Hostel Allowance'],
    required_documents: ['MHT-CET / JEE / NEET Allotment Letter', 'Last Marksheet / Result (गुणपत्रिका)', 'Previous School Leaving Certificate (LC / TC)', 'Domicile / Nationality Certificate'],
    transport_villages: ['Parandwadi', 'Talegaon Dabhade', 'Ambi', 'Nigdi', 'Chinchwad', 'Vadgaon Maval'],
    description: '[Board: SPPU (Pune University)] · [Streams: Computer Engineering, AI & Data Science, Mechanical, Civil] · [Facilities: Hostel, School Bus, Computer Lab, Library, Canteen, Auditorium]\n\nAICTE approved degree engineering college affiliated with Savitribai Phule Pune University located within 6 km of Parandwadi.',
  },
  {
    name: 'D.Y. Patil Polytechnic, Ambi',
    name_mr: 'डी.वाय. पाटील तंत्रनिकेतन (पॉलिटेक्निक), आंबी',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    mediums: ['english'],
    area: 'Ambi / Talegaon',
    address: 'Ambi, Talegaon Dabhade, Pune - 410507',
    phone: '02114-673355',
    website: 'https://dypatil.edu',
    board: 'MSBTE (Polytechnic)',
    management_type: 'private',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'moderate',
    accreditation: 'MSBTE / DTE Approved',
    classes_offered: '3-Year Diploma (After 10th/12th)',
    office_timing: '09:00 AM - 04:30 PM',
    streams: ['Diploma in Mechanical', 'Computer', 'Civil', 'Electrical'],
    facilities: ['Science & Computer Labs (प्रयोगशाळा)', 'Boys / Girls Hostel (वसतिगृह)', 'School Bus / Transport (वाहतूक)'],
    scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver'],
    required_documents: ['Last Marksheet / Result (गुणपत्रिका)', 'Previous School Leaving Certificate (LC / TC)', 'Caste & Non-Creamy Layer Certificate', 'Aadhaar Card (आधार कार्ड)'],
    transport_villages: ['Parandwadi', 'Ambi', 'Talegaon Dabhade', 'Kanhe', 'Kamshet'],
    description: '[Board: MSBTE (Polytechnic)] · [Streams: Diploma in Mechanical, Computer, Civil, Electrical] · [Facilities: Science & Computer Labs, Hostel, Transport, Workshop]\n\nDiploma engineering institute providing technical education to students across Maval, Talegaon, and PCMC.',
  },
  {
    name: 'Indrayani Arts, Commerce & Science College',
    name_mr: 'इंद्रायणी कला, वाणिज्य व विज्ञान महाविद्यालय',
    school_type: 'college',
    medium: 'marathi',
    mediums: ['marathi', 'english'],
    area: 'Talegaon Dabhade',
    address: 'Indrayani Nagar, Talegaon Dabhade, Maval',
    phone: '02114-222225',
    website: 'https://indrayanicollege.com',
    board: 'SPPU (Pune University)',
    management_type: 'aided',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'low',
    established_year: 1968,
    accreditation: 'NAAC Accredited',
    classes_offered: 'Jr. College & Senior Degree (BA/BCom/BSc/BBA/BCA)',
    office_timing: '09:00 AM - 04:00 PM',
    streams: ['B.A.', 'B.Com.', 'B.Sc.', 'BBA', 'BCA', 'M.Com.'],
    facilities: ['Library & Reading Room (ग्रंथालय)', 'Science & Computer Labs (प्रयोगशाळा)', 'Sports Ground (खेळाचे मैदान)', 'Auditorium / Hall (सभागृह)'],
    scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Previous School Leaving Certificate (LC / TC)', 'Last Marksheet / Result (गुणपत्रिका)', 'Income Certificate (उत्पन्नाचा दाखला)'],
    transport_villages: ['Talegaon Dabhade', 'Parandwadi', 'Vadgaon Maval', 'Somatane'],
    description: '[Board: SPPU (Pune University)] · [Streams: B.A., B.Com., B.Sc., BBA, BCA, M.Com.] · [Facilities: Library, Computer Lab, Sports Ground, Auditorium]\n\nRenowned senior college serving the rural and urban youth of Maval taluka for over 50 years under SPPU.',
  },
  {
    name: 'Indira College of Pharmacy & Engineering',
    name_mr: 'इंदिरा इन्स्टिट्यूट ऑफ फार्मसी व इंजिनिअरिंग',
    school_type: 'engineering-polytechnic',
    medium: 'english',
    mediums: ['english'],
    area: 'Somatane Phata',
    address: 'New Mumbai-Pune Highway, Somatane Phata, Tal. Maval',
    phone: '02114-661500',
    website: 'https://indiraedu.com',
    board: 'SPPU (Pune University)',
    management_type: 'private',
    gender_type: 'coed',
    admission_status: 'open',
    fee_tier: 'premium',
    accreditation: 'PCI / AICTE Approved',
    classes_offered: 'B.Pharm, D.Pharm, B.E., MBA',
    office_timing: '09:00 AM - 05:00 PM',
    streams: ['B.Pharm', 'D.Pharm', 'Computer Engineering', 'MBA'],
    facilities: ['Science & Computer Labs (प्रयोगशाळा)', 'School Bus / Transport (वाहतूक)', 'Boys / Girls Hostel (वसतिगृह)', 'Library & Reading Room (ग्रंथालय)'],
    scholarships: ['MahaDBT Post-Matric', 'EBC / Rajarshi Shahu Fee Waiver'],
    required_documents: ['MHT-CET / JEE / NEET Allotment Letter', 'Last Marksheet / Result (गुणपत्रिका)', 'Previous School Leaving Certificate (LC / TC)'],
    transport_villages: ['Parandwadi', 'Somatane', 'Wakad', 'Hinjewadi', 'Dehu Road', 'Talegaon Dabhade'],
    description: '[Board: SPPU (Pune University)] · [Streams: B.Pharm, D.Pharm, Computer Engineering, MBA] · [Facilities: Science & Computer Labs, School Bus, Hostel, Library]\n\nPrestigious pharmaceutical and engineering campus located at Somatane Phata, right next to Parandwadi.',
  },
  {
    name: 'Government ITI Talegaon Dabhade',
    name_mr: 'शासकीय औद्योगिक प्रशिक्षण संस्था (ITI), तळेगाव दाभाडे',
    school_type: 'engineering-polytechnic',
    medium: 'marathi',
    mediums: ['marathi'],
    area: 'Station Road',
    address: 'Near Railway Station, Talegaon Dabhade, Maval',
    phone: '02114-223450',
    board: 'DTE / AICTE',
    management_type: 'government',
    gender_type: 'coed',
    admission_status: 'ongoing',
    fee_tier: 'free',
    accreditation: 'NCVT / DTE Government',
    classes_offered: 'ITI Technical & Industrial Trades',
    office_timing: '09:30 AM - 05:00 PM',
    streams: ['CNC Machinist', 'Fitter', 'Electrician', 'Automobile', 'Welder'],
    facilities: ['Science & Computer Labs (प्रयोगशाळा)', 'Library & Reading Room (ग्रंथालय)'],
    scholarships: ['MahaDBT Post-Matric', 'SC / ST / OBC / VJNT Freeship'],
    required_documents: ['Last Marksheet / Result (गुणपत्रिका)', 'Previous School Leaving Certificate (LC / TC)', 'Aadhaar Card (आधार कार्ड)'],
    transport_villages: ['Talegaon Dabhade', 'Parandwadi', 'Vadgaon Maval', 'Lonavala', 'Dehu Road'],
    description: '[Board: DTE / AICTE] · [Streams: CNC Machinist, Fitter, Electrician, Automobile, Welder] · [Facilities: Workshop, Computer Lab, Library]\n\nDirect feeder technical institute for the Talegaon MIDC automotive and engineering manufacturing hub.',
  },
  {
    name: 'MIMER Medical College & Bhausaheb Sardesai Hospital',
    name_mr: 'मायमर मेडिकल कॉलेज व भाऊसाहेब सरदेसाई रुग्णालय',
    school_type: 'college',
    medium: 'english',
    mediums: ['english'],
    area: 'Somatane Road',
    address: 'Talegaon Dabhade, Tal. Maval, Pune - 410507',
    phone: '02114-308300',
    website: 'https://mitmimer.com',
    board: 'MUHS / Medical',
    management_type: 'trust',
    gender_type: 'coed',
    admission_status: 'ongoing',
    fee_tier: 'premium',
    accreditation: 'NMC / MUHS Affiliated (700-Bed Teaching Hospital)',
    classes_offered: 'MBBS, MD/MS, BPT, Nursing',
    established_year: 1995,
    office_timing: '09:00 AM - 05:00 PM',
    streams: ['MBBS', 'MD/MS', 'Physiotherapy', 'Nursing'],
    facilities: ['Boys / Girls Hostel (वसतिगृह)', 'Library & Reading Room (ग्रंथालय)', 'School Bus / Transport (वाहतूक)', 'Science & Computer Labs (प्रयोगशाळा)'],
    scholarships: ['MahaDBT Post-Matric', 'Minority Scholarship'],
    required_documents: ['MHT-CET / JEE / NEET Allotment Letter', 'Last Marksheet / Result (गुणपत्रिका)', 'Domicile / Nationality Certificate'],
    transport_villages: ['Talegaon Dabhade', 'Parandwadi', 'Somatane', 'PCMC'],
    description: '[Board: Other] · [Streams: MBBS, MD/MS, Physiotherapy, Nursing] · [Facilities: 700-bed Hospital, Hostel, Library, Transport, Research Labs]\n\nTeaching medical college and tertiary care hospital serving the entire Maval region.',
  },
];
