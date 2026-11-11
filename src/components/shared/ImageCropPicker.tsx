/**
 * Modern image crop tool for shop forms.
 * - Powered by react-easy-crop (pinch/drag/wheel zoom, smooth touch)
 * - Aspect-ratio presets (1:1, 4:3, 16:9 = shop card, free)
 * - Rotation, zoom slider, reset
 * - Live ShopCard-style preview (desktop + mobile + banner tabs)
 * - Resolution / safe-area warnings
 * - Keyboard shortcuts: + / - zoom, R rotate, 0 reset, Enter crop
 *
 * Public API is unchanged so existing call sites (ShopModal, SpeedShopModal,
 * MyShop, RequestListingModal, BannerModal) keep working with no edits.
 */
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import {
  Loader2, Crop as CropIcon, RefreshCw, RotateCw, ZoomIn, ZoomOut, Pencil,
  Monitor, Smartphone, Image as ImageIcon, AlertTriangle, Check,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useT } from '@/i18n';
import { MAX_UPLOAD_BYTES } from '@/lib/images/imageService';

export interface CropAspectOption {
  key: string;
  label: string;
  value: number;
}

interface Props {
  onCropComplete: (blob: Blob, previewUrl: string) => void;
  onClear: () => void;
  previewUrl?: string;
  uploading?: boolean;
  maxMB?: number;
  /** Default aspect preset. Defaults to 16/9 (shop card). Pass null to start in Free mode. */
  defaultAspect?: number | null;
  /** Optional custom aspect presets (e.g. for banner placements). */
  aspectPresets?: CropAspectOption[];
}

const DEFAULT_ASPECTS: CropAspectOption[] = [
  { key: 'card', label: 'Shop Card (16:9)', value: 16 / 9 },
];

type PreviewTab = 'desktop' | 'mobile' | 'banner';

/** Crop the source image to a WebP blob at up to MAX_OUT on the longest side. */
async function cropImageToBlob(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  quality = 0.9,
  maxOut = 1600,
): Promise<{ blob: Blob; dataUrl: string; width: number; height: number }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bBoxW = img.width * cos + img.height * sin;
  const bBoxH = img.width * sin + img.height * cos;

  // First render the rotated image into an intermediate canvas, then crop.
  const rot = document.createElement('canvas');
  rot.width = bBoxW;
  rot.height = bBoxH;
  const rctx = rot.getContext('2d')!;
  rctx.translate(bBoxW / 2, bBoxH / 2);
  rctx.rotate(rad);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  const cropped = document.createElement('canvas');
  const outScale = Math.min(1, maxOut / pixelCrop.width, maxOut / pixelCrop.height);
  cropped.width = Math.round(pixelCrop.width * outScale);
  cropped.height = Math.round(pixelCrop.height * outScale);
  const cctx = cropped.getContext('2d')!;
  cctx.imageSmoothingQuality = 'high';
  cctx.drawImage(
    rot,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, cropped.width, cropped.height,
  );

  const blob: Blob = await new Promise((res, rej) => {
    cropped.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/webp', quality);
  });
  const dataUrl = cropped.toDataURL('image/webp', Math.min(0.85, quality));
  return { blob, dataUrl, width: cropped.width, height: cropped.height };
}

