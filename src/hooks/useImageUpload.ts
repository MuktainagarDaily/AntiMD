/**
 * useImageUpload — Forge recommendation #3 (Phase 2 Foundations).
 *
 * Small state wrapper around any async image uploader. Owns the three pieces
 * of UI state that every current call site (ShopModal, SpeedShopModal,
 * RequestListingModal, MyShop, ClaimShopModal) currently hand-rolls:
 *   - `uploading` boolean
 *   - `error` string
 *   - a stable `upload(...)` callback that toggles the above around any
 *     async function returning `{ publicUrl }` (or similar)
 *
 * Framework-agnostic on the uploader signature: pass whatever variadic args
 * the underlying service takes. Returns whatever it returns.
 *
 * Kept intentionally minimal — the actual compress+upload work still lives
 * in `@/lib/images/imageService`. This hook just removes boilerplate.
 */
import { useCallback, useRef, useState } from 'react';

export interface UseImageUploadResult<TArgs extends any[], TResult> {
  uploading: boolean;
  error: string | null;
  /** Runs the uploader; sets uploading/error automatically. Rethrows on failure. */
  upload: (...args: TArgs) => Promise<TResult>;
  /** Manually reset the error string (does not touch `uploading`). */
  clearError: () => void;
}

export function useImageUpload<TArgs extends any[], TResult>(
  uploader: (...args: TArgs) => Promise<TResult>,
): UseImageUploadResult<TArgs, TResult> {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref keeps `upload` referentially stable even if the caller passes a fresh
  // inline uploader on every render — matches how the existing modals behave.
  const uploaderRef = useRef(uploader);
  uploaderRef.current = uploader;

  const upload = useCallback(async (...args: TArgs) => {
    setUploading(true);
    setError(null);
    try {
      const result = await uploaderRef.current(...args);
      return result;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setError(msg);
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { uploading, error, upload, clearError };
}
