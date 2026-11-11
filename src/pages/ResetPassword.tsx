import { useState, useEffect, useRef } from 'react';
import { PageSeo } from '@/components/seo/PageSeo';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { MapPin, Lock, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCity } from '@/hooks/useCity';
import { useT } from '@/i18n';

export default function ResetPassword() {
  const { t } = useT();
  const { townBrand } = useCity();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState<boolean | null>(null);
  const redirectTimer = useRef<number | null>(null);

  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => () => {
    if (redirectTimer.current !== null) window.clearTimeout(redirectTimer.current);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || session) {
        setHasRecoverySession(true);
      }
    });
    const timer = window.setTimeout(() => {
      setHasRecoverySession((prev) => (prev === null ? false : prev));
    }, 3000);
    return () => { subscription.unsubscribe(); window.clearTimeout(timer); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError(t('validation.passwordTooShort')); return; }
    if (password !== confirmPassword) { setError(t('validation.passwordsNoMatch')); return; }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);
    if (error) { setError(error.message || t('resetPassword.error')); return; }
    setDone(true);
    toast({ title: t('resetPassword.toast.title'), description: t('resetPassword.toast.desc') });
    redirectTimer.current = window.setTimeout(() => navigate('/auth'), 2000);
  };

  return (
    <div className="min-h-screen bg-muted flex items-center justify-center px-4 py-8">
      <PageSeo title={`Reset Password — ${townBrand}`} path="/reset-password" noindex />

      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-1.5">
            <MapPin className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{t('app.name')}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t('resetPassword.tagline')}</p>
        </div>

        <div className="bg-card rounded-2xl border border-border p-5 sm:p-6 shadow-lg">
          {done ? (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <p className="font-semibold text-foreground mb-1">{t('resetPassword.done.title')}</p>
              <p className="text-sm text-muted-foreground mb-4">{t('resetPassword.done.desc')}</p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                {t('resetPassword.goSignIn')}
              </button>
            </div>
          ) : hasRecoverySession === false ? (
            <div className="text-center py-4">
              <p className="font-semibold text-foreground mb-2">{t('resetPassword.invalidLink.title')}</p>
              <p className="text-sm text-muted-foreground mb-4">
                {t('resetPassword.invalidLink.desc')}
              </p>
              <button
                onClick={() => navigate('/auth')}
                className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                {t('resetPassword.invalidLink.back')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <h2 className="font-bold text-lg text-foreground mb-1">{t('resetPassword.title')}</h2>
              <p className="text-sm text-muted-foreground mb-4">{t('resetPassword.passwordHint')}</p>

              <label className="block">
                <span className="block text-xs font-semibold text-foreground mb-1.5">{t('resetPassword.newPassword')}</span>
                <span className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('resetPassword.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="min-w-0 flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </span>
              </label>

              <label className="block">
                <span className="block text-xs font-semibold text-foreground mb-1.5">{t('resetPassword.confirmPassword')}</span>
                <span className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
                  <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder={t('resetPassword.passwordPlaceholder')}
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="min-w-0 flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground text-sm"
                  />
                </span>
              </label>

              {error && (
                <p className="text-destructive text-sm bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-bold text-base hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {loading ? t('resetPassword.updating') : t('resetPassword.submit')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