export function ImageCropPicker({
  // Default raised from 5 → 15 MB to match the hard app-wide cap enforced by
  // `imageService.MAX_UPLOAD_BYTES`. Callers can still pass a smaller `maxMB`
  // for context-specific limits (e.g. claim proofs). The picker will always
  // additionally clamp to the service-level cap so users see the same 15 MB
  // limit surfaced inline instead of receiving an async toast from the
  // uploader.
  onCropComplete, onClear, previewUrl, uploading, maxMB, defaultAspect = 16 / 9, aspectPresets,
}: Props) {
  const { t } = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [srcUrl, setSrcUrl] = useState<string | null>(null);

  // MPULSE Phase 3 — align picker limit with `MAX_UPLOAD_BYTES` (15 MB) so
  // the 15 MB error message is shown inline before the upload starts.
  const HARD_CAP_MB = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));
  const effectiveMaxMB = Math.min(maxMB ?? HARD_CAP_MB, HARD_CAP_MB);

  const presets = aspectPresets && aspectPresets.length > 0 ? aspectPresets : DEFAULT_ASPECTS;
  const resolveKeyForValue = (val: number | null | undefined): string => {
    if (!val) return presets[0].key;
    const match = presets.find((p) => Math.abs(p.value - val) < 0.02);
    return match ? match.key : presets[0].key;
  };

  const [aspectKey, setAspectKey] = useState<string>(() => resolveKeyForValue(defaultAspect));
  useEffect(() => {
    if (defaultAspect) {
      setAspectKey(resolveKeyForValue(defaultAspect));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultAspect, presets.length]);

  const aspect = useMemo(
    () => presets.find((a) => a.key === aspectKey)?.value ?? defaultAspect ?? 16 / 9,
    [presets, aspectKey, defaultAspect],
  );

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pixelCrop, setPixelCrop] = useState<Area | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [previewTab, setPreviewTab] = useState<PreviewTab>('desktop');
  const [cropping, setCropping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset transient state on new image
  const resetTransforms = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  const handleFile = (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) { setError(t('imageCrop.error.notImage')); return; }
    const mb = file.size / (1024 * 1024);
    if (mb > effectiveMaxMB) {
      // Inline error mirrors the wording from `imageService.assertUnderCap`
      // so users see the same "max 15 MB" message before the upload path,
      // not as an async toast after clicking Save.
      setError(t('imageCrop.error.tooLarge', { sizeMB: mb.toFixed(1), maxMB: effectiveMaxMB }));
      return;
    }
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    resetTransforms();

    const i = new Image();
    i.onload = () => setNaturalSize({ w: i.naturalWidth, h: i.naturalHeight });
    i.src = url;
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  const onCropChange = useCallback((c: { x: number; y: number }) => setCrop(c), []);
  const onZoomChange = useCallback((z: number) => setZoom(z), []);
  const onCropAreaComplete = useCallback((_a: Area, px: Area) => setPixelCrop(px), []);

  // Debounced live preview generation
  useEffect(() => {
    if (!srcUrl || !pixelCrop) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const { dataUrl } = await cropImageToBlob(srcUrl, pixelCrop, rotation, 0.7, 600);
        if (!cancelled) setPreviewDataUrl(dataUrl);
      } catch { /* ignore preview errors */ }
    }, 120);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [srcUrl, pixelCrop, rotation]);

  const handleCropAndUse = async () => {
    if (!srcUrl || !pixelCrop) return;
    setCropping(true);
    setError(null);
    try {
      const { blob, dataUrl } = await cropImageToBlob(srcUrl, pixelCrop, rotation, 0.9, 1600);
      onCropComplete(blob, dataUrl);
    } catch (e: any) {
      setError(e?.message || 'Crop failed');
    } finally {
      setCropping(false);
    }
  };

  const handleChange = () => {
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    setSrcUrl(null);
    setPreviewDataUrl(null);
    setPixelCrop(null);
    setNaturalSize(null);
    resetTransforms();
    onClear();
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  // Keyboard shortcuts while editing
  useEffect(() => {
    if (!srcUrl) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') { setZoom((z) => Math.min(4, z + 0.1)); e.preventDefault(); }
      else if (e.key === '-' || e.key === '_') { setZoom((z) => Math.max(1, z - 0.1)); e.preventDefault(); }
      else if (e.key === 'r' || e.key === 'R') { setRotation((r) => (r + 90) % 360); e.preventDefault(); }
      else if (e.key === '0') { resetTransforms(); e.preventDefault(); }
      else if (e.key === 'Enter' && !cropping && !uploading) { handleCropAndUse(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcUrl, cropping, uploading, pixelCrop, rotation]);

  // Cleanup object URLs
  useEffect(() => () => { if (srcUrl) URL.revokeObjectURL(srcUrl); }, [srcUrl]);

  // Warnings
  const warnings = useMemo(() => {
    const out: string[] = [];
    if (pixelCrop && (pixelCrop.width < 600 || pixelCrop.height < 400)) {
      out.push(t('imageCrop.warn.lowRes'));
    }
    if (naturalSize && (naturalSize.w < 800 || naturalSize.h < 600)) {
      out.push(t('imageCrop.warn.smallOriginal'));
    }
    return out;
  }, [pixelCrop, naturalSize, t]);

  // ---- Render: persisted preview (already uploaded) ----
  if (previewUrl && !srcUrl) {
    const handleEditExisting = async () => {
      setError(null);
      try {
        const res = await fetch(previewUrl, { mode: 'cors', cache: 'no-cache' });
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (srcUrl) URL.revokeObjectURL(srcUrl);
        setSrcUrl(url);
        resetTransforms();
        const i = new Image();
        i.onload = () => setNaturalSize({ w: i.naturalWidth, h: i.naturalHeight });
        i.src = url;
      } catch {
        setError(t('imageCrop.error.editLoadFailed'));
      }
    };
    return (
      <div className="space-y-2">
        <img
          src={previewUrl}
          alt="Preview"
          className="w-full max-h-64 object-cover rounded-xl border border-border"
          style={{ aspectRatio: String(aspect) }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleEditExisting}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline disabled:opacity-50"
          >
            <Pencil className="w-3.5 h-3.5" /> {t('imageCrop.editPhoto')}
          </button>
          <button
            type="button"
            onClick={handleChange}
            disabled={uploading}
            className="flex items-center gap-1.5 text-sm text-muted-foreground font-medium hover:underline disabled:opacity-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('imageCrop.changePhoto')}
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
      </div>
    );
  }

  // ---- Render: crop editor ----
  if (srcUrl) {
    return (
      <div className="space-y-3">
        {presets.length > 1 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setAspectKey(p.key)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-colors ${
                  aspectKey === p.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {presets[0]?.key === 'card' ? t('imageCrop.lockedAspect') : `Aspect locked to ${presets[0]?.label}`}
          </p>
        )}


        <div className="grid gap-3 md:grid-cols-[1fr_240px]">
          {/* Cropper surface */}
          <div className="space-y-2">
            <div
              className="relative w-full rounded-xl overflow-hidden border border-border bg-muted"
              style={{ height: 320 }}
            >
              <Cropper
                image={srcUrl}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspect}
                showGrid
                restrictPosition
                onCropChange={onCropChange}
                onZoomChange={onZoomChange}
                onCropComplete={onCropAreaComplete}
                objectFit="contain"
              />
            </div>

            {/* Zoom + rotate + reset controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[160px]">
                <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
                <Slider
                  value={[zoom]}
                  min={1}
                  max={4}
                  step={0.01}
                  onValueChange={(v) => setZoom(v[0])}
                  className="flex-1"
                />
                <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted transition-colors"
                  title="Rotate 90° (R)"
                >
                  <RotateCw className="w-3.5 h-3.5" /> {t('imageCrop.rotate')}
                </button>
                <button
                  type="button"
                  onClick={resetTransforms}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-semibold border border-border hover:bg-muted transition-colors"
                  title="Reset (0)"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t('imageCrop.reset')}
                </button>
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              {t('imageCrop.shortcutsHint')}
            </p>
          </div>

          {/* Live preview panel */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
              {([
                { k: 'desktop', icon: <Monitor className="w-3 h-3" />, label: t('imageCrop.preview.desktop') },
                { k: 'mobile', icon: <Smartphone className="w-3 h-3" />, label: t('imageCrop.preview.mobile') },
                { k: 'banner', icon: <ImageIcon className="w-3 h-3" />, label: t('imageCrop.preview.banner') },
              ] as { k: PreviewTab; icon: React.ReactNode; label: string }[]).map((tab) => (
                <button
                  key={tab.k}
                  type="button"
                  onClick={() => setPreviewTab(tab.k)}
                  className={`flex-1 flex items-center justify-center gap-1 px-1.5 py-1 rounded text-[10px] font-semibold transition-colors ${
                    previewTab === tab.k ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Mock shop-card preview */}
            {previewTab !== 'banner' ? (
              <div
                className={`bg-card rounded-xl border border-border overflow-hidden ${
                  previewTab === 'mobile' ? 'max-w-[180px] mx-auto' : ''
                }`}
              >
                <div className="relative w-full bg-muted" style={{ aspectRatio: '16/9' }}>
                  {previewDataUrl ? (
                    <img src={previewDataUrl} alt="Card preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                      {t('imageCrop.rendering')}
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="h-2.5 w-3/4 rounded bg-muted mb-1.5" />
                  <div className="h-2 w-1/2 rounded bg-muted/70" />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden bg-muted" style={{ aspectRatio: '3/1' }}>
                {previewDataUrl ? (
                  <img src={previewDataUrl} alt="Banner preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                    {t('imageCrop.rendering')}
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground text-center">
              {previewTab === 'desktop' ? t('imageCrop.livePreview.desktop') : previewTab === 'mobile' ? t('imageCrop.livePreview.mobile') : t('imageCrop.livePreview.banner')}
            </p>

            {pixelCrop && (
              <p className="text-[10px] text-muted-foreground text-center">
                Output: {Math.round(pixelCrop.width)} × {Math.round(pixelCrop.height)} px
              </p>
            )}
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <ul className="space-y-0.5">
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleCropAndUse}
            disabled={cropping || uploading || !pixelCrop}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {cropping || uploading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? t('imageCrop.uploading') : t('imageCrop.cropping')}</>
              : <><Check className="w-4 h-4" /> {t('imageCrop.saveAndContinue')}</>}
          </button>
          <button
            type="button"
            onClick={handleChange}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground border border-border hover:bg-muted transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" /> {t('imageCrop.change')}
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} className="sr-only" />
      </div>
    );
  }

  // ---- Render: initial picker ----
  return (
    <div>
      <label className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors hover:border-primary/40 border-border bg-background ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
        <span className="text-2xl">📷</span>
        <span className="text-sm text-foreground font-medium">{t('imageCrop.choosePhoto')}</span>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChange} disabled={uploading} className="sr-only" />
      </label>
      <p className="text-[11px] text-muted-foreground mt-1">{t('imageCrop.fileHint', { maxMB })}</p>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  );
}

// Backwards-compat: keep the old icon import path expectation
export { CropIcon as Crop };
