export type BusDirection = 'outgoing' | 'incoming';

export type BusType = 'msrtc_ordinary' | 'msrtc_express' | 'pmpml' | 'local_shuttle' | 'other';

export interface BusRouteMeta {
  direction: BusDirection;
  bus_type: BusType;
  via: string[];
  raw_notes: string;
}

export const BUS_TYPE_CONFIG: Record<
  BusType,
  { label: string; label_mr: string; badgeCls: string }
> = {
  msrtc_ordinary: {
    label: 'MSRTC Ordinary',
    label_mr: 'लालपरी / साधी',
    badgeCls: 'bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20',
  },
  msrtc_express: {
    label: 'MSRTC Express',
    label_mr: 'शिवशाही / हिरकणी',
    badgeCls: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20',
  },
  pmpml: {
    label: 'PMPML Local',
    label_mr: 'PMPML लोकल',
    badgeCls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  },
  local_shuttle: {
    label: 'Local Shuttle',
    label_mr: 'स्थानिक / वडाप',
    badgeCls: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  },
  other: {
    label: 'Other',
    label_mr: 'इतर',
    badgeCls: 'bg-muted text-muted-foreground border-border',
  },
};

/**
 * Parses route metadata from notes string (supporting human-readable tags and legacy notes).
 */
export function parseBusNotes(notesStr: string | null | undefined): BusRouteMeta {
  if (!notesStr || !notesStr.trim()) {
    return {
      direction: 'outgoing',
      bus_type: 'msrtc_ordinary',
      via: [],
      raw_notes: '',
    };
  }

  let text = notesStr.trim();
  let direction: BusDirection = 'outgoing';
  let bus_type: BusType = 'msrtc_ordinary';
  let via: string[] = [];

  // 1. Detect direction
  if (/\[Incoming\]/i.test(text) || /\b(incoming|येणारी|return)\b/i.test(text)) {
    direction = 'incoming';
    text = text.replace(/\[Incoming\]\s*(·|-)?\s*/gi, '');
  } else if (/\[Outgoing\]/i.test(text)) {
    direction = 'outgoing';
    text = text.replace(/\[Outgoing\]\s*(·|-)?\s*/gi, '');
  }

  // 2. Detect bus type
  if (/\[PMPML\]/i.test(text) || /\bPMPML\b/i.test(text)) {
    bus_type = 'pmpml';
    text = text.replace(/\[PMPML\]\s*(·|-)?\s*/gi, '');
  } else if (/\[Express\]/i.test(text) || /\b(Express|Superfast|शिवशाही|हिरकणी)\b/i.test(text)) {
    bus_type = 'msrtc_express';
    text = text.replace(/\[Express\]\s*(·|-)?\s*/gi, '');
  } else if (/\[Local Shuttle\]/i.test(text) || /\b(Shuttle|वडाप|काळी-पिवळी)\b/i.test(text)) {
    bus_type = 'local_shuttle';
    text = text.replace(/\[Local Shuttle\]\s*(·|-)?\s*/gi, '');
  }

  // 3. Detect via stops: e.g. "via Somatane Phata, Dehu Road" or "मार्गे ..."
  const viaMatch = text.match(/(?:via|मार्गे)\s+([^·\-\n\r]+)/i);
  if (viaMatch) {
    const rawVia = viaMatch[1].trim();
    via = rawVia
      .split(/[,/]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    text = text.replace(/(?:via|मार्गे)\s+[^·\-\n\r]+\s*(·|-)?\s*/gi, '');
  }

  // Clean leftover delimiters
  text = text.replace(/^[·\-\s]+|[·\-\s]+$/g, '').trim();

  return {
    direction,
    bus_type,
    via,
    raw_notes: text,
  };
}

/**
 * Serializes route metadata back into a human-readable, backwards-compatible notes string.
 */
export function serializeBusNotes(meta: Partial<BusRouteMeta>): string {
  const parts: string[] = [];
  if (meta.direction === 'incoming') {
    parts.push('[Incoming]');
  }
  if (meta.bus_type && meta.bus_type !== 'msrtc_ordinary') {
    const typeLabel =
      meta.bus_type === 'pmpml'
        ? 'PMPML'
        : meta.bus_type === 'msrtc_express'
        ? 'Express'
        : meta.bus_type === 'local_shuttle'
        ? 'Local Shuttle'
        : '';
    if (typeLabel) parts.push(`[${typeLabel}]`);
  }
  if (meta.via && meta.via.length > 0) {
    parts.push(`via ${meta.via.join(', ')}`);
  }
  if (meta.raw_notes && meta.raw_notes.trim()) {
    parts.push(meta.raw_notes.trim());
  }
  return parts.join(' · ');
}

export const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export function parseTimes(raw: string): { ok: string[]; bad: string[] } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      // Accept "9:00" -> "09:00"
      const m = s.match(/^(\d{1,2}):(\d{2})$/);
      if (!m) return s;
      return `${m[1].padStart(2, '0')}:${m[2]}`;
    });
  const ok: string[] = [];
  const bad: string[] = [];
  for (const tk of tokens) (TIME_RE.test(tk) ? ok : bad).push(tk);
  // de-dup + sort
  const dedup = Array.from(new Set(ok)).sort();
  return { ok: dedup, bad };
}

