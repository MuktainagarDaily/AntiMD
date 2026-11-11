import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X, Loader2, Upload, CheckCircle2, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { isValidIndianPhone } from '@/lib/utils';
import { compressImage } from '@/lib/imageUtils';
import { uploadShopImageAtPath, removeShopImageQuiet } from '@/lib/storageNaming';
import { useT } from '@/i18n';

interface Props {
  shopId: string;
  shopName: string;
  onClose: () => void;
}

type ProofType = 'gst' | 'aadhar_card' | 'utility_bill' | 'shop_board' | 'other';

const PROOF_OPTIONS: { value: ProofType; labelKey: string }[] = [
  { value: 'aadhar_card',  labelKey: 'claim.proof.aadhar' },
  { value: 'gst',          labelKey: 'claim.proof.gst' },
  { value: 'utility_bill', labelKey: 'claim.proof.utility' },
  { value: 'shop_board',   labelKey: 'claim.proof.shopBoard' },
  { value: 'other',        labelKey: 'claim.proof.other' },
];

/**
 * Modal that lets a logged-in user claim ownership of a shop.
 * Requires a phone number AND a photo of a verification document
 * (Aadhaar, GST cert, utility bill, or a photo of the shop's board)
 * so an admin can verify ownership before granting `shopkeeper` role.
 */
export function ClaimShopModal({ shopId, shopName, onClose }: Props) {
  const { t } = useT();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  const [proofType, setProofType] = useState<ProofType>('aadhar_card');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['my-claim', shopId, user?.id],
    enabled: !!user && !!shopId,
    queryFn: async () => {
      const { data } = await supabase
        .from('shop_claims')
        .select('id, status')
        .eq('shop_id', shopId).eq('user_id', user!.id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  if (!user) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-card rounded-2xl max-w-sm w-full p-5">
          <h3 className="font-bold text-lg mb-2 text-foreground">{t('claim.signIn.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('claim.signIn.desc', { shopName })}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold">{t('claim.cancel')}</button>
            <button
              onClick={() => navigate(`/auth?next=/shop/${shopId}&claim=1`)}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >{t('claim.signInBtn')}</button>
          </div>
        </div>
      </Backdrop>
    );
  }

  const phoneDigits = phone.replace(/\D/g, '');
  const validPhone = isValidIndianPhone(phone);
  const canSubmit = validPhone && !!proofFile && !submitting;

  function handleProofPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error(t('claim.proof.notImage'));
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast.error(t('claim.proof.tooLarge'));
      return;
    }
    setProofFile(f);
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofPreview(URL.createObjectURL(f));
  }

  async function submit() {
    if (!validPhone) { toast.error(t('claim.phoneInvalid')); return; }
    if (!proofFile)  { toast.error(t('claim.proof.missing')); return; }
    setSubmitting(true);
    try {
      // Compress to WebP and upload under claims/<user_id>/<uuid>.webp.
      // Path prefix is enforced by the storage RLS policy in the
      // 2026-06-28_claim_verification.sql patch.
      const blob = await compressImage(proofFile, 1600, 0.82);
      const fileId = crypto.randomUUID();
      const path = `claims/${user!.id}/${fileId}.webp`;
      const { error: upErr } = await uploadShopImageAtPath(path, blob);
      if (upErr) throw new Error(upErr);

      const { error } = await supabase.from('shop_claims').insert({
        shop_id: shopId,
        user_id: user!.id,
        contact_phone: phoneDigits,
        note: note.trim() || null,
        status: 'pending',
        proof_image_path: path,
        proof_type: proofType,
      } as any);
      if (error) {
        // Best-effort cleanup of the orphaned upload so we don't pile up
        // unreferenced proof images.
        await removeShopImageQuiet(path);
        throw error;
      }

      toast.success(t('claim.toast.success'), {
        description: t('claim.toast.successDesc'),
        action: { label: t('claim.toast.track'), onClick: () => navigate('/my-shop') },
        duration: 8000,
      });
      qc.invalidateQueries({ queryKey: ['my-claim', shopId] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-card rounded-2xl max-w-sm w-full p-5 max-h-[92vh] overflow-y-auto border border-border shadow-xl">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-base text-foreground leading-tight">{t('claim.title')}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{shopName}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={t('claim.closeAria')} className="p-1.5 rounded-lg hover:bg-muted shrink-0">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {existing?.status === 'pending' ? (
          <div className="rounded-xl bg-muted/60 border border-border p-3 text-sm text-foreground">
            {t('claim.alreadyPending')}
          </div>
        ) : existing?.status === 'approved' ? (
          <div className="rounded-xl bg-success/10 border border-success/30 p-3 text-sm text-foreground">
            {t('claim.approved')}
          </div>
        ) : (
          <>
            <label className="block mb-3">
              <span className="block text-xs font-semibold text-foreground mb-1">{t('claim.phoneLabel')}</span>
              <input
                type="tel" inputMode="numeric" value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('claim.phonePlaceholder')}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {t('claim.phoneHint')}
              </span>
            </label>

            <label className="block mb-3">
              <span className="block text-xs font-semibold text-foreground mb-1">{t('claim.proof.typeLabel')}</span>
              <select
                value={proofType}
                onChange={(e) => setProofType(e.target.value as ProofType)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PROOF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
                ))}
              </select>
            </label>

            <div className="mb-3">
              <span className="block text-xs font-semibold text-foreground mb-1">{t('claim.proof.uploadLabel')}</span>
              {proofPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={proofPreview} alt="proof preview" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setProofFile(null); URL.revokeObjectURL(proofPreview); setProofPreview(null); }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white"
                    aria-label="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success/90 text-success-foreground text-[10px] font-bold">
                    <CheckCircle2 className="w-3 h-3" /> {t('claim.proof.ready')}
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-4 rounded-xl border-2 border-dashed border-border bg-muted/40 hover:bg-muted text-sm font-semibold text-foreground"
                >
                  <Camera className="w-4 h-4" />
                  {t('claim.proof.pick')}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleProofPick}
                className="sr-only"
              />
              <p className="text-[11px] text-muted-foreground mt-1">{t('claim.proof.hint')}</p>
            </div>

            <label className="block mb-4">
              <span className="block text-xs font-semibold text-foreground mb-1">{t('claim.noteLabel')}</span>
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)}
                rows={3} maxLength={300}
                placeholder={t('claim.notePlaceholder')}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </label>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold">{t('claim.cancel')}</button>
              <button
                onClick={submit} disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t('claim.submit')}
              </button>
            </div>
          </>
        )}
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {children}
    </div>
  );
}
