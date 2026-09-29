'use client';

import { CircleAlert, MailCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useActionState } from 'react';

import { Button } from '@/components/ui/button';
import { signIn, signUp, type AuthFormState } from '@/server/actions/auth';

const inputClass =
  'mt-1.5 block h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20';

/** Email/password form for both sign-in and sign-up (progressively enhanced Server Action). */
export function AuthForm({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(mode === 'login' ? signIn : signUp, null);

  if (state?.info === 'check_email') {
    return (
      <p role="status" className="flex items-start gap-3 rounded-xl bg-success-soft p-4 text-sm text-success">
        <MailCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        {t('checkEmail')}
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="locale" value={locale} />
      {next && <input type="hidden" name="next" value={next} />}

      {mode === 'register' && (
        <label className="block text-sm font-medium">
          {t('displayName')}
          <input name="displayName" required minLength={2} maxLength={80} autoComplete="nickname" className={inputClass} />
        </label>
      )}
      <label className="block text-sm font-medium">
        {t('email')}
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-medium">
        {t('password')}
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className={inputClass}
        />
        {mode === 'register' && <span className="mt-1 block text-xs font-normal text-muted-foreground">{t('passwordHint')}</span>}
      </label>

      {state?.error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
          <CircleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t(`errors.${state.error}`)}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {mode === 'login' ? t('submitLogin') : t('submitRegister')}
      </Button>
    </form>
  );
}