export interface ParsedBulkBusRow {
  destination: string;
  destination_mr?: string;
  departure_times: string[];
  notes?: string;
  is_active: boolean;
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

/**
 * Parses multi-line pasted CSV / TSV text for bulk timetable import.
 * Supports lines like:
 * "Nigdi, निगडी, 07:30 09:30 12:05, PMPML Route 342"
 */
export function parseBulkBusCsv(rawText: string): {
  valid: ParsedBulkBusRow[];
  errors: { line: number; message: string; raw: string }[];
} {
  const cleanRaw = rawText.startsWith('\uFEFF') ? rawText.slice(1) : rawText;
  const lines = cleanRaw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const valid: ParsedBulkBusRow[] = [];
  const errors: { line: number; message: string; raw: string }[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const line = lines[idx];

    const cols = splitDelimitedLine(line);

    // Skip header line if present
    const firstLower = (cols[0] || '').toLowerCase();
    if (idx === 0 && (firstLower === 'destination' || firstLower === 'route' || firstLower === 'ठिकाण')) {
      continue;
    }

    if (!cols[0]) {
      errors.push({ line: lineNum, message: 'Destination is missing', raw: line });
      continue;
    }

    const destination = cols[0];
    let destination_mr = '';
    let timesRaw = '';
    let notes = '';
    let isActive = true;

    // If 4+ columns: Destination, Marathi, Times, Notes[, Active]
    if (cols.length >= 4) {
      destination_mr = cols[1];
      timesRaw = cols[2];
      const lastLower = cols[cols.length - 1].trim().toLowerCase();
      if (cols.length >= 5 && (lastLower === 'true' || lastLower === 'false')) {
        isActive = lastLower === 'true';
        notes = cols.slice(3, -1).join(', ');
      } else {
        // Join comma-split note fragments with ', ' so "via Stop A, Stop B" stays intact
        notes = cols.slice(3).join(', ');
      }
    } else if (cols.length === 3) {
      // Check if cols[1] contains digits (meaning it's times: Destination, Times, Notes)
      if (/\d/.test(cols[1])) {
        timesRaw = cols[1];
        notes = cols[2];
      } else {
        destination_mr = cols[1];
        timesRaw = cols[2];
      }
    } else if (cols.length === 2) {
      timesRaw = cols[1];
    } else {
      errors.push({ line: lineNum, message: 'Row must have at least Destination and Times', raw: line });
      continue;
    }

    const parsedTimes = parseTimes(timesRaw);
    if (parsedTimes.ok.length === 0) {
      errors.push({ line: lineNum, message: `No valid HH:MM times found in "${timesRaw}"`, raw: line });
      continue;
    }

    valid.push({
      destination,
      destination_mr: destination_mr || undefined,
      departure_times: parsedTimes.ok,
      notes: notes || undefined,
      is_active: isActive,
    });
  }

  return { valid, errors };
}

export const PARANDWADI_DEPOT_SEEDS: Omit<ParsedBulkBusRow, 'is_active'>[] = [
  {
    destination: 'Nigdi (Bhakti Shakti / Pawale Chowk)',
    destination_mr: 'निगडी (भक्ती शक्ती / पावले चौक)',
    departure_times: ['07:30', '09:30', '12:05', '16:35', '18:35'],
    notes: '[Outgoing] · [PMPML] · via Somatane Phata, Dehu Road · PMPML Route 342: Urse -> Parandwadi ZP School -> Nigdi',
  },
  {
    destination: 'Urse Gaon (Vasudev Ashram)',
    destination_mr: 'उर्से गाव (वासुदेव आश्रम)',
    departure_times: ['07:15', '09:10', '11:45', '16:20', '18:25'],
    notes: '[Incoming] · [PMPML] · via Parandwadi · PMPML Route 342: Nigdi -> Dehu Road -> Parandwadi -> Urse Gaon',
  },
  {
    destination: 'Dehu Road Bazar & Station',
    destination_mr: 'देहूरोड बाजार व रेल्वे स्टेशन',
    departure_times: ['07:30', '09:30', '12:05', '16:35', '18:35'],
    notes: '[Outgoing] · [PMPML] · via Somatane Phata · Direct via Route 342 from Parandwadi ZP School',
  },
  {
    destination: 'Somatane Phata (Highway Junction)',
    destination_mr: 'सोमाटणे फाटा (हायवे जंक्शन)',
    departure_times: ['06:30', '07:30', '08:30', '09:30', '10:30', '11:30', '12:05', '13:30', '14:30', '15:30', '16:35', '17:30', '18:35', '19:30', '20:30'],
    notes: '[Outgoing] · [Local Shuttle] · Major highway junction 3km from Parandwadi - Feeder to Pune & Talegaon',
  },
  {
    destination: 'Talegaon Dabhade ST Stand',
    destination_mr: 'तळेगाव दाभाडे एसटी बसस्थानक',
    departure_times: ['06:45', '07:45', '08:45', '09:45', '11:15', '12:45', '14:15', '15:45', '17:15', '18:45', '20:00'],
    notes: '[Outgoing] · [MSRTC Ordinary] · via Somatane Phata, Talegaon Station Road',
  },
  {
    destination: 'Hinjawadi IT Park (Phase 1, 2, 3)',
    destination_mr: 'हिंजवडी आयटी पार्क (फेज १, २, ३)',
    departure_times: ['07:15', '08:00', '08:45', '09:30', '17:30', '18:15', '19:00'],
    notes: '[Outgoing] · [PMPML] · via Somatane Phata, Wakad connecting routes',
  },
  {
    destination: 'Pune Station / Shivajinagar',
    destination_mr: 'पुणे स्टेशन / शिवाजीनगर',
    departure_times: ['06:30', '07:30', '08:30', '10:00', '12:00', '14:00', '16:00', '17:30', '19:00'],
    notes: '[Outgoing] · [Express] · via Somatane Phata, Dehu Road connecting MSRTC Express & PMPML',
  },
  {
    destination: 'Lonavala / Khandala',
    destination_mr: 'लोणावळा / खंडाळा',
    departure_times: ['07:00', '08:30', '10:30', '12:30', '14:30', '16:30', '18:30', '20:00'],
    notes: '[Outgoing] · [MSRTC Ordinary] · via Old Mumbai-Pune Highway, Somatane Toll Naka',
  },
];

function normalizeForBusMatch(input: string): string {
  return input
    .toLowerCase()
    .replace(/[()[\].,/\\\-:·|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePhoneticWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/aa/g, 'a')
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/w/g, 'v')
    .replace(/sh/g, 's');
}

/**
 * Checks whether every character in `needle` appears in `haystack` in order,
 * returning the span length between first and last matched chars (or -1 if not found).
 * Enables compact shorthand searches like "ng" -> "Nigdi" or "smtn" -> "Somatane".
 */
export function subsequenceSpan(needle: string, haystack: string): number {
  if (!needle || !haystack || needle.length > haystack.length) return -1;
  let ni = 0;
  let firstIdx = -1;
  for (let hi = 0; hi < haystack.length && ni < needle.length; hi++) {
    if (haystack[hi] === needle[ni]) {
      if (firstIdx === -1) firstIdx = hi;
      ni++;
      if (ni === needle.length) {
        return hi - firstIdx + 1;
      }
    }
  }
  return -1;
}

/**
 * Bounded Damerau-Levenshtein (Optimal String Alignment) edit distance check.
 * Handles adjacent character transpositions (e.g. "nidgi" -> "nigdi") as cost 1.
 */
export function isEditDistanceWithin(a: string, b: string, maxDist: number): boolean {
  if (Math.abs(a.length - b.length) > maxDist) return false;
  if (a === b) return true;
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + 1);
      }
      dp[i][j] = val;
    }
  }
  return dp[m][n] <= maxDist;
}

