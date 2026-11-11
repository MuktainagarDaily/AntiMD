/**
 * Shared CSV utilities for the admin panel.
 *
 * Replaces three duplicate copies of parseCsv/parseCsvLine and four inline
 * CSV download blocks (Shops, Categories, Analytics, Requests).
 *
 * Non-technical summary:
 *   - parseCsv: turns CSV text into a list of row objects keyed by column name.
 *   - downloadCsv: triggers a browser download of a UTF-8 CSV with BOM
 *     (so Excel opens it cleanly with non-ASCII characters like Marathi text).
 */

/**
 * Parse a single CSV line, respecting quoted fields and escaped quotes ("").
 * Returns each field along with whether it was quoted, so callers can decide
 * whether to trim (unquoted fields get trimmed; quoted fields preserve their
 * intentional padding).
 */
export function parseCsvLineRaw(line: string): { value: string; quoted: boolean }[] {
  const result: { value: string; quoted: boolean }[] = [];
  let current = '';
  let inQuote = false;
  let fieldWasQuoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
        fieldWasQuoted = true;
      } else if (ch === ',') {
        result.push({ value: current, quoted: fieldWasQuoted });
        current = '';
        fieldWasQuoted = false;
      } else {
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
 * Parse full CSV text into row objects.
 * Headers are lowercased + trimmed so column lookup is case-insensitive.
 * Returns [] when the CSV has no data rows.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLineRaw(line);
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      const f = vals[i];
      // Only trim unquoted fields — quoted fields keep their intentional padding.
      obj[h] = f ? (f.quoted ? f.value : f.value.trim()) : '';
    });
    return obj;
  });
}

/** Escape one CSV cell value: wrap in quotes and double-up internal quotes.
 *  Also neutralises spreadsheet formula-injection by prefixing a single
 *  quote when the cell starts with `= + - @ \t \r`, so Excel/Sheets treat
 *  it as literal text instead of a formula. */
function escapeCell(v: unknown): string {
  let s = String(v ?? '');
  if (s.length > 0 && /^[=+\-@\t\r]/.test(s)) {
    s = `'${s}`;
  }
  return `"${s.replace(/"/g, '""')}"`;
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
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCell).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateSuffix = new Date().toISOString().slice(0, 10);
  a.download = filename.includes('.csv')
    ? filename.replace('.csv', `-${dateSuffix}.csv`)
    : `${filename}-${dateSuffix}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
