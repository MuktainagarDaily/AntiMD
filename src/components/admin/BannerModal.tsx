import { useEffect, useMemo, useState } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, BannerPlacement, PLACEMENT_LABELS, isValidTargetUrl } from '@/lib/banners/types';
import { createBanner, updateBanner, uploadBannerImage } from '@/lib/banners/store';
import { ImageCropPicker, type CropAspectOption } from '@/components/shared/ImageCropPicker';
import { BannerPreview } from '@/components/banners/BannerPreview';
import { inputCls } from '@/components/admin/adminHelpers';
import { useToast } from '@/hooks/use-toast';
import { useOptionalCity } from '@/hooks/useCity';

interface Props {
  banner: Banner | null;          // null = new, else edit
  onClose: () => void;
  onSaved: () => void;
}

const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10, 15, 20, 30, 45];
const CLOSE_OPTIONS = [0, 3, 5, 10, 15, 20];

const POPUP_CROP_PRESETS: CropAspectOption[] = [
  { key: 'popup', label: 'Popup Portrait (3:4)', value: 3 / 4 },
  { key: 'square', label: 'Square (1:1)', value: 1 },
];

const INLINE_CROP_PRESETS: CropAspectOption[] = [
  { key: 'inline-wide', label: 'Wide Inline (3:1)', value: 3 },
  { key: 'inline-mobile', label: 'Mobile Card (16:9)', value: 16 / 9 },
];

function resolveInitialTargetSelection(banner: Banner | null, currentCityId: string | null): string {
  if (!banner) {
    return currentCityId ? `city:${currentCityId}` : '';
  }
  const cId = banner.target_city_id || (banner as any).city_id;
  if (cId) return `city:${cId}`;
  if ((banner.target_level === 'district' || banner.target_district_id) && banner.target_district_id) {
    return `district:${banner.target_district_id}`;
  }
  return '';
}

