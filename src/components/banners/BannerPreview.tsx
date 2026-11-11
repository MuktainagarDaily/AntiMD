/**
 * Live preview surface for BannerModal — renders the banner the way
 * the public site does (popup vs inline mobile/desktop), without view/click tracking.
 */
import { useState } from 'react';
import { Monitor, Smartphone, X } from 'lucide-react';
import { BannerPlacement } from '@/lib/banners/types';

interface Props {
  title: string;
  imageUrl: string;
  placement: BannerPlacement;
  closeEnableSeconds: number;
}

export function BannerPreview({ title, imageUrl, placement, closeEnableSeconds }: Props) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop');
  const safeTitle = title.trim() || 'Untitled banner';

  if (!imageUrl) {
    return (
      <div className="aspect-[16/9] w-full rounded-2xl border border-dashed border-border bg-muted/40 flex items-center justify-center text-xs text-muted-foreground">
        Add an image to see preview
      </div>
    );
  }

  if (placement === 'popup') {
    return (
      <div className="rounded-2xl border border-border bg-black/75 p-3 flex justify-center">
        <div className="relative w-full max-w-[220px] rounded-2xl overflow-hidden bg-card shadow-xl flex flex-col">
          <div className="absolute top-1.5 right-1.5 z-10 inline-flex items-center justify-center h-6 min-w-[28px] px-1.5 rounded-full bg-black/65 text-white text-[10px] font-bold gap-1">
            {closeEnableSeconds > 0 ? (
              <><X className="w-2.5 h-2.5 opacity-70" />{closeEnableSeconds}s</>
            ) : (
              <X className="w-3 h-3" />
            )}
          </div>
          <div className="aspect-[3/4] w-full overflow-hidden bg-muted">
            <img
              src={imageUrl}
              alt={safeTitle}
              width={220}
              height={293}
              decoding="async"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="p-2.5 flex items-center gap-2 border-t border-border/50">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-foreground truncate">{safeTitle}</p>
              <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Sponsored</p>
            </div>
            <span className="shrink-0 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold">
              Visit
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Inline placements (shows exact mobile 16:9 or desktop 3:1 aspect + Sponsored badge)
  return (
    <div className="space-y-2">
      <div className="flex justify-end gap-1">
        <button
          type="button"
          onClick={() => setViewport('desktop')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
            viewport === 'desktop'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          <Monitor className="w-3 h-3" /> Desktop (3:1)
        </button>
        <button
          type="button"
          onClick={() => setViewport('mobile')}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
            viewport === 'mobile'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:bg-muted'
          }`}
        >
          <Smartphone className="w-3 h-3" /> Mobile (16:9)
        </button>
      </div>

      <div
        className={`relative overflow-hidden rounded-2xl border border-dashed border-border/80 shadow-sm mx-auto ${
          viewport === 'mobile' ? 'w-full max-w-[280px] aspect-[16/9]' : 'w-full aspect-[3/1]'
        }`}
      >
        <img
          src={imageUrl}
          alt={safeTitle}
          width={900}
          height={300}
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <span className="absolute top-1.5 left-1.5 text-[10px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded-md bg-background/85 text-foreground backdrop-blur-sm border border-border/60">
          Sponsored
        </span>
      </div>
    </div>
  );
}
