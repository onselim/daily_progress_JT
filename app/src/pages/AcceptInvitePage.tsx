import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useLanguage } from '../lib/i18n/LanguageContext';

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(t('acceptInvite.passwordTooShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('acceptInvite.passwordMismatch'));
      return;
    }
    setSubmitting(true);
    const { data: updateData, error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setSubmitting(false);
      setError(updateError.message);
      return;
    }

    // This page serves both a brand-new invite (no roles yet -> /field is the safer
    // landing spot) and an existing admin resetting a forgotten password (-> /admin) --
    // check which roles the now-authenticated user actually has rather than assuming.
    const userId = updateData.user?.id;
    const { data: roleRows } = userId
      ? await supabase.from('user_project_roles').select('role').eq('user_id', userId)
      : { data: null };
    setSubmitting(false);

    const isAdmin = roleRows?.some((r) => r.role === 'admin');
    navigate(isAdmin ? '/admin' : '/field');
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>{t('acceptInvite.title')}</h1>
        <p className="wizard-hint">{t('acceptInvite.subtitle')}</p>
        <label>
          {t('acceptInvite.newPassword')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        <label>
          {t('acceptInvite.confirmPassword')}
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? t('acceptInvite.submitting') : t('acceptInvite.submit')}
        </button>
      </form>
    </div>
  );
}
