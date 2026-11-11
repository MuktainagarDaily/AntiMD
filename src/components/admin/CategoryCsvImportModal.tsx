/**
 * CategoryCsvImportModal — pilot migration onto the CsvImporter framework
 * (Forge #4). All UI shell + status accounting now lives in
 * `_shared/csv-importer/`; this file only declares the category-specific
 * template, row parser, cell renderer, and batch insert.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CsvImporter } from './_shared/csv-importer';
import type { CsvImporterConfig, CsvImporterRow } from './_shared/csv-importer';

interface CatRow {
  name: string;
  icon: string;
  is_active: boolean;
}

interface Props { onClose: () => void; onDone: () => void; }

const TEMPLATE = ['Name,Icon,Active', 'Grocery,🛒,Yes'].join('\n');

export function CategoryCsvImportModal({ onClose, onDone }: Props) {
  const { data: existingCats = [] } = useQuery({
    queryKey: ['admin-categories-names'],
    queryFn: async () => {
      const { data } = await supabase.from('categories').select('name');
      return (data || []).map((c: any) => (c.name as string).toLowerCase().trim());
    },
  });

  const config = useMemo<CsvImporterConfig<CatRow>>(() => ({
    title: 'Import Categories from CSV',
    templateFilename: 'muktainagar_categories_template.csv',
    templateContent: TEMPLATE,
    columns: ['Icon', 'Name', 'Active'],
    labels: { entity: 'Category', entityPlural: 'Categories' },
    loadExistingKeys: async () => existingCats,
    parseRow: (raw): CsvImporterRow<CatRow> => {
      const name = (raw['name'] || '').trim();
      const icon = (raw['icon'] || '').trim();
      const activeRaw = (raw['active'] || '').trim().toLowerCase();
      const is_active = activeRaw === '' || activeRaw === 'yes' || activeRaw === 'true';
      const messages: string[] = [];
      let status: CsvImporterRow<CatRow>['status'] = 'ready';
      if (!name) { messages.push('Name is required'); status = 'error'; }
      if (!icon) { messages.push('No icon — will use 🏪'); if (status === 'ready') status = 'warning'; }
      return {
        row: { name, icon: icon || '🏪', is_active },
        status,
        messages,
        dedupeKey: name ? name.toLowerCase().trim() : undefined,
      };
    },
    renderCells: (row) => (
      <>
        <td className="px-3 py-2.5 text-xl align-top">{row.icon}</td>
        <td className="px-3 py-2.5 align-top">
          <div className="font-semibold text-foreground">
            {row.name || <span className="text-destructive italic">missing</span>}
          </div>
        </td>
        <td className="px-3 py-2.5 text-muted-foreground align-top">{row.is_active ? 'Yes' : 'No'}</td>
      </>
    ),
    importBatch: async (rows) => {
      // Batch insert first; fall back to per-row so partial success still works.
      const { data, error } = await supabase.from('categories').insert(rows).select('id');
      if (error || !data) {
        let imported = 0; let failed = 0;
        for (const row of rows) {
          const { error: e } = await supabase.from('categories').insert(row);
          if (e) failed++; else imported++;
        }
        return { imported, failed };
      }
      return { imported: data.length, failed: rows.length - data.length };
    },
  }), [existingCats]);

  return <CsvImporter config={config} onClose={onClose} onDone={onDone} />;
}
