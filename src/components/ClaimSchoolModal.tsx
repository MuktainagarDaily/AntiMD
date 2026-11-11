import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck, X, Loader2, Upload, CheckCircle2, Camera, GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n';
import { isValidIndianPhone } from '@/lib/utils';
import { compressImage } from '@/lib/imageUtils';
import { uploadShopImageAtPath, removeShopImageQuiet } from '@/lib/storageNaming';
import { isMissingRelationErr } from '@/lib/entities/claimEntity';

interface Props {
  schoolId: string;
  schoolName: string;
  defaultUdise?: string | null;
  onClose: () => void;
}

type SchoolProofType =
  | 'udise_letter'
  | 'govt_recognition'
  | 'trust_registration'
  | 'appointment_letter'
  | 'school_board'
  | 'aadhar_card'
  | 'id_card'
  | 'other';

const PROOF_OPTIONS: { value: SchoolProofType; labelEn: string; labelMr: string }[] = [
  {
    value: 'udise_letter',
    labelEn: 'UDISE+ / AISHE Certificate',
    labelMr: 'UDISE+ / AISHE प्रमाणपत्र',
  },
  {
    value: 'govt_recognition',
    labelEn: 'Govt / Board Recognition Letter',
    labelMr: 'शासकीय / मंडळ मान्यता पत्र',
  },
  {
    value: 'trust_registration',
    labelEn: 'Sanstha / Trust Registration',
    labelMr: 'संस्था / ट्रस्ट नोंदणी प्रमाणपत्र',
  },
  {
    value: 'appointment_letter',
    labelEn: 'Principal / Staff Appointment Letter',
    labelMr: 'प्राचार्य / कर्मचारी नियुक्ती पत्र',
  },
  {
    value: 'school_board',
    labelEn: 'Photo of Institute Signboard / Gate',
    labelMr: 'संस्थेच्या फलकाचा फोटो',
  },
  {
    value: 'id_card',
    labelEn: 'Official Institute ID Card',
    labelMr: 'संस्थेचे अधिकृत ओळखपत्र',
  },
  {
    value: 'aadhar_card',
    labelEn: 'Authorized Person Aadhaar Card',
    labelMr: 'अधिकृत व्यक्तीचे आधार कार्ड',
  },
  {
    value: 'other',
    labelEn: 'Other Supporting Proof',
    labelMr: 'इतर पुरावा',
  },
];

const ROLE_OPTIONS = [
  'Principal',
  'Vice Principal',
  'Trustee / Secretary',
  'Admission Coordinator',
  'Institute Owner',
];

