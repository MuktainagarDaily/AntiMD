import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Banner, BannerPlacement, PLACEMENT_LABELS, isValidTargetUrl } from '@/lib/banners/types';
import { createBanner, updateBanner, uploadBannerImage } from '@/lib/banners/store';
import { ImageCropPicker } from '@/components/shared/ImageCropPicker';
import { BannerPreview } from '@/components/banners/BannerPreview';
import { inputCls } from '@/components/admin/adminHelpers';
import { useToast } from '@/hooks/use-toast';
import { useOptionalCity } from '@/hooks/useCity';

interface Props {
  banner: Banner | null;          // null = new, else edit
  onClose: () => void;
  onSaved: () => void;
}

const DELAY_OPTIONS = [0, 1, 2, 3, 5, 10, 15, 20];
const CLOSE_OPTIONS = [0, 3, 5, 10, 15, 20];

export function BannerModal({ banner, onClose, onSaved }: Props) {
  const isEdit = !!banner;
  const qc = useQueryClient();
  const { toast } = useToast();
  const optionalCity = useOptionalCity();
  const allCities = optionalCity?.allCities ?? [];
  const currentCity = optionalCity?.currentCity ?? null;

  const [title, setTitle] = useState(banner?.title ?? '');
  const [imageUrl, setImageUrl] = useState(banner?.image_url ?? '');
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [targetUrl, setTargetUrl] = useState(banner?.target_url ?? '');
  const [placement, setPlacement] = useState<BannerPlacement>(banner?.placement ?? 'homepage_inline');
  const [isActive, setIsActive] = useState(banner?.is_active ?? true);
  const [targetCityId, setTargetCityId] = useState<string | null>(
    banner?.target_city_id ?? (banner as any)?.city_id ?? currentCity?.id ?? null
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

  const handleSave = async () => {
    setError(null);
    if (!title.trim()) { setError('Title is required'); return; }
    if (!imageUrl) { setError('Banner image is required'); return; }
    if (!isValidTargetUrl(targetUrl)) {
      setError('Destination URL must start with http:// or https://');
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setError('End date must be on or after start date');
      return;
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
        target_level: targetCityId ? 'city' : 'global',
        target_city_id: targetCityId || null,
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

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
          <h2 className="font-bold text-base text-foreground">
            {isEdit ? 'Edit banner' : 'New banner'}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-muted"
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
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Banner image <span className="text-destructive">*</span></label>
            <ImageCropPicker
              onCropComplete={handleCropComplete}
              onClear={() => { setImageUrl(''); setPendingBlob(null); }}
              previewUrl={imageUrl || undefined}
              maxMB={5}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Recommended: 1200×1600 for popup, 1200×400 for inline.
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
            <p className="text-[11px] text-muted-foreground mt-1">Only http(s) links are allowed.</p>
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
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Target Town / City</label>
            <select
              value={targetCityId || ''}
              onChange={(e) => setTargetCityId(e.target.value || null)}
              className={inputCls}
            >
              <option value="">🌐 All Towns (Global)</option>
              {allCities.map((city) => (
                <option key={city.id} value={city.id}>
                  📍 {city.name} ({city.name_mr})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Choose whether this ad appears only in a specific town or across all towns.
            </p>
          </div>

          {placement === 'popup' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Show after (seconds)</label>
                <select value={popupDelay} onChange={(e) => setPopupDelay(Number(e.target.value))} className={inputCls}>
                  {DELAY_OPTIONS.map((s) => <option key={s} value={s}>{s}s</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Close enables after</label>
                <select value={closeEnable} onChange={(e) => setCloseEnable(Number(e.target.value))} className={inputCls}>
                  {CLOSE_OPTIONS.map((s) => <option key={s} value={s}>{s}s</option>)}
                </select>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
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
              className={`w-11 h-6 rounded-full flex items-center transition-all px-0.5 ${
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

        <div className="sticky bottom-0 bg-card border-t border-border p-3 flex gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Create banner'}
          </button>
        </div>
      </div>
    </div>
  );
}
