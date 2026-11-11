import React, { useRef, useState } from 'react';
import { Camera, Plus, Trash2, Star, Loader2, Image as ImageIcon, Sparkles, Check } from 'lucide-react';
import { compressImage } from '@/lib/imageUtils';
import { toast } from 'sonner';
import { useT } from '@/i18n';

export interface MultiImageSlot {
  url: string;
  file?: File | Blob;
}

interface MultiImageCropPickerProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
  onUploadFile?: (blob: Blob, slotIndex: number) => Promise<string>;
  uploading?: boolean;
  disabled?: boolean;
  label?: string;
}

export function MultiImageCropPicker({
  photos = [],
  onChange,
  maxPhotos = 5,
  onUploadFile,
  uploading = false,
  disabled = false,
  label,
}: MultiImageCropPickerProps) {
  const { locale } = useT();
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [localProcessing, setLocalProcessing] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Trigger file picker for a specific slot
  const handleOpenPicker = (slotIndex: number) => {
    if (disabled || uploading) return;
    setActiveSlot(slotIndex);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  // Process chosen file
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlot === null) return;

    try {
      setLocalProcessing(activeSlot);
      // Client-side WebP compression (< 250 KB)
      const compressedBlob = await compressImage(file, 1200, 0.85);

      if (onUploadFile) {
        // Direct remote upload provided by parent
        const uploadedUrl = await onUploadFile(compressedBlob, activeSlot);
        const updated = [...photos];
        updated[activeSlot] = uploadedUrl;
        onChange(updated.filter(Boolean));
      } else {
        // Local preview data URL staged for form submission
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const updated = [...photos];
          updated[activeSlot] = dataUrl;
          onChange(updated.filter(Boolean));
        };
        reader.readAsDataURL(compressedBlob);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to process image');
    } finally {
      setLocalProcessing(null);
      setActiveSlot(null);
    }
  };

  // Remove photo from a slot
  const handleRemove = (index: number) => {
    const updated = photos.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Set any gallery photo as the primary cover photo (move to slot 0)
  const handleMakeCover = (index: number) => {
    if (index === 0 || !photos[index]) return;
    const target = photos[index];
    const remaining = photos.filter((_, i) => i !== index);
    onChange([target, ...remaining]);
    toast.success(locale === 'mr' ? 'मुख्य कव्हर फोटो म्हणून सेट केले!' : 'Set as primary cover photo!');
  };

  const coverPhoto = photos[0] || null;
  const galleryPhotos = Array.from({ length: maxPhotos - 1 }, (_, i) => photos[i + 1] || null);

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header and status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate">{label || (locale === 'mr' ? 'फोटो (कमाल ५)' : 'Photos (Up to 5)')}</span>
          </label>
          <p className="text-[10px] text-muted-foreground">
            {locale === 'mr'
              ? 'स्लॉट १ हा मुख्य कव्हर फोटो असेल जो कार्ड्स व शोधात दिसेल.'
              : 'Slot 1 is your main cover photo shown on search and cards.'}
          </p>
        </div>
        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-muted">
          {photos.length} / {maxPhotos}
        </span>
      </div>

      {/* Slot 1: Primary Cover Photo */}
      <div className="relative">
        {coverPhoto ? (
          <div className="relative h-44 w-full rounded-2xl overflow-hidden border-2 border-primary/40 bg-muted group shadow-xs">
            <img src={coverPhoto} alt="Cover" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent pointer-events-none" />

            {/* Badge */}
            <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground shadow-xs">
              <Star className="w-3 h-3 fill-current" />
              <span>{locale === 'mr' ? 'मुख्य कव्हर फोटो' : 'Primary Cover'}</span>
            </span>

            {/* Action buttons */}
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleOpenPicker(0)}
                disabled={uploading || localProcessing === 0}
                className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-background/90 hover:bg-background text-foreground shadow-xs backdrop-blur-xs transition-all active:scale-95"
              >
                {locale === 'mr' ? 'बदला' : 'Change'}
              </button>
              <button
                type="button"
                onClick={() => handleRemove(0)}
                disabled={uploading}
                className="p-1.5 rounded-xl bg-destructive/90 hover:bg-destructive text-destructive-foreground shadow-xs transition-all active:scale-95"
                title={locale === 'mr' ? 'काढून टाका' : 'Remove'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => handleOpenPicker(0)}
            disabled={uploading || localProcessing === 0}
            className="w-full h-36 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-2 p-4 text-center cursor-pointer group active:scale-[0.99]"
          >
            {localProcessing === 0 ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-primary/15 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    {locale === 'mr' ? '+ मुख्य कव्हर फोटो अपलोड करा' : '+ Upload Primary Cover Photo'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {locale === 'mr' ? 'कॅमेऱ्याने फोटो काढा किंवा गॅलरीतून निवडा' : 'Click to take a photo or select from gallery'}
                  </p>
                </div>
              </>
            )}
          </button>
        )}
      </div>

      {/* Slots 2 to 5: Additional Gallery Photos */}
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">
          {locale === 'mr' ? 'अतिरिक्त गॅलरी फोटो (ऐच्छिक)' : 'Gallery Photos (Optional)'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {galleryPhotos.map((photo, idx) => {
            const slotIndex = idx + 1;
            const isProcessingThis = localProcessing === slotIndex;

            if (photo) {
              return (
                <div
                  key={slotIndex}
                  className="relative h-20 rounded-xl overflow-hidden border border-border bg-muted group shadow-2xs"
                >
                  <img src={photo} alt={`Gallery ${slotIndex}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/25 to-transparent sm:bg-black/45 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity flex items-end sm:items-center justify-end sm:justify-center gap-1.5 p-1.5 sm:p-0">
                    <button
                      type="button"
                      onClick={() => handleMakeCover(slotIndex)}
                      className="p-1.5 sm:p-1 rounded-lg bg-primary text-primary-foreground text-[9px] hover:scale-110 transition-transform shadow-xs"
                      title={locale === 'mr' ? 'कव्हर करा' : 'Set as cover'}
                      aria-label={locale === 'mr' ? 'कव्हर करा' : 'Set as cover'}
                    >
                      <Star className="w-3 h-3 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(slotIndex)}
                      className="p-1.5 sm:p-1 rounded-lg bg-destructive text-destructive-foreground hover:scale-110 transition-transform shadow-xs"
                      title={locale === 'mr' ? 'काढून टाका' : 'Remove'}
                      aria-label={locale === 'mr' ? 'काढून टाका' : 'Remove'}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={slotIndex}
                type="button"
                onClick={() => handleOpenPicker(slotIndex)}
                disabled={uploading || isProcessingThis}
                className="h-20 rounded-xl border border-dashed border-input hover:border-primary bg-card hover:bg-muted/40 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground cursor-pointer active:scale-95"
              >
                {isProcessingThis ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span className="text-[9px] font-semibold">
                      {locale === 'mr' ? `फोटो ${slotIndex + 1}` : `Photo ${slotIndex + 1}`}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
