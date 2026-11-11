/**
 * Side-by-side admin review modal for a pending shop claim.
 *
 *  ┌─ Shop (left) ─────────────┬─ Claim (right) ──────────────┐
 *  │ name / address / phone     │ claimant name / contact phone │
 *  │ verified status            │ proof type + photo (clickable) │
 *  │ owners on record           │ submitter note                 │
 *  └────────────────────────────┴───────────────────────────────┘
 *  Actions: Approve · Request more info · Reject (with notes)
 *
 * Approve / Reject go through the existing RPCs; the modal also writes
 * `admin_notes` directly first (admin UPDATE policy added in the
 * 2026-06-28_claim_verification.sql patch).
 */
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { createShopImageSignedUrl, getShopImagePublicUrl } from '@/lib/storageNaming';
import {
  Loader2, ShieldCheck, BadgeCheck, Phone, MapPin, X, Check,
  HelpCircle, Image as ImageIcon, ExternalLink, FileText, UserCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

interface Claim {
  id: string;
  shop_id: string;
  user_id: string;
  contact_phone: string | null;
  note: string | null;
  status: string;
  created_at: string;
  proof_image_path?: string | null;
  proof_type?: string | null;
  admin_notes?: string | null;
  profiles: { full_name: string | null; phone?: string | null } | null;
  shops: { name: string | null; phone?: string | null; area?: string | null; is_verified?: boolean } | null;
}

interface Props {
  claim: Claim;
  onClose: () => void;
  onChanged: () => void;
}

const PROOF_LABEL: Record<string, string> = {
  aadhar_card: 'Aadhaar Card',
  gst: 'GST Certificate',
  utility_bill: 'Utility Bill',
  shop_board: 'Shop board photo',
  other: 'Other',
};

export function ClaimReviewModal({ claim, onClose, onChanged }: Props) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(claim.admin_notes || '');
  const [busy, setBusy] = useState<null | 'approve' | 'reject' | 'info'>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signLoading, setSignLoading] = useState(false);

  // Pull a fresh shop-owners list so the admin can see who already owns
  // this shop before approving another claimant.
  const { data: currentOwners } = useQuery({
    queryKey: ['admin-claim-shop-owners', claim.shop_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('shop_owners')
        .select('user_id')
        .eq('shop_id', claim.shop_id);
      if (!data?.length) return [];
      const ids = data.map((r: any) => r.user_id);
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', ids);
      return profs || [];
    },
  });

  // Sign the proof image (it's in shop-images bucket under claims/<user>/...
  // and we narrow public access via storage RLS — see the patch).
  useEffect(() => {
    let cancelled = false;
    async function sign() {
      if (!claim.proof_image_path) { setSignedUrl(null); return; }
      setSignLoading(true);
      const { data, error } = await createShopImageSignedUrl(claim.proof_image_path, 60 * 15); // 15 min
      if (!cancelled) {
        if (error || !data?.signedUrl) {
          // Fall back to public URL — the file may have been uploaded
          // before the narrowing RLS landed, so the public URL still works.
          setSignedUrl(getShopImagePublicUrl(claim.proof_image_path) || null);
        } else {
          setSignedUrl(data.signedUrl);
        }
        setSignLoading(false);
      }
    }
    sign();
    return () => { cancelled = true; };
  }, [claim.proof_image_path]);

  async function saveNotesIfDirty(): Promise<boolean> {
    if ((notes || '') === (claim.admin_notes || '')) return true;
    const { error } = await supabase
      .from('shop_claims')
      .update({ admin_notes: notes || null } as any)
      .eq('id', claim.id);
    if (error) { toast.error(`Couldn't save notes: ${error.message}`); return false; }
    return true;
  }

  async function approve() {
    setBusy('approve');
    const okNotes = await saveNotesIfDirty();
    if (!okNotes) { setBusy(null); return; }
    const { error } = await supabase.rpc('approve_shop_claim' as any, { _claim_id: claim.id });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Claim approved — shopkeeper assigned.');
    qc.invalidateQueries({ queryKey: ['admin-owners-grouped'] });
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    onChanged();
    onClose();
  }

  async function reject() {
    if (!notes.trim()) { toast.error('Please add a note explaining why.'); return; }
    setBusy('reject');
    const { error } = await supabase.rpc('reject_shop_claim' as any, {
      _claim_id: claim.id, _notes: notes.trim(),
    });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Claim rejected.');
    qc.invalidateQueries({ queryKey: ['admin-stats'] });
    onChanged();
    onClose();
  }

  async function requestMoreInfo() {
    if (!notes.trim()) { toast.error('Add a note describing what info you need.'); return; }
    setBusy('info');
    const ok = await saveNotesIfDirty();
    setBusy(null);
    if (!ok) return;
    toast.success('Note saved — claim stays pending.');
    onChanged();
    onClose();
  }

  const proofLabel = PROOF_LABEL[claim.proof_type || ''] || (claim.proof_type ?? '—');

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Review claim
          </DialogTitle>
          <DialogDescription>
            Compare what the claimant submitted against the shop on record before approving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* LEFT — Shop on record */}
          <section className="rounded-xl border border-border bg-muted/30 p-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Shop on record</h4>
            <p className="font-bold text-foreground text-sm leading-tight">{claim.shops?.name ?? '—'}</p>
            {claim.shops?.area && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {claim.shops.area}
              </p>
            )}
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-foreground">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="tabular-nums">{claim.shops?.phone || '—'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {claim.shops?.is_verified
                  ? <span className="inline-flex items-center gap-1 text-success font-semibold"><BadgeCheck className="w-3.5 h-3.5" /> Verified</span>
                  : <span className="text-muted-foreground">Not yet verified</span>}
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">Current owners</p>
              {currentOwners == null ? (
                <p className="text-[11px] text-muted-foreground">Loading…</p>
              ) : currentOwners.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">None — first owner.</p>
              ) : (
                <ul className="space-y-0.5">
                  {currentOwners.map((p: any) => (
                    <li key={p.id} className="text-[11px] text-foreground">
                      <UserCircle2 className="inline w-3 h-3 text-muted-foreground mr-1" />
                      {p.full_name || p.id.slice(0, 8)}
                      {p.phone && <span className="text-muted-foreground"> · {p.phone}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* RIGHT — Claim submission */}
          <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-primary mb-2">Claim submission</h4>
            <p className="font-bold text-foreground text-sm leading-tight">
              {claim.profiles?.full_name || `User ${claim.user_id.slice(0, 8)}`}
            </p>
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex items-center gap-1.5 text-foreground">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="tabular-nums">{claim.contact_phone || '—'}</span>
                {claim.shops?.phone && claim.contact_phone === claim.shops.phone && (
                  <span className="ml-1 inline-flex items-center gap-0.5 text-success text-[10px] font-bold">
                    <Check className="w-3 h-3" /> matches shop
                  </span>
                )}
              </div>
              <p className="text-muted-foreground">
                Submitted {new Date(claim.created_at).toLocaleString()}
              </p>
            </div>

            <div className="mt-3 pt-2 border-t border-primary/20">
              <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1 flex items-center gap-1">
                <FileText className="w-3 h-3" /> Proof: {proofLabel}
              </p>
              {claim.proof_image_path ? (
                signLoading ? (
                  <div className="rounded-lg border border-border h-32 flex items-center justify-center text-xs text-muted-foreground">
                    Loading proof…
                  </div>
                ) : signedUrl ? (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block relative group rounded-lg overflow-hidden border border-border bg-card"
                    title="Open full size"
                  >
                    <img
                      src={signedUrl}
                      alt={`Proof: ${proofLabel}`}
                      className="w-full max-h-56 object-contain bg-muted"
                    />
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px]">
                      <ExternalLink className="w-3 h-3" /> Open
                    </span>
                  </a>
                ) : (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    Couldn't load proof image.
                  </div>
                )
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 mt-0.5" />
                  <span>No proof image attached (claim submitted before the verification flow was added).</span>
                </div>
              )}
            </div>

            {claim.note && (
              <div className="mt-3 pt-2 border-t border-primary/20">
                <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1">Submitter note</p>
                <p className="text-xs text-foreground italic">"{claim.note}"</p>
              </div>
            )}
          </section>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-foreground mb-1">
            Admin notes <span className="text-muted-foreground font-normal">(required to reject or request info)</span>
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g. Phone doesn't match shop record — please call back with proof…"
            rows={2}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm font-semibold bg-muted text-foreground"
          >
            Close
          </button>
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              onClick={requestMoreInfo}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy === 'info' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <HelpCircle className="w-3.5 h-3.5" /> Request more info
            </button>
            <button
              onClick={reject}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-destructive/10 text-destructive disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy === 'reject' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <X className="w-3.5 h-3.5" /> Reject
            </button>
            <button
              onClick={approve}
              disabled={!!busy}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-success text-success-foreground disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              {busy === 'approve' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <Check className="w-3.5 h-3.5" /> Approve & assign
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
