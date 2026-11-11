/**
 * SchoolsTab — Forge Phase 4. First section built entirely on the
 * Entity Framework (EntityTab + EntityDef). No bespoke framework code —
 * everything the UI needs comes from `<EntityTab/>` and `SchoolEntity`.
 */
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Loader2, AlertTriangle, MapPin, Upload, Sparkles, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntityTab } from './_shared/EntityTab';
import { SchoolEntity } from '@/lib/entities/schoolEntity';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import {
  filterSchools,
  toDbSchoolType,
  resolveSchoolType,
  MUKTAINAGAR_EDUCATION_SEEDS,
  MAVAL_EDUCATION_SEEDS,
  type SchoolType,
} from '@/lib/schools/schoolHelpers';
import { removeShopImageQuiet } from '@/lib/storageNaming';
import { extractStoragePath } from '@/components/admin/adminHelpers';
import { SchoolModal } from './SchoolModal';
import { SchoolBulkImportModal } from './SchoolBulkImportModal';
import { useCity } from '@/hooks/useCity';

export function SchoolsTab() {
  const { currentCity, allCities, townName } = useCity();
  const qc = useQueryClient();
  const [selectedCityId, setSelectedCityId] = useState<string>(currentCity.id);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SchoolType | 'schools' | 'colleges' | 'higher-ed'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [editing, setEditing] = useState<Partial<SchoolRow> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const activeCityObj = allCities.find((c) => c.id === selectedCityId) || currentCity;
  const activeTownName = activeCityObj?.name || townName;

  const { data: schoolsData = [], isLoading: schoolsLoading } = useQuery({
    queryKey: ['admin-schools', selectedCityId],
    queryFn: () => schoolsRepo.list({ cityId: selectedCityId, citySlug: activeCityObj.slug }),
  });

  const seedData = useMemo(() => {
    const slug = (activeCityObj?.slug || '').toLowerCase();
    if (slug === 'muktainagar') return MUKTAINAGAR_EDUCATION_SEEDS;
    if (slug === 'parandwadi' || slug === 'maval' || slug === 'talegaon') return MAVAL_EDUCATION_SEEDS;
    return null;
  }, [activeCityObj?.slug]);

  const handleSeedOfficialInstitutes = async () => {
    if (!seedData || seedData.length === 0) return;
    setSeeding(true);
    try {
      const payload = seedData.map((item) => {
        const dbType = toDbSchoolType(item.school_type);
        let finalDesc = item.description || '';
        if (item.school_type !== dbType && !finalDesc.includes('[Type:')) {
          finalDesc = `[Type: ${item.school_type}]${finalDesc ? ' · ' + finalDesc : ''}`;
        }

        return {
          city_id: selectedCityId,
          district_id: activeCityObj?.district_id || null,
          state_id: activeCityObj?.state_id || null,
          name: item.name,
          name_mr: item.name_mr,
          school_type: dbType,
          medium: item.medium,
          area: item.area,
          address: item.address || null,
          phone: item.phone || null,
          website: item.website || null,
          description: finalDesc || null,
          is_active: true,
        };
      });

      const { error } = await (supabase as any).from('schools').insert(payload);
      if (error) throw error;

      toast.success(`Successfully seeded ${seedData.length} official institutes for ${activeTownName}!`);
      invalidate();
    } catch (err: any) {
      console.error('[SchoolsTab] Seed error:', err);
      toast.error(err?.message || 'Failed to seed institutes');
    } finally {
      setSeeding(false);
    }
  };

  const filteredRows = useMemo(() => {
    return filterSchools(schoolsData, searchQuery, typeFilter, statusFilter);
  }, [schoolsData, searchQuery, typeFilter, statusFilter]);

  const counts = useMemo(() => {
    return {
      total: schoolsData.length,
      schools: schoolsData.filter((s) => {
        const t = resolveSchoolType(s);
        return t === 'primary' || t === 'secondary';
      }).length,
      jrColleges: schoolsData.filter((s) => resolveSchoolType(s) === 'higher-secondary').length,
      colleges: schoolsData.filter((s) => resolveSchoolType(s) === 'college').length,
      techIti: schoolsData.filter((s) => resolveSchoolType(s) === 'engineering-polytechnic').length,
      univ: schoolsData.filter((s) => resolveSchoolType(s) === 'university').length,
      coaching: schoolsData.filter((s) => resolveSchoolType(s) === 'coaching').length,
      active: schoolsData.filter((s) => s.is_active).length,
      disabled: schoolsData.filter((s) => !s.is_active).length,
    };
  }, [schoolsData]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: SchoolEntity.listQueryKey });
    qc.invalidateQueries({ queryKey: ['admin-schools'] });
    qc.invalidateQueries({ queryKey: ['schools'] });
  };

  const toggleActive = useMutation({
    mutationFn: async (s: SchoolRow) => {
      const r = await schoolsRepo.updateWithConcurrency(s.id, s.updated_at, {
        is_active: !s.is_active,
      });
      if (!r.ok) throw new Error('error' in r ? r.error : 'conflict');
    },
    onSuccess: (_d, s) => {
      toast.success(s.is_active ? 'School hidden from public' : 'School is now public');
      invalidate();
    },
    onError: (e: any) => toast.error(`Failed to update: ${e.message ?? 'unknown error'}`),
  });

  const columns = SchoolEntity.columns.map((c) =>
    c.key === 'status'
      ? {
          ...c,
          render: (row: SchoolRow) => (
            <button
              type="button"
              onClick={() => toggleActive.mutate(row)}
              aria-label={row.is_active ? 'Disable school' : 'Enable school'}
              className="inline-flex"
            >
              {c.render(row)}
            </button>
          ),
        }
      : c,
  );

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const oldPath = deleteTarget.image_url ? extractStoragePath(deleteTarget.image_url) : null;
    const r = await schoolsRepo.delete(deleteTarget.id);
    if (r.ok === false) {
      toast.error(`Failed to delete: ${r.error}`);
      setDeleting(false);
      return;
    }
    if (oldPath) await removeShopImageQuiet(oldPath);
    toast.success('School deleted');
    invalidate();
    setDeleteTarget(null);
    setDeleting(false);
  };

  return (
    <>
      <EntityTab
        entity={SchoolEntity}
        columns={columns}
        title={
          <div className="flex items-center gap-2">
            <span>Education & Institutes</span>
            <span className="text-muted-foreground font-medium text-sm">
              ({schoolsData.length})
            </span>
          </div>
        }
        subtitle={`Schools, Colleges & Universities in ${activeTownName} · edits go live instantly`}
        toolbarExtras={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-card px-2.5 py-1.5 rounded-lg border border-input shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Town:</span>
              <select
                value={selectedCityId}
                onChange={(e) => setSelectedCityId(e.target.value)}
                className="bg-transparent text-xs font-semibold text-foreground focus:outline-none cursor-pointer"
                aria-label="Select Town / City"
              >
                {allCities.map((c) => (
                  <option key={c.id} value={c.id} className="bg-popover text-popover-foreground">
                    {c.name} {c.name_mr ? `(${c.name_mr})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setBulkImportOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-2xs transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-primary" />
              <span>Bulk Import</span>
            </button>
            {seedData && (
              <button
                type="button"
                onClick={handleSeedOfficialInstitutes}
                disabled={seeding}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-xs font-semibold text-primary transition-colors disabled:opacity-50"
              >
                {seeding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Seeding...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Seed Official Data</span>
                  </>
                )}
              </button>
            )}
          </div>
        }
        banner={
          schoolsData.length === 0 && seedData && !schoolsLoading ? (
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">
                    No education institutes listed in {activeTownName} yet
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    Quickly populate {seedData.length} verified government schools, junior colleges, degree colleges & ITIs.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSeedOfficialInstitutes}
                disabled={seeding}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition shadow-2xs"
              >
                {seeding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>Seed {seedData.length} Official Institutes</span>
              </button>
            </div>
          ) : null
        }
        search={{
          value: searchQuery,
          onChange: setSearchQuery,
          placeholder: 'Search by name, Marathi name, area, medium…',
        }}
        filters={
          <div className="space-y-2 bg-card/60 p-2.5 rounded-xl border border-border/70">
            {/* Category Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'all'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('schools')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'schools'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                Schools ({counts.schools})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('higher-secondary')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'higher-secondary'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                Jr. College (11-12th) ({counts.jrColleges})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('college')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'college'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                Degree College ({counts.colleges})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('engineering-polytechnic')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'engineering-polytechnic'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                Engg / ITI ({counts.techIti})
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('university')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'university'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                University ({counts.univ})
              </button>
            </div>

            {/* Status Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/50">
              <span className="text-[11px] text-muted-foreground font-medium mr-1">Status:</span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                  statusFilter === 'all'
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                All ({counts.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                Active ({counts.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('disabled')}
                className={`px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                  statusFilter === 'disabled'
                    ? 'bg-destructive text-destructive-foreground border-destructive'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                Disabled ({counts.disabled})
              </button>
            </div>
          </div>
        }
        dataOverride={{
          rows: filteredRows,
          isLoading: schoolsLoading,
          isEmpty: filteredRows.length === 0,
        }}
        emptyMessage={
          searchQuery || typeFilter !== 'all' || statusFilter !== 'all'
            ? 'No institutes match your current search or filter criteria.'
            : undefined
        }
        onAdd={() => setEditing({ city_id: selectedCityId })}
        addLabel="Add Institute"
        rowActions={(row) => (
          <>
            <button
              onClick={() => setEditing(row)}
              className="p-1.5 text-primary hover:bg-primary/10 rounded-lg transition-colors"
              aria-label={`Edit ${row.name}`}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteTarget(row)}
              className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              aria-label={`Delete ${row.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      />

      {editing && (
        <SchoolModal
          school={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            invalidate();
          }}
        />
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              Delete "{deleteTarget?.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the school and its photo. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting…</> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SchoolBulkImportModal
        open={bulkImportOpen}
        cityId={selectedCityId}
        cityName={activeTownName}
        districtId={activeCityObj?.district_id}
        stateId={activeCityObj?.state_id}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => invalidate()}
      />
    </>
  );
}
