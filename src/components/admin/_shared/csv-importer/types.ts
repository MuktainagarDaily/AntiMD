/**
 * CsvImporter framework types — Forge recommendation #4.
 * See `./CsvImporter.tsx` for the shell that consumes these.
 */
import type { ReactNode } from 'react';

export type CsvRowStatus = 'ready' | 'warning' | 'error' | 'duplicate';

export type ImporterStep = 'upload' | 'preview' | 'result';

export interface CsvImporterRow<TRow> {
  row: TRow;
  status: CsvRowStatus;
  messages: string[];
  /** Optional dedupe key — the framework marks the row `duplicate` if this
   *  key appears in `loadExistingKeys()` output or twice in the same file. */
  dedupeKey?: string;
}

export interface ImportResult {
  imported: number;
  skippedDupes: number;
  skippedErrors: number;
  failed: number;
}

export interface CsvImporterConfig<TRow> {
  /** Modal heading, e.g. "Import Categories from CSV". */
  title: string;
  /** Downloadable template filename. */
  templateFilename: string;
  /** Full CSV template text (header row + at least one example row). */
  templateContent: string;
  /** Column labels shown in preview `<thead>` (also referenced in the "How to use" hint). */
  columns: string[];
  /** Load the set of existing dedupe keys from the database (lowercased/trimmed as appropriate). */
  loadExistingKeys: () => Promise<string[]>;
  /** Parse one raw CSV record into a typed row + status + messages. */
  parseRow: (
    raw: Record<string, string>,
    ctx: { seen: Set<string>; existing: Set<string> },
  ) => CsvImporterRow<TRow>;
  /** Render the `<td>` cells for one row (excluding # and Status columns — the shell adds those). */
  renderCells: (row: TRow, meta: CsvImporterRow<TRow>) => ReactNode;
  /** Persist the ready+warning rows. Return per-row imported/failed counts. */
  importBatch: (rows: TRow[]) => Promise<{ imported: number; failed: number }>;
  /** Singular + plural entity name used in the import button label. */
  labels: { entity: string; entityPlural: string };
}
