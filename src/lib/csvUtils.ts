/**
 * Shared CSV utilities for the admin panel.
 *
 * Non-technical summary:
 *   - parseCsv: RFC 4180 multi-line CSV parser returning row objects keyed by column name.
 *   - serializeCsvValue / escapeCell / csvFromObjects: safe serialization (no "[object Object]")
 *     and spreadsheet formula-injection protection without mangling coordinates.
 *   - downloadCsv / downloadCsvText: triggers browser download of UTF-8 CSV with BOM
 *     (so Excel opens Devanagari/Marathi text cleanly).
 *   - fetchAllPaged: paginates Supabase range queries past the default 1,000-row cap.
 */

/**
 * Parse a single CSV line, respecting quoted fields and escaped quotes ("").
 * Returns each field along with whether it was quoted, so callers can decide
 * whether to trim (unquoted fields get trimmed; quoted fields preserve their
 * intentional padding).
 */
export function parseCsvLineRaw(line: string): { value: string; quoted: boolean }[] {
  const clean = line.startsWith('\uFEFF') ? line.slice(1) : line;
  const result: { value: string; quoted: boolean }[] = [];
  let current = '';
  let inQuote = false;
  let fieldWasQuoted = false;
  let afterClosingQuote = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuote) {
      if (ch === '"' && clean[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
        afterClosingQuote = true;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && !fieldWasQuoted && current.trim() === '') {
        // Discard unquoted whitespace before the opening quote
        current = '';
        inQuote = true;
        fieldWasQuoted = true;
        afterClosingQuote = false;
      } else if (ch === ',') {
        result.push({ value: current, quoted: fieldWasQuoted });
        current = '';
        fieldWasQuoted = false;
        afterClosingQuote = false;
      } else if (afterClosingQuote && (ch === ' ' || ch === '\t')) {
        // Ignore unquoted trailing whitespace after closing quote
      } else {
        if (afterClosingQuote) afterClosingQuote = false;
        current += ch;
      }
    }
  }
  result.push({ value: current, quoted: fieldWasQuoted });
  return result;
}

/** Back-compat: returns trimmed string values (quoted fields preserve padding). */
export function parseCsvLine(line: string): string[] {
  return parseCsvLineRaw(line).map((f) => (f.quoted ? f.value : f.value.trim()));
}

/**
 * Parse full CSV text into row objects using a proper RFC 4180 character state
 * machine so newlines inside quoted cells (descriptions, summaries, addresses)
 * stay inside one record instead of splitting into broken rows.
 *
 * Strips leading UTF-8 BOM (\uFEFF) and lowercases/trims header names.
 * Returns [] when the CSV has fewer than 2 non-blank records.
 */
export function parseCsv(text: string): Record<string, string>[] {
  if (!text) return [];
  let normalized = text.startsWith('\uFEFF') ? text.slice(1) : text;
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  type CellToken = { value: string; quoted: boolean };
  const rows: CellToken[][] = [];
  let currentRow: CellToken[] = [];
  let current = '';
  let inQuote = false;
  let fieldWasQuoted = false;
  let afterClosingQuote = false;

  const pushRowIfNotBlank = () => {
    currentRow.push({ value: current, quoted: fieldWasQuoted });
    const hasContent = currentRow.some((c) => c.quoted || c.value.trim() !== '');
    if (hasContent) {
      rows.push(currentRow);
    }
    currentRow = [];
    current = '';
    fieldWasQuoted = false;
    afterClosingQuote = false;
  };

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (inQuote) {
      if (ch === '"' && normalized[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
        afterClosingQuote = true;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && !fieldWasQuoted && current.trim() === '') {
        // Discard unquoted whitespace before the opening quote
        current = '';
        inQuote = true;
        fieldWasQuoted = true;
        afterClosingQuote = false;
      } else if (ch === ',') {
        currentRow.push({ value: current, quoted: fieldWasQuoted });
        current = '';
        fieldWasQuoted = false;
        afterClosingQuote = false;
      } else if (ch === '\n') {
        pushRowIfNotBlank();
      } else if (afterClosingQuote && (ch === ' ' || ch === '\t')) {
        // Ignore unquoted trailing whitespace after closing quote
      } else {
        if (afterClosingQuote) afterClosingQuote = false;
        current += ch;
      }
    }
  }

  // Flush final line/cell if anything remains
  if (currentRow.length > 0 || fieldWasQuoted || current.trim() !== '') {
    pushRowIfNotBlank();
  }

  if (rows.length < 2) return [];

  const headers = rows[0].map((f) =>
    (f.quoted ? f.value : f.value.trim()).replace(/^\uFEFF/, '').toLowerCase().trim()
  );

  return rows.slice(1).map((vals) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      const f = vals[i];
      // Only trim unquoted fields — quoted fields keep their intentional padding.
      obj[h] = f ? (f.quoted ? f.value : f.value.trim()) : '';
    });
    return obj;
  });
}

