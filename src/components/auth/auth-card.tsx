import { getTranslations } from 'next-intl/server';

import { buttonClasses } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { isDemoMode } from '@/lib/supabase/env';

import { AuthForm } from './auth-form';

export async function AuthCard({ mode, next }: { mode: 'login' | 'register'; next?: string }) {
  const t = await getTranslations();
  const isLogin = mode === 'login';

  return (
    <Card className="w-full max-w-md p-6 sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">{isLogin ? t('auth.loginTitle') : t('auth.registerTitle')}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{isLogin ? t('auth.loginSubtitle') : t('auth.registerSubtitle')}</p>

      <div className="mt-6">
        {isDemoMode ? (
          <div className="space-y-4">
            <p className="rounded-xl bg-warning-soft p-3 text-sm text-warning">{t('demo.authNotice')}</p>
            <Link href="/onboarding" className={buttonClasses('primary', 'lg', 'w-full')}>
              {t('demo.continue')}
            </Link>
          </div>
        ) : (
          <AuthForm mode={mode} next={next} />
        )}
      </div>

      {!isDemoMode && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {isLogin ? t('auth.noAccount') : t('auth.haveAccount')}{' '}
          <Link href={isLogin ? '/register' : '/login'} className="font-medium text-primary hover:underline">
            {isLogin ? t('auth.toRegister') : t('auth.toLogin')}
          </Link>
        </p>
      )}
    </Card>
  );
}