export function BannerModal({ banner, onClose, onSaved }: Props) {
  const isEdit = !!banner;
  const qc = useQueryClient();
  const { toast } = useToast();
  const optionalCity = useOptionalCity();
  const allCities = optionalCity?.allCities ?? [];
  const currentCity = optionalCity?.currentCity ?? null;

  const districtOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const c of allCities) {
      if (!c.district_id) continue;
      if (!map.has(c.district_id)) {
        map.set(c.district_id, {
          id: c.district_id,
          name: c.district?.name || 'District',
        });
      }
    }
    return Array.from(map.values());
  }, [allCities]);

  const [title, setTitle] = useState(banner?.title ?? '');
  const [imageUrl, setImageUrl] = useState(banner?.image_url ?? '');
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [targetUrl, setTargetUrl] = useState(banner?.target_url ?? '');
  const [placement, setPlacement] = useState<BannerPlacement>(banner?.placement ?? 'homepage_inline');
  const [isActive, setIsActive] = useState(banner?.is_active ?? true);
  const [targetSelection, setTargetSelection] = useState<string>(() =>
    resolveInitialTargetSelection(banner, currentCity?.id ?? null),
  );
  const [popupDelay, setPopupDelay] = useState(banner?.popup_delay_seconds ?? 2);
  const [closeEnable, setCloseEnable] = useState(banner?.close_enable_seconds ?? 5);
  const [startDate, setStartDate] = useState(banner?.start_date ?? '');
  const [endDate, setEndDate] = useState(banner?.end_date ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const handleCropComplete = (blob: Blob, dataUrl: string) => {
    setPendingBlob(blob);
    setImageUrl(dataUrl); // local preview until save
  };

  const hasWhitespaceInUrl = /\s/.test(targetUrl.trim());

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Title is required'); return; }
    if (!imageUrl) { setError('Banner image is required'); return; }
    if (!isValidTargetUrl(targetUrl)) {
      setError(
        hasWhitespaceInUrl
          ? 'Destination URL cannot contain spaces'
          : 'Destination URL must start with http:// or https://',
      );
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after start date');
      return;
    }

    let target_level: 'global' | 'district' | 'city' = 'global';
    let target_district_id: string | null = null;
    let target_city_id: string | null = null;

    if (targetSelection.startsWith('city:')) {
      const cid = targetSelection.slice(5);
      const matchedCity = allCities.find((c) => c.id === cid);
      target_level = 'city';
      target_city_id = cid;
      target_district_id = matchedCity?.district_id ?? null;
    } else if (targetSelection.startsWith('district:')) {
      target_level = 'district';
      target_district_id = targetSelection.slice(9);
      target_city_id = null;
    }

    setSaving(true);
    try {
      let finalUrl = imageUrl;
      if (pendingBlob) {
        finalUrl = await uploadBannerImage(pendingBlob);
      }
      const payload = {
        title: title.trim(),
        image_url: finalUrl,
        target_url: targetUrl.trim(),
        placement,
        is_active: isActive,
        popup_delay_seconds: placement === 'popup' ? popupDelay : 0,
        close_enable_seconds: placement === 'popup' ? closeEnable : 0,
        start_date: startDate || null,
        end_date: endDate || null,
        target_level,
        target_district_id,
        target_city_id,
      };
      if (isEdit && banner) {
        await updateBanner(banner.id, payload, banner.image_url);
      } else {
        await createBanner(payload);
      }
      await qc.invalidateQueries({ queryKey: ['banners'] });
      toast({ title: isEdit ? 'Banner updated' : 'Banner created' });
      onSaved();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save banner');
    } finally {
      setSaving(false);
    }
  };

  const isPopup = placement === 'popup';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90dvh] overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 px-4 py-3 border-b border-border bg-card">
          <h2 className="font-bold text-base text-foreground min-w-0 truncate">
            {isEdit ? 'Edit banner' : 'New banner'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-muted shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Title <span className="text-destructive">*</span></label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Festival sale"
              className={inputCls}
              maxLength={120}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Placement</label>
            <select
              value={placement}
              onChange={(e) => setPlacement(e.target.value as BannerPlacement)}
              className={inputCls}
            >
              {(Object.keys(PLACEMENT_LABELS) as BannerPlacement[]).map((p) => (
                <option key={p} value={p}>{PLACEMENT_LABELS[p]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Banner image <span className="text-destructive">*</span></label>
            <ImageCropPicker
              onCropComplete={handleCropComplete}
              onClear={() => { setImageUrl(''); setPendingBlob(null); }}
              previewUrl={imageUrl || undefined}
              maxMB={5}
              defaultAspect={isPopup ? 3 / 4 : 3}
              aspectPresets={isPopup ? POPUP_CROP_PRESETS : INLINE_CROP_PRESETS}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {isPopup
                ? 'Recommended: 3:4 portrait (e.g. 900×1200) for full-screen popup.'
                : 'Recommended: 3:1 wide (e.g. 1200×400) or 16:9 card for inline slots.'}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Destination URL <span className="text-destructive">*</span></label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              placeholder="https://example.com or https://wa.me/91…"
              className={inputCls}
            />
            {hasWhitespaceInUrl ? (
              <div className="flex flex-wrap items-center justify-between gap-2 mt-1 text-[11px] text-destructive">
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> URL contains spaces.
                </span>
                <button
                  type="button"
                  onClick={() => setTargetUrl((v) => v.replace(/\s+/g, ''))}
                  className="font-semibold underline"
                >
                  Remove spaces
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground mt-1">Only valid http(s) links are allowed.</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Target Reach (Town / District / Global)</label>
            <select
              value={targetSelection}
              onChange={(e) => setTargetSelection(e.target.value)}
              className={inputCls}
            >
              <option value="">🌐 All Towns (Global fallback)</option>
              {districtOptions.length > 0 && (
                <optgroup label="District-wide (All towns in district)">
                  {districtOptions.map((d) => (
                    <option key={d.id} value={`district:${d.id}`}>
                      🗺️ {d.name} District
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="Specific Town">
                {allCities.map((city) => (
                  <option key={city.id} value={`city:${city.id}`}>
                    📍 {city.name} {city.name_mr ? `(${city.name_mr})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              City ads take priority over District ads, which take priority over Global ads.
            </p>
          </div>

          {isPopup && (
            <div className="space-y-2 rounded-xl border border-border/80 bg-muted/30 p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Min delay after scroll</label>
                  <select value={popupDelay} onChange={(e) => setPopupDelay(Number(e.target.value))} className={inputCls}>
                    {DELAY_OPTIONS.map((s) => <option key={s} value={s}>{s}s {s < 20 ? '(→ 20s min)' : ''}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Close enables after</label>
                  <select value={closeEnable} onChange={(e) => setCloseEnable(Number(e.target.value))} className={inputCls}>
                    {CLOSE_OPTIONS.map((s) => <option key={s} value={s}>{s}s</option>)}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Public UX policy enforces at least 20s dwell time + user scroll before displaying a popup once per day.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">Start date</label>
              <input type="date" value={startDate ?? ''} onChange={(e) => setStartDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">End date</label>
              <input type="date" value={endDate ?? ''} onChange={(e) => setEndDate(e.target.value)} className={inputCls} />
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-background">
            <span className="text-sm font-semibold text-foreground">Active</span>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`w-11 h-6 rounded-full flex items-center transition-all px-0.5 shrink-0 ${
                isActive ? 'bg-primary justify-end' : 'bg-muted justify-start'
              }`}
              aria-pressed={isActive}
              aria-label="Toggle active"
            >
              <span className="w-5 h-5 rounded-full bg-background shadow-sm" />
            </button>
          </label>

          {/* Live preview */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Live preview</label>
            <BannerPreview
              title={title}
              imageUrl={imageUrl}
              placement={placement}
              closeEnableSeconds={closeEnable}
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Shows how this banner will render on the {PLACEMENT_LABELS[placement].toLowerCase()} surface.
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-card border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] flex flex-wrap gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 min-w-[110px] py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 min-w-[110px] py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create banner'}
          </button>
        </div>
      </div>
    </div>
  );
}