/**
 * Convert any primitive, array, or JSONB object into a lossless CSV string value
 * without producing "[object Object]".
 */
export function serializeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) {
    return v
      .map((item) =>
        item === null || item === undefined
          ? ''
          : typeof item === 'object'
            ? JSON.stringify(item)
            : String(item)
      )
      .join('|');
  }
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

/**
 * Escape one CSV cell value: serialize safely, wrap in quotes, and double internal quotes.
 * Also neutralises spreadsheet formula-injection when non-numeric strings start
 * with `= + - @ \t \r`, while preserving genuine negative numbers (coordinates)
 * and E.164 phone numbers like `+919822001100`.
 */
export function escapeCell(v: unknown): string {
  let s = serializeCsvValue(v);
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    const isPlainSignedNumber = /^-?\d+(\.\d+)?$/.test(s);
    const isPlainPhone = /^\+\d{6,15}$/.test(s);
    if (!isPlainSignedNumber && !isPlainPhone) {
      s = `'${s}`;
    }
  }
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a CSV string (optionally with UTF-8 BOM) from header + matrix rows. */
export function buildCsvString(
  headers: string[],
  rows: unknown[][],
  withBom = true
): string {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
  return withBom ? '\uFEFF' + csv : csv;
}

/**
 * Convert an array of typed DB/view objects into a UTF-8 BOM CSV string,
 * collecting the union of column keys (preserving `preferredHeaders` order first).
 */
export function csvFromObjects(
  rows: Record<string, unknown>[],
  preferredHeaders?: string[]
): string {
  const headerSet = new Set<string>(preferredHeaders ?? []);
  for (const r of rows) {
    Object.keys(r).forEach((k) => headerSet.add(k));
  }
  const headers = Array.from(headerSet);
  if (headers.length === 0) return '\uFEFF';
  const matrix = rows.map((r) => headers.map((h) => r[h] ?? ''));
  return buildCsvString(headers, matrix, true);
}

/** Build consistent town-scoped CSV base filenames (e.g., `muktainagar-shops`). */
export function townCsvFilename(citySlug: string | null | undefined, entity: string): string {
  const prefix = (citySlug || 'apnatown')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'apnatown';
  return `${prefix}-${entity}`;
}

/**
 * Trigger a browser download of raw CSV content, guaranteeing a UTF-8 BOM
 * so Excel renders Marathi/Devanagari characters cleanly.
 */
export function downloadCsvText(filename: string, csvContent: string, addDateSuffix = true) {
  const payload = csvContent.startsWith('\uFEFF') ? csvContent : `\uFEFF${csvContent}`;
  const blob = new Blob([payload], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if (addDateSuffix) {
    const dateSuffix = new Date().toISOString().slice(0, 10);
    a.download = filename.includes('.csv')
      ? filename.replace('.csv', `-${dateSuffix}.csv`)
      : `${filename}-${dateSuffix}.csv`;
  } else {
    a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  }
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Trigger a browser download of a CSV file.
 *
 * - filename: file basename (date suffix added automatically)
 * - headers: column header row
 * - rows: array of row arrays (same length as headers)
 *
 * Encoded as UTF-8 with BOM so Excel renders Marathi/Devanagari correctly.
 */
export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
  const csv = buildCsvString(headers, rows, true);
  downloadCsvText(filename, csv, true);
}

/**
 * Paginate any Supabase PostgREST query using `.range(from, to)` so exports
 * and duplicate-check lookups never truncate silently at Supabase's 1,000-row cap.
 */
export async function fetchAllPaged<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown } | T[]>,
  pageSize = 1000,
  maxPages = Number.POSITIVE_INFINITY
): Promise<T[]> {
  const safeSize = Math.max(1, pageSize);
  const all: T[] = [];
  let from = 0;
  let page = 0;
  while (page < maxPages) {
    const to = from + safeSize - 1;
    const res = await fetchPage(from, to);
    const batch = Array.isArray(res) ? res : (res.error ? (() => { throw res.error; })() : (res.data ?? []));
    all.push(...batch);
    page += 1;
    if (batch.length < safeSize) break;
    from += safeSize;
  }
  return all;
}
