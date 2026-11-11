/**
 * SchoolModal — Forge Phase 3+4. First real adopter of `<EntityForm/>`
 * (rec #6). The dialog chrome stays bespoke (positioning, sticky header,
 * close button); every field, validation, and the submit row are owned
 * by the framework. Photo upload is a `custom` field so the pending-blob
 * / preview lifecycle stays in the component and image side-effects
 * (upload, path cleanup on failure, old-image delete on success) run
 * inside `formDef.onSubmit`.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { MultiImageCropPicker } from '@/components/shared/MultiImageCropPicker';
import { uploadShopImage, removeShopImageQuiet } from '@/lib/storageNaming';
import { extractStoragePath } from '@/components/admin/adminHelpers';
import { schoolsRepo, type SchoolRow, type SchoolType, type SchoolMedium } from '@/lib/repos/schoolsRepo';
import {
  SCHOOL_TYPE_OPTIONS,
  SCHOOL_MEDIUM_OPTIONS,
  COMMON_BOARDS,
  COMMON_FACILITIES,
  parseSchoolDescription,
  serializeSchoolDescription,
  toDbSchoolType,
  resolveSchoolType,
  normalizeSchoolType,
} from '@/lib/schools/schoolHelpers';
import { EntityForm } from '@/lib/forms/EntityForm';
import { useCity } from '@/hooks/useCity';
import { fetchVillagesForCity } from '@/lib/geo/geoService';
import type { FormDef } from '@/lib/forms/types';

interface Props {
  school: Partial<SchoolRow> & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}

interface SchoolFormValues {
  name: string;
  name_mr: string;
  school_type: SchoolType;
  medium: SchoolMedium | '';
  board: string;
  streams: string;
  facilities: string[];
  principal_name: string;
  office_timing: string;
  area: string;
  sub_area: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  description: string;
  image_url: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
  city_id: string;
  village_id: string;
}

const TYPE_OPTIONS = SCHOOL_TYPE_OPTIONS;
const MEDIUM_OPTIONS = SCHOOL_MEDIUM_OPTIONS;

export function SchoolModal({ school, onClose, onSaved }: Props) {
  const { currentCity, allCities, townName } = useCity();
  const isEdit = !!school.id;
  const [selectedCityId, setSelectedCityId] = useState<string>(school.city_id || currentCity.id);

  const initialPhotos = Array.isArray(school.photos) && school.photos.length > 0
    ? school.photos
    : (school.image_url ? [school.image_url] : []);
  const [photos, setPhotos] = useState<string[]>(initialPhotos);
  const [uploadingImage, setUploadingImage] = useState(false);

  const { data: cityVillages = [] } = useQuery({
    queryKey: ['admin-school-villages', selectedCityId],
    queryFn: () => fetchVillagesForCity(selectedCityId),
    enabled: !!selectedCityId,
  });

  const parsedMeta = parseSchoolDescription(school.description);

  const formDef: FormDef<SchoolFormValues> = useMemo(() => ({
    key: 'school',
    createTitle: '',
    editTitle: '',
    defaults: () => ({
      name: '',
      name_mr: '',
      school_type: 'other',
      medium: '',
      board: '',
      streams: '',
      facilities: [],
      principal_name: '',
      office_timing: '',
      area: '',
      sub_area: '',
      address: '',
      phone: '',
      email: '',
      website: '',
      description: '',
      image_url: '',
      latitude: '',
      longitude: '',
      is_active: true,
      city_id: school.city_id || currentCity.id,
      village_id: school.village_id || '',
    }),
    fields: [
      {
        name: 'image_url',
        label: 'Campus Photos',
        kind: 'custom',
        render: ({ values, setField }) => (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">
              Campus Photos (Slot 1 = Main Cover, Up to 5)
            </label>
            <MultiImageCropPicker
              photos={photos}
              onChange={(next) => {
                setPhotos(next);
                setField('image_url', next[0] || '');
              }}
              maxPhotos={5}
              uploading={uploadingImage}
              onUploadFile={async (blob) => {
                setUploadingImage(true);
                try {
                  const { publicUrl } = await uploadShopImage(
                    blob,
                    values.name || 'school',
                    { prefix: 'school' }
                  );
                  return publicUrl;
                } catch (err: any) {
                  toast.error(`Image upload failed: ${err.message ?? 'error'}`);
                  throw err;
                } finally {
                  setUploadingImage(false);
                }
              }}
            />
          </div>
        ),
      },
      {
        name: 'city_id',
        label: 'City / Taluka',
        kind: 'custom',
        colSpan: 6,
        render: ({ values, setField }) => (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">City / Taluka *</label>
            <select
              value={values.city_id}
              onChange={(e) => {
                const cid = e.target.value;
                setField('city_id', cid);
                setField('village_id', '');
                setSelectedCityId(cid);
              }}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none"
            >
              {allCities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.name_mr ? `(${c.name_mr})` : ''} — {c.type}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        name: 'village_id',
        label: 'Village / Locality',
        kind: 'custom',
        colSpan: 6,
        render: ({ values, setField }) => (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Village / Locality</label>
            <select
              value={values.village_id}
              onChange={(e) => setField('village_id', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none"
            >
              <option value="">Main City / No specific village</option>
              {cityVillages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} {v.name_mr ? `(${v.name_mr})` : ''}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      { name: 'name', label: 'Institute Name (English)', required: true, maxLength: 120, placeholder: 'e.g. Zilla Parishad Primary School', colSpan: 6 },
      { name: 'name_mr', label: 'Institute Name (मराठी)', maxLength: 120, placeholder: 'उदा. जिल्हा परिषद प्राथमिक शाळा', colSpan: 6 },
      { name: 'school_type', label: 'Category / Level', kind: 'select', required: true, options: TYPE_OPTIONS, colSpan: 6 },
      { name: 'medium', label: 'Medium of Instruction', kind: 'select', options: MEDIUM_OPTIONS, colSpan: 6 },
      {
        name: 'board',
        label: 'Board / Affiliation',
        kind: 'custom',
        colSpan: 6,
        render: ({ values, setField }) => (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Board / University Affiliation</label>
            <select
              value={values.board}
              onChange={(e) => setField('board', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none"
            >
              <option value="">Select Board / University (Optional)</option>
              {COMMON_BOARDS.map((b) => (
                <option key={b.value} value={b.value}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>
        ),
      },
      {
        name: 'streams',
        label: 'Streams / Key Courses',
        placeholder: 'e.g. Science, Commerce, Arts, IT/CS, Mechanical, Pharmacy',
        help: 'Comma-separated courses or streams',
        colSpan: 6,
      },
      {
        name: 'facilities',
        label: 'Key Facilities',
        kind: 'custom',
        colSpan: 12,
        render: ({ values, setField }) => (
          <div>
            <label className="block text-sm font-semibold text-foreground mb-1.5">Key Facilities Available</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/30 p-3 rounded-xl border border-border/60">
              {COMMON_FACILITIES.map((facility) => {
                const checked = (values.facilities || []).includes(facility);
                return (
                  <label key={facility} className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        const curr = values.facilities || [];
                        const next = e.target.checked
                          ? [...curr, facility]
                          : curr.filter((f) => f !== facility);
                        setField('facilities', next);
                      }}
                      className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                    />
                    <span>{facility}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ),
      },
      {
        name: 'principal_name',
        label: 'Principal / Contact Person',
        placeholder: 'e.g. Dr. A. B. Patil',
        colSpan: 6,
      },
      {
        name: 'office_timing',
        label: 'Office / Admission Hours',
        placeholder: 'e.g. 09:30 AM - 04:30 PM',
        colSpan: 6,
      },
      { name: 'area', label: 'Area / Landmark', placeholder: `e.g. Near Bus Stand, ${townName}`, colSpan: 6 },
      { name: 'sub_area', label: 'Sub-area', placeholder: 'Optional sub-locality', colSpan: 6 },
      { name: 'address', label: 'Full Street Address', placeholder: 'Complete address for directions' },
      { name: 'phone', label: 'Phone / Helpline', kind: 'tel', placeholder: '10-digit number or STD-phone', colSpan: 6 },
      { name: 'email', label: 'Email', kind: 'email', placeholder: 'institute@example.edu', colSpan: 6 },
      { name: 'website', label: 'Website', kind: 'url', placeholder: 'https://…' },
      {
        name: 'description',
        label: 'About / Overview',
        kind: 'textarea',
        maxLength: 800,
        placeholder: 'Brief background, establishment year, or special achievements…',
      },
      { name: 'latitude', label: 'Latitude', placeholder: 'e.g. 21.0', colSpan: 6 },
      { name: 'longitude', label: 'Longitude', placeholder: 'e.g. 75.9', colSpan: 6 },
      { name: 'is_active', label: 'Active (visible to the public)', kind: 'checkbox' },
    ],
    onSubmit: async (values) => {
      const name = values.name.trim();
      if (!name) { toast.error('Name is required'); throw new Error('validation'); }

      const dbType = toDbSchoolType(values.school_type);
      const finalDescription = serializeSchoolDescription({
        type_override: values.school_type !== dbType ? values.school_type : undefined,
        board: values.board.trim() || undefined,
        streams: values.streams
          ? values.streams.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined,
        facilities: values.facilities && values.facilities.length > 0 ? values.facilities : undefined,
        principal_name: values.principal_name.trim() || undefined,
        office_timing: values.office_timing.trim() || undefined,
        raw_description: values.description.trim(),
      });

      const selectedCityObj = allCities.find((c) => c.id === values.city_id) || currentCity;
      const payload = {
        name,
        name_mr: values.name_mr.trim() || null,
        school_type: dbType,
        medium: (values.medium || null) as SchoolMedium | null,
        area: values.area.trim() || null,
        sub_area: values.sub_area.trim() || null,
        address: values.address.trim() || null,
        phone: values.phone.trim() || null,
        email: values.email.trim() || null,
        website: values.website.trim() || null,
        description: finalDescription || null,
        image_url: photos[0] || values.image_url || null,
        photos: photos.length > 0 ? photos : null,
        latitude: values.latitude.trim() ? Number(values.latitude) : null,
        longitude: values.longitude.trim() ? Number(values.longitude) : null,
        is_active: values.is_active,
        city_id: values.city_id,
        village_id: values.village_id || null,
        district_id: selectedCityObj?.district_id || null,
        state_id: selectedCityObj?.state_id || null,
      };

      const result = isEdit
        ? await schoolsRepo.updateWithConcurrency(school.id!, school.updated_at, payload)
        : await schoolsRepo.insert(payload);

      if (!result.ok) {
        const msg = 'error' in result ? result.error : 'Save conflict — please reload.';
        toast.error(`Failed to save: ${msg}`);
        throw new Error(msg);
      }

      toast.success(isEdit ? 'Institute updated' : 'Institute added');
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isEdit, school.id, school.updated_at, photos, uploadingImage, selectedCityId, cityVillages, allCities]);

  const resolvedType = parsedMeta.type_override || normalizeSchoolType(school.school_type);

  const initial: Partial<SchoolFormValues> = {
    ...(school.id ? { id: school.id as any } : {}),
    name: school.name ?? '',
    name_mr: school.name_mr ?? '',
    school_type: (resolvedType ?? 'other') as SchoolType,
    medium: (school.medium ?? '') as SchoolMedium | '',
    board: parsedMeta.board ?? '',
    streams: parsedMeta.streams?.join(', ') ?? '',
    facilities: parsedMeta.facilities ?? [],
    principal_name: parsedMeta.principal_name ?? '',
    office_timing: parsedMeta.office_timing ?? '',
    area: school.area ?? '',
    sub_area: school.sub_area ?? '',
    address: school.address ?? '',
    phone: school.phone ?? '',
    email: school.email ?? '',
    website: school.website ?? '',
    description: parsedMeta.raw_description ?? '',
    image_url: school.image_url ?? '',
    latitude: school.latitude?.toString() ?? '',
    longitude: school.longitude?.toString() ?? '',
    is_active: school.is_active ?? true,
    city_id: school.city_id || currentCity.id,
    village_id: school.village_id || '',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl border border-border w-full max-w-2xl shadow-2xl my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10 rounded-t-2xl">
          <h2 className="font-bold text-lg text-foreground">
            {isEdit ? 'Edit Institute' : 'Add Institute'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1 hover:bg-muted rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <EntityForm<SchoolFormValues>
            formDef={formDef}
            initialValues={initial}
            onCancel={onClose}
            onSaved={onSaved}
            submitLabel={isEdit ? 'Update Institute' : 'Add Institute'}
          />
        </div>
      </div>
    </div>
  );
}
