import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/ui/drawer';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/hooks/useCity';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ChevronLeft, Check, X, Loader2, Lock, AtSign, Mail, Phone, Cake, Users2, Save, AlertCircle, MapPin } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useSwipeDownToClose } from '@/hooks/useSwipeDownToClose';
import { useT } from '@/i18n';

interface ProfileRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  birth_date: string | null;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | null;
  full_name_changed_at: string | null;
  city_id?: string | null;
  village_id?: string | null;
}

const USERNAME_RE = /^[a-z][a-z0-9_.]{2,23}$/;
const PHONE_RE = /^\+?[0-9]{10,15}$/;

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a >= 0 && a < 150 ? a : null;
}

export function EditProfileDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user } = useAuth();
  const { allCities, currentCity, setCity } = useCity();
  const { t } = useT();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<ProfileRow | null>(null);

  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState<ProfileRow['gender']>(null);
  const [cityId, setCityId] = useState<string>('');
  const [villageId, setVillageId] = useState<string>('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Username is locked once full_name_changed_at is set.
  const usernameLocked = !!profile?.full_name_changed_at;

  // Track if user has modified any form field compared to loaded profile
  const hasUnsavedChanges = useMemo(() => {
    if (!profile) return false;
    const initialUsername = (profile.full_name ?? '').toLowerCase();
    const initialPhone = profile.phone ?? '';
    const initialBirthDate = profile.birth_date ?? '';
    const initialGender = profile.gender ?? null;
    const initialCityId = profile.city_id || currentCity.id;
    const initialVillageId = profile.village_id || '';

    return (
      username.toLowerCase() !== initialUsername ||
      phone !== initialPhone ||
      birthDate !== initialBirthDate ||
      gender !== initialGender ||
      cityId !== initialCityId ||
      villageId !== initialVillageId
    );
  }, [profile, username, phone, birthDate, gender, cityId, villageId, currentCity.id]);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [hasUnsavedChanges, onOpenChange]);

  const handleDiscardAndClose = () => {
    if (profile) {
      setUsername(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setBirthDate(profile.birth_date ?? '');
      setGender(profile.gender);
      setCityId(profile.city_id || currentCity.id);
      setVillageId(profile.village_id || '');
    }
    setShowDiscardConfirm(false);
    onOpenChange(false);
  };

  // Enable mobile swipe-down gesture anywhere on drawer surface
  const { ref: swipeRef } = useSwipeDownToClose({
    isOpen: open,
    onClose: () => onOpenChange(false),
    beforeClose: () => {
      if (hasUnsavedChanges) {
        setShowDiscardConfirm(true);
        return false;
      }
      return true;
    },
  });

  // Load profile when opened
  const loadProfile = () => {
    if (!user) return () => {};
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    supabase
      .from('profiles')
      .select('id, full_name, phone, birth_date, gender, full_name_changed_at, city_id, village_id')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          toast.error(t('profile.loadFailed'));
          setLoadError(true);
          setLoading(false);
          return;
        }
        const p = (data as ProfileRow | null) ?? {
          id: user.id, full_name: null, phone: null, birth_date: null,
          gender: null, full_name_changed_at: null, city_id: null, village_id: null,
        };
        setProfile(p);
        setUsername(p.full_name ?? '');
        setPhone(p.phone ?? '');
        setBirthDate(p.birth_date ?? '');
        setGender(p.gender);
        setCityId(p.city_id || currentCity.id);
        setVillageId(p.village_id || '');
        setLoading(false);
      });
    return () => { cancelled = true; };
  };
  useEffect(() => {
    if (!open || !user) return;
    return loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user]);

  // ─── Username availability check ────────────────────────────────────
  const trimmedUser = username.trim().toLowerCase();
  const debouncedUser = useDebouncedValue(trimmedUser, 400);
  const originalUser = (profile?.full_name ?? '').toLowerCase();
  const usernameFormatOk = USERNAME_RE.test(trimmedUser);
  const isUnchanged = trimmedUser === originalUser;

  const [availState, setAvailState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'error'>('idle');
  useEffect(() => {
    if (usernameLocked) { setAvailState('idle'); return; }
    if (!debouncedUser || isUnchanged) { setAvailState('idle'); return; }
    if (!usernameFormatOk) { setAvailState('idle'); return; }
    let cancelled = false;
    setAvailState('checking');
    supabase
      .rpc('username_available', { _username: debouncedUser })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) setAvailState('error');
        else setAvailState(data ? 'ok' : 'taken');
      });
    return () => { cancelled = true; };
  }, [debouncedUser, usernameFormatOk, isUnchanged, usernameLocked]);

  const age = useMemo(() => ageFromDob(birthDate || null), [birthDate]);

  // ─── Validation ─────────────────────────────────────────────────────
  const phoneOk = !phone || PHONE_RE.test(phone.trim());
  const usernameOk = usernameLocked || isUnchanged || (usernameFormatOk && availState === 'ok');
  const canSave = !loading && !saving && phoneOk && usernameOk && trimmedUser.length > 0;

  const handleSave = async () => {
    if (!user || !canSave) return;
    setSaving(true);
    const patch: any = {
      phone: phone.trim() || null,
      birth_date: birthDate || null,
      gender: gender ?? null,
      city_id: cityId || null,
      village_id: villageId || null,
    };
    // Only send full_name if it actually changed (the trigger blocks
    // a second change but is also case-insensitive, so re-sending the
    // same value is a no-op and safe).
    if (!isUnchanged && !usernameLocked) {
      patch.full_name = trimmedUser;
    }
    const { error } = await supabase
      .from('profiles')
      .update(patch as never)
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      // 23505 = unique violation (race), check_violation = trigger / format
      if ((error as { code?: string }).code === '23505') {
        toast.error(t('profile.usernameTaken'));
        setAvailState('taken');
        return;
      }
      toast.error(error.message || 'Could not save your profile');
      return;
    }
    // Sync current active town with user profile selection
    const targetCity = allCities.find((c) => c.id === cityId);
    if (targetCity && targetCity.slug !== currentCity.slug) {
      setCity(targetCity.slug);
    }
    toast.success('Profile updated');
    onOpenChange(false);
  };

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <DrawerContent ref={swipeRef} className="max-w-lg mx-auto rounded-t-2xl overflow-hidden pb-safe">
        <div
          className="h-2 w-full"
          style={{
            background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--secondary)), hsl(var(--primary)))',
            backgroundSize: '200% 100%',
            animation: 'gradient-shift 3s ease infinite',
          }}
        />
        <DrawerHeader className="sr-only">
          <DrawerTitle>Edit profile</DrawerTitle>
          <DrawerDescription>Update your username, mobile and personal details</DrawerDescription>
        </DrawerHeader>

        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <button
            onClick={requestClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors active:scale-95"
            aria-label="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base text-foreground leading-tight">Edit profile</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">Account details — visible to you</p>
          </div>
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
            <AtSign className="w-4 h-4" />
          </span>
        </div>

        <div className="px-4 pb-4 pt-2 overflow-y-auto max-h-[75vh] space-y-4">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
              <AlertCircle className="w-6 h-6 mx-auto mb-2 text-destructive" />
              <p className="font-semibold text-sm text-foreground mb-1">{t('profile.loadFailed')}</p>
              <p className="text-xs text-muted-foreground mb-3">{t('profile.loadFailedDesc')}</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => loadProfile()}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
                >
                  {t('profile.retry')}
                </button>
                <button
                  onClick={() => onOpenChange(false)}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-semibold"
                >
                  {t('common.close')}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Username */}
              <Field
                icon={<AtSign className="w-4 h-4" />}
                label="Username"
                hint={
                  usernameLocked
                    ? 'You\'ve already used your one-time username change. This is now permanent.'
                    : 'Lowercase letters, numbers, "_" and ".". 3–24 chars, must start with a letter. You can change this only once — ever.'
                }
              >
                <div className="relative">
                  <Input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    disabled={usernameLocked}
                    placeholder="yourname"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    className="pr-9"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {usernameLocked ? (
                      <Lock className="w-4 h-4" />
                    ) : isUnchanged || !trimmedUser ? null : !usernameFormatOk ? (
                      <X className="w-4 h-4 text-destructive" />
                    ) : availState === 'checking' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : availState === 'ok' ? (
                      <Check className="w-4 h-4 text-success" />
                    ) : availState === 'taken' ? (
                      <X className="w-4 h-4 text-destructive" />
                    ) : null}
                  </div>
                </div>
                {!usernameLocked && trimmedUser && !isUnchanged && (
                  <p className={`text-[11px] mt-1 ${
                    !usernameFormatOk
                      ? 'text-destructive'
                      : availState === 'taken'
                        ? 'text-destructive'
                        : availState === 'ok'
                          ? 'text-success'
                          : 'text-muted-foreground'
                  }`}>
                    {!usernameFormatOk
                      ? 'Use 3–24 chars: a–z, 0–9, "_" or "."; must start with a letter.'
                      : availState === 'checking'
                        ? 'Checking availability…'
                        : availState === 'ok'
                          ? '@' + trimmedUser + ' is available'
                          : availState === 'taken'
                            ? 'That username is taken'
                            : ''}
                  </p>
                )}
              </Field>

              {/* Email (read-only) */}
              <Field icon={<Mail className="w-4 h-4" />} label="Email" hint="Email is linked to your sign-in and cannot be changed here.">
                <Input value={user?.email ?? ''} readOnly disabled className="bg-muted/40" />
              </Field>

              {/* Mobile */}
              <Field
                icon={<Phone className="w-4 h-4" />}
                label="Mobile number"
                hint="OTP verification is coming soon. For now your number is saved as-is."
              >
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  inputMode="tel"
                  type="tel"
                />
                {phone && !phoneOk && (
                  <p className="text-[11px] mt-1 text-destructive">Enter 10–15 digits, optional leading "+".</p>
                )}
              </Field>

              {/* Birth date + age */}
              <Field icon={<Cake className="w-4 h-4" />} label="Date of birth">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="flex-1"
                  />
                  <div className="w-20 shrink-0 flex items-center justify-center rounded-md border border-input bg-muted/40 text-sm text-muted-foreground">
                    {age !== null ? `${age} yrs` : '—'}
                  </div>
                </div>
              </Field>

              {/* Gender */}
              <Field icon={<Users2 className="w-4 h-4" />} label="Gender">
                <div className="grid grid-cols-2 gap-2">
                  {(['male', 'female', 'other', 'prefer_not_to_say'] as const).map((g) => {
                    const labels: Record<typeof g, string> = {
                      male: 'Male',
                      female: 'Female',
                      other: 'Other',
                      prefer_not_to_say: 'Prefer not to say',
                    };
                    const active = gender === g;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGender(active ? null : g)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors text-left ${
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-input bg-background text-foreground hover:bg-muted'
                        }`}
                      >
                        {labels[g]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Home Town / City */}
              <Field icon={<MapPin className="w-4 h-4" />} label="Home Town / City" hint="Your saved location for directory listings, shops and bus schedules">
                <select
                  value={cityId}
                  onChange={(e) => {
                    setCityId(e.target.value);
                    setVillageId('');
                  }}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {allCities.map((c) => {
                    const cDistrictName = typeof c.district === 'object' && c.district ? c.district.name : 'Jalgaon';
                    return (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.name_mr ? `(${c.name_mr})` : ''} · {cDistrictName}
                      </option>
                    );
                  })}
                </select>
              </Field>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="w-full mt-2 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </>
          )}
        </div>
      </DrawerContent>
    </Drawer>

    <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <AlertDialogContent className="max-w-sm rounded-2xl p-5">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base font-bold text-foreground">
            Discard unsaved changes?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground mt-1">
            You have unsaved changes in your profile. Are you sure you want to discard them and close?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2 mt-4 sm:justify-end">
          <AlertDialogCancel
            onClick={() => setShowDiscardConfirm(false)}
            className="flex-1 mt-0 rounded-xl"
          >
            Keep editing
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscardAndClose}
            className="flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Discard & close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}

function Field({
  icon, label, hint, children,
}: { icon: React.ReactNode; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="flex items-center gap-1.5 text-xs font-semibold text-foreground mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{hint}</p>}
    </div>
  );
}