export function ClaimSchoolModal({ schoolId, schoolName, defaultUdise, onClose }: Props) {
  const { t, locale } = useT();
  const isMr = locale === 'mr';
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phone, setPhone] = useState('');
  const [roleClaimed, setRoleClaimed] = useState('Principal');
  const [udiseOrId, setUdiseOrId] = useState(defaultUdise || '');
  const [proofType, setProofType] = useState<SchoolProofType>('udise_letter');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ['my-school-claim', schoolId, user?.id],
    enabled: !!user && !!schoolId,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from('school_claims')
          .select('id, status')
          .eq('school_id', schoolId)
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) {
          if (isMissingRelationErr(error)) return null;
          throw error;
        }
        return data as { id: string; status: string } | null;
      } catch {
        return null;
      }
    },
  });

  if (!user) {
    return (
      <Backdrop onClose={onClose}>
        <div className="bg-card rounded-2xl max-w-sm w-full p-5 border border-border shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-lg text-foreground">{t('claim.signIn.title')}</h3>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {isMr
              ? `${schoolName} वर दावा करण्यासाठी आणि प्रवेश/सूचना व्यवस्थापित करण्यासाठी साइन इन करा.`
              : `Sign in to claim ${schoolName} and manage live notices, admissions & campus details.`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold"
            >
              {t('claim.cancel')}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/auth?next=${encodeURIComponent(location.pathname)}&claim=1`)}
              className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
            >
              {t('claim.signInBtn')}
            </button>
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
    if (!validPhone) {
      toast.error(t('claim.phoneInvalid'));
      return;
    }
    if (!proofFile) {
      toast.error(t('claim.proof.missing'));
      return;
    }

    setSubmitting(true);
    try {
      const blob = await compressImage(proofFile, 1600, 0.82);
      const fileId = crypto.randomUUID();
      const path = `claims/${user!.id}/${fileId}.webp`;
      const { error: upErr } = await uploadShopImageAtPath(path, blob);
      if (upErr) throw new Error(upErr);

      const { error } = await (supabase as any).from('school_claims').insert({
        school_id: schoolId,
        user_id: user!.id,
        contact_phone: phoneDigits,
        role_claimed: roleClaimed,
        udise_or_id: udiseOrId.trim() || null,
        proof_image_path: path,
        proof_type: proofType,
        note: note.trim() || null,
        status: 'pending',
      });

      if (error) {
        await removeShopImageQuiet(path);
        if (isMissingRelationErr(error)) {
          throw new Error(
            isMr
              ? 'संस्था दावा प्रणाली अद्याप डेटाबेसवर कार्यान्वित केलेली नाही.'
              : 'Institute claims table is not provisioned on the database yet.',
          );
        }
        throw error;
      }

      toast.success(
        isMr ? 'संस्थेचा दावा सादर झाला!' : 'Institute claim submitted for review!',
        {
          description: isMr
            ? 'अ‍ॅडमिन मंजुरीनंतर तुम्हाला माझी शिक्षण संस्था पोर्टलमध्ये प्रवेश मिळेल.'
            : 'Once an admin verifies your document, your My Institute portal will unlock automatically.',
          action: {
            label: isMr ? 'पोर्टल पहा' : 'Open Portal',
            onClick: () => navigate('/my-institute'),
          },
          duration: 8000,
        },
      );
      qc.invalidateQueries({ queryKey: ['my-school-claim', schoolId] });
      onClose();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Backdrop onClose={onClose}>
      <div className="bg-card rounded-2xl max-w-md w-full p-5 max-h-[92vh] overflow-y-auto border border-border shadow-xl">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-base text-foreground leading-tight">
                {isMr ? 'शिक्षण संस्थेवर दावा करा' : 'Claim this Institute'}
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">{schoolName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('claim.closeAria')}
            className="p-1.5 rounded-lg hover:bg-muted shrink-0"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {existing?.status === 'pending' ? (
          <div className="rounded-xl bg-muted/60 border border-border p-3.5 text-sm text-foreground">
            {isMr
              ? 'तुमचा या संस्थेवरील दावा अ‍ॅडमिन पुनरावलोकनासाठी प्रलंबित आहे.'
              : 'You already have a pending claim for this institute. Please wait for admin review.'}
          </div>
        ) : existing?.status === 'approved' ? (
          <div className="rounded-xl bg-success/10 border border-success/30 p-3.5 text-sm text-foreground flex flex-wrap items-center justify-between gap-2">
            <span>
              {isMr ? 'तुमचा दावा मंजूर झाला आहे!' : 'Your claim is approved — manage from My Institute.'}
            </span>
            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(`/my-shop?type=school&id=${schoolId}`);
              }}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold shrink-0"
            >
              {isMr ? 'उघडा' : 'Open Hub'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block">
              <span className="block text-xs font-semibold text-foreground mb-1">
                {isMr ? 'संस्थेतील पद / जबाबदारी *' : 'Your Role at Institute *'}
              </span>
              <select
                value={roleClaimed}
                onChange={(e) => setRoleClaimed(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-foreground mb-1">
                {isMr ? 'अधिकृत संपर्क मोबाईल (10 अंक) *' : 'Official Contact Phone (10 digits) *'}
              </span>
              <input
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="9876543210"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-[11px] text-muted-foreground mt-1 block">
                {isMr
                  ? 'संस्थेच्या नोंदीशी जुळणारा मोबाईल किंवा कार्यालयीन क्रमांक प्रविष्ट करा.'
                  : 'Used by admin to verify affiliation with the school or college.'}
              </span>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-foreground mb-1">
                {isMr ? 'UDISE+ / AISHE / DTE कोड (ऐच्छिक)' : 'UDISE+ / AISHE / DTE Code (optional)'}
              </span>
              <input
                type="text"
                value={udiseOrId}
                onChange={(e) => setUdiseOrId(e.target.value)}
                placeholder="e.g. 27030704501 or C-41234"
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-foreground mb-1">
                {t('claim.proof.typeLabel')}
              </span>
              <select
                value={proofType}
                onChange={(e) => setProofType(e.target.value as SchoolProofType)}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {PROOF_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {isMr ? o.labelMr : o.labelEn}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="block text-xs font-semibold text-foreground mb-1">
                {t('claim.proof.uploadLabel')}
              </span>
              {proofPreview ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img src={proofPreview} alt="proof preview" className="w-full max-h-48 object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setProofFile(null);
                      URL.revokeObjectURL(proofPreview);
                      setProofPreview(null);
                    }}
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
              <p className="text-[11px] text-muted-foreground mt-1">
                {isMr
                  ? 'फक्त अ‍ॅडमिन पडताळणीसाठी वापरले जाईल — सार्वजनिक केले जाणार नाही.'
                  : 'Used strictly for admin verification — never shown publicly.'}
              </p>
            </div>

            <label className="block">
              <span className="block text-xs font-semibold text-foreground mb-1">
                {t('claim.noteLabel')}
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={300}
                placeholder={isMr ? 'उदा. मी संस्थेचा प्राचार्य / कार्यालय प्रमुख आहे…' : 'e.g. Serving as Principal since 2019…'}
                className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold"
              >
                {t('claim.cancel')}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {t('claim.submit')}
              </button>
            </div>
          </div>
        )}
      </div>
    </Backdrop>
  );
}

function Backdrop({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </div>
  );
}
