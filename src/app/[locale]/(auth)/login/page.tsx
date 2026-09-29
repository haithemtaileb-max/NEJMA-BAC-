import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { AuthCard } from '@/components/auth/auth-card';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('auth'))('loginTitle') };
}

export default async function LoginPage({ searchParams }: PageProps<'/[locale]/login'>) {
  const { next } = await searchParams;
  return <AuthCard mode="login" next={typeof next === 'string' ? next : undefined} />;
}
