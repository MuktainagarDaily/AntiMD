/**
 * SchoolsTab — Forge Phase 4. First section built entirely on the
 * Entity Framework (EntityTab + EntityDef). No bespoke framework code —
 * everything the UI needs comes from `<EntityTab/>` and `SchoolEntity`.
 */
import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Loader2, AlertTriangle, MapPin, Upload, Download, Sparkles, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EntityTab } from './_shared/EntityTab';
import { SchoolEntity } from '@/lib/entities/schoolEntity';
import { schoolsRepo, type SchoolRow } from '@/lib/repos/schoolsRepo';
import {
  filterSchools,
  getSchoolResolvedMeta,
  toDbSchoolType,
  resolveSchoolType,
  SCHOOL_CSV_EXPORT_HEADERS,
  MUKTAINAGAR_EDUCATION_SEEDS,
  MAVAL_EDUCATION_SEEDS,
  type SchoolType,
} from '@/lib/schools/schoolHelpers';
import { downloadCsv, townCsvFilename } from '@/lib/csvUtils';
import { extractEntityStoragePaths, removeShopImages } from '@/lib/storageNaming';
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
  const [admissionOnly, setAdmissionOnly] = useState(false);
  const [editing, setEditing] = useState<Partial<SchoolRow> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SchoolRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const activeCityObj = allCities.find((c) => c.id === selectedCityId) || currentCity;
  const activeTownName = activeCityObj?.name || townName;
  const activeStateId =
    activeCityObj?.district?.state_id ??
    (activeCityObj as { state_id?: string | null } | undefined)?.state_id ??
    null;

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
          state_id: activeStateId,
          name: item.name,
          name_mr: item.name_mr,
          school_type: dbType,
          medium: item.medium,
          mediums: item.mediums || (item.medium ? [item.medium] : []),
          area: item.area,
          address: item.address || null,
          phone: item.phone || null,
          whatsapp: item.whatsapp || null,
          website: item.website || null,
          board: item.board || null,
          management_type: item.management_type || null,
          gender_type: item.gender_type || 'coed',
          admission_status: item.admission_status || 'unknown',
          fee_tier: item.fee_tier || 'unspecified',
          classes_offered: item.classes_offered || null,
          established_year: item.established_year ?? null,
          accreditation: item.accreditation || null,
          office_timing: item.office_timing || null,
          streams: item.streams || [],
          facilities: item.facilities || [],
          scholarships: item.scholarships || [],
          required_documents: item.required_documents || [],
          transport_villages: item.transport_villages || [],
          coaching_focus: item.coaching_focus || [],
          description: finalDesc || null,
          is_active: true,
        };
      });

      const res = await schoolsRepo.insertMany(payload);
      if (res.ok === false) throw new Error(res.error);

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
    return filterSchools(schoolsData, searchQuery, typeFilter, statusFilter, {
      admissionFilter: admissionOnly ? 'open_only' : 'all',
    });
  }, [schoolsData, searchQuery, typeFilter, statusFilter, admissionOnly]);

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
      admissionsOpen: schoolsData.filter((s) => {
        const adm = getSchoolResolvedMeta(s).admission_status;
        return adm === 'open' || adm === 'ongoing';
      }).length,
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
    const paths = extractEntityStoragePaths(deleteTarget as any);
    const r = await schoolsRepo.delete(deleteTarget.id);
    if (r.ok === false) {
      toast.error(`Failed to delete: ${r.error}`);
      setDeleting(false);
      return;
    }
    if (paths.length > 0) await removeShopImages(paths);
    toast.success('School & attached images deleted');
    invalidate();
    setDeleteTarget(null);
    setDeleting(false);
  };

  const handleExportCsv = () => {
    if (filteredRows.length === 0) {
      toast.info('No institutes to export with current filters');
      return;
    }
    const rows = filteredRows.map((s) => {
      const meta = getSchoolResolvedMeta(s);
      const photosArr = Array.isArray(s.photos) && s.photos.length > 0
        ? s.photos
        : s.image_url
          ? [s.image_url]
          : [];
      const mediumsArr = Array.isArray(s.mediums) && s.mediums.length > 0
        ? s.mediums
        : s.medium
          ? [s.medium]
          : [];
      return [
        s.slug ?? '',
        s.name ?? '',
        s.name_mr ?? '',
        resolveSchoolType(s),
        s.medium ?? '',
        mediumsArr.join('|'),
        meta.board ?? '',
        meta.management_type ?? '',
        meta.gender_type ?? 'coed',
        s.udise_aishe_code ?? '',
        s.established_year ?? '',
        s.accreditation ?? '',
        s.classes_offered ?? '',
        (meta.streams ?? []).join('|'),
        (meta.facilities ?? []).join('|'),
        meta.principal_name ?? '',
        meta.office_timing ?? '',
        meta.admission_status ?? 'unknown',
        s.admission_deadline ?? '',
        s.admission_url ?? '',
        s.prospectus_url ?? '',
        meta.fee_tier ?? 'unspecified',
        s.annual_fee_min ?? '',
        s.annual_fee_max ?? '',
        (meta.scholarships ?? []).join('|'),
        (meta.required_documents ?? []).join('|'),
        (meta.transport_villages ?? []).join('|'),
        (meta.coaching_focus ?? []).join('|'),
        s.total_seats ?? '',
        s.available_seats ?? '',
        s.phone ?? '',
        s.whatsapp ?? '',
        s.email ?? '',
        s.website ?? '',
        s.area ?? '',
        s.sub_area ?? '',
        s.address ?? '',
        s.address_mr ?? '',
        s.latitude ?? '',
        s.longitude ?? '',
        s.image_url ?? '',
        photosArr.join('|'),
        s.is_verified ? 'true' : 'false',
        s.is_active ? 'true' : 'false',
        meta.raw_description || '',
      ];
    });
    downloadCsv(townCsvFilename(activeCityObj?.slug, 'schools'), [...SCHOOL_CSV_EXPORT_HEADERS], rows);
    toast.success(`Exported ${filteredRows.length} institute(s)`);
  };

  return (
    <>
      <EntityTab
        entity={SchoolEntity}
        columns={columns}
        title={
          <div className="flex flex-wrap items-center gap-2">
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
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-input bg-card hover:bg-muted text-xs font-semibold text-foreground shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-primary" />
              <span>Export CSV</span>
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
            <div className="p-3.5 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
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
              <button
                type="button"
                onClick={() => setTypeFilter('coaching')}
                className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                  typeFilter === 'coaching'
                    ? 'bg-primary text-primary-foreground border-primary shadow-2xs'
                    : 'bg-card text-foreground border-border hover:bg-muted'
                }`}
              >
                Coaching / Abhyasika ({counts.coaching})
              </button>
            </div>

            {/* Status & Admissions Filter Chips */}
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
              <button
                type="button"
                onClick={() => setAdmissionOnly((v) => !v)}
                className={`sm:ml-auto px-2.5 py-0.5 rounded-md text-[11px] font-semibold border transition-all ${
                  admissionOnly
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'
                    : 'bg-card text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                🎓 Admissions Open Only ({counts.admissionsOpen})
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
          searchQuery || typeFilter !== 'all' || statusFilter !== 'all' || admissionOnly
            ? 'No institutes match your current search or filter criteria.'
            : undefined
        }
        onAdd={() =>
          setEditing({
            city_id: selectedCityId,
            district_id: activeCityObj?.district_id ?? null,
            state_id: activeStateId,
          })
        }
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
              <span className="min-w-0 break-words">Delete "{deleteTarget?.name}"?</span>
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
        stateId={activeStateId}
        existingSchools={schoolsData}
        onClose={() => setBulkImportOpen(false)}
        onImported={() => invalidate()}
      />
    </>
  );
}
