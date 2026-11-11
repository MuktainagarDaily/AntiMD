import { useState } from 'react';
import { PageSeo } from '@/components/seo/PageSeo';
import { z } from 'zod';

import { useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Mail, Lock, User as UserIcon, ArrowLeft, CheckCircle2, UserCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { safeRelativePath } from '@/lib/utils';
import { useT } from '@/i18n';
import { useCity } from '@/hooks/useCity';
import { checkCooldown } from '@/lib/rateLimit';

type Mode = 'signin' | 'signup' | 'forgot';

// ----- Validation schemas (client-side; server still enforces auth) -----
const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .max(255, 'Email is too long')
  .email('Enter a valid email address');

const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters')
  .max(72, 'Password must be at most 72 characters'); // bcrypt cap

const strongPasswordSchema = passwordSchema
  .refine((v) => /[A-Za-z]/.test(v), 'Include at least one letter')
  .refine((v) => /[0-9]/.test(v), 'Include at least one number');

const fullNameSchema = z
  .string()
  .trim()
  .max(80, 'Name is too long')
  .regex(/^[\p{L}\p{M}'.\- ]*$/u, 'Name has invalid characters')
  .optional()
  .or(z.literal(''));

const signInSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signUpSchema = z.object({
  fullName: fullNameSchema,
  email: emailSchema,
  password: strongPasswordSchema,
});

const forgotSchema = z.object({ email: emailSchema });

// Lightweight sanitizer: strip control chars and collapse whitespace.
const sanitize = (v: string) =>
  v.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();

type FieldErrors = Partial<Record<'email' | 'password' | 'fullName', string>>;

export default function Auth() {
  const { t } = useT();
  const { townBrand } = useCity();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [signupSent, setSignupSent] = useState(false);
  const [signupEmail, setSignupEmail] = useState('');

  const { user, loading: authLoading, signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Accept both `next` (canonical) and legacy `redirect`. Validate it's a
  // same-origin relative path to prevent open-redirect attacks via
  // `/auth?next=https://evil.com`.
  const rawNext = params.get('next') ?? params.get('redirect');
  const nextPath = safeRelativePath(rawNext);
  const claimFlag = params.get('claim');
  const redirectTo = nextPath
    ? `${nextPath}${claimFlag ? (nextPath.includes('?') ? '&' : '?') + 'claim=1' : ''}`
    : '/';

  if (!authLoading && user) return <Navigate to={redirectTo} replace />;

  const friendlyError = (msg?: string) => {
    if (!msg) return 'Something went wrong. Please try again.';
    if (/network|fetch|failed/i.test(msg)) return 'Network error — check your internet and try again.';
    if (/invalid login credentials|invalid_credentials/i.test(msg)) return 'Invalid email or password.';
    if (/already registered|user.*exists/i.test(msg)) return 'An account with this email already exists. Try signing in.';
    if (/rate limit|too many/i.test(msg)) return 'Too many attempts. Please wait a moment and try again.';
    if (/password.*short|at least/i.test(msg)) return 'Password must be at least 6 characters.';
    return msg;
  };

  const applyZodErrors = (err: z.ZodError): FieldErrors => {
    const out: FieldErrors = {};
    for (const issue of err.issues) {
      const key = issue.path[0] as keyof FieldErrors | undefined;
      if (key && !out[key]) out[key] = issue.message;
    }
    return out;
  };

  const handleGuest = () => {
    toast({ title: t('auth.browsingAsGuest'), description: t('auth.guestFeatureHint') });
    navigate(redirectTo);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // Throttle auth attempts — protects against keyboard-Enter mashing on
    // sign-in / sign-up / forgot-password. Server-side Supabase rate limits
    // remain authoritative.
    if (!checkCooldown(`auth-submit:${mode}`, 1500)) {
      setError(t('rate.tooFast'));
      return;
    }

    // Sanitize first so what we validate is what we send.
    const cleanEmail = sanitize(email).toLowerCase();
    const cleanName = sanitize(fullName);

    if (mode === 'signin') {
      const parsed = signInSchema.safeParse({ email: cleanEmail, password });
      if (!parsed.success) { setFieldErrors(applyZodErrors(parsed.error)); return; }
    } else if (mode === 'signup') {
      const parsed = signUpSchema.safeParse({
        fullName: cleanName,
        email: cleanEmail,
        password,
      });
      if (!parsed.success) { setFieldErrors(applyZodErrors(parsed.error)); return; }
    } else {
      const parsed = forgotSchema.safeParse({ email: cleanEmail });
      if (!parsed.success) { setFieldErrors(applyZodErrors(parsed.error)); return; }
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(cleanEmail, password);
        if (error) { setError(friendlyError(error.message)); return; }
        toast({ title: t('auth.welcomeBack.toast'), description: t('auth.signedIn.toast') });
        navigate(redirectTo);
      } else if (mode === 'signup') {
        const { error } = await signUp(cleanEmail, password, cleanName || undefined, redirectTo);
        if (error) { setError(friendlyError(error.message)); return; }
        setSignupEmail(cleanEmail);
        setSignupSent(true);
        setPassword('');
      } else if (mode === 'forgot') {
        const { error } = await resetPassword(cleanEmail);
        if (error) { setError(friendlyError(error.message)); return; }
        setForgotSent(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setFieldErrors({});
    setForgotSent(false);
    setSignupSent(false);
  };

  const resendForgot = async () => {
    if (!checkCooldown('auth-forgot-resend', 5000)) {
      setError(t('rate.tooFast'));
      return;
    }
    const { error } = await resetPassword(email);
    if (error) { setError(friendlyError(error.message)); return; }
    toast({ title: t('auth.forgot.resentToast') });
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4 py-8">
      <PageSeo title={`Sign in — ${townBrand}`} path="/auth" noindex />

      <div className="w-full max-w-sm">
        {/* Brand header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{t('app.name')}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t('auth.tagline')}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-lg">
          {/* Tabs (hidden in forgot mode) */}
          {mode !== 'forgot' && (
            <div className="grid grid-cols-2 bg-muted rounded-lg p-1 mb-5">
              <button
                onClick={() => switchMode('signin')}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${
                  mode === 'signin' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t('common.signIn')}
              </button>
              <button
                onClick={() => switchMode('signup')}
                className={`py-2 rounded-md text-sm font-semibold transition-all ${
                  mode === 'signup' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                {t('common.signUp')}
              </button>
            </div>
          )}

          {mode === 'forgot' && (
            <button
              onClick={() => switchMode('signin')}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> {t('auth.backToSignIn')}
            </button>
          )}

          <h2 className="font-bold text-lg text-foreground mb-1">
            {mode === 'signin' && t('auth.signIn.title')}
            {mode === 'signup' && t('auth.signUp.title')}
            {mode === 'forgot' && t('auth.resetPassword.title')}
          </h2>
          <p className="text-sm text-muted-foreground mb-5">
            {mode === 'signin' && t('auth.signIn.subtitle')}
            {mode === 'signup' && t('auth.signUp.subtitle')}
            {mode === 'forgot' && t('auth.forgot.subtitle')}
          </p>

          {signupSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">{t('auth.signup.checkInbox')}</p>
              <p className="text-sm text-muted-foreground mb-5 break-words">
                {t('auth.signup.confirmSent', { email: signupEmail })}
              </p>
              <button
                onClick={() => switchMode('signin')}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                {t('auth.backToSignIn')}
              </button>
            </div>
          ) : forgotSent ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">{t('auth.forgot.checkInbox')}</p>
              <p className="text-sm text-muted-foreground mb-5 break-words">
                {t('auth.forgot.resetSent', { email })}
              </p>
              <button
                onClick={resendForgot}
                className="w-full mb-2 border border-border text-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors"
              >
                {t('auth.forgot.resend')}
              </button>
              <button
                onClick={() => switchMode('signin')}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                {t('auth.backToSignIn')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {mode === 'signup' && (
                <Field label={t('auth.fullName')} icon={<UserIcon className="w-4 h-4" />} error={fieldErrors.fullName}>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onBlur={() => setFullName((v) => sanitize(v))}
                    placeholder={t('auth.placeholder.fullName')}
                    autoComplete="name"
                    maxLength={80}
                    className="min-w-0 flex-1 bg-transparent outline-none focus-visible:outline-none focus-visible:shadow-none text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </Field>
              )}

              <Field label={t('auth.email')} icon={<Mail className="w-4 h-4" />} error={fieldErrors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmail((v) => sanitize(v).toLowerCase())}
                  placeholder={t('auth.placeholder.email')}
                  autoComplete="email"
                  inputMode="email"
                  required
                  maxLength={255}
                  className="min-w-0 flex-1 bg-transparent outline-none focus-visible:outline-none focus-visible:shadow-none text-foreground placeholder:text-muted-foreground text-sm"
                />
              </Field>

              {mode !== 'forgot' && (
                <Field label={t('auth.password')} icon={<Lock className="w-4 h-4" />} error={fieldErrors.password}>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={6}
                    maxLength={72}
                    className="min-w-0 flex-1 bg-transparent outline-none focus-visible:outline-none focus-visible:shadow-none text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </Field>
              )}


              {mode === 'signup' && (
                <p className="text-[11px] text-muted-foreground -mt-1">
                  {t('auth.passwordHint')}
                </p>
              )}

              {error && (
                <p className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {loading
                  ? t('auth.loading')
                  : mode === 'signin'
                  ? t('common.signIn')
                  : mode === 'signup'
                  ? t('auth.createAccount')
                  : t('auth.sendResetLink')}
              </button>

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="w-full text-center text-sm text-primary hover:underline font-medium"
                >
                  {t('auth.forgot')}
                </button>
              )}

              {/* Dev Quick Admin Login */}
              {import.meta.env.DEV && mode === 'signin' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEmail('admin-test@apnalocal.in');
                      setPassword('Password@123');
                      window.localStorage.setItem('dev_admin', 'true');
                      toast({ title: 'Dev Admin Credentials Loaded', description: 'Click Sign In to authenticate as Admin.' });
                    }}
                    className="w-full text-xs py-2 px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold hover:bg-purple-500/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>⚡ Dev 1-Tap Admin Login</span>
                  </button>
                </div>
              )}
            </form>
          )}

          {/* Guest mode (hidden in forgot or after reset-sent) */}
          {mode !== 'forgot' && !forgotSent && !signupSent && (
            <>
              <div className="flex items-center gap-2 my-4">
                <div className="h-px flex-1 bg-border" />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t('auth.or')}</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              <button
                type="button"
                onClick={handleGuest}
                className="w-full flex items-center justify-center gap-2 border border-border bg-background text-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-muted transition-colors"
              >
                <UserCircle2 className="w-4 h-4" />
                {t('auth.continueAsGuest')}
              </button>
              <p className="text-[11px] text-center text-muted-foreground mt-2">
                {t('auth.guestHint')}
              </p>
            </>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          {mode === 'signin' && (
            <>{t('auth.noAccount')}{' '}
              <button onClick={() => switchMode('signup')} className="text-primary font-semibold hover:underline">
                {t('common.signUp')}
              </button>
            </>
          )}
          {mode === 'signup' && (
            <>{t('auth.haveAccount')}{' '}
              <button onClick={() => switchMode('signin')} className="text-primary font-semibold hover:underline">
                {t('common.signIn')}
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function Field({
  label, icon, children, error,
}: { label: string; icon: React.ReactNode; children: React.ReactNode; error?: string }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-foreground mb-1.5">{label}</span>
      <span
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring transition-all ${
          error ? 'border-destructive' : 'border-input'
        }`}
      >
        <span className="text-muted-foreground shrink-0">{icon}</span>
        {children}
      </span>
      {error && <span className="block text-[11px] text-destructive mt-1">{error}</span>}
    </label>
  );
}
