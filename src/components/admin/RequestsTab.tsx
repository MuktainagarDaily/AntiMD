/**
 * RequestsTab — migrated to `<ModerationQueue/>` (Forge rec #2 + #12).
 * Upgraded to handle multi-image listings and specialized entity types
 * (Shops, Mess & Dining, PG & Hostels, Schools).
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Inbox, X, MapPin, Download, UtensilsCrossed, BedDouble, GraduationCap, Store, ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatTime, normalizePhone } from '@/lib/shopUtils';
import { extractStoragePath } from './adminHelpers';
import { renameShopImage, removeShopImages } from '@/lib/storageNaming';
import { optimizedImage, optimizedSrcSet } from '@/lib/uxUtils';
import { downloadCsv } from '@/lib/csvUtils';
import { isSafeHttpUrl } from '@/lib/utils';
import { ModerationQueue } from './_shared/ModerationQueue';
import { RequestEntity, statusBadge, entityBadge, type RequestRow, type RequestStatus } from '@/lib/entities/requestEntity';

type ShopRequest = RequestRow;

interface RequestsTabProps {
  onShopCreated: () => void;
}

export function RequestsTab({ onShopCreated }: RequestsTabProps) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('pending');
  const [viewRequest, setViewRequest] = useState<ShopRequest | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['admin-requests', statusFilter],
    queryFn: async () => {
      let query = supabase.from('shop_requests').select('*').order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data as ShopRequest[];
    },
  });

  // Independent pending count
  const { data: pendingCount = 0 } = useQuery({
    queryKey: ['admin-requests-pending-count'],
    queryFn: async () => {
      const { count } = await supabase
        .from('shop_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count ?? 0;
    },
  });

  const handleApprove = async (req: ShopRequest) => {
    setActionLoadingId(req.id);

    const normPhone = normalizePhone(req.phone);
    if (normPhone) {
      const [{ data: byPhone }, { data: byWa }] = await Promise.all([
        supabase.from('shops').select('id, name').eq('phone', normPhone).limit(1),
        supabase.from('shops').select('id, name').eq('whatsapp', normPhone).limit(1),
      ]);
      const dupeShop = byPhone?.[0] || byWa?.[0];
      if (dupeShop) {
        toast.error(`Phone ${req.phone} is already registered to "${dupeShop.name}". Resolve before approving.`);
        setActionLoadingId(null);
        return;
      }
    }

    const entityType = req.entity_type || 'shop';
    const normalizeArea = (s: string) =>
      s.trim().replace(/(^|[\s,])([a-z])/g, (_m, pre, ch) => pre + ch.toUpperCase());

    const photoList = req.photos && req.photos.length > 0
      ? req.photos
      : (req.image_url ? [req.image_url] : []);

    // ── Entity Routing 1: SCHOOL ──────────────────────────────────
    if (entityType === 'school') {
      const { data: insertedSchool, error: schoolErr } = await (supabase.from('schools') as any)
        .insert([{
          name: req.name.trim(),
          phone: normPhone,
          address: req.address?.trim() || null,
          area: req.area?.trim() ? normalizeArea(req.area) : null,
          sub_area: (req as any).sub_area?.trim() || null,
          image_url: photoList[0] || null,
          photos: photoList,
          latitude: req.latitude || null,
          longitude: req.longitude || null,
          is_active: true,
          school_type: req.meta?.school_type || 'secondary',
          medium: req.meta?.medium || 'marathi',
          description: req.description || null,
          city_id: (req as any).city_id || null,
          village_id: (req as any).village_id || null,
        }])
        .select('id')
        .single();

      if (schoolErr || !insertedSchool) {
        toast.error('Failed to create school listing: ' + (schoolErr?.message || ''));
        setActionLoadingId(null);
        return;
      }

      await supabase.from('shop_requests').update({ status: 'approved' }).eq('id', req.id);
      toast.success(`School "${req.name}" approved and added to directory!`);
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
      qc.invalidateQueries({ queryKey: ['admin-schools'] });
      qc.invalidateQueries({ queryKey: ['schools'] });
      setViewRequest(null);
      setActionLoadingId(null);
      return;
    }

    // ── Entity Routing 2: SHOP, MESS, PG ──────────────────────────
    let resolvedCategoryId: string | null = null;
    const categoryTargetName =
      entityType === 'mess' ? 'Mess & Dining' :
      entityType === 'pg' ? 'PG & Hostels' :
      req.category_text?.trim();

    if (categoryTargetName) {
      const { data: catMatches } = await supabase
        .from('categories')
        .select('id, name')
        .ilike('name', categoryTargetName);
      if (catMatches && catMatches.length > 0) resolvedCategoryId = catMatches[0].id;
    }

    const hasAnyHours = !!(req.opening_time || req.closing_time);

    const { data: inserted, error: insertError } = await supabase
      .from('shops')
      .insert([{
        name: req.name.trim(),
        phone: normPhone,
        whatsapp: req.whatsapp?.trim() || null,
        address: req.address?.trim() || null,
        area: req.area?.trim() ? normalizeArea(req.area) : null,
        opening_time: req.opening_time || null,
        closing_time: req.closing_time || null,
        image_url: photoList[0] || null,
        photos: photoList,
        latitude: req.latitude || null,
        longitude: req.longitude || null,
        is_active: true,
        ...(hasAnyHours ? {} : { is_open: true }),
        is_verified: false,
        amenities: Array.isArray(req.amenities) && req.amenities.length > 0 ? req.amenities : [],
        city_id: (req as any).city_id || null,
        village_id: (req as any).village_id || null,
        district_id: (req as any).district_id || null,
        state_id: (req as any).state_id || null,
      } as any])
      .select('id')
      .single();

    if (insertError || !inserted) {
      toast.error('Failed to create listing: ' + (insertError?.message || ''));
      setActionLoadingId(null);
      return;
    }

    // Category association
    if (resolvedCategoryId) {
      await supabase.from('shop_categories').insert({ shop_id: inserted.id, category_id: resolvedCategoryId });
    }

    // Specialized Mess Profile Creation
    if (entityType === 'mess') {
      await (supabase.from('mess_profiles') as any).upsert({
        shop_id: inserted.id,
        mess_type: req.meta?.mess_type || 'pure_veg',
        monthly_rate: req.meta?.monthly_rate ?? null,
        single_thali_rate: req.meta?.single_thali_rate ?? null,
        tiffin_delivery: req.meta?.tiffin_delivery ?? false,
        sunday_feast: req.meta?.sunday_feast ?? false,
        lunch_timing: req.meta?.lunch_timing || '11:30 AM - 02:30 PM',
        dinner_timing: req.meta?.dinner_timing || '07:30 PM - 10:30 PM',
      });
      qc.invalidateQueries({ queryKey: ['living-messes'] });
    }

    // Specialized PG Profile Creation
    if (entityType === 'pg') {
      await (supabase.from('pg_profiles') as any).upsert({
        shop_id: inserted.id,
        gender: req.meta?.gender || 'boys',
        occupancy_target: req.meta?.occupancy_target || 'students',
        total_beds: req.meta?.total_beds || 0,
        available_beds: req.meta?.available_beds || 0,
        deposit_amount: req.meta?.deposit_amount || 0,
        gate_closing_time: req.meta?.gate_closing_time || '10:00 PM',
        food_included: req.meta?.food_included ?? false,
        sharing_rates: req.meta?.sharing_rates || {},
        amenities: req.amenities || [],
      });
      qc.invalidateQueries({ queryKey: ['living-pgs'] });
    }

    // Image renaming if single image present
    if (req.image_url && !req.image_url.startsWith('/images/demo/')) {
      try {
        const renamed = await renameShopImage(req.image_url, req.name);
        if (renamed && renamed.publicUrl !== req.image_url) {
          await supabase.from('shops').update({ image_url: renamed.publicUrl }).eq('id', inserted.id);
        }
      } catch {
        // Non-fatal
      }
    }

    await supabase.from('shop_requests').update({ status: 'approved' }).eq('id', req.id);

    const typeLabel = entityType === 'mess' ? 'Mess' : entityType === 'pg' ? 'PG & Hostel' : 'Shop';
    toast.success(`"${req.name}" (${typeLabel}) has been approved and published!`);
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    qc.invalidateQueries({ queryKey: ['shops'] });
    onShopCreated();
    setViewRequest(null);
    setActionLoadingId(null);
  };

  const handleReject = async (req: ShopRequest) => {
    setActionLoadingId(req.id);
    const { error } = await supabase.from('shop_requests').update({ status: 'rejected' }).eq('id', req.id);
    if (error) {
      toast.error('Failed to reject request');
    } else {
      toast.success(`Request from "${req.name}" has been rejected.`);
      qc.invalidateQueries({ queryKey: ['admin-requests'] });
      qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
      qc.invalidateQueries({ queryKey: ['admin-stats'] });
    }
    setViewRequest(null);
    setActionLoadingId(null);
  };

  const handleDelete = async (req: ShopRequest) => {
    setActionLoadingId(req.id);
    const { error } = await supabase.from('shop_requests').delete().eq('id', req.id);
    if (error) {
      toast.error('Failed to delete request');
      setActionLoadingId(null);
      return;
    }
    if (req.image_url) {
      const path = extractStoragePath(req.image_url);
      if (path) {
        const { error: storageErr } = await removeShopImages([path]);
        if (storageErr) toast.warning('Request deleted, but its image could not be removed from storage.');
      }
    }
    toast.success('Request deleted');
    qc.invalidateQueries({ queryKey: ['admin-requests'] });
    qc.invalidateQueries({ queryKey: ['admin-requests-pending-count'] });
    setViewRequest(null);
    setActionLoadingId(null);
  };

  return (
    <div>
      <ModerationQueue<ShopRequest>
        entity={RequestEntity}
        title={<>Listing Requests <span className="text-muted-foreground font-medium text-sm">({requests.length})</span></>}
        subtitle={statusFilter === 'pending' && pendingCount > 0 ? `${pendingCount} pending review` : undefined}
        dataOverride={{ rows: requests, isLoading }}
        isPending={(r) => r.status === 'pending'}
        onView={(r) => setViewRequest(r)}
        onApprove={handleApprove}
        onReject={handleReject}
        onDelete={handleDelete}
        copyFor={(action, req) => {
          if (action === 'approve') return {
            title: `Approve "${req.name}"?`,
            cta: 'Approve & Publish',
            description: (
              <>
                <p>This will publish the listing to the public directory ({req.entity_type || 'shop'}).</p>
                <ul className="text-xs space-y-1 pl-4 list-disc">
                  <li>Phone <strong className="text-foreground">{req.phone}</strong> will be verified.</li>
                  {req.photos && req.photos.length > 0 && (
                    <li><strong className="text-foreground">{req.photos.length} photos</strong> will be saved to gallery.</li>
                  )}
                  {req.category_text && (
                    <li>Category <strong className="text-foreground">"{req.category_text}"</strong> will be linked.</li>
                  )}
                </ul>
              </>
            ),
          };
          if (action === 'reject') return {
            title: `Reject "${req.name}"?`,
            cta: 'Reject Request',
            description: <p>The request will be marked rejected. It will remain visible in the audit history but won't appear publicly.</p>,
          };
          return {
            title: `Delete "${req.name}"?`,
            cta: 'Delete Request',
            description: (
              <p>The request and its uploaded image will be <strong className="text-foreground">permanently removed</strong>. This cannot be undone.</p>
            ),
          };
        }}
        toolbarExtras={
          <button
            onClick={() => {
              const headers = ['Entity', 'Name', 'Phone', 'WhatsApp', 'Area', 'Address', 'Category', 'Status', 'Submitter', 'Photos Count', 'Submitted At'];
              const rows = requests.map((req) => [
                req.entity_type || 'shop',
                req.name, req.phone, req.whatsapp ?? '', req.area ?? '', req.address ?? '',
                req.category_text ?? '', req.status, req.submitter_name ?? '',
                req.photos?.length || (req.image_url ? 1 : 0),
                new Date(req.created_at).toLocaleDateString('en-IN'),
              ]);
              downloadCsv('muktainagar-requests', headers, rows);
            }}
            className="flex items-center gap-2 bg-card border border-border text-foreground px-4 py-2 rounded-lg font-semibold text-sm hover:bg-muted transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        }
        filters={
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1 w-fit">
            {(['pending', 'approved', 'rejected', 'all'] as (RequestStatus | 'all')[]).map((opt) => (
              <button
                key={opt}
                onClick={() => setStatusFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all capitalize ${
                  statusFilter === opt ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        }
        emptyState={
          <div className="bg-card rounded-xl border border-border p-10 text-center">
            <Inbox className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">
              {statusFilter === 'pending' ? 'No pending requests' : `No ${statusFilter} requests`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {statusFilter === 'pending' ? 'Submissions from the public form will appear here.' : ''}
            </p>
          </div>
        }
        skeletonRows={3}
      />

      {/* Detail Modal */}
      {viewRequest && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto overscroll-contain py-4 px-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-2xl my-4 max-h-[calc(100dvh-2rem)] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                {entityBadge(viewRequest.entity_type)}
                <div>
                  <h3 className="font-bold text-lg text-foreground leading-tight">{viewRequest.name}</h3>
                  <div className="mt-1">{statusBadge(viewRequest.status)}</div>
                </div>
              </div>
              <button onClick={() => setViewRequest(null)} className="p-1 hover:bg-muted rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Photos Gallery */}
              {viewRequest.photos && viewRequest.photos.length > 0 ? (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-2">
                    <ImageIcon className="w-3.5 h-3.5 text-primary" />
                    <span>Uploaded Photos ({viewRequest.photos.length})</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {viewRequest.photos.map((p, i) => (
                      <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-border bg-muted">
                        <img src={p} alt={`Photo ${i+1}`} className="w-full h-full object-cover" />
                        {i === 0 && (
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-bold bg-primary text-primary-foreground shadow-xs">
                            COVER
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : viewRequest.image_url ? (
                <img
                  src={optimizedImage(viewRequest.image_url, { width: 600 }) || viewRequest.image_url}
                  srcSet={optimizedSrcSet(viewRequest.image_url, 600)}
                  alt="Listing"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-44 object-cover rounded-xl border border-border"
                />
              ) : null}

              {/* Specialized Metadata Panel */}
              {viewRequest.entity_type === 'mess' && viewRequest.meta && (
                <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-1.5 text-xs">
                  <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1 mb-1">
                    <UtensilsCrossed className="w-3.5 h-3.5" /> Mess Profile Details
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Type: <strong className="text-foreground">{viewRequest.meta.mess_type}</strong></div>
                    <div>Monthly Pass: <strong className="text-foreground">{viewRequest.meta.monthly_rate ? `₹${viewRequest.meta.monthly_rate}` : '—'}</strong></div>
                    <div>Single Thali: <strong className="text-foreground">{viewRequest.meta.single_thali_rate ? `₹${viewRequest.meta.single_thali_rate}` : '—'}</strong></div>
                    <div>Tiffin Delivery: <strong className="text-foreground">{viewRequest.meta.tiffin_delivery ? 'Yes' : 'No'}</strong></div>
                  </div>
                </div>
              )}

              {viewRequest.entity_type === 'pg' && viewRequest.meta && (
                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1.5 text-xs">
                  <div className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1 mb-1">
                    <BedDouble className="w-3.5 h-3.5" /> PG / Hostel Details
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>For: <strong className="text-foreground">{viewRequest.meta.gender}</strong></div>
                    <div>Vacant Beds: <strong className="text-foreground">{viewRequest.meta.available_beds || 0} / {viewRequest.meta.total_beds || 0}</strong></div>
                    <div>Deposit: <strong className="text-foreground">{viewRequest.meta.deposit_amount ? `₹${viewRequest.meta.deposit_amount}` : '—'}</strong></div>
                    <div>Food Included: <strong className="text-foreground">{viewRequest.meta.food_included ? 'Yes' : 'No'}</strong></div>
                  </div>
                </div>
              )}

              {viewRequest.entity_type === 'school' && viewRequest.meta && (
                <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-1.5 text-xs">
                  <div className="font-bold text-purple-700 dark:text-purple-400 flex items-center gap-1 mb-1">
                    <GraduationCap className="w-3.5 h-3.5" /> School Details
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>Level: <strong className="text-foreground">{viewRequest.meta.school_type}</strong></div>
                    <div>Medium: <strong className="text-foreground">{viewRequest.meta.medium}</strong></div>
                    <div>Board: <strong className="text-foreground">{viewRequest.meta.board || 'State Board'}</strong></div>
                  </div>
                </div>
              )}

              {/* Standard Rows */}
              {[
                { label: 'Phone', value: viewRequest.phone },
                { label: 'WhatsApp', value: viewRequest.whatsapp },
                { label: 'Area', value: viewRequest.area },
                { label: 'Address', value: viewRequest.address },
                { label: 'Category', value: viewRequest.category_text },
                { label: 'Opening', value: viewRequest.opening_time ? formatTime(viewRequest.opening_time) : null },
                { label: 'Closing', value: viewRequest.closing_time ? formatTime(viewRequest.closing_time) : null },
                { label: 'Submitted by', value: viewRequest.submitter_name },
                { label: 'Submitted on', value: new Date(viewRequest.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Description', value: viewRequest.description },
              ].map(({ label, value }) =>
                value ? (
                  <div key={label} className="flex items-start gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24 shrink-0 pt-0.5">{label}</span>
                    <span className="text-sm text-foreground break-words">{value}</span>
                  </div>
                ) : null
              )}

              {Array.isArray(viewRequest.amenities) && viewRequest.amenities.length > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24 shrink-0 pt-0.5">Amenities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {viewRequest.amenities.map((a, i) => (
                      <span key={`${a}-${i}`} className="text-xs px-2 py-0.5 rounded-full font-medium border border-border bg-muted text-foreground">
                        {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(viewRequest.latitude && viewRequest.longitude) && (
                <div className="flex items-start gap-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide w-24 shrink-0 pt-0.5">Location</span>
                  <div className="flex flex-col gap-0.5">
                    <a
                      href={`https://www.google.com/maps?q=${viewRequest.latitude},${viewRequest.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                    >
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      Open in Maps ↗
                    </a>
                    <span className="text-xs text-muted-foreground font-mono">
                      {viewRequest.latitude.toFixed(5)}, {viewRequest.longitude.toFixed(5)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {viewRequest.status === 'pending' && (
              <div className="px-6 pb-6 flex gap-3 border-t border-border pt-4">
                <button
                  onClick={() => handleReject(viewRequest)}
                  disabled={!!actionLoadingId}
                  className="flex-1 py-2.5 border border-border rounded-xl font-semibold text-destructive hover:bg-destructive/5 transition-colors text-sm disabled:opacity-50"
                >
                  {actionLoadingId === viewRequest.id ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Reject'}
                </button>
                <button
                  onClick={() => handleApprove(viewRequest)}
                  disabled={!!actionLoadingId}
                  className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: 'hsl(var(--success))', color: 'hsl(var(--success-foreground))' }}
                >
                  {actionLoadingId === viewRequest.id ? <><Loader2 className="w-4 h-4 animate-spin" /> Approving…</> : '✅ Approve & Publish'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