/**
 * Generic forgiving text match scorer supporting:
 * 1. Exact/substring/prefix match
 * 2. Ordered character subsequence inside words ("ng" -> "Nigdi")
 * 3. Bounded typo/phonetic tolerance ("nidgi" -> "Nigdi", "hinjewadi" -> "Hinjawadi")
 * Returns score > 0 when all tokens match, else 0.
 */
export function scoreForgivingMatch(query: string, fields: Array<string | null | undefined>): number {
  const cleanQuery = normalizeForBusMatch(query);
  if (!cleanQuery) return 1;
  const tokens = cleanQuery.split(' ').filter(Boolean);
  if (tokens.length === 0) return 1;

  const normalizedFields = fields
    .map((f) => (f ? normalizeForBusMatch(f) : ''))
    .filter(Boolean);
  if (normalizedFields.length === 0) return 0;

  const combined = normalizedFields.join(' ');
  const combinedWords = combined.split(' ').filter(Boolean);

  let totalScore = 0;

  for (const tok of tokens) {
    let tokScore = 0;
    const tokPhonetic = normalizePhoneticWord(tok);

    for (let fi = 0; fi < normalizedFields.length; fi++) {
      const f = normalizedFields[fi];
      const fieldBoost = fi === 0 ? 1.4 : fi === 1 ? 1.3 : 1;

      if (f === tok) {
        tokScore = Math.max(tokScore, Math.round(120 * fieldBoost));
      } else if (f.startsWith(tok)) {
        tokScore = Math.max(tokScore, Math.round(100 * fieldBoost));
      } else if (f.includes(tok)) {
        tokScore = Math.max(tokScore, Math.round(80 * fieldBoost));
      }
    }

    if (tokScore === 0) {
      for (const word of combinedWords) {
        if (word.startsWith(tok)) {
          tokScore = Math.max(tokScore, 75);
          continue;
        }
        const wordPhonetic = normalizePhoneticWord(word);
        if (wordPhonetic.includes(tokPhonetic)) {
          tokScore = Math.max(tokScore, 65);
          continue;
        }
        if (tok.length >= 2) {
          const span = subsequenceSpan(tok, word);
          if (span > 0) {
            const startsSame = word[0] === tok[0] ? 15 : 0;
            const compactness = Math.max(10, 45 - (span - tok.length) * 6);
            tokScore = Math.max(tokScore, compactness + startsSame);
          } else {
            const pSpan = subsequenceSpan(tokPhonetic, wordPhonetic);
            if (pSpan > 0) {
              tokScore = Math.max(tokScore, 30);
            }
          }
        }
        if (tokScore === 0 && tok.length >= 3) {
          const maxDist = tok.length >= 6 ? 2 : 1;
          if (
            isEditDistanceWithin(tok, word, maxDist) ||
            isEditDistanceWithin(tokPhonetic, wordPhonetic, maxDist)
          ) {
            tokScore = Math.max(tokScore, 42);
          }
        }
      }
    }

    // Last check across collapsed multi-word string for queries typed without spaces ("dehuroad", "pms")
    if (tokScore === 0 && tok.length >= 3) {
      const collapsed = combined.replace(/\s+/g, '');
      if (collapsed.includes(tok)) {
        tokScore = 50;
      } else {
        const span = subsequenceSpan(tok, collapsed);
        if (span > 0 && span <= tok.length * 2 + 2) {
          tokScore = 22;
        }
      }
    }

    if (tokScore === 0) return 0;
    totalScore += tokScore;
  }

  return totalScore;
}

/**
 * Forgiving bus timetable search across English destination, Marathi destination,
 * parsed via stops, bus type labels, and raw route notes.
 */
export function matchesForgivingBusQuery(
  query: string,
  row: {
    destination?: string | null;
    destination_mr?: string | null;
    notes?: string | null;
  },
): number {
  const clean = query.trim();
  if (!clean) return 1;
  const meta = parseBusNotes(row.notes);
  const typeCfg = BUS_TYPE_CONFIG[meta.bus_type];
  return scoreForgivingMatch(clean, [
    row.destination,
    row.destination_mr,
    meta.via.join(' '),
    `${typeCfg?.label || ''} ${typeCfg?.label_mr || ''}`,
    row.notes,
  ]);
}


